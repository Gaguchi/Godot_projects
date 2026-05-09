# FE_MB Godot Parity Pass — Design Spec

**Date:** 2026-05-10
**Author:** Claude Opus 4.7 + 4 audit agents
**Supersedes:** equipment-card portions of `2026-03-29-ship-plan-design.md`
**Status:** Approved (user directive: "use proper foundations and don't cut corners")

## Goals

Bring the phaser/ TypeScript port to feature parity with the legacy Godot fe-mb game across four systems, plus a deliberate simplification:

1. **Equipment removal** — delete the weapons/armor/sharpness scaffolding that was never wired into combat. Keep a slim `Item` type for consumables only (food rations, potions).
2. **Quest engine + Dialogue UI** — wire the existing `questRunner` into the store dispatch chain; build a `DialogueModal` UI; port all 8 Godot dialogues + Blood Ties quest content.
3. **Travel encounters + per-hop food** — port Godot's `EventManager` (weighted dialogue/battle pool) into a phaser `encounterRoller`; consume 1 food per overworld hop with starvation damage when food = 0.
4. **Multi-region overworld** — port the full `overworld.json` (46 nodes, 3 regions, 5 towns, 5 dungeons, 1 exit) and add multi-map travel.
5. **Town content + panels** — `TownDef` schema, 5 town JSONs, extract town panels into separate components, add `CampScene` for camp nodes.
6. **Dungeon parity** — add `shop`/`treasure` to procgen weights, multi-dungeon JSON, `restParty` reducer (drop the `setState` chokepoint violation).

Done promise: `<promise>GODOT-PARITY</promise>` after the visual playthrough confirms all six systems work end-to-end and all five build gates plus the bundle perf gate are green.

## User-confirmed scope decisions

| Decision | Value | Source |
|---|---|---|
| Inventory | Keep consumables (food, potions) — no weapons/armor | user, 2026-05-10 |
| Food per hop | Keep — 1 food per hop, starvation = HP damage when 0 | user |
| Map scope | Multi-region with map-to-map travel | user |

## Non-goals

- Combat math changes (cards already work; no weapon-might needed).
- Visual asset overhaul. Tile-based terrain rendering deferred — Godot's *live* campaign uses node-graph only too.
- Quest-gated dungeons (missing in Godot too — cross-codebase TODO).
- Steam/console packaging. Ship to web only.

## Architecture

The existing phaser foundation already has the right shapes; the work is content + wiring. No new architectural invariants introduced. All UI continues to live in React DOM via `src/ui/components/` wrappers (per `2026-05-09-ui-input-overhaul-design.md`); Phaser remains BoardScene-only.

### New systems

- `src/systems/encounterRoller.ts` — predicate-filtered, weighted random pick over an `EncounterTable`. Returns either `{ type: 'dialogue', dialogueId }` or `{ type: 'battle', enemyGroupId, captureTargets? }`.
- `src/systems/overworldPath.ts` — BFS over `WorldMap.edges`, returns full path with hop count + food cost.
- `src/systems/encounterDifficulty.ts` — scales enemy stats by region tier and run progress.

### New domain types

- `Region` — `{ id, name, color, tier }`.
- `EncounterEntry` — `{ id, weight, oneShot, conditions: Predicate[], outcome: { kind: 'dialogue'|'battle', ref, captureTargets? } }`.
- `EnemyGroup` — `{ id, members: { classId, count, levelAdjust }[] }`.
- `TownDef` — `{ id, name, regionId, healCostPerUnit, shopStockIds, rumors, tavernQuests: { questId, dialogueId, visibleIf? }[] }`.

### New store state

`runStore`:
- `oneShotsFired: Set<EncounterId>` — prevents re-firing one-shot encounters.
- `currentMapId: MapId` — already present; gets multi-value support.
- `pendingDialogue: { dialogueId, currentNodeId } | null` — drives `DialogueModal`.

### New store actions

`runStore`:
- `startDialogue { dialogueId }`
- `endDialogue` (also discharges queued `QuestEffect[]`)
- `applyQuestEffects { effects: QuestEffect[] }`
- `consumeFoodPerHop`
- `markEncounterFired { encounterId }`
- `restAtCamp { healPercent: number; foodCost: number }`
- `enterMap { mapId }` — region transition

### Extended `QuestEffect` union

Add: `addGold { amount }`, `addFood { amount }`, `damageParty { amount }`, `healParty { percent }`, `statCheck { stat, threshold, successEffects, failEffects }`. Required by 7 of 8 Godot dialogues.

