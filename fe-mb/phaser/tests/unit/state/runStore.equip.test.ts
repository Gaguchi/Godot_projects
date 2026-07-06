import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStore } from '../../../src/state/runStore'
import { asUnitId, asItemId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

/**
 * Store-level equip/unequip coverage. Uses real gear ids from items.json
 * (iron_sword / iron_buckler / iron_greatsword) — content lands with story 453,
 * seeded here via buyItem-free direct hydration (hydrateFromSave is the
 * sanctioned test entry for arbitrary bags).
 */

const roy = (): Unit => ({
  id: asUnitId('roy'),
  name: 'Roy',
  classId: 'lord' as never,
  level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 4 },
  position: null,
  ap: 3,
  armor: 0,
  statuses: [],
})

function seed(bagIds: string[]): void {
  useRunStore.getState().__resetForTest()
  useRunStore.getState().dispatch({
    type: 'hydrateFromSave',
    payload: {
      gold: 100,
      worldPosition: { mapId: 'borderlands', nodeId: 'start' },
      partyUnits: [roy() as unknown as { id: string }],
      partyOrder: ['roy'],
      inventoryItems: bagIds.map((id, i) => ({ itemId: id, gridX: i, gridY: 0 })),
    },
  })
}

describe('runStore equipItem / unequipItem', () => {
  beforeEach(() => seed(['iron_sword', 'iron_buckler']))

  it('equips from the bag into a hand slot atomically', () => {
    useRunStore.getState().dispatch({
      type: 'equipItem',
      payload: { unitId: asUnitId('roy'), itemId: asItemId('iron_sword'), slot: 'left' },
    })
    const s = useRunStore.getState()
    expect(s.party.units['roy']?.handLeft).toBe('iron_sword')
    expect(s.inventory.items.some(i => (i.itemId as unknown as string) === 'iron_sword')).toBe(false)
  })

  it('unequips back to the bag', () => {
    const d = useRunStore.getState().dispatch
    d({ type: 'equipItem', payload: { unitId: asUnitId('roy'), itemId: asItemId('iron_sword'), slot: 'left' } })
    d({ type: 'unequipItem', payload: { unitId: asUnitId('roy'), slot: 'left' } })
    const s = useRunStore.getState()
    expect(s.party.units['roy']?.handLeft ?? null).toBeNull()
    expect(s.inventory.items.some(i => (i.itemId as unknown as string) === 'iron_sword')).toBe(true)
  })

  it('no-ops for an unknown unit', () => {
    const before = useRunStore.getState().inventory.items.length
    useRunStore.getState().dispatch({
      type: 'equipItem',
      payload: { unitId: asUnitId('ghost'), itemId: asItemId('iron_sword'), slot: 'left' },
    })
    expect(useRunStore.getState().inventory.items.length).toBe(before)
  })

  it('no-ops when the plan is rejected (item not in bag)', () => {
    useRunStore.getState().dispatch({
      type: 'equipItem',
      payload: { unitId: asUnitId('roy'), itemId: asItemId('iron_greatsword'), slot: 'left' },
    })
    expect(useRunStore.getState().party.units['roy']?.handLeft ?? null).toBeNull()
  })

  it('2H equip clears both hands and locks right (integration through the store)', () => {
    seed(['iron_sword', 'iron_buckler', 'iron_greatsword'])
    const d = useRunStore.getState().dispatch
    d({ type: 'equipItem', payload: { unitId: asUnitId('roy'), itemId: asItemId('iron_sword'), slot: 'left' } })
    d({ type: 'equipItem', payload: { unitId: asUnitId('roy'), itemId: asItemId('iron_buckler'), slot: 'right' } })
    d({ type: 'equipItem', payload: { unitId: asUnitId('roy'), itemId: asItemId('iron_greatsword'), slot: 'left' } })
    const u = useRunStore.getState().party.units['roy']
    expect(u?.handLeft).toBe('iron_greatsword')
    expect(u?.handRight ?? null).toBeNull()
    const bagIds = useRunStore.getState().inventory.items.map(i => i.itemId as unknown as string)
    expect(bagIds).toContain('iron_sword')
    expect(bagIds).toContain('iron_buckler')
  })
})
