/**
 * ENGINE CONTRACT — `GameState` and every domain type.
 *
 * Read `docs/rewrite/CONTRACT.md` before editing. Changing anything exported
 * here is a contract change: append an entry to `docs/rewrite/CONTRACT-CHANGES.md`
 * first, then edit, then fix every importer in the same commit.
 *
 * Design pillars (the synthesis of proposals A and B — see CONTRACT-JUDGEMENT.md):
 *  1. One flat `GameState` = { meta, run, combat, ledger, screen, ui }. Three
 *     persisted slices (meta/run/combat) + one frozen summary (ledger) + one
 *     explicit routing field (screen) + one ephemeral slice (ui, never saved,
 *     never logged, never replayed).
 *  2. JSON-safe by construction: no Set, no Map, no Date, no class, no
 *     function; absence is `null`, never `undefined`. `JSON.parse(JSON.stringify(s))`
 *     deep-equals `s` — that IS the save format (brief §2.14 rule 3, §7.9).
 *  3. `readonly` everywhere. Reducers return new objects; inputs are never
 *     mutated (ARCHITECTURE §7 "shared array mutated across systems").
 *  4. The RNG lives in state (`run.rng`, `combat.rng`) and every rolling case
 *     writes it back. Replaying the action log reproduces every roll.
 *  5. Pending slots ARE the flow machine: `run.pending*`, `run.activeDungeon`,
 *     `run.lastBattle`, `combat` are the data; overlays (dialogue band, check
 *     modal, name prompt, node quick-menu, tutorial) are DERIVED from them by
 *     `flow/pump.ts#overlayOf` and never stored.
 *  6. Plain string ids validated by Zod at the content/save boundary
 *     (DECISIONS: no brands). The aliases below are documentation only.
 *
 * Content vocabulary (UnitStats, StatusId, Rarity, Team, FlagScope, …) is
 * IMPORTED from `src/content/schemas` and re-exported here so the engine and
 * the content module can never drift on a shared enum.
 */

import type { ContentRegistry } from '../content/index'
import type {
  CaptureTarget,
  CheckRequirement,
  DamageStat,
  DamageType,
  EncounterOutcome,
  FlagScope,
  FlagValue,
  PassiveId,
  Portrait,
  QuestEffect,
  QuiverModifier,
  Rarity,
  StatKey,
  StatusId,
  Team,
  UnitStats,
} from '../content/schemas'
import type { Card } from '../content/schemas'
import type { Rules } from './rules'

// Re-exported content vocabulary — import engine-side from './types', not from content.
export type {
  CaptureTarget,
  CheckRequirement,
  DamageStat,
  DamageType,
  EncounterOutcome,
  FlagScope,
  FlagValue,
  PassiveId,
  Portrait,
  QuiverModifier,
  Rarity,
  StatKey,
  StatusId,
  Team,
  UnitStats,
}

/**
 * The RNG position as STATE (CONTRACT-CHANGES 0004). Exactly `{ seed, counter }`,
 * readonly, no `label` — `rng.ts#RngState` carries a mutable `label?` that would
 * leak into saves and defeat the strict schema. `createRng` accepts this shape
 * structurally; `engine/rngState.ts#rngState / deriveState` are the ONLY
 * write-back helpers (every rolling case returns through them).
 */
export type RngState = Readonly<Pick<import('./rng').RngState, 'seed' | 'counter'>>
export type {
  Card,
  CardEffect,
  CardTargetKind,
  Character,
  CheckEvent,
  CheckEventChoice,
  ClassDef,
  DialogueChoice,
  DialogueNode,
  DialogueTree,
  DungeonDef,
  EffectTarget,
  EncounterEntry,
  EncounterTable,
  EnemyAIProfile,
  EnemyAction,
  EnemyGroup,
  EnemyGroupMember,
  Item,
  MapNodeRef,
  NodeType,
  NpcCharacter,
  OverworldEdge,
  OverworldNode,
  OverworldSheet,
  Predicate,
  QuestDef,
  QuestEffect,
  QuestStage,
  RegionDef,
  TavernQuestEntry,
  TownDef,
  UnitCharacter,
  WeaponClass,
  WeaponType,
} from '../content/schemas'

// ───────────────────────────────────────────────────────────────────────────
// 0. Ids (plain strings — documentation aliases, not brands)
// ───────────────────────────────────────────────────────────────────────────

export type UnitId = string      // == UnitCharacter.id for party units; group member id (+`_N`) for enemies
export type CardId = string
/** Deck-instance id `${cardId}#${n}` — a deck may hold the same card id twice (two iron swords). */
export type CardUid = string
export type ItemId = string
export type NodeId = string      // overworld node
export type RoomId = string      // dungeon room `r<row>c<col>`
export type BattleId = string
/** `"x,y"` — THE tile key format (same as `autotile.cellKey`). Parsed only by `combat/grid.ts`. */
export type TileKey = string
/** Sorted-node edge key `"<a>|<b>"` — one road, both directions. */
export type EdgeKey = string
/** `"<edgeKey>#<pass>"` — one specific crossing of a road. */
export type EdgePassKey = string
/** `"<mapKind>:<mapId>:<nodeId>"` — visitedNodes key (brief §2.12 `visited`). */
export type RefKey = string

