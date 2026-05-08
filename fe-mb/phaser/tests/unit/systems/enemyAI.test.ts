import { describe, it, expect } from 'vitest'
import { planTurn } from '../../../src/systems/enemyAI'
import { asUnitId } from '../../../src/domain/ids'
import { createRng } from '../../../src/systems/rng'
import type { CombatState } from '../../../src/domain/combatState'

const stubState = (): CombatState => ({
  phase: 'COMBAT', subPhase: 'IDLE',
  turn: { number: 1, unitId: asUnitId('bandit'), team: 'enemy' },
  units: {}, decks: {}, grid: { width: 14, height: 10, obstacles: new Set() },
  rng: { seed: 0, counter: 0 }, selectedCardId: null, effectQueue: [],
})

describe('enemyAI.planTurn (foundation stub)', () => {
  it('emits endTurn for skeleton AI', () => {
    const events = planTurn(stubState(), createRng({ seed: 0, counter: 0 }), asUnitId('bandit'))
    expect(events).toEqual([{ type: 'endTurn' }])
  })
})
