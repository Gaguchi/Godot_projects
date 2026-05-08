# Phaser Foundations v2 — Full-GDLC Design Spec

> Comprehensive foundation spec for the FE_MB phaser migration, covering the full game-development lifecycle (combat, overworld, dungeon, quests, dialogue, save, RNG, content, integration contracts). Supersedes the combat-narrow v1 spec after a second council-of-five review surfaced critical structural omissions: missing `runStore`, no `MapRegistry`, flat RNG, unspecified quest engine, no domain event bus, no integration contracts, dialogue absent.

**Status:** Draft 2026-05-08 (working spec)
**Author:** Project owner + Claude Code (brainstorming + 2× council-of-five)
**Supersedes:** `2026-05-08-phaser-foundations-design.md` (v1, combat-narrow)
**Stack-level decisions inherited from:** `2026-05-05-phaser-migration-design.md`
**Game-design source-of-truth:** `2026-03-29-ship-plan-design.md`

---

## 1. Context

The phaser migration's first attempt — a "combat sandbox" — built generic 12-card class decks divorced from the equipment-card design. We reset `src/`. The v1 foundation spec written earlier today corrected the combat architecture (reducer + effects + status hooks + Phaser firewall) but treated overworld, dungeon, towns, quests, and dialogue as "deferred." A second council-of-five review attacked that scope as too narrow: a roguelite is *the run*, not *the battle*; combat is a leaf node. This spec brings the foundation to the full game-development lifecycle. Combat architecture from v1 is preserved; the surrounding contracts and systems are added.

The cost is real — foundation milestone goes from 2.5–3 weeks to **5–6 weeks** — but the entire delta is *schemas, contracts, skeletons, and integration plumbing*. Content (real dungeons, quests, overworld layouts) ships in later milestones.

## 2. Migration Philosophy

Reference rebuild. Read the GDScript and the ship plan to extract design intent; write fresh TypeScript. The `2026-03-29-ship-plan-design.md` is authoritative for game design. The Godot codebase is reference for tribal knowledge and edge cases (see MEMORY.md for the catalog of solved problems).

## 3. Foundation Milestone — Scope (v2)

**The mission has changed.** v1 scoped foundation to "Phase 1: Equipment-Card Foundation." v2 scopes foundation to "*everything that the contracts between systems must agree on before any feature can land safely*." That means: data shapes, integration types, identity protocols, store ownership, save format, RNG hierarchy, predicate evaluator, event bus, living reference doc — all of it skeletal but real, validated, tested.

**In scope (additions to v1 in bold):**

- Equipment-card data model (hand slots, gear cards, innate cards, rarity, regions)
- Combat reducer + discriminated event union + effects queue *(v1)*
- Effect pipeline middleware for card resolution *(v1)*
- Status effects as lifecycle subscribers *(v1)*
- **Three-store architecture: `metaStore` (cross-run unlocks, skeletal) + `runStore` (current run state) + `combatStore` (current battle, ephemeral)**
- **`MapRegistry` with shared `MapNodeRef` identity protocol across overworld, dungeon, battle maps**
- **Hierarchical RNG: `deriveRng(parent, label) → RNG` derivation tree, sub-streams per domain**
- **Quest engine bones: `TypedFlagStore` with scope (run/quest/battle/permanent), declarative `Predicate` AST, `QuestDef` with stages-as-DAG, `QuestListener` pattern**
- **Shared `Predicate` AST evaluator powering: quest stage transitions, map node gating, dialogue branch availability, shop entry visibility, quest-locked content**
- **Domain event bus: typed event stream (`BattleVictory`, `UnitDied`, `LocationArrived`, `ItemAcquired`, `FlagSet`) — separate from `errorBus` — quest listeners subscribe**
- **`src/contracts/` module: `domainEvents.ts`, `crossStoreActions.ts`, `predicates.ts`, `handoffs.ts` — compiler-enforced integration boundaries**
- **Explicit cross-system contracts: `BattleResult`, `PendingTravelPath`, `CombatBootRequest`, `RecruitmentResult`**
- **Dialogue as a first-class pure system: `dialogueRunner.ts` consuming JSON tree, emitting `Effect[]`**
- **Procgen as pure module: `procgen/dungeonGenerator.ts` — deterministic `(rng, params) → DungeonGraph`, no `Math.random` ever**
- Phaser firewall via `CombatRuntime` POJO *(v1)*
- Seeded RNG everywhere (now hierarchical) *(v1, expanded)*
- Save format: `saveVersion`, atomic hydration, content alias table (extended to `flagKey`, `questId`, `stageId`), dual-slot autosave, persisted action log *(v1, expanded)*
- Action log ring buffer + `reproduce(state, action)` replay harness *(v1)*
- Top-level React `ErrorBoundary` + `errorBus` + dev HUD *(v1)*
- **Living reference doc: `phaser/CONTEXT.md` with hard line cap, fixed-section structure, CI drift check**
- **Five research deliverables in `docs/research/` blocking implementation**
- TDD on pure systems, smoke E2E for boot
- Representative content: 3 classes (LORD/KNIGHT/MAGE), ~10 gear items, 2 status effects (poison + burn), 1 stub overworld map, 1 stub dungeon generator, 1 stub quest

**Out of scope (deferred, with shapes locked):**

- Combat scene rendering polish (animations, hit-stop, camera shake, AOE preview rendering, damage numbers)
- Card hand UI, target selection UI, victory/defeat modals
- Overworld scene rendering (the data shape is locked; the scene is later)
- Town menu UIs (Inn / Shop / Tavern panels — schemas locked, panels later)
- Grid inventory drag-drop UI (schema locked, dnd-kit later)
- Dungeon scene rendering (procgen shape locked, scene later)
- Recruitment UI (contract locked, UI later)
- Audio routing
- Real content beyond the representative subset
- Slow + immobilize status effects (added with their gear)
- Animation timing as a design lever (data shape locked: `effects[].durationMs`; tuning later)
- Formal save migration ladder (versioning yes, ladder no — pre-alpha policy is "nuke saves with a loud warning")
- Steam packaging
- Mobile / Steam Deck
- Mod support

