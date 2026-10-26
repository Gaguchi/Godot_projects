/**
 * save/schema.ts — strict Zod mirrors of every persisted type (brief §2.14 rules 3-4, §7.9).
 * `.strict()` at every level; EVERY field of RunState/CombatState/MetaState declared, so a silently-stripped
 * field is impossible (§7.9: `daysElapsed` / `runStats` / `oneShotsFired` vanished on load because the old
 * schema did not name them); `grid.obstacles` is `z.array(z.string())` (a `Set` serialises as `{}` and fails
 * there with a named path). The type-level checks at the bottom (`*MirrorCheck`) fail `tsc` the moment a
 * mirror and its domain type drift apart in either direction.
 *
 * Conventions the mirror follows:
 *  - `RngState` = `{ seed: int, counter: int ≥ 0 }` strict — no `label` (CONTRACT-CHANGES 0004: the mutable
 *    `rng.ts#RngState.label` must never reach a save).
 *  - Record KEYS are `z.string()`, never `IdSchema` (CONTRACT-CHANGES 0005): `flags` carry engine-minted keys,
 *    `visitedNodes` keys are `overworld:world:node`, `scoutedEdges` keys are `a->b#1`, card uids are `card#1`.
 *  - Optional-with-undefined never appears: absence is `null` in the types, so no `.optional()` on any field the
 *    engine owns. The only optional key in a persisted document is content's own
 *    `EncounterOutcome.battle.captureTargets?` (it is copied verbatim from the encounter table).
 *  - Content vocabulary (statuses, teams, rarity, quest effects, capture targets, encounter outcomes) is imported
 *    from `src/content/schemas`, exactly as `types.ts` imports the TYPES from there: one enum, one owner, no drift.
 *  - Integers where the brief defines a count/level/coordinate; no other value constraints — semantic rules
 *    (gold ≥ 0, bag rectangles, deck partition) are `flow/invariants.ts`' job and run inside `parseSave`.
 *    Two cheap referential checks the acceptance list names live here so a shape-valid file is rejected by name
 *    even before the invariants run: `turn.unitId ∈ units` and a `card` selection's uid ∈ the active hand.
 */
import { z } from 'zod'
import {
  CaptureTargetSchema,
  EncounterOutcomeSchema,
  FlagScopeSchema,
  FlagValueSchema,
  PassiveIdSchema,
  QuestEffectSchema,
  QuiverModifierSchema,
  RaritySchema,
  StatusIdSchema,
  TeamSchema,
  UnitStatsSchema,
} from '../../content/schemas'
import type { CombatState, MetaState, RunState, SaveFile, UnitStats } from '../types'

// ───────────────────────────────────────────────────────────────────────────
// Primitives
// ───────────────────────────────────────────────────────────────────────────

const int = (): z.ZodNumber => z.number().int()
const str = (): z.ZodString => z.string()
/** Engine-minted record keys (`refKey`, `edgeDirPassKey`, card uids, flag keys) — never `IdSchema`. */
const record = <V extends z.ZodTypeAny>(value: V): z.ZodRecord<z.ZodString, V> => z.record(z.string(), value)
const markerRecord = (): z.ZodRecord<z.ZodString, z.ZodLiteral<true>> => record(z.literal(true))

/** `{ seed, counter }` and nothing else — `label` is the one field that would defeat a strict mirror. */
const rngStateObject = z.object({ seed: int(), counter: int().min(0) }).strict()

const hpObject = z.object({ current: int(), max: int() }).strict()

const regionTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])

/**
 * Zod 3 types `.optional()` as `?: T | undefined`; under `exactOptionalPropertyTypes` that is not assignable to
 * the hand-written `Partial<UnitStats>` in `types.ts`. The runtime behaviour is identical (JSON never carries
 * `undefined`, and a present `undefined` fails `int()`), so this is the ONE place the mirror's static type is
 * asserted instead of inferred. Keys still come from `UnitStatsSchema`, so a new stat cannot drift.
 */
