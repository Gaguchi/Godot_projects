/**
 * run/economy.ts + seedNewRun kit acceptance (brief §2.6 bountyFor, §2.10 shop/inn, §2.13 kit + prices; §10
 * "Shop stock respects region rarity gates, never lists epic/legendary, and lists potions everywhere; Inn charges
 * per wounded unit; Turn In pays bountyFor (20/40/60 by level; bountyValue override; Daren 50)").
 */
import { describe, expect, it } from 'vitest'
import { foodCount, isGear } from '../../../../src/engine/run/bag'
import { addGold, bountyFor, buyPrice, innCost, sellPrice, shopStock } from '../../../../src/engine/run/economy'
import { MC_ID } from '../../../../src/engine/run/party'
import type { Item, RegionTier } from '../../../../src/engine/types'
import { env, newRun, withUnit } from '../../../helpers/runs'

const items = Object.values(env.content.items)
const towns = Object.values(env.content.towns)
const tierOf = (regionId: string): RegionTier => env.content.regions[regionId]!.tier

describe('prices', () => {
  it('buyPrice is null for every drop-only item (epic/legendary) and positive for the rest — never 0', () => {
    for (const i of items) {
      const p = buyPrice(i)
      if (env.rules.economy.shopNeverSells.includes(i.rarity)) expect(p).toBeNull()
      else expect(p).toBeGreaterThan(0)
      expect(p).not.toBe(0)
    }
  })

  it('sellPrice equals the authored sellPrice for every shipped item (buy × sellRatio for buyables, authored for drop-only)', () => {
    for (const i of items) expect(sellPrice(i, env)).toBe(i.sellPrice)
    const fake: Item = { ...items[0]!, buyPrice: 100, sellPrice: 1 }
    expect(sellPrice(fake, env)).toBe(Math.floor(100 * env.rules.economy.sellRatio))
  })
})

describe('shop stock', () => {
  it('never lists epic/legendary or an item without a buy price', () => {
    for (const town of towns) {
      for (const i of shopStock(town, newRun(), env)) {
        expect(env.rules.economy.shopNeverSells).not.toContain(i.rarity)
        expect(buyPrice(i)).not.toBeNull()
      }
    }
  })

  it('lists every region-none consumable (potions and food) in every town', () => {
    const consumables = items.filter((i) => i.region === 'none' && !isGear(i))
    expect(consumables.length).toBeGreaterThan(0)
    for (const town of towns) {
      const ids = shopStock(town, newRun(), env).map((i) => i.id)
      for (const c of consumables) expect(ids).toContain(c.id)
    }
  })

  it("respects the region's rarity gate for every gear item (explicit shopStockIds aside)", () => {
    for (const town of towns) {
      const allowed = env.rules.economy.shopRarityByRegionTier[tierOf(town.regionId)]
      for (const i of shopStock(town, newRun(), env)) {
        if (isGear(i) && !town.shopStockIds.includes(i.id)) expect(allowed).toContain(i.rarity)
      }
    }
  })

  it('lists all same-region gear inside the gate and every explicit shopStockIds entry', () => {
    for (const town of towns) {
      const allowed = env.rules.economy.shopRarityByRegionTier[tierOf(town.regionId)]
      const ids = shopStock(town, newRun(), env).map((i) => i.id)
      for (const i of items) {
        if (isGear(i) && i.region === town.regionId && allowed.includes(i.rarity)) expect(ids).toContain(i.id)
        if (town.shopStockIds.includes(i.id) && buyPrice(i) !== null) expect(ids).toContain(i.id)
      }
    }
  })

  it('rotating picks are deterministic per (town, day), stay inside the gate and change with the day', () => {
    const town = towns[0]!
    const run = newRun()
    const a = shopStock(town, run, env).map((i) => i.id)
    const b = shopStock(town, run, env).map((i) => i.id)
    expect(a).toEqual(b)
    const [lo, hi] = env.rules.economy.shopRotatingSlots
    const baseline = shopStock(town, run, env).filter((i) => i.region === town.regionId || i.region === 'none' || town.shopStockIds.includes(i.id))
    const rotating = a.length - baseline.length
    expect(rotating).toBeGreaterThanOrEqual(lo)
    expect(rotating).toBeLessThanOrEqual(hi)
    const days = new Set<string>()
    for (let d = 1; d <= 12; d++) days.add(shopStock(town, { ...run, daysElapsed: d }, env).map((i) => i.id).join(','))
    expect(days.size).toBeGreaterThan(1)
    // The rotating stream derives from the run SEED by label, so it never advances run.rng.
    expect(run.rng.counter).toBe(0)
  })
})

describe('inn', () => {
  it('innCost bills per wounded living unit at the town price and lists exactly the wounded', () => {
    const town = towns.find((t) => t.innHealCostPerUnit > 0)!
    const run = newRun()
    expect(innCost(town, run, env)).toEqual({ wounded: [], total: 0 })
    const [a, b] = run.partyOrder as [string, string]
    let hurt = withUnit(run, { ...run.party[a]!, hp: { ...run.party[a]!.hp, current: 1 } })
    hurt = withUnit(hurt, { ...hurt.party[b]!, hp: { ...hurt.party[b]!.hp, current: hurt.party[b]!.hp.max - 1 } })
    expect(innCost(town, hurt, env)).toEqual({ wounded: [a, b], total: 2 * town.innHealCostPerUnit })
    const dead = withUnit(hurt, { ...hurt.party[a]!, hp: { ...hurt.party[a]!.hp, current: 0 } })
    expect(innCost(town, dead, env).wounded).toEqual([b])
  })
})

