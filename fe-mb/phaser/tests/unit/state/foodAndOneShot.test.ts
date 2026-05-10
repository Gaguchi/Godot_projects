import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStore } from '../../../src/state/runStore'
import { asUnitId, asClassId, asItemId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

const mkUnit = (id: string, hp = 20, hpMax = 20): Unit => ({
  id: asUnitId(id),
  name: id,
  classId: asClassId('lord'),
  level: 1,
  hp: { current: hp, max: hpMax },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 0 },
  position: null,
  ap: 3,
  armor: 0,
  statuses: [],
})

describe('runStore food + one-shot (GP-C5+C6)', () => {
  beforeEach(() => {
    useRunStore.getState().__resetForTest()
  })

  it('consumeFoodPerHop with food in bag removes one food_rations', () => {
    const { dispatch } = useRunStore.getState()
    useRunStore.setState({
      inventory: { items: [
        { itemId: asItemId('food_rations'), gridX: 0, gridY: 0 },
        { itemId: asItemId('food_rations'), gridX: 1, gridY: 0 },
      ] },
    })
    dispatch({ type: 'consumeFoodPerHop' })
    expect(useRunStore.getState().inventory.items.length).toBe(1)
  })

  it('consumeFoodPerHop with no food deals starvation damage to each living unit', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('a', 20, 20) } })
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('b', 5, 20) } })
    dispatch({ type: 'consumeFoodPerHop' })
    // Default starvation = 3 HP/hop
    expect(useRunStore.getState().party.units['a']!.hp.current).toBe(17)
    expect(useRunStore.getState().party.units['b']!.hp.current).toBe(2)
  })

  it('consumeFoodPerHop with no food does not damage dead units below 0', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('a', 0, 20) } })
    dispatch({ type: 'consumeFoodPerHop' })
    expect(useRunStore.getState().party.units['a']!.hp.current).toBe(0)
  })

  it('markEncounterFired adds id to oneShotsFired set', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'markEncounterFired', payload: { encounterId: 'sq_blood_ties_encounter' } })
    expect(useRunStore.getState().oneShotsFired.has('sq_blood_ties_encounter')).toBe(true)
  })
})