const partialStatsSchema = UnitStatsSchema.partial().strict() as unknown as z.ZodType<Partial<UnitStats>>

function isStrictlyAscending(keys: readonly string[]): boolean {
  for (let i = 1; i < keys.length; i++) {
    if (!(keys[i - 1]! < keys[i]!)) return false
  }
  return true
}

// ───────────────────────────────────────────────────────────────────────────
// Meta
// ───────────────────────────────────────────────────────────────────────────

const metaStateObject = z
  .object({
    gameStarted: z.boolean(),
    totalRuns: int(),
    runsWon: int(),
    runsLost: int(),
    tutorialSeen: z.boolean(),
    audioMuted: z.boolean(),
  })
  .strict()

// ───────────────────────────────────────────────────────────────────────────
// Units, statuses, decks
// ───────────────────────────────────────────────────────────────────────────

const unitShape = {
  id: str(),
  name: str(),
  classId: str(),
  team: TeamSchema,
  level: int(),
  hp: hpObject,
  stats: UnitStatsSchema,
  mov: int(),
  handLeft: str().nullable(),
  handRight: str().nullable(),
  passives: z.array(PassiveIdSchema),
  signatureCardIds: z.array(str()),
}
const unitObject = z.object(unitShape).strict()

const activeStatusObject = z
  .object({
    id: StatusIdSchema,
    stacks: int(),
    turns: int(),
    expiresAt: z.enum(['ownerTurnStart', 'ownerTurnEnd']),
    sourceId: str().nullable(),
  })
  .strict()

const combatUnitObject = z
  .object({
    ...unitShape,
    position: str().nullable(),
    lastTile: str().nullable(),
    ap: int(),
    armor: int(),
    statuses: z.array(activeStatusObject),
    hasMovedThisTurn: z.boolean(),
    actionsTaken: int(),
    coverUsed: z.array(str()),
    captured: z.boolean(),
    bountyValue: int().nullable(),
  })
  .strict()

const cardInstanceObject = z
  .object({
    uid: str(),
    cardId: str(),
    source: z.enum(['innate', 'hand_left', 'hand_right', 'signature']),
    mod: QuiverModifierSchema.nullable(),
  })
  .strict()

const deckStateObject = z
  .object({
    cards: record(cardInstanceObject),
    draw: z.array(str()),
    hand: z.array(str()),
    discard: z.array(str()),
  })
  .strict()

// ───────────────────────────────────────────────────────────────────────────
// Combat
// ───────────────────────────────────────────────────────────────────────────

const battleTagSchema = z.enum(['tutorial', 'travel', 'quest', 'dungeon:combat', 'dungeon:elite', 'dungeon:boss', 'finalBoss', 'sim'])

const battleOriginSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tutorial') }).strict(),
  z.object({ kind: z.literal('travel'), from: str(), to: str(), encounterId: str() }).strict(),
  z.object({ kind: z.literal('quest'), nodeId: str() }).strict(),
  z.object({ kind: z.literal('dungeon'), dungeonId: str(), roomId: str(), roomType: z.enum(['combat', 'elite', 'boss']) }).strict(),
  z.object({ kind: z.literal('finalBoss'), nodeId: str() }).strict(),
  z.object({ kind: z.literal('sim') }).strict(),
])

const terrainKindSchema = z.enum(['plain', 'forest', 'fort'])

const combatGridObject = z
  .object({
    width: int(),
    height: int(),
    /** An ARRAY (a `Set` serialises as `{}` — the §7.9 bug) and SORTED: `combat/grid.ts#isObstacle` binary-searches it,
     *  so an unsorted list would silently misreport obstacles after a reload. */
    obstacles: z
      .array(str())
      .refine(isStrictlyAscending, { message: 'obstacles must be a sorted string[] with no duplicates (isObstacle binary-searches it)' }),
    floor: z.array(str()),
    terrain: record(terrainKindSchema).nullable(),
  })
  .strict()

const combatTurnObject = z.object({ round: int(), unitId: str(), acted: z.array(str()) }).strict()

const combatSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('idle') }).strict(),
  z.object({ kind: z.literal('card'), cardUid: str(), pinnedTile: str().nullable() }).strict(),
  z.object({ kind: z.literal('move') }).strict(),
  z.object({ kind: z.literal('capture') }).strict(),
])

const combatStateObject = z
  .object({
    battleId: str(),
    tag: battleTagSchema,
    origin: battleOriginSchema,
    regionTier: regionTierSchema,
    enemyGroupId: str().nullable(),
    phase: z.enum(['combat', 'victory', 'defeat']),
    grid: combatGridObject,
    units: record(combatUnitObject),
    decks: record(deckStateObject),
    turn: combatTurnObject,
    /** Persisted VERBATIM (CONTRACT-CHANGES 0016) — a mid-selection save resumes mid-selection. */
    selection: combatSelectionSchema,
    consumables: z.array(str()),
    consumedItems: z.array(str()),
    captureTargets: z.array(CaptureTargetSchema),
    rng: rngStateObject,
  })
  .strict()
  .superRefine((combat, ctx) => {
    // A shape-valid file whose acting unit does not exist would throw inside the first selector (§2.14 rule 4:
    // "failure → Title with a loud toast, stores untouched"); name it here instead. OWN-property lookups: zod's record
    // output is a plain-prototype object, so `'constructor' in units` is true with no such unit in the file.
    if (!Object.hasOwn(combat.units, combat.turn.unitId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['turn', 'unitId'], message: `turn.unitId '${combat.turn.unitId}' is not in units` })
    }
    if (combat.selection.kind === 'card') {
      const hand = Object.hasOwn(combat.decks, combat.turn.unitId) ? combat.decks[combat.turn.unitId]!.hand : []
      if (!hand.includes(combat.selection.cardUid)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['selection', 'cardUid'], message: `selection.cardUid '${combat.selection.cardUid}' is not in the active unit's hand` })
      }
    }
  })

// ───────────────────────────────────────────────────────────────────────────
// Run
// ───────────────────────────────────────────────────────────────────────────

const flagEntryObject = z.object({ value: FlagValueSchema, scope: FlagScopeSchema }).strict()
const questStateObject = z.object({ stage: str(), startedDay: int() }).strict()

const deathEntryObject = z
  .object({
    unitId: str(),
    name: str(),
    classId: str(),
    cause: z.enum(['battle', 'starvation', 'event']),
    day: int(),
    battleId: str().nullable(),
  })
  .strict()

const runStatsObject = z
  .object({
    battlesWon: int(),
    enemiesDefeated: int(),
    enemiesCaptured: int(),
    unitsLost: int(),
    goldEarned: int(),
    gearFound: int(),
    hops: int(),
  })
  .strict()

const edgeTraversalObject = z.object({ count: int(), lastDay: int() }).strict()

const encounterRollObject = z
  .object({
    entryId: str(),
    /** Content's own strict union, copied verbatim from the encounter table at roll time. */
    outcome: EncounterOutcomeSchema,
    oneShot: z.boolean(),
  })
  .strict()

const pendingTravelObject = z
  .object({
    path: z.array(str()),
    hopsTotal: int(),
    status: z.enum(['walking', 'suspended', 'atNode']),
    hop: z
      .object({
        from: str(),
        to: str(),
        pass: int(),
        encounter: encounterRollObject.nullable(),
        resolved: z.boolean(),
      })
      .strict()
      .nullable(),
  })
  .strict()

const roomTypeSchema = z.enum(['combat', 'elite', 'event', 'treasure', 'rest', 'boss'])

const dungeonRoomObject = z
  .object({ id: str(), row: int(), col: int(), type: roomTypeSchema, checkEventId: str().nullable() })
  .strict()

const dungeonGraphObject = z
  .object({
    dungeonId: str(),
    rooms: record(dungeonRoomObject),
    rows: z.array(z.array(str())),
    edges: record(z.array(str())),
    bossId: str(),
  })
  .strict()

