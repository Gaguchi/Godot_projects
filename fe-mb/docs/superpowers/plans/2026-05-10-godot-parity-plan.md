# Godot Parity Plan

> **Spec:** `docs/superpowers/specs/2026-05-10-godot-parity-design.md`
> **Loop prompt:** `docs/superpowers/plans/2026-05-10-godot-parity-loop-prompt.md`
> **Promise tag:** `<promise>GODOT-PARITY</promise>`

**Goal:** Port the Godot fe-mb's overworld + dungeon + quest + town content to phaser, remove the unused equipment scaffolding, ship multi-region travel with per-hop food.

**Architecture:** Subtractive equipment removal + content authoring + thin system wiring. No new architectural invariants. Existing UI wrappers, Phaser BoardScene, Zustand stores stay as-is.

**Tech Stack:** TypeScript 5.6 strict, React 19, Phaser 4.1, Vite 8, Vitest, Playwright, Zustand 5, Zod, Tailwind v4, react-aria-components, framer-motion.

---

## File structure

**New files:**
```
phaser/scripts/convert-dialogue.mjs                          // Godot→phaser dialogue JSON converter
phaser/src/domain/region.ts                                  // Region type
phaser/src/domain/town.ts                                    // TownDef
phaser/src/domain/encounter.ts                               // EncounterEntry, EnemyGroup
phaser/src/data/schemas/region.ts
phaser/src/data/schemas/town.ts
phaser/src/data/schemas/encounter.ts
phaser/src/data/schemas/dungeonDef.ts
phaser/src/systems/encounterRoller.ts                        // weighted, predicate-filtered roll
phaser/src/systems/overworldPath.ts                          // BFS path + cost
phaser/src/systems/encounterDifficulty.ts                    // region-tier scaling
phaser/src/ui/modals/DialogueModal.tsx                       // dialogue UI
phaser/src/ui/modals/StatCheckModal.tsx                      // stat-check rolls
phaser/src/ui/screens/CampScene.tsx                          // rest/scout panel
phaser/src/ui/screens/town/InnPanel.tsx                      // extracted from TownScene
phaser/src/ui/screens/town/ShopPanel.tsx
phaser/src/ui/screens/town/TavernPanel.tsx
phaser/src/ui/components/MapBackground.tsx                   // region-tinted gradient
phaser/src/data/content/quests/blood_ties.json
phaser/src/data/content/dialogue/{8 trees}.json
phaser/src/data/content/towns/{5 towns}.json
phaser/src/data/content/encounters/{borderlands_road,thornwood_path,ashfall_track}.json
phaser/src/data/content/enemyGroups/{bandits,wolves,brigands,darens_gang}.json
phaser/src/data/content/overworld/{borderlands,thornwood,ashfall}.json
phaser/src/data/content/dungeons/{smugglers_cave,iron_mine,thornwood_depths,ancient_ruins,obsidian_cavern}.json
phaser/src/data/content/regions.json
phaser/tests/unit/* — companion tests for each system
```

