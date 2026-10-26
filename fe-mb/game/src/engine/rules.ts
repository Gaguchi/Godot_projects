/**
 * ENGINE CONTRACT — every number the brief fixes, in ONE typed object, plus
 * the four owner knobs from DECISIONS.md (flip = one line). Engine code reads
 * `env.rules.*`; nothing else under `src/engine` may carry a literal balance
 * number (a grep-lint is part of the flow package's acceptance tests).
 *
 * Numbers that live in CONTENT are not repeated here (potion effects, prices,
 * ration charges, quiver modifiers, class stats, per-node areaTier, region
 * encounterChancePerHop) — one value per item (brief §8.13). Presentation
 * timings (HOP_DELAY_MS, typewriter cps, banner seconds) are NOT here either;
 * they live in `src/ui/timings.ts`. The engine never sees a millisecond.
 *
 * Sources per group are cited as brief section numbers (§) or DECISIONS.
 * Contract change rules: `docs/rewrite/CONTRACT.md` → CONTRACT-CHANGES.md.
 */

import type { BattleTag, Rarity, RegionTier, RoomType, StatusExpiry, StatusId, TerrainKind } from './types'

// ── Owner knobs (DECISIONS.md, answered 2026-09-05) ─────────────────────

export type ArmorCapKnob = 'none' | 'halfMaxHp' | 'resetOnOwnerTurn'
export type TerrainKnob = 'off' | 'on'
export type EnemyActionBudgetKnob = 1 | 'ap'

export interface Knobs {
  /** `none`: armor persists within a battle and stacks uncapped (owner: tank-stall is a legitimate build). */
  readonly armorCap: ArmorCapKnob
  /** `true`: the foundling carries the egg; the story ends with them. Read by `combat/turn.ts#checkEnd` AND by
   *  `flow/settle.ts` step 1b (defeat is terminal outside combat too: starvation / quest damage). */
  readonly mcDeathIsDefeat: boolean
  /** `off`: flat boards, authored obstacles, cosmetic floor. `on`: forest/fort DEF/RES bonuses from
   *  `CombatGrid.terrain` (authored on `BattleSpec.grid.terrain`; every shipped producer passes null, so `on`
   *  changes nothing until a spec carries terrain). Movement cost is NOT in the contract — turning it on later
   *  is a CONTRACT-CHANGES signature change to `reachable/findPath/distanceField`, not a knob flip. */
  readonly terrain: TerrainKnob
  /** `1`: one action + free move per enemy turn (`actionsTaken === 0`); threat is tuned UP via HP/pack/burst.
   *  `'ap'`: act while `ap ≥ combat.enemyActionApCost` (each `combat/enemyAct` deducts it). */
  readonly enemyActionBudget: EnemyActionBudgetKnob
}

// ── Typed shape of the constants object ─────────────────────────────────

export type RarityWeights = Readonly<Record<Rarity, number>>

export interface LootRow {
  /** Probability that the source drops anything at all. */
  readonly chance: number
  /** Relative weights per rarity; a 0 tier is never rolled. */
  readonly weights: RarityWeights
}

export interface StatusRule {
  /** Stackable: reapply SUMS stacks (burn). Otherwise reapply = max(stacks). Duration is always max(turns). */
  readonly stackable: boolean
  /** DOT at the owner's turn end: poison pierces armor; burn uses the magic split. */
  readonly tick: 'poisonPiercing' | 'burnMagicSplit' | null
  readonly expiresAt: StatusExpiry
  /** Cleanse (`RemoveStatus remove:'debuff'`) strips exactly the harmful ones. */
  readonly harmful: boolean
  /** Empower is consumed by the next Damage card in addition to expiring per `expiresAt`. */
  readonly consumedOnUse: boolean
}

/** DR bonuses only (`combat/damage.ts#damageReduction`). No move cost: the BFS signatures take no cost function. */
export interface TerrainRule {
  readonly defBonus: number
  readonly resBonus: number
}

export interface Rules {
  readonly knobs: Knobs