const activeDungeonObject = z
  .object({
    dungeonId: str(),
    graph: dungeonGraphObject,
    position: str().nullable(),
    cleared: markerRecord(),
    bossCleared: z.boolean(),
  })
  .strict()

const dialogueSourceSchema = z.enum(['prologue', 'travel', 'tavern', 'quest', 'captureTarget', 'victory', 'dev'])
const checkEventSourceSchema = z.enum(['travel', 'dungeon', 'victory', 'discovery'])

const pendingDialogueObject = z
  .object({
    dialogueId: str(),
    nodeId: str(),
    source: dialogueSourceSchema,
    busts: z.tuple([str().nullable(), str().nullable()]),
  })
  .strict()

const pendingCheckEventObject = z
  .object({
    checkEventId: str(),
    source: checkEventSourceSchema,
    result: z
      .object({
        choiceId: str(),
        passed: z.boolean(),
        attemptingUnitId: str().nullable(),
        narration: str(),
        deferredEffects: z.array(QuestEffectSchema),
      })
      .strict()
      .nullable(),
  })
  .strict()

const authoredEnemyObject = z
  .object({
    id: str(),
    name: str(),
    classId: str(),
    level: int(),
    position: str(),
    hp: int().nullable(),
    armor: int().nullable(),
    stats: partialStatsSchema.nullable(),
    bountyValue: int().nullable(),
  })
  .strict()

const enemySpecSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('group'), enemyGroupId: str(), level: int() }).strict(),
  z.object({ kind: z.literal('authored'), units: z.array(authoredEnemyObject) }).strict(),
])

const pendingCombatObject = z
  .object({ origin: battleOriginSchema, enemies: enemySpecSchema, captureTargets: z.array(CaptureTargetSchema) })
  .strict()

const pendingNamePromptObject = z.object({ target: z.enum(['mc', 'company']) }).strict()

const pendingFollowUpSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('dialogue'), dialogueId: str(), source: dialogueSourceSchema }).strict(),
  z.object({ kind: z.literal('checkEvent'), checkEventId: str(), source: checkEventSourceSchema }).strict(),
])

const prisonerObject = z
  .object({
    unitId: str(),
    name: str(),
    classId: str(),
    level: int(),
    bountyValue: int().nullable(),
    capturedAtBattleId: str(),
  })
  .strict()

const battleFieldTokenObject = z
  .object({
    unitId: str(),
    name: str(),
    classId: str(),
    team: TeamSchema,
    tile: str(),
    hp: hpObject,
    armor: int(),
    fallen: z.boolean(),
    captured: z.boolean(),
  })
  .strict()

const battleFieldObject = z.object({ grid: combatGridObject, tokens: z.array(battleFieldTokenObject) }).strict()

const battleReportObject = z
  .object({
    battleId: str(),
    tag: battleTagSchema,
    outcome: z.enum(['victory', 'defeat']),
    rounds: int(),
    field: battleFieldObject,
    enemiesDefeated: int(),
    goldEarned: int(),
    survivors: z.array(z.object({ unitId: str(), name: str(), hp: hpObject }).strict()),
    fallen: z.array(z.object({ unitId: str(), name: str(), classId: str() }).strict()),
    loot: z.array(z.object({ itemId: str(), rarity: RaritySchema, placed: z.boolean() }).strict()),
    prisoners: z.array(prisonerObject),
    consumedItems: z.array(str()),
  })
  .strict()

const bagEntryObject = z.object({ itemId: str(), x: int(), y: int(), charges: int() }).strict()