export type RegionTier = 1 | 2 | 3
export type HandSlot = 'left' | 'right'
export type CardSource = 'innate' | 'hand_left' | 'hand_right' | 'signature'

export interface Hp {
  readonly current: number
  readonly max: number
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Content + environment (read-only; built once at boot by engine/content.ts)
// ───────────────────────────────────────────────────────────────────────────

/** The content module's registry plus two engine-derived fields. */
export interface Content extends ContentRegistry {
  /** FNV-1a hash of the parsed content; stored in saves, compared on resume. */
  readonly version: string
  /** BFS hop distance of every VISIBLE node from `overworld.startNodeId` (authoring default for areaTier; lint input). */
  readonly nodeDistance: Readonly<Record<NodeId, number>>
}

/** Injected into every reducer and rule function; never imported by them. Tests build fixtures for both. */
export interface EngineEnv {
  readonly content: Content
  readonly rules: Rules
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Meta (survives runs; localStorage `embermarch:meta`)
// ───────────────────────────────────────────────────────────────────────────

export interface MetaState {
  readonly gameStarted: boolean
  readonly totalRuns: number
  readonly runsWon: number
  readonly runsLost: number
  readonly tutorialSeen: boolean
  readonly audioMuted: boolean
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Units
// ───────────────────────────────────────────────────────────────────────────

/**
 * The run-level unit: identity, chassis, wounds, gear. Serialised whole in
 * `run.party`, `run.deathLog` (as DeathEntry) and — extended — `combat.units`.
 * `name` is the DISPLAY name; the MC's chosen name lives in `run.mcName`
 * (rendered by `run/party.ts#displayName`), never inside the unit.
 */
export interface Unit {
  readonly id: UnitId
  readonly name: string
  readonly classId: string
  /** REQUIRED (brief §2.8, §7.7). Set by the character/enemy builder; no classId heuristics anywhere. */
  readonly team: Team
  readonly level: number
  readonly hp: Hp
  readonly stats: UnitStats
  /** Movement range (class `startingMov`, copied at build time). */
  readonly mov: number
  readonly handLeft: ItemId | null
  /** A two-handed item sits in `handLeft` and locks `handRight` (must be null). */
  readonly handRight: ItemId | null
  readonly passives: readonly PassiveId[]
  readonly signatureCardIds: readonly CardId[]
}

/**
 * Explicit expiry model (DECISIONS; brief §2.4, §7.6). A status decrements at
 * ONE named moment of its OWNER's turn. A 1-turn self-buff played on the
 * owner's turn with `ownerTurnStart` survives the whole enemy phase and drops
 * when the owner's next turn begins. Poison/burn/slow/immobilize tick and
 * decrement at `ownerTurnEnd`. Which status uses which is data (`rules.combat.statuses`).
 * No `fresh` flag.
 */
export type StatusExpiry = 'ownerTurnStart' | 'ownerTurnEnd'

export interface ActiveStatus {
  readonly id: StatusId
  readonly stacks: number
  /** Remaining countdown; decremented at the moment named by `expiresAt`; removed at 0. */
  readonly turns: number
  readonly expiresAt: StatusExpiry
  readonly sourceId: UnitId | null
}

/** A unit on the board. Party units are `Unit` + combat fields; enemies are built directly. */
export interface CombatUnit extends Unit {
  /** null ⇒ off the board (dead or captured). Living units ALWAYS have a position
   *  (asserted at seed time, §7.5). Corpses lose their tile, so a live unit on a
   *  tile where one fell is targetable (§7.3). */
  readonly position: TileKey | null
  /** PRESENTATION ONLY (CONTRACT-CHANGES 0003): the tile the unit stood on when `position` went null
   *  (death or capture), so the final hit / death / capture can be animated on a token that still has a
   *  place and the Field Report can draw the field. Never read by a rule. Invariant:
   *  `position === null ⇒ lastTile !== null`; `position !== null ⇒ lastTile === null`. */
  readonly lastTile: TileKey | null
  readonly ap: number
  /** Breakable shield (§2.2). Reset to 0 at seed (or `EnemyGroupMember.armor` / `AuthoredEnemy.armor`); lifetime per `rules.knobs.armorCap`. */
  readonly armor: number
  readonly statuses: readonly ActiveStatus[]
  readonly hasMovedThisTurn: boolean
  /** Enemy actions taken this turn (the `enemyActionBudget` knob); party units spend AP instead. */
  readonly actionsTaken: number
  /** Genatsvale ledger on the PROTECTOR: protectee ids already covered this activation; cleared at the protector's turn start (§2.16). */
  readonly coverUsed: readonly UnitId[]
  readonly captured: boolean
  /** Enemy only: authored bounty from the group member; null ⇒ `bountyFor` level tiers. */
  readonly bountyValue: number | null
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Bag, gear, decks
// ───────────────────────────────────────────────────────────────────────────

/** One placed item on the 8×4 grid. `charges` = ration hop-charges (3), 1 for everything else. */
export interface BagEntry {
  readonly itemId: ItemId
  readonly x: number
  readonly y: number
  readonly charges: number
}

export interface CardInstance {
  readonly uid: CardUid
  readonly cardId: CardId
  readonly source: CardSource
  /** Quiver modifier baked at deck-build time onto bow Damage cards in the other hand (§2.7); null otherwise. */
  readonly mod: QuiverModifier | null
}

/** draw + hand + discard is a partition of `cards` at all times (zero card loss, §7.1). */
export interface DeckState {
  readonly cards: Readonly<Record<CardUid, CardInstance>>
  readonly draw: readonly CardUid[]
  readonly hand: readonly CardUid[]
  readonly discard: readonly CardUid[]
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Combat
// ───────────────────────────────────────────────────────────────────────────

/** Loot-row key (§2.13) and label key. Always consistent with `origin` (seed asserts). */
export type BattleTag =
  | 'tutorial'
  | 'travel'
  | 'quest'
  | 'dungeon:combat'
  | 'dungeon:elite'
  | 'dungeon:boss'
  | 'finalBoss'
  | 'sim'

/** Where the battle came from — decides where `battleEnd/dismiss` returns to and the RNG label. */
export type BattleOrigin =
  | { readonly kind: 'tutorial' }
  | { readonly kind: 'travel'; readonly from: NodeId; readonly to: NodeId; readonly encounterId: string }
  | { readonly kind: 'quest'; readonly nodeId: NodeId }
  | { readonly kind: 'dungeon'; readonly dungeonId: string; readonly roomId: RoomId; readonly roomType: 'combat' | 'elite' | 'boss' }
  | { readonly kind: 'finalBoss'; readonly nodeId: NodeId }
  | { readonly kind: 'sim' }

export type CombatPhase = 'combat' | 'victory' | 'defeat'

/** Only read when `rules.knobs.terrain === 'on'`. */
export type TerrainKind = 'plain' | 'forest' | 'fort'

export interface CombatGrid {
  readonly width: number
  readonly height: number
  /** SORTED tile keys — an array so it round-trips (§7.9); `combat/grid.ts#isObstacle` does the lookup. */
  readonly obstacles: readonly TileKey[]
  /** Cosmetic dirt cells from `boardFloor.ts`, generated at seed from `rngLabels.floor(battleId)` so a reload agrees. Never read by rules. */
  readonly floor: readonly TileKey[]
  /** Present only when the terrain knob is on; null ⇒ flat board. */
  readonly terrain: Readonly<Record<TileKey, TerrainKind>> | null
}

export interface CombatTurn {
  /** Increments when the round's roster runs out. Starts at 1. */
  readonly round: number
  /** The acting unit. Never dead/captured while phase === 'combat'. Team = units[unitId].team. */
  readonly unitId: UnitId
  /** Every unit HANDED the cursor this round, the acting one included; cleared when the round turns over. Not the
   *  queue (that stays derived from `units` at every call) — it is the cursor's memory, so a slow landing or
   *  expiring mid-round can re-sort what is LEFT but can never push a unit back across the cursor into a second
   *  turn, nor lift one over it into a skip (`combat/turn.ts#successor`, CONTRACT-CHANGES 0115). */
  readonly acted: readonly UnitId[]
}

/** subPhase + selection folded into one union. Already JSON-safe, so it is persisted VERBATIM
 *  (CONTRACT-CHANGES 0016): `fromSaveFile(toSaveFile(s))` deep-equals `s` mid-selection. */
export type CombatSelection =
  | { readonly kind: 'idle' }
  | { readonly kind: 'card'; readonly cardUid: CardUid; readonly pinnedTile: TileKey | null }
  | { readonly kind: 'move' }
  | { readonly kind: 'capture' }

export interface CombatState {
  readonly battleId: BattleId
  readonly tag: BattleTag
  readonly origin: BattleOrigin
  readonly regionTier: RegionTier
  /** null for authored compositions (tutorial, sims). Resolution reads `victoryEvent` from it. */
  readonly enemyGroupId: string | null
  readonly phase: CombatPhase
  readonly grid: CombatGrid
  readonly units: Readonly<Record<UnitId, CombatUnit>>
  readonly decks: Readonly<Record<UnitId, DeckState>>
  readonly turn: CombatTurn
  readonly selection: CombatSelection
  /** Bag potions carried in (item ids, one entry per drinkable). Enemies never read it. */
  readonly consumables: readonly ItemId[]
  /** Potions drunk this battle — `BattleResult.consumedItems`; removed from the bag at payout. */
  readonly consumedItems: readonly ItemId[]
  /** Named enemies the encounter cares about (Daren). Resolved at payout. */
  readonly captureTargets: readonly CaptureTarget[]
  /** Combat stream, seeded from `deriveRng(run.rng, battleLabel)`. Every shuffle, draw, capture roll and AI weighted pick reads AND writes it. */
  readonly rng: RngState
}

/** Tutorial bandit / boss composition / sim fixtures (brief §2.15). */
export interface AuthoredEnemy {
  readonly id: UnitId
  readonly name: string
  readonly classId: string
  readonly level: number
  readonly position: TileKey
  readonly hp: number | null
  readonly armor: number | null
  readonly stats: Partial<UnitStats> | null
  readonly bountyValue: number | null
}

export type EnemySpec =
  /** Group members × count, ids stable (`daren`, `wolf_2`), level = max(authored, level), scaled. */
  | { readonly kind: 'group'; readonly enemyGroupId: string; readonly level: number }
  | { readonly kind: 'authored'; readonly units: readonly AuthoredEnemy[] }

/** The ONE seeder input (brief §2.8). Built by `run/battle.ts#battleSpecFor`, sims and tests. */
export interface BattleSpec {
  readonly battleId: BattleId
  readonly tag: BattleTag
  readonly origin: BattleOrigin
  readonly regionTier: RegionTier
  readonly enemyGroupId: string | null
  /** `terrain` is null from every shipped producer (`battleSpecFor`, `tutorialSpec`); sims/tests may author it
   *  and `procgen/battleFloor.ts#battleGrid` copies it onto `CombatGrid.terrain` (read only when the knob is on). */
  readonly grid: {
    readonly width: number
    readonly height: number
    readonly obstacles: readonly TileKey[]
    readonly terrain: Readonly<Record<TileKey, TerrainKind>> | null
  }
  /** Living party at RUN HP. Positions come from `rules.combat.partySlots` in this order. */
  readonly party: readonly Unit[]
  readonly enemies: EnemySpec
  readonly consumables: readonly ItemId[]
  readonly captureTargets: readonly CaptureTarget[]
  /** `deriveRng(run.rng, label).state()` — the combat stream's starting point. */
  readonly rng: RngState
}

/** What the play pipeline needs from a card. Cards, potions (`combat/items.ts#itemAsPlay`) and enemy
 *  actions (`combat/ai.ts#actionAsPlay`) all satisfy it, so ONE resolver serves all three. */
export type PlayableCard = Pick<Card, 'apCost' | 'range' | 'targetKind' | 'aoeRadius' | 'damageStat' | 'effects'>

/** Forecast == applied (brief §2.2): one pure computation feeds the reducer, the HUD and the AI scorer. */
export interface Forecast {
  readonly damageType: DamageType
  readonly baseTerm: number
  readonly statName: DamageStat | null
  readonly statTerm: number
  readonly empowerTerm: number
  /** Quiver `thunder` bonus baked on the play (`PlaySpec.mod`), 0 otherwise — rendered as "+3 thunder" (CONTRACT-CHANGES 0011). */
  readonly quiverTerm: number
  /** floor(DEF|RES / 2) of the FINAL target (the protector when redirected). */
  readonly drTerm: number
  readonly terrainDr: number
  /** After DR, before armor; min 0. */
  readonly afterDr: number
  readonly hpLost: number
  readonly armorLost: number
  readonly predictedHp: number
  readonly predictedArmor: number
  readonly lethal: boolean
  readonly heal: number
  /** Non-null when Genatsvale swapped the target: who actually takes the blow. */
  readonly redirectedTo: UnitId | null
  /** Status riders that will land on this target: the card's `ApplyStatus` effects aimed at it plus the
   *  quiver `poison` / `slow` rider. The forecast chips render from here; `resolvePlay` applies exactly these. */
  readonly riders: readonly { readonly status: StatusId; readonly stacks: number; readonly turns: number }[]
}

/** Derived from state by `combat/tutorial.ts#tutorialStep`. `victory` renders on the tutorial's Field Report
 *  (screen `battleEnd`, `run.lastBattle.tag === 'tutorial'`) over the read-only field — see `BattleReport.field`. */
export type TutorialStep = 'enemyTurn' | 'move' | 'pickCard' | 'target' | 'endTurn' | 'victory'

// ───────────────────────────────────────────────────────────────────────────
// 6. Battle result / report / ledger (the ONE atomic payout contract, §2.8, §7.30)
// ───────────────────────────────────────────────────────────────────────────

export interface Prisoner {
  readonly unitId: UnitId
  readonly name: string
  readonly classId: string
  readonly level: number
  readonly bountyValue: number | null
  readonly capturedAtBattleId: BattleId
}

/** Built by `combat/resolve.ts` (run-agnostic); consumed ONCE by `run/battle.ts#applyBattleResult`.
 *  Loot is NOT here — it needs the run's bag (exclude owned) and is rolled inside the payout. */
export interface BattleResult {
  readonly battleId: BattleId
  readonly tag: BattleTag
  readonly origin: BattleOrigin
  readonly outcome: 'victory' | 'defeat'
  readonly rounds: number
  /** Σ (10 + 5·L) over DEAD non-captured enemies; captured pay 0. */
  readonly goldEarned: number
  readonly enemiesDefeated: number
  readonly capturedEnemies: readonly Prisoner[]
  readonly capturedIds: readonly UnitId[]
  /** Named enemies still standing (early end) — capture targets resolve to nothing. */
  readonly survivingEnemyIds: readonly UnitId[]
  readonly consumedItems: readonly ItemId[]
  /** Current HP of every living party unit — written back to the run (wounds carry). */
  readonly survivorHp: Readonly<Record<UnitId, number>>
  readonly fallen: readonly { readonly unitId: UnitId; readonly name: string; readonly classId: string }[]
  /** The named enemies THIS battle was seeded with (`CombatState.captureTargets`, from `BattleSpec`) — carried so
   *  the payout resolves the fight's own targets instead of re-deriving them from the travel table, which left a
   *  quest- or dungeon-origin fight with none (CONTRACT-CHANGES 0030). */
  readonly captureTargets: readonly CaptureTarget[]
  /** The board as it stood at the end (`combat/resolve.ts#battleField`) — carried so `applyBattleResult` can build
   *  the Field Report without seeing `CombatState` (CONTRACT-CHANGES 0024). */
  readonly field: BattleField
}

/** One token of the frozen field a Field Report is drawn over. `tile` = `position ?? lastTile`. */
export interface BattleFieldToken {
  readonly unitId: UnitId
  readonly name: string
  readonly classId: string
  readonly team: Team
  readonly tile: TileKey
  readonly hp: Hp
  readonly armor: number
  readonly fallen: boolean
  readonly captured: boolean
}

/** The board as it stood when the battle ended (~2 KB). Built by `combat/resolve.ts#resolveBattle`, persisted in
 *  `run.lastBattle`, dropped with it. `ui/combat/geometry.ts#boardView` reads `combat` on the combat screen and
 *  `run.lastBattle.field` on battleEnd, so the Board stays mounted (read-only) under the Field Report and the
 *  final hit / death / banner effects have tokens to land on (CONTRACT-CHANGES 0003). */
export interface BattleField {
  readonly grid: CombatGrid
  readonly tokens: readonly BattleFieldToken[]
}

/** Field Report data (battleEnd screen). Lives in `run.lastBattle` while the report is up — for EVERY battle
 *  including the tutorial (tag 'tutorial': no payout, no HP write-back, both outcomes dismiss to the prologue). */
export interface BattleReport {
  readonly battleId: BattleId
  readonly tag: BattleTag
  readonly outcome: 'victory' | 'defeat'
  readonly rounds: number
  readonly field: BattleField
  readonly enemiesDefeated: number
  readonly goldEarned: number
  /** `name` is what the PLAYER calls the unit (`run/party.ts#displayName` at payout time), so the report needs no
   *  remap downstream — the CLI, the save and the Field Report screen all read the same string. */
  readonly survivors: readonly { readonly unitId: UnitId; readonly name: string; readonly hp: Hp }[]
  readonly fallen: readonly { readonly unitId: UnitId; readonly name: string; readonly classId: string }[]
  /** `placed: false` ⇒ the item is waiting in `run.pendingLoot` (guaranteed drops are never discarded). */
  readonly loot: readonly { readonly itemId: ItemId; readonly rarity: Rarity; readonly placed: boolean }[]
  readonly prisoners: readonly Prisoner[]
  readonly consumedItems: readonly ItemId[]
}

/** Frozen summary kept after `run` is nulled so Win / Game Over can render (§2.14 rule 6, §2.15). */
export interface RunLedger {
  readonly outcome: 'won' | 'lost'
  /** Win / Game Over "Restart" dispatches `meta/newRun { seed: runSeed }` (same seed, roguelite reading). */
  readonly runId: string
  readonly runSeed: number
  readonly mcName: string | null
  readonly companyName: string | null
  readonly daysElapsed: number
  readonly stats: RunStats
  readonly fallen: readonly DeathEntry[]
  /** As in `BattleReport`: `name` is already the player's chosen name (`displayName`). */
  readonly survivors: readonly { readonly unitId: UnitId; readonly name: string; readonly classId: string }[]
  /** Final-boss trophy legendary, named on the win screen (§2.13). */
  readonly trophyItemId: ItemId | null
}

// ───────────────────────────────────────────────────────────────────────────
// 7. Run
// ───────────────────────────────────────────────────────────────────────────

export interface FlagEntry {
  readonly value: FlagValue
  readonly scope: FlagScope
}
export type Flags = Readonly<Record<string, FlagEntry>>

/** Status is DERIVED (§2.12): absent = notStarted; present & stage !== '__complete__' = active. */
export interface QuestState {
  readonly stage: string
  readonly startedDay: number
}

export interface DeathEntry {
  readonly unitId: UnitId
  /** The name the player knew them by (`run/party.ts#displayName` at the moment they fell). */
  readonly name: string
  readonly classId: string
  readonly cause: 'battle' | 'starvation' | 'event'
  readonly day: number
  readonly battleId: BattleId | null
}

export interface RunStats {
  readonly battlesWon: number
  readonly enemiesDefeated: number
  readonly enemiesCaptured: number
  readonly unitsLost: number
  readonly goldEarned: number
  readonly gearFound: number
  readonly hops: number
}

export interface EdgeTraversal {
  readonly count: number
  readonly lastDay: number
}

/** The stored result of one encounter roll (pre-rolled by Scout or rolled at hop time). */
export interface EncounterRoll {
  readonly entryId: string
  readonly outcome: EncounterOutcome
  readonly oneShot: boolean
}

/**
 * THE TRAVEL STATE MACHINE (brief §2.9, §7.16). One pump (`travel/step`); a
 * hop is a record, so a suspended hop never re-rolls, and `edgeTraversals`
 * bumps only when the hop LANDS.
 */
export interface PendingTravel {
  /** Remaining node ids, next hop target first. Empty ⇒ standing at a node (quick menu). */
  readonly path: readonly NodeId[]
  readonly hopsTotal: number
  readonly status: 'walking' | 'suspended' | 'atNode'
  /** The hop in flight (rolled, not yet landed). */
  readonly hop: {
    readonly from: NodeId
    readonly to: NodeId
    readonly pass: number
    readonly encounter: EncounterRoll | null
    /** true once the encounter's suspender has been cleared (the next step lands). */
    readonly resolved: boolean
  } | null
}

export type RoomType = 'combat' | 'elite' | 'event' | 'treasure' | 'rest' | 'boss'

export interface DungeonRoom {
  readonly id: RoomId
  readonly row: number
  readonly col: number
  readonly type: RoomType
  /** Event rooms: the check event drawn at generation (deterministic; UI hides it until entered). */
  readonly checkEventId: string | null
}

export interface DungeonGraph {
  readonly dungeonId: string
  readonly rooms: Readonly<Record<RoomId, DungeonRoom>>
  /** Row-major ids; the last row is `[bossId]`. */
  readonly rows: readonly (readonly RoomId[])[]
  /** from → successors; every edge advances exactly one row and never crosses. */
  readonly edges: Readonly<Record<RoomId, readonly RoomId[]>>
  readonly bossId: RoomId
}

export interface ActiveDungeon {
  readonly dungeonId: string
  readonly graph: DungeonGraph
  /** null ⇒ at the entrance; the player picks a row-0 room. */
  readonly position: RoomId | null
  readonly cleared: Readonly<Record<RoomId, true>>
  readonly bossCleared: boolean
}

export type DialogueSource = 'prologue' | 'travel' | 'tavern' | 'quest' | 'captureTarget' | 'victory' | 'dev'

export interface PendingDialogue {
  readonly dialogueId: string
  readonly nodeId: string
  /** Why it opened — decides what resumes when it ends (`flow/settle.ts`). */
  readonly source: DialogueSource
  /** The two persistent bust slots (§2.12): character ids, left = party/narrator faction, right = everyone else.
   *  Set by `openDialogue`, updated by `choose`/`continueDialogue` as speakers change; the modal renders purely from here. */
  readonly busts: readonly [string | null, string | null]
}

/** `discovery` = the one-time event of a DISCOVERY node (`OverworldNode.discoveryEventId`), opened on first arrival. */
export type CheckEventSource = 'travel' | 'dungeon' | 'victory' | 'discovery'

export interface PendingCheckEvent {
  readonly checkEventId: string
  readonly source: CheckEventSource
  /** Filled by `check/choose`; the modal shows narration until `check/dismiss`. */
  readonly result: {
    readonly choiceId: string
    readonly passed: boolean
    readonly attemptingUnitId: UnitId | null
    readonly narration: string
    /** Outcome effects that would open a suspender (`startDialogue`) are NOT applied by `check/choose`; they
     *  wait here and `dismissCheck` applies them after the slot clears, so checkEvent and dialogue never coexist. */
    readonly deferredEffects: readonly QuestEffect[]
  } | null
}

/** A battle waiting to be seeded (by `flow/settle.ts`, which nulls this slot in the same pass) once no overlay is open.
 *  `enemies` is the group spec for travel / quest / dungeon / finalBoss and the authored bandit for the tutorial;
 *  `battleSpecFor` derives `enemyGroupId` from it (null for authored). */
export interface PendingCombat {
  readonly origin: BattleOrigin
  readonly enemies: EnemySpec
  readonly captureTargets: readonly CaptureTarget[]
}

export interface PendingNamePrompt {
  readonly target: 'mc' | 'company'
}

/** Something that must open AFTER the Field Report closes: capture-target dialogues, then the group's
 *  `victoryEvent`. Queued by `applyBattleResult`; `flow/settle.ts` opens the head once nothing else is open,
 *  so exactly one suspender slot is set at a time and a resumed save is never ambiguous. */
export type PendingFollowUp =
  | { readonly kind: 'dialogue'; readonly dialogueId: string; readonly source: DialogueSource }
  | { readonly kind: 'checkEvent'; readonly checkEventId: string; readonly source: CheckEventSource }

export interface RunState {
  readonly runId: string
  readonly runSeed: number
  /** Run stream. Hop/encounter/battle/loot/dungeon/shop streams DERIVE from it by label; it advances only for run-level rolls. */
  readonly rng: RngState
  readonly daysElapsed: number

