/**
 * PROPOSAL B — `game/src/engine/rules.ts`: every number the brief fixes, in one
 * frozen object, plus the four owner knobs from DECISIONS.md. Reducers receive
 * `Rules` through `EngineContext`; balance sims pass a patched copy. Nothing
 * here is a millisecond, a pixel or a colour — those live in `ui/`.
 *
 * Sources per group are cited inline as brief section numbers (§) or DECISIONS.
 */

import type { Rarity, RegionTier, StatusId, BattleTag, StatusExpiry, DungeonRoomType } from './types'

export const SAVE_VERSION = '0.1.0-b' as const

/** DECISIONS.md "[ASK]" knobs. Flip here, nowhere else. */
export const KNOBS = {
  /** Armor persists within a battle, capped at ⌊maxHp/2⌋. Alternatives: 'none' | 'resetOnOwnerTurn'. */
  armorCap: 'halfMaxHp' as 'halfMaxHp' | 'none' | 'resetOnOwnerTurn',
  /** The foundling carries the egg; the story ends with them. */
  mcDeathIsDefeat: true as boolean,
  /** Flat boards, cosmetic floor, authored obstacles allowed. 'on' = forest/fort DR + movement cost. */
  terrain: 'off' as 'off' | 'on',
  /** 1 action + free move per enemy turn. 'ap' = act while AP remains (each action 1 AP). */
  enemyActionBudget: 1 as 1 | 'ap',
} as const

type LootRow = Readonly<Record<Rarity, number>>
const row = (c: number, u: number, r: number, e: number, l: number): LootRow =>
  ({ common: c, uncommon: u, rare: r, epic: e, legendary: l })

