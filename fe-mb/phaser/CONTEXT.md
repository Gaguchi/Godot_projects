# phaser/CONTEXT.md — Living Reference for AI Agents

> **READ FIRST.** Current architectural truth for the FE_MB phaser TypeScript migration. Hard-capped at 300 lines. When code disagrees with this doc, **the code is correct** — update the doc and call out the drift in your PR body.

> **Working spec:** `../docs/superpowers/specs/2026-05-08-phaser-foundations-v2-design.md`. All design rationale lives there; this file holds CURRENT-truth pointers only.

> **Status:** Populated and authoritative. The foundation milestone closed 2026-05-09 and the game reached the `beta-0.1` tag on 2026-07-06; every section below reflects shipped code. Historical `[STUB]` markers have been cleared.
>
> **Narrative direction:** `../docs/worldbuilding/story-bible.md` is the live creative truth (free mercenary company, dragon-egg spine, the Ashford cast). It is developed in conversation with the project owner, and it currently DISAGREES with shipped content on four points — the directed three-region map, the candle-lit UI palette, the FE6 placeholder names, and tavern recruitment. Do not "fix" those by guessing; they are tracked decisions.

---

## 1. Architecture Invariants (≤25 lines)

1. **Phaser is BOARD only.** `BoardScene` renders tiles, units, in-world animations, terrain. ALL UI (cards, hand, HUD, end-turn, AP, menus, shop, inventory, dialog, tooltips, modals) is React DOM via `src/ui/components/` wrappers over `react-aria-components`. Spatial pickers (tile click, unit click) stay on canvas because they're geometric selection, not UI buttons. Adding a button or menu to canvas reopens the rex-ui-clone trap — render in HUD instead. See `2026-05-09-ui-input-overhaul-design.md`.
1b. **Fixed 1280×720 stage.** The whole game is authored at 1280×720 and uniformly CSS-`transform`-scaled to fit the window (letterboxed) by `ui/GameStage.tsx` — the UI never reflows to arbitrary window dimensions. Consequences: screens fill the stage with `h-full w-full` (NOT `h-screen`/`w-screen`); a `transform` on the stage makes `position: fixed` descendants (modals/HUD/pause) resolve against the STAGE, not the viewport; use `STAGE_W`/`STAGE_H` (`ui/stage.ts`, not `window.inner*`) for in-stage layout math; the Phaser canvas (also 1280×720) is scaled by the same transform and `GameStage` calls `game.scale.refresh()` after each rescale so board input stays mapped. **react-aria overlays (Modal/Popover/Tooltip) MUST portal into the stage** via `UNSTABLE_portalContainer={stagePortalContainer()}` — they default to `document.body` (outside the stage), which renders them unscaled/viewport-relative; the `Dialog` and `Tooltip` wrappers already do this, so build new modals on those wrappers.
2. **Three Zustand stores, single dispatch each:** `metaStore` (cross-run unlocks), `runStore` (current run), `combatStore` (current battle, ephemeral). Mutation only via `dispatch(action)`.
3. **Pure systems** in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O. Take state in, return new state + effects out.
4. **Combat is a reducer** over a discriminated `CombatEvent` union. `reduce(state, event, rng) → { state, effects }`. Effects are intents to render, not state. Decks CYCLE (StS model): `deckBuilder` puts all cards in `draw`; `startBattle` shuffles + deals `HAND_SIZE` (5); on `endTurn` the ending unit discards its whole hand and the next unit draws to 5, reshuffling discard when dry. `CombatState.battleTag` marks special battles ('finalBoss' → run completion; 'boss:<dungeonId>'). Team is explicit `Unit.team` via `systems/team.ts` `isEnemyUnit` (classId-fragment fallback for legacy fixtures).
5. **Phaser firewall:** `BoardScene` (`game/scenes/BoardScene.ts`) owns a mutable `CombatRuntime` POJO (sprite refs, tween handles). Subscribes to `combatStore` event-shaped channel (`subscribeWithSelector` on `lastEffectId`). NEVER reads state per frame. The React `CombatHud` (`src/ui/scenes/combat/CombatHud.tsx`) is an absolute overlay on top of the canvas; it subscribes to the same `combatStore` via Zustand selectors and dispatches the same events.
6. **`Math.random()` is forbidden.** All randomness flows through `RNG` parameters. Hierarchical: `deriveRng(parent, label)` per subsystem.
7. **Cross-system writes go through `src/contracts/` types.** `BattleResult`, `RecruitmentResult`, `PendingTravelPath`, `CombatBootRequest`, `DomainEvent`. Compiler enforces integration boundaries.
8. **Predicates are declarative AST**, not function references. Round-trips through save. One evaluator (`systems/predicates.ts`) used by quest transitions, map gates, dialogue gates, shop gates.
9. **Domain events** (`BattleVictory`, `LocationArrived`, etc.) flow through `eventBus`; quest listeners subscribe, subscribers dispatch back to stores, and the bus is NEVER a mutation channel. The singletons live in `state/appBus.ts` (`eventBus`, `errorBus`, `actionLog`, `emitDomainEvent`) — NOT in `App.tsx`, so non-React modules can publish without importing the React root. `state/appBus.ts` also exports `busRefs` (the dev-HUD/debug handle). `state/questEngine.ts` owns the quest registry (`bootstrapQuests()`, `getQuestEngine()`) and the pumps: `settleQuests()` (stage transitions to a fixed point, bounded at 8 passes), `handleDomainEvent(event)` (one event through stage listeners, then settle — call it directly in tests/replay), and `attachQuestEngine(bus)` (subscribes both the bus AND the run store, because most quest progress is a dialogue setting a flag, which emits no domain event). Emit sites today: `LocationArrived` on overworld arrival, and `BattleResult.emittedEvents` replayed after `applyBattleResult`. `actionLog.append` now fires from the `runStore` dispatch chokepoint (capturing `rngStateBeforeAction` before the switch), so save files carry a real replay log instead of `[]`.
10. **Specs in `docs/superpowers/specs/` are append-only and immutable post-merge.** New decisions = new spec + supersedes-link.