  // company
  readonly party: Readonly<Record<UnitId, Unit>>
  readonly partyOrder: readonly UnitId[]
  readonly bag: readonly BagEntry[]
  readonly gold: number
  readonly mcName: string | null
  readonly companyName: string | null
  readonly prisoners: readonly Prisoner[]
  readonly deathLog: readonly DeathEntry[]

  // world
  readonly nodeId: NodeId
  /** Keyed by `refKey(kind, mapId, nodeId)` — overworld nodes AND dungeon rooms. */
  readonly visitedNodes: Readonly<Record<RefKey, true>>
  readonly clearedEncounters: Readonly<Record<string, true>>
  readonly oneShotsFired: Readonly<Record<string, true>>
  readonly edgeTraversals: Readonly<Record<EdgeKey, EdgeTraversal>>
  /** Pre-rolled Scout results keyed `from->to#pass` (DIRECTED — `run/overworld.ts#edgeDirPassKey`, CONTRACT-CHANGES
   *  0028); null = "the road is quiet". Consumed (deleted) by the hop that walks exactly that crossing; the same
   *  road walked the other way rolls fresh, because the roll itself is directional. */
  readonly scoutedEdges: Readonly<Record<EdgePassKey, EncounterRoll | null>>
  /** QuestEffect `spawnNode` — hidden nodes revealed. */
  readonly spawnedNodes: Readonly<Record<NodeId, true>>
  /** QuestEffect `unlockNode` — read by `run/dungeon.ts#canEnterDungeon`: a `locked` DUNGEON node refuses
   *  `dungeon/enter` (reason rendered by the quick menu) until its id is here (brief §2.11 "Smuggler's Cave via Blood Ties"). */
  readonly unlockedNodes: Readonly<Record<NodeId, true>>
  readonly clearedDungeons: Readonly<Record<string, true>>

