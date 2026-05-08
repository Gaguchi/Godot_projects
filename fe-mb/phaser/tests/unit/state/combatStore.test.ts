import { describe, it, expect, beforeEach } from 'vitest'
import { useCombatStore } from '../../../src/state/combatStore'
import { createRng } from '../../../src/systems/rng'

describe('combatStore (stub plumbing)', () => {
  beforeEach(() => useCombatStore.getState().__resetForTest())

  it('lastEffectId increments on dispatch', () => {
    const before = useCombatStore.getState().lastEffectId
    useCombatStore.getState().dispatch({ type: 'endTurn' }, createRng({ seed: 0, counter: 0 }))
    expect(useCombatStore.getState().lastEffectId).toBe(before + 1)
  })

  it('drainEffects returns and clears queue', () => {
    useCombatStore.setState({ effectQueue: [{ kind: 'WaitForAnimations' }] })
    const drained = useCombatStore.getState().drainEffects()
    expect(drained.length).toBe(1)
    expect(useCombatStore.getState().effectQueue.length).toBe(0)
  })
})
