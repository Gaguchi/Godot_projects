/**
 * PROPOSAL A — `src/engine/types.ts`
 *
 * One flat `GameState`, every domain type, no branded ids (plain strings
 * validated by Zod at the content/save boundary — DECISIONS.md "Plain string
 * ids"). Everything here is JSON-safe by construction: no Set, no Map, no
 * Date, no functions, no class instances. Arrays and `Record<string, …>`
 * only, so `JSON.parse(JSON.stringify(state))` deep-equals `state` — that is
 * the whole save format (brief §2.14 rule 3, §7.9).
 *
 * `readonly` everywhere: the reducer returns new objects and never mutates
 * its input (ARCHITECTURE §7 "shared array mutated across systems").
 *
 * Intended location: `game/src/engine/types.ts`. Imports below are written
 * relative to that location.
 */

import type { RngState } from './rng'
import type {
  Card,
  CardEffect,
  ClassDef,
  Item,
  CharacterDef,
  EnemyGroup,
  EnemyAiProfile,
  EncounterTable,
  CheckEvent,
  DungeonDef,
  TownDef,
  OverworldSheet,
  QuestDef,
  DialogueTree,
  Region,
  Predicate,
  QuestEffect,
  // ── assumed additional exports of the content module (see ASSUMPTIONS) ──
  CaptureTarget,
  CheckRequirement,
  EncounterOutcome,
  QuiverModifier,
} from '../content/schemas'

/*
 * ASSUMPTIONS about `src/content/schemas` (written concurrently by the
 * CONTENT PORT agent; this file cannot see its final shape):
 *
 *  1. Each schema module exports the `z.infer` type under the name listed in
 *     the import above (`Card`, `ClassDef`, `Item`, `CharacterDef`,
 *     `EnemyGroup`, `EnemyAiProfile`, `EncounterTable`, `CheckEvent`,
 *     `DungeonDef`, `TownDef`, `OverworldSheet`, `QuestDef`, `DialogueTree`,
 *     `Region`, `Predicate`, `CardEffect`, `QuestEffect`) and re-exports them
 *     from `src/content/schemas/index.ts`.
 *  2. Four sub-types are ALSO exported because the engine stores them in
 *     state: `CaptureTarget` (encounter battle outcome member), `CheckRequirement`
 *     (`{kind:'stat'|'class'|'gold'|'food', …}`), `EncounterOutcome`
 *     (`dialogue | battle | checkEvent` union) and `QuiverModifier`
 *     (`{kind:'poison'|'slow'|'thunder'|'explosive', value, turns}`). If the
 *     content module does not export them, the judge should add
 *     `export type CaptureTarget = …` re-exports there; the structural shapes
 *     the engine relies on are documented in modules.md §0.
 *  3. `CardEffect` is the typed discriminated union of brief §2.3 with an
 *     explicit `target: 'self'|'target'|'ally'|'area'` selector on every
 *     member. `EnemyAiProfile.actions[].effects` reuses the same union
 *     (brief §7.21). `Item.effect?: CardEffect` carries potion effects.
 *  4. `OverworldSheet` = `{ id, startNodeId, nodes: SheetNode[], edges:
 *     SheetEdge[] }` with `SheetNode { id, name, type: 'town'|'camp'|'dungeon'|
 *     'boss'|'trail'|'discovery', regionId, position, tier?, townId?,
 *     dungeonId?, encounterTableId?, discoveryEventId?, hidden?, locked? }`
 *     and `SheetEdge { from, to, encounterTableId?, rollChance? }`.
 *  5. `CheckEvent`s live in ONE id-keyed registry (brief §3); dungeon
 *     `roomEventIds: string[]` and encounter `checkEvent` outcomes reference
 *     them by id (`{ kind: 'checkEvent', checkEventId }`).
 *  6. `UnitStats`, `StatKey`, `Rarity`, `FlagScope`, `Team`, `DamageType`
 *     are defined HERE (engine-owned vocabulary) and the content schemas
 *     define structurally identical shapes; TypeScript's structural typing
 *     makes the two interchangeable, so no import is needed for them.
 */