## 4. Stack (locked from migration spec)

TypeScript ^5.7 (strict + `noUncheckedIndexedAccess`), Phaser ^4.0, React ^19, Vite ^6, Zustand ^5, Zod ^3, Tailwind ^4, Vitest ^2, Playwright ^1.50.

## 5. Render Boundary (locked from v1)

- **Phaser canvas:** combat scene only.
- **React DOM:** overworld, town, shop, grid inventory, deck preview, dialogue, modals.

## 6. Project Layout (v2)

```
phaser/
├── package.json, vite.config.ts, tsconfig.json (locked)
├── playwright.config.ts, eslint.config.js (locked)
├── public/assets/                      # Kenney sprites
├── .claude/CLAUDE.md, .mcp.json        # AI loop config (updated this milestone)
├── CONTEXT.md                          # NEW — living reference doc, ≤300 lines, CI-checked
├── scripts/check-context-doc.ts        # NEW — CI drift check
└── src/
    ├── main.tsx                        # mount Phaser canvas + React shell
    ├── domain/                         # pure types, no I/O, no framework
    │   ├── ids.ts                      # branded IDs: UnitId, ItemId, CardId, FlagKey, MapId, NodeId, QuestId, StageId
    │   ├── card.ts
    │   ├── unit.ts
    │   ├── item.ts
    │   ├── statusEffect.ts
    │   ├── combatState.ts              # CombatState, CombatEvent (union), CombatEffect
    │   ├── map.ts                      # MapNodeRef, WorldMap, BattleMap, DungeonGraph
    │   ├── quest.ts                    # QuestDef, QuestStage, QuestListener
    │   ├── dialogue.ts                 # DialogueTree, DialogueChoice, DialogueEffect
    │   ├── predicate.ts                # Predicate AST
    │   └── rng.ts                      # RNG interface, RngState
    ├── contracts/                      # NEW — compiler-enforced integration boundaries
    │   ├── domainEvents.ts             # discriminated union of cross-system events
    │   ├── crossStoreActions.ts        # BattleResult, RecruitmentResult, etc.
    │   ├── predicates.ts               # re-export Predicate types from domain/
    │   └── handoffs.ts                 # PendingTravelPath, CombatBootRequest, ReturnTo
    ├── data/
    │   ├── schemas/                    # Zod schemas (mirror domain/ types)
    │   ├── content/                    # JSON content
    │   │   ├── classes.json
    │   │   ├── cards.json
    │   │   ├── items.json
    │   │   ├── statusEffects.json
    │   │   ├── overworld/              # WorldMap JSONs
    │   │   ├── battles/                # BattleMap JSONs (handcrafted templates)
    │   │   ├── quests/                 # QuestDef JSONs
    │   │   └── dialogue/               # DialogueTree JSONs
    │   └── load.ts                     # parse + validate + alias-resolve at boot
    ├── systems/                        # pure — no Phaser, no React, no I/O
    │   ├── deckBuilder.ts              # buildDeck(unit, classDef, leftHand, rightHand)
    │   ├── combatReducer.ts            # reduce(state, event, rng) → { state, effects }
    │   ├── effectPipeline.ts           # runEffects(effects, ctx) → { state, emitted }
    │   ├── statusEffects.ts            # registry of lifecycle hooks (poison, burn)
    │   ├── targeting.ts
    │   ├── turnOrder.ts                # InitiativeQueue
    │   ├── capture.ts
    │   ├── enemyAI.ts                  # planTurn(state, rng) → CombatEvent[]
    │   ├── predicates.ts               # evaluatePredicate(pred, state) → boolean
    │   ├── questRunner.ts              # advanceQuestStage, listener subscribe/dispatch
    │   ├── dialogueRunner.ts           # step(tree, choice) → { tree', effects[] }
    │   └── battleResolver.ts           # battle-end resolution: XP, loot, captures, events
    ├── procgen/                        # pure — deterministic generators
    │   ├── dungeonGenerator.ts         # (rng, params) → DungeonGraph
    │   └── overworldGenerator.ts       # stub for foundation; real generator later
    ├── mapRegistry/
    │   └── registry.ts                 # MapRegistry: overworld + battleTemplates + dungeonGenerators + resolveRef
    ├── state/
    │   ├── metaStore.ts                # Zustand: cross-run unlocks (skeletal in foundation)
    │   ├── runStore.ts                 # Zustand: current run (party, gold, food, position, dungeonPath, runSeed, flags)
    │   ├── combatStore.ts              # Zustand: reducer-driven, dispatch + effects queue
    │   ├── flags.ts                    # TypedFlagStore — branded keys, scope, enumerable
    │   ├── eventBus.ts                 # domain event bus (typed events)
    │   ├── errorBus.ts                 # global runtime error stream
    │   └── actionLog.ts                # ring buffer (last 200), persisted with save
    ├── persistence/
    │   ├── saveFormat.ts               # SaveFile shape + saveVersion constant
    │   ├── save.ts                     # serialize all stores
    │   ├── load.ts                     # atomic hydration: parse → alias-resolve → Zod → swap
    │   └── contentAliases.ts           # cardId, itemId, flagKey, questId, stageId aliases
    ├── game/                           # Phaser
    │   ├── createGame.ts
    │   ├── scenes/BootScene.ts
    │   ├── scenes/CombatScene.ts       # owns CombatRuntime; subscribes to combat.lastEffect
    │   └── runtime/CombatRuntime.ts    # plain mutable POJO: sprite refs, tween handles
    ├── ui/                             # React
    │   ├── App.tsx
    │   ├── ErrorBoundary.tsx
    │   ├── DevHud.tsx                  # last error + last 10 actions
    │   └── shell/                      # placeholder modals (real ones later)
    └── tests/
        ├── unit/                       # Vitest, mirrors systems/ + state/
        └── e2e/                        # Playwright smoke
```

## 7. Three-Store Architecture

**`metaStore`** — cross-run state, persists across new-game-+. Skeletal in foundation:

