# FE_MB Stat Check System — Design Spec

**Date:** 2026-05-10
**Author:** Claude Opus 4.7 (1M context)
**Supersedes:** none (extends `2026-05-08-phaser-foundations-v2-design.md`)
**Status:** Draft for user approval

## Problem statement

Today the game has *partial* dialogue stat checks: `DialogueBranch` of kind `statCheck` (`src/domain/dialogue.ts:10-16`) gates dialogue paths via `party.partyStatTotal(stat) >= threshold` (`src/systems/dialogueRunner.ts:42-46`). Two dialogues use it (`bandit_threat.json`, blood-ties chain). It is also tied to one quest's effects (`src/domain/quest.ts`). There is no encounter-side check, no class/resource check, and the party-sum semantic doesn't match player intuition — recruiting four 4-STR units to pass a [STR 12] check is unsatisfying compared to recruiting one 7-STR Knight.

The user wants a **Fallout: New Vegas**-style stat check system covering both dialogue and Slay-the-Spire-style encounters. Specifically:

- **Deterministic** (NV "White Check"): pass if stat ≥ threshold, no roll, no save-scumming.
- **Per-unit attempt**: when a check fires, the player picks which unit attempts it; that unit's stat alone is compared to the threshold.
- **NV-style visibility**: unmet checks remain visible but greyed out, with the threshold readable, so the player can plan recruitment / level-ups.
- **Three encounter surfaces**: existing travel encounters, mid-dungeon room events (`event` room type, currently stubbed), and a new post-victory reward gate.
- **Stat axes beyond the 6 unit stats**: include `lck`, class membership ([Bounty Hunter] / [Cleric]), and party resources (gold ≥ X, food ≥ Y).

## Goals

- One pure resolver, one schema, one UI: dialogue and encounter checks share infrastructure. No drift between "the dialogue says I'd pass" and "the encounter rolls fail".
- Player can see all checks at the moment of decision, including the ones they fail, with the threshold and the best candidate's actual value visible.
- Existing dialogue stat checks (3-4 of them) migrate cleanly; thresholds re-tuned for per-unit semantics; no save-version bump beyond what landed in 0.6.0.
- Three encounter surfaces (travel / dungeon-event / post-victory) all source check definitions from JSON content files. Authoring content does not require code changes.
- ~5 authored stat-check-bearing encounters ship with the loop so the system has demonstrable content.

## Non-goals

- Roll-based / RNG checks. Hybrid was offered and rejected.
- A separate "skills" layer (Speech / Lockpick / Barter). FE-MB stays on the 6-stat FE model + `lck`. Speech-flavored checks use `skl` + dialogue context to read.
- Reroll mechanics, perks-as-checks (FO:NV `Black Widow`), or NV's "Skill Magazine" temp boosts. Future work.
- Refactoring the existing `partyStatTotal` API beyond removing its lone consumer. The function itself is harmless; dialogue runner stops calling it.

---

## Domain model

### `CheckRequirement` (discriminated union)

```typescript
// src/domain/check.ts
export type StatKey = 'str' | 'mag' | 'skl' | 'spd' | 'def' | 'res' | 'lck'

export type CheckRequirement =
  | { kind: 'stat'; stat: StatKey; threshold: number }
  | { kind: 'class'; classId: ClassId }
  | { kind: 'gold'; amount: number }
  | { kind: 'food'; amount: number }
```

### `CheckAttempt` (the runtime record)

```typescript
export interface CheckAttempt {
  requirement: CheckRequirement
  attemptingUnitId: UnitId | null   // null for class/gold/food checks (party-wide)
  passed: boolean
}
```

### `CheckCandidate` (what the picker shows)

```typescript
export interface CheckCandidate {
  unitId: UnitId
  unitName: string
  classId: ClassId
  statValue: number      // for stat checks; the unit's value of that stat
  meetsThreshold: boolean
}
```

### `lck` (luck) extension

Add `lck: number` to `UnitStats` (`src/domain/unit.ts:3-6`). Default to 0 for existing units. Three classes get growth rates: Lord (lck growth 30%), Cleric (40%), Bounty Hunter (50%); others 10-20%. Save format compatible — missing `lck` deserializes to 0.