export const RULES = {
  knobs: KNOBS,

  // ─────────────────────────────────────────────────────────────── §2.1 turns / AP
  combat: {
    apPerTurn: 3,
    handSize: 5,
    grid: { width: 14, height: 10 },
    tutorialGrid: { width: 5, height: 5 },
    /** Party deployment tiles in party order (max 6). §2.8 */
    partySlots: [[2, 4], [2, 5], [1, 4], [1, 5], [0, 4], [0, 5]] as ReadonlyArray<readonly [number, number]>,
    /** Enemies spawn so that on turn 1 at least one enemy can reach attack range of a party unit:
     *  front column = max party column + (enemy MOV + max action range), clamped to the grid; packs
     *  fill 2 columns × alternating rows from y=3. §2.5, §7.26 */
    enemySpawn: { columnsDeep: 2, firstRow: 3, rowStride: 2 },
    /** Free move: 4-directional BFS through unoccupied non-obstacle tiles up to class MOV. */
    moveDirections: 4,
    /** Card range = manhattan in [min,max] from the source tile, obstacle tiles excluded, no LOS. §2.3 */
    lineOfSight: false,
    itemUseAp: 1,                    // §2.3 consumables
    captureAp: 2,                    // DECISIONS: 2 AP
    /** When true, a party unit whose AP hits 0 with an empty hand ends its turn automatically (Godot 1780e56). Off: explicit End Turn. */
    autoEndTurnAtZeroAp: false,
    /** Round cap for headless sims ONLY; hitting it is an engine failure with a state dump, never a "stalemate" stat. §7.2 */
    simRoundCap: 60,
  },

  // ─────────────────────────────────────────────────────────────── §2.2 damage
  damage: {
    /** DMG = base + STAT + empower − floor(DEF|RES / drDivisor) − terrainDr, min 0. */
    drDivisor: 2,
    minimum: 0,
    /** Magic: floor(amount/2) → armor (leak to HP), ceil(amount/2) → HP. Physical: armor first, overflow to HP. */
    magicArmorShare: 0.5,
    /** Riposte: stacks dealt straight to HP (ignores armor) to an orthogonally adjacent physical attacker; not consumed per hit. */
    riposteIgnoresArmor: true,
    riposteRequiresAdjacent: true,
    /** Terrain (only when knobs.terrain === 'on'). */
    terrain: {
      plain: { defBonus: 0, resBonus: 0, moveCost: 1 },
      forest: { defBonus: 1, resBonus: 0, moveCost: 2 },
      fort: { defBonus: 2, resBonus: 2, moveCost: 1 },
    },
  },

  // ─────────────────────────────────────────────────────────────── §2.4 statuses (fixed numbers, explicit expiry)
  statuses: {
    poison:     { stackable: false, expiresAt: 'ownerTurnEnd' as StatusExpiry, tick: 'physicalPiercing' as const },
    burn:       { stackable: true,  expiresAt: 'ownerTurnEnd' as StatusExpiry, tick: 'magic' as const },
    slow:       { stackable: false, expiresAt: 'ownerTurnEnd' as StatusExpiry, tick: 'none' as const },
    immobilize: { stackable: false, expiresAt: 'ownerTurnEnd' as StatusExpiry, tick: 'none' as const },
    taunt:      { stackable: false, expiresAt: 'ownerTurnStart' as StatusExpiry, tick: 'none' as const },
    riposte:    { stackable: false, expiresAt: 'ownerTurnStart' as StatusExpiry, tick: 'none' as const },
    empower:    { stackable: false, expiresAt: 'ownerTurnStart' as StatusExpiry, tick: 'none' as const },
  } satisfies Record<StatusId, { stackable: boolean; expiresAt: StatusExpiry; tick: 'physicalPiercing' | 'magic' | 'none' }>,
  /** Cleanse (RemoveStatus kind 'debuff') strips exactly these. */
  harmfulStatuses: ['poison', 'burn', 'slow', 'immobilize'] as readonly StatusId[],
  /** AI `situation` thresholds. §2.5 */
  ai: { lowHpFraction: 0.4 },

  // ─────────────────────────────────────────────────────────────── §2.6 capture
  capture: {
    /** chance = clamp01((1 − hp/max) × hpWeight + adjacentWeight × adjacentAllies + bountyHunterBonus) */
    hpWeight: 0.6,
    adjacentWeight: 0.25,
    bountyHunterBonus: 0.15,
    range: 1,                        // orthogonal adjacency
    /** UX filter only: the button is shown for targets below this HP fraction. The formula has no gate. */
    uiHpGate: 0.5,
    /** Bounty when `bountyValue` is 0: by level. Godot game_manager.gd:555-563 verbatim. */
    bountyTiers: [{ maxLevel: 2, gold: 20 }, { maxLevel: 4, gold: 40 }, { maxLevel: Infinity, gold: 60 }] as ReadonlyArray<{ maxLevel: number; gold: number }>,
    /** null = no cap (brief: a cap of 4 is a recommendation, not a rule). */
    prisonerCap: null as number | null,
    killGoldOnCapture: 0,
  },

  // ─────────────────────────────────────────────────────────────── §2.7 gear / bag
  gear: {
    bag: { width: 8, height: 4 },    // 32 cells; item footprints from Item.gridSize; first-fit, no rotation
    /** Deck sizes the lint asserts: card-bearing 1H gear 3-4 cards, 2H 6, quiver 0. */
    cardsPerOneHand: { min: 3, max: 4 },
    cardsPerTwoHand: 6,
    /** Quiver modifiers apply to DAMAGE cards of a `weaponClass: 'bow'` in the other slot at deck-build time. */
    quiverPairsWith: 'bow' as const,
  },

  // ─────────────────────────────────────────────────────────────── §2.13 party & start kit
  party: {
    cap: 6,
    startSize: 3,
    /** Party `buildUnit(L)`: +1 on every positive stat per level above 1, hp += 3 per level. */
    levelLift: { statPerLevel: 1, hpPerLevel: 3 },
  },
  startKit: {
    gold: 80,
    /** 2 rations × 3 hop-charges = 6 hops; 1 Healing Potion (Vulnerary dropped). */
    bag: [
      { itemId: 'food_rations', charges: 3 },
      { itemId: 'food_rations', charges: 3 },
      { itemId: 'healing_potion', charges: 1 },
    ] as ReadonlyArray<{ itemId: string; charges: number }>,
    /** Starting company: character ids (content) with gear from `CharacterDef.startingGear`. DECISIONS cast. */
    characters: ['mc', 'oak', 'lilina'] as readonly string[],
    startNodeFromSheet: true,          // `sheet.startNodeId`
    startDay: 1,
  },

  // ─────────────────────────────────────────────────────────────── §2.3 / §2.13 consumables & prices
  consumables: {
    healing_potion: { effect: { kind: 'Heal', amount: 10 }, buy: 30, sell: 15 },
    power_elixir:   { effect: { kind: 'GainAp', amount: 3 }, buy: 80, sell: 40 },   // net +2 after the 1-AP use; tune to +3→+2 if burst kills show up
    food_rations:   { chargesPerItem: 3, buy: 50, sell: 25 },
  },
  prices: {
    /** Sanity bands the content lint enforces per rarity (buy where sold; E/L are sell-only). */
    bands: {
      common:    { buy: [50, 120], sell: null },
      uncommon:  { buy: [120, 250], sell: null },
      rare:      { buy: [300, 500], sell: null },
      epic:      { buy: null, sell: [300, 500] },
      legendary: { buy: null, sell: [500, 800] },
    } as Readonly<Record<Rarity, { buy: readonly [number, number] | null; sell: readonly [number, number] | null }>>,
    sellRatio: 0.5,
    /** Shops: rarities allowed by the town's region tier; epic/legendary never. §2.10 */
    shopRaritiesByTier: { 1: ['common', 'uncommon'], 2: ['uncommon', 'rare'], 3: ['uncommon', 'rare'] } as Readonly<Record<RegionTier, readonly Rarity[]>>,
    neverSold: ['epic', 'legendary'] as readonly Rarity[],
    rotatingStock: { min: 1, max: 2 },    // rolled from deriveRng(run.rng, 'shop:<town>:d<day>')
    innHealPerUnitDefault: 8,             // town data overrides
  },

  // ─────────────────────────────────────────────────────────────── §2.8 / §2.13 battle gold
  battleGold: { base: 10, perLevel: 5 },   // per DEAD non-captured enemy; XP = 0 everywhere

  // ─────────────────────────────────────────────────────────────── §2.13 loot by SOURCE
  loot: {
    /** chance and C/U/R/E/L weights by battleTag (+ regionTier for travel and dungeon combat). */
    table: {
      'tutorial':        { chance: 0, rows: null },
      'travel':          { chance: 0.40, rows: { 1: row(80, 20, 0, 0, 0), 2: row(50, 40, 10, 0, 0), 3: row(0, 40, 60, 0, 0) } },
      'dungeon:combat':  { chance: 0.50, rows: { 1: row(80, 20, 0, 0, 0), 2: row(50, 40, 10, 0, 0), 3: row(0, 40, 60, 0, 0) } },
      'dungeon:elite':   { chance: 1.00, rows: { 1: row(0, 0, 75, 25, 0), 2: row(0, 0, 75, 25, 0), 3: row(0, 0, 75, 25, 0) } },
      'dungeon:boss':    { chance: 1.00, rows: { 1: row(0, 0, 0, 100, 0), 2: row(0, 0, 0, 75, 25), 3: row(0, 0, 0, 50, 50) } },
      'finalBoss':       { chance: 1.00, rows: { 1: row(0, 0, 0, 0, 100), 2: row(0, 0, 0, 0, 100), 3: row(0, 0, 0, 0, 100) } },
      'sim':             { chance: 0, rows: null },
    } as Readonly<Record<BattleTag, { chance: number; rows: Readonly<Record<RegionTier, LootRow>> | null }>>,
    /** Treasure rooms: 1.0 gear + gold. */
    treasureRoom: { chance: 1.0, row: row(0, 0, 70, 30, 0), gold: 50 },
    /** Sources whose drop is guaranteed and therefore never discarded on bag-full. */
    guaranteedTags: ['dungeon:elite', 'dungeon:boss', 'finalBoss'] as readonly BattleTag[],
    /** Fall DOWN one tier when a pool is empty (after excluding owned ids). */
    fallDown: { legendary: 'epic', epic: 'rare', rare: 'uncommon', uncommon: 'common', common: null } as Readonly<Record<Rarity, Rarity | null>>,
    /** `item.region === current || 'none'` for these tags; dungeon elite/boss/finalBoss pull from all regions. */
    regionFilteredTags: ['travel', 'dungeon:combat'] as readonly BattleTag[],
    excludeOwned: true,               // bag + all hands, before rolling
    rngLabel: 'loot:<battleId>',
  },

  // ─────────────────────────────────────────────────────────────── §2.9 / DECISIONS overworld
  overworld: {
    foodPerHop: 1,
    daysPerHop: 1,
    starvationDamagePerHop: 3,        // every LIVING unit, at 0 food
    /** Area tier = BFS hop distance from the start hub (data may override per node). DECISIONS */
    tierByDistance: [{ maxDistance: 2, tier: 1 }, { maxDistance: 5, tier: 2 }, { maxDistance: Infinity, tier: 3 }] as ReadonlyArray<{ maxDistance: number; tier: RegionTier }>,
    bossNodeMinDistance: 7,
    encounterChancePerHop: { 1: 0.25, 2: 0.40, 3: 0.55 } as Readonly<Record<RegionTier, number>>,
    /** Edge `rollChance` overrides the region value; this is the last fallback. */
    defaultEdgeRollChance: 0.3,
    /** cooldown = 1 on first pass or ≥ cooldownDays since last crossing, else max(floor, daysSince/cooldownDays). */
    cooldownDays: 3,
    cooldownFloor: 0.25,
    /** Hops INTO these node types never roll. */
    noRollInto: ['town', 'dungeon', 'boss'] as readonly string[],
    /** Auto-walk pauses at these (unvisited or destination); trail nodes chain silently once cleared. */
    decisionNodeTypes: ['town', 'camp', 'dungeon', 'boss', 'discovery'] as readonly string[],
    rngLabels: {
      hop: 'hop:<sheet>:<from>-><to>#<pass>',
      encounter: 'encounter:<sheet>:<from>-><to>#<pass>',
      battle: 'battle:<group>:<node>#<pass>',
      battleTutorial: 'battle:tutorial',
      battleFinalBoss: 'battle:finalBoss',
      battleDungeon: 'battle:<dungeon>:<room>',
      dungeon: 'dungeon:<id>',
      dungeonEvent: 'dungeon:<id>:event:<room>',
      shop: 'shop:<town>:d<day>',
      floor: 'floor',
    },
  },

  // ─────────────────────────────────────────────────────────────── §2.13 difficulty by map position
  difficulty: {
    levelBandByTier: { 1: [1, 2], 2: [3, 4], 3: [5, 6] } as Readonly<Record<RegionTier, readonly [number, number]>>,
    bossLevel: 7,
    /** level = band[0] + (fnv1a(salt) % 2); salt = `<node>` for travel, `<dungeon>:<room>` for dungeons. */
    saltMod: 2,
    /** Enemy `scaleEnemyForLevel(L)`: hp += 2(L−1); str/def (+mag if > 0) += floor((L−1)/2); skl/spd/res += floor((L−1)/3); lck flat. */
    enemyScaling: { hpPerLevel: 2, strDefMagEvery: 2, sklSpdResEvery: 3 },
    /** Enemy level = max(authored member level, area level) for travel AND dungeon fights. */
    enemyLevelIsMax: true,
  },

  // ─────────────────────────────────────────────────────────────── §2.10 town & camp
  town: {
    innHealsToFull: true,
    tavernQuestBoardSource: 'tavernQuests' as const,
  },
  camp: {
    rest: { healFraction: 0.2, foodCost: 1 },     // floor(max × 0.2) to all living units
    scout: { foodCost: 1, depth: 3 },              // BFS edge depth from the current node; pre-rolled + stored
    actionsPerVisit: 1,
  },

  // ─────────────────────────────────────────────────────────────── §2.11 / DECISIONS dungeon
  dungeon: {
    rows: 6,
    cols: 4,
    paths: 4,
    firstTwoPathsDistinctStart: true,
    weights: { combat: 45, event: 20, treasure: 15, rest: 5, elite: 5 } as Readonly<Partial<Record<DungeonRoomType, number>>>,   // no shop room
    forced: { firstRow: 'combat' as DungeonRoomType, lastRow: 'rest' as DungeonRoomType },
    noEliteOrRestBeforeRow: 2,          // rows 0..1 never elite/rest
    bossRoomId: 'r6c0',
    restHealFraction: 0.3,              // free
    eventGold: { fallback: 30, max: 60 },
    /** Tuning alternative kept as data (research canonical): 7 wide × 15 rows, weights C60/E25/R10/El5, forced row1 combat / row9 treasure / row15 rest. */
    canonicalVariant: { rows: 15, cols: 7, paths: 6, weights: { combat: 60, event: 25, rest: 10, elite: 5 } },
    validators: ['uniqueRoomIds', 'noConsecutiveSpecials', 'forkDestinationsDistinct', 'singleBossReachableFromLastRow'] as readonly string[],
  },

  // ─────────────────────────────────────────────────────────────── §2.12 quests / dialogue / checks
  quests: {
    maxSettlePasses: 8,
    completeMarker: '__complete__',
    predicateKinds: 15,
  },
  checks: {
    /** stat: attempting LIVING unit's stat ≥ threshold; class: any living member; gold/food: party totals. Deterministic. */
    livingOnly: true,
    autoPickBestCandidate: true,
    thresholdBand: [6, 9] as readonly [number, number],   // authoring guidance the lint warns on
  },

  // ─────────────────────────────────────────────────────────────── §2.15 tutorial & boss
  tutorial: {
    grid: { width: 5, height: 5 },
    mcTile: [0, 2] as readonly [number, number],
    enemy: { id: 'tutorial_bandit', name: 'Bandit', classId: 'bandit', hp: 10, str: 2, spd: 1, tile: [4, 2] as readonly [number, number] },
    lootChance: 0,
  },
  finalBoss: {
    /** Content id the lint checks exists in enemyGroups (placeholder cast: Warlord L7 hp 55 armor 6 spd 3 + 2 Throne Guards L5). */
    enemyGroupId: 'final_boss',
    level: 7,
    trophy: true,                      // legendary named on the win screen
  },

  // ─────────────────────────────────────────────────────────────── §2.13 balance targets (CI asserts)
  balance: {
    startersVsStubWinRate: [0.55, 0.75] as readonly [number, number],
    bossWithEpicWinRate: [0.40, 0.60] as readonly [number, number],
    stalemateRate: 0,
    averageTurns: [4, 10] as readonly [number, number],
    seedsPerScenario: 20,
    requireFirstBloodByRound: 2,
  },

  // ─────────────────────────────────────────────────────────────── §2.14 save
  save: {
    version: SAVE_VERSION,
    keys: { run: 'embermarch:run', meta: 'embermarch:meta', log: 'embermarch:log' },
    /** Pre-alpha: a version mismatch nukes the save with a loud warning; no migrations. */
    nukeOnVersionMismatch: true,
    verifyReplayOnLoad: 'dev' as 'dev' | 'always' | 'never',
    maxSnapshotBytes: 50_000,
  },
} as const

export type RulesShape = typeof RULES
