# Embermarch engine contract (`game/src/engine`)

The binding module map for the implementation fleet. Signatures below are copied from the stubs in the tree; the tree typechecks and lints with every body `todo('<module>')`. Implementers fill bodies WITHOUT changing signatures; a signature change goes through `CONTRACT-CHANGES.md` (§9). Judgement of the two proposals this was synthesised from: `CONTRACT-JUDGEMENT.md`. Rules and numbers: `BRIEF.md` §2, `DECISIONS.md`, `game/src/engine/rules.ts`.

Read in this order: `game/ARCHITECTURE.md` → this file → `game/src/engine/types.ts` → `actions.ts` → `effects.ts` → `rules.ts` → the stubs of your package.

## 1. Shape

```
GameState = { meta, run, combat, ledger, screen, ui }
   meta    MetaState              persisted `embermarch:meta`; survives runs
   run     RunState | null        persisted in `embermarch:run`; null outside a run
   combat  CombatState | null     persisted in `embermarch:run` VERBATIM (selection included); null outside a battle
   ledger  RunLedger | null       frozen summary after `run` is nulled; win/gameOver render from it; NOT persisted
   screen  { kind }               explicit routing field, set by reducers; NOT persisted — `flow/pump.ts#resumeScreen` derives it
                                  from the slots on Continue; invariants assert `screen === title ∨ screen === resumeScreen(state)`
   ui      UiState                ephemeral: modal, townTab, showDanger, devHud, mapPan — never saved, never read by
                                  `isLegal` / `nextPump` (a replay may drop `ui/*` actions losslessly)

reduce(state, action, env) → { state, effects }        (engine/reducer.ts)
   env = { content: Content, rules: Rules }             injected, never imported by rules code
```

Pillars (types.ts header): JSON-safe state (no Set/Map/Date/class/undefined — absence is `null`); `readonly` everywhere; RNG in state as `RngState = Readonly<{ seed, counter }>` (no `label`), written back by every rolling case through `engine/rngState.ts#rngState / deriveState`; pending slots ARE the flow machine and overlays are derived (`flow/pump.ts#overlayOf`); plain string ids validated by Zod at the boundary.

Persisted slots that drive flow: `run.pendingTravel` (walking | suspended | atNode + the hop in flight), `run.pendingDialogue`, `run.pendingCheckEvent`, `run.pendingNamePrompt`, `run.pendingCombat`, `run.pendingFollowUps` (post-battle openings, one at a time), `run.pendingLoot`, `run.activeDungeon`, `run.town`, `run.camp`, `run.lastBattle`, `combat`.

## 2. Module map — every exported signature

Root files (contract; real):

