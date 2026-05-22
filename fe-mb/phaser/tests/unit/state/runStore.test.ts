import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStore } from '../../../src/state/runStore'
import { asUnitId, asNodeId, asFlagKey, asQuestId, asStageId, asClassId, asItemId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

const mkUnit = (id: string): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId('lord'), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 0 },
  position: null, ap: 3, armor: 0, statuses: [],
})

describe('runStore', () => {
  beforeEach(() => useRunStore.getState().__resetForTest())

  it('recruitUnit adds to party + partyOrder', () => {
    useRunStore.getState().dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('roy') } })
    const s = useRunStore.getState()
    expect(s.party.units[asUnitId('roy') as unknown as string]).toBeDefined()
    expect(s.party.partyOrder).toContain(asUnitId('roy'))
  })

  it('addGold accumulates', () => {
    const d = useRunStore.getState().dispatch
    d({ type: 'addGold', payload: { amount: 10 } })
    d({ type: 'addGold', payload: { amount: 25 } })
    expect(useRunStore.getState().gold).toBe(35)
  })

  it('arriveAtNode updates worldPosition + visitedNodes', () => {
    useRunStore.getState().dispatch({ type: 'arriveAtNode', payload: { nodeId: asNodeId('pine') } })
    const s = useRunStore.getState()
    expect(s.worldPosition.nodeId).toBe(asNodeId('pine'))
    // Default starting map is 'borderlands' (matches the new region maps from GP-D1)
    expect(s.visitedNodes['overworld:borderlands:pine']).toBe(true)
  })

  it('setFlag delegates to flag store with scope', () => {
    useRunStore.getState().dispatch({ type: 'setFlag', payload: { key: asFlagKey('q.x'), value: 42, scope: 'quest' } })
    expect(useRunStore.getState().flags.get(asFlagKey('q.x'))).toBe(42)
  })

  it('clearFlagsByScope', () => {
    const d = useRunStore.getState().dispatch
    d({ type: 'setFlag', payload: { key: asFlagKey('a'), value: 1, scope: 'battle' } })
    d({ type: 'setFlag', payload: { key: asFlagKey('b'), value: 1, scope: 'run' } })
    d({ type: 'clearFlagsByScope', payload: { scope: 'battle' } })
    expect(useRunStore.getState().flags.has(asFlagKey('a'))).toBe(false)
    expect(useRunStore.getState().flags.has(asFlagKey('b'))).toBe(true)
  })

  it('advanceQuestStage updates questStates', () => {
    useRunStore.getState().dispatch({ type: 'advanceQuestStage', payload: { questId: asQuestId('blood_ties'), toStage: asStageId('stage_2') } })
    expect(useRunStore.getState().questStates['blood_ties']?.currentStage).toBe('stage_2')
  })

  describe('hydrateFromSave', () => {
    it('restores gold, worldPosition, party, inventory in one atomic update', () => {
      const d = useRunStore.getState().dispatch
      d({
        type: 'hydrateFromSave',
        payload: {
          gold: 250,
          worldPosition: { mapId: 'borderlands', nodeId: 'pine_crossing' },
          partyUnits: [mkUnit('roy') as unknown as { id: string; [k: string]: unknown }],
          partyOrder: ['roy'],
          inventoryItems: [{ itemId: 'iron_sword', gridX: 2, gridY: 1 }],
        },
      })
      const s = useRunStore.getState()
      expect(s.gold).toBe(250)
      expect((s.worldPosition.nodeId as unknown as string)).toBe('pine_crossing')
      expect(s.party.partyOrder.map((u) => u as unknown as string)).toEqual(['roy'])
      expect(s.party.units[asUnitId('roy') as unknown as string]).toBeDefined()
      expect(s.inventory.items).toEqual([
        { itemId: 'iron_sword', gridX: 2, gridY: 1 },
      ])
    })
  })

  describe('sweepFallenUnits', () => {
    it('removes units from party.units and party.partyOrder', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'recruitUnit', payload: { unit: mkUnit('roy') } })
      d({ type: 'recruitUnit', payload: { unit: mkUnit('marcus') } })
      d({ type: 'recruitUnit', payload: { unit: mkUnit('lilina') } })
      d({ type: 'sweepFallenUnits', payload: { unitIds: [asUnitId('marcus')] } })
      const s = useRunStore.getState()
      expect(s.party.units[asUnitId('marcus') as unknown as string]).toBeUndefined()
      expect(s.party.units[asUnitId('roy') as unknown as string]).toBeDefined()
      expect(s.party.partyOrder.map((u) => u as unknown as string)).toEqual(['roy', 'lilina'])
    })

    it('is a no-op when unitIds list is empty', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'recruitUnit', payload: { unit: mkUnit('roy') } })
      d({ type: 'sweepFallenUnits', payload: { unitIds: [] } })
      const s = useRunStore.getState()
      expect(s.party.partyOrder).toHaveLength(1)
    })

    it('silently skips unitIds not in party (idempotent)', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'recruitUnit', payload: { unit: mkUnit('roy') } })
      d({ type: 'sweepFallenUnits', payload: { unitIds: [asUnitId('not_in_party')] } })
      const s = useRunStore.getState()
      expect(s.party.partyOrder).toHaveLength(1)
      expect(s.party.units[asUnitId('roy') as unknown as string]).toBeDefined()
    })
  })

  describe('buyItem', () => {
    it('deducts gold and places item in first empty 1x1 slot (0,0)', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'addGold', payload: { amount: 100 } })
      d({ type: 'buyItem', payload: { itemId: asItemId('iron_sword'), price: 50 } })
      const s = useRunStore.getState()
      expect(s.gold).toBe(50)
      expect(s.inventory.items).toEqual([
        { itemId: asItemId('iron_sword'), gridX: 0, gridY: 0 },
      ])
    })

    it('is a no-op when gold is insufficient', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'addGold', payload: { amount: 10 } })
      d({ type: 'buyItem', payload: { itemId: asItemId('iron_sword'), price: 50 } })
      const s = useRunStore.getState()
      expect(s.gold).toBe(10)
      expect(s.inventory.items).toEqual([])
    })

    it('places second item at next empty slot when (0,0) is occupied', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'addGold', payload: { amount: 100 } })
      d({ type: 'buyItem', payload: { itemId: asItemId('iron_sword'), price: 10 } })
      d({ type: 'buyItem', payload: { itemId: asItemId('vulnerary'), price: 20 } })
      const s = useRunStore.getState()
      expect(s.gold).toBe(70)
      expect(s.inventory.items).toEqual([
        { itemId: asItemId('iron_sword'), gridX: 0, gridY: 0 },
        { itemId: asItemId('vulnerary'), gridX: 1, gridY: 0 },
      ])
    })

    it('is a no-op when the bag is full (8x4 = 32 slots occupied)', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'addGold', payload: { amount: 10000 } })
      // Fill all 32 slots.
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 8; x++) {
          d({ type: 'buyItem', payload: { itemId: asItemId('vulnerary'), price: 1 } })
        }
      }
      const goldAfterFill = useRunStore.getState().gold
      d({ type: 'buyItem', payload: { itemId: asItemId('iron_sword'), price: 50 } })
      const s = useRunStore.getState()
      expect(s.gold).toBe(goldAfterFill) // no gold spent
      expect(s.inventory.items).toHaveLength(32) // not 33
    })
  })

  describe('sellItem', () => {
    it('removes item from inventory and adds sellPrice to gold', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'addGold', payload: { amount: 100 } })
      d({ type: 'buyItem', payload: { itemId: asItemId('iron_sword'), price: 50 } })
      d({ type: 'sellItem', payload: { itemId: asItemId('iron_sword'), sellPrice: 20 } })
      const s = useRunStore.getState()
      expect(s.gold).toBe(70) // 100 - 50 + 20
      expect(s.inventory.items).toEqual([])
    })

    it('is a no-op when item not in inventory', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'addGold', payload: { amount: 100 } })
      d({ type: 'sellItem', payload: { itemId: asItemId('iron_sword'), sellPrice: 20 } })
      const s = useRunStore.getState()
      expect(s.gold).toBe(100) // unchanged
      expect(s.inventory.items).toEqual([])
    })

    it('removes only the first matching instance when duplicates exist', () => {
      const d = useRunStore.getState().dispatch
      d({ type: 'addGold', payload: { amount: 100 } })
      d({ type: 'buyItem', payload: { itemId: asItemId('vulnerary'), price: 5 } })
      d({ type: 'buyItem', payload: { itemId: asItemId('vulnerary'), price: 5 } })
      d({ type: 'sellItem', payload: { itemId: asItemId('vulnerary'), sellPrice: 2 } })
      const s = useRunStore.getState()
      expect(s.gold).toBe(92) // 100 - 5 - 5 + 2
      expect(s.inventory.items).toHaveLength(1) // one vulnerary left
    })
  })
})