**Modified files:**
```
phaser/src/domain/unit.ts                       — drop HandSlots
phaser/src/domain/item.ts                       — kind: 'food'|'potion' only
phaser/src/data/schemas/item.ts                 — match
phaser/src/data/schemas/unit.ts                 — drop hand
phaser/src/state/runStore.ts                    — drop equipHand, add startDialogue/endDialogue/applyQuestEffects/consumeFoodPerHop/markEncounterFired/restAtCamp/enterMap
phaser/src/contracts/crossStoreActions.ts       — drop loot
phaser/src/contracts/domainEvents.ts            — drop ItemAcquired
phaser/src/domain/quest.ts                      — extend QuestEffect; drop grantItem
phaser/src/data/schemas/quest.ts                — match
phaser/src/domain/predicate.ts                  — drop hasItem
phaser/src/data/schemas/predicate.ts            — match
phaser/src/systems/predicates.ts                — drop hasItem case; add new predicate kinds for encounter conditions
phaser/src/systems/battleResolver.ts            — drop loot
phaser/src/systems/questRunner.ts               — wire into runStore dispatch
phaser/src/data/content/items.json              — consumables only
phaser/src/data/content/cards.json              — drop weaponType (taxonomy)
phaser/src/domain/card.ts                       — drop WeaponType
phaser/src/persistence/{save,saveFormat,load}.ts — bump SAVE_VERSION
phaser/src/persistence/contentAliases.ts        — drop itemId
phaser/src/data/load.ts                         — drop items, add new content kinds
phaser/src/ui/screens/TownScene.tsx             — refactor to townId prop + extract panels
phaser/src/ui/screens/OverworldScene.tsx        — multi-hop, food cost preview, encounter roller
phaser/src/ui/screens/DungeonScene.tsx          — drop setState bypass, use restParty
phaser/src/procgen/dungeonGenerator.ts          — add shop+treasure to weights, row-band rules
phaser/src/game/scenes/seedStubBattle.ts        — drop hand: { left, right }
phaser/src/App.tsx                              — mount DialogueModal, prologue trigger
phaser/CONTEXT.md                               — drift updates
phaser/tests/unit/* — drop hand fixtures
```

**Deleted files:**
```
phaser/src/systems/deckBuilder.ts               — dead code
phaser/tests/unit/systems/deckBuilder.test.ts
```

---

## Phase A — Equipment removal (subtractive)

### A-1: Trim items.json + Item domain to consumables only

**Files:**
- Modify: `phaser/src/data/content/items.json`
- Modify: `phaser/src/domain/item.ts`
- Modify: `phaser/src/data/schemas/item.ts`

**TDD:**
- [ ] Update `tests/unit/data/content.test.ts` to assert `items.json` contains only `kind: 'food' | 'potion'`. Run — fails.
- [ ] Edit `domain/item.ts`: change `ItemKind` to `'food' | 'potion'`. Drop `WeaponType`, sharpness, might fields.
- [ ] Edit `data/schemas/item.ts` to match.
- [ ] Edit `items.json`: keep `food_rations`, add `healing_potion` (small heal item, 30g, gridSize 1×1, kind potion), `power_elixir` (temp +AP, 80g). Remove all weapons/armor/tomes/staves.
- [ ] Run gates: typecheck + unit + e2e + build.
- [ ] Commit `[GP-A1] trim items to consumables only`.

### A-2: Drop HandSlots from Unit + all unit fixtures

**Files:**
- Modify: `phaser/src/domain/unit.ts`
- Modify: `phaser/src/data/schemas/unit.ts`
- Modify: `phaser/src/game/scenes/seedStubBattle.ts`
- Modify: 13 test files with `hand: { left: null, right: null }` fixtures

**TDD:**
- [ ] Run typecheck — currently passes.
- [ ] Edit `domain/unit.ts`: delete `HandSlots` interface and `hand` field from `Unit`.
- [ ] Edit `schemas/unit.ts`: remove `hand` from UnitSchema.
- [ ] Edit `seedStubBattle.ts`: remove `hand: { left: null, right: null }`.
- [ ] Grep `hand: { left:` and remove from each test file. Use `grep -rln "hand: { left:" phaser` to enumerate.
- [ ] Run gates. All five must pass.
- [ ] Commit `[GP-A2] remove HandSlots from Unit`.

### A-3: Drop deckBuilder.ts + dead test

**Files:**
- Delete: `phaser/src/systems/deckBuilder.ts`
- Delete: `phaser/tests/unit/systems/deckBuilder.test.ts`

**TDD:**
- [ ] Confirm no callers: `grep -rn "buildDeck\|deckBuilder" phaser/src` — should be empty after removal.
- [ ] Delete both files.
- [ ] Run gates.
- [ ] Commit `[GP-A3] delete dead deckBuilder`.

### A-4: Drop equipHand + ItemAcquired + grantItem + hasItem

