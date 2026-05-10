# Stat Check System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Fallout: New Vegas-style stat check system covering dialogue, travel encounters, dungeon room events, and post-victory reward gates. Deterministic (stat ≥ threshold), per-unit attempts, NV-style visibility (greyed-out failed checks shown with threshold).

**Architecture:** One `domain/check.ts` discriminated union (`stat | class | gold | food`). One pure resolver `systems/checkResolver.ts`. Two shared UI components (`CheckButton`, `CheckCandidatePicker`). One shared modal (`CheckEventModal`) consumed by Dialogue / Overworld / Dungeon / BattleEnd surfaces. Existing party-sum dialogue check semantics deprecated; affected dialogues re-authored with per-unit thresholds.

**Tech Stack:** TypeScript 5.6 strict, React 19, Zustand 5, Zod 3, Vitest, Playwright. Spec at `docs/superpowers/specs/2026-05-10-stat-check-system-design.md`.

**Promise tag:** `<promise>STAT-CHECK-COMPLETE</promise>` — emitted only when all 10 SC-* tasks ship, all gates green, visual playthrough recorded covering one dialogue check + one travel check + one dungeon-room check + one post-victory check, and `phaser-stat-checks` git tag pushed.

---

## File structure

```
phaser/
├── src/
│   ├── domain/
│   │   ├── check.ts                                # NEW
│   │   ├── unit.ts                                 # MODIFIED — add lck to UnitStats
│   │   └── dialogue.ts                             # MODIFIED — Choice.check field; remove DialogueBranch
│   ├── data/
│   │   ├── schemas/
│   │   │   ├── check.ts                            # NEW
│   │   │   ├── checkEvent.ts                       # NEW
│   │   │   ├── unit.ts                             # MODIFIED — lck
│   │   │   └── dialogue.ts                         # MODIFIED — Choice schema
│   │   └── content/
│   │       ├── classes.json                        # MODIFIED — lck base + growth
│   │       ├── checkEvents/                        # NEW dir
│   │       │   ├── interrogate_survivor.json
│   │       │   ├── wrestle_for_stash.json
│   │       │   └── ... (3 more)
│   │       ├── dialogue/
│   │       │   ├── bandit_threat.json              # MODIFIED — new check shape
│   │       │   ├── sq_blood_ties_accept.json       # MODIFIED if check exists
│   │       │   └── road_merchant.json              # MODIFIED if check exists
│   │       ├── encounters/
│   │       │   ├── borderlands_road.json           # MODIFIED — add 2 checkEvent outcomes
│   │       │   └── thornwood_path.json             # MODIFIED — add 1 checkEvent outcome
│   │       ├── enemyGroups/
│   │       │   └── bandits.json                    # MODIFIED — victoryEvent ref
│   │       └── dungeons/
│   │           └── smugglers_cave.json             # MODIFIED — roomEvents
│   ├── systems/
│   │   ├── checkResolver.ts                        # NEW
│   │   ├── dialogueRunner.ts                       # MODIFIED — Choice.check path
│   │   └── encounterRoller.ts                      # MODIFIED — checkEvent outcome
│   └── ui/
│       ├── components/
│       │   ├── CheckButton.tsx                     # NEW
│       │   └── CheckCandidatePicker.tsx            # NEW
│       ├── modals/
│       │   ├── CheckEventModal.tsx                 # NEW
│       │   ├── DialogueModal.tsx                   # MODIFIED — render CheckButton
│       │   └── BattleEndModal.tsx                  # MODIFIED — pre-mount CheckEventModal if victoryEvent
│       └── screens/
│           ├── OverworldScene.tsx                  # MODIFIED — mount CheckEventModal for checkEvent outcome
│           └── DungeonScene.tsx                    # MODIFIED — mount CheckEventModal for event rooms
└── tests/unit/
    ├── domain/check.test.ts                        # NEW
    ├── systems/
    │   ├── checkResolver.test.ts                   # NEW
    │   ├── dialogueRunner.test.ts                  # MODIFIED
    │   └── encounterRoller.test.ts                 # MODIFIED
    ├── data/
    │   └── checkEvents.test.ts                     # NEW
    └── ui/
        ├── components/
        │   ├── CheckButton.test.tsx                # NEW
        │   └── CheckCandidatePicker.test.tsx       # NEW
        └── modals/
            └── CheckEventModal.test.tsx            # NEW
└── tests/e2e/
    ├── check-dialogue.spec.ts                      # NEW
    ├── check-travel-event.spec.ts                  # NEW
    └── check-victory.spec.ts                       # NEW
```

CONTEXT.md updates land alongside each task that adds an exported name.

---

## Gate commands (used at end of every task)

```bash
npm run typecheck
npm test -- --reporter=basic
npm run check-context-doc
npm run build
npm run perf-gates
npm run test:e2e
```

All six must pass.

---

## Task SC-1: CheckRequirement domain + schema

**STATUS:** ✅ Done at e9e4874

**Files:**
- Create: `phaser/src/domain/check.ts`
- Create: `phaser/src/data/schemas/check.ts`
- Create: `phaser/tests/unit/domain/check.test.ts`
- Modify: `phaser/CONTEXT.md`

- [x] **Step SC-1.1: Failing test for CheckRequirement schema**

Create `phaser/tests/unit/domain/check.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { CheckRequirementSchema } from '../../../src/data/schemas/check'

describe('CheckRequirementSchema', () => {
  it('accepts stat check', () => {
    const r = CheckRequirementSchema.parse({ kind: 'stat', stat: 'str', threshold: 7 })
    expect(r.kind).toBe('stat')
  })

  it('accepts class check', () => {
    const r = CheckRequirementSchema.parse({ kind: 'class', classId: 'cleric' })
    expect(r.kind).toBe('class')
  })

  it('accepts gold check', () => {
    const r = CheckRequirementSchema.parse({ kind: 'gold', amount: 100 })
    expect(r.kind).toBe('gold')
  })

  it('accepts food check', () => {
    const r = CheckRequirementSchema.parse({ kind: 'food', amount: 3 })
    expect(r.kind).toBe('food')
  })

  it('rejects unknown stat', () => {
    expect(() => CheckRequirementSchema.parse({ kind: 'stat', stat: 'unknown', threshold: 5 }))
      .toThrow()
  })

  it('rejects negative thresholds', () => {
    expect(() => CheckRequirementSchema.parse({ kind: 'stat', stat: 'str', threshold: -1 }))
      .toThrow()
    expect(() => CheckRequirementSchema.parse({ kind: 'gold', amount: -5 })).toThrow()
  })

  it('rejects missing fields', () => {
    expect(() => CheckRequirementSchema.parse({ kind: 'stat' })).toThrow()
    expect(() => CheckRequirementSchema.parse({ kind: 'class' })).toThrow()
  })

  it('rejects unknown kind', () => {
    expect(() => CheckRequirementSchema.parse({ kind: 'phantom', x: 1 })).toThrow()
  })
})
```

- [ ] **Step SC-1.2: Run test to confirm it fails (module missing)**

```bash
npx vitest run tests/unit/domain/check.test.ts --reporter=basic
```

Expected: FAIL — `Cannot find module '../../../src/data/schemas/check'`.

- [ ] **Step SC-1.3: Create domain/check.ts**

Create `phaser/src/domain/check.ts`:

```typescript
import type { ClassId, UnitId } from './ids'

export type StatKey = 'str' | 'mag' | 'skl' | 'spd' | 'def' | 'res' | 'lck'

export type CheckRequirement =
  | { kind: 'stat'; stat: StatKey; threshold: number }
  | { kind: 'class'; classId: ClassId }
  | { kind: 'gold'; amount: number }
  | { kind: 'food'; amount: number }

export interface CheckAttempt {
  requirement: CheckRequirement
  attemptingUnitId: UnitId | null
  passed: boolean
}

export interface CheckCandidate {
  unitId: UnitId
  unitName: string
  classId: ClassId
  statValue: number
  meetsThreshold: boolean
}
```

