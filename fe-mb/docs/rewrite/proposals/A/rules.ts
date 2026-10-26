/**
 * PROPOSAL A — `src/engine/rules.ts`
 *
 * Every number the brief fixes, in ONE object, plus the four owner knobs
 * from DECISIONS.md (flip = one line). Engine code reads `rules.*`; nothing
 * else in `src/engine` may carry a literal balance number (a grep-lint in
 * `npm run verify` enforces it: `/\b(0\.[0-9]+|[2-9][0-9]*)\b/` outside this
 * file must be annotated `// rule:` or live in a test).
 *
 * The reducer receives `env.rules` (default `rules`) so tests can flip knobs
 * without module mocking.
 *
 * Presentation timings (HOP_DELAY_MS 700, typewriter 36 cps, banner 1.3 s)
 * are NOT here — they live in `src/ui/timings.ts`; the engine never sees
 * a millisecond (brief §2.1).
 *
 * Intended location: `game/src/engine/rules.ts`.
 */

import type { Rarity, RegionTier, StatusExpiry, StatusId } from './types'

// ── Owner knobs (DECISIONS.md "[ASK]") ──────────────────────────────────

export type ArmorCapKnob = 'halfMaxHp' | 'none' | 'resetOnOwnerTurn'
export type TerrainKnob = 'off' | 'on'
export type EnemyActionBudgetKnob = 1 | 'ap'

export interface Knobs {
  readonly armorCap: ArmorCapKnob
  readonly mcDeathIsDefeat: boolean
  readonly terrain: TerrainKnob
  readonly enemyActionBudget: EnemyActionBudgetKnob
}

// ── Typed shape of the constants object ─────────────────────────────────

export type RarityWeights = Readonly<Record<Rarity, number>>

export interface LootRow {
  readonly chance: number
  readonly weights: RarityWeights
}

export interface StatusRule {
  readonly stackable: boolean
  /** Merge rule for non-stackable: max(stacks); stackable: sum. Duration = max. */
  readonly tick: 'poisonPiercing' | 'burnMagicSplit' | null
  readonly expiresAt: StatusExpiry
  /** Empower is consumed by the next Damage card; the status also expires per `expiresAt`. */
  readonly consumedOnUse: boolean
}

