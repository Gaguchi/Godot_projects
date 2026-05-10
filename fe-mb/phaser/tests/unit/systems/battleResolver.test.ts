import { describe, it, expect } from 'vitest'
import { resolveBattle } from '../../../src/systems/battleResolver'
import { initialCombatState } from '../../../src/systems/combatReducer'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mk = (id: string, cur: number, max: number, classId: string, level = 1): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId(classId), level,
  hp: { current: cur, max }, stats: { str: 0, mag: 0, skl: 0, spd: 0, def: 0, res: 0, lck: 0 },
  position: null, ap: 3, armor: 0, statuses: [],
})

describe('resolveBattle', () => {
  it('victory when all enemies dead', () => {
    const state = initialCombatState()
    state.units[asUnitId('roy') as unknown as string] = mk('roy', 18, 20, 'lord')
    state.units[asUnitId('bandit') as unknown as string] = mk('bandit', 0, 12, 'bandit', 2)
    const r = resolveBattle({
      state, battleId: 'b1',
      partyIds: [asUnitId('roy')],
      enemyIds: [asUnitId('bandit')],
      consumedTravelHop: 3,
    })
    expect(r.outcome).toBe('victory')
    expect(r.goldEarned).toBe(10 + 2 * 5)
    expect(r.fallen).toHaveLength(0)
    expect(r.consumedTravelHop).toBe(3)
  })

  it('defeat when all party dead', () => {
    const state = initialCombatState()
    state.units[asUnitId('roy') as unknown as string] = mk('roy', 0, 20, 'lord')
    state.units[asUnitId('bandit') as unknown as string] = mk('bandit', 5, 12, 'bandit')
    const r = resolveBattle({ state, battleId: 'b', partyIds: [asUnitId('roy')], enemyIds: [asUnitId('bandit')], consumedTravelHop: null })
    expect(r.outcome).toBe('defeat')
    expect(r.fallen).toContain(asUnitId('roy'))
  })

  it('emits UnitDied events for fallen', () => {
    const state = initialCombatState()
    state.units[asUnitId('roy') as unknown as string] = mk('roy', 18, 20, 'lord')
    state.units[asUnitId('marcus') as unknown as string] = mk('marcus', 0, 24, 'cavalier')
    state.units[asUnitId('bandit') as unknown as string] = mk('bandit', 0, 12, 'bandit')
    const r = resolveBattle({ state, battleId: 'b', partyIds: [asUnitId('roy'), asUnitId('marcus')], enemyIds: [asUnitId('bandit')], consumedTravelHop: null })
    const deaths = r.emittedEvents.filter(e => e.type === 'UnitDied')
    expect(deaths).toHaveLength(1)
  })
})