  // narrative
  readonly flags: Flags
  readonly questStates: Readonly<Record<string, QuestState>>

  // flow slots (the machine). checkEvent and dialogue NEVER coexist; a namePrompt may sit on top of a dialogue
  // (`promptName` fired mid-tree) — overlay priority namePrompt > checkEvent > dialogue > quickMenu > tutorial.
  readonly pendingTravel: PendingTravel | null
  readonly pendingDialogue: PendingDialogue | null
  readonly pendingCheckEvent: PendingCheckEvent | null
  readonly pendingCombat: PendingCombat | null
  readonly pendingNamePrompt: PendingNamePrompt | null
  /** Post-battle openings in order (capture-target dialogues, then `victoryEvent`); `flow/settle.ts` opens the head. */
  readonly pendingFollowUps: readonly PendingFollowUp[]
  /** Guaranteed drops that did not fit the bag — never discarded (§2.13); `battleEnd/dismiss` is refused while non-empty. */
  readonly pendingLoot: readonly ItemId[]
  readonly activeDungeon: ActiveDungeon | null
  /** Non-null while inside a town screen (set by `town/enter`, cleared by `town/leave`) — the mirror of `camp`,
   *  so Save & Quit from the Inn resumes IN the town, not on the map. */
  readonly town: { readonly townId: string } | null
  /** Non-null while inside a camp; ONE action per visit (§2.10). `actionTaken` is DERIVED from `campAction`
   *  at `camp/enter` and after each action — the slot itself is transient. */
  readonly camp: { readonly actionTaken: boolean } | null
  /** The camp actions already spent at one node on one day (CONTRACT-CHANGES 0029). A "visit" is a camp-DAY, not
   *  a `camp/enter`: leaving and re-entering costs no hop, no day and no food, so the counter has to outlive the
   *  `camp` slot (and the save) or Rest becomes an unlimited food→HP converter. `null` = nothing spent yet. */
  readonly campAction: { readonly nodeId: NodeId; readonly day: number; readonly actions: number } | null
  /** Field Report data; non-null exactly while `screen.kind === 'battleEnd'`. */
  readonly lastBattle: BattleReport | null