### Equipment removal — subtractive only

Per the blast-radius audit, equipment is **purely decorative** in the current phaser code. Combat does not read `unit.hand`. `deckBuilder.ts` is dead code (only its test runs it). Removal is `~580 LoC removed, ~30 modified`.

Keep:
- `Item` type, but trim to consumables. New shape: `{ id, name, kind: 'food' | 'potion', gridSize, buyPrice, sellPrice, region? }`.
- `inventory.items` in runStore (now consumables only).
- `moveItemInBag` action.
- Town shop (sells consumables only).

Delete:
- `HandSlots`, `unit.hand`.
- `equipHand` action.
- `weapon`/`tome`/`staff`/`armor` items from items.json.
- `WeaponType`, `ItemKind: 'weapon'|'armor'|...` (only `'food'|'potion'` remain).
- `Card.weaponType` (decorative; nothing reads it).
- `deckBuilder.ts` + test.
- `Sharpness` (already absent from phaser — deletion is type-level only).
- `BattleResult.loot` field.
- `ItemAcquired` event variant.
- `grantItem` quest effect.
- `hasItem` predicate.

Bump `SAVE_VERSION` to `'0.6.0-cards-only'`. Pre-alpha policy: schema changes nuke saves with a loud warning — already wired.

## Content authoring

### Quests
- `data/content/quests/blood_ties.json` — port from Godot `data/quests/quest_definitions.json` `sq_blood_ties`. Stages: `find_daren` → (capture | kill) → `daren_resolved` → `__complete__`. Effects: capture recruits Kael at level 5 with starter cards; kill grants 80g.

### Dialogues (8 trees)
Port from Godot `data/dialogue/`:
- `prologue.json`
- `road_merchant.json`
- `bandit_threat.json`
- `wounded_traveler.json`
- `test_event_crossroads.json` (drop or rename)
- `sq_blood_ties_accept.json`
- `sq_blood_ties_daren_captured.json`
- `sq_blood_ties_daren_killed.json`

Format alignment: Godot's `lines[]` with `id, speaker, text, choices, effects, next` maps to phaser `DialogueTree { nodes: Record<string, DialogueNode> }`. Add a Godot-to-phaser converter in `scripts/convert-dialogues.mjs`.

### Towns (5)
Port from Godot `data/towns/`:
- `pine_crossing.json` (Borderlands tier 1, heal 6g/unit, 4 shop items)
- `riverside_market.json` (Borderlands tier 1, heal 8g, 5 items)
- `south_junction.json` (Borderlands tier 2, heal 10g, 6 items)
- `borderkeep_castle.json` (Thornwood tier 2, heal 12g, 9 items)
- `northern_bridge.json` (Thornwood tier 3, heal 20g, 8 items)

Tavern rumors and quests are per-town. Bounty board still locked (capture infrastructure exists; bounty UI lands as polish).

### Encounters
- `data/content/encounters/borderlands_road.json` — 6 entries (3 dialogue + 3 battle), weighted, one-shots tracked.
- `data/content/encounters/thornwood_path.json` — placeholder (3 entries) for the second region.
- `data/content/encounters/ashfall_track.json` — placeholder.
- `data/content/enemyGroups/{bandits,wolves,brigands,darens_gang}.json` — one per Godot template.

### Maps
- `data/content/overworld/borderlands.json` — port from Godot `overworld.json` filtered to `region: borderlands` (~17 nodes including 3 towns + 2 dungeons + transitions to thornwood).
- `data/content/overworld/thornwood.json` — `region: thornwood` (~17 nodes including 2 towns + 2 dungeons + transitions to ashfall).
- `data/content/overworld/ashfall.json` — `region: ashfall` (~12 nodes including the EXIT to Iron Throne).

Each map references a single region; map-to-map transitions happen via `enterMap` action when the player crosses a region edge. Edges between maps are stored as `MapEdge { fromMapId, fromNodeId, toMapId, toNodeId }`.

### Dungeons
- `data/content/dungeons/{smugglers_cave,iron_mine,thornwood_depths,ancient_ruins,obsidian_cavern}.json` — one per Godot dungeon location. Each carries: `id, name, regionId, floors: 3, theme, bossEnemyGroup, eliteEnemyGroup, combatEnemyGroup`.

## Implementation phases

The plan (`2026-05-10-godot-parity-plan.md`) breaks the work into ~32 tasks across 7 phases, each commit-sized and gated.

