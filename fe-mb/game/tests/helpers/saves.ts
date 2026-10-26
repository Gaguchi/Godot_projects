/**
 * tests/helpers/saves.ts — hand-built, fully populated states for the save package (CONTRACT §7 "each package
 * writes the helper it needs first"; brief §7.9 "ONE round-trip test over the REAL load path with every run field
 * populated").
 *
 * `populatedRun()` fills EVERY run field non-trivially where the slots allow it, and `populatedVariants()` adds
 * one fixture per slot combination that cannot coexist with the base (checkEvent vs dialogue, town vs camp vs
 * dungeon, a Field Report, a pending battle, a mid-selection battle, an enemy turn, a finished run). Every fixture
 * is meant to satisfy `flow/invariants.ts` as documented in its header, so the same set can go through the real
 * `parseSave` once WP-FLOW lands. Content ids are real (`pine_crossing`, `darens_gang`, `iron_sword`, …) so the
 * fixtures stay plausible under a cross-reference invariant, but the codec never resolves them.
 */
import { createEnv } from '../../src/engine/content'
import { fromSaveFile, parseSave, parseSaveWith, serialize, toSaveFile, DEFAULT_UI } from '../../src/engine/save/codec'
import type {
  ActiveDungeon,
  BattleReport,
  CaptureTarget,
  CombatGrid,
  CombatState,
  CombatUnit,
  DeckState,
  EngineEnv,
  GameState,
  MetaState,
  RunLedger,
  RunState,
  Unit,
  UnitStats,
} from '../../src/engine/types'

// ───────────────────────────────────────────────────────────────────────────
// Env + landing probe
// ───────────────────────────────────────────────────────────────────────────

let cachedEnv: EngineEnv | null = null
/** The shipped content + rules (one per test process). */
export function testEnv(): EngineEnv {
  if (cachedEnv === null) cachedEnv = createEnv()
  return cachedEnv
}

/** `false` only when `probe` throws the contract stub's `TODO(<module>)` — any other error is a real failure and propagates.
 *  Used by tests that must call through another package (WP-FLOW, WP-COMBAT) only once it has landed. */