// ───────────────────────────────────────────────────────────────────────────
// 0. Vocabulary
// ───────────────────────────────────────────────────────────────────────────

export type Team = 'party' | 'enemy'
export type DamageType = 'physical' | 'magic'
export type DamageStat = 'str' | 'mag' | 'skl'
export type StatKey = 'str' | 'mag' | 'skl' | 'spd' | 'def' | 'res' | 'lck'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type RegionTier = 1 | 2 | 3
export type HandSlot = 'left' | 'right'
export type CardSource = 'innate' | 'hand_left' | 'hand_right' | 'signature'
export type FlagScope = 'run' | 'quest' | 'battle' | 'permanent'
export type FlagValue = string | number | boolean
export type StatusId = 'poison' | 'burn' | 'slow' | 'immobilize' | 'taunt' | 'riposte' | 'empower'
export type PassiveId = 'genatsvale'

/** "x,y" — the one tile key format. Parsed by `combat/targeting.ts` only. */
export type TileKey = string

export interface UnitStats {
  readonly str: number
  readonly mag: number
  readonly skl: number
  readonly spd: number
  readonly def: number
  readonly res: number
  readonly lck: number
}

export interface Hp {
  readonly current: number
  readonly max: number
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Content registry (read-only, built once at boot by engine/content.ts)
// ───────────────────────────────────────────────────────────────────────────

export interface Content {
  /** Hash/version stamp of the parsed content; stored in the save file. */
  readonly version: string
  readonly cards: Readonly<Record<string, Card>>
  readonly classes: Readonly<Record<string, ClassDef>>
  readonly items: Readonly<Record<string, Item>>
  readonly characters: Readonly<Record<string, CharacterDef>>
  readonly enemyGroups: Readonly<Record<string, EnemyGroup>>
  /** Keyed by classId. */
  readonly enemyAi: Readonly<Record<string, EnemyAiProfile>>
  readonly encounterTables: Readonly<Record<string, EncounterTable>>
  readonly checkEvents: Readonly<Record<string, CheckEvent>>
  readonly dungeons: Readonly<Record<string, DungeonDef>>
  readonly towns: Readonly<Record<string, TownDef>>
  /** The ONE open sheet (DECISIONS: one open-sheet map). */
  readonly sheet: OverworldSheet
  readonly quests: Readonly<Record<string, QuestDef>>
  readonly dialogues: Readonly<Record<string, DialogueTree>>
  readonly regions: Readonly<Record<string, Region>>
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Meta (survives runs; key `embermarch:meta`)
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

/** A unit as it lives in the run (party roster). Enemies never exist here. */
export interface PartyUnit {
  /** == CharacterDef.id for authored characters; also the portrait id. */
  readonly id: string
  /** Display name — presentation only. `mc` renders `run.mcName ?? name`. */
  readonly name: string
  readonly classId: string
  readonly team: Team
  readonly level: number
  readonly hp: Hp
  readonly stats: UnitStats
  /** Movement range (class `startingMov`, may be overridden by character). */
  readonly mov: number
  readonly handLeft: string | null
  readonly handRight: string | null
  readonly passives: readonly PassiveId[]
  readonly signatureCardIds: readonly string[]
}

export type StatusExpiry = 'ownerTurnStart' | 'ownerTurnEnd' | 'turns'

/** Explicit expiry model (DECISIONS: no `fresh` flag). */
export interface ActiveStatus {
  readonly id: StatusId
  readonly stacks: number
  /** Remaining countdown; decremented at the point named by `expiresAt`. */
  readonly turns: number
  readonly expiresAt: StatusExpiry
  readonly source: string | null
}

/** A unit on the board. Party units are `PartyUnit` + combat fields. */
export interface CombatUnit extends PartyUnit {
  /** null ⇒ off the board (dead or captured). Corpses leave the board (§7.3). */
  readonly position: TileKey | null
  readonly ap: number
  readonly armor: number
  readonly statuses: readonly ActiveStatus[]
  readonly hasMoved: boolean
  /** Actions taken this turn (enemy budget knob; party uses AP). */
  readonly actionsTaken: number
  /** Genatsvale ledger on the PROTECTOR: protectee ids covered this turn. */
  readonly coverUsed: readonly string[]
  readonly captured: boolean
  /** Enemy only: authored bounty (EnemyGroup member). */
  readonly bountyValue: number | null
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Bag, gear, decks
// ───────────────────────────────────────────────────────────────────────────

/** One placed item. `charges` = 3 for rations, 1 for everything else. */
export interface BagEntry {
  readonly itemId: string
  readonly x: number
  readonly y: number
  readonly charges: number
}

export interface CardInstance {
  readonly uid: string
  readonly cardId: string
  readonly source: CardSource
  /** Quiver modifier baked at deck-build time (bow damage cards only). */
  readonly mod: QuiverModifier | null
}

export interface DeckState {
  readonly cards: Readonly<Record<string, CardInstance>>
  readonly draw: readonly string[]
  readonly hand: readonly string[]
  readonly discard: readonly string[]
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Combat
// ───────────────────────────────────────────────────────────────────────────

export type BattleTag =
  | 'tutorial'
  | 'travel'
  | 'quest'
  | 'dungeon:combat'
  | 'dungeon:elite'
  | 'dungeon:boss'
  | 'finalBoss'

export type CombatPhase = 'combat' | 'victory' | 'defeat'

export interface CombatGrid {
  readonly width: number
  readonly height: number
  /** Sorted tile keys. */
  readonly obstacles: readonly TileKey[]
  /** Cosmetic dirt patches (boardFloor); never read by rules. */
  readonly floor?: readonly TileKey[]
  /** Only populated when `rules.knobs.terrain === 'on'`; absent ⇒ flat board. */
  readonly terrain?: Readonly<Record<TileKey, TerrainKind>>
}

export type TerrainKind = 'forest' | 'fort'

export interface CombatTurn {
  /** Increments when the derived initiative queue wraps. Starts at 1. */
  readonly round: number
  /** The acting unit. Never null while phase === 'combat'. */
  readonly unitId: string
}

/** subPhase + selection folded into one union. Serialized as `{kind:'idle'}`. */
export type CombatSelection =
  | { readonly kind: 'idle' }
  | { readonly kind: 'card'; readonly cardUid: string; readonly pinnedTile: TileKey | null }
  | { readonly kind: 'move' }
  | { readonly kind: 'capture' }

export interface CombatState {
  readonly battleId: string
  readonly tag: BattleTag
  readonly regionTier: RegionTier
  readonly enemyGroupId: string | null
  /** Carried from `PendingCombat` so resolution can mark the encounter cleared. */
  readonly encounterId: string | null
  readonly phase: CombatPhase
  readonly grid: CombatGrid
  readonly units: Readonly<Record<string, CombatUnit>>
  readonly decks: Readonly<Record<string, DeckState>>
  readonly turn: CombatTurn
  readonly selection: CombatSelection
  /** Bag potions carried in (item ids, one entry per drinkable instance). */
  readonly consumables: readonly string[]
  readonly consumedItems: readonly string[]
  readonly captureTargets: readonly CaptureTarget[]
  /** Combat stream; every shuffle, capture roll and AI pick writes it back. */
  readonly rng: RngState
}

/** Input to `seedBattle`. One seeder for every battle kind (brief §2.8). */
export interface BattleSpec {
  readonly battleId: string
  readonly tag: BattleTag
  readonly regionTier: RegionTier
  readonly grid: { readonly width: number; readonly height: number }
  readonly party: readonly PartyUnit[]
  readonly enemies:
    | { readonly kind: 'group'; readonly enemyGroupId: string; readonly level: number }
    | { readonly kind: 'authored'; readonly units: readonly AuthoredEnemy[] }
  readonly consumables: readonly string[]
  readonly captureTargets: readonly CaptureTarget[]
  readonly rng: RngState
}

/** Tutorial bandit / final boss composition (brief §2.15). */
export interface AuthoredEnemy {
  readonly id: string
  readonly name: string
  readonly classId: string
  readonly level: number
  readonly position: TileKey
  readonly hp?: number
  readonly armor?: number
  readonly stats?: Partial<UnitStats>
  readonly bountyValue?: number
}

/** Forecast == applied. Breakdown terms the HUD renders (brief §2.2). */
export interface DamageForecast {
  readonly damageType: DamageType
  readonly baseTerm: number
  readonly statName: DamageStat | null
  readonly statTerm: number
  readonly empowerTerm: number
  readonly drTerm: number
  readonly terrainDr: number
  readonly afterDr: number
  readonly hpLost: number
  readonly armorLost: number
  readonly predictedHp: number
  readonly predictedArmor: number
  readonly lethal: boolean
  readonly heal: number
  /** Set when Genatsvale redirected the blow: who actually takes it. */
  readonly redirectedTo: string | null
}

// ───────────────────────────────────────────────────────────────────────────
// 6. Run
// ───────────────────────────────────────────────────────────────────────────

export interface FlagEntry {
  readonly value: FlagValue
  readonly scope: FlagScope
}

export interface QuestState {
  /** Stage id or the engine-owned `QUEST_COMPLETE` sentinel. */
  readonly stage: string
  readonly startedDay: number
}

export interface Prisoner {
  readonly unitId: string
  readonly name: string
  readonly classId: string
  readonly level: number
  readonly bountyValue: number | null
  readonly capturedAtBattleId: string
}

export interface DeathEntry {
  readonly unitId: string
  readonly name: string
  readonly classId: string
  readonly cause: 'battle' | 'starvation' | 'event'
  readonly day: number
  readonly battleId: string | null
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

/** The stored result of one encounter roll (pre-rolled by Scout or rolled at hop time). */
export interface EncounterRoll {
  readonly entryId: string
  readonly outcome: EncounterOutcome
  readonly oneShot: boolean
}

/**
 * The travel state machine (brief §7.16). One pump (`travel/step`); a hop
 * is a record, so a suspended hop never re-rolls and traversal counts bump
 * only when the hop LANDS.
 */
export interface PendingTravel {
  /** Remaining node ids, next hop first. Empty ⇒ standing at a node. */
  readonly path: readonly string[]
  readonly hopsTotal: number
  readonly status: 'walking' | 'suspended' | 'atNode'
  /** The hop in flight (rolled, not yet landed). */
  readonly hop: {
    readonly from: string
    readonly to: string
    readonly pass: number
    readonly encounter: EncounterRoll | null
    /** true once the encounter's suspender has been cleared. */
    readonly resolved: boolean
  } | null
}

export interface ActiveDungeon {
  readonly dungeonId: string
  readonly graph: DungeonGraph
  /** null ⇒ at the entrance; the player picks a row-0 room. */
  readonly position: string | null
  readonly cleared: Readonly<Record<string, true>>
  readonly bossCleared: boolean
}

export interface PendingDialogue {
  readonly dialogueId: string
  readonly nodeId: string
}

export interface PendingCheckEvent {
  readonly checkEventId: string
  readonly source: 'travel' | 'dungeon' | 'victory' | 'discovery'
  /** Filled by `check/choose`; the modal shows narration until `check/dismiss`. */
  readonly result: {
    readonly choiceId: string
    readonly passed: boolean
    readonly attemptingUnitId: string | null
    readonly narration: string
  } | null
}

export interface PendingCombat {
  readonly enemyGroupId: string
  readonly tag: BattleTag
  readonly captureTargets: readonly CaptureTarget[]
  /** Encounter-table entry that spawned it; victory marks `clearedEncounters`. */
  readonly encounterId: string | null
}

export interface PendingNamePrompt {
  readonly target: 'mc' | 'company'
}

export interface RunState {
  readonly runId: string
  readonly runSeed: number
  /** Run stream: hop/encounter/battle/loot/dungeon streams derive from it. */
  readonly rng: RngState
  readonly daysElapsed: number