describe('bounty', () => {
  it('bountyFor pays the level tier when bountyValue is null and the override otherwise (Daren)', () => {
    const tiers = env.rules.economy.bountyTiers
    for (const t of tiers) {
      const level = Number.isFinite(t.maxLevel) ? t.maxLevel : tiers[tiers.length - 2]!.maxLevel + 1
      expect(bountyFor({ bountyValue: null, level }, env)).toBe(t.gold)
    }
    expect(bountyFor({ bountyValue: null, level: 1 }, env)).toBe(tiers[0]!.gold)
    const daren = Object.values(env.content.enemyGroups).flatMap((g) => g.members).find((m) => m.id === 'daren')!
    expect(bountyFor({ bountyValue: daren.bountyValue ?? null, level: daren.level }, env)).toBe(daren.bountyValue)
    expect(bountyFor({ bountyValue: 7, level: 99 }, env)).toBe(7)
  })
})

describe('gold', () => {
  it('addGold is signed, clamps at 0 and returns the same reference when unchanged', () => {
    const run = newRun()
    expect(addGold(run, 5).gold).toBe(run.gold + 5)
    expect(addGold(run, -(run.gold + 100)).gold).toBe(0)
    expect(addGold(run, 0)).toBe(run)
    expect(addGold({ ...run, gold: 0 }, -1).gold).toBe(0)
  })

  it('addGold is the ONE owner of stats.goldEarned: income counts, spending does not', () => {
    // GATE3-02: the counter had two hand-written owners (a battle payout and a bounty) and six sources that
    // moved the purse without it, so the run ledger printed 202 against 272 actually taken in.
    const run = newRun()
    const earned = run.stats.goldEarned
    expect(addGold(run, 25).stats.goldEarned).toBe(earned + 25)
    // spending is not un-earning: the counter is gross income, and the purse is what is left of it
    const spent = addGold(run, -10)
    expect(spent.gold).toBe(run.gold - 10)
    expect(spent.stats.goldEarned).toBe(earned)
    // what is counted is what actually MOVED — the clamp is applied first
    const broke = addGold({ ...run, gold: 0 }, -100)
    expect(broke.stats.goldEarned).toBe(earned)
    // and it accumulates over a chain of sources
    const rich = [12, -30, 40, 3].reduce(addGold, run)
    expect(rich.stats.goldEarned).toBe(earned + 55)
    expect(rich.gold).toBe(run.gold + 25)
  })
})

describe('starting kit (seedNewRun)', () => {
  it('starts with startGold, the kit food charges and the kit potion — all from rules', () => {
    const run = newRun()
    const { startGold, startKit, startDay } = env.rules.economy
    expect(run.gold).toBe(startGold)
    expect(run.daysElapsed).toBe(startDay)
    for (const k of startKit) expect(run.bag.filter((e) => e.itemId === k.itemId)).toHaveLength(k.count)
    const foodCharges = startKit.reduce((s, k) => (env.content.items[k.itemId]!.kind === 'food' ? s + k.count * (env.content.items[k.itemId]!.charges ?? 1) : s), 0)
    expect(foodCount(run.bag, env)).toBe(foodCharges)
    expect(run.bag).toHaveLength(startKit.reduce((s, k) => s + k.count, 0))
  })

  it('starting gear is EQUIPPED from characters.json, not in the bag: Lord sword; Knight lance + buckler; Mage tome', () => {
    const run = newRun()
    const bagIds = run.bag.map((e) => e.itemId)
    for (const id of run.partyOrder) {
      const def = env.content.characters[id]!
      if (def.kind !== 'unit') throw new Error('starter must be a unit')
      expect(def.starter).toBe(true)
      expect(run.party[id]!.handLeft).toBe(def.startingGear.left)
      expect(run.party[id]!.handRight).toBe(def.startingGear.right)
      for (const g of [def.startingGear.left, def.startingGear.right]) if (g !== null) expect(bagIds).not.toContain(g)
    }
    expect(run.party[MC_ID]!.handLeft).toBe('iron_sword')
    expect(run.party['oak']).toMatchObject({ handLeft: 'iron_lance', handRight: 'iron_buckler' })
    expect(run.party['lilina']!.handLeft).toBe('fire_tome')
  })

  it('starts at the sheet start node (visited), runId run-<seed>, rng at counter 0, every slot empty', () => {
    const run = newRun(42)
    const sheet = env.content.overworld
    expect(run.runId).toBe('run-42')
    expect(run.runSeed).toBe(42)
    expect(run.rng).toEqual({ seed: 42, counter: 0 })
    expect(run.nodeId).toBe(sheet.startNodeId)
    expect(run.visitedNodes).toEqual({ [`overworld:${sheet.id}:${sheet.startNodeId}`]: true })
    expect(run.pendingTravel).toBeNull()
    expect(run.pendingCombat).toBeNull()
    expect(run.pendingLoot).toEqual([])
    expect(run.deathLog).toEqual([])
    expect(run.prisoners).toEqual([])
    expect(run.stats.hops).toBe(0)
    expect(JSON.parse(JSON.stringify(run))).toEqual(run) // JSON-safe by construction (types.ts pillar 2)
  })

  it('the same seed seeds the same run', () => {
    expect(newRun(7)).toEqual(newRun(7))
  })
})
