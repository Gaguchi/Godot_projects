import { describe, it, expect } from 'vitest'
import { shopStockFor } from '../../../src/systems/shopStock'
import itemsJson from '../../../src/data/content/items.json'
import type { Item } from '../../../src/domain/item'

const ITEMS = itemsJson as unknown as Item[]
const town = (regionId: string) => ({ regionId, shopStockIds: [] as string[] })

describe('shopStockFor (regional rarity gates, ship plan §5)', () => {
  it('Borderlands shops stock only common + uncommon', () => {
    const stock = shopStockFor(town('borderlands'), ITEMS)
    expect(stock.length).toBeGreaterThan(0)
    for (const i of stock) {
      expect(['common', 'uncommon']).toContain(i.rarity)
    }
  })

  it('Thornwood shops stock only uncommon + rare, thornwood-region gear', () => {
    const stock = shopStockFor(town('thornwood'), ITEMS)
    expect(stock.length).toBeGreaterThan(0)
    for (const i of stock) {
      expect(['uncommon', 'rare', 'common']).toContain(i.rarity)
      if (i.region === 'thornwood') expect(['uncommon', 'rare']).toContain(i.rarity)
      // only region-less consumables may fall outside the gate
      if (i.rarity === 'common') expect(i.region).toBe('none')
    }
  })

  it('Ashfall shops stock uncommon + rare', () => {
    const stock = shopStockFor(town('ashfall'), ITEMS)
    const gear = stock.filter(i => i.region === 'ashfall')
    expect(gear.length).toBeGreaterThan(0)
    for (const i of gear) expect(['uncommon', 'rare']).toContain(i.rarity)
  })

  it('never stocks epic or legendary', () => {
    for (const region of ['borderlands', 'thornwood', 'ashfall']) {
      for (const i of shopStockFor(town(region), ITEMS)) {
        expect(['epic', 'legendary']).not.toContain(i.rarity)
      }
    }
  })

  it('no cross-region gear leaks', () => {
    const stock = shopStockFor(town('borderlands'), ITEMS)
    for (const i of stock) {
      expect(i.region === 'borderlands' || i.region === 'none').toBe(true)
    }
  })

  it('consumables are sold everywhere', () => {
    for (const region of ['borderlands', 'thornwood', 'ashfall']) {
      const stock = shopStockFor(town(region), ITEMS)
      expect(stock.some(i => i.kind === 'food')).toBe(true)
    }
  })
})