  /** §2.1 turns/AP, §2.2 damage, §2.5 AI thresholds, §2.6 capture, §2.16 cover. */
  readonly combat: {
    readonly apPerTurn: number
    readonly handSize: number
    readonly grid: { readonly width: number; readonly height: number }
    readonly tutorialGrid: { readonly width: number; readonly height: number }
    /** Party deployment tiles in party order (max 6). §2.8 */
    readonly partySlots: readonly (readonly [number, number])[]
    /** Enemies spawn so that on turn 1 at least one enemy can reach attack range of a party unit
     *  (seed asserts `min manhattan(enemy, party) ≤ enemy.mov + maxRange`); packs fill `columnsDeep`
     *  columns from the far side, rows from `firstRow` every `rowStride`. §2.5, §7.26 */
    readonly enemySpawn: { readonly columnsDeep: number; readonly firstRow: number; readonly rowStride: number }
    /** Round cap for headless sims ONLY; hitting it is an engine failure with a state dump, never a "stalemate" stat. §7.2 */
    readonly roundCap: number
    /** Potions: 1-AP self-drink. §2.3 */
    readonly itemUseAp: number
    /** AP an enemy action costs under `knobs.enemyActionBudget === 'ap'` (`combat/ai.ts` budget check, `combat/enemyAct`). Unused under `1`. */
    readonly enemyActionApCost: number
    /** Godot 1780e56 behaviour: end the turn automatically at 0 AP with an empty hand. Off = explicit End Turn. */
    readonly autoEndTurnAtZeroAp: boolean
    /** DMG = base + STAT + empower − floor(DEF|RES / drDivisor) − terrainDr, min `minDamage`. */
    readonly drDivisor: number
    readonly minDamage: number
    /** Only when `knobs.terrain === 'on'`. */
    readonly terrain: Readonly<Record<TerrainKind, TerrainRule>>
    /** AI `situation` thresholds: self/target HP fraction below this = "low". */
    readonly aiLowHpFraction: number
    readonly aiDefaultPreferredRange: { readonly archer: readonly [number, number]; readonly healer: readonly [number, number] }
    readonly statuses: Readonly<Record<StatusId, StatusRule>>
    readonly capture: {
      readonly apCost: number
      /** chance = clamp01((1 − hp/max) × hpWeight + adjacencyWeight × supportingAllies + bountyHunterBonus),
       *  `supportingAllies` = the captor's OTHER allies with hands on the target (`combat/capture.ts`). */
      readonly hpWeight: number
      readonly adjacencyWeight: number
      /** Added when `captureContext(...).bountyHunter` — which reads `Unit.passives ∋ 'bounty_hunter'`; no such passive
       *  exists today (PassiveIdSchema is `genatsvale` only), so it is always false until the class lands. */
      readonly bountyHunterBonus: number
      /** UX-only filter: the button lists targets below this HP fraction. The formula has no gate. */
      readonly uiHpGate: number
    }
    /** The passive that triggers `resolveCoverTarget`; one redirect per protectee per protector activation. */
    readonly coverPassive: 'genatsvale'
  }

  /** §2.7 gear-as-deck. */
  readonly gear: {
    /** Card counts a gear item must carry (content lint). */
    readonly cardsPerOneHanded: readonly [number, number]
    readonly cardsPerTwoHanded: number
    readonly cardsPerQuiver: number
    /** The band a PARTY unit's built deck (`class innates + signature cards + both hands' gear cards`) must sit in.
     *  Floor = the smallest shipped starting loadout, ceiling = the largest any legal pair of hands can build
     *  (5 innates + two 4-card one-handers). Read by `tests/unit/balance/gearDecks.test.ts` (0048); the shipped
     *  [10, 14] was authored against decks that never existed — every starting deck was 8-11 cards. */
    readonly deckSizeRange: readonly [number, number]
    /** Quiver modifiers apply to DAMAGE cards of gear with this weaponClass in the other hand, at deck-build time. */
    readonly quiverPairsWith: 'bow'
  }

  readonly bag: { readonly width: number; readonly height: number }

  /** §2.16 companions, §2.13 party level lift. */
  readonly party: {
    readonly cap: number
    /** `buildUnitFromCharacter` without statOverrides: +1 on every positive stat per level above 1, hp += 3 per level. */
    readonly levelLift: { readonly statPerLevel: number; readonly hpPerLevel: number }
    /** Party chassis pool = round(class `startingHp` × hpMultiplier) + hpPerLevel·(L−1) — the party half of the
     *  fight-length lever (CONTRACT-CHANGES 0048). Class `startingHp` is shared with the enemy chassis, so the
     *  two sides scale in rules (`difficulty.enemyScaling.enemyHpMultiplier`), never by editing classes.json. */
    readonly hpMultiplier: number
    /** Engine-minted flag `recruited_<characterId>` — MUST validate under `IdSchema` so content predicates can read it
     *  (CONTRACT-CHANGES 0005; `tests/unit/engine/run/party.test.ts` asserts it for every character id). */
    readonly recruitFlagPrefix: 'recruited_'
    readonly recruitFlagScope: 'permanent'
  }

