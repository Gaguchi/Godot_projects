/**
 * PROPOSAL B — engine contract: GameState and every domain type.
 *
 * Target location: `game/src/engine/types.ts`. Imports are written for that
 * location. This file is a proposal (not typechecked in place) but is real
 * TypeScript under strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes.
 *
 * DESIGN PILLARS OF PROPOSAL B
 *  1. Three persisted slices — `meta`, `run`, `combat` — plus one derived
 *     routing field (`screen`) and one ephemeral slice (`ui`). Each slice has
 *     its own reducer and its own action namespace; the combat reducer never
 *     sees `run`, the run reducer never sees `combat`. The root reducer is the
 *     only place that reads two slices at once (battle payout, screen routing).
 *  2. Replay-first. Every persisted type is plain JSON: no Set, no Map, no
 *     class, no `undefined`-meaning-absent (absence is `null`). The RNG lives in
 *     state (`run.rng`, `combat.rng`) and every rolling case writes it back, so
 *     `fold(seed, actionLog)` reproduces the live state byte-for-byte.
 *  3. Pending slots ARE the flow machine. `pendingDialogue`, `pendingCheckEvent`,
 *     `pendingNamePrompt`, `pendingCombat`, `travel`, `nodeMenu`, `venue`,
 *     `activeDungeon`, `lastBattle` are persisted run data; `screen` is a cached
 *     derivation of them (flow/screen.ts) re-computed after every dispatch and
 *     asserted equal to the stored value in dev. No screen can be reached that
 *     the slots do not justify, and no slot can be left that the screen hides.
 *  4. Content is injected, never imported, by the reducers (`EngineContext`), so
 *     balance sims and tests can run the combat reducer with fixture content and
 *     alternative `Rules`.
 *
 * ID POLICY (DECISIONS.md): plain strings validated by Zod at the content
 * boundary. The aliases below are documentation, not brands.
 */

import type { RngState } from './rng'
export type { RngState }

// ───────────────────────────────────────────────────────────────────────────
// Content types — owned by the CONTENT PORT agent (`src/content/schemas/*`).
// ASSUMPTIONS about their shape are listed at the bottom of this file
// (§ "Content shape assumptions"). Import by the obvious names; if the content
// module exports them under `src/content/schemas/index.ts` this line is final.
// ───────────────────────────────────────────────────────────────────────────
import type {
  Card,
  CardEffect,
  CharacterDef,
  CheckEvent,
  ClassDef,
  DialogueTree,
  DungeonDef,
  EncounterTable,
  EnemyAiProfile,
  EnemyGroup,
  Item,
  OverworldSheet,
  Predicate,
  QuestDef,
  QuestEffect,
  Region,
  TownDef,
} from '../content/schemas'

// Secondary content exports the engine also needs. If the content module does
// not export them under these names, define them structurally here (their
// shapes are pinned in § "Content shape assumptions").
import type {
  CaptureTarget,
  CheckRequirement,
  EncounterOutcome,
  OverworldEdge,
  OverworldNode,
  QuiverModifier,
  Rarity,
  UnitStats,
} from '../content/schemas'

export type {
  Card, CardEffect, CharacterDef, CheckEvent, ClassDef, DialogueTree, DungeonDef,
  EncounterTable, EnemyAiProfile, EnemyGroup, Item, OverworldSheet, Predicate,
  QuestDef, QuestEffect, Region, TownDef, CaptureTarget, CheckRequirement,
  EncounterOutcome, OverworldEdge, OverworldNode, QuiverModifier, Rarity, UnitStats,
}

// ───────────────────────────────────────────────────────────────────────────
// Ids (plain strings)
// ───────────────────────────────────────────────────────────────────────────
export type UnitId = string          // == CharacterDef.id for party units; group member id (+`_N`) for enemies
export type CharacterId = string
export type ClassId = string
export type CardId = string
export type ItemId = string
export type StatusId = 'poison' | 'burn' | 'slow' | 'immobilize' | 'taunt' | 'riposte' | 'empower'
export type PassiveId = 'genatsvale'  // widened by content; engine implements this one
export type FlagKey = string
export type QuestId = string
export type StageId = string
export type DialogueId = string
export type DialogueNodeId = string
export type CheckEventId = string
export type EncounterId = string
export type EncounterTableId = string
export type EnemyGroupId = string
export type NodeId = string          // overworld node
export type RoomId = string          // dungeon room (`r<row>c<col>`)
export type DungeonId = string
export type TownId = string
export type RegionId = string
export type BattleId = string
/** `"x,y"` — the ONE tile key format; `tileKey(x,y)` / `parseTile()` in combat/grid.ts. */
export type TileId = string
/** Sorted-node edge key `"<a>|<b>"` — a road is one road in both directions. */
export type EdgeKey = string
/** `"<edgeKey>#<pass>"` — one specific crossing of a road. */
export type EdgePassKey = string