export interface Rules {
  readonly knobs: Knobs
  readonly combat: {
    readonly apPerTurn: number
    readonly handSize: number
    readonly grid: { readonly width: number; readonly height: number }
    readonly tutorialGrid: { readonly width: number; readonly height: number }
    /** Party spawn slots in order (max 6). */
    readonly partySlots: readonly (readonly [number, number])[]
    readonly partyCap: number
    /** Turn-1 engagement: min over enemies of manhattan(enemy, nearest party) ≤ mov + maxRange. */
    readonly spawnEngagement: 'oneMovePlusAttack'
    /** Enemy melee spawn columns on the 14-wide board (bandits col 8-9 vs party col 0-2). */
    readonly enemySpawnColumns: readonly [number, number]
    /** Sim guard: a round-cap hit fails loudly with a state dump (§7.2). */
    readonly roundCap: number
    /** DR = floor(DEF/2) (physical) or floor(RES/2) (magic); min damage 0. */
    readonly drDivisor: number
    /** Magic split: floor(amount/2) to armor, ceil(amount/2) pierces. */
    readonly magicArmorShare: 'floorHalf'
    readonly tieBreak: 'spdDesc,partyFirst,idAsc'
    readonly aiLowHpFraction: number
    readonly aiDefaultPreferredRange: { readonly archer: readonly [number, number]; readonly healer: readonly [number, number] }
    readonly statuses: Readonly<Record<StatusId, StatusRule>>
    readonly capture: {
      readonly apCost: number
      readonly hpWeight: number
      readonly adjacencyWeight: number
      readonly bountyHunterBonus: number
      /** UX-only filter: the button lists targets below this HP fraction. */
      readonly uiHpGate: number
    }
    readonly riposte: 'stacksDirectToHp,adjacentPhysicalOnly'
    readonly cover: {
      readonly passiveId: 'genatsvale'
      readonly perProtecteePerProtectorTurn: 1
      readonly appliesTo: 'unitTargetedDamageBeforeDr'
    }
  }
  readonly gear: {
    /** Card counts a gear item must carry (content lint). */
    readonly cardsPerOneHanded: readonly [number, number]
    readonly cardsPerTwoHanded: number
    readonly cardsPerQuiver: 0
    readonly deckSizeRange: readonly [number, number]
    readonly quiver: {
      readonly poison: { readonly value: number; readonly turns: number }
      readonly slow: { readonly value: number; readonly turns: number }
      readonly thunder: { readonly bonus: number; readonly armorPiercing: true }
      readonly explosive: { readonly splash: number; readonly damageType: 'physical' }
    }
  }
  readonly bag: { readonly width: number; readonly height: number }
  readonly economy: {
    readonly startGold: number
    readonly startKit: readonly { readonly itemId: string; readonly count: number }[]
    /** Character ids seeded into the party by `seedNewRun`. Their gear comes
     *  from `characters.json#startingGear` (one value per item — not repeated here). */
    readonly startParty: readonly string[]
    readonly rationCharges: number
    readonly sellRatio: number
    readonly priceBands: Readonly<Record<Rarity, readonly [number, number] | null>>
    readonly consumables: {
      readonly healingPotion: { readonly id: 'healing_potion'; readonly heal: number; readonly buy: number; readonly sell: number; readonly apCost: number }
      readonly powerElixir: { readonly id: 'power_elixir'; readonly ap: number; readonly buy: number; readonly sell: number; readonly apCost: number }
      readonly foodRations: { readonly id: 'food_rations'; readonly buy: number; readonly sell: number; readonly charges: number }
    }
    readonly killGold: { readonly base: number; readonly perLevel: number }
    readonly bountyTiers: readonly { readonly maxLevel: number; readonly gold: number }[]
    readonly prisonerCap: number | null
    readonly innHealCostPerUnitDefault: number
    readonly shopRarityByRegionTier: Readonly<Record<RegionTier, readonly Rarity[]>>
    readonly shopNeverSells: readonly Rarity[]
    readonly shopRotatingSlots: readonly [number, number]
  }
  readonly travel: {
    readonly foodPerHop: number
    readonly daysPerHop: number
    readonly starvationDamage: number
    readonly defaultRollChance: number
    readonly cooldownDays: number
    readonly cooldownFloor: number
    readonly noRollInto: readonly ('town' | 'dungeon' | 'boss')[]
    readonly regionKnobs: Readonly<Record<RegionTier, { readonly encounterChancePerHop: number; readonly supplyDrainPerHop: number }>>
    /** Area tier by BFS distance from the start hub (authored `node.tier` overrides). */
    readonly tierByDistance: readonly { readonly maxHops: number; readonly tier: RegionTier }[]
    readonly bossNodeMinHops: number
    readonly dragThresholdPx: number
  }
  readonly camp: {
    readonly restHealFraction: number
    readonly restFoodCost: number
    readonly scoutFoodCost: number
    readonly scoutDepth: number
  }
  readonly dungeon: {
    readonly rows: number
    readonly cols: number
    readonly paths: number
    readonly weights: Readonly<Record<'combat' | 'event' | 'treasure' | 'rest' | 'elite', number>>
    readonly forcedFirstRow: 'combat'
    readonly forcedLastRow: 'rest'
    readonly noSpecialBeforeRow: number
    readonly restHealFraction: number
    readonly restFoodCost: 0
    readonly treasureGold: number
    readonly eventGoldFallback: number
    readonly eventGoldMax: number
  }
  readonly difficulty: {
    readonly levelBand: Readonly<Record<RegionTier, readonly [number, number]>>
    readonly bossLevel: number
    readonly enemyScaling: { readonly hpPerLevel: number; readonly strDefEvery: number; readonly sklSpdResEvery: number }
    readonly partyScaling: { readonly statPerLevel: number; readonly hpPerLevel: number }
  }
  readonly loot: {
    readonly excludeOwned: true
    readonly regionFilter: 'currentOrNone'
    readonly fallDown: true
    readonly handSlotOnly: true
    readonly rows: {
      readonly tutorial: LootRow
      readonly travel: Readonly<Record<RegionTier, LootRow>>
      readonly dungeonCombat: 'travelRowOfDungeonTier'
      readonly dungeonElite: LootRow
      readonly dungeonTreasure: LootRow
      readonly dungeonBoss: Readonly<Record<RegionTier, LootRow>>
      readonly finalBoss: LootRow
    }
  }
  readonly quests: {
    readonly maxSettlePasses: number
    readonly completeSentinel: '__complete__'
    readonly recruitFlagScope: 'permanent'
  }
  readonly checks: {
    readonly thresholdGuidance: readonly [number, number]
    readonly statCheckRequiresLiving: true
  }
  readonly save: {
    readonly version: string
    readonly runKey: string
    readonly metaKey: string
    readonly maxBytes: number
  }
  readonly balance: {
    readonly startersVsStubWin: readonly [number, number]
    readonly bossWithEpicWin: readonly [number, number]
    readonly stalemates: 0
    readonly turns: readonly [number, number]
    readonly simSeeds: number
  }
  readonly tutorial: {
    readonly mcPosition: readonly [number, number]
    readonly bandit: { readonly id: 'tutorial_bandit'; readonly classId: 'bandit'; readonly hp: number; readonly str: number; readonly spd: number; readonly position: readonly [number, number] }
  }
}