  /** §2.13 economy, §2.10 shop/inn, §2.6 bounty. */
  readonly economy: {
    readonly startGold: number
    /** `count` items placed by `seedNewRun`; charges come from the item def. */
    readonly startKit: readonly { readonly itemId: string; readonly count: number }[]
    readonly startDay: number
    readonly sellRatio: number
    /** Sanity bands the drift lint checks per rarity; null = never bought / never sold. */
    readonly priceBands: Readonly<Record<Rarity, { readonly buy: readonly [number, number] | null; readonly sell: readonly [number, number] | null }>>
    readonly killGold: { readonly base: number; readonly perLevel: number }
    /** Bounty when `bountyValue` is null: by level (Godot game_manager.gd:555-563 verbatim). */
    readonly bountyTiers: readonly { readonly maxLevel: number; readonly gold: number }[]
    /** null = no cap (brief §2.6: 4 is a recommendation, not a rule). */
    readonly prisonerCap: number | null
    readonly shopRarityByRegionTier: Readonly<Record<RegionTier, readonly Rarity[]>>
    readonly shopNeverSells: readonly Rarity[]
    /** 1-2 rotating picks from `deriveRng(run.rng, rngLabels.shop(town, day))` — derived, never stored. */
    readonly shopRotatingSlots: readonly [number, number]
  }

  /** §2.9 overworld, DECISIONS area tier. */
  readonly travel: {
    readonly foodPerHop: number
    readonly daysPerHop: number
    /** Every LIVING unit, at 0 food. */
    readonly starvationDamage: number
    /** The band's supply reading turns to a warning at or below this (a number the UI must not invent: CONTRACT 9.5). */
    readonly lowFoodWarnAt: number
    /** cooldown = 1 on first pass or ≥ cooldownDays since last crossing, else max(cooldownFloor, daysSince / cooldownDays). */
    readonly cooldownDays: number
    readonly cooldownFloor: number
    /**
     * Hops INTO these node types never roll. It used to be TOWN, DUNGEON and BOSS, which suppressed the roll on
     * 22.8% of all hop DIRECTIONS (1 860 of 8 160, measured over 60 seeds × every edge both ways) — and, because
     * the road to the throne is town-and-dungeon heavy, it landed hardest exactly there: two encounters in twelve
     * hops on one blind run, three in fourteen on the next, and a company that reached tier 3 with thirty gold
     * because road fights are the main purse and the road had been quiet (RE-GATE C 3.19).
     * DUNGEON comes off the list (0124). A dungeon mouth is the least patrolled place on the sheet — it is the
     * wilderness, and a quiet road into it was the opposite of the truth. The other two stay, each for a reason
     * the mouth has not: a market is a road's destination and its road is walked by everyone; the THRONE is the
     * last door, with no inn behind it and no retreat from it (`run/travel.ts#throneWarning`), so a roll on its
     * threshold would decide the final battle before the player reached it.
     * Taking TOWN off as well was measured and rejected: the road leg's clear rate fell from 63% to 8% (24 paths,
     * careful player), far outside the owner's 55-70% band — the region knobs were tuned WITH this suppression in
     * place, so the honest version of "the knob means what it says" is a re-tune of the knobs themselves, which is
     * an owner call and not a lint fix.
     */
    readonly noRollInto: readonly ('TOWN' | 'DUNGEON' | 'BOSS')[]
    /** Auto-walk pauses at these (plus any unvisited node and the destination); cleared TRAIL nodes chain silently. */
    readonly decisionNodeTypes: readonly ('TOWN' | 'CAMP' | 'DUNGEON' | 'BOSS' | 'DISCOVERY')[]
    /** The band an authored `node.areaTier` must match for its BFS distance from the start hub — enforced by
     *  `engine/content.ts#createEnv` (the same authoring gate as `bossNodeMinHops`); `run/difficulty.ts#areaTier`
     *  then reads the authored value. */
    readonly tierByDistance: readonly { readonly maxHops: number; readonly tier: RegionTier }[]
    /** `engine/content.ts#createEnv` throws when the BOSS node's `nodeDistance` is below this (authoring gate). */
    readonly bossNodeMinHops: number
  }