export type Team = 'party' | 'enemy'
export type RegionTier = 1 | 2 | 3
export type StatKey = keyof UnitStats   // 'str'|'mag'|'skl'|'spd'|'def'|'res'|'lck'

// ───────────────────────────────────────────────────────────────────────────
// Engine context — injected into every reducer; never imported by them.
// ───────────────────────────────────────────────────────────────────────────

/** The typed, validated, read-only content registry (built once at boot by
 *  `engine/content.ts` from the content module's parsed JSON). */
export interface ContentRegistry {
  readonly version: string                          // hash of all content files; stored in saves
  readonly cards: Readonly<Record<CardId, Card>>
  readonly classes: Readonly<Record<ClassId, ClassDef>>
  readonly items: Readonly<Record<ItemId, Item>>
  readonly characters: Readonly<Record<CharacterId, CharacterDef>>
  readonly enemyGroups: Readonly<Record<EnemyGroupId, EnemyGroup>>
  readonly aiProfiles: Readonly<Record<ClassId, EnemyAiProfile>>
  readonly encounterTables: Readonly<Record<EncounterTableId, EncounterTable>>
  readonly checkEvents: Readonly<Record<CheckEventId, CheckEvent>>   // ONE id-keyed registry (inline + dungeon roomEvents + files)
  readonly dungeons: Readonly<Record<DungeonId, DungeonDef>>
  readonly towns: Readonly<Record<TownId, TownDef>>
  readonly quests: Readonly<Record<QuestId, QuestDef>>
  readonly dialogues: Readonly<Record<DialogueId, DialogueTree>>
  readonly regions: Readonly<Record<RegionId, Region>>
  readonly sheet: OverworldSheet                    // the ONE open-sheet map
  /** Derived once at boot: BFS hop distance of every node from `sheet.startNodeId`. */
  readonly nodeDistance: Readonly<Record<NodeId, number>>
}

/** The subset of content the COMBAT reducer needs — what a balance sim must supply. */
export type CombatContent = Pick<ContentRegistry, 'cards' | 'classes' | 'items' | 'aiProfiles' | 'characters'>

/** `rules.ts` exports one `RULES` object of this shape (see rules.ts). */
export type Rules = typeof import('./rules').RULES

export interface EngineContext {
  readonly content: ContentRegistry
  readonly rules: Rules
}

export interface CombatContext {
  readonly content: CombatContent
  readonly rules: Rules
}

// ───────────────────────────────────────────────────────────────────────────
// Meta slice — persists across runs (`embermarch:meta`)
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
// Units
// ───────────────────────────────────────────────────────────────────────────
export interface UnitHp { readonly current: number; readonly max: number }

/** A hand slot holds an item id; a two-handed item sits in `left` and locks `right`. */
export interface HandSlots {
  readonly left: ItemId | null
  readonly right: ItemId | null
}

/**
 * The run-level unit: identity, chassis, wounds, gear. Serialised whole in
 * `run.party`, in `run.deathLog`, and (extended) in `combat.units`.
 * `name` is the DISPLAY name; the MC's name is NOT here (see `run.mcName`).
 */
export interface UnitCore {
  readonly id: UnitId
  readonly characterId: CharacterId | null   // null for generated enemies
  readonly name: string
  readonly classId: ClassId
  readonly team: Team                        // REQUIRED (brief §2.8, §7.7)
  readonly level: number
  readonly hp: UnitHp
  readonly stats: UnitStats
  readonly mov: number                       // class startingMov copied at build time
  readonly hands: HandSlots
  readonly passives: readonly PassiveId[]
  readonly signatureCardIds: readonly CardId[]
  /** Enemy-only: copied from the group member so capture can report it. 0 = tier table. */
  readonly bountyValue: number
}

export type StatusExpiry = 'ownerTurnStart' | 'ownerTurnEnd'

/**
 * Explicit expiry model (DECISIONS.md, brief §2.4): a status decrements at ONE
 * named moment of its OWNER's turn. A 1-turn self-buff played on the owner's
 * turn with `expiresAt: 'ownerTurnStart'` therefore survives the enemy phase
 * and drops when the owner's next turn begins. Poison/burn/slow/immobilize
 * tick and decrement at `'ownerTurnEnd'`. Which statuses use which is data
 * (`RULES.statuses`). No `fresh` flag.
 */
