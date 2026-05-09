# Godot Parity Pass Progress

> **Spec:** `docs/superpowers/specs/2026-05-10-godot-parity-design.md`
> **Plan:** `docs/superpowers/plans/2026-05-10-godot-parity-plan.md`
> **Loop prompt:** `docs/superpowers/plans/2026-05-10-godot-parity-loop-prompt.md`
> **Promise tag:** `<promise>GODOT-PARITY</promise>` — emit only when all done criteria from the spec hold.

Each iteration completes ONE task end-to-end (TDD: failing test → implementation → all gates green → commit → check off).

---

## Phase A — Equipment removal (subtractive)

- [x] **GP-A1** Trim `items.json` + Item domain to `kind: 'food' | 'potion'` only. ✅ items.json now 3 entries (food_rations, healing_potion, power_elixir). Item type stripped of WeaponType, gearCards, quiverModifier, isTwoHanded, range. Schema matches.
- [x] **GP-A2** Drop `HandSlots` from `Unit` + remove fixtures. ✅ HandSlots interface deleted. seedStubBattle and 9 test files cleaned via sed. Combined with the runStore equipHand drop (planned A4) since equipHand referenced unit.hand.
- [x] **GP-A3** Delete `systems/deckBuilder.ts` + dead test (no callers). ✅ Combined with A1 since A1's typecheck depended on A3's deletion (deckBuilder consumed `Item.gearCards`).
- [x] **GP-A4** Drop `ItemAcquired` event, `grantItem` quest effect, `hasItem` predicate. ✅ equipHand was already gone in A2. Domain types + Zod schemas + questRunner table + predicate eval all updated. 179 tests pass (was 180; -1 from hasItem test).
- [x] **GP-A5** Drop `loot` field from `BattleResult`. ✅ contracts/crossStoreActions.ts, battleResolver.ts (drop loot:[]), runStore.applyBattleResult (drop r.loot.map block) all clean. ItemId import dropped from contracts.
- [x] **GP-A6** SAVE_VERSION bumped to '0.6.0-cards-only'. ✅ partyUnits is z.array(z.unknown()) so no schema change needed for unit.hand removal — Zod just accepts whatever shape. inventoryItems retained for consumables. itemId alias kept (still resolves food_rations/healing_potion/power_elixir). Phase A (equipment removal) complete.

## Phase B — Quest engine + dialogue infrastructure

- [x] **GP-B1** QuestEffect union extended. ✅ addGold, addFood, damageParty, healParty, statCheck (with nested success/fail) added. Zod schema uses z.lazy for recursion. StatKind type ('str'|'mag'|'skl'|'spd'|'def'|'res'|'lck'). 6 unit tests cover each kind. CONTEXT.md updated for SAVE_VERSION + StatKind.
- [x] **GP-B2** `applyQuestEffects` action + `predicateStateFromRun` helper. ✅ Handler dispatches each QuestEffect kind: addGold/addFood/damageParty/healParty mutate state directly; setFlag uses flag store; completeQuest sets stage to __complete__; startDialogue sets pendingDialogue; statCheck recurses into success/fail. recruitUnit/spawnNode/unlockNode are stubs (concrete wiring lands in B5/D6/E5). 8 unit tests cover each kind. Domain-event subscription scaffolding deferred to B5 when actual quest content drives the bus.
- [x] **GP-B3** DialogueModal + dialogueRegistry. ✅ Modal reads pendingDialogue from runStore + tree from registry, renders speaker/text/predicate-filtered choices. Choice click fires applyQuestEffects + advances to step.nextNodeId or endDialogue. 5 component tests cover null/missing/render/end-on-leave/effects-fire. Mounted at App root. StatCheckModal not separately needed — statCheck handled inline by applyQuestEffect.
- [x] **GP-B4** `scripts/convert-dialogue.mjs` Godot→phaser converter. ✅ Maps set_flag, add_gold, add_food, damage_party, heal_party, start_quest, advance_quest (with QUEST_STAGE_MAP), complete_quest, start_combat, recruit_unit, give_item, has_gold/has_flag/not_flag conditions. Stat checks become DialogueBranch on the choice's next field.
- [x] **GP-B5** 8 dialogues + Blood Ties quest ported. ✅ All 8 trees pass DialogueTreeSchema. Blood Ties JSON has find_daren / daren_resolved / __complete__ stages with FlagSet listeners on daren_captured/daren_killed. Domain extended with DialogueBranch + advanceQuestStage/startCombat QuestEffect kinds + StatKind. Phase B complete.

## Phase C — Travel encounters + per-hop food

- [x] **GP-C1** Region domain + schema + 3 regions ported. ✅ f07e248. borderlands/thornwood/ashfall tier 1/2/3.
- [x] **GP-C2** Encounter domain + schemas. ✅ 9fccf32. EncounterEntry/Table, EnemyGroup, EncounterOutcome, CaptureTarget, EnemyGroupMember. asEncounterId.
- [x] **GP-C3** encounterRoller.ts. ✅ 9fccf32. Weighted + predicate-filtered + one-shot tracking. 6 deterministic-RNG tests.
- [x] **GP-C4** 3 encounter tables + 4 enemy groups ported. ✅ 9fccf32. borderlands_road has full 7 Godot entries; thornwood/ashfall placeholders.
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