const W = (c: number, u: number, r: number, e: number, l: number): RarityWeights =>
  ({ common: c, uncommon: u, rare: r, epic: e, legendary: l })

export const rules: Rules = {
  knobs: {
    armorCap: 'halfMaxHp',
    mcDeathIsDefeat: true,
    terrain: 'off',
    enemyActionBudget: 1,
  },

  combat: {
    apPerTurn: 3,
    handSize: 5,
    grid: { width: 14, height: 10 },
    tutorialGrid: { width: 5, height: 5 },
    partySlots: [[2, 4], [2, 5], [1, 4], [1, 5], [0, 4], [0, 5]],
    partyCap: 6,
    spawnEngagement: 'oneMovePlusAttack',
    enemySpawnColumns: [8, 9],
    roundCap: 60,
    drDivisor: 2,
    magicArmorShare: 'floorHalf',
    tieBreak: 'spdDesc,partyFirst,idAsc',
    aiLowHpFraction: 0.4,
    aiDefaultPreferredRange: { archer: [2, 3], healer: [1, 2] },
    statuses: {
      poison:     { stackable: false, tick: 'poisonPiercing', expiresAt: 'ownerTurnEnd',   consumedOnUse: false },
      burn:       { stackable: true,  tick: 'burnMagicSplit', expiresAt: 'ownerTurnEnd',   consumedOnUse: false },
      slow:       { stackable: false, tick: null,             expiresAt: 'ownerTurnEnd',   consumedOnUse: false },
      immobilize: { stackable: false, tick: null,             expiresAt: 'ownerTurnEnd',   consumedOnUse: false },
      taunt:      { stackable: false, tick: null,             expiresAt: 'ownerTurnStart', consumedOnUse: false },
      riposte:    { stackable: false, tick: null,             expiresAt: 'ownerTurnStart', consumedOnUse: false },
      empower:    { stackable: false, tick: null,             expiresAt: 'ownerTurnStart', consumedOnUse: true },
    },
    capture: {
      apCost: 2,
      hpWeight: 0.6,
      adjacencyWeight: 0.25,
      bountyHunterBonus: 0.15,
      uiHpGate: 0.5,
    },
    riposte: 'stacksDirectToHp,adjacentPhysicalOnly',
    cover: {
      passiveId: 'genatsvale',
      perProtecteePerProtectorTurn: 1,
      appliesTo: 'unitTargetedDamageBeforeDr',
    },
  },

  gear: {
    cardsPerOneHanded: [3, 4],
    cardsPerTwoHanded: 6,
    cardsPerQuiver: 0,
    deckSizeRange: [10, 14],
    quiver: {
      poison: { value: 2, turns: 2 },
      slow: { value: 2, turns: 1 },
      thunder: { bonus: 3, armorPiercing: true },
      explosive: { splash: 3, damageType: 'physical' },
    },
  },

  bag: { width: 8, height: 4 },

  economy: {
    startGold: 80,
    startKit: [
      { itemId: 'food_rations', count: 2 },
      { itemId: 'healing_potion', count: 1 },
    ],
    startParty: ['mc', 'oak', 'lilina'], // Lord Iron Sword / Knight Iron Lance + Iron Buckler / Mage Fire Tome live on the CharacterDefs
    rationCharges: 3,
    sellRatio: 0.5,
    priceBands: {
      common: [50, 120],
      uncommon: [120, 250],
      rare: [300, 500],
      epic: null,      // sell-only 300-500 (never bought)
      legendary: null, // sell-only 500-800 (never bought)
    },
    consumables: {
      healingPotion: { id: 'healing_potion', heal: 10, buy: 30, sell: 15, apCost: 1 },
      powerElixir: { id: 'power_elixir', ap: 3, buy: 80, sell: 40, apCost: 1 },
      foodRations: { id: 'food_rations', buy: 50, sell: 25, charges: 3 },
    },
    killGold: { base: 10, perLevel: 5 },
    bountyTiers: [
      { maxLevel: 2, gold: 20 },
      { maxLevel: 4, gold: 40 },
      { maxLevel: Number.POSITIVE_INFINITY, gold: 60 },
    ],
    prisonerCap: null, // brief §2.6 recommends 4 ("the wagon holds four") if friction is wanted
    innHealCostPerUnitDefault: 8,
    shopRarityByRegionTier: {
      1: ['common', 'uncommon'],
      2: ['uncommon', 'rare'],
      3: ['uncommon', 'rare'],
    },
    shopNeverSells: ['epic', 'legendary'],
    shopRotatingSlots: [1, 2],
  },

  travel: {
    foodPerHop: 1,
    daysPerHop: 1,
    starvationDamage: 3,
    defaultRollChance: 0.3,
    cooldownDays: 3,
    cooldownFloor: 0.25,
    noRollInto: ['town', 'dungeon', 'boss'],
    regionKnobs: {
      // DECISIONS: 1 food per hop everywhere; the brief's 1/1/2 drain is the data alternative.
      1: { encounterChancePerHop: 0.25, supplyDrainPerHop: 1 },
      2: { encounterChancePerHop: 0.40, supplyDrainPerHop: 1 },
      3: { encounterChancePerHop: 0.55, supplyDrainPerHop: 1 },
    },
    tierByDistance: [
      { maxHops: 2, tier: 1 },
      { maxHops: 5, tier: 2 },
      { maxHops: Number.POSITIVE_INFINITY, tier: 3 },
    ],
    bossNodeMinHops: 7,
    dragThresholdPx: 8,
  },

  camp: {
    restHealFraction: 0.2,
    restFoodCost: 1,
    scoutFoodCost: 1,
    scoutDepth: 3,
  },

  dungeon: {
    rows: 6,
    cols: 4,
    paths: 4,
    weights: { combat: 45, event: 20, treasure: 15, rest: 5, elite: 5 }, // no Shop room (DECISIONS)
    forcedFirstRow: 'combat',
    forcedLastRow: 'rest',
    noSpecialBeforeRow: 2, // no elite/rest in rows 0-1
    restHealFraction: 0.3,
    restFoodCost: 0,
    treasureGold: 50,
    eventGoldFallback: 30,
    eventGoldMax: 60,
  },

  difficulty: {
    levelBand: { 1: [1, 2], 2: [3, 4], 3: [5, 6] },
    bossLevel: 7,
    enemyScaling: { hpPerLevel: 2, strDefEvery: 2, sklSpdResEvery: 3 },
    partyScaling: { statPerLevel: 1, hpPerLevel: 3 },
  },

  loot: {
    excludeOwned: true,
    regionFilter: 'currentOrNone',
    fallDown: true,
    handSlotOnly: true,
    rows: {
      tutorial: { chance: 0, weights: W(0, 0, 0, 0, 0) },
      travel: {
        1: { chance: 0.4, weights: W(80, 20, 0, 0, 0) },
        2: { chance: 0.4, weights: W(50, 40, 10, 0, 0) },
        3: { chance: 0.4, weights: W(0, 40, 60, 0, 0) },
      },
      dungeonCombat: 'travelRowOfDungeonTier', // chance 0.5 — see run/loot.ts#lootRowFor
      dungeonElite: { chance: 1, weights: W(0, 0, 75, 25, 0) },
      dungeonTreasure: { chance: 1, weights: W(0, 0, 70, 30, 0) },
      dungeonBoss: {
        1: { chance: 1, weights: W(0, 0, 0, 100, 0) },
        2: { chance: 1, weights: W(0, 0, 0, 75, 25) },
        3: { chance: 1, weights: W(0, 0, 0, 50, 50) },
      },
      finalBoss: { chance: 1, weights: W(0, 0, 0, 0, 100) },
    },
  },

  quests: {
    maxSettlePasses: 8,
    completeSentinel: '__complete__',
    recruitFlagScope: 'permanent',
  },

  checks: {
    thresholdGuidance: [6, 9],
    statCheckRequiresLiving: true,
  },

  save: {
    version: '1.0.0-rewrite',
    runKey: 'embermarch:run',
    metaKey: 'embermarch:meta',
    maxBytes: 50 * 1024,
  },

  balance: {
    startersVsStubWin: [0.55, 0.75],
    bossWithEpicWin: [0.40, 0.60],
    stalemates: 0,
    turns: [4, 10],
    simSeeds: 20,
  },

  tutorial: {
    mcPosition: [0, 2],
    bandit: { id: 'tutorial_bandit', classId: 'bandit', hp: 10, str: 2, spd: 1, position: [4, 2] },
  },
}