### Phase A — Equipment removal (subtractive, ~6 tasks)
Trim items.json to consumables, drop HandSlots, drop equipHand, drop deckBuilder, remove weapon fields from cards.json (cosmetic), update all unit fixtures in tests, drop ItemAcquired/grantItem/hasItem from contracts/predicates/quest, bump SAVE_VERSION.

### Phase B — Quest engine + dialogue infrastructure (~5 tasks)
Wire questRunner into runStore dispatch; extend QuestEffect with resource deltas + statCheck; build DialogueModal + StatCheckModal components; build a Godot-to-phaser dialogue converter; port the 8 dialogue trees and Blood Ties quest data.

### Phase C — Travel encounters + food (~5 tasks)
Add `consumeFoodPerHop` + `markEncounterFired` to runStore; build encounterRoller (weighted, predicate-filtered); port travel_events.json + enemy_groups.json; wire OverworldScene.handleNodeClick to roller (dialogue → DialogueModal, battle → seedDungeonBattle); add starvation damage when food = 0.

### Phase D — Multi-region overworld (~6 tasks)
Add Region domain type; port overworld.json (split into 3 region files); add multi-hop BFS pathfinding + path preview; add hover tooltip with hop count + food cost; add map-to-map transition (`enterMap` action + region edges); add MapBackground component (region-tinted radial gradients).

### Phase E — Town content + panels (~5 tasks)
Add TownDef schema; port 5 town JSONs; extract InnPanel / ShopPanel / TavernPanel into separate files; refactor TownScene to take `townId` prop and load TownDef; add CampScene for camp nodes; wire camp button → CampScene.

### Phase F — Dungeon parity (~4 tasks)
Add `shop` + `treasure` to dungeonGenerator ROOM_WEIGHTS with row-band rules; add `restParty` reducer + remove DungeonScene's setState bypass; add data/content/dungeons/*.json schema + 5 dungeon JSONs; add seedDungeonBattle that derives enemies from dungeon's encounter pool.

### Phase G — Integration + visual playthrough (~3 tasks)
Add prologue trigger on first new-game; final visual playthrough recording (title → overworld → travel encounter dialogue → travel encounter battle → town inn/shop/tavern → camp → dungeon → boss → exit); CONTEXT.md update; tag `phaser-godot-parity`; emit `<promise>GODOT-PARITY</promise>`.

## Performance budget

Continued from the UI overhaul spec:
- Bundle ≤ baseline + 75 KB gzipped (currently +30 KB; budget for content authoring is ~45 KB more).
- 60 fps on combat with 5 cards animating + hover.
- Scene mount-to-interactive < 50 ms.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Save migration breaks existing testers | Pre-alpha policy: nuke + warn. SAVE_VERSION bump triggers it. |
| Dialogue content authoring is tedious | Build a one-shot Godot→phaser converter script; review output by hand. |
| Multi-region maps become a content-grind black hole | Phase D constrained to porting Godot's existing 46 nodes verbatim. No new map authoring. |
| Encounter difficulty scaling under-tuned across regions | Use Godot's `5 + level*2` enemy weapon scale + region tier multiplier as starting numbers; tune later if balance audit shows issues. |
| TestingLibrary + RAC integration in DialogueModal tests | Reuse the patterns established in T18 (CombatHud test). |

## Done criteria (`<promise>GODOT-PARITY</promise>`)

- All ~32 tasks checked in `RALPH_PROGRESS.md`.
- All five build gates pass: typecheck, unit tests, e2e, check-context-doc, build.
- `npm run perf-gates` PASS.
- 5 town JSONs load + render distinct shop stocks/rumors/quests.
- 3 region maps load + map-to-map travel works.
- 5 dungeon JSONs drive seedDungeonBattle with distinct enemy pools.
- Blood Ties quest playable end-to-end (accept in tavern → encounter Daren → capture or kill → return for reward).
- Prologue dialogue plays on first new-game.
- Per-hop food consumption verified; starvation damage at 0 food.
- Equipment fully removed: no `HandSlots`, no weapons in items.json, SAVE_VERSION = `0.6.0-cards-only`.
- Tag `phaser-godot-parity` pushed.
- Visual playthrough recorded: title → overworld → travel encounter (dialogue) → travel encounter (battle) → town panels → camp → dungeon → boss → exit screen.

---

*Audit basis: 4 parallel investigations (overworld, dungeon, quest+town, equipment removal). Quotes verbatim from Godot files. User scope decisions captured 2026-05-10.*
