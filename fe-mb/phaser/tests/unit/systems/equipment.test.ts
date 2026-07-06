import { describe, it, expect } from 'vitest'
import { planEquip, planUnequip, BAG_WIDTH, BAG_HEIGHT } from '../../../src/systems/equipment'
import type { Item } from '../../../src/domain/item'
import type { ItemId } from '../../../src/domain/ids'

const iid = (s: string): ItemId => s as unknown as ItemId

const CATALOG: Record<string, Item> = {
  iron_sword: {
    id: iid('iron_sword'), name: 'Iron Sword', kind: 'weapon', weaponClass: 'sword',
    rarity: 'common', region: 'borderlands', gridSize: { width: 1, height: 2 },
    buyPrice: 80, sellPrice: 40, gearCardIds: ['iron_sword_slash'],
  },
  iron_buckler: {
    id: iid('iron_buckler'), name: 'Iron Buckler', kind: 'shield', weaponClass: 'shield',
    rarity: 'common', region: 'borderlands', gridSize: { width: 1, height: 1 },
    buyPrice: 60, sellPrice: 30, gearCardIds: ['iron_buckler_block'],
  },
  iron_greatsword: {
    id: iid('iron_greatsword'), name: 'Iron Greatsword', kind: 'weapon', weaponClass: 'greatsword',
    twoHanded: true, rarity: 'common', region: 'borderlands', gridSize: { width: 2, height: 3 },
    buyPrice: 150, sellPrice: 75, gearCardIds: ['gs_heavy_slash'],
  },
  food_rations: {
    id: iid('food_rations'), name: 'Food Rations', kind: 'food',
    rarity: 'common', region: 'none', gridSize: { width: 1, height: 2 },
    buyPrice: 50, sellPrice: 25,
  },
}
const lookup = (id: ItemId): Item | undefined => CATALOG[id as unknown as string]

type Bag = { itemId: ItemId; gridX: number; gridY: number }[]
const bagWith = (...ids: string[]): Bag => ids.map((id, i) => ({ itemId: iid(id), gridX: i % BAG_WIDTH, gridY: Math.floor(i / BAG_WIDTH) }))

describe('planEquip', () => {
  it('equips a 1H item from the bag into an empty left slot', () => {
    const r = planEquip({ handLeft: null, handRight: null }, 'left', iid('iron_sword'), bagWith('iron_sword'), lookup)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.handLeft).toBe(iid('iron_sword'))
      expect(r.handRight).toBeNull()
      expect(r.bag.some(b => b.itemId === iid('iron_sword'))).toBe(false)
    }
  })

  it('equips a 1H item into the right slot', () => {
    const r = planEquip({ handLeft: iid('iron_sword'), handRight: null }, 'right', iid('iron_buckler'), bagWith('iron_buckler'), lookup)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handRight).toBe(iid('iron_buckler'))
  })

  it('swap: equipping over an occupied slot returns the old item to the bag', () => {
    const r = planEquip({ handLeft: iid('iron_sword'), handRight: null }, 'left', iid('iron_greatsword'), bagWith('iron_greatsword'), lookup)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.handLeft).toBe(iid('iron_greatsword'))
      expect(r.bag.some(b => b.itemId === iid('iron_sword'))).toBe(true)
      expect(r.bag.some(b => b.itemId === iid('iron_greatsword'))).toBe(false)
    }
  })

  it('2H equips into LEFT regardless of requested slot and clears both hands to bag', () => {
    const r = planEquip(
      { handLeft: iid('iron_sword'), handRight: iid('iron_buckler') },
      'right', iid('iron_greatsword'), bagWith('iron_greatsword'), lookup,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.handLeft).toBe(iid('iron_greatsword'))
      expect(r.handRight).toBeNull()
      expect(r.bag.filter(b => ['iron_sword', 'iron_buckler'].includes(b.itemId as unknown as string))).toHaveLength(2)
    }
  })

  it('rejects equipping a 1H item into the right slot while left holds a 2H weapon', () => {
    const r = planEquip({ handLeft: iid('iron_greatsword'), handRight: null }, 'right', iid('iron_buckler'), bagWith('iron_buckler'), lookup)
    expect(r.ok).toBe(false)
  })

  it('replacing a 2H in LEFT with a 1H unlocks the right slot', () => {
    const r = planEquip({ handLeft: iid('iron_greatsword'), handRight: null }, 'left', iid('iron_sword'), bagWith('iron_sword'), lookup)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.handLeft).toBe(iid('iron_sword'))
      expect(r.handRight).toBeNull()
      expect(r.bag.some(b => b.itemId === iid('iron_greatsword'))).toBe(true)
    }
  })

  it('rejects non-gear items', () => {
    const r = planEquip({ handLeft: null, handRight: null }, 'left', iid('food_rations'), bagWith('food_rations'), lookup)
    expect(r.ok).toBe(false)
  })

  it('rejects items not present in the bag', () => {
    const r = planEquip({ handLeft: null, handRight: null }, 'left', iid('iron_sword'), [], lookup)
    expect(r.ok).toBe(false)
  })

  it('rejects a 2H equip when the returned items cannot fit in a full bag', () => {
    // Fill the bag completely, then put sword+buckler in hands. Equipping the
    // 2H (removes 1 from bag, returns 2) needs one net free cell → none.
    const full: Bag = []
    for (let y = 0; y < BAG_HEIGHT; y++) for (let x = 0; x < BAG_WIDTH; x++) full.push({ itemId: iid('food_rations'), gridX: x, gridY: y })
    full[0] = { itemId: iid('iron_greatsword'), gridX: 0, gridY: 0 }
    const r = planEquip({ handLeft: iid('iron_sword'), handRight: iid('iron_buckler') }, 'left', iid('iron_greatsword'), full, lookup)
    expect(r.ok).toBe(false)
  })

  it('does not mutate the input bag array', () => {
    const bag = bagWith('iron_sword')
    const snapshot = JSON.stringify(bag)
    planEquip({ handLeft: null, handRight: null }, 'left', iid('iron_sword'), bag, lookup)
    expect(JSON.stringify(bag)).toBe(snapshot)
  })
})

describe('planUnequip', () => {
  it('returns the item to the first free bag cell', () => {
    const r = planUnequip({ handLeft: iid('iron_sword'), handRight: null }, 'left', bagWith('food_rations'), lookup)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.handLeft).toBeNull()
      expect(r.bag.some(b => b.itemId === iid('iron_sword'))).toBe(true)
    }
  })

  it('no-ops on an empty slot', () => {
    const r = planUnequip({ handLeft: null, handRight: null }, 'left', [], lookup)
    expect(r.ok).toBe(false)
  })

  it('rejects when the bag is full', () => {
    const full: Bag = []
    for (let y = 0; y < BAG_HEIGHT; y++) for (let x = 0; x < BAG_WIDTH; x++) full.push({ itemId: iid('food_rations'), gridX: x, gridY: y })
    const r = planUnequip({ handLeft: iid('iron_sword'), handRight: null }, 'left', full, lookup)
    expect(r.ok).toBe(false)
  })
})
