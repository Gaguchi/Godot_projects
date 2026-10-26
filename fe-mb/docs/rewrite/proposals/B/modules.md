# Proposal B — module map

Companion to `types.ts`, `actions.ts`, `rules.ts`. Every file below lives under `game/src/` unless noted. Signatures use the types from `types.ts`/`actions.ts`. "May import" is enforced by eslint `no-restricted-imports` per directory (five fences, listed at the end).

Legend for the brief: `§n.m` = `docs/rewrite/BRIEF.md` section; `D:` = `DECISIONS.md`.

## 0. Layering (the fences)

```
ui/ ─────────────▶ engine/reducer.ts, engine/flow/*, engine/save/*, engine/types|actions|rules   (never engine/combat/* or engine/run/* directly except pure selectors)
engine/reducer.ts ▶ engine/{meta,run,combat,flow}/*, content.ts
engine/flow/*  ───▶ engine/run/*, engine/combat/* (both — it is the only cross-slice layer besides reducer.ts)
engine/run/*   ───▶ engine/run/*, engine/procgen/*, engine/rng, types, rules   (type-only import of BattleResult from types)
engine/combat/*───▶ engine/combat/*, engine/rng, engine/boardFloor, types, rules   (NEVER run/, flow/, content.ts)
engine/save/*  ───▶ types, actions, rules, reducer.ts (replay), zod
engine/content.ts ▶ content/schemas (zod-parsed JSON), types
scripts/cli.ts ───▶ engine/* (no ui/)
```

Nothing under `engine/` imports React, the DOM, `Math.random`, `Date`, `localStorage` or `fetch` (eslint). The seed for a new run is the one externally supplied number and it is logged.

## 1. `engine/` root files

### `engine/types.ts`, `engine/actions.ts`, `engine/rules.ts`
As proposed. `rules.ts` exports `RULES`, `KNOBS`, `SAVE_VERSION`.

### `engine/content.ts` — §2.12 (registry), §3, §7.23
```ts
export function buildRegistry(parsed: ParsedContent): ContentRegistry   // ParsedContent = output of src/content/index.ts (zod-validated JSON)
export function contentVersion(parsed: ParsedContent): string           // FNV-1a over the canonical JSON; stored in saves and logs
export function nodeDistances(sheet: OverworldSheet): Record<NodeId, number>   // BFS from sheet.startNodeId (area tier input)
export function lintContent(reg: ContentRegistry, rules: Rules): LintIssue[]   // cross-reference lint: every id kind, every flag key read has a writer, effect params consumed, deck sizes, prices, no buyPrice on E/L, every recruitCharacter id exists, every encounterTableId matches, every town/dungeon node has a def, every advanceQuestStage.toStage declared
```
May import: `content/schemas`, `types`, `rules`, `run/predicates` (to walk predicates for flag keys), `combat/cards` (`CONSUMED_PARAMS`). `npm run verify` runs `lintContent` (`scripts/lint-content.ts`).

### `engine/reducer.ts` — root reducer, §2.1 (RNG in state), §2.8, §2.12 (settle), §7.13
```ts
export function reduce(state: GameState, action: Action, ctx: EngineContext): ReduceResult
```
Order inside `reduce`:
1. `isUiAction` → `ui` slice only; return.
2. Namespace switch → `meta/reducer`, `run/reducer` (run + travel + node + narrative + quest actions), `combat/reducer` (combat actions; `battle/continue` and `combat/start` go through `flow/battle`), `flow/lifecycle` (`run/new`, `run/continue`, `flow/*`, `save/*`, `tutorial/skip`), `dev`.
3. Post-steps, every dispatch, in this order:
   - `flow/battle.finishBattleIfOver(state, ctx)` — if `combat.phase !== 'COMBAT' && !combat.resolved`: `resolveBattle` → `applyBattleResult` (ONE atomic payout) → `combat.resolved = true`, `run.lastBattle = result`; on DEFEAT (or MC death when the knob is on) `endRun(state, 'lost')` immediately.
   - `run/quests.settleQuests(run, ctx)` — fixed point ≤ `RULES.quests.maxSettlePasses`; only when `run` changed identity.
   - `flow/screen.route(state)` — `screen = deriveScreen(state)`; emits `screenChanged` when it differs.
   - dev only: `invariants.assertInvariants(state, ctx)` and `Object.freeze` deep.
4. Returns `{ state, effects }`; the `persist` effect is appended by the root reducer whenever `meta`/`run`/`combat`/`ledger` changed identity (`what: 'meta' | 'run'`), and `clearRun` on `save/deleteRun` / `run/new`.

Also exports the slice-free helpers tests use:
```ts
export function reduceMany(state: GameState, actions: readonly Action[], ctx: EngineContext): ReduceResult   // effects concatenated
```

### `engine/invariants.ts` — §7 (structural rules as runtime asserts, dev/test only)
```ts
export function assertInvariants(state: GameState, ctx: EngineContext): void
```
Checks: `screen === deriveScreen(state)`; combat living units have positions and unique tiles; `turn.unitId` is living and uncaptured; exactly one of `pendingDialogue|pendingCheckEvent|pendingNamePrompt` open unless nested by design (dialogue may set pendingCombat); `travel.phase === 'suspended'` ⇒ a suspender is open or a combat exists with `origin.kind === 'travel'`; `lastBattle !== null` ⇔ `combat?.resolved`; every bag rectangle inside 8×4 and non-overlapping; gold ≥ 0; food charges ≥ 0; `run.party.order` ⇔ `units` keys; no dead unit in `party`.

## 2. `engine/combat/` — pure, run-agnostic, sim-ready

All functions take `CombatContext` (a `Pick` of the registry + `Rules`) so a sim passes fixture cards/classes. Nothing here reads `RunState`.