export function landed(probe: () => unknown): boolean {
  try {
    probe()
    return true
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('TODO(')) return false
    throw error
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Building blocks
// ───────────────────────────────────────────────────────────────────────────

export const META: MetaState = { gameStarted: true, totalRuns: 3, runsWon: 1, runsLost: 1, tutorialSeen: true, audioMuted: true }

const STATS = {
  lord: { str: 6, mag: 0, skl: 5, spd: 6, def: 4, res: 2, lck: 5 },
  shieldKnight: { str: 6, mag: 0, skl: 3, spd: 2, def: 9, res: 2, lck: 1 },
  archer: { str: 5, mag: 0, skl: 8, spd: 7, def: 4, res: 3, lck: 5 },
  bandit: { str: 5, mag: 0, skl: 3, spd: 4, def: 2, res: 1, lck: 2 },
  banditArcher: { str: 3, mag: 0, skl: 6, spd: 5, def: 2, res: 1, lck: 3 },
} as const satisfies Record<string, UnitStats>

export const MC: Unit = {
  id: 'mc', name: 'the foundling', classId: 'lord', team: 'party', level: 2, hp: { current: 20, max: 29 },
  stats: STATS.lord, mov: 5, handLeft: 'iron_sword', handRight: null, passives: [], signatureCardIds: [],
}
export const OAK: Unit = {
  id: 'oak', name: 'Bagrat "Oak"', classId: 'shield_knight', team: 'party', level: 1, hp: { current: 24, max: 30 },
  stats: STATS.shieldKnight, mov: 3, handLeft: 'iron_lance', handRight: 'iron_buckler', passives: ['genatsvale'], signatureCardIds: [],
}
export const KAEL: Unit = {
  id: 'kael', name: 'Kael', classId: 'bandit_archer', team: 'party', level: 3, hp: { current: 22, max: 22 },
  stats: STATS.archer, mov: 4, handLeft: 'iron_bow', handRight: 'poison_quiver', passives: [], signatureCardIds: [],
}

export const DAREN_TARGET: CaptureTarget = {
  unitId: 'daren',
  capturedDialogueId: 'sq_blood_ties_daren_captured',
  killedDialogueId: 'sq_blood_ties_daren_killed',
  capturedFlag: 'daren_captured',
  killedFlag: 'daren_killed',
}

/** Sorted (default string order — `combat/grid.ts#isObstacle` binary-searches it) and never a Set (§7.9). */
export const GRID: CombatGrid = {
  width: 14,
  height: 10,
  obstacles: ['11,2', '3,4', '5,2', '7,7'],
  floor: ['0,0', '0,1', '1,0', '1,1', '2,1'],
  terrain: null,
}

function combatUnit(base: Unit, extra: Partial<CombatUnit> & Pick<CombatUnit, 'position' | 'lastTile'>): CombatUnit {
  return {
    ...base,
    ap: 3,
    armor: 0,
    statuses: [],
    hasMovedThisTurn: false,
    actionsTaken: 0,
    coverUsed: [],
    captured: false,
    bountyValue: null,
    ...extra,
  }
}

function enemy(id: string, name: string, classId: string, stats: UnitStats, hp: number, maxHp: number, position: string | null, lastTile: string | null, extra: Partial<CombatUnit> = {}): CombatUnit {
  return combatUnit(
    { id, name, classId, team: 'enemy', level: 2, hp: { current: hp, max: maxHp }, stats, mov: 4, handLeft: null, handRight: null, passives: [], signatureCardIds: [] },
    { position, lastTile, ...extra },
  )
}

function deck(ids: readonly [string, 'innate' | 'hand_left' | 'hand_right' | 'signature'][], hand: readonly string[], discard: readonly string[], mods: Readonly<Record<string, DeckState['cards'][string]['mod']>> = {}): DeckState {
  const cards: Record<string, DeckState['cards'][string]> = {}
  const uids: string[] = []
  for (const [cardId, source] of ids) {
    let n = 1
    while (`${cardId}#${n}` in cards) n++
    const uid = `${cardId}#${n}`
    cards[uid] = { uid, cardId, source, mod: mods[cardId] ?? null }
    uids.push(uid)
  }
  const draw = uids.filter((u) => !hand.includes(u) && !discard.includes(u))
  return { cards, draw, hand, discard }
}

export const ACTIVE_CARD_UID = 'iron_sword_slash#1'

function decks(): Readonly<Record<string, DeckState>> {
  return {
    mc: deck(
      [
        ['lord_rally', 'innate'], ['lord_inspiring_strike', 'innate'], ['lord_nobility', 'innate'], ['lord_command', 'innate'], ['lord_charge', 'innate'],
        ['iron_sword_slash', 'hand_left'], ['iron_sword_slash', 'hand_left'], ['iron_sword_thrust', 'hand_left'], ['iron_sword_guard_break', 'hand_left'], ['iron_sword_riposte', 'hand_left'],
      ],
      [ACTIVE_CARD_UID, 'lord_rally#1', 'iron_sword_thrust#1', 'lord_charge#1', 'iron_sword_riposte#1'],
      ['lord_command#1', 'iron_sword_slash#2'],
    ),
    oak: deck(
      [
        ['knight_hold_line', 'innate'], ['iron_tower_shield_fortress', 'innate'], ['iron_tower_shield_shield_wall', 'innate'], ['iron_tower_shield_cover', 'innate'],
        ['iron_lance_jab', 'hand_left'], ['iron_lance_impale', 'hand_left'], ['iron_lance_brace', 'hand_left'],
        ['iron_buckler_block', 'hand_right'], ['iron_buckler_parry', 'hand_right'], ['iron_buckler_deflect', 'hand_right'],
      ],
      ['knight_hold_line#1', 'iron_lance_jab#1', 'iron_buckler_block#1', 'iron_lance_brace#1', 'iron_buckler_parry#1'],
      [],
    ),
    kael: deck(
      [
        ['iron_bow_quick_shot', 'innate'], ['iron_bow_aimed_shot', 'innate'],
        ['iron_bow_quick_shot', 'hand_left'], ['iron_bow_aimed_shot', 'hand_left'], ['iron_bow_volley', 'hand_left'],
      ],
      ['iron_bow_quick_shot#1', 'iron_bow_aimed_shot#1', 'iron_bow_quick_shot#2'],
      ['iron_bow_volley#1'],
      { iron_bow_quick_shot: { kind: 'poison', value: 2, turns: 2 }, iron_bow_aimed_shot: { kind: 'poison', value: 2, turns: 2 } },
    ),
    daren: deck([['bandit_swing', 'innate'], ['bandit_charge', 'innate']], ['bandit_swing#1'], []),
    bandit_archer: deck([['iron_bow_quick_shot', 'innate'], ['iron_bow_aimed_shot', 'innate']], ['iron_bow_quick_shot#1', 'iron_bow_aimed_shot#1'], []),
    darens_gang_0: deck([['bandit_swing', 'innate'], ['bandit_charge', 'innate']], [], ['bandit_swing#1', 'bandit_charge#1']),
    darens_gang_1: deck([['bandit_swing', 'innate'], ['bandit_charge', 'innate']], ['bandit_charge#1'], ['bandit_swing#1']),
  }
}

/** A travel battle against Daren's gang, mid-selection on the MC's turn: one foe dead (lastTile kept), one captured,
 *  a poisoned survivor, Oak's cover ledger in use, a quiver-modified bow deck. Every CombatState field is non-trivial. */
export function populatedCombat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    battleId: 'battle:darens_gang:bandit_hideout:d9',
    tag: 'travel',
    origin: { kind: 'travel', from: 'riverside_market', to: 'bandit_hideout', encounterId: 'bandit_ambush' },
    regionTier: 1,
    enemyGroupId: 'darens_gang',
    phase: 'combat',
    grid: GRID,
    units: {
      mc: combatUnit(MC, {
        position: '2,4', lastTile: null, ap: 2, hasMovedThisTurn: true,
        statuses: [{ id: 'riposte', stacks: 2, turns: 1, expiresAt: 'ownerTurnStart', sourceId: 'mc' }],
      }),
      oak: combatUnit(OAK, { position: '2,5', lastTile: null, armor: 3, coverUsed: ['mc'] }),
      kael: combatUnit(KAEL, { position: '1,4', lastTile: null, ap: 0 }),
      daren: enemy('daren', 'Daren', 'bandit', STATS.bandit, 9, 22, '6,4', null, {
        ap: 3, actionsTaken: 1, armor: 1, bountyValue: 50,
        statuses: [{ id: 'poison', stacks: 2, turns: 2, expiresAt: 'ownerTurnEnd', sourceId: 'kael' }],
      }),
      bandit_archer: enemy('bandit_archer', 'Bandit Archer', 'bandit_archer', STATS.banditArcher, 16, 20, '9,3', null),
      darens_gang_0: enemy('darens_gang_0', 'Bandit Thug', 'bandit', STATS.bandit, 0, 22, null, '4,4'),
      darens_gang_1: enemy('darens_gang_1', 'Bandit Thug', 'bandit', STATS.bandit, 5, 22, null, '8,6', { captured: true }),
    },
    decks: decks(),
    turn: { round: 3, unitId: 'mc', acted: ['mc'] },
    selection: { kind: 'card', cardUid: ACTIVE_CARD_UID, pinnedTile: '6,4' },
    consumables: ['healing_potion'],
    consumedItems: ['power_elixir'],
    captureTargets: [DAREN_TARGET],
    rng: { seed: 2077, counter: 17 },
    ...overrides,
  }
}