export interface ActiveStatus {
  readonly id: StatusId
  readonly stacks: number
  readonly turnsRemaining: number
  readonly expiresAt: StatusExpiry
  readonly sourceId: UnitId | null
}

/** Combat-time extension of UnitCore. Never leaves `combat.units`. */
export interface CombatUnit extends UnitCore {
  /** null only for units taken off the board (dead or captured). Living units
   *  ALWAYS have a position — asserted at seed time (brief §7.5). Corpses lose
   *  their tile, so a live unit standing where one fell is targetable (§7.3). */
  readonly position: TileId | null
  readonly ap: number
  readonly armor: number
  readonly statuses: readonly ActiveStatus[]
  readonly hasMovedThisTurn: boolean
  /** Genatsvale ledger on the PROTECTOR: allies already covered this activation.
   *  Cleared when the protector's turn starts (brief §2.16). */
  readonly coverUsed: readonly UnitId[]
  readonly captured: boolean
}

// ───────────────────────────────────────────────────────────────────────────
// Combat slice
// ───────────────────────────────────────────────────────────────────────────
export type CardSource = 'innate' | 'hand_left' | 'hand_right' | 'signature'

export interface DeckState {
  readonly draw: readonly CardId[]
  readonly hand: readonly CardId[]
  readonly discard: readonly CardId[]
  readonly sources: Readonly<Record<CardId, CardSource>>
  /** Quiver modifiers baked at deck-build time onto bow damage cards (§2.7). */
  readonly cardMods: Readonly<Record<CardId, QuiverModifier>>
}

export type TerrainKind = 'plain' | 'forest' | 'fort'   // only read when RULES.terrain === 'on'

export interface CombatGrid {
  readonly width: number
  readonly height: number
  /** Sorted tile keys — an ARRAY so it round-trips (§7.9); lookups go through
   *  `grid.ts: isObstacle(grid, tile)` which builds a Set per call site. */
  readonly obstacles: readonly TileId[]
  /** Cosmetic dirt cells (boardFloor). null = generate from `combat.rng` label 'floor'. */
  readonly floor: readonly TileId[] | null
  /** Present only when RULES.terrain === 'on'; keyed by tile. */
  readonly terrain: Readonly<Record<TileId, TerrainKind>> | null
}

export type CombatPhase = 'COMBAT' | 'VICTORY' | 'DEFEAT'
/** No RESOLVING: state never waits for animation (ARCHITECTURE §5 "never block input on animation"). */
export type CombatSubPhase = 'IDLE' | 'SELECTING_TARGET' | 'SELECTING_MOVE'

export interface CombatSelection {
  readonly cardId: CardId | null
  readonly pinnedTile: TileId | null
}

export interface CombatTurn {
  /** Round counter: increments when the initiative index wraps. */
  readonly number: number
  readonly unitId: UnitId
  readonly team: Team
}

export type BattleTag =
  | 'tutorial' | 'travel' | 'dungeon:combat' | 'dungeon:elite' | 'dungeon:boss' | 'finalBoss' | 'sim'

/** Where the battle came from — decides where `battle/continue` goes back to. */
export type BattleOrigin =
  | { readonly kind: 'tutorial' }
  | { readonly kind: 'travel'; readonly from: NodeId; readonly to: NodeId; readonly encounterId: EncounterId }
  | { readonly kind: 'dungeon'; readonly dungeonId: DungeonId; readonly roomId: RoomId; readonly roomType: 'combat' | 'elite' | 'boss' }
  | { readonly kind: 'finalBoss'; readonly nodeId: NodeId }
  | { readonly kind: 'quest'; readonly enemyGroupId: EnemyGroupId }   // QuestEffect startCombat
  | { readonly kind: 'sim' }