## 2. Three-Store Ownership Map (≤30 lines)

| State | Store | Lifecycle | Cleared on |
|---|---|---|---|
| `gameStarted`, `totalRuns`, unlocks (future) | `metaStore` | persistent across runs | new game+ only |
| `runId`, `runSeed`, `party.units`, `partyOrder` | `runStore` | one run | run end |
| `inventory.bagGrid`, `inventory.items` | `runStore` | one run | run end |
| `gold`, food (computed from bag) | `runStore` | one run | run end |
| `worldPosition`, `visitedNodes`, `pendingTravelPath` | `runStore` | one run | run end |
| `flags` (TypedFlagStore, scoped run/quest/battle/permanent) | `runStore` | mixed (per-scope) | scope-dependent |
| `questStates` (per-quest current stage) | `runStore` | one run | run end |
| `activeDungeon` (graph, position, cleared rooms) | `runStore` | one dungeon visit | dungeon exit |
| `rngState` (root for run-derived RNGs) | `runStore` | one run | run end |
| `edgeTraversals` (per-road walk count + last-crossed day) | `runStore` | one run | run end |
| `pendingCaptureTargets` (named enemies the current encounter cares about) | `runStore` | one battle | battle end |
| `phase`, `subPhase`, `units`, `decks`, `grid`, `effects[]` | `combatStore` | one battle | battle end |
| `combatStore.rng` (derived from run-RNG per battle) | `combatStore` | one battle | battle end |

**Cross-cutting transactions** (atomic via single dispatch):
- `runStore.dispatch({ type: 'applyBattleResult', payload })` — handles XP, fallen, loot, gold, captures, flag updates, hop consumption, in one update.
- `runStore.dispatch({ type: 'recruitUnit', payload })` — adds to party + deducts gold + emits event.

## 3. Action Catalog (≤40 lines)

Stores expose a `useMetaStore` / `useRunStore` / `useCombatStore` Zustand hook, each with a single `dispatch(action)` chokepoint. Action unions: `MetaAction`, `RunAction`, `CombatEvent`. `combatStore` state shape: `CombatStoreState` wrapping `CombatState`.

**`metaStore` actions** (`MetaAction` union): `startNewRun`, `recordRunCompleted { won }`, `markTutorialSeen`, `setAudioMuted { muted }`. State also carries `runsWon`, `runsLost`, `tutorialSeen`, `audioMuted` beyond the `gameStarted`/`totalRuns` in §2. None of it is persisted — the save file writes `gameStarted`/`totalRuns` and never reads them back.