  /** §2.10 camp. */
  readonly camp: {
    readonly restHealFraction: number
    readonly restFoodCost: number
    readonly scoutFoodCost: number
    /** BFS EDGE depth from the current node. */
    readonly scoutDepth: number
    readonly actionsPerVisit: number
  }

  /** §2.11, DECISIONS compact variant. */
  readonly dungeon: {
    readonly rows: number
    readonly cols: number
    /** Trace count. Six, not the four the compact variant shipped with: four traces over four columns overlap so
     *  hard that the graph was a single line the player walked (RE-GATE C 3.18). Six widens the room SET; the
     *  descent is still `rows + 1` rooms long, so this buys choice, not length. */
    readonly paths: number
    readonly firstTwoPathsDistinctStart: boolean
    readonly weights: Readonly<Record<Exclude<RoomType, 'boss'>, number>>
    readonly forcedFirstRow: RoomType
    readonly forcedLastRow: RoomType
    /** No elite/rest in rows below this index. */
    readonly noSpecialBeforeRow: number
    /** And no ELITE below this one — row 0 is a forced fight, so an elite at row 1 is the hardest pack in the
     *  dungeon as the company's SECOND room (RE-GATE C 3.18). Rest is deliberately still allowed at row 1: the
     *  early heal is the answer to the same finding's other half. */
    readonly noEliteBeforeRow: number
    /** Chance that a room with exactly one way on is woven a SECOND (`procgen/dungeonGraph.ts` phase 2b). Four
     *  traces over four columns overlap into a corridor — 21% of rooms offered a choice before the weave and 45%
     *  after it at six traces, which is the branching chart the descent screen has always drawn. */
    readonly branchChance: number
    readonly restHealFraction: number
    readonly restFoodCost: number
    readonly treasureGold: number
    /** Event rooms with an empty `roomEvents` list pay exactly this (fixed, no roll — event gold is otherwise authored `addGold`). */
    readonly eventGoldFallback: number
    /**
     * The floor under a dungeon's authored event deck (`content/lint.ts`). Event rooms draw from `roomEvents`
     * WITHOUT replacement, so a deck shorter than the graph's event-room count leaves the rest empty. Measured
     * over 20 000 generated graphs at these weights: 51% of graphs deal ≥3 event rooms, 21% ≥4, 6% ≥5 and 1.4%
     * ≥7 — so six is the deck that covers 99.8% of them (`tests/unit/engine/procgen/dungeonGraph.test.ts` holds
     * that measurement against this number, and fails if a weights change moves it).
     */
    readonly minRoomEvents: number
    /** Research-canonical StS variant kept as a tuning alternative (data, not code). */
    readonly canonicalVariant: { readonly rows: number; readonly cols: number; readonly paths: number; readonly weights: Readonly<Partial<Record<RoomType, number>>> }
  }

  /** §2.13 difficulty by map position. */
  readonly difficulty: {
    readonly levelBand: Readonly<Record<RegionTier, readonly [number, number]>>
    /**
     * `run/battle.ts#battleSpecFor`: a finalBoss spec's level = max(authored member level, bossLevel), and
     * `combat/seed.ts#groupMemberUnit` maxes again against the member's own level and its character's level.
     * So this is a FLOOR, never a setter: it can only raise the final boss. `ashford_company` authors Kaine at
     * L7 and his guards at L5, so any value ≤ 7 is a no-op — tune the final boss DOWN in the group's content
     * (member levels, counts, `armor`), never by lowering this number.
     */
    readonly bossLevel: number
    /** level = band[0] + (fnv1a(salt) % saltMod); salt = node id (travel) or `<dungeon>:<room>`. */
    readonly saltMod: number
    /** hp = round(startingHp × enemyHpMultiplier) + hpPerLevel·(L−1); str/def (+mag if > 0) += floor((L−1)/strDefMagEvery);
     *  skl/spd/res += floor((L−1)/sklSpdResEvery); lck flat. The multiplier is THE threat lever (lesson: the game was too
     *  easy, never too hard): class `startingHp` is shared with the party, so enemies scale their pool here, not in content. */
    readonly enemyScaling: { readonly enemyHpMultiplier: number; readonly hpPerLevel: number; readonly strDefMagEvery: number; readonly sklSpdResEvery: number }
  }