export interface CombatState {
  readonly battleId: BattleId
  readonly battleTag: BattleTag
  readonly regionTier: RegionTier
  readonly origin: BattleOrigin
  readonly phase: CombatPhase
  readonly subPhase: CombatSubPhase
  readonly selection: CombatSelection
  readonly turn: CombatTurn
  readonly units: Readonly<Record<UnitId, CombatUnit>>
  readonly decks: Readonly<Record<UnitId, DeckState>>
  readonly grid: CombatGrid
  /** Bag potions carried in (item ids, one entry per drinkable). Enemies never read it. */
  readonly consumables: readonly ItemId[]
  /** Potions drunk this battle — `BattleResult.consumedItems`; removed from the bag at payout. */
  readonly consumedItems: readonly ItemId[]
  /** Named enemies the encounter cares about (Daren). Resolved at payout. */
  readonly captureTargets: readonly CaptureTarget[]
  /** Enemy-group post-victory check event (keyed on the GROUP, §2.8). */
  readonly victoryEventId: CheckEventId | null
  /** Combat RNG. Every shuffle, draw, capture roll and AI weighted pick reads
   *  and WRITES this. Seeded from `deriveRng(run.rng, battleLabel)`. */
  readonly rng: RngState
  /** Set by the root reducer once `resolveBattle` has paid out (so a save taken
   *  on the Field Report cannot pay twice). */
  readonly resolved: boolean
}

// ───────────────────────────────────────────────────────────────────────────
// Battle result — the ONE atomic payout contract (brief §2.8, §7.30)
// ───────────────────────────────────────────────────────────────────────────
export interface CapturedEnemy {
  readonly unitId: UnitId
  readonly name: string
  readonly classId: ClassId
  readonly level: number
  readonly bountyValue: number
}

export interface LootDrop {
  readonly itemId: ItemId
  readonly rarity: Rarity
  /** true when the source guarantees a drop (elite/treasure/boss/finalBoss) — never discarded on bag-full. */
  readonly guaranteed: boolean
}

export interface BattleResult {
  readonly battleId: BattleId
  readonly battleTag: BattleTag
  readonly outcome: 'victory' | 'defeat'
  readonly turns: number
  readonly goldEarned: number
  readonly enemiesDefeated: number
  readonly loot: LootDrop | null
  readonly capturedEnemies: readonly CapturedEnemy[]
  readonly consumedItems: readonly ItemId[]
  readonly survivorHp: Readonly<Record<UnitId, number>>   // current HP written back to the run
  readonly fallen: readonly UnitId[]                        // party units at 0 HP
  readonly survivingEnemyIds: readonly UnitId[]             // for captureTargets ("still standing → nothing")
}

// ───────────────────────────────────────────────────────────────────────────
// Run slice
// ───────────────────────────────────────────────────────────────────────────
export type FlagScope = 'run' | 'quest' | 'battle' | 'permanent'
export type FlagValue = boolean | number | string
export interface FlagEntry { readonly value: FlagValue; readonly scope: FlagScope }

/** `permanent` = never cleared by `run/clearFlagScope` within the run. Flags do
 *  NOT cross runs; cross-run memory is `MetaState` only (assumption, see notes). */
export type Flags = Readonly<Record<FlagKey, FlagEntry>>

export const QUEST_COMPLETE = '__complete__' as const
export type QuestStageRef = StageId | typeof QUEST_COMPLETE

export interface QuestState {
  readonly stage: QuestStageRef
  readonly metadata: Readonly<Record<string, FlagValue>>
}
/** Status is DERIVED: absent = notStarted; present & stage !== '__complete__' = active. */
export type QuestStates = Readonly<Record<QuestId, QuestState>>

export interface BagEntry {
  readonly itemId: ItemId
  readonly x: number
  readonly y: number
  /** Multi-hop items only (food rations: 3). Absent semantics avoided: 1 for everything else. */
  readonly charges: number
}

export interface Inventory {
  readonly items: readonly BagEntry[]   // spatial: `item.gridSize` rectangles on RULES.bag (8×4)
}

export interface Party {
  readonly units: Readonly<Record<UnitId, UnitCore>>
  readonly order: readonly UnitId[]
}

export interface DeathRecord {
  readonly unit: UnitCore          // whole unit, so the ledger can name/portrait the fallen
  readonly cause: 'battle' | 'starvation' | 'event'
  readonly day: number
  readonly battleId: BattleId | null
}

export interface Prisoner {
  readonly unitId: UnitId
  readonly name: string
  readonly classId: ClassId
  readonly level: number
  readonly bountyValue: number
  readonly capturedAtBattleId: BattleId
}

export interface RunStats {
  readonly battlesWon: number
  readonly enemiesDefeated: number
  readonly unitsLost: number
  readonly goldEarned: number
  readonly gearFound: number
  readonly enemiesCaptured: number
  readonly hops: number
}

export interface EdgeTraversal { readonly count: number; readonly lastDay: number }

/** What a hop over an edge WILL produce — stored by Scout, consumed by the hop. */
export type EncounterRoll =
  | { readonly kind: 'none' }
  | { readonly kind: 'encounter'; readonly entryId: EncounterId; readonly outcome: EncounterOutcome; readonly oneShot: boolean }