```ts
interface MetaState {
  gameStarted: boolean
  totalRuns: number
  // unlocks, achievements, settings — added in later milestones
}
type MetaAction = { type: 'startNewRun' } | { type: 'recordRunCompleted'; payload: { won: boolean } }
```

**`runStore`** — current run state. Owns *everything that resets when a run ends*:

```ts
interface RunState {
  runId: string                  // UUID per run
  runSeed: number                // root RNG seed for this run
  party: { units: Record<UnitId, Unit>; partyOrder: UnitId[] }
  inventory: { bagGrid: Tile[][]; items: BagItem[] }
  gold: number
  // food is computed: count Food Rations × current_uses across bag
  worldPosition: { mapId: MapId; nodeId: NodeId }
  visitedNodes: Record<NodeId, boolean>
  clearedEncounters: Record<EncounterId, boolean>
  pendingTravelPath: PendingTravelPath | null
  flags: TypedFlagStore           // run/quest/battle/permanent scopes
  questStates: Record<QuestId, { currentStage: StageId; metadata: Record<string, unknown> }>
  activeDungeon: { dungeonId: DungeonId; graph: DungeonGraph; position: NodeId; clearedRooms: Set<NodeId> } | null
  rngState: RngState              // root RNG state for the run
  deathLog: { unitId: UnitId; cause: string; turn: number }[]
}

type RunAction =
  | { type: 'recruitUnit'; payload: { unit: Unit } }
  | { type: 'fallenUnit'; payload: { unitId: UnitId; cause: string } }
  | { type: 'equipHand'; payload: { unitId: UnitId; slot: 'left'|'right'; itemId: ItemId } }
  | { type: 'moveItemInBag'; payload: { itemId: ItemId; x: number; y: number } }
  | { type: 'addGold'; payload: { amount: number } }
  | { type: 'arriveAtNode'; payload: { nodeId: NodeId } }
  | { type: 'startTravelPath'; payload: { path: NodeId[] } }
  | { type: 'consumeTravelHop'; payload: { hopIndex: number } }
  | { type: 'enterDungeon'; payload: { dungeonId: DungeonId } }
  | { type: 'advanceDungeonRoom'; payload: { roomId: NodeId } }
  | { type: 'setFlag'; payload: { key: FlagKey; value: unknown } }
  | { type: 'clearFlagsByScope'; payload: { scope: FlagScope } }
  | { type: 'advanceQuestStage'; payload: { questId: QuestId; toStage: StageId } }
  | { type: 'applyBattleResult'; payload: { result: BattleResult } }   // atomic battle-end
```

**`combatStore`** — current battle, ephemeral. Reducer-driven (see §10).

```ts
interface CombatState { /* see v1 §12 — unchanged */ }
// dispatch is dispatch(event: CombatEvent), routed through combatReducer.reduce
```