export function populatedReport(): BattleReport {
  return {
    battleId: 'battle:bandits:pine_crossing:d8',
    tag: 'travel',
    outcome: 'victory',
    rounds: 4,
    field: {
      grid: GRID,
      tokens: [
        { unitId: 'mc', name: 'the foundling', classId: 'lord', team: 'party', tile: '4,4', hp: { current: 20, max: 29 }, armor: 0, fallen: false, captured: false },
        { unitId: 'oak', name: 'Bagrat "Oak"', classId: 'shield_knight', team: 'party', tile: '3,5', hp: { current: 24, max: 30 }, armor: 2, fallen: false, captured: false },
        { unitId: 'bandits_0', name: 'Bandit', classId: 'bandit', team: 'enemy', tile: '5,4', hp: { current: 0, max: 18 }, armor: 0, fallen: true, captured: false },
        { unitId: 'bandits_1', name: 'Bandit', classId: 'bandit', team: 'enemy', tile: '6,5', hp: { current: 4, max: 18 }, armor: 0, fallen: false, captured: true },
      ],
    },
    enemiesDefeated: 1,
    goldEarned: 20,
    survivors: [
      { unitId: 'mc', name: 'the foundling', hp: { current: 20, max: 29 } },
      { unitId: 'oak', name: 'Bagrat "Oak"', hp: { current: 24, max: 30 } },
    ],
    fallen: [{ unitId: 'lilina', name: 'Lilina', classId: 'mage' }],
    loot: [{ itemId: 'steel_sword', rarity: 'uncommon', placed: false }],
    prisoners: [{ unitId: 'bandits_1', name: 'Bandit', classId: 'bandit', level: 2, bountyValue: null, capturedAtBattleId: 'battle:bandits:pine_crossing:d8' }],
    consumedItems: ['healing_potion'],
  }
}