### `combat/grid.ts` — §2.1, §2.3
```ts
export function tileKey(x: number, y: number): TileId
export function parseTile(t: TileId): { x: number; y: number }
export function manhattan(a: TileId, b: TileId): number
export function inBounds(grid: CombatGrid, t: TileId): boolean
export function isObstacle(grid: CombatGrid, t: TileId): boolean            // binary search over the sorted array
export function neighbors4(t: TileId): readonly TileId[]
export function tilesInRange(grid: CombatGrid, origin: TileId, min: number, max: number): readonly TileId[]   // obstacles excluded
export function tilesInAoe(grid: CombatGrid, center: TileId, radius: number): readonly TileId[]              // center included
export function occupiedTiles(units: Readonly<Record<UnitId, CombatUnit>>, except?: UnitId): ReadonlySet<TileId>   // LIVING, uncaptured only (§7.3)
export function reachableTiles(grid: CombatGrid, origin: TileId, mov: number, blocked: ReadonlySet<TileId>): readonly TileId[]   // 4-dir BFS
export function findPath(grid: CombatGrid, origin: TileId, dest: TileId, mov: number, blocked: ReadonlySet<TileId>): readonly TileId[] | null
export function distanceField(grid: CombatGrid, dest: TileId, blocked: ReadonlySet<TileId>, allow: TileId): Readonly<Record<TileId, number>>   // AI flood (§7.4)
export function livingUnitAt(combat: CombatState, t: TileId): CombatUnit | null
```

### `combat/initiative.ts` — §2.1 (queue is DERIVED, never stored)
```ts
export function effectiveSpd(u: CombatUnit): number                        // stats.spd + slow delta
export function initiativeQueue(units: readonly CombatUnit[]): readonly UnitId[]   // living & uncaptured; SPD desc, party first on tie, then id asc
export function nextInQueue(queue: readonly UnitId[], current: UnitId): { readonly unitId: UnitId; readonly wrapped: boolean }
export function initiativeStrip(combat: CombatState, visible: number): { readonly ids: readonly UnitId[]; readonly more: number }   // HUD selector (8 + "+N")
```
The queue is rebuilt from `combat.units` at every `endTurn` and for every HUD render; slow re-sorts at the next endTurn and dead/captured units drop out by construction. `turn.number++` when `wrapped`.

### `combat/deck.ts` — §2.7
```ts
export function buildDeck(unit: UnitCore, ctx: CombatContext): DeckState        // innate + left + right + signature, tagged; quiver mods baked; all in draw, hand empty
export function draw(deck: DeckState, count: number, rng: RngState): { readonly deck: DeckState; readonly rng: RngState; readonly reshuffled: boolean }   // reshuffles discard→draw with rng when dry; zero card loss
export function discardHand(deck: DeckState): DeckState
export function shuffleDraw(deck: DeckState, rng: RngState): { readonly deck: DeckState; readonly rng: RngState }
```

### `combat/statuses.ts` — §2.4
```ts
export function mergeStatus(statuses: readonly ActiveStatus[], id: StatusId, stacks: number, turns: number, sourceId: UnitId | null, rules: Rules): readonly ActiveStatus[]
export function hasStatus(u: CombatUnit, id: StatusId): boolean
export function isImmobilized(u: CombatUnit): boolean
export function slowDelta(u: CombatUnit): number
export function empowerBonus(u: CombatUnit): number
export function consumeEmpower(u: CombatUnit): CombatUnit
export function tickOwnerTurnEnd(u: CombatUnit, rules: Rules): { readonly unit: CombatUnit; readonly effects: readonly Effect[] }   // DOT (poison piercing, burn magic split) + decrement ownerTurnEnd statuses
export function decrementOwnerTurnStart(u: CombatUnit): { readonly unit: CombatUnit; readonly effects: readonly Effect[] }
export function cleanse(u: CombatUnit, rules: Rules): { readonly unit: CombatUnit; readonly effects: readonly Effect[] }
```

### `combat/damage.ts` — §2.2 (forecast == applied)
```ts
export function damageReduction(target: CombatUnit, type: DamageType, grid: CombatGrid, rules: Rules): { readonly dr: number; readonly terrainDr: number }
export function splitDamage(hp: UnitHp, armor: number, amount: number, type: DamageType): { readonly hp: number; readonly armor: number; readonly hpLost: number; readonly armorLost: number }   // physical armor-first; magic floor/ceil; ≤0 no-op
export function computeForecast(combat: CombatState, attackerId: UnitId, cardOrAction: PlayableCard, requestedTargetId: UnitId, ctx: CombatContext): Forecast | null   // calls resolveCoverTarget FIRST; null for utility cards
export function capArmor(u: CombatUnit, armor: number, rules: Rules): { readonly armor: number; readonly capped: boolean }
```
`PlayableCard` = `Pick<Card, 'apCost' | 'range' | 'targetKind' | 'aoeRadius' | 'damageStat' | 'effects'>` — cards, potions and AI actions all satisfy it.

### `combat/cover.ts` — §2.2, §2.16 (Genatsvale is a first-class step)
```ts
export function resolveCoverTarget(combat: CombatState, attackerId: UnitId, targetId: UnitId): { readonly targetId: UnitId; readonly protectorId: UnitId | null }
export function recordCover(combat: CombatState, protectorId: UnitId, protecteeId: UnitId): CombatState
```
Rule: only for hostile Damage effects (not DOT, not riposte, not self-inflicted); candidates = living allies of the target with `'genatsvale'` in `passives`, orthogonally adjacent to the target, whose `coverUsed` lacks `targetId`; first by id. The forecast, the reducer's Damage path and the AI's expected-damage scorer all call this ONE function.