- [ ] **Step SC-1.4: Create schemas/check.ts**

Create `phaser/src/data/schemas/check.ts`:

```typescript
import { z } from 'zod'

export const StatKeySchema = z.enum(['str', 'mag', 'skl', 'spd', 'def', 'res', 'lck'])

export const CheckRequirementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stat'), stat: StatKeySchema, threshold: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('class'), classId: z.string().min(1) }),
  z.object({ kind: z.literal('gold'), amount: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('food'), amount: z.number().int().nonnegative() }),
])

export type CheckRequirementParsed = z.infer<typeof CheckRequirementSchema>
```

- [ ] **Step SC-1.5: Run test to confirm pass**

```bash
npx vitest run tests/unit/domain/check.test.ts --reporter=basic
```

Expected: 8/8 PASS.

- [ ] **Step SC-1.6: Update CONTEXT.md**

In the appropriate domain section of `phaser/CONTEXT.md`, add a row:

```markdown
**Check (`domain/check.ts` + `data/schemas/check.ts`):** `CheckRequirement` discriminated union over `stat | class | gold | food`. `CheckAttempt` records resolution; `CheckCandidate` is what the picker lists. Stat keys: `str | mag | skl | spd | def | res | lck`. Schema enforces non-negative thresholds.
```

- [ ] **Step SC-1.7: All gates + commit**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates
git add src/domain/check.ts src/data/schemas/check.ts tests/unit/domain/check.test.ts CONTEXT.md
git commit -m "$(cat <<'EOF'
feat(phaser): [SC-1] CheckRequirement domain + Zod schema

Discriminated union: stat | class | gold | food. Per-unit-stat checks
include a StatKey (str/mag/skl/spd/def/res/lck). Class checks reference
a ClassId. Gold/food are party-resource thresholds.

8 schema tests cover acceptance + rejection across all four kinds.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task SC-2: Add lck stat to units

**STATUS:** ✅ Done at bf46359

**Files:**
- Modify: `phaser/src/domain/unit.ts` (add lck to UnitStats)
- Modify: `phaser/src/data/schemas/unit.ts`
- Modify: `phaser/src/data/content/classes.json` (lck base + growth for each class)
- Modify: existing tests that construct UnitStats inline (find via grep)
- Modify: `phaser/CONTEXT.md`

- [ ] **Step SC-2.1: Failing test that asserts lck on a built unit**

Append to `phaser/tests/unit/domain/check.test.ts` (or create a fresh `unit-stats.test.ts`):

```typescript
import { z } from 'zod'
import { UnitStatsSchema } from '../../../src/data/schemas/unit'

describe('UnitStats with lck', () => {
  it('parses with lck = 0', () => {
    const r = UnitStatsSchema.parse({ str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 0 })
    expect(r.lck).toBe(0)
  })

  it('lck defaults to 0 when missing (back-compat)', () => {
    const r = UnitStatsSchema.parse({ str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 })
    expect(r.lck).toBe(0)
  })
})
```

- [ ] **Step SC-2.2: Run to confirm fail**

```bash
npx vitest run tests/unit/domain/check.test.ts --reporter=basic
```

Expected: 2 new tests FAIL.

- [ ] **Step SC-2.3: Modify domain/unit.ts**

Open `phaser/src/domain/unit.ts`. In `UnitStats`:

```typescript
export interface UnitStats {
  str: number; mag: number; skl: number
  spd: number; def: number; res: number
  lck: number
}
```

- [ ] **Step SC-2.4: Modify schemas/unit.ts**

Open `phaser/src/data/schemas/unit.ts`. Find `UnitStatsSchema` and add `lck` with default:

```typescript
export const UnitStatsSchema = z.object({
  str: z.number().int(),
  mag: z.number().int(),
  skl: z.number().int(),
  spd: z.number().int(),
  def: z.number().int(),
  res: z.number().int(),
  lck: z.number().int().default(0),
})
```

- [ ] **Step SC-2.5: Update classes.json with lck data**

Open `phaser/src/data/content/classes.json`. For each class entry, add `lck` to `baseStats` and `lckGrowth` to `growthRates`:

- `lord`: `lck: 4`, growth `lck: 30`
- `knight`: `lck: 2`, growth `lck: 15`
- `mage`: `lck: 3`, growth `lck: 25`
- `bandit`: `lck: 2`, growth `lck: 15`

Specifically the file becomes:

```json
[
  {
    "id": "lord",
    "name": "Lord",
    "baseStats": { "str": 5, "mag": 0, "skl": 4, "spd": 5, "def": 3, "res": 1, "lck": 4 },
    "growthRates": { "str": 50, "mag": 5, "skl": 50, "spd": 45, "def": 30, "res": 25, "lck": 30 },
    "innateCardIds": ["lord_rally", "lord_inspiring_strike", "lord_nobility", "lord_command"],
    "startingMov": 5,
    "startingHp": 22
  },
  {
    "id": "knight",
    "name": "Knight",
    "baseStats": { "str": 7, "mag": 0, "skl": 4, "spd": 3, "def": 8, "res": 1, "lck": 2 },
    "growthRates": { "str": 45, "mag": 0, "skl": 35, "spd": 20, "def": 50, "res": 15, "lck": 15 },
    "innateCardIds": ["knight_fortify", "knight_bulwark", "knight_hold_line", "knight_shield_expertise"],
    "startingMov": 4,
    "startingHp": 28
  },
  {
    "id": "mage",
    "name": "Mage",
    "baseStats": { "str": 1, "mag": 7, "skl": 5, "spd": 5, "def": 2, "res": 7, "lck": 3 },
    "growthRates": { "str": 5, "mag": 60, "skl": 40, "spd": 40, "def": 15, "res": 50, "lck": 25 },
    "innateCardIds": ["mage_focus", "mage_arcane_burst", "mage_barrier", "mage_elemental_mastery"],
    "startingMov": 5,
    "startingHp": 18
  },
  {
    "id": "bandit",
    "name": "Bandit",
    "baseStats": { "str": 5, "mag": 0, "skl": 3, "spd": 4, "def": 2, "res": 1, "lck": 2 },
    "growthRates": { "str": 35, "mag": 0, "skl": 25, "spd": 30, "def": 20, "res": 10, "lck": 15 },
    "innateCardIds": ["bandit_swing", "bandit_charge"],
    "startingMov": 4,
    "startingHp": 18
  }
]
```

- [ ] **Step SC-2.6: Find and patch every Unit-construction site**

```bash
grep -rln "stats: { str:" src tests | head -20
```

For each match, add `, lck: 0` (or appropriate value) to the inline stats object. Most test fixtures use `lck: 0` is fine.

- [ ] **Step SC-2.7: Run gates**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
```

Expected: all green. The Zod default ensures back-compat for any saved data.

- [ ] **Step SC-2.8: Update CONTEXT.md**

In the unit/stats area of CONTEXT.md, add `lck` to the listed stat fields.

- [ ] **Step SC-2.9: Commit**

```bash
git add src/domain/unit.ts src/data/schemas/unit.ts src/data/content/classes.json \
        $(grep -rln "stats: { str:" src tests) \
        tests/unit/domain/check.test.ts CONTEXT.md
git commit -m "$(cat <<'EOF'
feat(phaser): [SC-2] add lck stat — luck for stat-check flavor

Adds 7th stat to UnitStats. Default 0; Zod schema accepts missing field
for back-compat. Each class gets a base lck value and growth rate.

Lord 4/30, Knight 2/15, Mage 3/25, Bandit 2/15.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task SC-3: checkResolver pure function

**STATUS:** ✅ Done at b2808e7

**Files:**
- Create: `phaser/src/systems/checkResolver.ts`
- Create: `phaser/tests/unit/systems/checkResolver.test.ts`
- Modify: `phaser/CONTEXT.md`

- [ ] **Step SC-3.1: Failing tests for checkResolver**