**`runStore` actions** (`RunAction` union in `state/runStore.ts`):
- `recruitUnit { unit }`
- `fallenUnit { unitId, cause, turn }`
- `equipItem { unitId, itemId, slot }` — atomic bag→hand-slot equip via `planEquip` (2H locks off-hand; swap returns old item to bag; rejected plans no-op with a diag warning)
- `unequipItem { unitId, slot }` — hand-slot→bag via `planUnequip`; no-op if bag full
- `sweepFallenUnits { unitIds }` — removes the listed units from `party.units` + `party.partyOrder`; no-op for empty list or unknown ids. Dispatched on VICTORY for permadeath cleanup.
- `moveItemInBag { itemId, x, y }`
- `buyItem { itemId, price }` — atomic gold-deduction + add-to-first-empty-slot; no-op if gold insufficient or bag full
- `sellItem { itemId, sellPrice }` — atomic remove-first-match + gold credit; no-op if item not in bag
- `addGold { amount }`
- `hydrateFromSave { gold, worldPosition, partyUnits, partyOrder, inventoryItems, flags?, questStates?, rngState?, daysElapsed?, runStats?, oneShotsFired?, visitedNodes?, clearedEncounters?, deathLog? }` — atomic save-load restore. **Any new optional field must ALSO be added to `SerializedRunSchema` in `persistence/load.ts`** — Zod strips undeclared keys, so an omitted field is silently dropped on the real load path even though `serializeRun` writes it. Still NOT restored: `metaStore`, the combat snapshot (explicitly reset on load), `runId`/`runSeed`, `activeDungeon`, `pendingTravelPath`, `pendingDialogue`, `pendingCombat`.
- `arriveAtNode { nodeId }`
- `startTravelPath { path }`
- `consumeTravelHop { hopIndex }`
- `enterDungeon { dungeonId, graph }`
- `advanceDungeonRoom { roomId }`
- `exitDungeon`
- `setFlag { key, value, scope? }`
- `clearFlagsByScope { scope }`
- `advanceQuestStage { questId, toStage }`
- `applyBattleResult { result: BattleResult }`
- `applyQuestEffects { effects: QuestEffect[] }` — handler walks each effect via `applyQuestEffect` (recursive for `statCheck`)
- `startDialogue { dialogueId, nodeId }` — sets `pendingDialogue`; consumed by `<DialogueModal>`
- `endDialogue` — clears `pendingDialogue`
- `resetRun` — atomic full-run wipe (New Run from win/game-over screens)
- `clearPendingCombat`, `markEncounterFired { encounterId }`, `consumeFoodPerHop` (also +1 `daysElapsed`; starvation is 3 HP/unit when food is out), `enterMap { mapId, nodeId }`, `restParty`
- `setPendingCaptureTargets { targets }` — stashes the encounter's `captureTargets` when a battle boots; battle end feeds them to `systems/captureTargets.resolveCaptureTargets` (pure: captured ⇒ capturedFlag + capturedDialogue, dead ⇒ killedFlag + killedDialogue, still standing ⇒ nothing) and clears them. Targets key on **unit id**, never display name. Only the first dialogue survives, since `pendingDialogue` is a single slot.
- `recordEdgeTraversal { mapId, from, to }` — bumps `edgeTraversals[edgeTraversalKey(mapId, from, to)]` (node ids sorted, so a road is one road both ways) and stamps `lastDay`. Dispatch it only when a hop LANDS: the hop encounter RNG label embeds the pass number, and `rngState` never advances during play, so bumping mid-hop would move the label out from under a suspended-and-retried hop. This counter is the only reason a second crossing of a road rolls a different encounter than the first.
- Stubs, NOT implemented: the `recruitUnit` / `spawnNode` / `unlockNode` **QuestEffect** cases in `applyQuestEffect` are no-ops (distinct from the `recruitUnit` ACTION above, which works)

`RunState.runStats` (battlesWon, enemiesDefeated, unitsLost, goldEarned, gearFound, enemiesCaptured, hops) feeds the win/game-over screens; updated by `applyBattleResult` + `consumeTravelHop`; `BattleResult.enemiesDefeated` counts dead foes. Boss: `seedBossBattle` (Iron Throne — authored Warlord stats, `warlord` class + AI with `aoeRadius` sweep) fires from the overworld exit node; victory records `recordRunCompleted` and shows the run-complete screen.

Helper: `predicateStateFromRun(s)` reifies a `RunState` into the `PredicateState` shape questRunner / dialogueRunner expect.

Dialogue registry (`state/dialogueRegistry.ts`): in-memory `DialogueTree` registry — `registerDialogue`, `getDialogue`, `clearDialogues`, `listDialogueIds`. `state/dialogueBootstrap.ts` exports `bootstrapDialogues()` which registers the 14 shipped trees on App boot (the original 8 Godot ports plus the Missing Caravan / Deserter chains).

