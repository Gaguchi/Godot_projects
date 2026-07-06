import { describe, it, expect } from 'vitest'
import { seedTutorialBattle } from '../../../src/game/scenes/seedTutorialBattle'
import { reduce, initialCombatState } from '../../../src/systems/combatReducer'
import { createRng } from '../../../src/systems/rng'
import { useMetaStore } from '../../../src/state/metaStore'

describe('seedTutorialBattle (ship plan §12)', () => {
  const event = seedTutorialBattle({ seed: 1, counter: 0 })

  it('is a 5×5 duel: Roy vs one under-statted bandit, tagged tutorial', () => {
    expect(event.payload.grid.width).toBe(5)
    expect(event.payload.grid.height).toBe(5)
    expect(event.payload.battleTag).toBe('tutorial')
    expect(event.payload.units).toHaveLength(2)
    const bandit = event.payload.units.find(u => u.team === 'enemy')!
    expect(bandit.hp.max).toBeLessThanOrEqual(10)
  })

  it('Roy acts first and has his sword deck', () => {
    const s = reduce(initialCombatState(), event, createRng({ seed: 1, counter: 0 })).state
    expect(s.turn.unitId).toBe('roy')
    // deck cycled in: opening hand dealt
    expect(s.decks['roy']!.hand.length).toBeGreaterThan(0)
  })
})

describe('metaStore tutorial + run tallies', () => {
  it('markTutorialSeen persists; recordRunCompleted tallies wins/losses', () => {
    useMetaStore.getState().__reset()
    const d = useMetaStore.getState().dispatch
    expect(useMetaStore.getState().tutorialSeen).toBe(false)
    d({ type: 'markTutorialSeen' })
    expect(useMetaStore.getState().tutorialSeen).toBe(true)
    d({ type: 'recordRunCompleted', payload: { won: true } })
    d({ type: 'recordRunCompleted', payload: { won: false } })
    expect(useMetaStore.getState().runsWon).toBe(1)
    expect(useMetaStore.getState().runsLost).toBe(1)
  })
})