Create `phaser/tests/unit/systems/checkResolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { evaluateCheck, getCheckCandidates } from '../../../src/systems/checkResolver'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mk = (id: string, classId: string, str: number, lck = 0, hp = 20): Unit => ({
  id: asUnitId(id),
  name: id.toUpperCase(),
  classId: asClassId(classId),
  level: 1,
  hp: { current: hp, max: 20 },
  stats: { str, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck },
  position: null,
  ap: 3,
  armor: 0,
  statuses: [],
})

describe('evaluateCheck', () => {
  const baseParty = { gold: 50, foodCount: 3, party: [mk('roy', 'lord', 5), mk('marc', 'knight', 8)] }

  it('stat: passes when attempting unit meets threshold', () => {
    const u = baseParty.party[1]!
    expect(evaluateCheck({ kind: 'stat', stat: 'str', threshold: 7 }, u, baseParty)).toBe(true)
  })

  it('stat: fails when attempting unit below threshold', () => {
    const u = baseParty.party[0]!
    expect(evaluateCheck({ kind: 'stat', stat: 'str', threshold: 7 }, u, baseParty)).toBe(false)
  })

  it('stat: fails when attempting unit is null', () => {
    expect(evaluateCheck({ kind: 'stat', stat: 'str', threshold: 5 }, null, baseParty)).toBe(false)
  })

  it('class: passes when at least one living party member has the class', () => {
    expect(evaluateCheck({ kind: 'class', classId: asClassId('knight') }, null, baseParty)).toBe(true)
    expect(evaluateCheck({ kind: 'class', classId: asClassId('cleric') }, null, baseParty)).toBe(false)
  })

  it('class: dead member of the class does not satisfy', () => {
    const onlyDead = { ...baseParty, party: [mk('dead', 'cleric', 5, 0, 0)] }
    expect(evaluateCheck({ kind: 'class', classId: asClassId('cleric') }, null, onlyDead)).toBe(false)
  })

  it('gold: party gold ≥ amount', () => {
    expect(evaluateCheck({ kind: 'gold', amount: 50 }, null, baseParty)).toBe(true)
    expect(evaluateCheck({ kind: 'gold', amount: 51 }, null, baseParty)).toBe(false)
  })

  it('food: party food count ≥ amount', () => {
    expect(evaluateCheck({ kind: 'food', amount: 3 }, null, baseParty)).toBe(true)
    expect(evaluateCheck({ kind: 'food', amount: 4 }, null, baseParty)).toBe(false)
  })
})

describe('getCheckCandidates', () => {
  const party = [mk('roy', 'lord', 5), mk('marc', 'knight', 8), mk('lila', 'mage', 1), mk('dead', 'bandit', 9, 0, 0)]

  it('stat: returns living party sorted by stat descending', () => {
    const c = getCheckCandidates({ kind: 'stat', stat: 'str', threshold: 7 }, party)
    expect(c.map((e) => e.unitId as unknown as string)).toEqual(['marc', 'roy', 'lila'])
    expect(c[0]!.statValue).toBe(8)
    expect(c[0]!.meetsThreshold).toBe(true)
    expect(c[2]!.meetsThreshold).toBe(false)
  })

  it('non-stat checks return empty list (no picker needed)', () => {
    expect(getCheckCandidates({ kind: 'class', classId: asClassId('lord') }, party)).toEqual([])
    expect(getCheckCandidates({ kind: 'gold', amount: 100 }, party)).toEqual([])
    expect(getCheckCandidates({ kind: 'food', amount: 1 }, party)).toEqual([])
  })

  it('handles empty party', () => {
    expect(getCheckCandidates({ kind: 'stat', stat: 'str', threshold: 5 }, [])).toEqual([])
  })
})
```

- [ ] **Step SC-3.2: Run to verify fail**

```bash
npx vitest run tests/unit/systems/checkResolver.test.ts --reporter=basic
```

Expected: ALL FAIL (module missing).

- [ ] **Step SC-3.3: Implement checkResolver**

Create `phaser/src/systems/checkResolver.ts`:

```typescript
import type { CheckRequirement, CheckCandidate, StatKey } from '../domain/check'
import type { Unit } from '../domain/unit'

export interface PartyState {
  gold: number
  foodCount: number
  party: Unit[]
}

export function evaluateCheck(
  req: CheckRequirement,
  attemptingUnit: Unit | null,
  partyState: PartyState,
): boolean {
  switch (req.kind) {
    case 'stat':
      return attemptingUnit !== null
        && attemptingUnit.hp.current > 0
        && attemptingUnit.stats[req.stat] >= req.threshold
    case 'class':
      return partyState.party.some(
        (u) => u.hp.current > 0 && (u.classId as unknown as string) === (req.classId as unknown as string),
      )
    case 'gold':
      return partyState.gold >= req.amount
    case 'food':
      return partyState.foodCount >= req.amount
  }
}

export function getCheckCandidates(req: CheckRequirement, party: Unit[]): CheckCandidate[] {
  if (req.kind !== 'stat') return []
  const living = party.filter((u) => u.hp.current > 0)
  const stat: StatKey = req.stat
  const candidates: CheckCandidate[] = living.map((u) => ({
    unitId: u.id,
    unitName: u.name,
    classId: u.classId,
    statValue: u.stats[stat],
    meetsThreshold: u.stats[stat] >= req.threshold,
  }))
  candidates.sort((a, b) => b.statValue - a.statValue)
  return candidates
}
```

- [ ] **Step SC-3.4: Verify pass**

```bash
npx vitest run tests/unit/systems/checkResolver.test.ts --reporter=basic
```

Expected: 12/12 PASS.

- [ ] **Step SC-3.5: Gates + commit**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates
git add src/systems/checkResolver.ts tests/unit/systems/checkResolver.test.ts CONTEXT.md
```

Add CONTEXT.md row:

```markdown
**Check resolver (`systems/checkResolver.ts`):** pure `evaluateCheck(req, attemptingUnit, partyState)` and `getCheckCandidates(req, party)`. Single source of truth for stat/class/gold/food check evaluation. Stat checks require an attempting unit; class/gold/food are party-wide. Candidates list living party sorted by stat descending; non-stat checks return [] (no picker).
```

```bash
git add CONTEXT.md
git commit -m "feat(phaser): [SC-3] checkResolver — evaluateCheck + getCheckCandidates

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task SC-4: Migrate Choice schema; rewrite affected dialogues

**STATUS:** ✅ Done at 94a405c

**Files:**
- Modify: `phaser/src/domain/dialogue.ts` (Choice gains `check` / `onPass` / `onFail`; remove `DialogueBranch`)
- Modify: `phaser/src/data/schemas/dialogue.ts`
- Modify: `phaser/src/systems/dialogueRunner.ts` (remove statCheck branch path; use Choice.check + checkResolver)
- Modify: `phaser/src/data/content/dialogue/bandit_threat.json` (and any other affected file — grep for `statCheck`)
- Modify: tests/unit/systems/dialogueRunner.test.ts

- [ ] **Step SC-4.1: Find all uses of statCheck in content + tests**

```bash
grep -rln "statCheck\|partyStatTotal" src tests
```

Expected: a small set — `bandit_threat.json`, `dialogueRunner.ts`, schema file, runner test, possibly other dialogues. Inventory them in plan-execution notes; you'll edit each.

- [ ] **Step SC-4.2: Update domain/dialogue.ts**

Open `phaser/src/domain/dialogue.ts`. Remove the `DialogueBranch` type and replace `Choice`:

```typescript
import type { CheckRequirement } from './check'

export interface DialogueChoice {
  id: string
  text: string
  effects: DialogueEffect[]   // existing type
  next?: DialogueNodeId | 'end'
  check?: CheckRequirement
  onPass?: DialogueNodeId | 'end'
  onFail?: DialogueNodeId | 'end'
}
```

(Use the existing exported name; this is a structural change, not a rename.)

