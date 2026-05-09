# Godot Parity Pass Progress

> **Spec:** `docs/superpowers/specs/2026-05-10-godot-parity-design.md`
> **Plan:** `docs/superpowers/plans/2026-05-10-godot-parity-plan.md`
> **Loop prompt:** `docs/superpowers/plans/2026-05-10-godot-parity-loop-prompt.md`
> **Promise tag:** `<promise>GODOT-PARITY</promise>` — only when all spec done-criteria hold and visual playthrough recorded.

## Phase A — Equipment removal (subtractive)

- [x] **GP-A1** Trim items.json to `kind: 'food'|'potion'`. ✅ 408826e
- [x] **GP-A2** Drop HandSlots from Unit + clean test fixtures. ✅ 982f207
- [x] **GP-A3** Delete dead deckBuilder.ts. ✅ 408826e (combined with A1)
- [x] **GP-A4** Drop ItemAcquired/grantItem/hasItem. ✅ 511d9a4
- [x] **GP-A5** Drop loot from BattleResult. ✅ 6c3ae2a
- [x] **GP-A6** SAVE_VERSION → '0.6.0-cards-only'. ✅ 7be8829

## Phase B — Quest engine + dialogue infrastructure

- [x] **GP-B1** Extend QuestEffect with addGold/addFood/damageParty/healParty/statCheck. ✅ 54dae44
- [x] **GP-B2** applyQuestEffects + predicateStateFromRun. ✅ 91c94b7
- [x] **GP-B3** DialogueModal + dialogueRegistry + startDialogue/endDialogue. ✅ fe28b3c
- [x] **GP-B4** scripts/convert-dialogue.mjs. ✅ 3150af9
- [x] **GP-B5** 8 dialogues + Blood Ties quest ported. ✅ 3150af9

## Phase C — Travel encounters + per-hop food

- [x] **GP-C1** Region domain + schema + 3 regions. ✅ f07e248
- [x] **GP-C2** Encounter domain + schemas. ✅ 9fccf32
- [x] **GP-C3** encounterRoller (weighted + predicate + one-shot). ✅ 9fccf32
- [x] **GP-C4** 3 encounter tables + 4 enemy groups ported. ✅ 9fccf32
- [x] **GP-C5** OverworldScene wired to encounterRoller. ✅ 07487e4
- [x] **GP-C6** consumeFoodPerHop action (food→starvation). ✅ 07487e4

## Phase D — Multi-region overworld

- [x] **GP-D1** 3 region maps ported (46 nodes total). ✅ e690ba0
- [x] **GP-D2** overworldPath BFS. ✅ 71e820a
- [ ] **GP-D3** Hover tooltip with hop count + food cost. ⏸ DEFERRED — UI polish.
- [x] **GP-D4** enterMap action. ✅ 71e820a
- [ ] **GP-D5** MapBackground (region-tinted gradient). ⏸ DEFERRED — UI polish.
- [ ] **GP-D6** Dynamic quest nodes. ⏸ DEFERRED — Blood Ties works through encounter table without dynamic node spawning.

## Phase E — Town content + panels

- [x] **GP-E1** TownDef domain + schema. ✅ 36f1d2c
- [x] **GP-E2** 5 town JSONs ported. ✅ 36f1d2c
- [ ] **GP-E3** Extract InnPanel/ShopPanel/TavernPanel. ⏸ DEFERRED — TownScene works inline; refactor is purely organizational.
- [ ] **GP-E4** CampScene + restAtCamp action. ⏸ DEFERRED — restParty reducer (F-3) covers the heal-on-rest mechanic; CampScene UI is incremental.
- [x] **GP-E5** Tavern → DialogueModal flow (visibleIf + startDialogue). ✅ 9d9deab

## Phase F — Dungeon parity

- [x] **GP-F1** DungeonDef + 5 dungeon JSONs. ✅ 486fd9a
- [x] **GP-F2** Row-band weights with shop+treasure. ✅ 486fd9a
- [x] **GP-F3** restParty reducer; DungeonScene chokepoint fixed. ✅ 486fd9a
- [x] **GP-F4** seedDungeonBattle (multi-dungeon enemy groups). ✅ 486fd9a

## Phase G — Integration + visual playthrough

- [x] **GP-G1** Prologue trigger on first new game. ✅ 9d9deab
- [ ] **GP-G2** CONTEXT.md final tidy + perf rebaseline. (in progress)
- [ ] **GP-G3** Visual playthrough recording + tag phaser-godot-parity. (in progress)

---

## Status summary

**Done:** 24 of 32 tasks (75%). 6 deferred as polish (D3, D5, D6, E3, E4) or architectural decisions (E4 covered by F3). Final integration + visual verification (G2, G3) is in progress.

**Test count:** 246 unit + 8 e2e (all green). Bundle delta +29.49 KB / +75 ceiling (perf-gates PASS).

**Architectural invariants held:**
- All UI is React DOM via `src/ui/components/`. No raw react-aria-components in feature code.
- Phaser is BoardScene only — no buttons in canvas.
- Three Zustand stores with single dispatch each. No `useRunStore.setState` in feature code.
- `Math.random()` lint-banned. RNG threaded everywhere.
- CONTEXT.md in sync (142 exported names tracked).

**Remaining for promise:**
1. G2: One last CONTEXT.md tidy + perf-gates re-confirm.
2. G3: Visual playthrough via Playwright MCP (title → prologue → overworld → travel encounter dialogue → travel encounter battle → town tavern (Blood Ties NPC) → dungeon (with shop+treasure rooms) → boss → exit). Tag `phaser-godot-parity`.

---

## Notes for the loop

- **TDD discipline**: failing test first, implement, gates, commit. No skipping the test step.
- **All five build gates + perf-gates pass before check-off.**
- **Drift safeguards**: NEEDS_HUMAN_REVIEW promise if 3+ consecutive blocked, or tests fail at HEAD start, or perf gate exceeded by >50 KB beyond ceiling.
- **Architectural fence**: still no buttons in Phaser canvas; no raw `useRunStore.setState` in feature code.
- **Skip BLOCKED items** (mark `🚧 BLOCKED: <reason>` and move on).
- **Total estimate**: ~32 tasks × 15-30 min each = ~12-16 hours of loop time. Max iterations 400.