const runStateObject = z
  .object({
    runId: str(),
    runSeed: int(),
    rng: rngStateObject,
    daysElapsed: int(),

    party: record(unitObject),
    partyOrder: z.array(str()),
    bag: z.array(bagEntryObject),
    gold: int(),
    mcName: str().nullable(),
    companyName: str().nullable(),
    prisoners: z.array(prisonerObject),
    deathLog: z.array(deathEntryObject),

    nodeId: str(),
    visitedNodes: markerRecord(),
    clearedEncounters: markerRecord(),
    oneShotsFired: markerRecord(),
    edgeTraversals: record(edgeTraversalObject),
    scoutedEdges: record(encounterRollObject.nullable()),
    spawnedNodes: markerRecord(),
    unlockedNodes: markerRecord(),
    clearedDungeons: markerRecord(),

    flags: record(flagEntryObject),
    questStates: record(questStateObject),

    pendingTravel: pendingTravelObject.nullable(),
    pendingDialogue: pendingDialogueObject.nullable(),
    pendingCheckEvent: pendingCheckEventObject.nullable(),
    pendingCombat: pendingCombatObject.nullable(),
    pendingNamePrompt: pendingNamePromptObject.nullable(),
    pendingFollowUps: z.array(pendingFollowUpSchema),
    pendingLoot: z.array(str()),
    activeDungeon: activeDungeonObject.nullable(),
    town: z.object({ townId: str() }).strict().nullable(),
    camp: z.object({ actionTaken: z.boolean() }).strict().nullable(),
    campAction: z.object({ nodeId: str(), day: int(), actions: int() }).strict().nullable(),
    lastBattle: battleReportObject.nullable(),

    stats: runStatsObject,
  })
  .strict()

// ───────────────────────────────────────────────────────────────────────────
// Save file
// ───────────────────────────────────────────────────────────────────────────

/** `{ saveVersion, contentVersion, meta, run, combat }` — no `screen`, no `ledger` (CONTRACT-CHANGES 0008). */
const saveFileObject = z
  .object({
    saveVersion: str(),
    contentVersion: str(),
    meta: metaStateObject,
    run: runStateObject.nullable(),
    combat: combatStateObject.nullable(),
  })
  .strict()

export function metaStateSchema(): z.ZodType<MetaState> {
  return metaStateObject
}

export function runStateSchema(): z.ZodType<RunState> {
  return runStateObject
}

export function combatStateSchema(): z.ZodType<CombatState> {
  return combatStateObject
}

export function saveFileSchema(): z.ZodType<SaveFile> {
  return saveFileObject
}

/** `['run', 'bag', 0, 'charges']` → `run.bag[0].charges`; `[]` → `''`. Shared by `codec.ts` (issues) and `replay.ts` (diffs). */
export function formatPath(path: readonly (string | number)[]): string {
  let out = ''
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`
    else out += out === '' ? seg : `.${seg}`
  }
  return out
}

// ───────────────────────────────────────────────────────────────────────────
// Type-level drift guards: the INFERRED mirror output must be mutually assignable with the domain type. Readonly
// modifiers are stripped on both sides (zod infers mutable arrays/records; the domain types are readonly) so the
// comparison is on shape alone. A field added to `types.ts` but not here — or vice versa — fails `tsc`.
// ───────────────────────────────────────────────────────────────────────────

type DeepMutable<T> = T extends object ? { -readonly [K in keyof T]: DeepMutable<T[K]> } : T
type MutuallyAssignable<A, B> = [DeepMutable<A>] extends [DeepMutable<B>] ? ([DeepMutable<B>] extends [DeepMutable<A>] ? true : false) : false
type Assert<T extends true> = T

/** The inferred output of each mirror (what `parseSave` actually hands back). */
export type MetaStateMirror = z.output<typeof metaStateObject>
export type RunStateMirror = z.output<typeof runStateObject>
export type CombatStateMirror = z.output<typeof combatStateObject>
export type SaveFileMirror = z.output<typeof saveFileObject>

export type MetaMirrorCheck = Assert<MutuallyAssignable<MetaStateMirror, MetaState>>
export type RunMirrorCheck = Assert<MutuallyAssignable<RunStateMirror, RunState>>
export type CombatMirrorCheck = Assert<MutuallyAssignable<CombatStateMirror, CombatState>>
export type SaveFileMirrorCheck = Assert<MutuallyAssignable<SaveFileMirror, SaveFile>>
