import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStore } from '../../../src/state/runStore'
import { asUnitId, asClassId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

const mkUnit = (id: string, hp = 10, hpMax = 20): Unit => ({
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

describe('restParty (GP-F3)', () => {
  beforeEach(() => {
    useRunStore.getState().__resetForTest()
  })

  it('heals each unit by floor(maxHp * percent), capped at maxHp', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('a', 5, 20) } })
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('b', 18, 20) } })
    dispatch({ type: 'restParty', payload: { percent: 0.3 } })
    // a: 5 + floor(20*0.3)=6 → 11
    expect(useRunStore.getState().party.units['a']!.hp.current).toBe(11)
    // b: 18 + 6 = 24 capped at 20
    expect(useRunStore.getState().party.units['b']!.hp.current).toBe(20)
  })
})