**Diagnostic log** (`state/diagLog.ts`): bounded ring buffer (last 500 `DiagEntry` records, typed by `DiagLevel` and `DiagCategory`). Callers use `diag(category, msg, data?, level?)`. Wired into `runStore.dispatch`, `DialogueModal` lifecycle, `OverworldScene` encounter rolls and BFS path commits. Auto-mirrors to devtools console. Queryable via `window.__debug.diag`: `recent(n)`, `byCategory(cat,n)`, `byLevel(lvl,n)`, `since(ts)`, `search(re,n)`, `dump(n)` (formatted text), `categories()`, `clear()`. Exported as `diagLog` and `diag`.

**`combatStore` events** (`CombatEvent` union, see `domain/combatState.ts`):
- `startBattle { units, grid, rngSeed }`
- `startTurn { unitId }`
- `selectCard { cardId }`
- `cancelSelection`
- `playCard { cardId, srcId, targets }`
- `enterMoveMode { unitId }` — subPhase → `SELECTING_MOVE`
- `moveUnit { unitId, tileId }` — free move per turn (no AP cost), refused if `hasMovedThisTurn`
- `endTurn`
- `tickStatus`
- `capture { targetId, attackerIds }`
- `animationsCompleted`

## 4. Cross-System Contracts (≤30 lines)

All in `src/contracts/`. Compiler-enforced. Barrel export: `src/contracts/index.ts`.

- **`BattleResult`** — see `crossStoreActions.ts`. Battle-end output: outcome, survivors, fallen, xpAwards, capturedEnemies, loot, goldEarned, consumedTravelHop, emittedEvents.
- **`RecruitmentResult`** — unit, goldCost, source ('tavern' | 'event' | 'quest'), emittedEvents.
- **`PendingTravelPath`** — remainingNodeIds, totalHopsThisLeg, rngBranch.
- **`CombatBootRequest`** — battleId, battleMapId, enemyGroupId, rngSeed, triggeringHopIndex, returnTo.
- **`DomainEvent`** — discriminated union of cross-system events; see §7.

**State infrastructure factories** (`src/state/`): `createErrorBus`, `createEventBus`, `createActionLog`, `createFlagStore`. Each returns a small interface object (`ErrorBus`, `EventBus`, `ActionLog`, `FlagStore`) with subscribe/emit/recent/snapshot semantics — non-mutation channels.

**Persistence API** (`src/persistence/`): `serializeRun(state)`, `buildSaveFile(meta, run)`, `saveToString(save)`, `loadFromString(json)` (returns `LoadResult`), `reproduceCombatAction(state, action)` (returns `ReproduceResult`). `SaveVersion` constant tags schema; `CONTENT_ALIASES_VERSION` tags alias-table compatibility.

## 5. RNG Domain Map (≤15 lines)

```
runSeed (chosen on new game)
├── deriveRng('world')                  — overworld procgen (when overworld procgen lands)
├── deriveRng('hop:N')                  — encounter roll for travel hop N
├── deriveRng('dungeon:DUNGEON_ID')     — dungeon graph generation
├── deriveRng('battle:BATTLE_INSTANCE') — battle setup + enemy AI rolls
└── deriveRng('loot:BATTLE_INSTANCE')   — loot drops post-battle
```

**Rule:** every random call threads through `RNG` parameter. `Math.random()` lint-banned. Sub-RNG derivation is deterministic per `(parent, label)` — replaying actions reproduces state.

## 6. Predicate Vocabulary (≤25 lines)

`Predicate` is a discriminated union AST. Used by quest transitions, map node visibility, dialogue choice gating, shop entries.

```ts
type Predicate =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'flag'; key: FlagKey; equals?: unknown }
  | { kind: 'notFlag'; key: FlagKey }
  | { kind: 'questStage'; questId, stage }
  | { kind: 'questComplete'; questId }
  | { kind: 'partyHas'; classId }
  | { kind: 'hasItem'; itemId }
  | { kind: 'goldAtLeast'; amount }
  | { kind: 'visited'; ref: MapNodeRef }
  | { kind: 'cleared'; encounterId }
  | { kind: 'allOf'; preds }
  | { kind: 'anyOf'; preds }
  | { kind: 'not'; pred }
```

