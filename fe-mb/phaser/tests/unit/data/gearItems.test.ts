import { describe, it, expect } from 'vitest'
import { ItemSchema } from '../../../src/data/schemas'

const base = {
  id: 'iron_sword',
  name: 'Iron Sword',
  rarity: 'common',
  region: 'borderlands',
  gridSize: { width: 1, height: 2 },
  buyPrice: 80,
  sellPrice: 40,
}

describe('gear item schema', () => {
  it('parses a one-handed weapon with gear cards', () => {
    const r = ItemSchema.safeParse({
      ...base,
      kind: 'weapon',
      weaponClass: 'sword',
      gearCardIds: ['iron_sword_slash', 'iron_sword_thrust', 'iron_sword_guard_break'],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.twoHanded ?? false).toBe(false)
      expect(r.data.gearCardIds).toHaveLength(3)
    }
  })

  it('parses a two-handed weapon', () => {
    const r = ItemSchema.safeParse({
      ...base,
      id: 'iron_greatsword',
      kind: 'weapon',
      weaponClass: 'greatsword',
      twoHanded: true,
      gearCardIds: ['gs_a', 'gs_b', 'gs_c', 'gs_d', 'gs_e', 'gs_f'],
    })
    expect(r.success).toBe(true)
  })

  it('parses a shield contributing defense cards', () => {
    const r = ItemSchema.safeParse({
      ...base,
      id: 'iron_buckler',
      kind: 'shield',
      weaponClass: 'shield',
      gearCardIds: ['iron_buckler_block', 'iron_buckler_parry', 'iron_buckler_deflect'],
    })
    expect(r.success).toBe(true)
  })

  it('parses a quiver with a modifier and no cards', () => {
    const r = ItemSchema.safeParse({
      ...base,
      id: 'poison_quiver',
      kind: 'quiver',
      region: 'thornwood',
      rarity: 'uncommon',
      quiverModifier: { kind: 'poison', value: 2, turns: 2 },
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.quiverModifier?.kind).toBe('poison')
  })

  it('parses the standard quiver (no modifier)', () => {
    const r = ItemSchema.safeParse({ ...base, id: 'standard_quiver', kind: 'quiver' })
    expect(r.success).toBe(true)
  })

  it('rejects a gear-kind item without gear cards', () => {
    const r = ItemSchema.safeParse({ ...base, kind: 'weapon', weaponClass: 'sword' })
    expect(r.success).toBe(false)
  })

  it('rejects a quiver that tries to contribute cards', () => {
    const r = ItemSchema.safeParse({
      ...base,
      id: 'bad_quiver',
      kind: 'quiver',
      gearCardIds: ['x'],
    })
    expect(r.success).toBe(false)
  })

  it('still parses consumables (food/potion) without gear fields', () => {
    const r = ItemSchema.safeParse({
      ...base,
      id: 'food_rations',
      kind: 'food',
      region: 'none',
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown quiver modifier kinds', () => {
    const r = ItemSchema.safeParse({
      ...base,
      id: 'weird_quiver',
      kind: 'quiver',
      quiverModifier: { kind: 'lightning', value: 3, turns: 1 },
    })
    expect(r.success).toBe(false)
  })
})