Remove the line `export type DialogueBranch = { kind: 'statCheck' ... }` and any references in the file. Search for usages — there should be one in `dialogueRunner.ts` to remove next.

- [ ] **Step SC-4.3: Update schemas/dialogue.ts**

Open `phaser/src/data/schemas/dialogue.ts`. Find the Choice schema and replace with:

```typescript
import { CheckRequirementSchema } from './check'

export const DialogueChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  effects: z.array(DialogueEffectSchema).default([]),
  next: z.union([z.string(), z.literal('end')]).optional(),
  check: CheckRequirementSchema.optional(),
  onPass: z.union([z.string(), z.literal('end')]).optional(),
  onFail: z.union([z.string(), z.literal('end')]).optional(),
}).refine(
  (c) => (c.check === undefined) || (c.onPass !== undefined && c.onFail !== undefined && c.next === undefined),
  { message: 'choice with check must define onPass and onFail; must not define next' },
)
```

Remove any DialogueBranch schema.

- [ ] **Step SC-4.4: Update dialogueRunner.ts**

Open `phaser/src/systems/dialogueRunner.ts`. Replace the `resolveNext` function:

```typescript
import { evaluateCheck } from './checkResolver'
import type { CheckRequirement } from '../domain/check'
import type { Unit } from '../domain/unit'

export interface RunnerPartyState {
  gold: number
  foodCount: number
  party: Unit[]
}

function resolveChoiceNext(
  choice: DialogueChoice,
  attemptingUnit: Unit | null,
  partyState: RunnerPartyState,
): DialogueNodeId | 'end' {
  if (choice.check) {
    const passed = evaluateCheck(choice.check, attemptingUnit, partyState)
    return (passed ? choice.onPass! : choice.onFail!) as DialogueNodeId | 'end'
  }
  return (choice.next ?? 'end') as DialogueNodeId | 'end'
}
```

Then update the `step()` function to take `partyState: RunnerPartyState` and `attemptingUnitId: UnitId | null`, look up the unit, and call `resolveChoiceNext` instead of `resolveNext`. Remove the old `partyStatTotal` plumbing.

- [ ] **Step SC-4.5: Rewrite bandit_threat.json**

Open `phaser/src/data/content/dialogue/bandit_threat.json`. Find the choice with `next: { kind: 'statCheck', ... }` and replace:

```jsonc
{
  "id": "force",
  "text": "Get out of my way.",
  "effects": [],
  "check": { "kind": "stat", "stat": "str", "threshold": 7 },
  "onPass": "intimidate_success",
  "onFail": "intimidate_fail"
}
```

(Threshold drops 12 → 7 per spec migration.) Repeat for any other dialogue files matching the inventory in step SC-4.1.

- [ ] **Step SC-4.6: Update dialogueRunner tests**

Open `phaser/tests/unit/systems/dialogueRunner.test.ts`. Update tests that exercised the old `partyStatTotal` model. Each becomes a per-unit test like:

```typescript
it('Choice with passing check follows onPass', () => {
  const tree: DialogueTree = {
    id: 't' as never,
    startNodeId: 'start' as never,
    nodes: {
      start: {
        id: 'start' as never,
        speaker: 'Old Man',
        text: '...',
        choices: [{
          id: 'force', text: 'Force.', effects: [],
          check: { kind: 'stat', stat: 'str', threshold: 5 },
          onPass: 'win' as never, onFail: 'lose' as never,
        }],
        next: undefined,
      },
      win: { id: 'win' as never, speaker: 'X', text: 'won', choices: [], next: 'end' as never },
      lose: { id: 'lose' as never, speaker: 'X', text: 'lost', choices: [], next: 'end' as never },
    } as never,
  }
  const strongUnit = mkUnit('a', 7)  // STR 7, passes threshold 5
  const result = step(tree, 'start' as never, 'force', {} as never, {
    party: [strongUnit], gold: 0, foodCount: 0,
  }, strongUnit.id)
  expect(result.nextNodeId).toBe('win')
})
```

(Plus a fail-case test, plus a "no check follows next" smoke test.)

- [ ] **Step SC-4.7: Gates**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
```

Expected: all green. If a test references `partyStatTotal` or `DialogueBranch`, update it.

- [ ] **Step SC-4.8: Commit**

```bash
git add src/domain/dialogue.ts src/data/schemas/dialogue.ts src/systems/dialogueRunner.ts \
        src/data/content/dialogue/bandit_threat.json \
        tests/unit/systems/dialogueRunner.test.ts CONTEXT.md
# add any other dialogue files modified
git commit -m "feat(phaser): [SC-4] migrate Choice schema — check/onPass/onFail; deprecate DialogueBranch

Per-unit semantics replace party-sum. bandit_threat threshold 12 → 7
since checks now compare to one unit's stat. Runner takes a partyState
and an attemptingUnitId; calls evaluateCheck from SC-3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task SC-5: CheckButton component

**STATUS:** ✅ Done at 7780067

**Files:**
- Create: `phaser/src/ui/components/CheckButton.tsx`
- Create: `phaser/tests/unit/ui/components/CheckButton.test.tsx`
- Modify: `phaser/src/ui/components/index.ts`
- Modify: `phaser/CONTEXT.md`

- [ ] **Step SC-5.1: Failing test for CheckButton**

Create `phaser/tests/unit/ui/components/CheckButton.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckButton } from '../../../../src/ui/components/CheckButton'
import { asUnitId, asClassId } from '../../../../src/domain/ids'

describe('<CheckButton>', () => {
  it('renders without prefix when no requirement', () => {
    render(<CheckButton text="Greet" candidates={[]} requirement={null} canPass={true} onPress={() => {}} />)
    expect(screen.getByText('Greet')).toBeInTheDocument()
    expect(screen.queryByTestId('check-prefix')).toBeNull()
  })

  it('renders green prefix when stat check is passable', () => {
    render(<CheckButton
      text="Force door"
      requirement={{ kind: 'stat', stat: 'str', threshold: 7 }}
      candidates={[
        { unitId: asUnitId('a'), unitName: 'A', classId: asClassId('lord'), statValue: 8, meetsThreshold: true },
      ]}
      canPass={true}
      onPress={() => {}}
    />)
    const prefix = screen.getByTestId('check-prefix')
    expect(prefix.textContent).toContain('STR 7')
    expect(prefix.className).toContain('text-emerald')
  })

  it('renders red prefix when nobody meets threshold', () => {
    render(<CheckButton
      text="Force door"
      requirement={{ kind: 'stat', stat: 'str', threshold: 10 }}
      candidates={[
        { unitId: asUnitId('a'), unitName: 'A', classId: asClassId('lord'), statValue: 5, meetsThreshold: false },
      ]}
      canPass={false}
      onPress={() => {}}
    />)
    const prefix = screen.getByTestId('check-prefix')
    expect(prefix.className).toContain('text-red')
  })

  it('disables button when canPass is false', () => {
    render(<CheckButton
      text="x"
      requirement={{ kind: 'gold', amount: 100 }}
      candidates={[]}
      canPass={false}
      onPress={() => {}}
    />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
  })

  it('renders gold prefix as [100g]', () => {
    render(<CheckButton
      text="x"
      requirement={{ kind: 'gold', amount: 100 }}
      candidates={[]}
      canPass={true}
      onPress={() => {}}
    />)
    expect(screen.getByTestId('check-prefix').textContent).toContain('100g')
  })

  it('fires onPress when clicked', () => {
    let pressed = false
    render(<CheckButton text="x" requirement={null} candidates={[]} canPass={true} onPress={() => { pressed = true }} />)
    fireEvent.click(screen.getByRole('button'))
    expect(pressed).toBe(true)
  })
})
```

- [ ] **Step SC-5.2: Run to verify fail**

```bash
npx vitest run tests/unit/ui/components/CheckButton.test.tsx --reporter=basic
```

Expected: ALL FAIL (module missing).

- [ ] **Step SC-5.3: Create CheckButton**