  /** §2.13 loot by SOURCE. */
  readonly loot: {
    /** Chance + C/U/R/E/L weights by battleTag × regionTier. `quest` uses the travel row of the node's tier. */
    readonly rows: Readonly<Record<BattleTag, Readonly<Record<RegionTier, LootRow>>>>
    readonly dungeonTreasure: LootRow
    /** Sources whose drop is guaranteed and therefore never discarded on bag-full. */
    readonly guaranteedTags: readonly BattleTag[]
    /** `item.region === current || 'none'` for these; elite/boss/finalBoss pull from every region. */
    readonly regionFilteredTags: readonly BattleTag[]
    /** Bag + all hands are excluded before rolling. */
    readonly excludeOwned: boolean
    /** Fall DOWN one tier when a pool is empty (after excluding owned ids). */
    readonly fallDown: Readonly<Record<Rarity, Rarity | null>>
    /** Only hand-slot gear drops (weapon/shield/tome/staff/quiver). */
    readonly handSlotOnly: boolean
  }

  /** §2.12 quests, checks. */
  readonly quests: {
    readonly maxSettlePasses: number
    readonly completeSentinel: '__complete__'
  }
  readonly checks: {
    /** Authoring guidance the lint WARNS on. The FLOOR is the lowest stat a level-1 starter can still fail on
     *  (`lord` LCK 4, `mage` SKL 5 — there is no XP, so the starting sheet is the sheet for the WHOLE run) and the
     *  ceiling is the highest a recruitable companion reaches (Kael, SKL 9). A band that started at 6 warned on
     *  every check the first-hour party could actually pass, which is backwards.
     *  This band is guidance and nothing more: it says what a threshold may be, never whether the player can ever
     *  answer it. That is `content/lint.ts`, and it FAILS the gate on two rules — a threshold no obtainable unit
     *  reaches, and (0120) a decision whose every option sits above the sheet the guaranteed company ships with. */
    readonly thresholdGuidance: readonly [number, number]
    readonly statCheckRequiresLiving: boolean
    readonly autoPickBestCandidate: boolean
  }

  /** §2.14 save. */
  readonly save: {
    readonly version: string
    readonly runKey: string
    readonly metaKey: string
    readonly maxBytes: number
    /** Pre-alpha: a version/content mismatch nukes the save with a loud warning; no migrations. */
    readonly nukeOnMismatch: boolean
  }

  /** §2.13 balance targets (CI asserts). */
  readonly balance: {
    readonly startersVsStubWin: readonly [number, number]
    readonly bossWithEpicWin: readonly [number, number]
    readonly stalemates: 0
    /** The band the MEAN round count of a label must sit in — the brief states the target as an average
     *  ("average 4-10 turns"), and this is that sentence and nothing else. */
    readonly turns: readonly [number, number]
    /** The per-battle CEILING, separately: no single battle may run past it. 0048 added the ceiling assertion but
     *  read it off `turns[1]`, which conflated a mean with a maximum — a field whose mean is 7 has a tail, and
     *  the tail moved out when `enemyScaling.enemyHpMultiplier` rose to meet the path targets (0110). A battle
     *  past THIS is a design failure the way a stalemate is; `combat.roundCap` remains the engine smoke alarm. */
    readonly roundsCeiling: number
    /** Seeds per scenario in the `balance` gate. A 20pp win band cannot be resolved by 20 seeds (binomial 95% CI
     *  at p≈0.5, n=20 is ±22pp — wider than the band); at 120 the standard error is ≈4.5pp (CONTRACT-CHANGES 0048). */
    readonly simSeeds: number
    readonly firstBloodByRound: number
    /**
     * The shipped difficulty of a PATH, not of a fight (GATE3-15/17). `startersVsStubWin` and `bossWithEpicWin`
     * both seed a fresh, full-HP party, so a dungeon descent (entry HP carried room to room, no way out but the
     * boss) and a multi-hop road leg (one ration a hop, an encounter roll on most of them) were unmeasured — the
     * gate was green while the game killed the player by attrition. `scripts/cli.ts` owns the two routes it walks;
     * these are the bands, and a careful player is what walks them (inn + rations at every town, the free rest
     * room whenever anyone is hurt).
     */
    readonly attrition: {
      /** Paths cost ~10 battles each, so the sample is smaller than `simSeeds`; at 24 the Wilson half-width is
       *  ≈20pp, which resolves "most parties clear it" from "most parties die" and nothing finer. */
      readonly seeds: number
      readonly firstSeed: number
      /** Descents that reach the dungeon boss alive. */
      readonly dungeonClearRate: readonly [number, number]
      /** Journeys that reach the throne alive. */
      readonly roadClearRate: readonly [number, number]
      /** The LOWEST party HP ÷ party max the path ever drove the company to, averaged over the sweep. This is the
       *  pressure reading, not the end-of-path one: a leg that ends at an inn ends at full health however close it
       *  came. Below the floor the route is a meat grinder; above the ceiling it is a corridor. */
      readonly lowWaterHpFraction: readonly [number, number]
      /** Hops taken on an empty larder across the whole road sweep. A few are bad luck; a systematic supply
       *  failure (the shipped 6-ration / 50g economy starved the party from day 7 to the wipe on every auto-drive)
       *  is dead by design and fails the gate. */
      readonly maxStarvingSteps: number
    }
  }

