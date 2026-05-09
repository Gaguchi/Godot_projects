import { describe, it, expect } from 'vitest'
import { reproduceCombatAction } from '../../../src/persistence/replay'
import { initialCombatState, reduce } from '../../../src/systems/combatReducer'
import { createRng } from '../../../src/systems/rng'
import { asUnitId, asClassId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

const mk = (id: string, spd: number): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId('lord'), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd, def: 3, res: 1 },
  position: null, ap: 3, armor: 0, statuses: [],
})

describe('reproduceCombatAction', () => {
  it('produces same after-state as direct reduce', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const start = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('a', 5)], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state

    const direct = reduce(start, { type: 'endTurn' }, rng).state
    const replayed = reproduceCombatAction(start, { type: 'endTurn' }).after

    expect(replayed.turn).toEqual(direct.turn)
  })
})