---

## Resolver semantics

### `evaluateCheck`

```typescript
// src/systems/checkResolver.ts
export function evaluateCheck(
  req: CheckRequirement,
  attemptingUnit: Unit | null,
  partyState: { gold: number; foodCount: number; party: Unit[] },
): boolean
```

Rules:
- `stat`: `attemptingUnit !== null && attemptingUnit.stats[req.stat] >= req.threshold`
- `class`: `partyState.party.some(u => u.classId === req.classId && u.hp.current > 0)` — any living unit of that class enables the choice; no per-unit picker
- `gold`: `partyState.gold >= req.amount`
- `food`: `partyState.foodCount >= req.amount`

### `getCheckCandidates`

```typescript
export function getCheckCandidates(
  req: CheckRequirement,
  party: Unit[],
): CheckCandidate[]
```

Returns one entry per *living* party member for stat checks. Sorted by `statValue` descending so the strongest candidate is at the top of the picker. For non-stat checks, returns `[]` (no picker needed; check evaluates against party state).

### Pure function, single source of truth

Both the dialogue runner and the encounter outcome resolver call `evaluateCheck`. The picker UI calls `getCheckCandidates`. Tests cover all four kinds and edge cases (no living unit, threshold exactly equal, etc.).

---

## Authoring schema

### Dialogue (replaces existing `statCheck` branch)

```jsonc
// dialogue node "intimidate"
{
  "id": "intimidate",
  "speaker": "Player",
  "text": "Get out of my way.",
  "choices": [
    {
      "id": "force",
      "text": "Force them aside.",
      "check": { "kind": "stat", "stat": "str", "threshold": 7 },
      "onPass": "intimidate_success",
      "onFail": "intimidate_fail",
      "effects": []
    }
  ]
}
```

The `check` field is optional; choices without it behave normally. When present, the runner asks the picker (for stat checks) or evaluates directly (for non-stat); resolves via `onPass` / `onFail`. The legacy `next: { kind: 'statCheck', ... }` branch shape is **removed** in this migration.

### Travel encounter outcome

`src/data/content/encounters/*.json` gains a new outcome variant alongside `dialogue` and `battle`:

```jsonc
{
  "id": "stuck_caravan",
  "weight": 10,
  "outcome": {
    "kind": "checkEvent",
    "title": "A caravan blocks the road.",
    "description": "The driver is shouting at his oxen. The road is narrow.",
    "choices": [
      {
        "id": "help_push",
        "text": "Help push.",
        "check": { "kind": "stat", "stat": "str", "threshold": 6 },
        "onPass": { "narration": "You shoulder the wheel free.", "effects": [{"kind": "addGold", "amount": 25}] },
        "onFail": { "narration": "You strain but the wheel won't move.", "effects": [] }
      },
      {
        "id": "negotiate",
        "text": "Talk him into a detour.",
        "check": { "kind": "stat", "stat": "skl", "threshold": 7 },
        "onPass": { "narration": "He agrees, gladly.", "effects": [{"kind": "addGold", "amount": 15}] },
        "onFail": { "narration": "He waves you off.", "effects": [] }
      },
      {
        "id": "leave",
        "text": "Wait it out.",
        "onPass": { "narration": "Two hours later, the road clears.", "effects": [{"kind": "addFood", "amount": -1}] }
      }
    ]
  }
}
```

### Dungeon room event

`src/procgen/dungeonGenerator.ts` already produces `event` rooms (currently stubbed). Each dungeon JSON gains a `roomEvents` table from which the generator picks one per event-room:

```jsonc
// src/data/content/dungeons/smugglers_cave.json
{
  // ... existing fields ...
  "roomEvents": [
    {
      "id": "blocked_passage",
      "title": "A boulder blocks the passage.",
      "description": "Heavy. Old.",
      "choices": [
        { "id": "force", "text": "Force it aside.",
          "check": { "kind": "stat", "stat": "str", "threshold": 8 },
          "onPass": { "narration": "It rolls free, revealing a chest.", "effects": [{"kind":"addGold","amount":50}] },
          "onFail": { "narration": "Nothing budges. You take 4 damage from straining.", "effects": [{"kind":"healAll","amount":-4}] } },
        { "id": "leave", "text": "Move on.", "onPass": { "narration": "You move on.", "effects": [] } }
      ]
    }
  ]
}
```