**Files:**
- Modify: `phaser/src/state/runStore.ts` — delete `equipHand` action handler + type union member.
- Modify: `phaser/src/contracts/domainEvents.ts` — drop `ItemAcquired`.
- Modify: `phaser/src/domain/quest.ts` — drop `'ItemAcquired'` from `QuestListenerEvent`, drop `grantItem` from QuestEffect.
- Modify: `phaser/src/data/schemas/quest.ts` — drop `grantItem` discriminator.
- Modify: `phaser/src/domain/predicate.ts` — drop `hasItem`.
- Modify: `phaser/src/data/schemas/predicate.ts` — drop `hasItem` literal.
- Modify: `phaser/src/systems/predicates.ts` — drop case.
- Modify: `phaser/tests/unit/systems/predicates.test.ts` — drop hasItem cases + inventory.items fixture.

**TDD:**
- [ ] Update predicates test: remove `hasItem` and add a placeholder for an upcoming `flagSet` predicate (already exists — keep).
- [ ] Edit each domain/schema/system file as listed.
- [ ] Run typecheck — should report all dead references caught.
- [ ] Run gates.
- [ ] Commit `[GP-A4] drop equipHand, ItemAcquired, grantItem, hasItem`.

### A-5: Drop loot from BattleResult + battleResolver

**Files:**
- Modify: `phaser/src/contracts/crossStoreActions.ts` — drop `loot` from `BattleResult`.
- Modify: `phaser/src/systems/battleResolver.ts` — drop `loot: []` line.
- Modify: `phaser/src/state/runStore.ts:applyBattleResult` — drop `r.loot.map(...)` block.
- Modify: `tests/unit/systems/battleResolver.test.ts` — drop loot assertions.
- Modify: `tests/unit/state/runStore.test.ts` — drop loot in applyBattleResult fixture.

**TDD:**
- [ ] Edit each file. Run gates.
- [ ] Commit `[GP-A5] drop loot from BattleResult`.

### A-6: Bump SAVE_VERSION + drop hand/loot from save schema

**Files:**
- Modify: `phaser/src/persistence/saveFormat.ts` — `SAVE_VERSION = '0.6.0-cards-only'`. Drop `hand` from unit serialization. Drop `loot`/`itemId` aliases.
- Modify: `phaser/src/persistence/load.ts` — Zod schema sans hand/loot.
- Modify: `phaser/src/persistence/save.ts` — sans hand serialization.
- Modify: `phaser/src/persistence/contentAliases.ts` — drop `itemId` from ContentAliases.
- Modify: `phaser/src/data/load.ts` — drop `items` from ContentBundle... wait, items still exist (consumables). Keep items but ensure schema matches the new slim Item type.

**TDD:**
- [ ] Update tests/unit/persistence/{saveLoad,replay}.test.ts to match new shape.
- [ ] Run gates.
- [ ] Commit `[GP-A6] SAVE_VERSION 0.6.0-cards-only; drop hand+loot from save schema`.

---

## Phase B — Quest engine + dialogue infrastructure

### B-1: Extend QuestEffect with resource deltas + statCheck

**Files:**
- Modify: `phaser/src/domain/quest.ts` — extend `QuestEffect` union with: `addGold { amount }`, `addFood { amount }`, `damageParty { amount }`, `healParty { percent }`, `statCheck { stat: 'str'|'mag'|'skl'|'spd'|'lck', threshold, successEffects, failEffects }`.
- Modify: `phaser/src/data/schemas/quest.ts` — match.

**TDD:**
- [ ] Add unit tests in `tests/unit/systems/questRunner.test.ts` for each new effect kind. Run — fails.
- [ ] Implement effect handling in questRunner.ts.
- [ ] Run gates.
- [ ] Commit `[GP-B1] extend QuestEffect with resource deltas + statCheck`.

### B-2: Wire questRunner into runStore.dispatch + applyQuestEffects action

**Files:**
- Modify: `phaser/src/state/runStore.ts` — add `applyQuestEffects { effects }` action that handles all QuestEffect kinds via a single switch.
- Modify: `phaser/src/state/runStore.ts` — wrap existing reducers so post-dispatch, runStore calls `onDomainEvent(event, engine, state)` and applies the returned effects via `applyQuestEffects`.