Single evaluator: `evaluatePredicate(pred: Predicate, state: PredicateState): boolean` in `systems/predicates.ts`. `PredicateState` is the minimal shape needed (flags, questStates, party.units, inventory.items, gold, visitedNodes, clearedEncounters); `runStore.RunState` satisfies it. Quest-completion sentinel: `QUEST_COMPLETE = '__complete__'` (use as `currentStage` value).

## 7. Domain Event Catalog (≤20 lines)

```ts
type DomainEvent =
  | { type: 'BattleStarted'; payload: { battleId; enemies } }
  | { type: 'BattleVictory'; payload: { battleId; survivors; capturedIds } }
  | { type: 'BattleDefeat';  payload: { battleId } }
  | { type: 'UnitDied'; payload: { unitId; cause } }
  | { type: 'EnemyCaptured'; payload: { unitId; classId; level } }
  | { type: 'LocationArrived'; payload: { nodeRef: MapNodeRef } }
  | { type: 'ItemAcquired'; payload: { itemId; source } }
  | { type: 'FlagSet'; payload: { key; value; scope } }
  | { type: 'QuestStageAdvanced'; payload: { questId; from; to } }
```

## 8. Schema Index (≤15 lines)

Zod schemas in `src/data/schemas/` mirror `src/domain/` types. Schemas accept plain `string` for IDs; branding is restored via code-side `as*()` helpers when domain types are constructed. Barrel: `data/schemas/index.ts`.