### Post-victory reward gate

`battlefield.gd`'s phaser equivalent (`combatStore` victory handler) currently emits a Battle End Modal. Extend with an optional check-event step *before* the modal: certain enemy groups have a `victoryEvent` field referencing a JSON-defined check (one of: wrestle for stash, recruit a defeated thug, interrogate a survivor). If present, the BattleEndModal mounts a check-event panel first; player resolves; modal then proceeds.

```jsonc
// src/data/content/enemyGroups/bandits.json
{
  "id": "bandits",
  "victoryEvent": "interrogate_survivor"  // references content/checkEvents/interrogate_survivor.json
}
```

A new shared content directory `src/data/content/checkEvents/` holds the reusable bodies, schema'd identically to the inline travel-encounter shape.

---

## UX

### Visibility — NV default with full disclosure

For each check-bearing choice, the rendered button shows:
- Choice text on the left
- A small bracketed prefix: `[STR 7]` or `[Bounty Hunter]` or `[100g]`
- For stat checks: best-in-party value next to the threshold: `[STR 7] (Marcus 8)` if passing, `[STR 7] (Marcus 5)` if failing
- For class/resource: just the requirement, e.g. `[100g]` or `[Cleric]`

Color rules:
- Green prefix: at least one party member meets the threshold (passable)
- Red prefix + `disabled` button: nobody meets it (visible but unattemptable)
- Plain (no prefix): no check on this choice

Failed checks are always visible (per user decision). The player sees what they're missing and can plan around it.

### Picker — only for stat checks

When the player clicks a stat-check choice (`[STR 7]`), a small modal appears:

```
┌─────────────────────────────────────┐
│  Who tries this?                    │
│                                     │
│  ⬢ MARCUS  STR  8  ✓                │
│  ⬡ ROY     STR  5  ✗                │
│  ⬡ LILINA  STR  1  ✗                │
│  ⬡ KNIGHT  STR  7  ✓                │
│                                     │
│  [ Cancel ]                         │
└─────────────────────────────────────┘
```

- Living party members listed with their value of the requested stat, sorted descending.
- Each row clickable: choosing one fires the check with that unit, advances to `onPass` or `onFail`.
- Failed candidates (✗) selectable too — player can choose to deliberately fail (e.g. for narrative effect or because everyone fails). Result is the `onFail` branch.
- "Cancel" button returns to the previous choice list without consuming the encounter.

### Class / resource checks — single click

`[Bounty Hunter]` and `[100g]` are auto-resolved on click — no picker. Either the party qualifies or the option is grayed out.

### Encounter event panel

Travel encounters and dungeon rooms render a shared `<CheckEventPanel>` component:
- Title at top in serif amber font
- Description in italic stone-300 below
- Choice list at bottom, same NV-style buttons
- Outcome narration replaces description after a choice resolves; a single "Continue" button dismisses

Post-victory uses the same panel mounted inside the `BattleEndModal` flow.

---

## Implementation surfaces

### Files (new)

```
src/
├── domain/
│   └── check.ts                          # CheckRequirement, CheckAttempt, CheckCandidate
├── data/
│   ├── schemas/
│   │   ├── check.ts                      # Zod schemas for CheckRequirement + Choice (post-migration)
│   │   └── checkEvent.ts                 # Travel/dungeon/victory event shape
│   └── content/
│       └── checkEvents/                  # 5+ authored events
│           ├── interrogate_survivor.json
│           ├── wrestle_for_stash.json
│           └── ... (3 more)
├── systems/
│   └── checkResolver.ts                  # evaluateCheck + getCheckCandidates
└── ui/
    ├── components/
    │   ├── CheckButton.tsx               # Single check-prefixed choice button
    │   └── CheckCandidatePicker.tsx      # The "who tries this?" modal
    └── modals/
        └── CheckEventModal.tsx           # The event panel (title/desc/choices/outcome)
```