**TDD:**
- [ ] Add test: dispatching a domain event that questRunner watches results in QuestEffect application.
- [ ] Implement the wrap.
- [ ] Run gates.
- [ ] Commit `[GP-B2] wire questRunner into runStore dispatch`.

### B-3: Build DialogueModal + StatCheckModal + startDialogue action

**Files:**
- Create: `phaser/src/ui/modals/DialogueModal.tsx`
- Create: `phaser/src/ui/modals/StatCheckModal.tsx`
- Create: `phaser/tests/unit/ui/modals/DialogueModal.test.tsx`
- Modify: `phaser/src/state/runStore.ts` — add `pendingDialogue` field, `startDialogue` and `endDialogue` actions.
- Modify: `phaser/src/App.tsx` — mount `<DialogueModal>` at root.

**TDD:**
- [ ] Test: startDialogue → modal renders with first node text.
- [ ] Test: clicking choice fires effects and advances to next node.
- [ ] Test: stat-check rolls reveal success/fail branch.
- [ ] Implement DialogueModal using `<Dialog>` + `<Button>` from src/ui/components.
- [ ] Run gates.
- [ ] Commit `[GP-B3] DialogueModal + startDialogue/endDialogue`.

### B-4: Build Godot→phaser dialogue converter script

**Files:**
- Create: `phaser/scripts/convert-dialogue.mjs`

**Behavior:** Takes path to a Godot dialogue JSON, emits a phaser-shaped JSON (DialogueTree). Maps `effects: { type: 'add_gold', amount: 50 }` → phaser `{ kind: 'addGold', amount: 50 }`. Maps `next` line refs to node ids. Maps `stat_check` to phaser `statCheck`.

**TDD:**
- [ ] Round-trip test: convert `prologue.json` from Godot path; assert resulting JSON parses against phaser `DialogueTreeSchema`.
- [ ] Implement converter.
- [ ] Commit `[GP-B4] dialogue converter script`.

### B-5: Port 8 dialogues + Blood Ties quest

**Files:**
- Run converter on each Godot dialogue → emit `phaser/src/data/content/dialogue/*.json`.
- Hand-author `phaser/src/data/content/quests/blood_ties.json` from Godot quest_definitions.json.
- Modify: `phaser/src/data/load.ts` — register new content bundles.

**TDD:**
- [ ] Test: each dialogue parses against schema.
- [ ] Test: blood_ties quest parses; questRunner accepts it; transitions advance correctly on synthetic events.
- [ ] Commit `[GP-B5] port 8 dialogues + Blood Ties`.

---

## Phase C — Travel encounters + per-hop food

### C-1: Add Region domain + regions.json

**Files:**
- Create: `phaser/src/domain/region.ts` — `Region { id, name, color, tier }`.
- Create: `phaser/src/data/schemas/region.ts`.
- Create: `phaser/src/data/content/regions.json` — borderlands (tier 1), thornwood (tier 2), ashfall (tier 3).
- Modify: `phaser/src/data/load.ts` — register.

**TDD:**
- [ ] Test: regions.json parses against schema.
- [ ] Commit `[GP-C1] Region domain + regions.json`.

### C-2: EncounterEntry + EnemyGroup domain + schemas

**Files:**
- Create: `phaser/src/domain/encounter.ts`
- Create: `phaser/src/data/schemas/encounter.ts`

**TDD:**
- [ ] Test: schemas parse fixture data.
- [ ] Commit `[GP-C2] encounter domain types + schemas`.

### C-3: encounterRoller system

**Files:**
- Create: `phaser/src/systems/encounterRoller.ts` — `rollEncounter(table: EncounterTable, predicateState: PredicateState, oneShotsFired: Set<string>, rng: RNG): EncounterOutcome | null`.
- Create: `phaser/tests/unit/systems/encounterRoller.test.ts`.

**TDD:**
- [ ] Test: filters by predicate; returns null if no eligible entries.
- [ ] Test: weighted pick is deterministic for given RNG.
- [ ] Test: one-shot tracking excludes fired entries.
- [ ] Implement.
- [ ] Commit `[GP-C3] encounterRoller`.