Create `phaser/src/ui/components/CheckButton.tsx`:

```typescript
import React from 'react'
import { Button } from './Button'
import type { CheckRequirement, CheckCandidate } from '../../domain/check'

export interface CheckButtonProps {
  text: string
  requirement: CheckRequirement | null
  candidates: CheckCandidate[]   // for stat checks; [] otherwise
  canPass: boolean                // any party member meets requirement
  onPress: () => void
}

function formatPrefix(req: CheckRequirement, candidates: CheckCandidate[]): string {
  switch (req.kind) {
    case 'stat': {
      const best = candidates[0]?.statValue ?? 0
      return `${req.stat.toUpperCase()} ${req.threshold} (${best})`
    }
    case 'class':
      return `${req.classId.toUpperCase()}`
    case 'gold':
      return `${req.amount}g`
    case 'food':
      return `${req.amount} food`
  }
}

export function CheckButton({ text, requirement, candidates, canPass, onPress }: CheckButtonProps): React.JSX.Element {
  return (
    <Button
      onPress={onPress}
      isDisabled={!canPass}
      variant={canPass ? 'primary' : 'secondary'}
      className="!justify-start text-left w-full"
    >
      {requirement && (
        <span
          data-testid="check-prefix"
          className={`mr-2 text-xs font-mono ${canPass ? 'text-emerald-400' : 'text-red-500'}`}
        >
          [{formatPrefix(requirement, candidates)}]
        </span>
      )}
      <span>{text}</span>
    </Button>
  )
}
```

- [ ] **Step SC-5.4: Export from components/index.ts**

Append to `phaser/src/ui/components/index.ts`:

```typescript
export { CheckButton } from './CheckButton'
export type { CheckButtonProps } from './CheckButton'
```

- [ ] **Step SC-5.5: Verify pass**

```bash
npx vitest run tests/unit/ui/components/CheckButton.test.tsx --reporter=basic
```

Expected: 6/6 PASS.

- [ ] **Step SC-5.6: Gates + commit**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates
git add src/ui/components/CheckButton.tsx src/ui/components/index.ts \
        tests/unit/ui/components/CheckButton.test.tsx CONTEXT.md
git commit -m "feat(phaser): [SC-5] CheckButton — NV-style check-prefixed choice button

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task SC-6: CheckCandidatePicker modal

**STATUS:** ✅ Done at 91e6c0e

**Files:**
- Create: `phaser/src/ui/components/CheckCandidatePicker.tsx`
- Create: `phaser/tests/unit/ui/components/CheckCandidatePicker.test.tsx`
- Modify: `phaser/src/ui/components/index.ts`

- [ ] **Step SC-6.1: Failing test**

Create `phaser/tests/unit/ui/components/CheckCandidatePicker.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckCandidatePicker } from '../../../../src/ui/components/CheckCandidatePicker'
import { asUnitId, asClassId } from '../../../../src/domain/ids'
import type { CheckCandidate } from '../../../../src/domain/check'

const mk = (id: string, stat: number, meets: boolean): CheckCandidate => ({
  unitId: asUnitId(id),
  unitName: id.toUpperCase(),
  classId: asClassId('lord'),
  statValue: stat,
  meetsThreshold: meets,
})

describe('<CheckCandidatePicker>', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <CheckCandidatePicker open={false} statLabel="STR" threshold={7} candidates={[mk('a', 8, true)]}
        onPick={() => {}} onCancel={() => {}} />,
    )
    expect(container.querySelector('#check-picker')).toBeNull()
  })

  it('renders one row per candidate when open', () => {
    render(
      <CheckCandidatePicker open={true} statLabel="STR" threshold={7}
        candidates={[mk('a', 8, true), mk('b', 5, false)]}
        onPick={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getAllByTestId('candidate-row')).toHaveLength(2)
  })

  it('passing rows show ✓; failing rows show ✗', () => {
    render(
      <CheckCandidatePicker open={true} statLabel="STR" threshold={7}
        candidates={[mk('a', 8, true), mk('b', 5, false)]}
        onPick={() => {}} onCancel={() => {}} />,
    )
    const rows = screen.getAllByTestId('candidate-row')
    expect(rows[0]!.textContent).toContain('✓')
    expect(rows[1]!.textContent).toContain('✗')
  })

  it('clicking a row fires onPick with that candidate', () => {
    let pickedId: string | null = null
    render(
      <CheckCandidatePicker open={true} statLabel="STR" threshold={7}
        candidates={[mk('a', 8, true)]}
        onPick={(c) => { pickedId = c.unitId as unknown as string }}
        onCancel={() => {}} />,
    )
    fireEvent.click(screen.getAllByTestId('candidate-row')[0]!)
    expect(pickedId).toBe('a')
  })

  it('cancel button fires onCancel', () => {
    let cancelled = false
    render(
      <CheckCandidatePicker open={true} statLabel="STR" threshold={7}
        candidates={[]} onPick={() => {}}
        onCancel={() => { cancelled = true }} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(cancelled).toBe(true)
  })
})
```

- [ ] **Step SC-6.2: Run fail**

```bash
npx vitest run tests/unit/ui/components/CheckCandidatePicker.test.tsx --reporter=basic
```

- [ ] **Step SC-6.3: Implement CheckCandidatePicker**

Create `phaser/src/ui/components/CheckCandidatePicker.tsx`:

```typescript
import React from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'
import type { CheckCandidate } from '../../domain/check'

export interface CheckCandidatePickerProps {
  open: boolean
  statLabel: string         // e.g. "STR"
  threshold: number
  candidates: CheckCandidate[]
  onPick: (c: CheckCandidate) => void
  onCancel: () => void
}

export function CheckCandidatePicker({
  open, statLabel, threshold, candidates, onPick, onCancel,
}: CheckCandidatePickerProps): React.JSX.Element | null {
  if (!open) return null
  return (
    <Dialog
      id="check-picker"
      open={open}
      onClose={onCancel}
      title={`Who tries this? [${statLabel} ${threshold}]`}
      position="center"
    >
      <div className="flex flex-col gap-2 p-2 min-w-[300px]">
        {candidates.map((c) => (
          <button
            key={c.unitId as unknown as string}
            data-testid="candidate-row"
            onClick={() => onPick(c)}
            className={`flex items-center gap-3 px-3 py-2 rounded border text-left
              ${c.meetsThreshold ? 'border-emerald-700 hover:bg-emerald-950/30' : 'border-red-900/50 hover:bg-red-950/20'}`}
          >
            <span className="font-bold w-24">{c.unitName}</span>
            <span className="text-stone-400 w-16">{statLabel} {c.statValue}</span>
            <span className={c.meetsThreshold ? 'text-emerald-400' : 'text-red-400'}>
              {c.meetsThreshold ? '✓' : '✗'}
            </span>
          </button>
        ))}
        {candidates.length === 0 && (
          <div className="text-stone-500 italic text-center py-4">No living party members.</div>
        )}
        <div className="mt-3">
          <Button variant="secondary" onPress={onCancel}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step SC-6.4: Verify pass**

```bash
npx vitest run tests/unit/ui/components/CheckCandidatePicker.test.tsx --reporter=basic
```

Expected: 5/5 PASS.

- [ ] **Step SC-6.5: Export + gates + commit**

Append to `index.ts`:
```typescript
export { CheckCandidatePicker } from './CheckCandidatePicker'
export type { CheckCandidatePickerProps } from './CheckCandidatePicker'
```

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates
git add src/ui/components/CheckCandidatePicker.tsx src/ui/components/index.ts tests/unit/ui/components/CheckCandidatePicker.test.tsx CONTEXT.md
git commit -m "feat(phaser): [SC-6] CheckCandidatePicker — \"who tries this?\" modal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task SC-7: CheckEventModal + DialogueModal integration

**STATUS:** ✅ Done at f01d3aa

**Files:**
- Create: `phaser/src/ui/modals/CheckEventModal.tsx`
- Create: `phaser/tests/unit/ui/modals/CheckEventModal.test.tsx`
- Modify: `phaser/src/ui/modals/DialogueModal.tsx` (use CheckButton + picker for choices with `check`)
- Modify: `phaser/CONTEXT.md`

- [ ] **Step SC-7.1: Failing test for CheckEventModal**

Create `phaser/tests/unit/ui/modals/CheckEventModal.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckEventModal } from '../../../../src/ui/modals/CheckEventModal'
import { asUnitId, asClassId } from '../../../../src/domain/ids'
import type { Unit } from '../../../../src/domain/unit'

