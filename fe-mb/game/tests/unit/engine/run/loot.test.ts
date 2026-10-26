/**
 * run/loot.ts acceptance (brief §2.13 loot by SOURCE; §10 "travel rows roll at 0.40 with the tier weights and never
 * epic; elite/treasure/boss rooms drop with chance 1.0 at their weights; tier-3 dungeon bosses can drop legendary;
 * already-owned ids are excluded; a guaranteed drop is never discarded on bag-full; the final-boss drop is legendary").
 */
import { describe, expect, it } from 'vitest'
import { deriveState } from '../../../../src/engine/rngState'
import { rngLabels, type LootRow } from '../../../../src/engine/rules'
import { isGear, placeInBag } from '../../../../src/engine/run/bag'
import { grantLoot, lootPool, lootRowFor, rollLoot } from '../../../../src/engine/run/loot'
import type { BattleTag, Item, Rarity, RegionTier, RngState } from '../../../../src/engine/types'
import { env, fillBag, newRun, smallestItem, withBag } from '../../../helpers/runs'

const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const TIERS: readonly RegionTier[] = [1, 2, 3]
const ROLLS = 2000
const allGear = Object.values(env.content.items).filter(isGear)
const byId = (id: string): Item => env.content.items[id]!

/** Roll a row ROLLS times, threading the returned rng so every roll is a fresh draw. */
function tally(row: LootRow, pool: readonly Item[], seed = 1): { drops: number; counts: Record<Rarity, number> } {
  const counts: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
  let rng: RngState = { seed, counter: 0 }
  let drops = 0
  for (let i = 0; i < ROLLS; i++) {
    const r = rollLoot(row, pool, rng, env)
    rng = r.rng
    expect(r.itemIds.length).toBeLessThanOrEqual(1)
    if (r.itemIds.length === 1) {
      drops++
      counts[byId(r.itemIds[0]!).rarity]++
    }
  }
  return { drops, counts }
}

const share = (n: number, of: number): number => (of === 0 ? 0 : n / of)
const nonZero = (row: LootRow): readonly Rarity[] => RARITIES.filter((r) => row.weights[r] > 0)

describe('loot rows over 2000 rolls', () => {
  it('lootRowFor reads rules.loot.rows by (tag, tier) and dungeonTreasure by itself', () => {
    expect(lootRowFor('travel', 1, env)).toBe(env.rules.loot.rows.travel[1])
    expect(lootRowFor('dungeon:boss', 3, env)).toBe(env.rules.loot.rows['dungeon:boss'][3])
    expect(lootRowFor('dungeonTreasure', 2, env)).toBe(env.rules.loot.dungeonTreasure)
  })

  it('travel rows roll at their chance with the tier weights and never drop epic or legendary', () => {
    for (const tier of TIERS) {
      const row = lootRowFor('travel', tier, env)
      const { drops, counts } = tally(row, allGear, tier)
      expect(share(drops, ROLLS)).toBeCloseTo(row.chance, 1)
      expect(counts.epic + counts.legendary).toBe(0)
      const total = nonZero(row).reduce((s, r) => s + row.weights[r], 0)
      for (const r of RARITIES) {
        if (row.weights[r] === 0) expect(counts[r]).toBe(0)
        else expect(Math.abs(share(counts[r], drops) - row.weights[r] / total)).toBeLessThan(0.06)
      }
    }
  })

  it('dungeon combat rows share the travel weights at their own chance; quest rows are the travel rows', () => {
    for (const tier of TIERS) {
      const row = lootRowFor('dungeon:combat', tier, env)
      expect(row.weights).toEqual(lootRowFor('travel', tier, env).weights)
      expect(share(tally(row, allGear, 10 + tier).drops, ROLLS)).toBeCloseTo(row.chance, 1)
      expect(lootRowFor('quest', tier, env)).toEqual(lootRowFor('travel', tier, env))
    }
  })

  it('elite / treasure / boss rows drop every time at their weights; tier-3 bosses and the final boss drop legendary', () => {
    const guaranteed: readonly (BattleTag | 'dungeonTreasure')[] = ['dungeon:elite', 'dungeonTreasure', 'dungeon:boss', 'finalBoss']
    for (const tag of guaranteed) {
      for (const tier of TIERS) {
        const row = lootRowFor(tag, tier, env)
        expect(row.chance).toBe(1)
        const { drops, counts } = tally(row, allGear, 20 + tier)
        expect(drops).toBe(ROLLS)
        for (const r of RARITIES) if (row.weights[r] === 0) expect(counts[r]).toBe(0)
        for (const r of nonZero(row)) expect(counts[r]).toBeGreaterThan(0)
      }
    }
    expect(nonZero(lootRowFor('dungeon:boss', 3, env))).toContain('legendary')
    expect(nonZero(lootRowFor('dungeon:boss', 1, env))).not.toContain('legendary')
    expect(nonZero(lootRowFor('finalBoss', 3, env))).toEqual(['legendary'])
    for (const t of env.rules.loot.guaranteedTags) for (const tier of TIERS) expect(lootRowFor(t, tier, env).chance).toBe(1)
  })

  it('tutorial and sim rows never drop', () => {
    for (const tag of ['tutorial', 'sim'] as const) for (const tier of TIERS) expect(tally(lootRowFor(tag, tier, env), allGear).drops).toBe(0)
  })
})