- `domain/ids.ts` — 17 branded ID types + `as*()` casts. **Active.**
- `domain/rng.ts` — `RngState`, `RNG` interface. Impl in `systems/rng.ts` (Mulberry32 + `deriveRng`). **Active.**
- `domain/boardGeometry.ts` — shared board math for canvas + HUD: `TILE` (base pitch, 48 — unit chrome is tuned here), `tileSize(w,h)` (per-battle pitch: largest even size in [`TILE_MIN` 40, `TILE_MAX` 96] that fits the play band — a 5×5 tutorial gets 84px, the 14×10 field 42px so no row runs under the hand; `BAND_TOP` 120 clears the plaque + the top-left initiative strip), `gridOriginX(w,h)`/`gridOriginY(w,h)` (per-battle board origin — grids center on the stage between top chrome and the hand; replaced the fixed `GRID_OFFSET_X/Y`), `HAND_TOP_Y` (command-zone top / self-play drop threshold), `tileAtStagePoint` (stage point → tile id), `clientToStage` (viewport → stage coords under the GameStage scale). Powers the card drag-to-target. **Active.**
- `systems/autotile.ts` — pure 47-case blob autotiler (`autotileKey(painted, x, y, terrain)` → `px_<terrain>[_edge_n|_outer_nw|_b<missing>_<notch>]`, `allTileKeys(terrain)` preload manifest, `cellKey`). Key names = the PNGs under `public/art/terrain/px/` = the map builder's palette (`tools/map-builder.html`). **Active.**
- `systems/boardFloor.ts` — `generateDirtRegion(w, h, rng)`: deterministic cosmetic dirt patches (seeded blobs + 2 CA passes, ≤35% of the board, no orphan cells). BoardScene derives the rng via `deriveRng(createRng(state.rng), 'floor')` and autotiles the result over a `px_grass` ground — unless the seeder authored `CombatGrid.floor` (tile ids; the tutorial draws its dirt lane along the critical path). Gameplay never reads either (obstacles stay on `CombatGrid`). `scripts/cli/map-tool.ts` (`npm run map-tool -- ascii|autotile|lint`) is the deterministic half of the `.claude/skills/drawing-maps` pipeline. **Active.**
- `data/schemas/card.ts` ↔ `Card` (`CardSchema`, `WeaponTypeSchema`). **Active.**
- `data/schemas/unit.ts` ↔ `Unit` (`UnitSchema`, `UnitStatsSchema`). **Active.**
- `data/schemas/item.ts` ↔ `Item` (`ItemSchema`, `QuiverModifierSchema`). Gear-as-deck (ship plan §2-8): `ItemKind` spans consumables + gear (weapon/shield/quiver/tome/staff), `WeaponClass` + `QuiverModifierKind`/`QuiverModifier` types, `gearCardIds`, `twoHanded`; `HAND_SLOT_KINDS` + `isHandSlotItem` helpers. `data/itemRegistry.ts` exposes `getItemDef`/`allItemDefs`. Hand-slot rules in `systems/equipment.ts` (`planEquip`/`planUnequip`); deck composition in `systems/deckBuilder.ts` (`buildDeckForUnit` — innate + gear cards, source tags, quiver `cardMods` on `DeckState`). Unit gains `handLeft`/`handRight`. **Active.**
- `data/schemas/class.ts` ↔ `ClassDef` (`ClassSchema`). **Active.**
- `data/schemas/statusEffect.ts` ↔ `StatusEffectDef` (`StatusEffectDataSchema` — JSON-shape only; function hooks live in code registry). **Active.**
- `data/schemas/map.ts` ↔ `WorldMap | BattleMap` (DungeonGraph schema TBD with generator). **Active.**
- `data/schemas/quest.ts` ↔ `QuestDef` (`QuestSchema`, `QuestStageSchema`, `QuestEffectSchema`; `StatKind` for statCheck). **Active.**
- `data/schemas/dialogue.ts` ↔ `DialogueTree` (DialogueChoice has `next` for unconditional advances OR `check`+`onPass`+`onFail` for stat/class/gold/food gates; mutual exclusion enforced via Zod refine). **Active.**
- `data/schemas/region.ts` ↔ `Region` (`asRegionId`, tier 1-3 modulates encounter difficulty). **Active.**
- `data/schemas/encounter.ts` ↔ `EncounterEntry` / `EncounterTable` / `EnemyGroup` / `EnemyGroupMember` / `EncounterOutcome` / `CaptureTarget` (`EncounterId` brand, `asEncounterId`). `EnemyGroupMember.id` (optional) = stable unit id ('daren', 'wolf') used verbatim by seeders (packs get `_N` suffix) — drives id-keyed sprites + quest capturedIds. Outcome union: `dialogue | battle | checkEvent` (the last two require `enemyGroupId` / `event` payload respectively). Driven by `systems/encounterRoller.ts`. **Active.**
- `data/unitSprites.ts` — THE unit-id→sprite mapping (`UNIT_ID_SPRITES`, `CLASS_FALLBACK_SPRITE`, `ALL_SPRITE_IDS`, `spriteIdForUnit(unitId, classId)`, `spritePathFor`, `boardSpritePathFor`). CharacterPortrait (via `unitId`/`classId` props) consumes the 832×1216 originals; BoardScene preloads the ÷8 box-filtered bakes under `public/sprites/units/board/` (`npm run bake-board-sprites`) and sets them to LINEAR filtering — scaling the originals straight to a tile under `pixelArt` nearest sampling was the pixelated-characters bug; display names are NEVER matched for art. `Unit.captured?: boolean` marks taken-alive units (reducer `capture` case) — `battleResolver` reports them as `capturedIds` (BattleVictory) + `capturedEnemies` (no kill-gold); pre-0.8 `' (captured)'` name-suffix saves are migrated in `persistence/load.ts`. **Active.**
- `data/schemas/checkEvent.ts` ↔ `CheckEventDef` / `CheckEventChoiceDef` (title, description, choices each with optional CheckRequirement + onPass/onFail outcome). Consumed by `<CheckEventModal>` and the encounter outcome union. **Active.**
- `data/schemas/enemyAI.ts` ↔ `EnemyClassAI` / `EnemyAction` / `EnemyRole` (rusher | archer | healer | tank). One JSON per enemy class in `data/content/enemyAI/`. Drives `systems/enemyAI.planTurn`. **Active.**
- `state/combatUiStore.ts` ↔ lightweight UI-only Zustand store (`CombatUiState` shape, `useCombatUiStore` hook). Holds `pinnedDetailUnitId` for the click-pinned UnitDetailPanel. Phaser writes; React HUD reads. NOT routed through the combatReducer — purely chrome state. **Active.**
- `data/schemas/town.ts` ↔ `TownDef` / `TavernQuestEntry` / `TavernRecruitEntry` (5 town JSONs in `data/content/towns/`; powers TownScene panels; recruits drive TavernPanel hire flow via `recruitmentCost` + `buildUnit`). **Active.**
- `data/schemas/dungeonDef.ts` ↔ `DungeonDef` (5 dungeon JSONs; consumed by `game/scenes/seedDungeonBattle.ts`). **Active.**
- `data/schemas/predicate.ts` ↔ `Predicate` (recursive via `z.lazy`). **Active.**
- `data/schemas/check.ts` ↔ `CheckRequirement` (discriminated union: `stat | class | gold | food`; `StatKey` covers all 7 stats incl. `lck`). Domain types in `domain/check.ts`: `CheckRequirement`, `CheckAttempt`, `CheckCandidate`, `StatKey`. **Active.**
- `persistence/saveFormat.ts` ↔ `SaveFile` (`SAVE_VERSION = '0.7.0-gear'`, `SerializedRunState`, `SerializedMetaState`). Party units serialize whole, so hand slots round-trip. **Active.**
- `persistence/contentAliases.ts` ↔ `ContentAliases` (`cardId | itemId | flagKey | questId | stageId | dungeonId | mapId` maps, `resolveAlias`). **Active.**
- `persistence/saveSlots.ts` ↔ `SaveSlotMeta` + `SaveSlotsMeta` shapes; 3-slot localStorage manager (`NUM_SLOTS = 3`). Exports `listSlots` / `readSlot` / `writeSlot` / `deleteSlot` / `isSlotEmpty`. Data at `fe-mb:save:slot:N`; sidecar meta at `fe-mb:save:meta` for fast list-rendering. Consumed by `<SaveGameModal>`, `<LoadGameModal>`, and the pause-menu Save flow. **Active.**