export function populatedDungeon(): ActiveDungeon {
  const room = (id: string, row: number, col: number, type: ActiveDungeon['graph']['rooms'][string]['type'], checkEventId: string | null = null) =>
    ({ id, row, col, type, checkEventId }) as const
  return {
    dungeonId: 'smugglers_cave',
    graph: {
      dungeonId: 'smugglers_cave',
      rooms: {
        r0c0: room('r0c0', 0, 0, 'combat'), r0c2: room('r0c2', 0, 2, 'combat'),
        r1c1: room('r1c1', 1, 1, 'event', 'blocked_passage'), r1c3: room('r1c3', 1, 3, 'treasure'),
        r2c0: room('r2c0', 2, 0, 'elite'), r2c1: room('r2c1', 2, 1, 'combat'),
        r3c2: room('r3c2', 3, 2, 'combat'), r3c3: room('r3c3', 3, 3, 'event', 'smuggler_cache'),
        r4c1: room('r4c1', 4, 1, 'rest'), r4c3: room('r4c3', 4, 3, 'rest'),
        r5c0: room('r5c0', 5, 0, 'boss'),
      },
      rows: [['r0c0', 'r0c2'], ['r1c1', 'r1c3'], ['r2c0', 'r2c1'], ['r3c2', 'r3c3'], ['r4c1', 'r4c3'], ['r5c0']],
      edges: {
        r0c0: ['r1c1'], r0c2: ['r1c1', 'r1c3'],
        r1c1: ['r2c0', 'r2c1'], r1c3: ['r2c1'],
        r2c0: ['r3c2'], r2c1: ['r3c2', 'r3c3'],
        r3c2: ['r4c1'], r3c3: ['r4c3'],
        r4c1: ['r5c0'], r4c3: ['r5c0'],
      },
      bossId: 'r5c0',
    },
    position: 'r2c1',
    cleared: { r0c0: true, r1c1: true, r2c1: true },
    bossCleared: false,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// The populated run and its slot variants
// ───────────────────────────────────────────────────────────────────────────

/**
 * Base: standing in Pine Crossing (town) mid-journey, a tavern dialogue open with a name prompt on top of it (the ONE
 * permitted overlay pair), two follow-ups queued, a captured Daren in the prisoner ledger, wounds carried, two
 * deaths logged, a quest complete and one mid-way, scouted roads (one quiet), every marker record non-empty.
 */
export function populatedRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    runId: 'run_7_3',
    runSeed: 7,
    rng: { seed: 7, counter: 42 },
    daysElapsed: 9,

    party: { mc: MC, oak: OAK, kael: KAEL },
    partyOrder: ['mc', 'oak', 'kael'],
    bag: [
      { itemId: 'food_rations', x: 0, y: 0, charges: 2 },
      { itemId: 'healing_potion', x: 1, y: 0, charges: 1 },
      { itemId: 'steel_sword', x: 2, y: 0, charges: 1 },
      { itemId: 'power_elixir', x: 3, y: 0, charges: 1 },
    ],
    gold: 137,
    mcName: 'Wren',
    companyName: 'The Ember Company',
    prisoners: [
      { unitId: 'daren', name: 'Daren', classId: 'bandit', level: 2, bountyValue: 50, capturedAtBattleId: 'battle:darens_gang:bandit_hideout:d6' },
      { unitId: 'wolves_1', name: 'Wolf', classId: 'wolf', level: 1, bountyValue: null, capturedAtBattleId: 'battle:wolves:old_mill_crossing:d3' },
    ],
    deathLog: [
      { unitId: 'lilina', name: 'Lilina', classId: 'mage', cause: 'battle', day: 6, battleId: 'battle:darens_gang:bandit_hideout:d6' },
      { unitId: 'garrik', name: 'Garrik', classId: 'knight', cause: 'starvation', day: 8, battleId: null },
    ],

    nodeId: 'pine_crossing',
    visitedNodes: {
      'overworld:world:frontier_camp': true,
      'overworld:world:riverside_market': true,
      'overworld:world:old_mill_crossing': true,
      'overworld:world:bandit_hideout': true,
      'overworld:world:pine_crossing': true,
      'dungeon:smugglers_cave:r0c0': true,
    },
    clearedEncounters: { bandit_ambush: true, wolf_pack: true },
    oneShotsFired: { injured_knight: true },
    edgeTraversals: {
      'frontier_camp|riverside_market': { count: 2, lastDay: 5 },
      'old_mill_crossing|riverside_market': { count: 1, lastDay: 3 },
      'bandit_hideout|pine_crossing': { count: 1, lastDay: 8 },
    },
    scoutedEdges: {
      'old_mill_crossing->pine_crossing#2': { entryId: 'wolf_pack', outcome: { kind: 'battle', enemyGroupId: 'wolves' }, oneShot: false },
      'border_fortress->pine_crossing#1': null,
      'pine_crossing->rodericks_camp#1': { entryId: 'injured_knight', outcome: { kind: 'checkEvent', checkEventId: 'injured_knight' }, oneShot: true },
    },
    spawnedNodes: { darens_camp: true },
    unlockedNodes: { smugglers_cave: true },
    clearedDungeons: { smugglers_cave: true },

    flags: {
      daren_captured: { value: true, scope: 'run' },
      recruited_kael: { value: true, scope: 'permanent' },
      toll_paid: { value: 30, scope: 'quest' },
      last_rumor: { value: 'wolves', scope: 'battle' },
    },
    questStates: {
      sq_blood_ties: { stage: 'daren_resolved', startedDay: 4 },
      sq_missing_caravan: { stage: '__complete__', startedDay: 2 },
    },

    pendingTravel: { path: ['old_mill_crossing'], hopsTotal: 3, status: 'atNode', hop: null },
    pendingDialogue: { dialogueId: 'sq_blood_ties_accept', nodeId: 'offer', source: 'tavern', busts: ['mc', 'kael'] },
    pendingCheckEvent: null,
    pendingCombat: null,
    pendingNamePrompt: { target: 'company' },
    pendingFollowUps: [
      { kind: 'dialogue', dialogueId: 'sq_blood_ties_daren_captured', source: 'captureTarget' },
      { kind: 'checkEvent', checkEventId: 'bandit_parley', source: 'victory' },
    ],
    pendingLoot: [],
    activeDungeon: null,
    town: { townId: 'pine_crossing' },
    camp: null,
    campAction: null,
    lastBattle: null,

    stats: { battlesWon: 4, enemiesDefeated: 11, enemiesCaptured: 2, unitsLost: 2, goldEarned: 260, gearFound: 3, hops: 8 },
    ...overrides,
  }
}