describe('pool', () => {
  it('already-owned ids are excluded (bag + both hands)', () => {
    const run = newRun()
    for (const tag of ['travel', 'dungeon:elite', 'dungeonTreasure'] as const) {
      const ids = lootPool(run, tag, env).map((i) => i.id)
      for (const u of Object.values(run.party)) {
        if (u.handLeft !== null) expect(ids).not.toContain(u.handLeft)
        if (u.handRight !== null) expect(ids).not.toContain(u.handRight)
      }
      for (const e of run.bag) expect(ids).not.toContain(e.itemId)
    }
    const spare = allGear.find((i) => !run.bag.some((e) => e.itemId === i.id) && i.region === 'none')!
    const owning = withBag(run, placeInBag(run.bag, [spare.id], env)!)
    expect(lootPool(run, 'dungeon:elite', env).map((i) => i.id)).toContain(spare.id)
    expect(lootPool(owning, 'dungeon:elite', env).map((i) => i.id)).not.toContain(spare.id)
  })

  it('hand-slot gear only: no food or potion in any pool', () => {
    const run = newRun()
    for (const tag of ['travel', 'quest', 'dungeon:combat', 'dungeon:elite', 'dungeon:boss', 'finalBoss', 'dungeonTreasure'] as const) {
      for (const i of lootPool(run, tag, env)) expect(isGear(i)).toBe(true)
    }
  })

  it('region filter: travel / quest / dungeon:combat pools hold current-region + none gear; elite / boss / treasure pull from every region', () => {
    const run = newRun()
    const here = env.content.overworld.nodes.find((n) => n.id === run.nodeId)!.regionId
    const elsewhere = Object.keys(env.content.regions).find((r) => r !== here)!
    for (const tag of env.rules.loot.regionFilteredTags) {
      for (const i of lootPool(run, tag, env)) expect([here, 'none']).toContain(i.region)
    }
    for (const tag of ['dungeon:elite', 'dungeon:boss', 'finalBoss', 'dungeonTreasure'] as const) {
      expect(lootPool(run, tag, env).some((i) => i.region === elsewhere)).toBe(true)
    }
    // Standing in another region flips the filter with it.
    const away = env.content.overworld.nodes.find((n) => n.regionId === elsewhere)!
    for (const i of lootPool({ ...run, nodeId: away.id }, 'travel', env)) expect([elsewhere, 'none']).toContain(i.region)
  })
})