### `combat/cards.ts` — §2.3 (effect resolution, exhaustive)
```ts
export interface PlaySpec { readonly sourceId: UnitId; readonly card: PlayableCard; readonly cardId: CardId | null; readonly tile: TileId | null; readonly mods: QuiverModifier | null }
export function validatePlay(combat: CombatState, unitId: UnitId, card: PlayableCard, tile: TileId | null, ctx: CombatContext): { ok: true } | { ok: false; reason: string }   // AP, range, targetKind vs occupant, all_* need no tile
export function resolvePlay(combat: CombatState, play: PlaySpec, ctx: CombatContext): { readonly combat: CombatState; readonly effects: readonly Effect[] }
export function recipients(combat: CombatState, play: PlaySpec, selector: CardEffect['target']): readonly CombatUnit[]   // self | target | ally | area; tile cards never status allies; damage foe-only
export const CONSUMED_PARAMS: Readonly<Record<CardEffect['kind'], readonly string[]>>   // the lint's truth table
```
`resolvePlay` order: cover redirect per Damage effect → AOE expansion (manhattan radius, foe/ally split by `team`) → effects in authored order → quiver mods to foes → riposte → deaths (position → null) → `checkEnd`. Effect kinds implemented: Damage, Heal, ApplyStatus (+splash adjacent), RemoveStatus (armor N|all, debuff), Move (toward the target up to `distance`), GrantArmor (capped by knob), DrawCards (+gainAp), GainAp. Anything else is rejected by the content lint before it can reach here (D: no silent approximations).

### `combat/capture.ts` — §2.6
```ts
export function captureChance(target: CombatUnit, adjacentAllies: number, bountyHunter: boolean, rules: Rules): number
export function adjacentAllies(combat: CombatState, targetId: UnitId, team: Team): number
export function tryCapture(combat: CombatState, attackerId: UnitId, targetId: UnitId, ctx: CombatContext): { readonly combat: CombatState; readonly effects: readonly Effect[] }   // 2 AP, adjacency, roll from combat.rng, writes rng back; success → hp 0, captured, position null
```

### `combat/items.ts` — §2.3 consumables
```ts
export function useItem(combat: CombatState, unitId: UnitId, itemId: ItemId, ctx: CombatContext): { readonly combat: CombatState; readonly effects: readonly Effect[] }   // builds a self-target PlayableCard from Item.effect, apCost 1; moves itemId consumables→consumedItems
```

### `combat/ai.ts` — §2.5, §7.4, §7.21
```ts
export type AiStep = { kind: 'move'; to: TileId; path: readonly TileId[] } | { kind: 'act'; action: EnemyAiAction; tile: TileId } | { kind: 'endTurn' }
export function planStep(combat: CombatState, unitId: UnitId, ctx: CombatContext): { readonly step: AiStep; readonly rng: RngState }   // pure over (combat, combat.rng); weighted pick writes rng
export function pickRoleTargets(combat: CombatState, self: CombatUnit, profile: EnemyAiProfile, ctx: CombatContext): { primary: UnitId | null; desired: TileId | null }
export function expectedDamage(combat: CombatState, attackerId: UnitId, action: EnemyAiAction, targetId: UnitId, ctx: CombatContext): number   // via computeForecast (cover-aware)
```
Step derivation: `!hasMovedThisTurn && desired !== position` → move (distance-field stepping, `mov` steps, banned revisits); else if budget allows (`knobs.enemyActionBudget === 1 ? ap === apPerTurn : ap ≥ 1`) and an eligible action exists (situation + post-move range) → act; else endTurn. Taunters override targeting for rusher/tank/archer; healer heals lowest-fraction wounded ally in range else targets the furthest party unit.

### `combat/turn.ts` — §2.1 endTurn order
```ts
export function checkEnd(combat: CombatState, rules: Rules): CombatPhase       // no enemy alive&uncaptured → VICTORY; no party alive → DEFEAT; MC dead → DEFEAT if knob
export function endTurn(combat: CombatState, ctx: CombatContext): { readonly combat: CombatState; readonly effects: readonly Effect[] }
export function startTurn(combat: CombatState, unitId: UnitId, ctx: CombatContext): { readonly combat: CombatState; readonly effects: readonly Effect[] }   // ap 3, hasMoved false, coverUsed [], ownerTurnStart decrement, armor reset if knob, draw to 5
```

### `combat/seed.ts` — §2.8, §2.15, §7.5, §7.20, §7.26
```ts
export function seedBattle(spec: BattleSpec, ctx: CombatContext): CombatState        // throws on unknown ids or off-board unit
export function buildEnemyUnits(group: EnemyGroup, level: number, ctx: CombatContext): readonly CombatUnit[]   // stable member ids (+`_N`), level = max(authored, level), scaleEnemyForLevel, bountyValue copied
export function enemySpawnTiles(grid: CombatGrid, partyTiles: readonly TileId[], enemies: readonly CombatUnit[], ctx: CombatContext): readonly TileId[]   // within one move + attack
export function tutorialSpec(mc: UnitCore, rng: RngState, ctx: CombatContext): BattleSpec
```
Party units enter with RUN HP, `ap 3`, `armor 0`, `statuses []`, positions from `partySlots`; decks built per unit; opening hands dealt (`shuffleDraw` + `draw(5)`) from `spec.rng`; the first unit of the initiative queue starts.

### `combat/resolve.ts` — §2.8, §2.13, §7.30
```ts
export interface ResolveInput { readonly ownedItemIds: readonly ItemId[]; readonly regionId: RegionId; readonly lootRng: RngState }
export function resolveBattle(combat: CombatState, input: ResolveInput, ctx: CombatContext): BattleResult   // gold 10+5L per dead uncaptured; loot by (battleTag, regionTier); survivorHp; fallen; captured with name+bounty; consumedItems
export function killGold(level: number, rules: Rules): number
```
`resolveBattle` is pure and run-agnostic; `run/payout.ts` applies it.

### `combat/reducer.ts` — the isolated combat reducer
```ts
export function reduceCombat(combat: CombatState, action: CombatAction, ctx: CombatContext): { readonly combat: CombatState; readonly effects: readonly Effect[] }
```
Cases: `combat/start` (delegates to `seedBattle`), `selectCard`, `pinTarget`, `cancel`, `playCard` (validate → `resolvePlay`), `enterMoveMode`, `moveUnit`, `useItem`, `capture`, `endTurn`, `aiStep` (`planStep` → apply as `moveUnit` | `resolvePlay` | `endTurn`). Refusals return the same object + `refused`. `battle/continue` is NOT handled here (it needs the run) — `flow/battle.ts`.