### C-4: Port travel_events.json + enemy_groups.json

**Files:**
- Create: `phaser/src/data/content/encounters/borderlands_road.json` — port from Godot `data/events/travel_events.json` (filter to borderlands or unconditional).
- Create: `phaser/src/data/content/encounters/thornwood_path.json` — placeholder (3 entries).
- Create: `phaser/src/data/content/encounters/ashfall_track.json` — placeholder.
- Create: `phaser/src/data/content/enemyGroups/{bandits,wolves,brigands,darens_gang}.json` — port from Godot `enemy_groups.json`.
- Modify: `phaser/src/data/load.ts` — register.

**TDD:**
- [ ] Test: each file parses against its schema.
- [ ] Test: encounter pool resolves enemy_groups by reference.
- [ ] Commit `[GP-C4] port travel events + enemy groups`.

### C-5: Wire OverworldScene to encounterRoller + dialogue branching

**Files:**
- Modify: `phaser/src/ui/screens/OverworldScene.tsx` — replace hardcoded 30% chance with encounterRoller; on dialogue outcome dispatch `startDialogue`; on battle outcome dispatch combat seed.
- Modify: `phaser/src/state/runStore.ts` — add `markEncounterFired`, `oneShotsFired: Set<string>`.

**TDD:**
- [ ] Test: handleNodeClick triggers roller with correct table for current edge.
- [ ] Test: dialogue outcome opens modal; battle outcome routes to combat.
- [ ] Test: one-shot encounters don't re-fire.
- [ ] Commit `[GP-C5] wire encounter roller into overworld travel`.

### C-6: Per-hop food consumption + starvation damage

**Files:**
- Modify: `phaser/src/state/runStore.ts` — add `consumeFoodPerHop` action; on call, decrement first food_rations item by one charge; when 0, deal 3 HP starvation damage to each living party member, emit `Notification` event.
- Modify: `phaser/src/ui/screens/OverworldScene.tsx` — call after each successful arrival.
- Modify: HUD: show food count + "starving" indicator when food = 0.

**TDD:**
- [ ] Test: consumeFoodPerHop with food > 0 decrements food only.
- [ ] Test: with food = 0 deals damage; emits notification.
- [ ] Test: travel from A→B→C consumes 2 food.
- [ ] Commit `[GP-C6] per-hop food + starvation`.

---

## Phase D — Multi-region overworld

### D-1: Port Godot overworld.json into 3 region maps

**Files:**
- Create: `phaser/src/data/content/overworld/borderlands.json`
- Create: `phaser/src/data/content/overworld/thornwood.json`
- Create: `phaser/src/data/content/overworld/ashfall.json`
- Modify: `phaser/src/domain/map.ts` — extend `WorldMap` with `regionId`. Add `MapEdge { fromMapId, fromNodeId, toMapId, toNodeId }`.
- Modify: `phaser/src/data/schemas/map.ts` — match.
- Modify: `phaser/src/data/load.ts` — register all three.

**TDD:**
- [ ] Test: each map parses + has expected node count (~17 borderlands, ~17 thornwood, ~12 ashfall).
- [ ] Commit `[GP-D1] port Godot overworld → 3 region maps`.

### D-2: BFS pathfinding + multi-hop click

**Files:**
- Create: `phaser/src/systems/overworldPath.ts` — `findPath(map: WorldMap, from: NodeId, to: NodeId): NodeId[] | null`. BFS over `map.edges`.
- Create: `phaser/tests/unit/systems/overworldPath.test.ts`.
- Modify: `phaser/src/ui/screens/OverworldScene.tsx` — click on non-adjacent node computes path; show path preview; travel hop-by-hop with encounter roll on each.

**TDD:**
- [ ] Test: BFS finds shortest path; returns null when unreachable.
- [ ] Test: multi-hop travel rolls encounter on each hop.
- [ ] Commit `[GP-D2] multi-hop pathfinding + travel`.

### D-3: Hover tooltip with hop count + food cost preview