## 9. File Map (≤25 lines)

```
phaser/src/
├── domain/         pure types (no I/O)
├── contracts/      cross-system integration types (compiler-enforced)
├── data/
│   ├── schemas/    Zod schemas
│   ├── content/    JSON content (classes, cards, items, quests, dialogue, maps)
│   └── load.ts     validateContent (Zod). NOTE: called from tests only —
│                   the app imports content JSON directly, so there is no
│                   boot-time content validation despite invariant §1.
│                   Save-file loading is persistence/load.ts, not this.
├── systems/        pure functions: deckBuilder, combatReducer, effectPipeline,
│                   statusEffects, targeting, turnOrder, capture, enemyAI,
│                   predicates, questRunner, dialogueRunner, battleResolver,
│                   checkResolver (evaluateCheck, getCheckCandidates)
├── procgen/        pure deterministic generators: dungeonGenerator (stub),
│                   overworldGenerator (stub)
├── mapRegistry/    MapRegistry: registry of world/battle/dungeon maps
├── state/          metaStore, runStore, combatStore, flags, appBus (the bus
│                   singletons + emitDomainEvent), questEngine (registry +
│                   settleQuests + attachQuestEngine), eventBus, errorBus,
│                   actionLog, diagLog, dialogueRegistry
├── persistence/    saveFormat, save, load (atomic hydration), contentAliases
├── game/           createGame.ts + scenes/ (BoardScene + battle seeders) + runtime/ (CombatRuntime POJO)
├── ui/             React shell + ErrorBoundary + DevHud + modals
└── tests/          unit (Vitest) + e2e (Playwright)
```

## 10. Active Spec Index (≤15 lines)

- `docs/superpowers/specs/2026-05-05-phaser-migration-design.md` — stack decisions (TS/Phaser4/React19/Vite/Zustand/Zod), render boundary, MCP loop. **Active.**
- `docs/superpowers/specs/2026-05-08-phaser-foundations-v2-design.md` — current foundation working spec. **Active.**
- `docs/superpowers/specs/2026-05-08-phaser-foundations-design.md` — v1 foundation. **Superseded by v2.**
- `docs/superpowers/specs/2026-05-05-phaser-sandbox.md` — original sandbox plan. **Abandoned.** (Note: this is a plan doc but kept here for context.)
- `docs/superpowers/specs/2026-03-29-ship-plan-design.md` — equipment-card game design. **Authoritative for game design.**
- `docs/superpowers/specs/2026-03-22-mechanics-redesign.md` — mechanics (some superseded by 03-29). **Reference only.**
- `docs/superpowers/plans/2026-03-22-mechanics-redesign.md` — Godot Phase 1 plan. **Godot reference only.**

## 11. Known Gotchas (≤30 lines)