/**
 * THE TRAVEL STATE MACHINE (brief §2.9, §7.16). Every transition is a reducer
 * case; the UI's only job is to dispatch `travel/hop` while `phase === 'walking'`
 * (see flow/pump.ts). A hop is two reducer steps: `begin` (pay food, roll or
 * consume the scouted result, then land OR suspend) and `land` (arrive,
 * traversal++, LocationArrived, decide pause/continue/finish). A suspended hop
 * has already rolled; its landing is stored and replayed by whichever resolver
 * closes the suspender. It never rolls twice.
 */
export type TravelState =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'walking'
      readonly path: readonly NodeId[]      // remaining nodes, head = next hop target
      readonly totalHops: number
    }
  | {
      readonly phase: 'paused'              // stopped at a decision node mid-journey; node menu open
      readonly path: readonly NodeId[]
      readonly totalHops: number
    }
  | {
      readonly phase: 'suspended'           // hop rolled an encounter; landing deferred
      readonly path: readonly NodeId[]      // head is STILL the hop target (landing not yet applied)
      readonly totalHops: number
      readonly from: NodeId
      readonly to: NodeId
      readonly reason: 'dialogue' | 'checkEvent' | 'combat'
    }

/** Node quick-action menu (M&B style). Open on arrival at a decision node or on clicking the current node. */
export interface NodeMenu { readonly nodeId: NodeId }

/** Where the party is "inside" while standing on a node. */
export type Venue =
  | { readonly kind: 'town'; readonly townId: TownId }
  | { readonly kind: 'camp'; readonly nodeId: NodeId; readonly actionTaken: boolean }   // ONE action per visit

export type DungeonRoomType = 'combat' | 'elite' | 'event' | 'treasure' | 'rest' | 'boss'

export interface DungeonRoom {
  readonly id: RoomId
  readonly row: number
  readonly col: number
  readonly type: DungeonRoomType
}

export interface DungeonGraph {
  readonly dungeonId: DungeonId
  readonly rows: ReadonlyArray<readonly DungeonRoom[]>   // rows[0] entry row … rows[bossRow] = [boss]
  readonly edges: ReadonlyArray<readonly [RoomId, RoomId]> // monotonic: each edge advances one row
  readonly bossRow: number
}

export interface ActiveDungeon {
  readonly dungeonId: DungeonId
  readonly graph: DungeonGraph
  /** null = standing at the entrance (may pick any row-0 room). */
  readonly position: RoomId | null
  readonly clearedRooms: readonly RoomId[]
  /** The current room's content has been resolved (fight won / event closed / rest taken). */
  readonly roomResolved: boolean
  /** Event rooms reveal their CheckEvent on entry (deterministic pick, stored so reload agrees). */
  readonly revealedEvents: Readonly<Record<RoomId, CheckEventId>>
}

export interface PendingDialogue {
  readonly dialogueId: DialogueId
  readonly nodeId: DialogueNodeId
  /** Why it opened — decides what resumes when it ends. */
  readonly source: 'prologue' | 'travel' | 'tavern' | 'quest' | 'captureTarget' | 'dev'
}

export type PendingCheckEvent =
  | { readonly eventId: CheckEventId; readonly source: 'travel' | 'dungeon' | 'victory'; readonly stage: 'choose' }
  | {
      readonly eventId: CheckEventId
      readonly source: 'travel' | 'dungeon' | 'victory'
      readonly stage: 'result'
      readonly choiceId: string
      readonly passed: boolean
      readonly attemptingUnitId: UnitId | null
      readonly narration: string
    }

export interface PendingNamePrompt { readonly target: 'mc' | 'company' }

/** Set by QuestEffect `startCombat` mid-dialogue; seeded when the dialogue ends. */
export interface PendingCombat { readonly enemyGroupId: EnemyGroupId }

export interface RunState {
  readonly runId: string
  readonly runSeed: number
  /** Run-level RNG. Children are DERIVED by label from its seed (hop/encounter/
   *  battle/loot/dungeon), so it rarely advances; when a run-level roll does
   *  happen (camp Rest none; Scout uses derived streams) it writes back here. */
  readonly rng: RngState

  // identity
  readonly mcName: string | null
  readonly companyName: string | null

  // company
  readonly party: Party
  readonly inventory: Inventory
  readonly gold: number
  readonly prisoners: readonly Prisoner[]
  readonly deathLog: readonly DeathRecord[]