**Files:**
- Modify: `phaser/src/ui/screens/OverworldScene.tsx` — on hover, compute path from current to hovered; display tooltip with hop count + food cost; color red/amber/parchment by affordability.

**TDD:**
- [ ] Test: hover on adjacent node shows "1 hop, 1 food".
- [ ] Test: hover on far node shows full path cost.
- [ ] Commit `[GP-D3] hover preview tooltip`.

### D-4: enterMap action + region transitions

**Files:**
- Modify: `phaser/src/state/runStore.ts` — add `enterMap { mapId }` action. Update `worldPosition.mapId`.
- Modify: `phaser/src/data/content/overworld/*.json` — each map has `regionEdges` to neighbors.
- Modify: `phaser/src/ui/screens/OverworldScene.tsx` — recognize edge-of-map crossings; dispatch `enterMap` + `arriveAtNode`.

**TDD:**
- [ ] Test: traversing a region edge updates `worldPosition.mapId`.
- [ ] Test: questRunner sees `LocationArrived` event with new map.
- [ ] Commit `[GP-D4] map-to-map transitions`.

### D-5: Region-tinted MapBackground

**Files:**
- Create: `phaser/src/ui/components/MapBackground.tsx` — radial gradient using current region's color.
- Modify: `phaser/src/ui/screens/OverworldScene.tsx` — wrap with `<MapBackground regionId={...}>`.

**TDD:**
- [ ] Test: rendering with regionId='borderlands' applies the borderlands color from regions.json.
- [ ] Commit `[GP-D5] region-tinted MapBackground`.

### D-6: Dynamic quest nodes (insert/remove on quest stage)

**Files:**
- Modify: `phaser/src/domain/map.ts` — `WorldMap.nodes` becomes mutable; `dynamicNodes: { id, mapId, nodeData, sourceQuestId }[]` tracked separately on runStore.
- Modify: `phaser/src/state/runStore.ts` — add `spawnQuestNode { mapId, node }`, `removeQuestNode { nodeId }`.
- Modify: `phaser/src/systems/questRunner.ts` — on stage transition with `spawnNode` effect, dispatch `spawnQuestNode`.

**TDD:**
- [ ] Test: advancing to find_daren stage spawns Daren's Camp node on borderlands map.
- [ ] Test: advancing past resolution removes the node.
- [ ] Commit `[GP-D6] dynamic quest nodes`.

---

## Phase E — Town content + panels

### E-1: TownDef domain + schema

**Files:**
- Create: `phaser/src/domain/town.ts` — `TownDef { id, name, regionId, healCostPerUnit, shopStockIds, rumors, tavernQuests, blacksmithEnabled, arenaLocked }`.
- Create: `phaser/src/data/schemas/town.ts`.

**TDD:**
- [ ] Test: schema parses fixture data.
- [ ] Commit `[GP-E1] TownDef domain + schema`.

### E-2: Port 5 town JSONs

**Files:**
- Create: `phaser/src/data/content/towns/{pine_crossing,riverside_market,south_junction,borderkeep_castle,northern_bridge}.json` from Godot `data/towns/*.json`.
- Modify: `phaser/src/data/load.ts` — register.

**TDD:**
- [ ] Test: each file parses; sum of shop stock items match Godot reference; tavern rumors are non-empty.
- [ ] Commit `[GP-E2] port 5 town JSONs`.

### E-3: Extract InnPanel + ShopPanel + TavernPanel

**Files:**
- Create: `phaser/src/ui/screens/town/InnPanel.tsx`
- Create: `phaser/src/ui/screens/town/ShopPanel.tsx`
- Create: `phaser/src/ui/screens/town/TavernPanel.tsx`
- Modify: `phaser/src/ui/screens/TownScene.tsx` — take `townId: TownId` prop, load TownDef, render the three panels.
- Modify: `phaser/src/App.tsx` — pass `townId` based on current node.

**TDD:**
- [ ] Test (DOM): TownScene with townId='riverside_market' shows correct heal cost.
- [ ] Test: TavernPanel shows dialogue-driven quest accept (not hardcoded).
- [ ] Commit `[GP-E3] extract town panels + townId routing`.