(Lessons ported from MEMORY.md and Godot codebase. Add new ones as they're discovered in the TS codebase.)

- **Never share array references across systems.** Always `.slice()` or `[...arr]` at boundaries. (Godot lesson: card_hand_ui shared `_current_hand = dm.hand` then `.clear()` destroyed the deck.)
- **Phaser Scene's `data` field is reserved.** If adding game data to a scene, name it `gameData`, not `data`.
- **React 19 + react-jsx + noUnusedLocals:** use `React.JSX.Element` and `import React from 'react'` to avoid TS6133.
- **CombatScene firewall:** sprite/tween mutations live in `CombatRuntime` POJO; never reach into `combatStore` per frame.
- **Save-load is atomic.** Parse → alias-resolve → Zod → swap stores in one batch. Validation failure → main menu, not half-loaded state.
- **Pre-alpha save policy:** schema changes nuke saves with a loud warning. Track `saveVersion` so the migration ladder can be added later without retrofit.
- **Domain event bus is NOT a mutation channel.** Subscribers dispatch back to stores; the bus carries events only.
- **Predicates round-trip through save.** They MUST be declarative JSON, not function references.
- **`CombatEvent` ≠ `DomainEvent` ≠ `QuestListener.on`.** Three different "event-shaped" patterns. Don't confuse.
- **`QuestEffect` ≠ `CardEffect`** — separate domains; never confuse.
- **Effect pipeline middleware ordering:** stages 1=source-mod, 2=target-mod, 3=terrain, 4=card-specific, 5=armor, 6=clamp. Lower stages run first; each can spawn/absorb effects.
- **Team detection** is the explicit `Unit.team` field via `systems/team.ts` `isEnemyUnit`; the `classId` fragment list is only a fallback for legacy fixtures. Beware the DUPLICATE in `scripts/cli/render.ts`, which keeps its own stale fragment list (no 'warlord', ignores `unit.team`) and therefore mis-colours the boss in `--scenario boss`.

## 12. Open Questions (≤30 lines) `[STUB — populated as decisions arise]`

| # | Question | Owner | Decision deadline |
|---|---|---|---|
| ~~OQ-1~~ | ~~Dungeon fog-of-war~~ → **CLOSED 2026-05-09**: full reveal at dungeon entry; Event node *contents* hidden until entered. See `docs/research/sts-procgen.md`. |
| ~~OQ-2~~ | ~~Overworld procgen vs hand-authoring~~ → **CLOSED 2026-07-06**: hand-authored. Three authored region JSONs (borderlands/thornwood/ashfall) are the shipping overworld; the split-view band+map (spec 2026-06-12) is built around authored node layouts and baked vistas. `procgen/overworldGenerator` stays a stub for post-beta. See `docs/research/procedural_map_gen.md`. |
| ~~OQ-3~~ | ~~Recruitment cost formula for tavern recruits~~ → **CLOSED 2026-05-22**: `recruitmentCost(classId, level) = base × (1 + (level - 1) × 0.5)` with per-class baseline. See `docs/research/recruitment-cost.md`. |
| OQ-4 | Animation timing as data — `card.effects[].durationMs` granularity | TBD | combat-rendering milestone |
| OQ-5 | Save migration ladder activation point — when does player count justify it? | project owner | post-foundation |
| OQ-6 | Audio engine: Phaser built-in vs Howler vs Web Audio API direct | TBD | polish milestone |
| OQ-7 | Mobile/Steam Deck targeting — affects bag size / save quotas | TBD | v1.0 planning |
| OQ-8 | `QuestEffect.spawnNode` payload shape — inline `MapNodeDef` vs registry-by-id? Godot inlines `{x,y,connections,battle}` per quest_node. (research #3) | TBD | Quest system implementation (Week 2) |
| OQ-9 | `QuestEffect.recruitUnit` — extend with `{statOverrides, weaponItemId}` for Godot parity, OR require `UnitTemplateDef` registry lookup by class+level? (research #3) | TBD | Recruitment milestone |
| OQ-10 | Capture-target resolution shape — add `'UnitCaptured' \| 'UnitKilled'` to `QuestListenerEvent` + `unitCaptured` predicate, vs separate `BattleEncounterDef.captureTargets[]`? (research #3) | TBD | Quest system implementation (Week 2) |

---

**Update protocol:** any PR touching `phaser/src/domain/`, `phaser/src/state/*Store.ts`, `phaser/src/systems/`, `phaser/src/contracts/`, or `phaser/src/persistence/saveFormat.ts` MUST update this file in the same commit. CI check: `phaser/scripts/check-context-doc.ts` greps current type names from those source files and asserts they appear here. Drift fails the build. Two caveats: there is NO CI pipeline (no .github/workflows) — this only runs when someone runs `npm run verify` locally; and `check-context-doc.ts` scans domain/contracts/state/persistence only, NOT `src/systems/`, despite this protocol naming it.

**When this file overflows 300 lines:** prune the least-current entry per section, do NOT extend. Stale entries get `[STALE-YYYY-MM-DD]` markers; removed monthly.