export function blankState(meta: MetaState = META): GameState {
  return { meta, run: null, combat: null, ledger: null, screen: { kind: 'title' }, ui: DEFAULT_UI }
}

/** `populatedRunState()` installed in a GameState (screen title, as a hydrated state is). */
export function populatedRun(overrides: Partial<RunState> = {}): GameState {
  return { ...blankState(), run: populatedRunState(overrides) }
}

/** The travel machine mid-hop: a suspended hop on the road out of Old Mill Crossing. */
function suspendedHop(to: string, encounter: NonNullable<NonNullable<RunState['pendingTravel']>['hop']>['encounter'], resolved = false): RunState['pendingTravel'] {
  return { path: [to, 'border_fortress'], hopsTotal: 4, status: 'suspended', hop: { from: 'old_mill_crossing', to, pass: 2, encounter, resolved } }
}

const ON_THE_ROAD: Partial<RunState> = {
  nodeId: 'old_mill_crossing',
  town: null,
  pendingDialogue: null,
  pendingNamePrompt: null,
  pendingFollowUps: [],
}

export const LEDGER: RunLedger = {
  outcome: 'lost',
  runId: 'run_7_3',
  runSeed: 7,
  mcName: 'Wren',
  companyName: 'The Ember Company',
  daysElapsed: 9,
  stats: { battlesWon: 4, enemiesDefeated: 11, enemiesCaptured: 2, unitsLost: 3, goldEarned: 260, gearFound: 3, hops: 8 },
  fallen: [{ unitId: 'mc', name: 'the foundling', classId: 'lord', cause: 'starvation', day: 9, battleId: null }],
  survivors: [],
  trophyItemId: null,
}