### E-4: CampScene for camp nodes

**Files:**
- Create: `phaser/src/ui/screens/CampScene.tsx` — Rest (heal 20%, 1 food) / Scout (stub) / Leave.
- Modify: `phaser/src/state/runStore.ts` — add `restAtCamp { healPercent, foodCost }`.
- Modify: `phaser/src/App.tsx` — route camp nodes to CampScene.
- Modify: `phaser/src/ui/screens/OverworldScene.tsx` — onEnterCamp callback.

**TDD:**
- [ ] Test: clicking Rest deducts 1 food, heals 20% to all wounded.
- [ ] Commit `[GP-E4] CampScene + restAtCamp`.

### E-5: Tavern → DialogueModal accept flow

**Files:**
- Modify: `phaser/src/ui/screens/town/TavernPanel.tsx` — replace hardcoded quest button with iteration over `tavernQuests`. Each quest entry shows NPC name + dialogue trigger.
- Wire: clicking "Talk to NPC" dispatches `startDialogue { dialogueId: questEntry.dialogueId }`.

**TDD:**
- [ ] Test: tavern shows configured quests; clicking one opens dialogue modal.
- [ ] Test: dialogue choice "accept" advances quest stage.
- [ ] Commit `[GP-E5] tavern → DialogueModal flow`.

---

## Phase F — Dungeon parity

### F-1: Dungeon-def schema + 5 dungeon JSONs

**Files:**
- Create: `phaser/src/domain/dungeon.ts` — `DungeonDef { id, name, regionId, floors, theme, bossEnemyGroupId, eliteEnemyGroupId, combatEnemyGroupId }`.
- Create: `phaser/src/data/schemas/dungeonDef.ts`.
- Create: `phaser/src/data/content/dungeons/{smugglers_cave,iron_mine,thornwood_depths,ancient_ruins,obsidian_cavern}.json`.
- Modify: `phaser/src/data/load.ts` — register.

**TDD:**
- [ ] Test: each dungeon JSON parses; references valid enemy groups.
- [ ] Commit `[GP-F1] dungeon-def schema + 5 dungeons`.

### F-2: Add shop + treasure to ROOM_WEIGHTS with row-band rules

**Files:**
- Modify: `phaser/src/procgen/dungeonGenerator.ts` — `ROOM_WEIGHTS` becomes row-band-aware: row 0 forced combat, row 1 no elite/rest, mid rows include shop+treasure (~10% / ~15%), row N-1 = rest, last row = boss. Mirror Godot `dungeon_generator.gd` logic.
- Modify: `phaser/tests/unit/procgen/dungeonGenerator.test.ts` — assert all 7 room types appear in 100 sample runs.

**TDD:**
- [ ] Test fails on current weights.
- [ ] Implement row-band rules.
- [ ] Test passes.
- [ ] Commit `[GP-F2] dungeon procgen row-band weights`.

### F-3: restParty reducer + remove DungeonScene setState bypass

**Files:**
- Modify: `phaser/src/state/runStore.ts` — add `restParty { percent }` action.
- Modify: `phaser/src/ui/screens/DungeonScene.tsx` — replace direct `useRunStore.setState((s) => ...)` with `dispatchRun({ type: 'restParty', payload: { percent: 0.3 } })`.

**TDD:**
- [ ] Test: restParty heals each unit by `floor(maxHp * percent)` capped at maxHp.
- [ ] Commit `[GP-F3] restParty reducer + cleanup DungeonScene chokepoint violation`.

### F-4: seedDungeonBattle + multi-dungeon dispatch

**Files:**
- Create: `phaser/src/game/scenes/seedDungeonBattle.ts` — `seedDungeonBattle(dungeonId, roomType, runRng): CombatEvent`. Looks up DungeonDef → enemy group → expands to units with region-tier scaling.
- Modify: `phaser/src/game/scenes/BoardScene.ts` — when entering combat from a dungeon room, call seedDungeonBattle instead of seedStubBattle.
- Modify: `phaser/src/state/runStore.ts:enterDungeon` — accepts `dungeonId` so DungeonScene reads it from the clicked node.
- Modify: `phaser/src/ui/screens/OverworldScene.tsx` — pass dungeonId from clicked node into enterDungeon.