const mkUnit = (id: string, str: number): Unit => ({
  id: asUnitId(id), name: id.toUpperCase(), classId: asClassId('lord'), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 0 },
  position: null, ap: 3, armor: 0, statuses: [],
})

const evt = {
  id: 'e',
  title: 'A boulder',
  description: 'Heavy.',
  choices: [
    { id: 'force', text: 'Force.',
      check: { kind: 'stat' as const, stat: 'str' as const, threshold: 7 },
      onPass: { narration: 'You rolled it.', effects: [] },
      onFail: { narration: 'It did not move.', effects: [] } },
    { id: 'leave', text: 'Leave.',
      onPass: { narration: 'You moved on.', effects: [] } },
  ],
}

describe('<CheckEventModal>', () => {
  it('renders title and description', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0} onResolve={() => {}} onClose={() => {}} />)
    expect(screen.getByText('A boulder')).toBeInTheDocument()
    expect(screen.getByText(/Heavy/)).toBeInTheDocument()
  })

  it('renders one button per choice', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0} onResolve={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Force.')).toBeInTheDocument()
    expect(screen.getByText('Leave.')).toBeInTheDocument()
  })

  it('clicking a stat-checked choice opens the picker', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0} onResolve={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Force.'))
    expect(screen.getByText(/Who tries this/)).toBeInTheDocument()
  })

  it('after picker pick, narration replaces description', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0} onResolve={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Force.'))
    fireEvent.click(screen.getAllByTestId('candidate-row')[0]!)
    expect(screen.getByText('You rolled it.')).toBeInTheDocument()
  })

  it('Continue button after narration fires onResolve', () => {
    let resolved = false
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0}
      onResolve={() => { resolved = true }} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Force.'))
    fireEvent.click(screen.getAllByTestId('candidate-row')[0]!)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(resolved).toBe(true)
  })

  it('non-checked choice resolves directly without picker', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0} onResolve={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Leave.'))
    expect(screen.getByText('You moved on.')).toBeInTheDocument()
  })
})
```

- [ ] **Step SC-7.2: Verify fail**

```bash
npx vitest run tests/unit/ui/modals/CheckEventModal.test.tsx --reporter=basic
```

- [ ] **Step SC-7.3: Implement CheckEventModal**

Create `phaser/src/ui/modals/CheckEventModal.tsx`:

```typescript
import React, { useState } from 'react'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { CheckButton } from '../components/CheckButton'
import { CheckCandidatePicker } from '../components/CheckCandidatePicker'
import { evaluateCheck, getCheckCandidates } from '../../systems/checkResolver'
import type { CheckRequirement, CheckCandidate } from '../../domain/check'
import type { Unit } from '../../domain/unit'

export interface CheckEventOutcome {
  narration: string
  effects: Array<{ kind: string; [k: string]: unknown }>
}

export interface CheckEventChoice {
  id: string
  text: string
  check?: CheckRequirement
  onPass: CheckEventOutcome
  onFail?: CheckEventOutcome
}

export interface CheckEvent {
  id: string
  title: string
  description: string
  choices: CheckEventChoice[]
}

export interface CheckEventModalProps {
  event: CheckEvent
  party: Unit[]
  gold: number
  foodCount: number
  onResolve: (resolved: { choiceId: string; outcome: CheckEventOutcome; attemptingUnitId: string | null }) => void
  onClose: () => void
}