  /** §2.15 tutorial. */
  readonly tutorial: {
    readonly mcPosition: readonly [number, number]
    readonly bandit: {
      readonly id: string
      readonly name: string
      readonly classId: string
      readonly hp: number
      readonly str: number
      readonly spd: number
      readonly position: readonly [number, number]
    }
  }
}

const W = (c: number, u: number, r: number, e: number, l: number): RarityWeights =>
  ({ common: c, uncommon: u, rare: r, epic: e, legendary: l })
const NONE: LootRow = { chance: 0, weights: W(0, 0, 0, 0, 0) }
const TRAVEL: Readonly<Record<RegionTier, LootRow>> = {
  1: { chance: 0.4, weights: W(80, 20, 0, 0, 0) },
  2: { chance: 0.4, weights: W(50, 40, 10, 0, 0) },
  3: { chance: 0.4, weights: W(0, 40, 60, 0, 0) }, // epic removed from travel — §5 wins over §11
}
const same = (row: LootRow): Readonly<Record<RegionTier, LootRow>> => ({ 1: row, 2: row, 3: row })

export const SAVE_VERSION = '1.1.0'

export const rules: Rules = {
  knobs: {
    armorCap: 'none',
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
    enemySpawn: { columnsDeep: 2, firstRow: 3, rowStride: 2 },
    roundCap: 60,
    itemUseAp: 1,
    enemyActionApCost: 1,
    autoEndTurnAtZeroAp: false,
    drDivisor: 2,
    minDamage: 0,
    terrain: {
      plain: { defBonus: 0, resBonus: 0 },
      forest: { defBonus: 1, resBonus: 0 },
      fort: { defBonus: 2, resBonus: 2 },
    },
    aiLowHpFraction: 0.4,
    aiDefaultPreferredRange: { archer: [2, 3], healer: [1, 2] },
    statuses: {
      poison:     { stackable: false, tick: 'poisonPiercing', expiresAt: 'ownerTurnEnd',   harmful: true,  consumedOnUse: false },
      burn:       { stackable: true,  tick: 'burnMagicSplit', expiresAt: 'ownerTurnEnd',   harmful: true,  consumedOnUse: false },
      slow:       { stackable: false, tick: null,             expiresAt: 'ownerTurnEnd',   harmful: true,  consumedOnUse: false },
      immobilize: { stackable: false, tick: null,             expiresAt: 'ownerTurnEnd',   harmful: true,  consumedOnUse: false },
      taunt:      { stackable: false, tick: null,             expiresAt: 'ownerTurnStart', harmful: false, consumedOnUse: false },
      riposte:    { stackable: false, tick: null,             expiresAt: 'ownerTurnStart', harmful: false, consumedOnUse: false },
      empower:    { stackable: false, tick: null,             expiresAt: 'ownerTurnStart', harmful: false, consumedOnUse: true },
    },
    capture: {
      apCost: 2,
      hpWeight: 0.6,
      adjacencyWeight: 0.25,
      bountyHunterBonus: 0.15,
      uiHpGate: 0.5,
    },
    coverPassive: 'genatsvale',
  },

  gear: {
    cardsPerOneHanded: [3, 4],
    cardsPerTwoHanded: 6,
    cardsPerQuiver: 0,
    deckSizeRange: [7, 13],
    quiverPairsWith: 'bow',
  },

  bag: { width: 8, height: 4 },

  party: {
    cap: 6,
    levelLift: { statPerLevel: 1, hpPerLevel: 3 },
    hpMultiplier: 2.8,
    recruitFlagPrefix: 'recruited_',
    recruitFlagScope: 'permanent',
  },

  economy: {
    startGold: 80,
    startKit: [
      { itemId: 'food_rations', count: 2 },   // 2 × 4 charges = 8 hops
      { itemId: 'healing_potion', count: 1 }, // Vulnerary dropped (§2.3)
    ],
    startDay: 1,
    sellRatio: 0.5,
    priceBands: {
      common:    { buy: [50, 120],  sell: null },
      uncommon:  { buy: [120, 250], sell: null },
      rare:      { buy: [300, 500], sell: null },
      epic:      { buy: null, sell: [300, 500] },
      legendary: { buy: null, sell: [500, 800] },
    },
    killGold: { base: 15, perLevel: 8 },
    bountyTiers: [
      { maxLevel: 2, gold: 20 },
      { maxLevel: 4, gold: 40 },
      { maxLevel: Number.POSITIVE_INFINITY, gold: 60 },
    ],
    prisonerCap: null,
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
    lowFoodWarnAt: 3,
    cooldownDays: 3,
    cooldownFloor: 0.25,
    noRollInto: ['TOWN', 'BOSS'],
    decisionNodeTypes: ['TOWN', 'CAMP', 'DUNGEON', 'BOSS', 'DISCOVERY'],
    tierByDistance: [
      { maxHops: 2, tier: 1 },
      { maxHops: 5, tier: 2 },
      { maxHops: Number.POSITIVE_INFINITY, tier: 3 },
    ],
    bossNodeMinHops: 7,
  },

  camp: {
    restHealFraction: 0.35,
    restFoodCost: 1,
    scoutFoodCost: 1,
    scoutDepth: 3,
    actionsPerVisit: 1,
  },

  dungeon: {
    rows: 6,
    cols: 4,
    paths: 6,
    firstTwoPathsDistinctStart: true,
    weights: { combat: 45, event: 20, treasure: 12, rest: 20, elite: 8 }, // no Shop room (DECISIONS)
    forcedFirstRow: 'combat',
    forcedLastRow: 'rest',
    noSpecialBeforeRow: 1,
    noEliteBeforeRow: 2,
    branchChance: 0.75,
    restHealFraction: 0.5,
    restFoodCost: 0,
    treasureGold: 50,
    eventGoldFallback: 30,
    minRoomEvents: 6,
    canonicalVariant: { rows: 15, cols: 7, paths: 6, weights: { combat: 60, event: 25, rest: 10, elite: 5 } },
  },

  difficulty: {
    levelBand: { 1: [1, 2], 2: [2, 3], 3: [3, 4] },
    bossLevel: 5,
    saltMod: 2,
    enemyScaling: { enemyHpMultiplier: 5.5, hpPerLevel: 2, strDefMagEvery: 3, sklSpdResEvery: 4 },
  },

  loot: {
    rows: {
      'tutorial': same(NONE),
      'travel': TRAVEL,
      'quest': TRAVEL,
      // The descent's fights pay three times in four, not one in two (0124). What made routing free was not the
      // chart — Slay the Spire shows its whole map too — but that the SAFE branch paid better than the fighting
      // one: a treasure room handed out a guaranteed rare-or-epic for nothing while a fight paid half the time.
      'dungeon:combat': {
        1: { chance: 0.75, weights: TRAVEL[1].weights },
        2: { chance: 0.75, weights: TRAVEL[2].weights },
        3: { chance: 0.75, weights: TRAVEL[3].weights },
      },
      'dungeon:elite': same({ chance: 1, weights: W(0, 0, 75, 25, 0) }),
      'dungeon:boss': {
        1: { chance: 1, weights: W(0, 0, 0, 100, 0) },
        2: { chance: 1, weights: W(0, 0, 0, 75, 25) },
        3: { chance: 1, weights: W(0, 0, 0, 50, 50) }, // where legendaries must enter play, before the finale
      },
      'finalBoss': same({ chance: 1, weights: W(0, 0, 0, 0, 100) }), // trophy, named on the win screen
      'sim': same(NONE),
    },
    /** Coins and kit, never a relic: a room that costs nothing must not be where the run's best gear enters.
     *  A blind descent took three treasure rooms and ONE fight and met the boss with an epic Paladin's Aegis, a
     *  rare Serpent Blade and a rare Hellfire Tome on (RE-GATE C 3.17) — the elite row above is the room that
     *  pays in epics, and it is the room the safe route walks past. */
    dungeonTreasure: { chance: 1, weights: W(0, 45, 55, 0, 0) },
    guaranteedTags: ['dungeon:elite', 'dungeon:boss', 'finalBoss'],
    regionFilteredTags: ['travel', 'quest', 'dungeon:combat'],
    excludeOwned: true,
    fallDown: { legendary: 'epic', epic: 'rare', rare: 'uncommon', uncommon: 'common', common: null },
    handSlotOnly: true,
  },

  quests: {
    maxSettlePasses: 8,
    completeSentinel: '__complete__',
  },
  checks: {
    thresholdGuidance: [4, 9],
    statCheckRequiresLiving: true,
    autoPickBestCandidate: true,
  },

  save: {
    version: SAVE_VERSION,
    runKey: 'embermarch:run',
    metaKey: 'embermarch:meta',
    maxBytes: 50 * 1024,
    nukeOnMismatch: true,
  },

  balance: {
    startersVsStubWin: [0.75, 0.92],
    bossWithEpicWin: [0.4, 0.6],
    stalemates: 0,
    turns: [4, 10],
    roundsCeiling: 12,
    simSeeds: 120,
    firstBloodByRound: 2,
    attrition: {
      seeds: 24,
      firstSeed: 3000,
      dungeonClearRate: [0.45, 0.6],
      roadClearRate: [0.55, 0.7],
      lowWaterHpFraction: [0.05, 0.6],
      maxStarvingSteps: 6,
    },
  },

  tutorial: {
    mcPosition: [0, 2],
    bandit: { id: 'tutorial_bandit', name: 'Bandit', classId: 'bandit', hp: 10, str: 2, spd: 1, position: [4, 2] },
  },
}