/** One fixture per slot combination the base cannot hold. Names double as test labels. */
export function populatedVariants(): readonly { readonly name: string; readonly state: GameState }[] {
  return [
    { name: 'town + tavern dialogue + name prompt (base)', state: populatedRun() },
    {
      name: 'suspended hop + check event with a result and deferred effects',
      state: populatedRun({
        ...ON_THE_ROAD,
        pendingTravel: suspendedHop('pine_crossing', { entryId: 'stuck_caravan', outcome: { kind: 'checkEvent', checkEventId: 'stuck_caravan' }, oneShot: false }),
        pendingCheckEvent: {
          checkEventId: 'stuck_caravan',
          source: 'travel',
          result: {
            choiceId: 'help_push',
            passed: true,
            attemptingUnitId: 'oak',
            narration: 'Oak puts a shoulder to the wheel and the caravan lurches free.',
            deferredEffects: [{ kind: 'startDialogue', dialogueId: 'wounded_traveler' }, { kind: 'addGold', amount: 15 }],
          },
        },
      }),
    },
    {
      name: 'suspended hop + travel dialogue that queued a group battle (pendingCombat)',
      state: populatedRun({
        ...ON_THE_ROAD,
        pendingTravel: suspendedHop('watchtower_ridge', { entryId: 'bandit_threat', outcome: { kind: 'dialogue', dialogueId: 'bandit_threat' }, oneShot: false }),
        pendingDialogue: { dialogueId: 'bandit_threat', nodeId: 'fight', source: 'travel', busts: [null, 'bandit'] },
        pendingCombat: {
          origin: { kind: 'travel', from: 'old_mill_crossing', to: 'watchtower_ridge', encounterId: 'bandit_threat' },
          enemies: { kind: 'group', enemyGroupId: 'bandits', level: 2 },
          captureTargets: [],
        },
      }),
    },
    {
      name: 'fresh run with the authored tutorial battle pending',
      state: populatedRun({
        ...ON_THE_ROAD,
        nodeId: 'frontier_camp',
        pendingTravel: null,
        pendingCombat: {
          origin: { kind: 'tutorial' },
          enemies: {
            kind: 'authored',
            units: [
              { id: 'tutorial_bandit', name: 'Bandit', classId: 'bandit', level: 1, position: '4,2', hp: 10, armor: null, stats: { str: 2, spd: 1 }, bountyValue: null },
              { id: 'tutorial_bandit_2', name: 'Bandit', classId: 'bandit', level: 1, position: '4,3', hp: null, armor: 2, stats: null, bountyValue: 15 },
            ],
          },
          captureTargets: [DAREN_TARGET],
        },
      }),
    },
    {
      name: 'Field Report up after a travel battle with loot overflow',
      state: populatedRun({
        ...ON_THE_ROAD,
        pendingTravel: suspendedHop('pine_crossing', { entryId: 'bandit_ambush', outcome: { kind: 'battle', enemyGroupId: 'bandits', captureTargets: [DAREN_TARGET] }, oneShot: false }, true),
        lastBattle: populatedReport(),
        pendingLoot: ['steel_sword'],
      }),
    },
    {
      name: 'inside a dungeon, three rooms cleared',
      state: populatedRun({ ...ON_THE_ROAD, nodeId: 'smugglers_cave', pendingTravel: null, activeDungeon: populatedDungeon(), clearedDungeons: {} }),
    },
    {
      name: 'camp with its one action spent',
      state: populatedRun({ ...ON_THE_ROAD, nodeId: 'watchtower_ridge', pendingTravel: { path: [], hopsTotal: 2, status: 'atNode', hop: null }, camp: { actionTaken: true }, campAction: { nodeId: 'watchtower_ridge', day: 9, actions: 1 } }),
    },
    { name: 'mid-selection battle on the party turn', state: populatedMidCombat() },
    {
      name: 'parked enemy turn',
      state: populatedMidCombat({ turn: { round: 3, unitId: 'daren', acted: ['mc', 'daren'] }, selection: { kind: 'idle' } }),
    },
    { name: 'finished run (ledger only — persists as run: null)', state: { ...blankState(), ledger: LEDGER, screen: { kind: 'gameOver' } } },
  ]
}