### Files (modified)

```
src/
├── domain/
│   ├── dialogue.ts                       # Choice gains optional `check`; remove DialogueBranch
│   ├── unit.ts                           # UnitStats gains lck
│   └── quest.ts                          # QuestEffect alignment if needed
├── data/
│   ├── schemas/
│   │   ├── dialogue.ts                   # mirror Choice change
│   │   └── unit.ts                       # lck field
│   └── content/
│       ├── dialogue/                     # 3-4 files re-authored for per-unit checks
│       │   ├── bandit_threat.json
│       │   ├── sq_blood_ties_*.json
│       │   └── road_merchant.json (likely)
│       ├── encounters/                   # add 2 checkEvent outcomes
│       └── classes.json                  # lck growth rates
├── systems/
│   ├── dialogueRunner.ts                 # remove statCheck branch; use new Choice.check + checkResolver
│   └── encounterRoller.ts                # support checkEvent outcome
├── ui/
│   ├── modals/
│   │   ├── DialogueModal.tsx             # render CheckButton / picker for choices with `check`
│   │   └── BattleEndModal.tsx            # mount CheckEventModal pre-modal if victoryEvent set
│   └── screens/
│       ├── OverworldScene.tsx            # mount CheckEventModal for travel checkEvent outcomes
│       └── DungeonScene.tsx              # mount CheckEventModal for event rooms
```

---

## Migration

### Existing data

| File | Current | New |
|---|---|---|
| `bandit_threat.json` (intimidate) | `next: { kind: 'statCheck', stat: 'str', threshold: 12, successNext: ..., failNext: ... }` | Choice has `check: { kind: 'stat', stat: 'str', threshold: 7 }`, `onPass: 'intimidate_success'`, `onFail: 'intimidate_fail'`. Threshold drops 12 → 7. |
| `sq_blood_ties_accept.json` | (unknown — read during plan execution) | Adjust as needed; likely no stat checks but verify |
| `sq_blood_ties_daren_captured.json` | (unknown) | Same |
| Any `statCheck` reference in test fixtures | Test branches | Update to new schema |

The Zod schema for `Choice` becomes:
```typescript
{
  id: string,
  text: string,
  effects: Effect[],
  next?: DialogueNodeId | 'end',          // existing — for unconditional advances
  check?: CheckRequirement,                // NEW — optional
  onPass?: DialogueNodeId | 'end',         // NEW — required if `check` set
  onFail?: DialogueNodeId | 'end',         // NEW — required if `check` set
}
```

Schema validation requires: if `check` is present, both `onPass` and `onFail` must be set, and `next` must be absent. Mutual exclusion enforced via Zod `.refine`.

### Save format

`SAVE_VERSION` stays `0.6.0-cards-only`. The new `lck` field on units defaults to 0 for old saves; the new schema fields are dialogue-content-only and don't enter the save snapshot.

---

## Tests

### Unit tests (~25 new)

- `tests/unit/domain/check.test.ts` — schema parses each `CheckRequirement` kind; rejects malformed
- `tests/unit/systems/checkResolver.test.ts` — evaluateCheck for all 4 kinds + edge cases (no living unit, threshold exactly equal, dead unit excluded, etc.); getCheckCandidates returns sorted+filtered list
- `tests/unit/systems/dialogueRunner.test.ts` — updated: choice with `check` and a passing unit follows `onPass`; failing follows `onFail`; missing `check` follows `next` as today
- `tests/unit/systems/encounterRoller.test.ts` — checkEvent outcomes parse and resolve
- `tests/unit/ui/modals/CheckEventModal.test.tsx` — render title/desc/choices, button click fires onPass/onFail, picker mounts for stat checks
- `tests/unit/ui/components/CheckButton.test.tsx` — green prefix when passable, red when not, disabled when not passable, plain when no check
- `tests/unit/data/dialogues.test.ts` — all migrated dialogues parse against new schema

### E2E (~3 new)