**TDD:**
- [ ] Test: smugglers_cave boss room seeds a battle with Smugglers boss enemy group.
- [ ] Test: iron_mine combat room seeds with iron_mine.combatEnemyGroup.
- [ ] Commit `[GP-F4] seedDungeonBattle + multi-dungeon`.

---

## Phase G — Integration + visual playthrough

### G-1: Prologue trigger on first new game

**Files:**
- Modify: `phaser/src/App.tsx` — on `view==='overworld'` and `runStore.flags.has('prologue_seen') === false`, dispatch `startDialogue { dialogueId: 'prologue' }` then `setFlag prologue_seen=true`.

**TDD:**
- [ ] Test (e2e): new game → overworld → prologue dialogue plays → close → overworld interactive.
- [ ] Commit `[GP-G1] prologue trigger`.

### G-2: CONTEXT.md update + perf-gates re-baseline

**Files:**
- Modify: `phaser/CONTEXT.md` — drop `inventory.bagGrid` row; drop `equipHand`/`moveItemInBag` from action catalog (moveItemInBag stays for consumables); drop `loot` from BattleResult; drop `hasItem`/`ItemAcquired`/`grantItem`; add Region/TownDef/EncounterEntry to domain section; add new actions (startDialogue, applyQuestEffects, consumeFoodPerHop, restAtCamp, enterMap, markEncounterFired).
- Modify: `phaser/scripts/measure-bundle.mjs` — bump `BASELINE_KB` if perf-gates fail; document in commit.

**TDD:**
- [ ] Run `npm run check-context-doc` — drift check passes.
- [ ] Run `npm run perf-gates` — passes (or rebaseline if content authoring pushed past +75 KB legitimately).
- [ ] Commit `[GP-G2] CONTEXT.md update + perf rebaseline`.

### G-3: Final visual playthrough + tag

**Steps:**
- Start dev server. Navigate via Playwright MCP through:
  1. Title → New Game → prologue dialogue plays.
  2. Overworld in Borderlands; hover on far node shows path + food cost.
  3. Travel triggers a dialogue encounter (Road Merchant) → close.
  4. Travel triggers a battle encounter (Bandits) → win → return to overworld.
  5. Enter Pine Crossing → Inn (heal) → Shop (buy potion) → Tavern (accept Blood Ties).
  6. Travel to Frontier Camp → CampScene → Rest → cost 1 food.
  7. Enter Smuggler's Cave → boss room → win → exit dungeon.
  8. Cross to Thornwood region → MapBackground tints differently.
  9. Reach EXIT (Iron Throne) → end-of-run screen.
- Capture screenshots at each step.
- Final gates: typecheck, unit, e2e, check-context-doc, build, perf-gates.
- Tag `phaser-godot-parity`.
- Emit `<promise>GODOT-PARITY</promise>`.
- Commit `[GP-G3] visual playthrough + tag`.

---

## Self-review

- **Spec coverage:** Every spec section has a phase. Equipment removal = Phase A; quest+dialogue = B; encounters+food = C; multi-region overworld = D; towns+panels = E; dungeon = F; integration = G.
- **Type consistency:** `TownDef`, `Region`, `EncounterEntry`, `EnemyGroup`, `DungeonDef` all introduced in named tasks before being consumed.
- **Placeholder scan:** No "TBD"/"TODO" in this plan; placeholder content (thornwood/ashfall encounters with 3 entries) is intentional and documented.
- **Test coverage:** Every system task has at least one unit test step. UI tasks have either component-level vitest test or e2e test.
- **Realistic time:** ~32 tasks × 15-30 min each = ~12-16 hours of loop time. Leaving ample iterations (max 400) on the loop.

---

*Plan derived from `2026-05-10-godot-parity-design.md` and 4 audit reports. Existing UI wrappers + Phaser BoardScene from UI-input-overhaul stay; this is purely content + system wiring + subtractive cleanup.*