  readonly stats: RunStats
}

// ───────────────────────────────────────────────────────────────────────────
// 8. Predicates and checks (one evaluator, 15 kinds; brief §2.12)
// ───────────────────────────────────────────────────────────────────────────

/** Built ONLY by `run/predicates.ts#predicateState`. */
export interface PredicateState {
  readonly flags: Flags
  readonly questStates: Readonly<Record<string, QuestState>>
  /** Living units' class ids. */
  readonly partyClassIds: readonly string[]
  /** Bag + every hand (`hasItem`). */
  readonly itemIds: readonly ItemId[]
  readonly gold: number
  readonly visitedNodes: Readonly<Record<RefKey, true>>
  readonly clearedEncounters: Readonly<Record<string, true>>
}

/** "Who tries this?" picker row. */
export interface CheckCandidate {
  readonly unitId: UnitId
  readonly name: string
  readonly classId: string
  readonly statValue: number
  readonly meetsThreshold: boolean
}

// ───────────────────────────────────────────────────────────────────────────
// 9. Screen / overlay / modal / ui / GameState
// ───────────────────────────────────────────────────────────────────────────

export type ScreenKind =
  | 'title'
  | 'prologue'
  | 'overworld'
  | 'town'
  | 'camp'
  | 'dungeon'
  | 'combat'
  | 'battleEnd'
  | 'win'
  | 'gameOver'

/** Explicit routing field, set by reducers on transitions. It is NOT persisted: every screen but `title` is a
 *  function of the slots (`flow/pump.ts#resumeScreen`), `hydrate` always lands on `title`, and Title "Continue"
 *  routes to `resumeScreen(state)`. `flow/invariants.ts` asserts `screen.kind === 'title' || screen.kind ===
 *  resumeScreen(state)` (CONTRACT-CHANGES 0008). */
export interface Screen {
  readonly kind: ScreenKind
}

/** DERIVED from `run.pending*` / `combat` by `flow/pump.ts#overlayOf` — never stored. Priority top to bottom
 *  (a name prompt fired mid-dialogue sits ON TOP of the dialogue; the dialogue continues after `name/submit`). */
export type Overlay =
  | { readonly kind: 'namePrompt'; readonly prompt: PendingNamePrompt }
  | { readonly kind: 'checkEvent'; readonly event: PendingCheckEvent }
  | { readonly kind: 'dialogue'; readonly dialogue: PendingDialogue }
  | { readonly kind: 'quickMenu'; readonly nodeId: NodeId }
  | { readonly kind: 'tutorial'; readonly step: TutorialStep }

export type TownTab = 'inn' | 'shop' | 'tavern'

/** Save/Load modals are gone (§2.14 rule 1). */
export type Modal =
  | { readonly kind: 'pause' }
  | { readonly kind: 'settings' }
  | { readonly kind: 'quit' }
  | { readonly kind: 'questLog' }
  | { readonly kind: 'loadout'; readonly unitId: UnitId | null }

/** Ephemeral view state. Not persisted and never read by `isLegal` / `nextPump` (legality is a function of the
 *  persisted slices only, so a replay may drop `ui/*` actions losslessly); `ui/*` actions are always accepted.
 *  `town/enter` leaves `ui` untouched — the quick menu's Inn/Shop/Tavern items dispatch `ui/setTownTab` right after. */
export interface UiState {
  readonly modal: Modal | null
  readonly townTab: TownTab
  /** Tab: danger-zone union overlay (one owner: `ui/toggleDanger`). */
  readonly showDanger: boolean
  readonly devHud: boolean
  /** Overworld sheet camera offset in sheet pixels; null = follow `run.nodeId`. Reset to null by `travel/goTo`. */
  readonly mapPan: { readonly x: number; readonly y: number } | null
}

/** THE state. `run` and `combat` are null outside a run / outside a battle; `ledger` is non-null only on win/gameOver. */
export interface GameState {
  readonly meta: MetaState
  readonly run: RunState | null
  readonly combat: CombatState | null
  readonly ledger: RunLedger | null
  readonly screen: Screen
  readonly ui: UiState
}

// ───────────────────────────────────────────────────────────────────────────
// 10. Save file (§2.14): one autosave per run + meta; strict Zod on the way in
// ───────────────────────────────────────────────────────────────────────────

/** The three persisted slices and nothing else (CONTRACT-CHANGES 0008): `screen` is derived on Continue
 *  (`resumeScreen`) and `ledger` is a transient summary (a reload during Win / Game Over lands on Title with no run). */
export interface SaveFile {
  readonly saveVersion: string
  readonly contentVersion: string
  readonly meta: MetaState
  readonly run: RunState | null
  /** null whenever no battle is in progress; persisted verbatim (selection included). */
  readonly combat: CombatState | null
}
