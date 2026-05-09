# Godot Parity Pass Progress

> **Spec:** `docs/superpowers/specs/2026-05-10-godot-parity-design.md`
> **Plan:** `docs/superpowers/plans/2026-05-10-godot-parity-plan.md`
> **Loop prompt:** `docs/superpowers/plans/2026-05-10-godot-parity-loop-prompt.md`
> **Promise tag:** `<promise>GODOT-PARITY</promise>` — emit only when all done criteria from the spec hold.

Each iteration completes ONE task end-to-end (TDD: failing test → implementation → all gates green → commit → check off).

---

## Phase A — Equipment removal (subtractive)

- [x] **GP-A1** Trim `items.json` + Item domain to `kind: 'food' | 'potion'` only. ✅ items.json now 3 entries (food_rations, healing_potion, power_elixir). Item type stripped of WeaponType, gearCards, quiverModifier, isTwoHanded, range. Schema matches.
- [ ] **GP-A2** Drop `HandSlots` from `Unit` + remove `hand: { left, right }` fixtures from 13 test files + `seedStubBattle.ts`.
- [x] **GP-A3** Delete `systems/deckBuilder.ts` + dead test (no callers). ✅ Combined with A1 since A1's typecheck depended on A3's deletion (deckBuilder consumed `Item.gearCards`).
- [ ] **GP-A4** Drop `equipHand` action, `ItemAcquired` event, `grantItem` quest effect, `hasItem` predicate.
- [ ] **GP-A5** Drop `loot` field from `BattleResult` + battleResolver + applyBattleResult.
- [ ] **GP-A6** Bump `SAVE_VERSION` to `'0.6.0-cards-only'`. Drop `hand`/`loot` from save schema. Drop `itemId` alias.

## Phase B — Quest engine + dialogue infrastructure

- [ ] **GP-B1** Extend `QuestEffect` union with `addGold | addFood | damageParty | healParty | statCheck`. Match in schema. Implement in questRunner.
- [ ] **GP-B2** Wire `questRunner` into `runStore.dispatch` post-action hook. Add `applyQuestEffects { effects }` action.
- [ ] **GP-B3** Build `DialogueModal.tsx` + `StatCheckModal.tsx`. Add `pendingDialogue` state + `startDialogue` / `endDialogue` actions. Mount at App root.
- [ ] **GP-B4** Build `scripts/convert-dialogue.mjs` (Godot→phaser dialogue JSON converter).
- [ ] **GP-B5** Port 8 Godot dialogues to `data/content/dialogue/*.json` + Blood Ties quest to `data/content/quests/blood_ties.json`.

## Phase C — Travel encounters + per-hop food

- [ ] **GP-C1** Add `Region` domain + schema + `regions.json` (borderlands/thornwood/ashfall, tier 1-3).
- [ ] **GP-C2** Add `EncounterEntry` + `EnemyGroup` domain types + schemas.
- [ ] **GP-C3** Build `systems/encounterRoller.ts` (predicate-filtered weighted pick + one-shot tracking) with deterministic-RNG tests.
- [ ] **GP-C4** Port `data/events/travel_events.json` → 3 region encounter tables. Port `enemy_groups.json` → 4 group files (bandits, wolves, brigands, darens_gang).
- [ ] **GP-C5** Wire `OverworldScene.handleNodeClick` to encounterRoller. Branch dialogue → `startDialogue`, battle → combat seed. Add `markEncounterFired` action + `oneShotsFired` state.
- [ ] **GP-C6** Add `consumeFoodPerHop` action (decrements food, deals 3 HP starvation when 0). HUD shows food + "starving" indicator.

## Phase D — Multi-region overworld

- [ ] **GP-D1** Port Godot `overworld.json` into 3 region maps (`borderlands.json`, `thornwood.json`, `ashfall.json`). Extend `WorldMap` with `regionId` + `MapEdge` for cross-map.
- [ ] **GP-D2** Build `systems/overworldPath.ts` (BFS). Multi-hop click = compute path → travel hop-by-hop with encounter roll on each.
- [ ] **GP-D3** Hover tooltip with hop count + food cost preview, color-coded by affordability.
- [ ] **GP-D4** Add `enterMap` action. Region-edge crossings dispatch enterMap + arriveAtNode. QuestRunner sees correct `LocationArrived`.
- [ ] **GP-D5** Build `MapBackground.tsx` — region-tinted radial gradient.
- [ ] **GP-D6** Dynamic quest nodes — `runStore.dynamicNodes` + `spawnQuestNode` / `removeQuestNode` actions. QuestRunner spawnNode effect dispatches.

## Phase E — Town content + panels

- [ ] **GP-E1** Add `TownDef` domain + schema.
- [ ] **GP-E2** Port 5 Godot towns to `data/content/towns/*.json`. Register in `data/load.ts`.
- [ ] **GP-E3** Extract `InnPanel.tsx` + `ShopPanel.tsx` + `TavernPanel.tsx`. Refactor `TownScene` to take `townId` prop. Pass townId from current overworld node.
- [ ] **GP-E4** Build `CampScene.tsx` (Rest / Scout-stub / Leave) + `restAtCamp` action. Wire camp nodes to CampScene via App view router.
- [ ] **GP-E5** Tavern → DialogueModal: iterate `tavernQuests`, each NPC click dispatches `startDialogue { dialogueId }`. Replace hardcoded blood_ties button.

## Phase F — Dungeon parity

- [ ] **GP-F1** Add `DungeonDef` domain + schema. Port 5 dungeons (smugglers_cave, iron_mine, thornwood_depths, ancient_ruins, obsidian_cavern).
- [ ] **GP-F2** Add row-band rules to `dungeonGenerator.ts`. Include `shop` (~10%) + `treasure` (~15%) in mid-row weights. Test: 100 sample runs produce all 7 room types.
- [ ] **GP-F3** Add `restParty { percent }` reducer. Replace `useRunStore.setState` bypass in `DungeonScene.tsx`.
- [ ] **GP-F4** Build `seedDungeonBattle.ts` — looks up DungeonDef → enemy group → seeds battle. BoardScene routes via dungeon vs travel encounter source. OverworldScene passes dungeonId from clicked node.

## Phase G — Integration + visual playthrough

- [ ] **GP-G1** Prologue trigger: on first new game with `prologue_seen` flag false, dispatch startDialogue('prologue').
- [ ] **GP-G2** CONTEXT.md drift updates (drop equipHand action, add new domain types + actions). `npm run perf-gates` passes (rebaseline if legitimate).
- [ ] **GP-G3** Final visual playthrough recording. All 5 gates + perf-gates green. Tag `phaser-godot-parity`. Emit `<promise>GODOT-PARITY</promise>`.

---

## Notes for the loop

- **TDD discipline**: failing test first, implement, gates, commit. No skipping the test step.
- **All five build gates + perf-gates pass before check-off.**
- **Drift safeguards**: NEEDS_HUMAN_REVIEW promise if 3+ consecutive blocked, or tests fail at HEAD start, or perf gate exceeded by >50 KB beyond ceiling.
- **Architectural fence**: still no buttons in Phaser canvas; no raw `useRunStore.setState` in feature code.
- **Skip BLOCKED items** (mark `🚧 BLOCKED: <reason>` and move on).
- **Total estimate**: ~32 tasks × 15-30 min each = ~12-16 hours of loop time. Max iterations 400.