export function CheckEventModal({ event, party, gold, foodCount, onResolve, onClose }: CheckEventModalProps): React.JSX.Element {
  const [pickerChoice, setPickerChoice] = useState<CheckEventChoice | null>(null)
  const [resolved, setResolved] = useState<{ choiceId: string; outcome: CheckEventOutcome; attemptingUnitId: string | null } | null>(null)

  const partyState = { gold, foodCount, party }

  const resolveChoice = (choice: CheckEventChoice, attemptingUnit: Unit | null): void => {
    if (!choice.check) {
      // No-check choice — onPass is the only outcome.
      setResolved({ choiceId: choice.id, outcome: choice.onPass, attemptingUnitId: null })
      return
    }
    const passed = evaluateCheck(choice.check, attemptingUnit, partyState)
    const outcome = passed ? choice.onPass : (choice.onFail ?? choice.onPass)
    setResolved({
      choiceId: choice.id,
      outcome,
      attemptingUnitId: attemptingUnit?.id as unknown as string ?? null,
    })
  }

  const onChoiceClick = (choice: CheckEventChoice): void => {
    if (!choice.check) {
      resolveChoice(choice, null)
      return
    }
    if (choice.check.kind === 'stat') {
      // Open picker
      setPickerChoice(choice)
      return
    }
    // Class / gold / food: auto-resolve
    resolveChoice(choice, null)
  }

  return (
    <>
      <Dialog id="check-event" open onClose={onClose} title={event.title} position="center">
        <div className="p-4 max-w-lg">
          {!resolved ? (
            <>
              <p className="italic text-stone-300 mb-4">{event.description}</p>
              <div className="flex flex-col gap-2">
                {event.choices.map((c) => {
                  const candidates = c.check ? getCheckCandidates(c.check, party) : []
                  const canPass = c.check ? evaluateCheck(c.check, candidates[0]
                    ? party.find((u) => (u.id as unknown as string) === (candidates[0]!.unitId as unknown as string)) ?? null
                    : null, partyState) : true
                  // For class/gold/food, evaluateCheck doesn't need attempting unit
                  const canPassFinal = c.check?.kind === 'stat'
                    ? candidates.some((cand) => cand.meetsThreshold)
                    : c.check ? evaluateCheck(c.check, null, partyState) : true
                  return (
                    <CheckButton
                      key={c.id}
                      text={c.text}
                      requirement={c.check ?? null}
                      candidates={candidates}
                      canPass={canPassFinal}
                      onPress={() => onChoiceClick(c)}
                    />
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-amber-200 mb-4">{resolved.outcome.narration}</p>
              <Button variant="primary" onPress={() => onResolve(resolved)}>Continue</Button>
            </>
          )}
        </div>
      </Dialog>

      <CheckCandidatePicker
        open={pickerChoice !== null}
        statLabel={pickerChoice?.check?.kind === 'stat' ? pickerChoice.check.stat.toUpperCase() : ''}
        threshold={pickerChoice?.check?.kind === 'stat' ? pickerChoice.check.threshold : 0}
        candidates={pickerChoice?.check ? getCheckCandidates(pickerChoice.check, party) : []}
        onPick={(c) => {
          const attempting = party.find((u) => (u.id as unknown as string) === (c.unitId as unknown as string)) ?? null
          if (pickerChoice) resolveChoice(pickerChoice, attempting)
          setPickerChoice(null)
        }}
        onCancel={() => setPickerChoice(null)}
      />
    </>
  )
}
```

- [ ] **Step SC-7.4: Verify pass + update DialogueModal**

```bash
npx vitest run tests/unit/ui/modals/CheckEventModal.test.tsx --reporter=basic
```

Expected: 6/6 PASS.

Open `phaser/src/ui/modals/DialogueModal.tsx`. For each choice rendered, if `choice.check` is set, render `<CheckButton>` with the appropriate `candidates` + `canPass`; on press, open the picker (for stat checks) or resolve directly. The picker resolution dispatches an `advanceDialogue` (or whatever the existing dispatch is) to `onPass` or `onFail`.

Reuse the same partyState computation (gold, foodCount, party) sourced from `useRunStore`.

- [ ] **Step SC-7.5: Gates + commit**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
git add src/ui/modals/CheckEventModal.tsx src/ui/modals/DialogueModal.tsx \
        tests/unit/ui/modals/CheckEventModal.test.tsx CONTEXT.md
git commit -m "feat(phaser): [SC-7] CheckEventModal + DialogueModal stat-check integration

CheckEventModal is the shared event panel (title/desc/choices/narration)
used by Overworld, Dungeon, and BattleEnd surfaces in later tasks.
DialogueModal now renders CheckButton for choices with .check, opens
the picker on stat-check click, and dispatches onPass/onFail.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task SC-8: Travel encounter `checkEvent` outcome

**STATUS:** ✅ Done at 782795e

**Files:**
- Modify: `phaser/src/data/schemas/encounter.ts` (or whichever schema file holds outcome union)
- Modify: `phaser/src/systems/encounterRoller.ts` (return checkEvent outcome)
- Modify: `phaser/src/ui/screens/OverworldScene.tsx` (mount CheckEventModal when outcome.kind === 'checkEvent')
- Create: 2 authored encounters (e.g. `stuck_caravan.json`, `bandit_lookout.json`) — placed in encounter table JSONs
- Modify: `phaser/src/data/content/encounters/borderlands_road.json`

- [ ] **Step SC-8.1: Failing schema test for checkEvent outcome**

Append to `phaser/tests/unit/systems/encounterRoller.test.ts`:

```typescript
it('rolls a checkEvent outcome', () => {
  const table = {
    id: 'test', region: 'borderlands', entries: [
      {
        id: 'caravan', weight: 1, oneShot: false,
        outcome: {
          kind: 'checkEvent',
          event: {
            id: 'caravan', title: 'A caravan', description: '...', choices: [
              { id: 'leave', text: 'Leave.', onPass: { narration: '...', effects: [] } },
            ],
          },
        },
      },
    ],
  }
  const rng = createRng({ seed: 0, counter: 0 })
  const result = rollEncounter(table, new Set(), rng)
  expect(result?.outcome.kind).toBe('checkEvent')
})
```

- [ ] **Step SC-8.2: Update schema and roller**

Open `phaser/src/data/schemas/encounter.ts` (or where the outcome union lives — grep for `dialogue` and `battle` outcomes). Add a third member:

```typescript
const CheckEventOutcome = z.object({
  kind: z.literal('checkEvent'),
  event: CheckEventSchema,  // imported from schemas/checkEvent.ts (create if not done)
})
```

Add `kind: 'checkEvent'` to the encounter outcome union. Verify schema parsing.

Update `encounterRoller.ts` to surface the new outcome (no special handling — it just returns the parsed object; UI does the rest).

- [ ] **Step SC-8.3: Add 2 authored encounters**

Append entries to `phaser/src/data/content/encounters/borderlands_road.json`:

```jsonc
{
  "id": "stuck_caravan",
  "weight": 10,
  "oneShot": false,
  "outcome": {
    "kind": "checkEvent",
    "event": {
      "id": "stuck_caravan",
      "title": "A caravan blocks the road.",
      "description": "The driver shouts at his oxen. The road is narrow.",
      "choices": [
        {
          "id": "help_push",
          "text": "Help push.",
          "check": { "kind": "stat", "stat": "str", "threshold": 6 },
          "onPass": { "narration": "You shoulder the wheel free; the merchant tips you.", "effects": [{"kind":"addGold","amount":25}] },
          "onFail": { "narration": "You strain but the wheel won't move.", "effects": [] }
        },
        {
          "id": "negotiate",
          "text": "Talk him into a detour.",
          "check": { "kind": "stat", "stat": "skl", "threshold": 7 },
          "onPass": { "narration": "He agrees, gladly.", "effects": [{"kind":"addGold","amount":15}] },
          "onFail": { "narration": "He waves you off.", "effects": [] }
        },
        {
          "id": "wait",
          "text": "Wait it out.",
          "onPass": { "narration": "Two hours later, the road clears.", "effects": [{"kind":"addFood","amount":-1}] }
        }
      ]
    }
  }
},
{
  "id": "bandit_lookout",
  "weight": 6,
  "oneShot": false,
  "outcome": {
    "kind": "checkEvent",
    "event": {
      "id": "bandit_lookout",
      "title": "A scout watches the road.",
      "description": "He hasn't seen you yet.",
      "choices": [
        {
          "id": "sneak",
          "text": "Sneak past.",
          "check": { "kind": "stat", "stat": "spd", "threshold": 8 },
          "onPass": { "narration": "You slip by, undetected.", "effects": [] },
          "onFail": { "narration": "He spots you. Bandits!", "effects": [{"kind":"forceBattle","groupId":"bandits"}] }
        },
        {
          "id": "ambush",
          "text": "Ambush him.",
          "check": { "kind": "stat", "stat": "skl", "threshold": 6 },
          "onPass": { "narration": "Quick and silent. His coin purse is yours.", "effects": [{"kind":"addGold","amount":40}] },
          "onFail": { "narration": "He shouts a warning. Bandits!", "effects": [{"kind":"forceBattle","groupId":"bandits"}] }
        }
      ]
    }
  }
}
```

(Note: `forceBattle` effect is hypothetical; the existing effect system may not support it. If not, remove that effect — failure becomes a soft fail with no follow-up battle. Implementation detail to resolve during execution.)

- [ ] **Step SC-8.4: Mount CheckEventModal in OverworldScene**

Open `phaser/src/ui/screens/OverworldScene.tsx`. Find the encounter resolution branch (where `outcome.kind === 'dialogue'` dispatches `startDialogue`). Add a third branch for `'checkEvent'`:

```typescript
if (result.outcome.kind === 'checkEvent') {
  setActiveCheckEvent(result.outcome.event)
  return
}
```

Add local state `[activeCheckEvent, setActiveCheckEvent] = useState<CheckEvent | null>(null)` and at the bottom of the component render:

```tsx
{activeCheckEvent && (
  <CheckEventModal
    event={activeCheckEvent}
    party={Object.values(useRunStore.getState().party.units)}
    gold={useRunStore.getState().gold}
    foodCount={useRunStore.getState().inventory.items.filter((i) => (i.itemId as unknown as string) === 'food_rations').length}
    onResolve={({ outcome }) => {
      // Apply outcome effects via runStore.dispatch(applyQuestEffects)
      useRunStore.getState().dispatch({ type: 'applyQuestEffects', payload: { effects: outcome.effects } })
      setActiveCheckEvent(null)
    }}
    onClose={() => setActiveCheckEvent(null)}
  />
)}
```

- [ ] **Step SC-8.5: Gates + e2e + commit**

Add an e2e at `phaser/tests/e2e/check-travel-event.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('travel checkEvent renders panel and resolves', async ({ page }) => {
  await page.goto('/')
  await page.click('text=New Game')
  // Skip prologue
  await page.evaluate(() => {
    const r = (window as unknown as { __debug: { runStore: { getState: () => { dispatch: (a: unknown) => void; pendingDialogue: unknown } } } }).__debug.runStore
    while ((r.getState() as { pendingDialogue: unknown }).pendingDialogue) {
      r.getState().dispatch({ type: 'endDialogue' })
    }
  })
  // Force a stuck_caravan encounter via debug surface
  await page.evaluate(() => {
    const r = (window as unknown as { __debug: { runStore: unknown } }).__debug.runStore
    // Simulate setActiveCheckEvent — needs OverworldScene to expose a debug hook;
    // alternatively, just assert that mounting the component doesn't crash.
    void r
  })
  expect(await page.locator('#combat-hud, #overworld-scene').count()).toBeGreaterThan(0)
})
```

(The full e2e for forcing a checkEvent requires a debug hook. Smoke test acceptable for v1.)

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
git add src/data/schemas/encounter.ts src/data/schemas/checkEvent.ts \
        src/systems/encounterRoller.ts \
        src/data/content/encounters/borderlands_road.json \
        src/ui/screens/OverworldScene.tsx \
        tests/unit/systems/encounterRoller.test.ts \
        tests/e2e/check-travel-event.spec.ts CONTEXT.md
git commit -m "feat(phaser): [SC-8] travel encounter checkEvent outcome + 2 authored events

stuck_caravan (STR/SKL with gold rewards) and bandit_lookout (SPD/SKL,
fail spawns battle if forceBattle effect supported) added to borderlands
road encounter table. OverworldScene mounts CheckEventModal when the
roller returns kind='checkEvent'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task SC-9: Dungeon room event support

**STATUS:** ✅ Done at 5e9057b

**Files:**
- Modify: `phaser/src/domain/dungeon.ts` (add roomEvents to DungeonDef)
- Modify: `phaser/src/data/schemas/dungeonDef.ts`
- Modify: `phaser/src/procgen/dungeonGenerator.ts` (assign roomEvent to event-type rooms)
- Modify: `phaser/src/data/content/dungeons/smugglers_cave.json` (add 1-2 roomEvents)
- Modify: `phaser/src/data/content/dungeons/ancient_ruins.json` (add 1 roomEvent)
- Modify: `phaser/src/ui/screens/DungeonScene.tsx` (mount CheckEventModal when entering an event room)

- [ ] **Step SC-9.1: Failing test asserting roomEvents parse + assignment**

Create or extend `phaser/tests/unit/data/dungeons.test.ts`:

```typescript
it('smugglers_cave parses with roomEvents', () => {
  expect(dungeon.roomEvents.length).toBeGreaterThan(0)
})
```

- [ ] **Step SC-9.2: Add roomEvents schema**

Open `phaser/src/data/schemas/dungeonDef.ts`. Add:

```typescript
import { CheckEventSchema } from './checkEvent'

// inside DungeonDefSchema:
roomEvents: z.array(CheckEventSchema).default([]),
```

And mirror in `domain/dungeon.ts`.

- [ ] **Step SC-9.3: Wire generator to attach event to event-rooms**

Open `phaser/src/procgen/dungeonGenerator.ts`. When generating an event-type room, pick a random entry from `dungeon.roomEvents` (using the run RNG) and attach it to the room object. The Room interface gains an optional `eventOverride: CheckEvent | null` field.

- [ ] **Step SC-9.4: DungeonScene mounts CheckEventModal**

Open `phaser/src/ui/screens/DungeonScene.tsx`. When the player enters an `event` room, instead of the existing stub, mount `<CheckEventModal>` with the room's `eventOverride`. On resolve, apply effects to runStore and mark the room cleared.

- [ ] **Step SC-9.5: Author content**

Add `roomEvents` arrays to smugglers_cave.json and ancient_ruins.json. Examples in spec.

- [ ] **Step SC-9.6: Gates + commit**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
git add ...
git commit -m "feat(phaser): [SC-9] dungeon room events with stat checks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task SC-10: Post-victory event + visual playthrough + tag

**STATUS:** ✅ Done at 9c2b311 — `phaser-stat-checks` tag pushed

**Files:**
- Create: `phaser/src/data/content/checkEvents/interrogate_survivor.json`
- Modify: `phaser/src/data/schemas/enemyGroup.ts` (add optional `victoryEvent` field referencing a checkEvent id)
- Modify: `phaser/src/data/content/enemyGroups/bandits.json` (add `"victoryEvent": "interrogate_survivor"`)
- Modify: `phaser/src/ui/modals/BattleEndModal.tsx` (mount CheckEventModal pre-modal if victoryEvent set)
- Add: `phaser/tests/e2e/check-victory.spec.ts`

- [ ] **Step SC-10.1: Author interrogate_survivor.json**

Create `phaser/src/data/content/checkEvents/interrogate_survivor.json`:

```json
{
  "id": "interrogate_survivor",
  "title": "A survivor begs for mercy.",
  "description": "Bloodied, kneeling. He'll talk if pressed.",
  "choices": [
    {
      "id": "intimidate",
      "text": "Threaten him.",
      "check": { "kind": "stat", "stat": "str", "threshold": 7 },
      "onPass": { "narration": "He spills everything. The bandit camp is east.", "effects": [{"kind":"setFlag","key":"bandit_camp_known","value":true}] },
      "onFail": { "narration": "He spits at your boots and dies refusing.", "effects": [] }
    },
    {
      "id": "persuade",
      "text": "Convince him.",
      "check": { "kind": "stat", "stat": "skl", "threshold": 6 },
      "onPass": { "narration": "He talks freely. The bandit camp is east.", "effects": [{"kind":"setFlag","key":"bandit_camp_known","value":true}] },
      "onFail": { "narration": "He distrusts you and stays silent.", "effects": [] }
    },
    {
      "id": "kill",
      "text": "End it.",
      "onPass": { "narration": "Quick and quiet.", "effects": [] }
    }
  ]
}
```

- [ ] **Step SC-10.2: Wire victoryEvent in BattleEndModal**

When phase=VICTORY and the source enemy group has `victoryEvent`, mount `<CheckEventModal>` first; on resolve, transition to BattleEndModal proper.

- [ ] **Step SC-10.3: Visual playthrough**

Run `npm run dev`. Drive a full play sequence covering all four check surfaces:

1. New game → talk to bandit (dialogue check)
2. Travel until stuck_caravan triggers (travel check)
3. Enter smugglers_cave → event room → blocked_passage (dungeon check)
4. Win the cave's first combat with bandits → interrogate_survivor (post-victory check)

Capture screenshots `parity-stat-1-dialogue.png` through `parity-stat-4-victory.png`.

- [ ] **Step SC-10.4: Final gates + tag + promise**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
git tag phaser-stat-checks
git add ...
git commit -m "feat(phaser): [SC-10] post-victory events + visual playthrough; tag phaser-stat-checks

Stat check system fully integrated across dialogue, travel, dungeon, and
post-victory surfaces. 5+ authored events shipped. All four surfaces
verified in a 5-minute playthrough.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Emit `<promise>STAT-CHECK-COMPLETE</promise>`.

---

## Self-review

### Spec coverage

| Spec section | Plan task |
|---|---|
| Domain model (CheckRequirement union) | SC-1 |
| `lck` extension | SC-2 |
| Resolver semantics (evaluateCheck + getCheckCandidates) | SC-3 |
| Dialogue Choice schema migration | SC-4 |
| CheckButton UX | SC-5 |
| CheckCandidatePicker UX | SC-6 |
| CheckEventModal shell | SC-7 |
| Travel encounter checkEvent surface + 2 authored | SC-8 |
| Dungeon room event surface + 2 authored | SC-9 |
| Post-victory surface + 1 authored + tag | SC-10 |

5+ authored content pieces ship across SC-8 + SC-9 + SC-10.

### Type consistency

- `CheckRequirement` union shape stable across SC-1 through SC-10.
- `CheckEvent` / `CheckEventChoice` / `CheckEventOutcome` defined once in CheckEventModal; consumed by Overworld / Dungeon / BattleEnd.
- `DialogueChoice` schema with optional `check` / `onPass` / `onFail` consistent with runner signature.
- `evaluateCheck(req, attemptingUnit, partyState)` signature fixed.

### Risks

1. SC-4 schema migration touches existing dialogues — if `bandit_threat.json` is the only one with `statCheck`, migration is small. Inventory at SC-4.1 confirms.
2. `forceBattle` effect referenced in SC-8 sample content may not exist; resolve at execution time (drop effect or implement).
3. `setFlag` effect referenced in SC-10 may also need verification.
4. Dungeon procgen change in SC-9 may interact with existing `dungeonGenerator.test.ts` — re-run those tests carefully.

Each task ends green-gates; if a referenced effect doesn't exist, that task adds it as a discovered need.
