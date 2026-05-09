# phaser/CONTEXT.md — Living Reference for AI Agents

> **READ FIRST.** Current architectural truth for the FE_MB phaser TypeScript migration. Hard-capped at 300 lines. When code disagrees with this doc, **the code is correct** — update the doc and call out the drift in your PR body.

> **Working spec:** `../docs/superpowers/specs/2026-05-08-phaser-foundations-v2-design.md`. All design rationale lives there; this file holds CURRENT-truth pointers only.

> **Status:** Skeleton — populated as foundation milestone progresses (Week 1 → Week 6). Sections marked `[STUB]` are scheduled but not yet authoritative.

---

## 1. Architecture Invariants (≤25 lines)

1. **Combat = Phaser canvas only.** Everything else (overworld, town, shop, inventory, deck preview, dialogue, modals) = React DOM with Tailwind.
2. **Three Zustand stores, single dispatch each:** `metaStore` (cross-run unlocks), `runStore` (current run), `combatStore` (current battle, ephemeral). Mutation only via `dispatch(action)`.
3. **Pure systems** in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O. Take state in, return new state + effects out.
4. **Combat is a reducer** over a discriminated `CombatEvent` union. `reduce(state, event, rng) → { state, effects }`. Effects are intents to render, not state.
5. **Phaser firewall:** `CombatScene` owns a mutable `CombatRuntime` POJO (sprite refs, tween handles). Subscribes to `combatStore` event-shaped channel (`subscribeWithSelector` on `lastEffectId`). NEVER reads state per frame.
6. **`Math.random()` is forbidden.** All randomness flows through `RNG` parameters. Hierarchical: `deriveRng(parent, label)` per subsystem.
7. **Cross-system writes go through `src/contracts/` types.** `BattleResult`, `RecruitmentResult`, `PendingTravelPath`, `CombatBootRequest`, `DomainEvent`. Compiler enforces integration boundaries.
8. **Predicates are declarative AST**, not function references. Round-trips through save. One evaluator (`systems/predicates.ts`) used by quest transitions, map gates, dialogue gates, shop gates.
9. **Domain events** (`BattleVictory`, `LocationArrived`, etc.) flow through `eventBus`. Quest listeners subscribe; subscribers dispatch back to stores. Bus is NOT a mutation channel.
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
| `phase`, `subPhase`, `units`, `decks`, `grid`, `effects[]` | `combatStore` | one battle | battle end |
| `combatStore.rng` (derived from run-RNG per battle) | `combatStore` | one battle | battle end |

**Cross-cutting transactions** (atomic via single dispatch):
- `runStore.dispatch({ type: 'applyBattleResult', payload })` — handles XP, fallen, loot, gold, captures, flag updates, hop consumption, in one update.
- `runStore.dispatch({ type: 'recruitUnit', payload })` — adds to party + deducts gold + emits event.

## 3. Action Catalog (≤40 lines) `[STUB — fills in Week 2]`

Stores expose a `useMetaStore` / `useRunStore` / `useCombatStore` Zustand hook, each with a single `dispatch(action)` chokepoint. Action unions: `MetaAction`, `RunAction`, `CombatEvent`. `combatStore` state shape: `CombatStoreState` wrapping `CombatState`.

**`metaStore` actions** (`MetaAction` union):
- `startNewRun`
- `recordRunCompleted { won }`

**`runStore` actions** (15 total — `RunAction` union in `state/runStore.ts`):
- `recruitUnit { unit }`
- `fallenUnit { unitId, cause, turn }`
- `equipHand { unitId, slot, itemId }`
- `moveItemInBag { itemId, x, y }`
- `addGold { amount }`
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