| file | exports |
|---|---|
| `types.ts` | every domain type (§1) + re-exported content vocabulary and content def types; `RngState = Readonly<Pick<rng.RngState, 'seed' \| 'counter'>>`; `PlayableCard = Pick<Card, 'apCost' \| 'range' \| 'targetKind' \| 'aoeRadius' \| 'damageStat' \| 'effects'>`; `BattleField`, `BattleFieldToken`, `PendingFollowUp` |
| `actions.ts` | `Action` (16 namespaced unions), `ActionType`, `PumpAction`, `GameAction`, `ReduceResult`, `SliceResult<S>`, `Legality`, `isUiAction`, `isPumpAction`, `isDevAction` |
| `effects.ts` | `Effect` (one flat union, 60 kinds), `EffectKind`, `SoundCue`, `UnitHitCause` — removal effects carry the tile (`unitHit.tile`, `unitDied.tile`, `unitCaptured.tile`), `cardPlayed.cardUid`, `cardsDrawn.uids` |
| `rules.ts` | `Rules` (interface), `rules` (the constants), `Knobs`, `LootRow`, `RarityWeights`, `StatusRule`, `TerrainRule` (DR only), `SAVE_VERSION`, `rngLabels` (functions; `battle*` strings ARE battle ids; `treasure(dungeon, room)`) |
| `content.ts` (real) | `fnv1a(s)`, `contentVersion(reg)`, `nodeDistances(sheet)`, `buildContent(reg?)`, `createEnv(reg?, rules?)` (throws when the BOSS node is closer than `rules.travel.bossNodeMinHops`, or when a node's authored `areaTier` disagrees with `rules.travel.tierByDistance` — CONTRACT-CHANGES 0032), `tierForDistance(hops, rules?)`, `withRules(env, patch)`, `defaultEnv()`, `portraitFor(reg, unitId, classId, team): Portrait` (identity ramp with the deterministic `fnv1a` fallback — every HUD identity renders through it) |
| `rngState.ts` (real) | `rngState(r: RNG): RngState`, `deriveState(parent: RngState, label: string): RngState` — the ONLY write-back helpers; every rolling case returns through them |
| `todo.ts` | `todo(module, ...deps): never` — stub body; delete the file when no importer remains |
| `rng.ts`, `autotile.ts`, `boardFloor.ts` | ported, final — import, never edit |

### `reducer.ts` (WP-FLOW)
```ts
export { initialState } from './flow/lifecycle'
export { isLegal } from './flow/legality'          // the gate lives in flow/legality.ts (ui-importable)
reduce(state: GameState, action: Action, env: EngineEnv): ReduceResult
reduceMany(state: GameState, actions: readonly Action[], env: EngineEnv): ReduceResult
```
Algorithm: (1) `flow/legality.ts#isLegal` gate (table §4) → illegal returns the SAME state reference + one `refused`; (2) route by prefix — `ui/` → ui slice; `combat/` → `combat/reducer` on `state.combat`; `meta/ save/ tutorial/` → `flow/lifecycle`; `dev/` inline; the rest → `run/reducer`; (3) `flow/settle`; (4) `screenChanged` when the screen differs; dev builds `freezeDeep`.

### `combat/` — pure over `CombatState`, never reads `run` (WP-COMBAT, WP-AI-SIM)
```ts
// grid.ts — the only TileKey parser; no LOS anywhere
tileKey(x: number, y: number): TileKey
parseTile(t: TileKey): { readonly x: number; readonly y: number }
manhattan(a: TileKey, b: TileKey): number
neighbours4(t: TileKey): readonly TileKey[]
inBounds(grid: CombatGrid, t: TileKey): boolean
isObstacle(grid: CombatGrid, t: TileKey): boolean
occupiedTiles(units: Readonly<Record<UnitId, CombatUnit>>, except?: UnitId): ReadonlySet<TileKey>
unitAt(state: CombatState, t: TileKey): CombatUnit | null                       // LIVING only (§7.3)
reachable(state: CombatState, unitId: UnitId): Readonly<Record<TileKey, readonly TileKey[]>>
findPath(grid: CombatGrid, origin: TileKey, dest: TileKey, mov: number, blocked: ReadonlySet<TileKey>): readonly TileKey[] | null
distanceField(grid: CombatGrid, dest: TileKey, blocked: ReadonlySet<TileKey>, allow: TileKey): Readonly<Record<TileKey, number>>
tilesInRange(grid: CombatGrid, origin: TileKey, min: number, max: number): readonly TileKey[]
tilesInAoe(grid: CombatGrid, centre: TileKey, radius: number): readonly TileKey[]

// targeting.ts — recipients: centre = tile ?? source tile; self | target (unit on centre) | area (foes ≤ aoeRadius, or EVERY foe on an
// all_enemies card) | ally (friends ≤ aoeRadius incl. source, or every friend on all_allies) | ring (foes on neighbours4(centre), centre excluded)
legalTargets(state: CombatState, unitId: UnitId, card: PlayableCard, env: EngineEnv): readonly TileKey[]
recipients(state: CombatState, sourceId: UnitId, tile: TileKey | null, card: PlayableCard, selector: EffectTarget): readonly CombatUnit[]
dangerUnion(state: CombatState, env: EngineEnv): readonly TileKey[]

// turn.ts — queue DERIVED, never stored; the ROUND's cursor is remembered in `turn.acted` (0115)
effectiveSpd(u: CombatUnit): number
canEnterMove(unit: CombatUnit): Legality                                 // the free move's rule; §4 reads it (0089)
initiativeQueue(units: Readonly<Record<UnitId, CombatUnit>>): readonly UnitId[]
remainingThisRound(units: Readonly<Record<UnitId, CombatUnit>>, acted: readonly UnitId[], currentId: UnitId): readonly UnitId[]
successor(units: Readonly<Record<UnitId, CombatUnit>>, currentId: UnitId, acted: readonly UnitId[]): { readonly unitId: UnitId; readonly wrapped: boolean }
initiativeStrip(state: CombatState, visible: number): { readonly ids: readonly UnitId[]; readonly more: number }   // active → the rest of the round → the next one (0115)
activeUnit(state: CombatState): CombatUnit
isPartyTurn(state: CombatState): boolean
checkEnd(state: CombatState, env: EngineEnv): CombatPhase
startTurn(state: CombatState, unitId: UnitId, env: EngineEnv): SliceResult<CombatState>
endTurn(state: CombatState, env: EngineEnv): SliceResult<CombatState>

// deck.ts
buildDeck(unit: Unit, env: EngineEnv): DeckState
quiverEffects(mod: QuiverModifier): readonly CardEffect[]   // poison/slow → ApplyStatus target; thunder → Damage target armorPiercing; explosive → Damage ring
drawCards(deck: DeckState, count: number, rng: RngState): { readonly deck: DeckState; readonly rng: RngState; readonly reshuffled: boolean }
discardHand(deck: DeckState): DeckState
shuffleDraw(deck: DeckState, rng: RngState): { readonly deck: DeckState; readonly rng: RngState }
deckSize(deck: DeckState): number

// statuses.ts
mergeStatus(statuses: readonly ActiveStatus[], next: ActiveStatus, env: EngineEnv): readonly ActiveStatus[]
hasStatus(u: CombatUnit, id: StatusId): boolean
slowDelta(u: CombatUnit): number
isImmobilized(u: CombatUnit): boolean
isTaunting(u: CombatUnit): boolean
riposteStacks(u: CombatUnit): number
empowerBonus(u: CombatUnit): number
consumeEmpower(u: CombatUnit): { readonly unit: CombatUnit; readonly effects: readonly Effect[] }
tickOwnerTurnEnd(state: CombatState, unitId: UnitId, env: EngineEnv): SliceResult<CombatState>
tickOwnerTurnStart(u: CombatUnit, env: EngineEnv): { readonly unit: CombatUnit; readonly effects: readonly Effect[] }
cleanse(u: CombatUnit, remove: 'armor' | 'debuff', amount: number | 'all', env: EngineEnv): { readonly unit: CombatUnit; readonly effects: readonly Effect[] }

// damage.ts — forecast == applied
damageReduction(target: CombatUnit, type: DamageType, grid: CombatGrid, env: EngineEnv): { readonly dr: number; readonly terrainDr: number }
rawDamage(base: number, stat: DamageStat | null, source: CombatUnit, target: CombatUnit, type: DamageType, grid: CombatGrid, env: EngineEnv): Pick<Forecast, 'damageType' | 'baseTerm' | 'statName' | 'statTerm' | 'empowerTerm' | 'drTerm' | 'terrainDr' | 'afterDr'>
splitDamage(hp: Hp, armor: number, amount: number, type: DamageType, armorPiercing: boolean): { readonly hpLost: number; readonly armorLost: number; readonly newHp: number; readonly newArmor: number }
forecast(state: CombatState, attackerId: UnitId, play: Pick<PlaySpec, 'card' | 'mod'>, targetId: UnitId, env: EngineEnv): Forecast | null   // Forecast.quiverTerm + riders
dealDamage(state: CombatState, attackerId: UnitId | null, targetId: UnitId, amount: number, type: DamageType, opts: { readonly armorPiercing: boolean; readonly cause: UnitHitCause; readonly cover: boolean }, env: EngineEnv): SliceResult<CombatState>
grantArmor(u: CombatUnit, amount: number, env: EngineEnv): { readonly unit: CombatUnit; readonly capped: boolean }

// cover.ts — Genatsvale
resolveCoverTarget(state: CombatState, attackerId: UnitId, targetId: UnitId, env: EngineEnv): { readonly targetId: UnitId; readonly protectorId: UnitId | null }
recordCover(state: CombatState, protectorId: UnitId, protecteeId: UnitId): CombatState

// cards.ts — ONE resolver for cards, potions, enemy actions. Move{distance}: the authored range is the TARGETING range
// (already includes the approach); strike range = [range.min, max(1, range.max − Σdistance)]; the source steps along findPath
// toward the nearest tile within strike range of play.tile (no free-move cost; immobilized ⇒ no-op; unreachable ⇒ validatePlay
// refuses `noPath`); emits unitMoved. Charge = range 1-3, Move 2, strike 1.
const CONSUMED_PARAMS: Readonly<Record<CardEffect['kind'], readonly string[]>>     // real (data): the lint's truth table
interface PlaySpec { sourceId; card: PlayableCard; cardId: CardId | null; tile: TileKey | null; mod: QuiverModifier | null; cause: UnitHitCause }
canPlay(state: CombatState, cardUid: CardUid, tile: TileKey | null, env: EngineEnv): { ok: true; card: Card } | { ok: false; reason: string }
validatePlay(state: CombatState, unitId: UnitId, card: PlayableCard, tile: TileKey | null, env: EngineEnv): Legality
playCard(state: CombatState, cardUid: CardUid, tile: TileKey | null, env: EngineEnv): SliceResult<CombatState>
resolvePlay(state: CombatState, play: PlaySpec, env: EngineEnv): SliceResult<CombatState>
applyEffect(state: CombatState, play: PlaySpec, effect: CardEffect, env: EngineEnv): SliceResult<CombatState>

// reasons.ts (CONTRACT-CHANGES 0093) — the ONE home for every refusal reason the package answers with; each is
// player-facing text (ARCHITECTURE §5.1), never a code. `needsAp` matches the card face's own phrasing.
const BATTLE_OVER | ENEMY_ACTING | NOT_IN_HAND | OUT_OF_REACH | NO_WAY_THROUGH | ROOTED | … : string
needsAp(cost: number): string

// items.ts
itemAsPlay(item: Item, env: EngineEnv): PlayableCard
useItem(state: CombatState, itemId: ItemId, env: EngineEnv): SliceResult<CombatState>

// capture.ts — the only die
captureChance(target: CombatUnit, supportingAllies: number, bountyHunter: boolean, env: EngineEnv): number
captureContext(state: CombatState, attackerId: UnitId, targetId: UnitId, env: EngineEnv): { readonly adjacent: boolean; readonly supportingAllies: number; readonly bountyHunter: boolean }   // supporters exclude the captor (0119)
hasAdjacentFoe(state: CombatState, unit: CombatUnit): boolean
canEnterCapture(state: CombatState, unit: CombatUnit, env: EngineEnv): Legality   // §4 reads it (0089)
capture(state: CombatState, targetId: UnitId, env: EngineEnv): SliceResult<CombatState>

// seed.ts — ONE seeder; throws SeedError, never a stub battle
class SeedError extends Error
seedBattle(spec: BattleSpec, env: EngineEnv): CombatState
partyCombatUnit(unit: Unit): CombatUnit
buildEnemyUnits(enemies: EnemySpec, env: EngineEnv): readonly CombatUnit[]
placeUnits(party: readonly Unit[], enemies: readonly CombatUnit[], grid: CombatGrid, env: EngineEnv): { readonly party: readonly CombatUnit[]; readonly enemies: readonly CombatUnit[] }

// resolve.ts — run-agnostic half of resolution (no loot)
killGold(level: number, env: EngineEnv): number
resolveBattle(state: CombatState, env: EngineEnv): BattleResult
battleField(state: CombatState): BattleField          // grid + one token per unit at position ?? lastTile — the Field Report's board

// tutorial.ts — in-battle steps only; the `victory` step comes from overlayOf (run.lastBattle.tag === 'tutorial' on battleEnd)
tutorialStep(state: CombatState): TutorialStep | null
tutorialSpec(mc: Unit, rng: RngState, env: EngineEnv): BattleSpec

// reducer.ts
reduceCombat(state: CombatState, action: CombatAction, env: EngineEnv): SliceResult<CombatState>

// ai.ts (WP-AI-SIM)
type AiStep = { kind: 'move'; to: TileKey; path: readonly TileKey[] } | { kind: 'act'; actionId: string; tile: TileKey } | { kind: 'endTurn' }
planEnemyStep(state: CombatState, env: EngineEnv): { readonly step: AiStep; readonly rng: RngState }
pickTarget(state: CombatState, self: CombatUnit, profile: EnemyAIProfile, env: EngineEnv): { readonly primary: UnitId | null; readonly desiredTile: TileKey | null }
eligibleActions(state: CombatState, unitId: UnitId, env: EngineEnv): readonly EnemyAction[]
actionAsPlay(action: EnemyAction, actor: CombatUnit): PlayableCard
expectedDamage(state: CombatState, attackerId: UnitId, action: EnemyAction, targetId: UnitId, env: EngineEnv): number
planEnemyTurn(state: CombatState, env: EngineEnv): { readonly actions: readonly CombatAction[]; readonly state: CombatState }

// sim.ts (WP-AI-SIM) — CONTRACT-CHANGES 0039
interface PolicyDecision { action: CombatAction; rng: RngState }          // a ROLLING policy hands its stream back
type Policy = (state: CombatState, env: EngineEnv) => CombatAction | PolicyDecision
class RoundCapError extends Error { dump: readonly CombatState[] }
interface SimResult { outcome: CombatPhase; rounds: number; firstBloodRound: number | null; finalState: CombatState; effects: readonly Effect[]; dump: readonly CombatState[] }
interface SweepRow { label; runs; winRate; stalemates; bloodlessRuns; firstStalemate: RoundCapError | null; meanRounds, minRounds, maxRounds, meanFirstBloodRound, worstFirstBloodRound: number | null }   // every round figure is over COMPLETED battles only (0048)
interface SweepOptions { tolerateRoundCap?: boolean }                     // default off: a round cap RE-THROWS with its dump
const greedyPolicy: (state: CombatState, env: EngineEnv) => CombatAction  // never rolls, so callers may dispatch it directly
const randomPolicy: Policy
autoBattle(spec: BattleSpec, env: EngineEnv, policy: Policy): SimResult
sweep(specs: readonly { label: string; spec: BattleSpec }[], env: EngineEnv, policy: Policy, opts?: SweepOptions): readonly SweepRow[]
```

### `run/` — pure over `RunState` (WP-RUN-CORE, WP-OVERWORLD, WP-DUNGEON, WP-NARRATIVE, WP-FLOW)
```ts
// reducer.ts (WP-FLOW)
type RunSideAction = RunAction | TravelAction | TownAction | CampAction | DungeonAction | DialogueAction | CheckAction | NameAction | QuestAction | BattleEndAction
reduceRun(state: GameState, action: RunSideAction, env: EngineEnv): ReduceResult

// newRun.ts (WP-RUN-CORE)
seedNewRun(seed: number, env: EngineEnv): RunState

// party.ts (WP-RUN-CORE)
buildUnitFromCharacter(def: UnitCharacter, env: EngineEnv): Unit
buildUnitFromClass(classId: string, level: number, id: UnitId, name: string, team: Team, env: EngineEnv): Unit
displayName(unit: Pick<Unit, 'id' | 'name'>, run: Pick<RunState, 'mcName'>): string
livingUnits(run: RunState): readonly Unit[]
isMcAlive(run: RunState): boolean
recruitCharacter(run: RunState, characterId: string, env: EngineEnv): SliceResult<RunState>
removeFallen(run: RunState, fallen: readonly { unitId: UnitId; cause: DeathEntry['cause']; battleId: string | null }[], env: EngineEnv): SliceResult<RunState>
healParty(run: RunState, fraction: number | 'full', onlyWounded: boolean, reason: 'inn' | 'campRest' | 'dungeonRest' | 'quest', env: EngineEnv): SliceResult<RunState> & { readonly healed: readonly UnitId[] }
damageParty(run: RunState, amount: number, cause: DeathEntry['cause'], env: EngineEnv): SliceResult<RunState> & { readonly died: readonly UnitId[] }

// bag.ts (WP-RUN-CORE)
footprint(item: Item): { readonly w: number; readonly h: number }
cells(bag: readonly BagEntry[], env: EngineEnv): ReadonlySet<string>
fits(bag: readonly BagEntry[], item: Item, x: number, y: number, env: EngineEnv, ignore?: BagEntry): boolean
findSlot(bag: readonly BagEntry[], itemId: ItemId, env: EngineEnv): { readonly x: number; readonly y: number } | null
placeInBag(bag: readonly BagEntry[], itemIds: readonly ItemId[], env: EngineEnv): readonly BagEntry[] | null
entryAt(bag: readonly BagEntry[], x: number, y: number): BagEntry | null
removeAt(bag: readonly BagEntry[], x: number, y: number): readonly BagEntry[]
removeFirst(bag: readonly BagEntry[], itemId: ItemId): readonly BagEntry[]
moveEntry(bag: readonly BagEntry[], fromX: number, fromY: number, x: number, y: number, env: EngineEnv): readonly BagEntry[] | null
foodCount(bag: readonly BagEntry[], env: EngineEnv): number   // env: food is a content KIND (CONTRACT-CHANGES 0023)
consumeFood(run: RunState, count: number, reason: 'hop' | 'rest' | 'scout', env: EngineEnv): SliceResult<RunState> & { readonly consumed: number }
addFood(run: RunState, delta: number, reason: 'quest' | 'event' | 'dev' | 'shop', env: EngineEnv): SliceResult<RunState>
ownedItemIds(run: RunState): readonly ItemId[]
consumableIds(run: RunState, env: EngineEnv): readonly ItemId[]

// equipment.ts (WP-RUN-CORE)
type EquipPlan = { ok: true; unit: Unit; bag: readonly BagEntry[] } | { ok: false; reason: string }
interface TrainingEnv { content: { classes }; rules: { gear: { quiverPairsWith } } }   // narrower than EngineEnv: content/lint.ts holds a raw registry (0121)
canHold(classId: string, item: Item, env: TrainingEnv): Legality        // classes.json#weaponClasses; quiver rides rules.gear.quiverPairsWith (0121)
planEquip(unit: Unit, slot: HandSlot, itemId: ItemId, bag: readonly BagEntry[], env: EngineEnv): EquipPlan   // refuses on canHold BEFORE it looks at space
planUnequip(unit: Unit, slot: HandSlot, bag: readonly BagEntry[], env: EngineEnv): EquipPlan                  // putting gear DOWN reads no training

// economy.ts (WP-RUN-CORE)
buyPrice(item: Item): number | null
sellPrice(item: Item, env: EngineEnv): number
shopStock(town: TownDef, run: RunState, env: EngineEnv): readonly Item[]
innCost(town: TownDef, run: RunState, env: EngineEnv): { readonly wounded: readonly UnitId[]; readonly total: number }
bountyFor(p: Pick<Prisoner, 'bountyValue' | 'level'>, env: EngineEnv): number
canInnHeal(town: TownDef, run: RunState, env: EngineEnv): Legality        // §4 reads it; NOBODY_WOUNDED (0089)
addGold(run: RunState, delta: number): RunState                           // the ONE owner of stats.goldEarned (0091)

// difficulty.ts (WP-RUN-CORE)
areaTier(nodeId: NodeId, env: EngineEnv): RegionTier
dungeonTier(def: DungeonDef, env: EngineEnv): RegionTier
enemyLevelFor(tier: RegionTier, salt: string, env: EngineEnv): number
scaleEnemy(base: UnitStats, baseHp: number, level: number, env: EngineEnv): { readonly stats: UnitStats; readonly hp: number }

// loot.ts (WP-RUN-CORE)
lootRowFor(tag: BattleTag | 'dungeonTreasure', tier: RegionTier, env: EngineEnv): LootRow
lootPool(run: RunState, tag: BattleTag | 'dungeonTreasure', env: EngineEnv): readonly Item[]
rollLoot(row: LootRow, pool: readonly Item[], rng: RngState, env: EngineEnv): { readonly itemIds: readonly ItemId[]; readonly rng: RngState }   // env: rules.loot.fallDown (CONTRACT-CHANGES 0024)
grantLoot(run: RunState, itemIds: readonly ItemId[], source: 'loot' | 'treasure' | 'quest' | 'trophy', env: EngineEnv): SliceResult<RunState> & { readonly placed: readonly ItemId[]; readonly overflow: readonly ItemId[] }

// overworld.ts (WP-OVERWORLD)
nodeOf(id: NodeId, env: EngineEnv): OverworldNode
edgeOf(a: NodeId, b: NodeId, env: EngineEnv): OverworldEdge | null
regionOf(nodeId: NodeId, env: EngineEnv): RegionDef
edgeKey(a: NodeId, b: NodeId): EdgeKey
edgeDirPassKey(from: NodeId, to: NodeId, pass: number): EdgePassKey   // DIRECTED `from->to#pass` — Scout keys (CONTRACT-CHANGES 0028)
refKey(kind: 'overworld' | 'dungeon', mapId: string, nodeId: string): RefKey
visibleNodes(run: RunState, env: EngineEnv): readonly OverworldNode[]
adjacency(run: RunState, env: EngineEnv): Readonly<Record<NodeId, readonly NodeId[]>>
findPath(run: RunState, to: NodeId, env: EngineEnv): readonly NodeId[] | null
previewPath(run: RunState, to: NodeId, env: EngineEnv): { readonly hops: number; readonly food: number; readonly starvationHp: number } | null
isDecisionNode(node: OverworldNode, run: RunState, isDestination: boolean, env: EngineEnv): boolean
isNodeLocked(run: RunState, node: OverworldNode): boolean   // node.locked && !run.unlockedNodes[id] — visible, traversable, dungeon/enter refused
townOf(run: RunState, env: EngineEnv): TownDef | null
dungeonOf(run: RunState, env: EngineEnv): DungeonDef | null

// encounters.ts (WP-OVERWORLD)
rollChanceFor(edge: OverworldEdge | null, region: RegionDef, traversal: EdgeTraversal | null, today: number, env: EngineEnv): number
rollEncounter(table: EncounterTable, pred: PredicateState, oneShotsFired: Readonly<Record<string, true>>, rng: RngState): { readonly roll: EncounterRoll | null; readonly rng: RngState }
rollHop(run: RunState, from: NodeId, to: NodeId, pass: number, env: EngineEnv): EncounterRoll | null

// travel.ts (WP-OVERWORLD) — the hop machine
startTravel(run: RunState, nodeId: NodeId, env: EngineEnv): SliceResult<RunState>
travelStep(run: RunState, env: EngineEnv): SliceResult<RunState>
openEncounter(run: RunState, roll: EncounterRoll, source: 'travel' | 'discovery', env: EngineEnv): RunState
resumeTravel(run: RunState): RunState
continueTravel(run: RunState): RunState
stayHere(run: RunState): RunState
throneWarning(run: RunState, env: EngineEnv): string | null   // the LAST door, said before it — body prose from the node's own content (0122); null off a BOSS node
challengeBoss(run: RunState, env: EngineEnv): SliceResult<RunState>

// scout.ts (WP-OVERWORLD)
scoutableEdges(run: RunState, depth: number, env: EngineEnv): readonly { from: NodeId; to: NodeId; pass: number }[]
canScout(run: RunState, env: EngineEnv): Legality                       // §4 reads it; NO_RATIONS (0116)
scout(run: RunState, env: EngineEnv): SliceResult<RunState>

// town.ts (WP-OVERWORLD)
enterTown(run: RunState, env: EngineEnv): SliceResult<RunState>     // sets run.town = { townId }
leaveTown(run: RunState): RunState                                   // run.town = null
innHeal(run: RunState, env: EngineEnv): SliceResult<RunState>
buy(run: RunState, itemId: ItemId, env: EngineEnv): SliceResult<RunState>
sell(run: RunState, x: number, y: number, env: EngineEnv): SliceResult<RunState>
tavernBoard(run: RunState, town: TownDef, env: EngineEnv): readonly TavernQuestEntry[]
talk(run: RunState, questId: string, dialogueId: string, env: EngineEnv): SliceResult<RunState>
hasPrisoners(run: RunState): boolean                                 // §4 reads it; NO_PRISONERS (0089, 0090)
turnIn(run: RunState, unitIds: readonly UnitId[], env: EngineEnv): SliceResult<RunState>

// camp.ts (WP-OVERWORLD)
campActionsUsed(run: RunState): number                                  // actions spent at THIS node TODAY (CONTRACT-CHANGES 0029)
campExhausted(run: RunState, env: EngineEnv): boolean                   // >= rules.camp.actionsPerVisit
spendCampAction(run: RunState, env: EngineEnv): RunState                // books one against (node, day); refreshes run.camp.actionTaken
enterCamp(run: RunState, env: EngineEnv): SliceResult<RunState>
leaveCamp(run: RunState): RunState
campRestWouldMend(run: RunState): boolean                               // somebody to mend (0052)
canCampRest(run: RunState, env: EngineEnv): Legality                    // §4 reads it; NOTHING_TO_MEND / NO_RATIONS (0052, 0116)
campRest(run: RunState, env: EngineEnv): SliceResult<RunState>

// dungeon.ts (WP-DUNGEON)
canEnterDungeon(run: RunState, env: EngineEnv): { ok: true; def: DungeonDef } | { ok: false; reason: string }
enterDungeon(run: RunState, env: EngineEnv): SliceResult<RunState>
ROOM_LABEL: Readonly<Record<RoomType, string>>   // what a room is CALLED; ui/screens/Dungeon.tsx reads it too (0094)
reachableRooms(run: RunState): readonly RoomId[]
moveToRoom(run: RunState, roomId: RoomId, env: EngineEnv): SliceResult<RunState>
markRoomCleared(run: RunState, roomId: RoomId, env: EngineEnv): SliceResult<RunState>
leaveDungeon(run: RunState): { ok: true; run: RunState } | { ok: false; reason: string }

// flags.ts (WP-NARRATIVE)
setFlag(run: RunState, key: string, value: FlagValue, scope: FlagScope): SliceResult<RunState>
clearFlagScope(run: RunState, scope: Exclude<FlagScope, 'permanent'>): RunState
getFlag(flags: Flags, key: string): FlagEntry | null

// predicates.ts (WP-NARRATIVE)
predicateState(run: RunState): PredicateState
evaluate(pred: Predicate, state: PredicateState): boolean
flagKeysRead(pred: Predicate): readonly string[]

// quests.ts (WP-NARRATIVE)
type QuestStatus = 'notStarted' | 'active' | 'complete'
stageWords(stage: string): string                 // the ONE humanisation of a stage id; ui/names.ts re-exports it (0094)
questStatus(run: RunState, questId: string): QuestStatus
startQuest(run: RunState, questId: string, env: EngineEnv): SliceResult<RunState>
advanceQuest(run: RunState, questId: string, toStage: string, env: EngineEnv): SliceResult<RunState>
completeQuest(run: RunState, questId: string, env: EngineEnv): SliceResult<RunState>
settleQuests(run: RunState, env: EngineEnv): SliceResult<RunState> & { readonly passes: number }
bootstrapQuests(env: EngineEnv): readonly string[]

// questEffects.ts (WP-NARRATIVE)
applyQuestEffect(run: RunState, effect: QuestEffect, env: EngineEnv): SliceResult<RunState>
applyQuestEffects(run: RunState, effects: readonly QuestEffect[], env: EngineEnv): SliceResult<RunState>

// dialogue.ts (WP-NARRATIVE)
openDialogue(run: RunState, dialogueId: string, source: DialogueSource, env: EngineEnv): SliceResult<RunState>
currentNode(run: RunState, env: EngineEnv): DialogueNode | null
visibleChoices(run: RunState, env: EngineEnv): readonly (DialogueChoice & { enabled: boolean; bestCandidate: CheckCandidate | null })[]
choose(run: RunState, choiceId: string, attemptingUnitId: UnitId | null, env: EngineEnv): SliceResult<RunState>
continueDialogue(run: RunState, env: EngineEnv): SliceResult<RunState>
bustsAfter(busts: readonly [string | null, string | null], speaker: string | undefined, env: EngineEnv): readonly [string | null, string | null]
renderText(text: string, run: RunState, env: EngineEnv): string
speakerName(characterId: string | undefined, run: RunState, env: EngineEnv): string | null

// checks.ts (WP-NARRATIVE)
evaluateCheck(req: CheckRequirement, attempting: Unit | null, run: RunState, env: EngineEnv): boolean   // reads rules.checks.statCheckRequiresLiving (CONTRACT-CHANGES 0022)
checkCandidates(req: CheckRequirement, run: RunState): readonly CheckCandidate[]
autoPick(req: CheckRequirement, run: RunState, env: EngineEnv): Unit | null                            // reads rules.checks.autoPickBestCandidate (0022)
openCheckEvent(run: RunState, checkEventId: string, source: CheckEventSource, env: EngineEnv): SliceResult<RunState>
chooseCheck(run: RunState, choiceId: string, attemptingUnitId: UnitId | null, env: EngineEnv): SliceResult<RunState>
verdictOf(pending: PendingCheckEvent, env: EngineEnv): CheckVerdict | null                             // 'passed' | 'failed' | 'untested' — the seal both surfaces stamp (0118)
dismissCheck(run: RunState, env: EngineEnv): SliceResult<RunState>

// battle.ts (WP-FLOW) — the run ⇄ combat seam, the ONE payout (never for tag 'tutorial'); queues pendingFollowUps, opens nothing
battleIdFor(origin: BattleOrigin, enemyGroupId: string | null, run: RunState, env: EngineEnv): BattleId   // the rngLabels.battle* string itself
battleSpecFor(run: RunState, pending: PendingCombat, env: EngineEnv): BattleSpec                            // rng = deriveState(run.rng, battleId)
applyBattleResult(run: RunState, result: BattleResult, env: EngineEnv): SliceResult<RunState> & { readonly report: BattleReport }
resolveCaptureTargets(targets: readonly CaptureTarget[], capturedIds: readonly UnitId[], survivingEnemyIds: readonly UnitId[]): readonly QuestEffect[]
runLedger(run: RunState, outcome: 'won' | 'lost', trophyItemId: string | null): RunLedger                  // carries runId + runSeed (Restart)
```

### `procgen/` (WP-DUNGEON)
```ts
// dungeonGraph.ts
generateDungeon(rng: RngState, def: DungeonDef, env: EngineEnv): { readonly graph: DungeonGraph; readonly rng: RngState }
validateDungeon(graph: DungeonGraph, env: EngineEnv): readonly string[]
successors(graph: DungeonGraph, roomId: RoomId | null): readonly RoomId[]
// battleFloor.ts
battleGrid(spec: Pick<BattleSpec, 'grid' | 'battleId' | 'rng'>, env: EngineEnv): CombatGrid
```

### `save/` (WP-SAVE)
```ts
// schema.ts — strict Zod mirrors, every persisted field declared; RngState = { seed, counter } strict; record keys z.string() (never IdSchema)
metaStateSchema(): z.ZodType<MetaState>
runStateSchema(): z.ZodType<RunState>
combatStateSchema(): z.ZodType<CombatState>
saveFileSchema(): z.ZodType<SaveFile>            // SaveFile = { saveVersion, contentVersion, meta, run, combat } — no screen, no ledger
// codec.ts
type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: 'version' | 'content' | 'schema' | 'json'; detail: string }
type InvariantCheck = (state: GameState, env: EngineEnv) => readonly string[]
const DEFAULT_UI: UiState; defaultUiState(): UiState              // the ui slice every hydrated state starts with (lifecycle may reuse it)
toSaveFile(state: GameState, env: EngineEnv): SaveFile          // slices verbatim (selection included)
fromSaveFile(file: SaveFile): GameState                          // ledger null, screen title, ui defaults
serialize(file: SaveFile): string
parseSave(json: string, env: EngineEnv): ParseResult<SaveFile>   // JSON → version stamps → strict Zod → checkInvariants(fromSaveFile(file)) — slot-inconsistent files fail by name (reason 'schema')
parseSaveWith(json: string, env: EngineEnv, invariants: InvariantCheck): ParseResult<SaveFile>   // parseSave = parseSaveWith(…, checkInvariants)
parseMeta(json: string): ParseResult<MetaState>
// replay.ts — `index`: a throwing action is reported at its index (path `<reduce threw: …>`); a terminal-snapshot mismatch is pinned to the LAST action (−1 for an empty log)
type Reducer = (state: GameState, action: Action, env: EngineEnv) => ReduceResult
replay(initial: GameState, actions: readonly Action[], env: EngineEnv): GameState                       // = replayWith(reduce, …)
replayWith(reducer: Reducer, initial: GameState, actions: readonly Action[], env: EngineEnv): GameState
verifyReplay(initial: GameState, actions: readonly Action[], snapshot: GameState, env: EngineEnv): { ok: true } | { ok: false; index: number; path: string }
verifyReplayWith(reducer: Reducer, initial, actions, snapshot, env): the same
firstDivergence(a: GameState, b: GameState): string | null       // first differing path over meta/run/combat/ledger/screen (never ui)
```

### `flow/` (WP-FLOW; `runtime.ts` is real)
```ts
// legality.ts — the ONE gate (table §4); reads persisted slices only, never state.ui; ui-importable
isLegal(state: GameState, action: Action, env: EngineEnv): Legality
// pump.ts — the derivations everyone shares
overlayOf(state: GameState): Overlay | null      // namePrompt > checkEvent > dialogue > quickMenu > tutorial (incl. 'victory' from lastBattle.tag)
nextPump(state: GameState): PumpAction | null    // screen combat ∧ phase combat ∧ enemy active → combat/enemyStep; screen overworld ∧ walking ∧ no overlay → travel/step; else null (never on title)
isQuiescent(state: GameState): boolean           // nextPump null ∧ overlayOf null ∧ screen ≠ title
resumeScreen(state: GameState): ScreenKind       // ledger → win/gameOver; run null → title; combat → combat; lastBattle → battleEnd; prologue dialogue → prologue; town → town; camp → camp; activeDungeon → dungeon; else overworld
// settle.ts — runs after EVERY reduce (see §3)
settle(result: ReduceResult, env: EngineEnv): ReduceResult   // throws SettleCapError past the pass budget (0035)
class SettleCapError extends Error { dump: readonly GameState[] }
freezeDeep<T>(value: T): T
// lifecycle.ts — every route INTO a run goes through resumeScreen
initialState(meta?: Partial<MetaState>): GameState
newRun(state: GameState, seed: number, env: EngineEnv): ReduceResult
continueRun(state: GameState): ReduceResult                  // screen = resumeScreen(state)
quitToTitle(state: GameState): ReduceResult                  // screen title; run + combat kept; no pump is due on title
endRun(state: GameState, outcome: 'won' | 'lost', env: EngineEnv): ReduceResult
dismissLedger(state: GameState): ReduceResult
hydrate(state: GameState, file: SaveFile, env: EngineEnv): ReduceResult   // meta/run/combat installed; ledger null; screen TITLE
skipTutorial(state: GameState, env: EngineEnv): ReduceResult
// invariants.ts (dev/test harness + parseSave)
checkInvariants(state: GameState, env: EngineEnv): readonly string[]
assertInvariants(state: GameState, env: EngineEnv): void
// fixtures.ts — the ?screen= seeds, built through the REAL reducer
fixtureFor(kind: ScreenKind, seed: number, env: EngineEnv): GameState
// runtime.ts — REAL: the one dispatch chokepoint, host-agnostic
type StateListener = (state: GameState, prev: GameState) => void
type EffectListener = (effects: readonly Effect[], action: Action, state: GameState, prev: GameState) => void | Promise<void>
interface RuntimeOptions { env; initial; persist?(file, urgent); schedule?(pump, run, settled: Promise<void>): cancel; onError?(error, action); log?: boolean; dev?: boolean }
interface Runtime { readonly env: EngineEnv; getState(); dispatch(action): readonly Effect[]; subscribe(l); onEffects(l); pump(): boolean; drain(max?): number; setPaused(b); isPaused(); settled(): Promise<void>; actions: readonly Action[]; destroy() }
createRuntime(opts: RuntimeOptions): Runtime
```
`commit` order (runtime.ts): `state ← result.state` → log → **dev guard (`dev: true` only): `assertInvariants` then `freezeDeep` (0034)** → **persist on `autosave` (try/catch → `onError`)** → assert a pump was not `refused` (else `onError` + throw, and automatic pumping halts until the next player dispatch) → state listeners → effect listeners (promises gathered into `settled()`). Persistence precedes notification, so a throwing listener can never leave storage holding a run memory has ended (brief §2.14 rule 6).

### `ui/store.ts` (real; WP-UI-SHELL maintains)
```ts
initStore(opts: RuntimeOptions): Runtime            // idempotent (StrictMode-safe)
resetStore(): void                                   // tests
getState(): GameState
getEnv(): EngineEnv                                  // the RUNTIME's env — the only env the UI may hand to a selector
dispatch(action: Action): readonly Effect[]
canDispatch(action: Action): Legality                // = isLegal(getState(), action, getEnv()) for imperative handlers
subscribe(listener: StateListener): () => void
onEffects(listener: EffectListener): () => void
useGame<T>(selector: (s: GameState) => T, isEqual?: (a: T, b: T) => boolean): T   // useSyncExternalStore + memoised selector; pass `shallow` for objects
useEnv(): EngineEnv
useLegal(action: Action): Legality                   // disabled-with-reason, memoised on state
useEffects(handler: EffectListener): void
useSettled(): boolean                                // false while the last commit's effect listeners are still animating — the ONE sanctioned transient flag
shallow<T>(a: T, b: T): boolean
setPaused(paused: boolean): void                     // the ONE pause source is `state.ui.modal`; `ui/modals` binds it (0033)
isPaused(): boolean
```
`dispatch` / `canDispatch` refuse `dev/*` outside a dev build (`isDevAction`, CONTRACT §10 / 0033).

`main.tsx` (WP-UI-SHELL) boots with `initStore({ env: createEnv(), initial, persist: localStorageWriter, schedule: uiScheduler, log: import.meta.env.DEV })` where `initial` is the parsed autosave (`parseSave` → `fromSaveFile`, invalid → `initialState()` + a loud toast; a valid one lands on Title with Continue) and `uiScheduler(pump, run, settled)` awaits `settled`, then `HOP_DELAY_MS` / `ENEMY_STEP_MS` from `ui/timings.ts` (0 under reduced motion and Playwright). `persist(file, urgent)` writes `rules.save.runKey` and `rules.save.metaKey` with one `setItem` each; urgent writes are synchronous inside `dispatch`, others coalesce to the next macrotask. With `?screen=` present, `persist` is OMITTED (fixtures never touch the developer's real save) and the HUD shows a dev badge.

### `ui/stage.ts` (WP-UI-SHELL) and `ui/combat/geometry.ts` (WP-UI-COMBAT) — DOM-free, node-importable
```ts
// ui/stage.ts — the stage constants (brief §2.1); the ONLY home for these numbers
STAGE_W = 1280; STAGE_H = 720; BAND_TOP = 120; HAND_TOP = 560; TILE = 48; TILE_MIN = 40; TILE_MAX = 96
// ui/combat/geometry.ts — imports stage.ts; consumed by the CSS grid AND by Playwright (clicks are computed here, nothing else measures)
tileSize(w: number, h: number): number                                  // even, in [TILE_MIN, TILE_MAX]; 5×5 → 84, 14×10 → 42
gridOrigin(w: number, h: number): { x: number; y: number }
tileRect(w: number, h: number, tile: TileKey): { x: number; y: number; size: number }
tileAtStagePoint(x: number, y: number, w: number, h: number): TileKey | null
boardView(state: GameState): BoardView | null                           // combat on the combat screen; run.lastBattle.field on battleEnd (read-only, drawn BESIDE the Field Report on geometry.ts#PLATE — 0084)
```
`Board` sets `style={{ '--tile': tileSize(w, h) + 'px' }}` with `grid-template-columns: repeat(w, var(--tile))`; tokens are absolutely positioned from `tileRect`, so `unitMoved` animates along `path` with WAAPI without touching state. `clientToStage` (the one DOM reader) lives only in `ui/Stage.tsx` and is exported for e2e via `window.__game`.

## 3. Flow: settle, pumps, overlays

`settle(result, env)` runs after every reduce, bounded by `rules.quests.maxSettlePasses × 4` passes (CONTRACT-CHANGES 0035; exhausting the budget throws `SettleCapError` with the walk instead of returning a half-settled state), until nothing changes:
1. `combat && combat.phase !== 'combat'` → `resolveBattle` (+ `battleField`) → for every tag but `tutorial`: `applyBattleResult` (payout; queues `pendingFollowUps`) → `combat = null` → `run.lastBattle` = report, screen `battleEnd`. Tutorial: no payout, no HP write-back, no deathLog — `lastBattle` = the report as is, screen `battleEnd` for EITHER outcome (`battleEnd/dismiss` then sets `tutorialSeen` and opens the prologue). EVERY battle ends on its report: a non-tutorial DEFEAT rests at `battleEnd` exactly as a finalBoss victory does, and `battleEnd/dismiss` closes the run — `endRun('lost')` for a defeat, `endRun('won')` for a won finale (CONTRACT-CHANGES 0082).
1b. `run !== null && combat === null && screen ∉ {title, battleEnd} && (livingUnits(run).length === 0 || (knobs.mcDeathIsDefeat && !isMcAlive(run)))` → `endRun('lost')` in the same pass — defeat is terminal outside combat too (starvation on the road, `damageParty`); ledger from the run, urgent null-save, no Continue. The `battleEnd` term is 0082's: a wiped company holds a run for exactly as long as its own field report is up, which is the ONE window `flow/invariants.ts` permits it, and turning that page ends the run.
2. `run` → `settleQuests` (fixed point; onEnter effects may open slots or recruit).
3. `run.pendingFollowUps.length > 0 && overlayOf === null && combat === null && screen ∉ {battleEnd, title}` → shift the head and open it (`openDialogue` / `openCheckEvent` with its source) — post-battle openings happen ONE at a time, after the report closes.
4. `run.pendingCombat && overlayOf(state) === null && combat === null && screen ∉ {battleEnd, title}` → `combat = seedBattle(battleSpecFor(...))`, **`pendingCombat = null`**, screen `combat`, `battleStarted`.
5. `run.pendingTravel?.status === 'suspended' && overlayOf === null && combat === null && screen === overworld` → `resumeTravel`.
6. `run.activeDungeon?.bossCleared && screen === dungeon && overlayOf === null` → `leaveDungeon` → overworld.
7. A closed `prologue` dialogue → flag `prologue_seen` + screen overworld.
Then `autosave{ urgent: screen changed || run became null }` when any persisted slice changed. NO rule fires on the title screen — rule 1 included (CONTRACT-CHANGES 0034): a parked run stays exactly as saved until Continue, so no `ui/*` action can resolve or pay out a battle saved mid-resolution.

Pumps: `travel/step` and `combat/enemyStep` are ordinary actions the RUNTIME dispatches when `nextPump(state)` says so; screens never dispatch them. Both rules carry a SCREEN term (`combat/enemyStep` only on the combat screen, `travel/step` only on overworld), so no pump is ever due on Title — Save & Quit during an enemy turn parks the battle and Continue resumes it with no input. `nextPump` never reads `state.ui`: the HOST pauses, and it does so through `ui/store.ts#setPaused`, which `ui/modals/index.tsx` drives from `state.ui.modal` (0033 — before that the binding did not exist and an open modal did not stop the world). A pump that comes back `refused` is a contract bug: the runtime routes it to `onError`, throws, and halts automatic pumping until the next player dispatch. Pumps are logged like any action, so a replay of the log is exact. The UI scheduler adds delay; the CLI and tests use `runtime.pump()` / `drain()`.

Overlays are derived by `overlayOf` (priority namePrompt > checkEvent > dialogue > quickMenu > tutorial). One suspender at a time by construction: `pendingCheckEvent` and `pendingDialogue` never coexist (`openDialogue` / `openCheckEvent` throw on the other being open; `chooseCheck` defers `startDialogue` effects to `dismissCheck` via `result.deferredEffects`; `applyBattleResult` queues capture-target dialogues and the `victoryEvent` in `pendingFollowUps` instead of opening them). The ONE exception is `promptName` fired mid-dialogue: the name prompt sits ON TOP of the dialogue (`flow/invariants.ts` allows exactly that pair) and the dialogue continues after `name/submit`.

Permitted component-local UI state (everything else lives in `GameState` or is derived from it): hover, drag-in-progress (ghost + hit tile), typewriter reveal progress, a text-field draft (name entry), and the CheckEventModal's chosen-but-unconfirmed choice ("who tries this?" picker — a `dev/`-free two-step that ends in one `check/choose`). Fixtures snapshot without them; anything that must survive a reload or be driven by the CLI is not on this list.

## 4. Legality table (`flow/legality.ts#isLegal`)

A function of the persisted slices only — `state.ui` is never read (CONTRACT-CHANGES 0002, 0015).

| action prefix | requires |
|---|---|
| `meta/newRun` | screen ∈ {title, win, gameOver} |
| `meta/continueRun` | screen title ∧ run ≠ null |
| `meta/toTitle` | screen ∉ {title}; combat allowed (state persists exactly; no pump is due on title) |
| `meta/dismissLedger` | screen ∈ {win, gameOver} |
| `save/resume` | screen title (boot) |
| `run/*` | run ≠ null ∧ combat = null ∧ screen ∈ {town, camp, overworld, dungeon, battleEnd} (the Loadout modal opens only on those screens); `run/takeLoot`/`forfeitLoot` need `pendingLoot ∋ itemId` |
| `travel/goTo` | screen overworld ∧ (overlayOf null ∨ overlayOf.kind = quickMenu) ∧ pendingTravel?.status ∉ {walking, suspended} — a node click from the quick menu is a single click (§2.9) |
| `travel/step` | pump only: overworld ∧ walking ∧ overlayOf null |
| `travel/continue`, `travel/stay`, `town/enter`, `camp/enter`, `dungeon/enter`, `travel/challengeBoss` | overworld ∧ overlay quickMenu (node type matches); `dungeon/enter` also `canEnterDungeon(run).ok` — a `locked` node not in `unlockedNodes` is ILLEGAL with that reason, so the Sealed verb renders disabled-with-reason (implemented in 0036) |
| `town/*` (others) | screen town ∧ run.town ≠ null; `town/innHeal` also `canInnHeal(town, run)` (nobody wounded / the purse cannot pay), `town/turnInAllPrisoners` also `hasPrisoners(run)`, `town/turnInPrisoner` also that id in the wagon — a bed nobody needs and a desk with an empty wagon are ILLEGAL, not merely refused (0089) |
| `camp/rest`, `camp/scout` | screen camp ∧ !camp.actionTaken ∧ the verb's own rule — `canCampRest(run)` (nobody wounded / no ration) and `canScout(run)` (no ration): a lit card that cannot pay is ILLEGAL, not merely refused (0052, 0116); `camp/leave` | screen camp |
| `dungeon/moveTo`, `dungeon/leave` | screen dungeon ∧ activeDungeon ≠ null — else 'not in a dungeon'; then overlayOf null — else the map's own 'something needs your attention first' (0117) |
| `dialogue/*` | overlay dialogue (`dialogue/continue` also: current node has zero choices) |
| `check/*` | overlay checkEvent (`check/choose` needs result null; `check/dismiss` needs result non-null) |
| `name/submit` | overlay namePrompt ∧ name non-empty after trim |
| `combat/*` | screen combat ∧ combat.phase = combat; player actions also need the active unit to be party; `enemyStep`/`enemyAct` need enemy. Coarse by design — range, path, AP and hand membership answer on a real attempt — with ONE exception: the two ARMING verbs, whose whole outcome is a selection mode, carry their own rule (`canEnterMove`, `canEnterCapture`), because arming a mode with nothing to aim at cannot change the board (0089) |
| `tutorial/skip` | combat?.tag = tutorial |
| `battleEnd/dismiss` | screen battleEnd ∧ pendingLoot = [] |
| `ui/*` | always (incl. `ui/setMapPan`) |
| `quest/*` | run ≠ null (tests/CLI/content-driven) |
| `dev/*` | always in dev/test; the host refuses in production |

Illegal ⇒ same state reference + one `refused{action, reason}`. The UI derives disabled-with-reason from the same function through `ui/store.ts#canDispatch` / `useLegal` (never by dispatching and reading `refused`).

## 5. Determinism

- One `runSeed`; `run.rng` and `combat.rng` are `RngState = Readonly<{ seed, counter }>` (no `label` — `engine/rngState.ts` strips it); every rolling case writes the advanced state back through `rngState(r)`. No function accepts an `RNG` object it did not create from state.
- Children derive by label from the PARENT SEED only (`deriveState(parent, label)`): `rngLabels.hop/encounter` carry the traversal `pass`; `battleTravel` carries the day; the `battle*` string IS the `BattleId` and the combat stream's label (`deriveState(run.rng, battleId)` — never re-prefixed); `loot(battleId)` = `loot:<battleId>`, `floor(battleId)` = `floor:<battleId>`, `treasure(dungeon, room)`, `dungeon(id)`, `shop(town, day)`.
- The action log (pumps included) replays to the same state: `save/replay.ts#verifyReplay` is asserted by every golden scenario.
- A hydrated enemy turn resumes from `nextPump` with no input once Continue routes to the combat screen. A save taken on the Field Report has `combat: null` and `run.lastBattle` set, so it cannot pay out twice.
- `Math.random` and `Date` are lint-banned in `src/engine`.

## 6. Import fences

Documented here; the eslint rules go into `game/eslint.config.js` with WP-FLOW (the config file was out of scope for the judge).

| folder | may import |
|---|---|
| `combat/*` | `../types`, `../actions`, `../effects`, `../rules`, `../rng`, `../rngState`, `../boardFloor`, `../autotile`, `../todo`, siblings |
| `run/*` | the same + `../combat/{seed,resolve,deck,tutorial}` (type + call; never `combat/reducer`) + `../procgen/*` + `../content` (`fnv1a`) |
| `procgen/*` | `../types`, `../rules`, `../rng`, `../rngState`, `../boardFloor`, `../autotile`, `../todo` |
| `save/*` | `../types`, `../actions`, `../rules`, `../reducer` (replay), `../flow/invariants` (parseSave), `zod`, `../../content/schemas` (schema.ts only: the content vocabulary's Zod schemas, exactly as `types.ts` imports their TYPES — CONTRACT-CHANGES 0025) |
| `flow/*` | everything under `engine/` |
| `reducer.ts` | `combat/reducer`, `run/reducer`, `flow/*`, `types`, `actions` |
| `content.ts` | `../content/index`, `../content/schemas`, `./types`, `./rules` |
| anything in `engine/` | never `react`, `react-dom`, `**/ui/**`, `window`, `document`, `localStorage`, `fetch`, `Date`, `Math.random` |
| `ui/**` | `engine/{types,actions,effects,rules,content,rngState,narration}`, `engine/flow/{runtime,legality,pump,invariants,fixtures}`, `engine/save/codec`, and PURE SELECTORS (nothing that returns a `SliceResult`/`ReduceResult`) from `engine/combat/{turn,targeting,damage,grid,tutorial,capture,statuses,deck,cards,words}` and `engine/run/{overworld,economy,town,dialogue,checks,party,bag,quests,dungeon,equipment,scout,difficulty}` — never `engine/reducer`, `engine/combat/reducer`, `engine/run/reducer`, `engine/flow/{settle,lifecycle}` (eslint enforces the module list; the "selectors only" half is review) |
| `scripts/**` | `engine/**`, `content/**`; never `ui/**` |

## 7. Ownership table (implementation fleet)

Each package owns its files, the brief sections listed, and MUST write the acceptance tests named (every §10 bullet in its sections becomes a named `it`). Harness: `tests/helpers/{env,session,battles,runs,saves}.ts` (WP-FLOW writes `env`/`session`; each package writes the helper it needs first).

| package | owns (files) | brief sections | acceptance tests it must write |
|---|---|---|---|
| **WP-COMBAT** | `combat/{grid,targeting,turn,deck,statuses,damage,cover,cards,items,capture,seed,resolve,tutorial,reducer}.ts` | §2.1–2.4, §2.6, §2.7 (deck), §2.8 (seed, resolve), §2.15 (tutorial), §2.16 (Genatsvale); §7.1, 3, 5, 6, 7, 20, 26 | `tests/unit/engine/combat/{grid,turn,cycles,deck,statuses,damage,forecastVsApplied,cover,cards,aoe,legality,items,capture,seed,resolve,corpse,tutorial}.test.ts` — incl. ≥3 full rounds (§7.1), forecast==applied over every card × target incl. a redirected pair AND the quiver pairs (`mod` in the matrix), every refusal leaves the state reference unchanged; `aoe.test.ts`: 'self card + area r1 hits only adjacent foes', 'all_enemies hits every foe incl. out-of-range ones', 'all_allies excludes foes', 'ring excludes the centre'; `cards.test.ts`: 'charge closes 2 tiles then hits', 'charge is refused when no path reaches strike range'; `deck.test.ts`: one `it` per `quiverEffects` kind; `seed.test.ts`: 'a member id naming a unit character takes its statOverrides and armor'; `resolve.test.ts`: 'battleField tokens sit at position ?? lastTile' |
| **WP-AI-SIM** | `combat/ai.ts`, `combat/sim.ts` | §2.5, §2.13 balance targets; §7.2, 4, 19, 21 | `tests/unit/engine/combat/{ai,ai.budget,ai.cover,determinism}.test.ts`, `tests/unit/balance/sweep.test.ts` (`rules.balance.simSeeds` seeds × scenarios vs `rules.balance`, incl. the SHIPPED field through `seedNewRun` + `battleSpecFor`; a round cap throws with the dump), `tests/unit/scenarios/battle.scenario.test.ts` |
| **WP-RUN-CORE** | `run/{newRun,party,bag,equipment,economy,difficulty,loot}.ts` | §2.7 (bag, equip), §2.13 (kit, prices, loot, difficulty), §2.16 (characters, naming data), §2.6 (`bountyFor`); §7.22 | `tests/unit/engine/run/{bag,equipment,party,naming,economy,difficulty,loot}.test.ts` — spatial footprints (a 2×3 greatsword needs a 2×3 hole), atomic equip, recruit no-ops/cap/deathLog, deterministic `buildUnitFromCharacter`, loot rows over 2000 rolls, owned exclusion, fall-down, overflow never discarded |
| **WP-OVERWORLD** | `run/{overworld,encounters,travel,scout,town,camp}.ts` | §2.9, §2.10, §2.6 (bounty board); §7.16, 17, 19, 22 | `tests/unit/engine/run/{overworld,travel,encounters,scout,town,camp}.test.ts` — path cost = hops = food, starvation, no roll into the `rules.travel.noRollInto` types (town / boss — the dungeon mouth came off the list in 0124), cooldown math, one-shots/weights/fallback, current-node click, a node click from the quick menu starts the journey in ONE dispatch, a suspended hop never re-rolls, traversal bumps on landing only, resume after every suspender, first arrival at a DISCOVERY node opens its event (second arrival is a plain pause), scout keys and consumption; `scout.test.ts`: 'one-shot pre-rolled once per scout', 'a scouted one-shot that fired elsewhere consumes as quiet', 'a scouted roll whose conditions no longer hold consumes as quiet'; `town.test.ts`: 'town/enter sets run.town and Save & Quit resumes in the town'; shop gates, inn, tavern board filter, turn-in maths |
| **WP-DUNGEON** | `procgen/{dungeonGraph,battleFloor}.ts`, `run/dungeon.ts` | §2.11, §2.1 (grid), §4 (floor); §7.18 | `tests/unit/engine/procgen/{dungeonGraph,battleFloor}.test.ts` (100 seeds × 5 dungeons; validators; two ids differ; `grid.terrain` copied verbatim), `tests/unit/engine/run/dungeon.test.ts` (each dungeon's groups/events, rest 30% free, treasure gear + 50g from `rngLabels.treasure`, boss row + exit, level scaling, 'a locked dungeon refuses dungeon/enter with a reason until unlockNode') |
| **WP-NARRATIVE** | `run/{flags,predicates,quests,questEffects,dialogue,checks}.ts` | §2.12; §7.32 | `tests/unit/engine/run/{predicates,quests,questEffects,dialogue,checks,captureTargets}.test.ts` — all 15 kinds, startQuest/advance/complete semantics, settle ≤ 8 with a cycle fixture, Blood Ties end to end without dialogue (incl. `unlockNode smugglers_cave`), one `it` per QuestEffect kind, 'startCombat from a travel encounter's check event keeps the travel origin', `statCheck` absent at the type level, living-only stat checks, auto-pick; `checks.test.ts`: 'startDialogue in a check outcome opens only after check/dismiss'; `dialogue.test.ts`: 'busts follow the speaker's side' |
| **WP-FLOW** | `reducer.ts`, `run/reducer.ts`, `run/battle.ts`, `flow/{legality,settle,pump,lifecycle,invariants,fixtures}.ts`; maintains `flow/runtime.ts`; adds the eslint fences (§6) | §1 flow, §2.8 (resolution + payout), §2.12 (event emit sites), §2.14 rule 6, §2.15 (win/lose); §7.8, 13, 16, 30 | `tests/unit/engine/flow/{legality,settle,pump,lifecycle,payout,invariants,fixtures,effects.emitters,runtime}.test.ts`, `tests/unit/scenarios/journey.scenario.test.ts` (the §10 journey headless + a defeat path; ends with `verifyReplay`); `pump.test.ts`: 'no pump is due on title with a live enemy-turn combat', 'resumeScreen maps every slot'; `lifecycle.test.ts`: 'starvation wipe ends the run with runsLost++ and run:null in the same dispatch', 'hydrate lands on title and Continue routes to the town the player quit from'; `runtime.test.ts`: 'a throwing state listener does not skip the urgent null-save', 'toTitle during an enemy turn schedules no pump; continueRun resumes it', 'a refused pump halts pumping and reports'; `settle.test.ts`: 'a won battle is not re-seeded after battleEnd/dismiss', 'capture dialogue then victoryEvent open one at a time'; `legality.test.ts`: 'legality ignores state.ui'; `fixtureFor` reaches every `ScreenKind`; every `Effect['kind']` has an emit site |
| **WP-SAVE** | `save/{schema,codec,replay}.ts` | §2.14; §7.9, 31 | `tests/unit/engine/save/{roundTrip,strict,midCombat,replay,endRun}.test.ts` — `populatedRun()` deep-equals through the real load path (mid-selection included), an extra/missing key fails, `obstacles: {}` fails naming the path, `rng.label` fails, 'a shape-valid save with turn.unitId not in units is rejected by name', 3-dispatch mid-combat snapshot replays equal, defeat null-save precedes the gameOver frame |
| **WP-CLI** | `scripts/cli.ts` | ARCHITECTURE §6; brief §10 balance gate | `tests/unit/cli/{play,balance}.test.ts` — `play --cmds` reaches every screen without a browser; `balance` exits 1 on a miss |
| **WP-UI-SHELL** | `src/main.tsx` boot, `ui/App.tsx`, `ui/Stage.tsx`, `ui/stage.ts`, `ui/timings.ts`, `ui/screens/{Title,Prologue,Overworld,Town,Camp,Dungeon,BattleEnd,Win,GameOver}`, `ui/components/*`, `ui/modals/{Dialogue,CheckEvent,NameEntry,Pause,QuestLog,Loadout,QuickMenu}`, `ui/effects/*`, `ui/audio.ts`, `styles/`; maintains `ui/store.ts` | §1 flow, §5, §2.9 presentation, §2.10, §2.12 UI, §2.16 NameEntry; §7.14, 15, 17, 25 | `tests/e2e/{boot,journey,visual,visual-canary,save,overworld}.spec.ts` — every `?screen=` boots with zero console errors, no overflow and no localStorage write; full journey and defeat path; snapshots unmasked at 0.0005 with a canary; Save & Quit mid-battle → Title → Continue restores the same battle; Restart from Game Over reuses the ledger's seed |
| **WP-UI-COMBAT** | `ui/combat/{geometry,Board,UnitToken,CardHand,Hud,Forecast,DangerZone,Tutorial,InitiativeStrip,UseItem,Capture}` | §2.8 HUD contract, §2.15; §7.24, 25 | `tests/e2e/{combat-input,second-battle}.spec.ts` — clicks from the shared geometry, click-pin-confirm and drag, potion button (via `useLegal`), capture % from `captureChance`, move by click and chess drag, Esc cancels without pause, the last hit / death play on the read-only field beside the Field Report (`ceremony.spec.ts` asserts the two boxes do not overlap — 0084), two battles in one session |
| **WP-CONTENT** (done) | `src/content/**`, `scripts/lint-content.ts` | §3, §7.23 | `tests/unit/content/*` (exists); owes: `todoMechanic` on the 26 remaining approximated cards (docs/research/gear-content-deviations.md; `lint:content` prints the list), the six DISCOVERY `discoveryEventId` events (`lint:content` warns until then), `ring`-based `flame_blade_ignite` |

Start order: WP-COMBAT, WP-RUN-CORE, WP-NARRATIVE, WP-DUNGEON (procgen half), WP-SAVE (schema half) in parallel — they need only the contract. Then WP-AI-SIM (needs combat), WP-OVERWORLD (needs bag/party), WP-DUNGEON run half (needs loot/party). Then WP-FLOW (needs everything). Then WP-CLI and both UI packages (need flow + fixtures). A package may stub-call another package's function before it lands — the tree stays green because every signature already exists.

## 8. Test conventions

- Every engine test drives `reduce(state, action, env)` or a module function directly; `environment: node`; no store, no DOM.
- Fixtures: `createEnv()` for the shipped content; `withRules(env, patch)` to flip knobs; fixture content = `createEnv({ ...content, cards: fixtureCards })`.
- Every turn/round/hop system ships a test that runs ≥3 FULL cycles (brief §7.1).
- A refused action asserts `result.state === prev` (identity) and exactly one `refused` effect.
- A stalemate / 0 % win in a sim is an engine smoke alarm (brief §7.2): reproduce one battle by hand first; `RoundCapError` carries the dump.
- No number appears twice: a value lives in `rules.ts` or in content; a test that needs it reads `env.rules`.

## 9. Changing a shared type

Shared = `types.ts`, `actions.ts`, `effects.ts`, `rules.ts`, `flow/runtime.ts`, `ui/store.ts`, and any exported signature another package imports.

1. Append an entry to `docs/rewrite/CONTRACT-CHANGES.md` FIRST (format in that file): before, after, why (brief section or bug), affects.
2. Make the edit and fix every importer in the same commit. `npm run verify` stays green; a red tree is never committed.
3. Never edit `types.ts` silently. Never widen a union or add an optional field "for later" — a member lands with its emitter/reader and a test (§7.8). Never add `undefined` as a state value; absence is `null`.
4. Adding a NEW export to a module your package owns needs no entry. Renaming/removing/re-typing one needs an entry and a grep for importers.
5. Numbers move to `rules.ts` (with an entry) or to content — never into a module as a literal (§8.13).
6. The judge's `todo.ts` is deleted, not edited, when its last importer is gone.

## 10. CLI and dev fast-path surface

`npm run cli -- <command>` (`scripts/cli.ts`, WP-CLI) — imports `src/engine/**` and `src/content/index` only; builds the env with `createEnv()`; drives `createRuntime({ env, initial, log: true })` with no scheduler and `drain()` after every command.

| command | what |
|---|---|
| `play --seed N [--screen <kind>] [--cmds "…"] [--save file.json] [--trace]` | REPL from Title (or a `fixtureFor(kind, seed)`): `new`, `continue`, `go <n>`, `menu`, `continue-travel`, `stay`, `town`, `inn`, `buy <n>`, `sell <x,y>`, `talk <n>`, `turnin <n\|all>`, `camp`, `rest`, `scout`, `leave`, `dungeon`, `room <n>`, `boss`, `choose <n> [unit]`, `next`, `dismiss`, `name <text>`, `take`/`forfeit <item>`, `gear`, `equip <n> <left\|right> <x,y>`, `unequip <n> <left\|right>`, `contracts`, `aim <n> [x,y]` (reach, targets and the forecast, read-only), `play <n> <x,y\|->`, `move <x,y>`, `item <n>`, `capture <letter>`, `end`, `auto [careful\|greedy\|random]` (one turn, CAREFUL by default — the player the bands are read off), `fight [careful\|greedy\|random]`, `skip`, `report`, `show` (ASCII board / ledger), `state`, `effects`, `save`, `quit` — EVERY list a verb reads from is addressed by its printed ROW, and a unit on the board by its printed LETTER, never by id (0094, 0095, 0139); the frame is headed by the screen's NAME and the effect stream is narrated through `engine/narration.ts` (`--trace` puts the raw effects on stderr for debugging) — every screen reachable without a browser (ARCHITECTURE §6) |
| `combat --seed N --scenario stub\|boss\|tutorial\|group:<id>:<L>\|dungeon:<id>:<room> [--cmds "…"] [--trace]` | isolated `reduceCombat` session on a `BattleSpec` (no run) |
| `simulate --scenario … --runs 50 [--policy greedy\|random] [--rules knob=value] [--json]` | `combat/sim.ts#sweep`; a round cap throws with the per-round dump, which the CLI prints as the stalled field before exiting 1 (0048) |
| `balance [--rules knob=value]` | CI gate (`npm run balance`): `rules.balance.simSeeds` seeds × scenarios, asserts win bands (with a Wilson interval printed beside each), 0 stalemates, first blood on the WORST battle, the turn band as a mean plus a per-battle ceiling; exit 1 on a miss. The shipped tuning holds every band as of 0048; still not chained into `npm run verify` (`tests/unit/cli/balance.test.ts` pins the gate's behaviour and `tests/unit/balance/sweep.test.ts` pins the shipped stub band instead) |
| `travel --seed N --to <node> [--auto]` | walks the sheet to `<node>`, answering dialogue/check/name suspenders automatically; prints one `day N · at <node> · food F · <party hp>` line per hop. Encounters are fought with the greedy policy; without `--auto` the drive STOPS after the first one (0040) |
| `replay <snapshot.json> <actions.json> [--initial <state.json>]` | `verifyReplay` from an EXPLICIT origin (default `initialState()`); also accepts the `{ initial, actions }` envelope the REPL's `log` writes. A bare log that does not open with `meta/newRun` and carries no origin is refused, not compared (0040). Prints the first divergence |
| `dialogue <id> [--cmds "1;2"]` | walks a tree with auto-picked check candidates |
| `lint` | `lintContent` + `bootstrapQuests` + the effect-param lint over `CONSUMED_PARAMS` (`scripts/cli.ts#lintEffectParams`, 0040); exit 1 on any error (asserted by `tests/unit/cli/play.test.ts`, so it runs in `npm run verify`) |
| `dump-state --screen <kind> --seed N` | pretty JSON of `fixtureFor` (Playwright fixtures) |

Dev fast-path (dev builds only; WP-UI-SHELL): `/?screen=<ScreenKind>&seed=<N>` boots WITHOUT a persister (an in-memory one at most — fixtures never overwrite `embermarch:run` / `embermarch:meta`; the HUD shows a dev badge), builds `fixtureFor(kind, seed, env)` and dispatches `dev/seedState`; `?motion=0` forces zero pump delays. `dump-state` and Playwright never touch storage. Production refuses `dev/*` at the store (`isDevAction`).

`window.__game` (dev builds, WIRED as of 0033): `{ getState, dispatch, runtime, env, isQuiescent(): boolean, settled(): Promise<void>, clientToStage(x, y) }`. The e2e wait primitive is `await page.evaluate(() => window.__game.settled())` followed by `isQuiescent()` — never a `getState()` poll.

## 11. Notes for implementers (content as shipped)

- `content.overworld.nodes[].type` is UPPERCASE (`TOWN | CAMP | DUNGEON | BOSS | TRAIL | DISCOVERY`); `areaTier` is authored per node (read it; do not recompute); TOWN/DUNGEON def ids equal node ids; the BOSS node carries `enemyGroupId`; `hidden` nodes join the graph only via `spawnedNodes`; `locked: true` (DUNGEON only — `smugglers_cave`, opened by `sq_blood_ties.find_daren.onEnter`) is read by `canEnterDungeon`; `discoveryEventId` (DISCOVERY only) is the node's one-time check event.
- `EnemyGroupMember.armor?` seeds starting armor (`ashford_company`: Kaine 6, guards 2); a member `id` that names a unit character (`mercer_kaine`, `daren`) inherits that character's `statOverrides` and level at seed time (lint: same classId).
- `EnemyAction` is `{ kind: attack|heal|buff, amount, damageStat | null, range, aoeRadius?, applyStatus? }`; buff range is 0-0 = always in range, tile null ⇒ centred on the actor, `applyStatus` to actor + allies within `aoeRadius`.
- `Item.effect` is `{ kind: 'Heal' | 'GainAp', amount }` with no target — always the drinker; `food_rations.charges = 3`; potions have `gridSize` 1×1.
- `CardEffect.RemoveStatus` uses `remove: 'armor' | 'debuff'` with `amount` XOR `all: true`; `ApplyStatus` uses `effectId`.
- `Predicate.visited` and `QuestEffect.spawnNode/unlockNode` carry a `MapNodeRef { mapKind, mapId: 'world' | dungeonId, nodeId }`.
- `QUEST_COMPLETE_STAGE` and `DIALOGUE_END` are exported by `src/content/schemas`; `IdSchema` rejects `__complete__` in content by construction.
- The six DISCOVERY nodes carry no `discoveryEventId` yet (`lint:content` warns, never fails); until WP-CONTENT authors the deck they are ordinary decision-node pauses. The engine rule (`run/travel.ts#travelStep` LAND → `openEncounter(..., 'discovery')`) is final.
- 27 cards were approximations (docs/research/gear-content-deviations.md); `wraithbow_ghost_shot` is restored (`armorPiercing: true`) and both Charge cards carry their spec range 1-3, so 26 remain — WP-CONTENT owes the `todoMechanic` markers (`lint:content` prints them). `EffectTarget 'ring'` is available for `flame_blade_ignite`.
- `RngState` is `{ seed, counter }` only: build it with `engine/rngState.ts`, never with `deriveRng(...).state()` (that carries a `label` the strict schema rejects).