  // world
  readonly nodeId: NodeId                                     // current position on the sheet
  readonly daysElapsed: number                                // starts at 1
  readonly visitedNodes: Readonly<Record<string, true>>       // refKey `overworld:<sheet>:<node>` | `dungeon:<id>:<room>`
  readonly clearedEncounters: Readonly<Record<EncounterId, true>>
  readonly oneShotsFired: Readonly<Record<EncounterId, true>>
  readonly edgeTraversals: Readonly<Record<EdgeKey, EdgeTraversal>>
  readonly scoutedEdges: Readonly<Record<EdgePassKey, EncounterRoll>>
  readonly spawnedNodes: readonly NodeId[]                    // QuestEffect spawnNode
  readonly unlockedNodes: readonly NodeId[]                   // QuestEffect unlockNode
  readonly clearedDungeons: readonly DungeonId[]

  // narrative
  readonly flags: Flags
  readonly questStates: QuestStates

  // flow slots (the machine)
  readonly travel: TravelState
  readonly nodeMenu: NodeMenu | null
  readonly venue: Venue | null
  readonly activeDungeon: ActiveDungeon | null
  readonly pendingDialogue: PendingDialogue | null
  readonly pendingCheckEvent: PendingCheckEvent | null
  readonly pendingNamePrompt: PendingNamePrompt | null
  readonly pendingCombat: PendingCombat | null
  /** Field Report data; non-null exactly while screen === 'battleEnd'. */
  readonly lastBattle: BattleResult | null

  readonly stats: RunStats
}

/** Frozen summary kept after `run` is nulled so Win / Game Over can render (§2.14 rule 6). */
export interface RunLedger {
  readonly outcome: 'won' | 'lost'
  readonly mcName: string | null
  readonly companyName: string | null
  readonly daysElapsed: number
  readonly stats: RunStats
  readonly fallen: readonly DeathRecord[]
  readonly survivors: readonly UnitCore[]
  readonly trophy: LootDrop | null      // final-boss legendary, named on the win screen
}

// ───────────────────────────────────────────────────────────────────────────
// Screen (derived, cached) + UI (ephemeral)
// ───────────────────────────────────────────────────────────────────────────
export type Screen =
  | { readonly kind: 'title' }
  | { readonly kind: 'prologue' }
  | { readonly kind: 'overworld' }
  | { readonly kind: 'town'; readonly townId: TownId }
  | { readonly kind: 'camp'; readonly nodeId: NodeId }
  | { readonly kind: 'dungeon'; readonly dungeonId: DungeonId }
  | { readonly kind: 'combat'; readonly battleId: BattleId }
  | { readonly kind: 'battleEnd'; readonly battleId: BattleId }
  | { readonly kind: 'win' }
  | { readonly kind: 'gameOver' }
export type ScreenKind = Screen['kind']

/** Overlays are NOT stored — `flow/screen.ts: activeOverlay(state)` derives them from the pending slots, in this priority. */
export type Overlay =
  | { readonly kind: 'namePrompt'; readonly prompt: PendingNamePrompt }
  | { readonly kind: 'dialogue'; readonly dialogue: PendingDialogue }
  | { readonly kind: 'checkEvent'; readonly event: PendingCheckEvent }
  | { readonly kind: 'nodeMenu'; readonly menu: NodeMenu }
  | { readonly kind: 'tutorial'; readonly step: TutorialStep }
export type TutorialStep = 'enemyTurn' | 'move' | 'pickCard' | 'target' | 'endTurn' | 'victory'

/** Save/Load modals are gone (brief §2.14 rule 1); ARCHITECTURE §4 predates that. */
export type Modal = 'pause' | 'settings' | 'quit' | 'questLog' | 'loadout' | null
export type TownTab = 'inn' | 'shop' | 'tavern'

/** Ephemeral view state. Not persisted, not logged, not replayed. */
export interface UiState {
  readonly modal: Modal
  readonly townTab: TownTab
  readonly showDangerZones: boolean
  readonly devHud: boolean
}

// ───────────────────────────────────────────────────────────────────────────
// GameState — the whole game
// ───────────────────────────────────────────────────────────────────────────
export interface GameState {
  readonly meta: MetaState
  readonly run: RunState | null
  readonly combat: CombatState | null
  readonly ledger: RunLedger | null
  /** Cached `deriveScreen(state)`; the invariant test asserts they never diverge. */
  readonly screen: Screen
  readonly ui: UiState
}