  readonly party: Readonly<Record<string, PartyUnit>>
  readonly partyOrder: readonly string[]
  readonly bag: readonly BagEntry[]
  readonly gold: number
  readonly mcName: string | null
  readonly companyName: string | null

  readonly location: { readonly nodeId: string }
  readonly visitedNodes: Readonly<Record<string, true>>
  readonly clearedEncounters: Readonly<Record<string, true>>
  readonly oneShotsFired: Readonly<Record<string, true>>
  /** Keyed by `edgeKey(a,b)` (sorted ids). */
  readonly edgeTraversals: Readonly<Record<string, { readonly count: number; readonly lastDay: number }>>
  /** Keyed by `${edgeKey}#${pass}`; null = "the road is quiet". */
  readonly scoutedEdges: Readonly<Record<string, EncounterRoll | null>>
  /** spawnNode / unlockNode results. */
  readonly nodeOverrides: Readonly<Record<string, { readonly spawned?: true; readonly unlocked?: true }>>

  readonly flags: Readonly<Record<string, FlagEntry>>
  readonly questStates: Readonly<Record<string, QuestState>>
  readonly prisoners: readonly Prisoner[]
  readonly deathLog: readonly DeathEntry[]
  readonly runStats: RunStats

  // ── pending slots: at most one of dialogue/check/name is open at a time ──
  readonly pendingTravel: PendingTravel | null
  readonly pendingDialogue: PendingDialogue | null
  readonly pendingCheckEvent: PendingCheckEvent | null
  readonly pendingCombat: PendingCombat | null
  readonly pendingNamePrompt: PendingNamePrompt | null
  /** Guaranteed drops that did not fit the bag (never discarded, §2.13). */
  readonly pendingLoot: readonly string[]
  readonly activeDungeon: ActiveDungeon | null
}

// ───────────────────────────────────────────────────────────────────────────
// 7. Dungeon graph (procgen output; stored in the run)
// ───────────────────────────────────────────────────────────────────────────

export type RoomType = 'combat' | 'elite' | 'event' | 'treasure' | 'rest' | 'boss'

export interface DungeonRoom {
  readonly id: string
  readonly row: number
  readonly col: number
  readonly type: RoomType
  /** Event rooms: the check event picked at generation time. */
  readonly checkEventId: string | null
}

export interface DungeonGraph {
  readonly dungeonId: string
  readonly rooms: Readonly<Record<string, DungeonRoom>>
  /** Row-major ids; `rows[rows.length-1]` is `[bossId]`. */
  readonly rows: readonly (readonly string[])[]
  /** from → successors (each advances exactly one row). */
  readonly edges: Readonly<Record<string, readonly string[]>>
  readonly bossId: string
}

// ───────────────────────────────────────────────────────────────────────────
// 8. Battle result / reports / ledgers
// ───────────────────────────────────────────────────────────────────────────

/** Built by `combat/resolve.ts`; consumed ONCE by `run/battle.ts#applyBattleResult`. */
export interface BattleResult {
  readonly battleId: string
  readonly tag: BattleTag
  readonly outcome: 'victory' | 'defeat'
  readonly goldEarned: number
  readonly enemiesDefeated: number
  readonly loot: readonly string[]
  readonly capturedEnemies: readonly Prisoner[]
  readonly consumedItems: readonly string[]
  readonly survivorHp: Readonly<Record<string, number>>
  readonly fallen: readonly { readonly unitId: string; readonly name: string; readonly classId: string }[]
  /** Named enemies still standing (fled/early end) — capture targets resolve to nothing. */
  readonly survivingEnemyIds: readonly string[]
  readonly capturedIds: readonly string[]
}

export interface BattleReport {
  readonly battleId: string
  readonly tag: BattleTag
  readonly enemiesDefeated: number
  readonly goldEarned: number
  readonly survivors: readonly { readonly unitId: string; readonly name: string; readonly hp: Hp }[]
  readonly fallen: readonly { readonly unitId: string; readonly name: string }[]
  readonly loot: readonly { readonly itemId: string; readonly rarity: Rarity; readonly placed: boolean }[]
  readonly prisoners: readonly Prisoner[]
  readonly consumedItems: readonly string[]
}

export interface RunLedger {
  readonly outcome: 'won' | 'lost'
  readonly mcName: string | null
  readonly companyName: string | null
  readonly days: number
  readonly stats: RunStats
  readonly fallen: readonly DeathEntry[]
  /** Final-boss trophy legendary, named on the win screen. */
  readonly trophyItemId: string | null
}

// ───────────────────────────────────────────────────────────────────────────
// 9. Screen / modal / GameState
// ───────────────────────────────────────────────────────────────────────────

export type TownTab = 'inn' | 'shop' | 'tavern'

export type Screen =
  | { readonly kind: 'title' }
  | { readonly kind: 'prologue' }
  | { readonly kind: 'overworld' }
  | { readonly kind: 'town'; readonly townId: string; readonly tab: TownTab }
  | { readonly kind: 'camp' }
  | { readonly kind: 'dungeon' }
  | { readonly kind: 'combat'; readonly showDanger: boolean }
  | { readonly kind: 'battleEnd'; readonly report: BattleReport }
  | { readonly kind: 'win'; readonly ledger: RunLedger }
  | { readonly kind: 'gameOver'; readonly ledger: RunLedger }

export type Modal =
  | null
  | { readonly kind: 'pause' }
  | { readonly kind: 'settings' }
  | { readonly kind: 'quit' }
  | { readonly kind: 'questLog' }
  | { readonly kind: 'loadout'; readonly unitId: string | null }

/**
 * THE state. Everything the game knows, in one object. `run` and `combat`
 * are null outside a run / outside a battle. Overlays (dialogue band, check
 * modal, name prompt, node quick-menu) are DERIVED from `run.pending*` —
 * they are not screens and not modals.
 */
export interface GameState {
  readonly meta: MetaState
  readonly run: RunState | null
  readonly combat: CombatState | null
  readonly screen: Screen
  readonly modal: Modal
}

// ───────────────────────────────────────────────────────────────────────────
// 10. Save file
// ───────────────────────────────────────────────────────────────────────────

export interface SaveFile {
  readonly saveVersion: string
  readonly contentVersion: string
  readonly meta: MetaState
  readonly run: RunState | null
  /** null whenever no battle is in progress; `selection` forced idle. */
  readonly combat: CombatState | null
  /** Persisted so Continue lands on the same screen (town, dungeon, battle…). */
  readonly screen: Screen
}

// ───────────────────────────────────────────────────────────────────────────
// 11. Predicate evaluation view (built ONLY by run/predicates.ts#predicateView)
// ───────────────────────────────────────────────────────────────────────────

export interface PredicateView {
  readonly flags: Readonly<Record<string, FlagEntry>>
  readonly questStates: Readonly<Record<string, QuestState>>
  readonly partyClassIds: readonly string[]
  readonly bagItemIds: readonly string[]
  readonly gold: number
  readonly visitedNodes: Readonly<Record<string, true>>
  readonly clearedEncounters: Readonly<Record<string, true>>
}

// Re-exported so engine modules import content vocabulary from one place.
export type {
  Card,
  CardEffect,
  ClassDef,
  Item,
  CharacterDef,
  EnemyGroup,
  EnemyAiProfile,
  EncounterTable,
  CheckEvent,
  DungeonDef,
  TownDef,
  OverworldSheet,
  QuestDef,
  DialogueTree,
  Region,
  Predicate,
  QuestEffect,
  CaptureTarget,
  CheckRequirement,
  EncounterOutcome,
  QuiverModifier,
  RngState,
}