### `combat/sim.ts` — balance sims (§2.13 targets, §7.1, §7.2)
```ts
export type Policy = (combat: CombatState, ctx: CombatContext) => CombatAction        // player policy; enemies use aiStep
export const greedyPolicy: Policy                                                        // highest forecast damage, else move toward nearest, else end turn
export function autoBattle(spec: BattleSpec, ctx: CombatContext, policy: Policy): SimResult   // runs to a terminal phase or throws `RoundCapError` with a per-round dump
export interface SimResult { readonly outcome: CombatPhase; readonly turns: number; readonly firstBloodRound: number | null; readonly finalState: CombatState; readonly log: readonly Effect[] }
export function sweep(specs: readonly BattleSpec[], ctx: CombatContext, policy: Policy): SweepRow[]   // per-scenario win %, avg turns, stalemates (must be 0)
```

## 3. `engine/run/` — the company on the road

### `run/reducer.ts`
```ts
export function reduceRun(state: GameState, action: RunAction | TravelAction | NodeAction | NarrativeAction, ctx: EngineContext): ReduceResult
```
Thin switch delegating to the modules below. Takes `GameState` (not just `RunState`) because a handful of cases seed a battle (`dungeon/moveTo`, `boss/challenge`, dialogue end with `pendingCombat`) and those go through `flow/battle.startBattleFromRun`, which is the one allowed cross-slice call.

### `run/newRun.ts` — §2.13 start kit, §2.15, §2.16
```ts
export function seedNewRun(seed: number, ctx: EngineContext): RunState   // runId = `run-${seed}`, rng {seed, counter 0}, characters from RULES.startKit, gear equipped from CharacterDef.startingGear, bag from RULES.startKit.bag, node = sheet.startNodeId, day 1, everything else empty/null/idle
```

### `run/characters.ts` — §2.16
```ts
export function buildUnitFromCharacter(def: CharacterDef, ctx: EngineContext): UnitCore   // id = def.id; stats = class base lifted by level unless statOverrides; hp = startingHp + 3(L−1); team, hands, passives, signature cards; NO Date.now()
export function buildUnitFromClass(classId: ClassId, level: number, id: UnitId, name: string, team: Team, ctx: EngineContext): UnitCore
export function displayName(unit: Pick<UnitCore, 'characterId' | 'name'>, run: Pick<RunState, 'mcName'>): string   // 'mc' → mcName ?? placeholder
export function portraitId(unit: Pick<UnitCore, 'characterId' | 'id' | 'classId'>): string   // id, id minus `_N`, class fallback
```

### `run/party.ts` — §2.14, §2.16
```ts
export function livingUnits(run: RunState): readonly UnitCore[]
export function recruitCharacter(run: RunState, characterId: CharacterId, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }   // no-op if in party or deathLog; refuse past cap 6; flag `recruited.<id>` permanent
export function removeFallen(run: RunState, fallen: readonly UnitId[], cause: DeathRecord['cause'], battleId: BattleId | null): { run: RunState; effects: readonly Effect[] }
export function isMcDead(run: RunState): boolean
```

### `run/bag.ts` — §2.7 (spatial), §7.22
```ts
export function footprint(item: Item): { w: number; h: number }
export function fits(bag: readonly BagEntry[], item: Item, x: number, y: number, rules: Rules, ignore?: BagEntry): boolean
export function placeFirstFit(bag: readonly BagEntry[], item: Item, charges: number, rules: Rules): readonly BagEntry[] | null
export function placeAll(bag: readonly BagEntry[], items: readonly { item: Item; charges: number }[], rules: Rules): readonly BagEntry[] | null   // all-or-nothing
export function removeAt(bag: readonly BagEntry[], x: number, y: number): readonly BagEntry[]
export function removeFirst(bag: readonly BagEntry[], itemId: ItemId): readonly BagEntry[]        // consumedItems payout
export function foodCount(bag: readonly BagEntry[]): number                                          // sum of ration charges
export function consumeFoodCharges(bag: readonly BagEntry[], count: number): readonly BagEntry[]    // decrements, removes at 0
export function addFoodCharges(bag: readonly BagEntry[], count: number, ctx: EngineContext): readonly BagEntry[] | null
export function ownedItemIds(run: RunState): readonly ItemId[]                                       // bag + all hands (loot exclusion, hasItem)
```

### `run/equipment.ts` — §2.7 (atomic dry-run plan; ported shape)
```ts
export type EquipPlan = { ok: true; hands: HandSlots; bag: readonly BagEntry[] } | { ok: false; reason: string }
export function planEquip(unit: UnitCore, slot: 'left' | 'right', itemId: ItemId, bag: readonly BagEntry[], ctx: EngineContext): EquipPlan
export function planUnequip(unit: UnitCore, slot: 'left' | 'right', bag: readonly BagEntry[], ctx: EngineContext): EquipPlan
```

### `run/economy.ts` — §2.6 bounty, §2.10 shop/inn, §2.13 prices
```ts
export function buyPriceOf(item: Item): number | null           // null = unbuyable (E/L, absent buyPrice)
export function sellPriceOf(item: Item, rules: Rules): number
export function shopStockFor(town: TownDef, tier: RegionTier, day: number, run: RunState, ctx: EngineContext): readonly Item[]   // shopStockIds ∪ region-'none' consumables ∪ same-region gear in allowed rarities; + 1-2 rotating via deriveRng(run.rng, 'shop:<town>:d<day>')
export function innCost(town: TownDef, run: RunState): { wounded: readonly UnitId[]; cost: number }
export function bountyFor(p: Pick<Prisoner, 'bountyValue' | 'level'>, rules: Rules): number
```

### `run/difficulty.ts` — §2.13, D: tier by BFS distance
```ts
export function tierOfNode(node: OverworldNode, ctx: EngineContext): RegionTier     // node.tier ?? RULES.overworld.tierByDistance[nodeDistance]
export function tierOfRegion(regionId: RegionId, ctx: EngineContext): RegionTier
export function fnv1a(s: string): number
export function levelForSalt(tier: RegionTier, salt: string, rules: Rules): number
export function scaleEnemyForLevel(base: UnitStats, baseHp: number, level: number, rules: Rules): { stats: UnitStats; hp: number }
```