- `tests/e2e/check-dialogue.spec.ts` — start a run, drive into bandit_threat, confirm `[STR 7]` shows, click it, picker appears, choose Marcus, intimidate_success branch fires
- `tests/e2e/check-travel-event.spec.ts` — force a checkEvent outcome via debug hook, render the panel, choose, see narration
- `tests/e2e/check-victory.spec.ts` — win a battle whose enemy group has `victoryEvent`, verify the event modal appears before the BattleEndModal

---

## Authored content (ships with loop completion)

Five check-bearing pieces of content land:

1. **`stuck_caravan.json` (travel encounter)** — STR-or-SKL choice with gold reward
2. **`bandit_lookout.json` (travel encounter)** — SKL-or-SPD stealth/intimidate; failure spawns small battle
3. **`blocked_passage.json` (smugglers_cave room event)** — STR check; failure damages party
4. **`ancient_inscription.json` (ancient_ruins room event)** — MAG/Cleric check; success reveals treasure
5. **`interrogate_survivor.json` (post-victory)** — SKL/STR check; success grants intel flag (sets `bandit_camp_known` flag for later content)

All five files validated against the schema in CI; each appears at least once in a 5-minute playtest run.

---

## Risks

1. **Per-unit semantics make some old encounters trivially passable.** Bandit Threat's STR 12 (party-sum) was hard; STR 7 best-in-party may be too easy if Marcus exists in starting roster (he has STR 7 base). Mitigation: tune thresholds per-encounter during content authoring; thresholds 7-9 should challenge mid-run parties.
2. **Picker UI adds clicks.** Every stat check now requires: click choice → see picker → click unit. Mitigation: skip picker entirely if only one living unit could meet (auto-attempts with that unit); cache last-chosen unit per stat as default selection. Out of scope for v1; revisit if playtesting flags it.
3. **Class checks may incentivize keeping dying units alive for content gating.** If [Cleric] is a check requirement and your only Cleric is at 1 HP, players might rest excessively. Mitigation: balance class checks across multiple stats so single-class lockouts are rare.
4. **lck field migration silently zeroes out for old saves.** Acceptable — lck only matters for new content.

## Out of scope (deferred)

- Skill magazine / temp stat boosts
- Reroll mechanics
- Perks-as-checks
- Dungeon-wide check chains (e.g. multi-step trap rooms)
- Non-binary check outcomes (NV's "barely passed" / "critically passed" tiers)
- Localization (strings stay inline English; i18n waits)

## Sources / prior art

- Fallout: New Vegas dialogue check display ([Skill X] white/red prefix)
- Disco Elysium White Check semantics (deterministic, threshold visible)
- Slay the Spire encounter cards (event panel layout, ?-marker overworld nodes)
- BG3 (rejected — roll-based, doesn't fit deterministic-card combat)
- Internal: `src/systems/dialogueRunner.ts:42-46` (existing partyStatTotal-based check)

## Implementation phases

The plan breaks into 10 sequential tasks (each a self-contained commit ending green gates):

1. **SC-1** — `domain/check.ts` + Zod schema; tests
2. **SC-2** — Add `lck` to UnitStats + classes.json + tests
3. **SC-3** — `checkResolver.ts` (evaluateCheck + getCheckCandidates) + tests
4. **SC-4** — Migrate `Choice` schema (+ update DialogueRunner to use Choice.check); rewrite affected dialogues; remove DialogueBranch
5. **SC-5** — `<CheckButton>` component + tests
6. **SC-6** — `<CheckCandidatePicker>` component + tests
7. **SC-7** — `<CheckEventModal>` shell + tests; wire DialogueModal to use CheckButton + picker
8. **SC-8** — Travel encounter `checkEvent` outcome support; OverworldScene mounts CheckEventModal; 2 authored encounters
9. **SC-9** — Dungeon room event support; DungeonScene mounts CheckEventModal; 2 authored room events
10. **SC-10** — Post-victory event support; BattleEndModal mounts CheckEventModal; 1 authored victory event; visual playthrough; tag `phaser-stat-checks`; emit `<promise>STAT-CHECK-COMPLETE</promise>`

Each phase ends with all six gates green (typecheck, unit, e2e, check-context-doc, build, perf-gates).