**`combatStore` events** (`CombatEvent` union, see `domain/combatState.ts`):
- `startBattle { units, grid, rngSeed }`
- `startTurn { unitId }`
- `selectCard { cardId }`
- `cancelSelection`
- `playCard { cardId, srcId, targets }`
- `moveUnit { unitId, tileId }`
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
- `data/schemas/card.ts` ↔ `Card` (`CardSchema`, `WeaponTypeSchema`). **Active.**
- `data/schemas/unit.ts` ↔ `Unit` (`UnitSchema`, `UnitStatsSchema`). **Active.**
- `data/schemas/item.ts` ↔ `Item` (`ItemSchema`). **Active.**
- `data/schemas/class.ts` ↔ `ClassDef` (`ClassSchema`). **Active.**
- `data/schemas/statusEffect.ts` ↔ `StatusEffectDef` (`StatusEffectDataSchema` — JSON-shape only; function hooks live in code registry). **Active.**
- `data/schemas/map.ts` ↔ `WorldMap | BattleMap` (DungeonGraph schema TBD with generator). **Active.**
- `data/schemas/quest.ts` ↔ `QuestDef` (`QuestSchema`, `QuestStageSchema`, `QuestEffectSchema`). **Active.**
- `data/schemas/dialogue.ts` ↔ `DialogueTree`. **Active.**
- `data/schemas/predicate.ts` ↔ `Predicate` (recursive via `z.lazy`). **Active.**
- `persistence/saveFormat.ts` ↔ `SaveFile` (`SAVE_VERSION = '0.5.0-foundation'`, `SerializedRunState`, `SerializedMetaState`). **Active.**
- `persistence/contentAliases.ts` ↔ `ContentAliases` (`cardId | itemId | flagKey | questId | stageId | dungeonId | mapId` maps, `resolveAlias`). **Active.**

## 9. File Map (≤25 lines)

```
phaser/src/
├── domain/         pure types (no I/O)
├── contracts/      cross-system integration types (compiler-enforced)
├── data/
│   ├── schemas/    Zod schemas
│   ├── content/    JSON content (classes, cards, items, quests, dialogue, maps)
│   └── load.ts     parse + validate + alias-resolve at boot
├── systems/        pure functions: deckBuilder, combatReducer, effectPipeline,
│                   statusEffects, targeting, turnOrder, capture, enemyAI,
│                   predicates, questRunner, dialogueRunner, battleResolver
├── procgen/        pure deterministic generators: dungeonGenerator (stub),
│                   overworldGenerator (stub)
├── mapRegistry/    MapRegistry: registry of world/battle/dungeon maps
├── state/          metaStore, runStore, combatStore, flags, eventBus, errorBus, actionLog
├── persistence/    saveFormat, save, load (atomic hydration), contentAliases
├── game/           createGame.ts + scenes/ (BootScene, CombatScene) + runtime/ (CombatRuntime POJO)
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
- **`combatReducer` team detection** uses `classId.includes('bandit'|'mage')` as a foundation heuristic — replace with explicit `team` field on Unit (or spawn payload) when starter content lands.

## 12. Open Questions (≤30 lines) `[STUB — populated as decisions arise]`

| # | Question | Owner | Decision deadline |
|---|---|---|---|
| OQ-1 | Dungeon fog-of-war: full reveal / lookahead-1 / reveal-on-enter? | research deliverable #1 | Week 6 (foundation end) |
| OQ-2 | Overworld procgen vs hand-authoring (Godot has hand-authored JSON; TS can do either) | TBD | next milestone |
| OQ-3 | Recruitment cost formula for tavern recruits | TBD | recruitment milestone |
| OQ-4 | Animation timing as data — `card.effects[].durationMs` granularity | TBD | combat-rendering milestone |
| OQ-5 | Save migration ladder activation point — when does player count justify it? | project owner | post-foundation |
| OQ-6 | Audio engine: Phaser built-in vs Howler vs Web Audio API direct | TBD | polish milestone |
| OQ-7 | Mobile/Steam Deck targeting — affects bag size / save quotas | TBD | v1.0 planning |

---

**Update protocol:** any PR touching `phaser/src/domain/`, `phaser/src/state/*Store.ts`, `phaser/src/systems/`, `phaser/src/contracts/`, or `phaser/src/persistence/saveFormat.ts` MUST update this file in the same commit. CI check: `phaser/scripts/check-context-doc.ts` greps current type names from those source files and asserts they appear here. Drift fails the build.

**When this file overflows 300 lines:** prune the least-current entry per section, do NOT extend. Stale entries get `[STALE-YYYY-MM-DD]` markers; removed monthly.