/** A travel battle in progress: the hop is suspended on the battle's encounter and `combat` is mid-selection. */
export function populatedMidCombat(combatOverrides: Partial<CombatState> = {}): GameState {
  const combat = populatedCombat(combatOverrides)
  return {
    ...blankState(),
    run: populatedRunState({
      ...ON_THE_ROAD,
      nodeId: 'riverside_market',
      pendingTravel: {
        path: ['bandit_hideout', 'pine_crossing'],
        hopsTotal: 2,
        status: 'suspended',
        hop: {
          from: 'riverside_market',
          to: 'bandit_hideout',
          pass: 1,
          encounter: { entryId: 'bandit_ambush', outcome: { kind: 'battle', enemyGroupId: 'darens_gang', captureTargets: [DAREN_TARGET] }, oneShot: false },
          resolved: false,
        },
      },
    }),
    combat,
    screen: { kind: 'combat' },
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Round trips
// ───────────────────────────────────────────────────────────────────────────

/** `serialize → parseSaveWith(no invariants) → fromSaveFile`: the real load path minus the WP-FLOW invariant gate. */
export function roundTrip(state: GameState, env: EngineEnv = testEnv()): GameState {
  const parsed = parseSaveWith(serialize(toSaveFile(state, env)), env, () => [])
  if (!parsed.ok) throw new Error(`roundTrip: ${parsed.reason}: ${parsed.detail}`)
  return fromSaveFile(parsed.value)
}

/** `serialize → parseSave → fromSaveFile`: the real load path including `flow/invariants.ts#checkInvariants`. */
export function roundTripStrict(state: GameState, env: EngineEnv = testEnv()): GameState {
  const parsed = parseSave(serialize(toSaveFile(state, env)), env)
  if (!parsed.ok) throw new Error(`roundTripStrict: ${parsed.reason}: ${parsed.detail}`)
  return fromSaveFile(parsed.value)
}

/** What a hydrated copy of `state` must deep-equal: the persisted slices, Title, no ledger, default ui. */
export function hydratedExpectation(state: GameState): GameState {
  return { meta: state.meta, run: state.run, combat: state.combat, ledger: null, screen: { kind: 'title' }, ui: DEFAULT_UI }
}

/** Parse the JSON, apply `mutate` to the plain object, re-serialize. */
export function tamper(json: string, mutate: (doc: Record<string, unknown>) => void): string {
  const doc = JSON.parse(json) as Record<string, unknown>
  mutate(doc)
  return JSON.stringify(doc)
}