// ───────────────────────────────────────────────────────────────────────────
// Battle seeding spec — the ONE seeder input (brief §2.8)
// ───────────────────────────────────────────────────────────────────────────
export type EnemySpec =
  | { readonly kind: 'group'; readonly enemyGroupId: EnemyGroupId; readonly level: number }   // level = max(authored, area)
  | { readonly kind: 'units'; readonly units: readonly CombatUnit[] }                          // tutorial / tests / sims

export interface BattleSpec {
  readonly battleId: BattleId
  readonly battleTag: BattleTag
  readonly regionTier: RegionTier
  readonly origin: BattleOrigin
  readonly grid: { readonly width: number; readonly height: number; readonly obstacles: readonly TileId[]; readonly floor: readonly TileId[] | null }
  readonly party: readonly UnitCore[]                // living party, run HP
  readonly partySlots: ReadonlyArray<readonly [number, number]> | null   // null = RULES.board.partySlots
  readonly enemies: EnemySpec
  readonly consumables: readonly ItemId[]
  readonly captureTargets: readonly CaptureTarget[]
  readonly victoryEventId: CheckEventId | null
  readonly rng: RngState                              // deriveRng(run.rng, 'battle:<label>').state()
}

// ───────────────────────────────────────────────────────────────────────────
// Forecast — single truth for reducer, HUD and AI (brief §2.2)
// ───────────────────────────────────────────────────────────────────────────
export type DamageType = 'physical' | 'magic'

export interface Forecast {
  readonly damageType: DamageType
  readonly baseTerm: number
  readonly statName: StatKey | null
  readonly statTerm: number
  readonly empowerTerm: number
  readonly drTerm: number            // floor(DEF|RES / 2) of the FINAL target (protector if redirected)
  readonly terrainDr: number
  readonly predicted: number         // after DR, pre-armor
  readonly hpLost: number
  readonly armorLost: number
  readonly predictedHp: number
  readonly predictedArmor: number
  readonly lethal: boolean
  readonly heal: number
  /** Non-null when `resolveCoverTarget` swapped the target: who takes it instead. */
  readonly redirectedTo: UnitId | null
}

// ───────────────────────────────────────────────────────────────────────────
// Predicates — evaluation state (one evaluator, 15 kinds; brief §2.12)
// ───────────────────────────────────────────────────────────────────────────
export interface PredicateState {
  readonly flags: Flags
  readonly questStates: QuestStates
  readonly partyClassIds: readonly ClassId[]        // living units
  readonly itemIds: readonly ItemId[]               // bag + all hands (hasItem)
  readonly gold: number
  readonly visitedNodes: Readonly<Record<string, true>>
  readonly clearedEncounters: Readonly<Record<EncounterId, true>>
}

/** Check-event candidate row ("who tries this?" picker). */
export interface CheckCandidate {
  readonly unitId: UnitId
  readonly name: string
  readonly classId: ClassId
  readonly statValue: number
  readonly meetsThreshold: boolean
}

// ───────────────────────────────────────────────────────────────────────────
// Save file + intent log (save/)
// ───────────────────────────────────────────────────────────────────────────
export interface SaveFile {
  readonly saveVersion: string
  readonly contentVersion: string
  readonly meta: MetaState
  readonly run: RunState | null
  readonly combat: CombatState | null
  readonly ledger: RunLedger | null
  /** Number of GameActions folded into this snapshot — cross-checked against `embermarch:log`. */
  readonly logLength: number
}

/** The canonical, replayable form of a run: seed + every game action since `run/new`. */
export interface IntentLog {
  readonly saveVersion: string
  readonly contentVersion: string
  readonly runSeed: number
  readonly actions: readonly import('./actions').GameAction[]
}