describe('rollLoot mechanics', () => {
  it('falls DOWN one tier when the rolled tier is empty and drops nothing when the ladder runs out', () => {
    const epicOnly: LootRow = { chance: 1, weights: { common: 0, uncommon: 0, rare: 0, epic: 1, legendary: 0 } }
    const noEpics = allGear.filter((i) => i.rarity !== 'epic')
    const r = rollLoot(epicOnly, noEpics, { seed: 3, counter: 0 }, env)
    expect(r.itemIds).toHaveLength(1)
    expect(byId(r.itemIds[0]!).rarity).toBe(env.rules.loot.fallDown.epic)
    const rareOnly = allGear.filter((i) => i.rarity === 'rare')
    expect(rollLoot(epicOnly, rareOnly, { seed: 3, counter: 0 }, env).itemIds.map((id) => byId(id).rarity)).toEqual(['rare'])
    const commonOnly: LootRow = { chance: 1, weights: { common: 1, uncommon: 0, rare: 0, epic: 0, legendary: 0 } }
    expect(rollLoot(commonOnly, [], { seed: 3, counter: 0 }, env).itemIds).toEqual([])
    expect(env.rules.loot.fallDown.common).toBeNull()
  })

  it('a row whose weights are all 0 drops nothing even at chance 1', () => {
    const empty: LootRow = { chance: 1, weights: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 } }
    expect(rollLoot(empty, allGear, { seed: 5, counter: 0 }, env).itemIds).toEqual([])
  })

  it('advances the rng, returns { seed, counter } only, is deterministic and independent of the parent stream', () => {
    const run = newRun()
    const rng = deriveState(run.rng, rngLabels.loot('battle:bandits:frontier_camp:d1'))
    const row = lootRowFor('dungeon:elite', 2, env)
    const a = rollLoot(row, allGear, rng, env)
    const b = rollLoot(row, allGear, rng, env)
    expect(a).toEqual(b)
    expect(Object.keys(a.rng).sort()).toEqual(['counter', 'seed'])
    expect(a.rng.counter).toBeGreaterThan(rng.counter)
    expect(run.rng.counter).toBe(0)
    const other = rollLoot(row, allGear, deriveState(run.rng, rngLabels.loot('battle:bandits:frontier_camp:d2')), env)
    expect(other.rng.seed).not.toBe(a.rng.seed)
  })
})

describe('grantLoot', () => {
  const potion = smallestItem()

  it('places what fits, emits itemAcquired per placed item and bumps stats.gearFound for gear only', () => {
    const run = newRun()
    const legendary = allGear.find((i) => i.rarity === 'legendary')!
    const r = grantLoot(run, [legendary.id, potion.id], 'loot', env)
    expect(r.placed).toEqual([legendary.id, potion.id])
    expect(r.overflow).toEqual([])
    expect(r.state.bag.map((e) => e.itemId)).toEqual([...run.bag.map((e) => e.itemId), legendary.id, potion.id])
    expect(r.state.pendingLoot).toEqual([])
    expect(r.state.stats.gearFound).toBe(run.stats.gearFound + 1)
    expect(r.effects).toEqual([
      { kind: 'itemAcquired', itemId: legendary.id, rarity: 'legendary', source: 'loot' },
      { kind: 'itemAcquired', itemId: potion.id, rarity: potion.rarity, source: 'loot' },
    ])
  })

  it('never discards a guaranteed drop: a full bag overflows to pendingLoot with lootOverflow', () => {
    const full = fillBag(newRun())
    const epic = allGear.find((i) => i.rarity === 'epic')!
    const r = grantLoot(full, [epic.id], 'trophy', env)
    expect(r.placed).toEqual([])
    expect(r.overflow).toEqual([epic.id])
    expect(r.state.pendingLoot).toEqual([epic.id])
    expect(r.state.bag).toEqual(full.bag)
    expect(r.state.stats.gearFound).toBe(full.stats.gearFound + 1)
    expect(r.effects).toEqual([{ kind: 'lootOverflow', itemIds: [epic.id] }])
    // A second grant appends — nothing already waiting is lost.
    const again = grantLoot(r.state, [potion.id], 'treasure', env)
    expect(again.state.pendingLoot).toEqual([epic.id, potion.id])
  })

  it('a partial fit places the small item and parks the large one', () => {
    const oneCell = fillBag(newRun(), 1)
    const big = allGear.find((i) => i.gridSize.width * i.gridSize.height > 1)!
    const r = grantLoot(oneCell, [big.id, potion.id], 'quest', env)
    expect(r.placed).toEqual([potion.id])
    expect(r.overflow).toEqual([big.id])
    expect(r.effects.map((e) => e.kind)).toEqual(['itemAcquired', 'lootOverflow'])
  })

  it('an empty grant is a same-reference no-op', () => {
    const run = newRun()
    expect(grantLoot(run, [], 'loot', env)).toEqual({ state: run, effects: [], placed: [], overflow: [] })
    expect(grantLoot(run, [], 'loot', env).state).toBe(run)
  })
})