/** Dungeon combat rooms roll at this chance on the travel row of the dungeon's tier. */
export const DUNGEON_COMBAT_LOOT_CHANCE = 0.5

/** RNG label formats (brief §2.14). Pass/day salts make re-crossings distinct. */
export const rngLabels = {
  hop: (sheet: string, from: string, to: string, pass: number): string => `hop:${sheet}:${from}->${to}#${pass}`,
  encounter: (sheet: string, from: string, to: string, pass: number): string => `encounter:${sheet}:${from}->${to}#${pass}`,
  battleTravel: (group: string, node: string, day: number): string => `battle:${group}:${node}:d${day}`,
  battleQuest: (group: string, node: string, day: number): string => `battle:quest:${group}:${node}:d${day}`,
  battleDungeon: (dungeon: string, room: string): string => `battle:${dungeon}:${room}`,
  battleTutorial: 'battle:tutorial',
  battleFinalBoss: 'battle:finalBoss',
  loot: (battleId: string): string => `loot:${battleId}`,
  dungeon: (id: string): string => `dungeon:${id}`,
  floor: (battleId: string): string => `floor:${battleId}`,
  shop: (town: string, day: number): string => `shop:${town}:d${day}`,
  scout: (node: string, day: number): string => `scout:${node}:d${day}`,
} as const