### `run/overworld.ts` — §2.9 graph
```ts
export interface Graph { readonly adjacency: Readonly<Record<NodeId, readonly NodeId[]>> }
export function buildGraph(sheet: OverworldSheet, run: RunState): Graph              // visible + unlocked nodes only
export function findPath(graph: Graph, from: NodeId, to: NodeId): readonly NodeId[] | null   // BFS, excludes `from`, includes `to`
export function hopCost(path: readonly NodeId[], rules: Rules): { hops: number; food: number }
export function starvationPreview(run: RunState, hops: number, rules: Rules): number     // HP/unit lost when food < hops
export function edgeKey(a: NodeId, b: NodeId): EdgeKey
export function edgeOf(sheet: OverworldSheet, a: NodeId, b: NodeId): OverworldEdge | null
export function nodeOf(sheet: OverworldSheet, id: NodeId): OverworldNode           // throws on unknown
export function isDecisionNode(node: OverworldNode, run: RunState, isDestination: boolean, rules: Rules): boolean
export function refKey(kind: 'overworld' | 'dungeon', mapId: string, nodeId: string): string
export function visibleNodes(sheet: OverworldSheet, run: RunState): readonly OverworldNode[]
```

### `run/encounters.ts` — §2.9 per-hop roll, §7.19
```ts
export function rollChanceFor(edge: OverworldEdge | null, region: Region, traversal: EdgeTraversal | null, today: number, rules: Rules): number   // (edge.rollChance ?? region.encounterChancePerHop ?? tier default) × cooldown
export function hopRng(run: RunState, sheetId: string, from: NodeId, to: NodeId, pass: number): RngState          // deriveRng(run.rng, hop label)
export function encounterRng(run: RunState, sheetId: string, from: NodeId, to: NodeId, pass: number): RngState
export function rollEncounter(table: EncounterTable, pred: PredicateState, oneShots: Readonly<Record<EncounterId, true>>, rng: RngState): { roll: EncounterRoll; rng: RngState }   // predicates, one-shots, weights, last-entry fallback
export function rollHop(run: RunState, from: NodeId, to: NodeId, ctx: EngineContext): EncounterRoll   // chance roll + pick; or the stored scouted result for `<edge>#<pass>`
```

### `run/travel.ts` — §2.9, §7.16 (the machine)
```ts
export function startJourney(run: RunState, toNodeId: NodeId, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }   // path or refuse; current node → nodeMenu
export function beginHop(state: GameState, ctx: EngineContext): ReduceResult      // requires travel.walking: day+1, food−1 / starvation, roll, then landHop OR suspend (+ open dialogue / checkEvent / seed battle)
export function landHop(state: GameState, ctx: EngineContext): ReduceResult       // nodeId = head; visited; traversal++ (lastDay); locationArrived; pop head; then: destination → idle + nodeMenu(if decision); decision node → paused + nodeMenu; else stay walking
export function resumeTravel(state: GameState, ctx: EngineContext): ReduceResult  // if travel.suspended → landHop; no-op otherwise. Called by afterDialogueEnd / afterCheckClose / continueAfterBattle
export function continueJourney(run: RunState): RunState                            // paused → walking, menu closed
export function stayHere(run: RunState): RunState                                   // paused → idle
```
Invariant: `beginHop` never runs twice for the same head (the phase leaves `walking` before any suspender opens), so a suspended hop cannot re-roll; `edgeTraversals` bumps only in `landHop`.

### `run/scout.ts` — §2.10 Scout
```ts
export function scoutableEdges(sheet: OverworldSheet, run: RunState, depth: number): readonly { from: NodeId; to: NodeId; pass: number }[]   // BFS edge depth 3
export function scout(run: RunState, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }   // consumeFood(1); for each edge: rollHop with the SAME labels a real hop would use → scoutedEdges[`<edge>#<pass>`]
```

### `run/town.ts` — §2.6, §2.10
```ts
export function enterTown(run: RunState, ctx: EngineContext): RunState
export function innHeal(run: RunState, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }
export function buy(run: RunState, itemId: ItemId, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }
export function sell(run: RunState, x: number, y: number, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }
export function tavernBoard(run: RunState, town: TownDef, ctx: EngineContext): readonly TavernQuestEntry[]   // filtered by visibleIf — also the only turn-in surface
export function turnInPrisoner(run: RunState, unitId: UnitId, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }
export function turnInAll(run: RunState, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }
```

### `run/camp.ts` — §2.10 Camp
```ts
export function enterCamp(run: RunState): RunState
export function rest(run: RunState, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }   // floor(max×0.2), consumeFood(1); refuse at 0 food / actionTaken
```

### `run/dungeon.ts` — §2.11, §7.18
```ts
export function enterDungeon(state: GameState, dungeonId: DungeonId, ctx: EngineContext): ReduceResult   // gate: node.requires predicate; graph = generateDungeon(deriveRng(run.rng,'dungeon:<id>'), …)
export function reachableRooms(d: ActiveDungeon): readonly RoomId[]                     // row-0 rooms from the entrance; edge successors otherwise; only when roomResolved
export function moveTo(state: GameState, roomId: RoomId, ctx: EngineContext): ReduceResult   // combat/elite/boss → startBattleFromRun(origin dungeon); event → revealedEvents + pendingCheckEvent; rest → heal 30% free; treasure → guaranteed gear (treasure row) + 50g; visited refKey; locationArrived
export function roomResolved(state: GameState, ctx: EngineContext): ReduceResult        // clearedRooms += position; boss → clearedDungeons, flag, exit
export function exitDungeon(state: GameState): ReduceResult
export function dungeonTier(def: DungeonDef, ctx: EngineContext): RegionTier
```

### `run/loot.ts` — §2.13 loot by source (ported shape of `rollBattleLoot`)
```ts
export function lootRow(tag: BattleTag, tier: RegionTier, rules: Rules): { chance: number; row: LootRow } | null
export function rollLoot(source: { tag: BattleTag; tier: RegionTier; regionId: RegionId }, rng: RngState, owned: readonly ItemId[], ctx: EngineContext): { drop: LootDrop | null; rng: RngState }   // chance → rarity by weights → exclude owned → region filter (travel/dungeon combat) → hand-slot gear only → fall down on empty
export function rollTreasure(tier: RegionTier, rng: RngState, owned: readonly ItemId[], ctx: EngineContext): { drop: LootDrop; rng: RngState }
```
Called by `combat/resolve.ts` through `ResolveInput` — the loot roll uses `deriveRng(run.rng, 'loot:<battleId>')` so the roll is a pure function of the run seed and the battle id, and the combat sim can skip it.

### `run/payout.ts` — §2.8, §7.30: the ONE payout
```ts
export function applyBattleResult(run: RunState, result: BattleResult, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }
```
In order: survivorHp → party; fallen → deathLog + removed from party (`unitLost`); gold += goldEarned; consumedItems removed first-match; prisoners appended (`prisonerTaken`); loot placed (guaranteed drop that does not fit → `lootOverflow` effect and `run.lastBattle.loot` stays so `battle/continue` is refused until a slot frees — the UI's "found gear" pickup); stats; `clearedEncounters[encounterId]` for travel origin; `captureTargets` resolved (`resolveCaptureTargets` → flag + ONE dialogue via `pendingDialogue{source:'captureTarget'}`); `victoryEventId` → `pendingCheckEvent{source:'victory'}`; `battle`-scope flags cleared. Emits `battleVictory | battleDefeat`, `unitDied` per fallen, `enemyCaptured` per prisoner, `itemAcquired`.

```ts
export function resolveCaptureTargets(targets: readonly CaptureTarget[], captured: readonly UnitId[], surviving: readonly UnitId[]): readonly QuestEffect[]   // ported verbatim, single-dialogue rule
```

### `run/flags.ts` — §2.12
```ts
export function setFlag(flags: Flags, key: FlagKey, value: FlagValue, scope: FlagScope): Flags
export function clearScope(flags: Flags, scope: Exclude<FlagScope, 'permanent'>): Flags
export function getFlag(flags: Flags, key: FlagKey): FlagValue | undefined
```

### `run/predicates.ts` — §2.12 (15 kinds, one evaluator)
```ts
export function evaluatePredicate(p: Predicate, s: PredicateState): boolean
export function predicateStateFromRun(run: RunState): PredicateState
export function flagKeysRead(p: Predicate): readonly FlagKey[]     // for the lint
```

### `run/quests.ts` — §2.12 activation + settle, §7.32
```ts
export function questStatus(run: RunState, questId: QuestId): 'notStarted' | 'active' | 'complete'
export function startQuest(run: RunState, questId: QuestId, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }   // idempotent (warn), throws on unknown id; seeds initialStage; applies onEnter
export function advanceStage(run: RunState, questId: QuestId, to: StageId, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }   // refuse if not started/complete; from.onExit then to.onEnter
export function completeQuest(run: RunState, questId: QuestId, ctx: EngineContext): { run: RunState; effects: readonly Effect[] }   // onExit, '__complete__', quest-scope flags cleared
export function settleQuests(run: RunState, ctx: EngineContext): { run: RunState; effects: readonly Effect[]; passes: number }   // first passing transition wins; fixed point ≤ 8; warns at the cap
export function bootstrapCheck(ctx: EngineContext): readonly string[]   // initialStage exists; every transitions[].to and every content advanceQuestStage.toStage resolves
```

### `run/effects.ts` — §2.12 quest effects, flat, ALL implemented
```ts
export function applyQuestEffect(state: GameState, effect: QuestEffect, ctx: EngineContext): ReduceResult
export function applyQuestEffects(state: GameState, effects: readonly QuestEffect[], ctx: EngineContext): ReduceResult
```
Takes `GameState` because `startCombat` writes `pendingCombat` and `promptName` writes `pendingNamePrompt` (run fields), and because the reducer-level `applyQuestEffects` action must also settle quests afterwards (root post-step). Kinds: setFlag, recruitCharacter, spawnNode, unlockNode, startDialogue, startQuest, advanceQuestStage, completeQuest, addGold (clamp), addItem, addFood (signed, clamp), damageParty, healParty, startCombat, promptName. No `statCheck`, no `recruitUnit`.

### `run/dialogue.ts` — §2.12 dialogue
```ts
export function openDialogue(state: GameState, dialogueId: DialogueId, source: PendingDialogue['source'], ctx: EngineContext): ReduceResult   // sets slot at startNodeId, applies node onEnter
export function visibleChoices(tree: DialogueTree, nodeId: DialogueNodeId, pred: PredicateState): readonly DialogueChoice[]
export function isChoiceEnabled(choice: DialogueChoice, pred: PredicateState): boolean
export function choose(state: GameState, choiceId: string, attemptingUnitId: UnitId | null, ctx: EngineContext): ReduceResult   // refuses hidden/disabled/unknown; check → onPass/onFail; effects; next node onEnter or end
export function renderText(text: string, run: RunState): string      // `{mc}` / `{company}` substitution (also used by the UI)
export function speakerName(speaker: CharacterId | undefined, run: RunState, ctx: EngineContext): string | null
```
`step()` (the pure core, ported) throws on hidden/disabled/unknown — the reducer catches and refuses.

### `run/checks.ts` — §2.12 stat checks (ported verbatim)
```ts
export function evaluateCheck(req: CheckRequirement, attempting: UnitCore | null, run: RunState): boolean
export function checkCandidates(req: CheckRequirement, run: RunState): readonly CheckCandidate[]   // living, stat desc, meetsThreshold
export function chooseCheck(state: GameState, choiceId: string, attemptingUnitId: UnitId | null, ctx: EngineContext): ReduceResult   // resolve → effects → stage 'result'
export function closeCheck(state: GameState, ctx: EngineContext): ReduceResult   // by source: travel → resumeTravel; dungeon → roomResolved; victory → nothing
```

## 4. `engine/procgen/`

### `procgen/dungeonGraph.ts` — §2.11, D: compact variant
```ts
export interface DungeonGenParams { readonly rows: number; readonly cols: number; readonly paths: number; readonly weights: Readonly<Partial<Record<DungeonRoomType, number>>>; readonly forced: { firstRow: DungeonRoomType; lastRow: DungeonRoomType }; readonly noEliteOrRestBeforeRow: number }
export function generateDungeon(rng: RngState, dungeonId: DungeonId, params: DungeonGenParams): { graph: DungeonGraph; rng: RngState }   // deterministic per (runSeed, dungeonId); boss row single node reachable from every last-row node; unique ids
export function validateDungeon(graph: DungeonGraph, params: DungeonGenParams): readonly string[]   // the StS validators; [] = ok
```
`boardFloor.ts` (final) generates the cosmetic floor from `deriveRng(combat.rng, 'floor')` when `grid.floor === null` — called by the UI's board component, not the reducer, so gameplay never depends on it.

## 5. `engine/save/` — snapshot + intent log

### `save/schema.ts` — §2.14 rule 3-4, §7.9
Zod mirrors of `MetaState`, `RunState` (every field, `.strict()`), `CombatState` (every field; `grid.obstacles: z.array(z.string())` — an object there fails with a named error), `RunLedger`, `SaveFile`, `IntentLog`, and `GameActionSchema` (discriminated union over every `GameAction` type). A type-level test asserts `z.infer<typeof RunStateSchema>` is mutually assignable with `RunState`.

### `save/codec.ts`
```ts
export function toSaveFile(state: GameState, logLength: number, contentVersion: string): SaveFile     // picks meta/run/combat/ledger; screen NOT persisted (derived)
export function fromSaveFile(file: SaveFile, ctx: EngineContext): GameState                            // screen = deriveScreen; ui = default; combat.selection reset to null/IDLE
export function parseSaveFile(raw: string, expected: { saveVersion: string; contentVersion: string }): { ok: true; file: SaveFile } | { ok: false; error: string }   // JSON → strict zod → version check (mismatch = error, caller nukes with a toast)
export function serialize(file: SaveFile): string
```

### `save/log.ts` — the canonical form
```ts
export function emptyLog(seed: number, contentVersion: string): IntentLog
export function append(log: IntentLog, action: GameAction): IntentLog
export function foldLog(log: IntentLog, ctx: EngineContext, meta: MetaState): GameState                // reduce(initialState(meta), 'run/new'{seed}) then each action; UI actions absent by construction
export function verifyLog(log: IntentLog, snapshot: SaveFile, ctx: EngineContext): { ok: true } | { ok: false; firstDivergence: number; path: string }   // deep-equal state after fold vs snapshot slices
export function verifyPump(log: IntentLog, ctx: EngineContext, meta: MetaState): { ok: true } | { ok: false; index: number; expected: AutoAction | null; found: GameAction }   // every logged auto action equals pendingAutoAction at that point, and no auto action was due where a player action is logged
export function parseLog(raw: string): { ok: true; log: IntentLog } | { ok: false; error: string }
```

## 6. `engine/flow/` — framework-free controller

### `flow/screen.ts` — screen + overlays as data
```ts
export type RouteCondition = 'noRun.ledgerWon' | 'noRun.ledgerLost' | 'noRun' | 'combat.resolved' | 'combat' | 'prologue' | 'venue.town' | 'venue.camp' | 'dungeon' | 'overworld'
export const ROUTE_TABLE: ReadonlyArray<readonly [RouteCondition, ScreenKind]>   // first match wins, top to bottom (exactly the order above)
export function holds(cond: RouteCondition, state: GameState): boolean
export function deriveScreen(state: GameState): Screen
export function route(state: GameState): { state: GameState; effects: readonly Effect[] }   // sets state.screen if it differs; emits screenChanged
export const OVERLAY_PRIORITY: readonly Overlay['kind'][]     // ['namePrompt','dialogue','checkEvent','nodeMenu','tutorial']
export function activeOverlay(state: GameState): Overlay | null
export function isQuiescent(state: GameState): boolean         // no overlay, no auto action pending, screen not title
```
`'prologue'` holds when `run.pendingDialogue?.source === 'prologue'`. `'combat.resolved'` → `battleEnd`. A `dev/jumpTo` sets a `screen` the table would not — the invariant is suspended for that session (flag in `ui.devHud`).

### `flow/pump.ts` — the single pump (§7.13, §7.16)
```ts
export function pendingAutoAction(state: GameState): AutoAction | null
export function acceptsPlayerAction(state: GameState, action: Action): { ok: true } | { ok: false; reason: 'autoPending' | 'title' | 'prod' }
```
`pendingAutoAction`: (1) `screen.kind === 'combat' && combat.phase === 'COMBAT' && turn.team === 'enemy'` → `combat/aiStep`; (2) `screen.kind === 'overworld' && run.travel.phase === 'walking' && activeOverlay(state) === null` → `travel/hop`; else `null`. Two rules, total. The driver decides delay; the CLI/replayer uses zero.

### `flow/battle.ts` — §2.8, §2.11, §2.15
```ts
export function startBattleFromRun(state: GameState, origin: BattleOrigin, enemies: EnemySpec, ctx: EngineContext): ReduceResult   // builds the BattleSpec (party living HP, bag potions, tier, captureTargets, victoryEvent, rng label by origin) → seedBattle; emits battleStarted
export function finishBattleIfOver(state: GameState, ctx: EngineContext): ReduceResult   // post-step: resolveBattle + applyBattleResult once; DEFEAT → endRun('lost'); finalBoss VICTORY keeps lastBattle for the Field Report, endRun('won') happens on battle/continue
export function continueAfterBattle(state: GameState, ctx: EngineContext): ReduceResult   // refuse if lootOverflow; clear combat + lastBattle; by origin: tutorial→meta.tutorialSeen + prologue dialogue; travel→resumeTravel; dungeon→roomResolved; finalBoss→endRun('won'); quest→resumeTravel
```

### `flow/resume.ts` — closing suspenders
```ts
export function afterDialogueEnd(state: GameState, closed: PendingDialogue, ctx: EngineContext): ReduceResult   // pendingCombat → startBattleFromRun(origin quest); source prologue → flag prologue_seen; travel → resumeTravel; tavern/quest/captureTarget → nothing
export function afterCheckClose(state: GameState, closed: PendingCheckEvent, ctx: EngineContext): ReduceResult
export function afterNameSubmit(state: GameState, ctx: EngineContext): ReduceResult      // then the same resume chain (a name prompt can open mid-dialogue; the dialogue continues)
```

### `flow/lifecycle.ts` — §2.14 rule 6, §2.15 ledgers
```ts
export function initialState(meta: MetaState): GameState                           // run null, combat null, ledger null, screen title, ui defaults
export function newRun(state: GameState, seed: number, ctx: EngineContext): ReduceResult   // seedNewRun; totalRuns++; tutorial battle or prologue
export function endRun(state: GameState, outcome: 'won' | 'lost', ctx: EngineContext): ReduceResult   // ledger from run (+ trophy); run = null; combat = null; meta.runsWon/Lost++; effects persist:clearRun + persist:meta + runEnded
export function quitToTitle(state: GameState): ReduceResult
export function hydrate(state: GameState, file: SaveFile, ctx: EngineContext): ReduceResult
```

### `flow/tutorial.ts` — §2.15
```ts
export function tutorialStep(state: GameState): TutorialStep | null   // derived from combat state; null outside the tutorial battle
```

## 7. `ui/store.ts` — the driver (React-facing, the only impure module)

```ts
export function getState(): GameState
export function dispatch(action: Action): readonly AnyEffect[]        // gate → reduce → log (GameAction) → persist (sync for PERSIST_SYNC, else next macrotask) → notify → schedule pump
export function subscribe(listener: () => void): () => void
export function subscribeEffects(listener: (effects: readonly AnyEffect[], action: Action) => void): () => void   // effects/ (CSS animations, audio) and DevHud subscribe here; effects are handed over and dropped
export function useGame<T>(selector: (s: GameState) => T, isEqual?: (a: T, b: T) => boolean): T   // useSyncExternalStore + selector memo
export function useOverlay(): Overlay | null                          // useGame(activeOverlay)
export function boot(opts: { storage: StorageLike; seedSource: () => number; now: () => number }): Promise<void>   // load content → ctx → read meta/run/log → parseSaveFile → hydrate (or nuke + toast) → route
export function setPumpDelay(fn: (a: AutoAction, s: GameState) => number): void   // ui/timing.ts supplies HOP 700ms / AI step by effect kind; Playwright + reduced-motion set 0
export const ctx: EngineContext
```
Rules baked into `dispatch`: a `GameAction` while `pendingAutoAction(state) !== null` and not `INTERRUPT_SAFE` is refused and reported (`refused` effect) — no state change, not logged. After every accepted dispatch the store schedules `pendingAutoAction(next)` once (`setTimeout(delay)`, keyed so a re-entrant dispatch cancels and reschedules). `persist` effects write `RULES.save.keys.run|meta|log` via one `setItem` each; `clearRun` removes run + log. The intent log lives in memory and is flushed with the run snapshot (`logLength` cross-check). StrictMode double-mount is harmless: `boot()` is idempotent and the pump is keyed.

`ui/App.tsx` is `switch (state.screen.kind)`; overlays render from `useOverlay()`; the effect consumer (`ui/effects/`) maps `unitHit → .anim-hit` etc. with `--dur-*` tokens and never touches state.

## 8. `scripts/cli.ts` — headless (no DOM)

`npm run cli -- <command> [flags]`, all backed by `engine/reducer.ts` + `flow/pump.ts` with a zero-delay pump loop (`drain(state) = while (auto) dispatch(auto)`).

| command | what |
|---|---|
| `play --seed N [--cmds "…"]` | full game REPL from Title: `new`, `continue`, `go <node>`, `menu`, `town`, `inn`, `buy <id>`, `sell <x,y>`, `talk <n>`, `turnin <id>`, `camp`, `rest`, `scout`, `dungeon`, `room <id>`, `boss`, `choose <n> [unit]`, `name <text>`, `play <handIdx> <x,y>`, `move <x,y>`, `item <id>`, `capture <id>`, `end`, `auto` (greedy turn), `show`, `state`, `effects`, `save`, `quit` — every screen reachable without a browser (ARCHITECTURE §6) |
| `combat --seed N --scenario stub\|boss\|group:<id>:<L>\|dungeon:<id>:<room>\|tutorial [--loadout spec] [--cmds "…"]` | isolated `reduceCombat` session on a `BattleSpec` (no run) |
| `simulate --scenario … --runs 50 [--loadout a\|b] [--rules knob=value]` | `combat/sim.ts` sweep table; round cap throws with a state dump |
| `balance` | the CI gate: 20+ seeds × scenarios, asserts `RULES.balance` (win bands, 0 stalemates, first blood, turn band) |
| `replay <log.json> [--snapshot run.json]` | `foldLog`, `verifyLog`, `verifyPump`; prints first divergence |
| `dialogue <id> --cmds "1;2"` | walk a tree with auto-picked check candidates |
| `lint-content` | `lintContent` (also in `npm run verify`) |
| `dump-state` | pretty JSON of the current CLI state (for `?screen=` fixtures) |

## 9. Tooling fences (eslint, `npm run verify`)
1. `src/engine/**` — no `react`, `react-dom`, `**/ui/**`, no `document|window|localStorage`, no `Math.random`, no `Date`.
2. `src/engine/combat/**` — no `../run/*`, `../flow/*`, `../content` (types excepted).
3. `src/engine/run/**` — no `../combat/*` except `import type`.
4. `src/ui/**` — no `../engine/combat/*` / `../engine/run/*` imports except from the `selectors` barrel (`engine/selectors.ts` re-exports pure read helpers: `initiativeStrip`, `computeForecast`, `reachableTiles`, `tilesInRange`, `checkCandidates`, `tavernBoard`, `shopStockFor`, `findPath`, `hopCost`, `starvationPreview`, `activeOverlay`, `tutorialStep`, `renderText`, `displayName`).
5. `scripts/**` — no `src/ui/**`.