// ───────────────────────────────────────────────────────────────────────────
// Content shape assumptions (what this proposal expects from src/content/schemas)
// ───────────────────────────────────────────────────────────────────────────
/*
  Card            { id, name, apCost 0-3, range{min,max}, targetKind 'enemy'|'ally'|'self'|'tile'|'all_enemies'|'all_allies',
                    aoeRadius 0-2, weaponType, damageStat? 'str'|'mag'|'skl', effects: CardEffect[] }
  CardEffect      discriminated on `kind` with an explicit `target: 'self'|'target'|'ally'|'area'` selector:
                    Damage{base, damageType, armorPiercing}, Heal{amount}, ApplyStatus{statusId, value, turns, splash?:'adjacent'},
                    RemoveStatus{kind:'armor'|'debuff', amount|'all'}, Move{distance}, GrantArmor{amount}, DrawCards{count, gainAp},
                    GainAp{amount}. Teleport/Mark/Lifesteal/LinePierce/Untargetable are NOT in the union the engine switches over
                    (DECISIONS.md: ship only supported mechanics; content lint rejects any other kind).
  ClassDef        { id, name, baseStats: UnitStats, innateCardIds, startingMov, startingHp }  (no growthRates)
  Item            { id, name, kind 'food'|'potion'|'weapon'|'shield'|'quiver'|'tome'|'staff', rarity, region, gridSize{width,height},
                    buyPrice?: number (absent = unbuyable), sellPrice, weaponClass?, twoHanded?, gearCardIds?, quiverModifier?,
                    effect?: CardEffect (potions), charges?: number (food rations = 3) }
  CharacterDef    { id, displayName, classId, level, team, startingGear{left,right}, bag?, statOverrides?: Partial<UnitStats>,
                    portrait{accent,faction,shape}, signatureCardIds, passiveIds, joinDialogueId?, recruitable }
  EnemyGroup      { id, name, members: EnemyGroupMember{id?, name, classId, level, count, bountyValue?}[], victoryEvent?: CheckEventId }
  EnemyAiProfile  { classId, role 'rusher'|'archer'|'healer'|'tank', movement, preferredRange?, actions: EnemyAiAction[] }
                  EnemyAiAction { id, range, weight, situation?, aoeRadius?, targetKind 'enemy'|'ally'|'self', damageStat?, effects: CardEffect[] }
                  (brief §7.21: AI actions carry the SAME effect union as cards)
  EncounterTable  { id, regionId?, entries: { id, weight, oneShot, conditions: Predicate[], outcome: EncounterOutcome }[] }
  EncounterOutcome dialogue{dialogueId} | battle{enemyGroupId, captureTargets?} | checkEvent{eventId}   (check events are id refs into ONE registry)
  CaptureTarget   { unitId, capturedDialogueId, killedDialogueId, capturedFlag, killedFlag }
  CheckEvent      { id, title, description, choices: { id, text, check?: CheckRequirement, onPass{narration, effects}, onFail?{…} }[] }
  CheckRequirement stat{stat, threshold} | class{classId} | gold{amount} | food{amount}
  DungeonDef      { id, name, regionId, combatEnemyGroupId, eliteEnemyGroupId, bossEnemyGroupId, roomEventIds: CheckEventId[] }
  TownDef         { id, name, description, regionId, innHealCostPerUnit, shopStockIds, rumors, tavernQuests: { questId, npcName, npcDescription, dialogueId, visibleIf? }[] }
  OverworldSheet  { id, startNodeId, nodes: OverworldNode[], edges: OverworldEdge[] }
  OverworldNode   { id, name, type 'town'|'camp'|'dungeon'|'boss'|'trail'|'discovery', regionId, position{x,y}, tier?: RegionTier (override),
                    townId?, dungeonId?, discoveryEventId?, hiddenUntilSpawned?, lockedUntilUnlocked?, requires?: Predicate }
  OverworldEdge   { from, to, encounterTableId, rollChance?: number }
  Region          { id, name, tier, encounterChancePerHop?: number, favoredEnemyTags?: string[] }
  QuestDef        { id, name, initialStage, stages: Record<StageId, { id, onEnter: QuestEffect[], transitions: { when: Predicate, to: StageId }[], onExit: QuestEffect[] }> }
                  (no listeners; content never declares '__complete__')
  QuestEffect     setFlag{key,value,scope?} | recruitCharacter{characterId} | spawnNode{nodeId} | unlockNode{nodeId} | startDialogue{dialogueId}
                  | startQuest{questId} | advanceQuestStage{questId,toStage} | completeQuest{questId} | addGold{amount} | addItem{itemId}
                  | addFood{amount} | damageParty{amount} | healParty{percent} | startCombat{enemyGroupId} | promptName{target}
  DialogueTree    { id, startNodeId, nodes: Record<id, { id, speaker?: CharacterId, text, choices: DialogueChoice[], onEnter?: QuestEffect[] }> }
                  DialogueChoice { id, text, visibleIf?, enabledIf?, effects: QuestEffect[] } & ({ next } | { check, onPass, onFail })
  Predicate       15 kinds: always never flag notFlag questStage questComplete questStarted partyHas goldAtLeast hasItem visited cleared allOf anyOf not
  UnitStats       { str, mag, skl, spd, def, res, lck }
  Rarity          'common'|'uncommon'|'rare'|'epic'|'legendary'
  QuiverModifier  { kind 'poison'|'slow'|'thunder'|'explosive', value, turns }
*/