/**
 * RNG label formats (brief §2.14). Pass/day salts make re-crossings distinct; children depend on the parent SEED only.
 * A `battle*` string IS the `BattleId`: `battleSpecFor` derives the combat stream with `deriveState(run.rng, battleId)`
 * (no extra prefix); `loot`/`floor` wrap that same id (`loot:battle:bandits:node:d3`).
 */
export const rngLabels = {
  hop: (sheet: string, from: string, to: string, pass: number): string => `hop:${sheet}:${from}->${to}#${pass}`,
  encounter: (sheet: string, from: string, to: string, pass: number): string => `encounter:${sheet}:${from}->${to}#${pass}`,
  battleTravel: (group: string, node: string, day: number): string => `battle:${group}:${node}:d${day}`,
  battleQuest: (group: string, node: string, day: number): string => `battle:quest:${group}:${node}:d${day}`,
  battleDungeon: (dungeon: string, room: string): string => `battle:${dungeon}:${room}`,
  battleTutorial: 'battle:tutorial',
  battleFinalBoss: 'battle:finalBoss',
  loot: (battleId: string): string => `loot:${battleId}`,
  /** The authored board a fight is laid out on (`run/battle.ts#obstaclesFor`, 0112) — its own stream, so adding
   *  obstacles could not shift the floor's or the loot's draws. */
  battlefield: (battleId: string): string => `field:${battleId}`,
  /** Treasure-room gear roll (`run/dungeon.ts#moveToRoom`): no battle, so its own label. */
  treasure: (dungeon: string, room: string): string => `treasure:${dungeon}:${room}`,
  dungeon: (id: string): string => `dungeon:${id}`,
  floor: (battleId: string): string => `floor:${battleId}`,
  shop: (town: string, day: number): string => `shop:${town}:d${day}`,
} as const
