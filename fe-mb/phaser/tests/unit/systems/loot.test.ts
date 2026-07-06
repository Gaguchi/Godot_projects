import { describe, it, expect } from 'vitest'
import { rollBattleLoot, LOOT_DROP_CHANCE } from '../../../src/systems/loot'
import { createRng } from '../../../src/systems/rng'
import type { Item, Rarity } from '../../../src/domain/item'
import type { ItemId } from '../../../src/domain/ids'

const gear = (id: string, rarity: Rarity): Item => ({
  id: id as unknown as ItemId, name: id, kind: 'weapon', weaponClass: 'sword',
  rarity, region: 'borderlands', gridSize: { width: 1, height: 2 },
  buyPrice: 100, sellPrice: 50, gearCardIds: [`${id}_a`],
})

const POOL: Item[] = [
  gear('c1', 'common'), gear('c2', 'common'),
  gear('u1', 'uncommon'),
  gear('r1', 'rare'),
  gear('e1', 'epic'),
  // consumable must never drop
  { id: 'food' as unknown as ItemId, name: 'Food', kind: 'food', rarity: 'common', region: 'none', gridSize: { width: 1, height: 1 }, buyPrice: 10, sellPrice: 5 },
]

function sampleRarities(level: number, n: number): Record<string, number> {
  const byId: Record<string, Rarity> = Object.fromEntries(POOL.map(i => [i.id as unknown as string, i.rarity]))
  const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, none: 0 }
  for (let s = 0; s < n; s++) {
    const drops = rollBattleLoot(level, createRng({ seed: s, counter: 0 }), POOL)
    if (drops.length === 0) counts['none'] = (counts['none'] ?? 0) + 1
    else counts[byId[drops[0] as unknown as string]!] = (counts[byId[drops[0] as unknown as string]!] ?? 0) + 1
  }
  return counts
}

describe('rollBattleLoot', () => {
  it('is deterministic for a fixed seed', () => {
    const a = rollBattleLoot(3, createRng({ seed: 42, counter: 0 }), POOL)
    const b = rollBattleLoot(3, createRng({ seed: 42, counter: 0 }), POOL)
    expect(a).toEqual(b)
  })

  it('drops at roughly LOOT_DROP_CHANCE over many seeds', () => {
    const counts = sampleRarities(1, 1000)
    const dropped = 1000 - (counts['none'] ?? 0)
    expect(dropped / 1000).toBeGreaterThan(LOOT_DROP_CHANCE - 0.08)
    expect(dropped / 1000).toBeLessThan(LOOT_DROP_CHANCE + 0.08)
  })

  it('level 1-2 drops only common/uncommon', () => {
    const counts = sampleRarities(2, 500)
    expect(counts['rare']).toBe(0)
    expect(counts['epic']).toBe(0)
    expect(counts['common']).toBeGreaterThan(counts['uncommon'] ?? 0)
  })

  it('level 5+ drops no common, mostly rare', () => {
    const counts = sampleRarities(6, 500)
    expect(counts['common']).toBe(0)
    expect(counts['rare']).toBeGreaterThan(0)
    expect(counts['epic']).toBeGreaterThan(0)
  })

  it('falls through to a lower rarity when the pool lacks the rolled tier', () => {
    const noEpicPool = POOL.filter(i => i.rarity !== 'epic')
    const counts: Record<string, number> = {}
    for (let s = 0; s < 300; s++) {
      const drops = rollBattleLoot(9, createRng({ seed: s, counter: 0 }), noEpicPool)
      for (const d of drops) counts[d as unknown as string] = (counts[d as unknown as string] ?? 0) + 1
    }
    // epic rolls fell through to rare
    expect(counts['e1']).toBeUndefined()
    expect(counts['r1']).toBeGreaterThan(0)
  })

  it('never drops consumables', () => {
    for (let s = 0; s < 200; s++) {
      const drops = rollBattleLoot(1, createRng({ seed: s, counter: 0 }), POOL)
      expect(drops).not.toContain('food')
    }
  })
})