**Why three stores:** combat is ephemeral (battle-scoped), run is volatile (cleared on run end), meta is permanent. Splitting their lifecycles keeps the persistence story clean and prevents flag scope leaks (a battle-scoped flag in a `combatStore` slice cannot accidentally persist into the run). Three stores is the load-bearing architecture for any roguelite (Hades shipped this; FTL's sector-vs-run-vs-meta is similar).

**Why NOT four stores:** any further split (separate `inventoryStore`, separate `worldStore`, separate `partyStore`) was rejected by round-1 council due to torn cross-store writes. The single `runStore` keeps cross-cutting transactions atomic via one `dispatch`.

## 8. MapRegistry + MapNodeRef Identity Protocol

Three map kinds with irreconcilable shapes:

| Map | Topology | Lifecycle | Source | Owner |
|---|---|---|---|---|
| Overworld | tile grid + sparse location nodes + edges | persistent across run | hand-authored JSON | `runStore.worldPosition` references it |
| Dungeon (StS) | layered DAG, no spatial coords | procgen on entry, cleared on exit | `procgen/dungeonGenerator.ts` | `runStore.activeDungeon` |
| Battle grid | 14×10 tile array | per-encounter, ephemeral | hand-authored templates + procgen overlay | `combatStore.grid` |

**Shared identity protocol — `MapNodeRef`:**

```ts
type MapNodeRef = { mapKind: 'overworld' | 'dungeon' | 'battle'; mapId: MapId; nodeId: NodeId }
```

This is the cross-cutting reference. Quest flags reference `MapNodeRef`. Encounter bindings reference `MapNodeRef`. Save state stores `MapNodeRef`. The predicate `pred:atNode(MapNodeRef)` is the same regardless of map kind.

**`MapRegistry`:**

```ts
interface MapRegistry {
  overworld: Record<MapId, WorldMap>                         // hand-authored, validated at boot
  battleTemplates: Record<MapId, BattleMap>                  // hand-authored, validated at boot
  dungeonGenerators: Record<DungeonId, (rng: RNG) => DungeonGraph>  // procgen functions
  resolveRef(ref: MapNodeRef): MapNode | null
  validate(): ValidationResult                               // catches dangling refs at boot
}
```

The registry is loaded once at boot, validated, and frozen. The combat smoke test in §27 Week 5 loads a `BattleMap` from the registry — not a hardcoded grid. This forces the schema to be real.

**Battle map schema (locked now, even if values are minimal):**

```ts
interface BattleMap {
  id: MapId
  width: 14; height: 10
  terrain: TerrainTile[][]
  spawnZones: { party: TileId[]; enemy: TileId[] }
  obstacles: TileId[]
  source: 'handcrafted' | 'procgen-template'
}
interface TerrainTile {
  kind: 'plain' | 'forest' | 'mountain' | 'water' | 'road' | 'fortress'
  defBonus: number
  resBonus: number
  movementCost: number
  impassable: boolean
  blocksLOS: boolean
}
```

Locking `blocksLOS` and `resBonus` now even though the foundation reads only `defBonus` — retrofitting later means re-validating every battle map JSON.

**Dungeon graph schema:**

```ts
interface DungeonGraph {
  id: DungeonId
  rows: Room[][]                    // rows[0] = entry; rows[bossRow] = boss
  edges: [NodeId, NodeId][]         // monotonic — each edge advances one row
  entryRow: 0
  bossRow: number
  genSeed: number                   // independent from runSeed; preserved on save/load
  fogOfWar: 'full' | 'lookahead-1' | 'reveal-on-enter'   // decision deferred to research, but field exists
}
interface Room {
  id: NodeId
  type: 'combat' | 'elite' | 'rest' | 'shop' | 'event' | 'treasure' | 'boss'
  encounterRef: MapNodeRef | null
}
```

**Overworld schema:**

```ts
interface WorldMap {
  id: MapId
  width: number; height: number; tileSize: number
  terrainGrid: TerrainTile[][]
  nodes: WorldNode[]
  edges: { from: NodeId; to: NodeId; encounterTableId: EncounterTableId; rollChance: number }[]
}
interface WorldNode {
  id: NodeId
  type: 'town' | 'camp' | 'dungeon' | 'exit'
  position: { x: number; y: number }
  visiblePredicate: Predicate    // predicate AST — usually `{ kind: 'always' }`, sometimes `{ kind: 'flag', key: '...' }`
}
```

Connections are explicit data, not BFS-inferred at runtime (Godot's runtime inference is reference for understanding, not architecture).

## 9. Hierarchical RNG

Flat RNG with a shared counter is the most-regretted omission in early roguelites. Replace with a derivation tree:

```ts
interface RNG {
  next(): number
  nextInt(min: number, max: number): number
  pick<T>(arr: T[]): T
  shuffle<T>(arr: T[]): T[]
  derive(label: string): RNG     // creates a sub-RNG; deterministic per (parent, label)
}

interface RngState { seed: number; counter: number; label?: string }
function createRng(state: RngState): RNG
function deriveRng(parent: RNG, label: string): RNG  // = createRng({ seed: hash(parent.state.seed, label), counter: 0 })
```

**Standard derivation tree:**

```
runSeed (chosen at new game)
├── deriveRng('world')                    — overworld procgen seed (when overworld procgen lands)
├── deriveRng('hop:N')                    — encounter roll for travel hop N
├── deriveRng('dungeon:DUNGEON_ID')       — dungeon graph generation
├── deriveRng('battle:BATTLE_INSTANCE')   — battle setup + enemy AI rolls
└── deriveRng('loot:BATTLE_INSTANCE')     — loot drops post-battle
```

**Why derivation, not flat counter:** if a flat counter is shared, re-rolling one encounter shifts every downstream roll. That makes save-scumming corrupt subsequent runs. With derivation, each subsystem advances independently. Replay determinism is per-domain, not per-roll.

**Enforcement:** `Math.random()` is forbidden via lint rule (`no-restricted-globals: ['Math.random']`). Every random call threads through an `RNG` parameter. Combat persists `rngState: RngState` so reload mid-battle replays identically.

## 10. Combat Reducer + Effects Queue (preserved from v1)

Unchanged from v1 §8. `reduce(state: CombatState, event: CombatEvent, rng: RNG) → { state: CombatState; effects: CombatEffect[] }`. Phaser scene drains effects queue via event-shaped subscription on `lastEffectId`, never reads state per frame. See §19 (Phaser firewall).

## 11. Effect Pipeline for Card Resolution (preserved from v1)

Unchanged from v1 §9. Cards emit `Effect[]` flowing through middleware in fixed stages: source-modifiers → target-modifiers → terrain → card-specific → armor reducer → final clamp. Middleware list is the design lever for cross-effect interactions ("fire melts frost," "poison ignores armor on card X").

**Renaming:** to avoid ambiguity with the quest engine's effects, this effect type is `CardEffect` and the quest engine's is `QuestEffect`. Both implement a marker interface `EffectBase = { kind: string }` for shared logging.

## 12. Status Effects as Lifecycle Subscribers (preserved from v1)

Unchanged from v1 §10. Each `StatusEffectDef` declares hooks (`onApply`, `onTurnStart`, `onTurnEnd`, `onDamageTaken`, `onDamageDealt`, `onTick`, `interactsWith`). Foundation registers `poison` and `burn`.

## 13. Quest Engine Bones

The Godot codebase has the disease's early symptoms (MEMORY.md: *"Fixed flag name mismatches in Blood Ties — standardized to `_daren_captured`"*). String-keyed flags + a `setFlag(key, value)` action becomes a 1200-line switch by month 6. Foundation names the bones now.

**Typed flags with scope:**

```ts
type FlagScope = 'run' | 'quest' | 'battle' | 'permanent'
type FlagKey = Brand<string, 'FlagKey'>

const FLAGS = {
  bloodTies_darenCaptured: 'quest.bloodTies.darenCaptured' as FlagKey,
  bloodTies_complete:      'quest.bloodTies.complete'      as FlagKey,
  // ...
} as const

interface TypedFlagStore {
  set(key: FlagKey, value: unknown, scope?: FlagScope): void
  get<T>(key: FlagKey): T | undefined
  has(key: FlagKey): boolean
  clearScope(scope: FlagScope): void
  enumerate(): { key: FlagKey; value: unknown; scope: FlagScope }[]   // for dev HUD
}
```

`clearScope('battle')` runs at battle-end. `clearScope('run')` runs at new-game. Permanent flags survive everything.

**Quest definition (data-driven, declarative):**

```ts
interface QuestDef {
  id: QuestId
  name: string
  initialStage: StageId
  stages: Record<StageId, QuestStage>
}

interface QuestStage {
  id: StageId
  onEnter: QuestEffect[]                   // grant flag, spawn map node, set indicator
  listeners: QuestListener[]               // subscribe to domain events while in this stage
  transitions: { when: Predicate; to: StageId }[]
  onExit: QuestEffect[]                    // cleanup spawned content
}

type QuestListener =
  | { on: 'BattleVictory'; predicate: Predicate; emit: QuestEffect[] }
  | { on: 'LocationArrived'; predicate: Predicate; emit: QuestEffect[] }
  | { on: 'ItemAcquired'; predicate: Predicate; emit: QuestEffect[] }
  | { on: 'FlagSet'; predicate: Predicate; emit: QuestEffect[] }

type QuestEffect =
  | { kind: 'setFlag'; key: FlagKey; value: unknown }
  | { kind: 'grantItem'; itemId: ItemId }
  | { kind: 'recruitUnit'; classId: ClassId; level: number }
  | { kind: 'spawnNode'; ref: MapNodeRef }
  | { kind: 'unlockNode'; ref: MapNodeRef }
  | { kind: 'startCombat'; bootRequest: CombatBootRequest }
  | { kind: 'startDialogue'; treeId: DialogueId }
  | { kind: 'completeQuest'; questId: QuestId }
```

`Predicate` is **declarative JSON, not function references** — it must round-trip through save.

**Quest runner system:**

```ts
// systems/questRunner.ts — pure
function onDomainEvent(event: DomainEvent, runState: RunState): { effects: QuestEffect[] } {
  // For each active quest, find listeners matching this event whose predicates pass.
  // Return the flattened list of QuestEffects to dispatch.
}

function transitionStages(runState: RunState): { effects: QuestEffect[] } {
  // For each active quest, evaluate current stage transitions; if any pass, advance.
}
```

Foundation ships ONE stub quest (Blood Ties skeleton, 2 stages, 1 listener) to exercise the full pipeline.

## 14. Predicate AST — The Shared Rule Layer

One predicate evaluator, used by: quest stage transitions, map node visibility (`WorldNode.visiblePredicate`), dialogue branch availability, shop entry visibility, quest-locked content gates.

```ts
type Predicate =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'flag'; key: FlagKey; equals?: unknown }       // flag exists (and optionally equals value)
  | { kind: 'notFlag'; key: FlagKey }
  | { kind: 'questStage'; questId: QuestId; stage: StageId }
  | { kind: 'questComplete'; questId: QuestId }
  | { kind: 'partyHas'; classId: ClassId }
  | { kind: 'hasItem'; itemId: ItemId }
  | { kind: 'goldAtLeast'; amount: number }
  | { kind: 'visited'; ref: MapNodeRef }
  | { kind: 'cleared'; encounterId: EncounterId }
  | { kind: 'allOf'; preds: Predicate[] }
  | { kind: 'anyOf'; preds: Predicate[] }
  | { kind: 'not'; pred: Predicate }

function evaluatePredicate(pred: Predicate, runState: RunState): boolean
```

One implementation, one test surface, one place to add new predicate kinds. This is the integration spine the round-2 council insisted on.

## 15. Domain Event Bus

Separate from `errorBus`. Typed event stream that quest listeners, achievement systems, telemetry, and dev tooling subscribe to.

```ts
type DomainEvent =
  | { type: 'BattleStarted'; payload: { battleId: string; enemies: UnitId[] } }
  | { type: 'BattleVictory'; payload: { battleId: string; survivors: UnitId[]; capturedIds: UnitId[] } }
  | { type: 'BattleDefeat';  payload: { battleId: string } }
  | { type: 'UnitDied'; payload: { unitId: UnitId; cause: string } }
  | { type: 'EnemyCaptured'; payload: { unitId: UnitId; classId: ClassId; level: number } }
  | { type: 'LocationArrived'; payload: { nodeRef: MapNodeRef } }
  | { type: 'ItemAcquired'; payload: { itemId: ItemId; source: 'loot'|'shop'|'quest'|'event' } }
  | { type: 'FlagSet'; payload: { key: FlagKey; value: unknown; scope: FlagScope } }
  | { type: 'QuestStageAdvanced'; payload: { questId: QuestId; from: StageId; to: StageId } }

interface EventBus {
  emit(event: DomainEvent): void
  subscribe(listener: (e: DomainEvent) => void): () => void   // returns unsubscribe
}
```

**Bus is NOT a mutation channel.** Subscribers may dispatch back to stores; the bus itself only carries events. This preserves dispatch-chokepoint discipline.

**Bus is replay-deterministic.** Events are derived from store dispatches; the action log captures dispatches; a replay re-runs the action log and re-emits the same event sequence.

## 16. `src/contracts/` Module — Compiler-Enforced Integration Boundaries

Every cross-system data structure is exported from `src/contracts/`. TypeScript catches integration drift at compile time.

```ts
// src/contracts/crossStoreActions.ts
interface BattleResult {
  outcome: 'victory' | 'defeat' | 'fled'
  battleId: string
  survivors: UnitId[]
  fallen: UnitId[]
  xpAwards: Record<UnitId, number>
  capturedEnemies: { id: UnitId; classId: ClassId; level: number }[]
  loot: { itemId: ItemId }[]
  goldEarned: number
  consumedTravelHop: number | null
  emittedEvents: DomainEvent[]                  // events to replay through eventBus after dispatch
}

interface RecruitmentResult {
  unit: Unit
  goldCost: number
  source: 'tavern' | 'event' | 'quest'
  emittedEvents: DomainEvent[]
}

// src/contracts/handoffs.ts
interface PendingTravelPath {
  remainingNodeIds: NodeId[]
  totalHopsThisLeg: number
  rngBranch: RngState                           // forked from run RNG at travel start
}

interface CombatBootRequest {
  battleId: string
  battleMapId: MapId
  enemyGroupId: EnemyGroupId
  rngSeed: RngState
  triggeringHopIndex: number | null
  returnTo: { sceneId: 'overworld'; resumeWith: PendingTravelPath } | { sceneId: 'dungeon'; resumeWith: { dungeonId: DungeonId; nodeId: NodeId } }
}
```

`gameStore.dispatch({ type: 'applyBattleResult', payload: { result } })` runs as one atomic update on `runStore`. Then the bus replays `result.emittedEvents`. Quest listeners react. Result events are part of the result, not separately fired — keeps action log linear.

## 17. Dialogue as a First-Class Pure System

Dialogue is not UI. It's a quest substrate. The 03-29 ship plan and existing Godot use dialogue for quest events: choices set flags, advance stages, trigger combat, grant items.

```ts
// systems/dialogueRunner.ts — pure
interface DialogueTree {
  id: DialogueId
  startNodeId: DialogueNodeId
  nodes: Record<DialogueNodeId, DialogueNode>
}

interface DialogueNode {
  id: DialogueNodeId
  speaker?: string
  text: string
  choices: DialogueChoice[]                     // empty = node ends, returns control
  onEnter?: QuestEffect[]                       // unconditional
}

interface DialogueChoice {
  id: string
  text: string
  visibleIf?: Predicate                         // gates choice visibility
  enabledIf?: Predicate                         // greys out
  effects: QuestEffect[]                        // fired on selection
  next: DialogueNodeId | 'end'
}

function step(tree: DialogueTree, currentNodeId: DialogueNodeId, choiceId: string, runState: RunState):
  { nextNodeId: DialogueNodeId | 'end'; effects: QuestEffect[] }
```

Foundation ships the runner + 1 stub dialogue tree (a single greeting node, 2 choices, exercises the predicate evaluator).

UI for dialogue is React DOM — not part of foundation.

## 18. Procgen as a Pure Module

Map generation is a pure function. NEVER `Math.random()` and NEVER inline in scenes.

```ts
// procgen/dungeonGenerator.ts
function generateDungeon(rng: RNG, params: DungeonParams): DungeonGraph
```

Foundation ships a stub (linear corridor: row 0 = combat, row 1 = combat, row 2 = boss) with full schema validation. Real Slay the Spire-style generation is its own milestone, blocked by Research Deliverable #1 (see §25).

## 19. Phaser Firewall (preserved from v1)

Unchanged from v1 §11. `CombatScene` owns a `CombatRuntime` POJO (sprite refs, tween handles, hover state). Subscribes to `combatStore` event-shaped channel (`subscribeWithSelector` on `lastEffectId`). Drains effects queue, executes via runtime, emits `WaitForAnimations` complete. NEVER reads state per frame.

## 20. Data Model — Domain Types

All domain types in `src/domain/`. Zod schemas in `src/data/schemas/` mirror them. Branded IDs throughout.

(Full TypeScript interfaces from v1 §12 carry forward, plus the new types for `QuestDef`, `Predicate`, `DialogueTree`, `MapNodeRef`, `WorldMap`, `BattleMap`, `DungeonGraph`, `RngState`, `BattleResult`, `PendingTravelPath`, `CombatBootRequest`, `DomainEvent`, `TypedFlagStore`. See §7–§17 for shapes.)

## 21. Save Format

```ts
interface SaveFile {
  saveVersion: '0.5.0-foundation'
  createdAt: number
  meta: MetaState
  run: RunState | null                          // null if not in a run
  combat: CombatState | null                    // null if not mid-combat
  actionLog: ActionLogEntry[]                   // last 200, persisted
  contentAliasesApplied: string                 // version of alias table at save time
}
```

**Aliases extended:** `cardId`, `itemId`, `flagKey`, `questId`, `stageId`, `dungeonId`, `mapId`. Renames don't break in-flight saves.

**Atomic hydration unchanged from v1 §13:** parse → alias-resolve → Zod validate → swap stores in one batch. Validation fails → main menu with backup-slot option.

**Pre-alpha policy:** schema changes nuke saves with a loud warning. `saveVersion` is tracked so the migration ladder can be added when player count > 1.

## 22. Action Log + Replay (preserved from v1)

Unchanged from v1 §15. Ring buffer (last 200 actions across all stores), each entry includes `rngStateBeforeAction` for deterministic replay. `reproduce(state, action)` REPL is foundation deliverable.

## 23. Error Infrastructure (preserved from v1)

Unchanged from v1 §16. `ErrorBoundary` at React root → `errorBus.emit`. Every store action wraps `try/catch → errorBus.emit`. `<DevHud />` shows last error + last 10 actions (now also surfaces last 10 domain events from `eventBus`).

## 24. Living Reference Doc — Protocol

**Location:** `phaser/CONTEXT.md` (root of the TS project).

**Structure:** ONE file, hard-capped at **300 lines**, with twelve fixed sections, each with a per-section line budget written in the header:

```
1. Architecture Invariants (≤25 lines)
2. Three-Store Ownership Map (≤30 lines)
3. Action Catalog (≤40 lines)
4. Cross-System Contracts (≤30 lines)
5. RNG Domain Map (≤15 lines)
6. Predicate Vocabulary (≤25 lines)
7. Domain Event Catalog (≤20 lines)
8. Schema Index (links to Zod schemas, ≤15 lines)
9. File Map (where to find what, ≤25 lines)
10. Active Spec Index (which specs are current, ≤15 lines)
11. Known Gotchas (Godot lessons ported forward, ≤30 lines)
12. Open Questions (with owner + decision deadline, ≤30 lines)
```

When a section overflows, the owner *prunes the least-current entry*, not extends. Stale entries get `[STALE-YYYY-MM-DD]` markers and are removed monthly.

**What's IN:** current truth, type signatures, action names, contract pointers. **What's OUT:** rationale, alternatives, council debates, history — all in dated specs.

**Update protocol:** any PR touching `phaser/src/domain/`, `phaser/src/state/*Store.ts`, `phaser/src/systems/`, `phaser/src/contracts/`, or `phaser/src/persistence/saveFormat.ts` MUST update `phaser/CONTEXT.md` in the same commit. PR description includes "CONTEXT.md updated: [sections]" or "N/A: [reason]."

**CI enforcement:** `phaser/scripts/check-context-doc.ts` greps current type names from those source files and asserts they appear in CONTEXT.md. Drift fails the build.

**Disagreement rule (codified in `phaser/.claude/CLAUDE.md`):** *"When `phaser/CONTEXT.md` disagrees with code, the code is correct. Update the doc and call out the drift in the PR body."*

**Append-only specs:** dated specs in `docs/superpowers/specs/` are NEVER edited after merge. New spec → supersedes-link → old spec gets a one-line banner. The v1 foundation spec demonstrates this pattern.

## 25. Research Deliverables

Five research tasks, each with a concrete deliverable in `docs/research/`. These BLOCK implementation of their dependent systems but do NOT block schema-level foundation work. Each is short (1–2 pages).

| # | Topic | Deliverable | Blocks |
|---|---|---|---|
| 1 | Slay the Spire procgen rules (row count, path constraints, special placement, fog-of-war) | `docs/research/sts-procgen.md` | real `dungeonGenerator.ts` (foundation stub is fine) |
| 2 | Roguelite RNG strategies (Hades runSeed, FTL per-event seeds, StS reroll discourse) | `docs/research/roguelite-rng.md` (informs CONTEXT.md §5) | RNG hierarchy validation |
| 3 | Existing Godot quest system audit — read `autoload/quest_manager.gd` + `data/quests/quest_definitions.json` end-to-end | `docs/research/godot-quest-audit.md` (proposes TS schema for QuestDef) | `QuestDef` schema finalization |
| 4 | Stat growth math — read existing Godot `unit_data.gd` growth_rates implementation | `docs/research/stat-growth-math.md` (pure function spec) | leveling system (later milestone) |
| 5 | Enemy scaling curves — StS vs FE comparison, decision recorded | `docs/research/enemy-scaling-curves.md` + `data/curves/enemy_scaling.json` mock | difficulty tuning (later milestone) |

**Research is a prerequisite to schema finalization for #1 and #3 specifically.** A council member or a delegated subagent can produce each. Each lands as its own commit.

## 26. Testing Strategy

**Vitest (unit, fast, target 100% on `systems/`, `contracts/`, `procgen/`, `state/flags.ts`):**

- `deckBuilder.test.ts`
- `combatReducer.test.ts`
- `effectPipeline.test.ts`
- `statusEffects.test.ts`
- `targeting.test.ts`
- `turnOrder.test.ts`
- `predicates.test.ts` *(new — predicate AST evaluation, all kinds)*
- `questRunner.test.ts` *(new — listener firing, stage transitions)*
- `dialogueRunner.test.ts` *(new — choice gating, effects emission)*
- `flags.test.ts` *(new — typed flags, scope clearing)*
- `eventBus.test.ts` *(new — emit/subscribe, replay determinism)*
- `mapRegistry.test.ts` *(new — registry validation, MapNodeRef resolution)*
- `dungeonGenerator.test.ts` *(new — stub generator determinism, schema validity)*
- `rng.test.ts` *(determinism + derive)*
- `saveLoad.test.ts` *(round-trip, alias resolution including flagKey/questId, lost-and-found, atomic hydration)*
- `replay.test.ts` *(reproduce(state, action) for representative actions across all stores)*
- `battleResolver.test.ts` *(BattleResult shape, emittedEvents replay)*

**Playwright (E2E, smoke):**

- Boot: navigate, screenshot, assert canvas + React shell mount, DevHud renders.

Visual snapshot suite for combat scene rendering lands in the next milestone.

**CI:**

- `npm run typecheck` (strict)
- `npm test` (all Vitest passing)
- `npm run test:e2e` (boot smoke)
- `npm run check-context-doc` (CONTEXT.md drift)

## 27. Build Order — Risk-Driven, 5–6 Weeks

```
WEEK 1 — RESEARCH + DOMAIN + RNG + PREDICATES (the spine)
□ Reset src/ to bare scaffold (preserve tooling)
□ Research deliverables 1, 2, 3 commissioned (parallel subagents acceptable)
□ domain/ types: ALL of them — Card, Unit, Item, ClassDef, StatusEffect,
   CombatState, CombatEvent, CardEffect, MapNodeRef, WorldMap, BattleMap,
   DungeonGraph, QuestDef, QuestStage, QuestListener, QuestEffect, Predicate,
   DialogueTree, RNG, RngState, BattleResult, PendingTravelPath, CombatBootRequest,
   DomainEvent, FlagKey, FlagScope
□ Zod schemas in data/schemas/
□ Hierarchical RNG implementation + tests
□ Predicate evaluator + tests (all predicate kinds)
□ Vitest config + first ~30 tests
GOAL: every type the project will use is named, every predicate kind is testable

WEEK 2 — STORES + FLAGS + EVENT BUS + CONTRACTS
□ TypedFlagStore with scope + enumerate + tests
□ metaStore (skeletal: gameStarted)
□ runStore (full action set)
□ combatStore (reducer skeleton, dispatch chokepoint)
□ eventBus (emit/subscribe)
□ src/contracts/ — domainEvents, crossStoreActions, predicates, handoffs
□ Action log ring buffer (now spans all three stores)
GOAL: full state architecture, every action is typed, every cross-store
      mutation goes through a contract

WEEK 3 — COMBAT REDUCER + EFFECT PIPELINE + STATUS EFFECTS
□ combatReducer: every event kind handled
□ effectPipeline with middleware ordering (6 stages)
□ statusEffects registry: poison + burn with all lifecycle hooks
□ deckBuilder: innate + handLeft.gearCards + handRight.gearCards
□ Representative content: 3 classes, 10 gear items, 2 status effects,
   ~20 cards (innate) + ~30 cards (gear)
□ Tests: every reducer event, every middleware stage, every status interaction,
   full card-play flows
GOAL: a card resolves end-to-end with full pipeline coverage

WEEK 4 — QUESTS + DIALOGUE + MAP REGISTRY
□ questRunner: domain event subscription, stage transitions
□ Stub Blood Ties quest (2 stages, 1 listener) exercising full pipeline
□ dialogueRunner: choice gating, effect emission
□ Stub greeting dialogue (1 node, 2 choices)
□ MapRegistry with overworld + battleTemplates + dungeonGenerators
□ Stub overworld map (1 location, 0 edges)
□ Stub dungeon generator (3-row linear corridor)
□ Stub battle map (14×10 grid, all plain tiles, simple spawn zones)
□ Tests: questRunner with sample events, dialogueRunner with stub tree,
   mapRegistry validation, dungeonGenerator determinism
GOAL: every system in the GDLC has a working skeleton

WEEK 5 — PERSISTENCE + ERROR INFRA + PHASER FIREWALL SHELL + LIVING DOC
□ Save/load with atomic hydration, full alias table (cardId, itemId,
   flagKey, questId, stageId, dungeonId, mapId)
□ Replay harness: reproduce(state, action) across all stores
□ ErrorBoundary, errorBus, DevHud (with eventBus tail + actionLog tail)
□ CombatRuntime POJO + CombatScene shell that drains effects queue
□ Boot scene loads validated content via MapRegistry
□ phaser/CONTEXT.md skeleton + scripts/check-context-doc.ts CI guard
□ phaser/.claude/CLAUDE.md updated with research mandate
□ Root CLAUDE.md banner: "describes deprecated Godot codebase, see phaser/CONTEXT.md"
□ Playwright smoke: boot, screenshot, DevHud snapshot
GOAL: a player can boot, see a placeholder grid, dispatch an action,
      watch the action log + event bus + flag state update, see no crashes

WEEK 6 — STABILIZATION + DOCS + RESEARCH 4-5 + READINESS GATE
□ Research deliverables 4, 5 commissioned (parallel)
□ All tests green, typecheck strict-passing
□ CONTEXT.md populated (all 12 sections)
□ Foundation milestone retro: what schemas to revisit before next milestone
□ Tag commit phaser-foundations-v2
GOAL: foundation milestone shipped; ready for first feature milestone
      (real combat scene rendering + first real overworld map)
```

## 28. Risks

- **Schema overcommitment.** Locking 25+ types in week 1 means *some* will need revision in months 2–3. Mitigation: alias table absorbs renames; council `Open Questions` track decisions to revisit.
- **Reducer + middleware + listener cognitive load.** Three different "things subscribe to events" patterns (combat reducer, predicate evaluator, quest listeners) — risk of agents confusing them. Mitigation: explicit naming (`CombatEvent` ≠ `DomainEvent` ≠ `QuestListener`), docs in CONTEXT.md.
- **CI drift checks brittle.** Grep-based CONTEXT.md check could false-positive on benign refactors. Mitigation: drift check accepts `[INTENTIONAL-OMIT: reason]` markers in source files for genuinely-omittable types.
- **Pre-alpha save policy bites first player.** Acknowledged. We track `saveVersion` so the migration ladder can be added without retrofit; we don't build the ladder yet.
- **Foundation vs feature tension.** 5–6 weeks of foundation with no shippable scene is morale-hard. Mitigation: each weekly goal in §27 is a tangible artifact (week 1: types compile; week 2: action log shows dispatches; week 3: a card resolves; week 4: a quest stage advances; week 5: boot smoke; week 6: green CI).
- **Action log size.** ~200 entries × ~250 bytes (now includes domain event payload) = ~50KB per save. Fine for desktop; revisit on mobile.

## 29. Success Criteria

The foundation is shipped when all of:

1. `npm run typecheck` strict + `noUncheckedIndexedAccess` clean.
2. Vitest passes ≥80 tests across `systems/`, `state/`, `contracts/`, `procgen/`, `mapRegistry/`, `persistence/`.
3. Playwright passes the boot smoke.
4. `npm run check-context-doc` passes — every domain type, store action, contract type, and save field is referenced in `phaser/CONTEXT.md`.
5. Representative content loads + validates: 3 classes, 10 items, 2 status effects, ~50 cards, 1 stub overworld map, 1 stub dungeon generator, 1 stub quest, 1 stub dialogue.
6. Replay harness reproduces state from action log for representative actions across all three stores.
7. DevHud surfaces the last 10 actions, last 10 domain events, last error, and active flag enumeration.
8. Five research deliverables present in `docs/research/` (1–3 from week 1, 4–5 from week 6).
9. README documents `dev`, `test`, `test:e2e`, `check-context-doc`, `build`.
10. CONTEXT.md is at or under 300 lines with every section populated.

If any fail, foundation is reconsidered before any feature milestone begins.

## 30. Open Questions Deferred to Future Milestones

- Combat scene rendering: tween coordination, hit-stop timing, AOE preview, damage-number animation
- Card hand UI, target selection UI
- Grid inventory drag-drop UI (React + dnd-kit)
- Overworld scene rendering (sprite map, location nodes, pawn movement)
- Town menus (Inn / Shop / Tavern panels)
- Dungeon scene rendering
- Real Slay the Spire procgen (blocked on research deliverable #1)
- Real overworld map content (one map ships in foundation, more in next milestone)
- Real quest content (Blood Ties full implementation)
- Slow + immobilize status effects (with their gear)
- Audio routing
- Save migration ladder activation
- Internationalization
- Achievements / metaStore expansion
- Recruitment UI
- Steam packaging path

## 31. Council Acknowledgements

This spec is the product of two council-of-five reviews on the same day.

**Round 1** (combat architecture): Legacy Code Archaeologist, Functional Purist, Game Designer Who Codes, Sleep-Deprived On-Call Engineer, Latency Hunter. Drove: 2-store collapse with single-dispatch chokepoints, combat as reducer over event union, effect pipeline as load-bearing center, action log + seeded RNG + atomic hydration, Phaser-Zustand firewall via CombatRuntime.

**Round 2** (full GDLC): Roguelite Lead Architect, Procgen Cartographer, Quest System Surgeon, Living Documentation Skeptic, Cross-System Integration Auditor. Drove: three-store split (added `runStore`), MapRegistry + MapNodeRef identity protocol, hierarchical RNG with `deriveRng`, quest engine bones (TypedFlagStore + Predicate AST + QuestDef + QuestListener), shared predicate evaluator, domain event bus, `src/contracts/` module with explicit cross-system types, dialogue as first-class pure system, living reference doc with CI drift check + 300-line cap, research deliverables with concrete artifacts, fix-the-stale-CLAUDE.md.

Each addition is paid for by a specific failure mode the council predicted. The 5–6 week foundation budget is not a luxury — it's the deliberate trade against architectural retrofits that would cost 2–3 weeks each, multiplied across ten concerns.
