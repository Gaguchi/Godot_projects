import { describe, it, expect, beforeEach } from 'vitest'
import { useCombatStore } from '../../../src/state/combatStore'
import { createRng } from '../../../src/systems/rng'
import { asUnitId, asClassId } from '../../../src/domain/ids'

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

describe('combatStore reducer wiring', () => {
  beforeEach(() => useCombatStore.getState().__resetForTest())

  it('dispatch advances state per reducer', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    useCombatStore.getState().dispatch({
      type: 'startBattle',
      payload: {
        units: [{
          id: asUnitId('roy'), name: 'Roy', classId: asClassId('lord'), level: 1,
          hp: { current: 20, max: 20 },
          stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 },
          hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
        }],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 1, counter: 0 },
      },
    }, rng)
    expect(useCombatStore.getState().state.phase).toBe('COMBAT')
  })

  it('dispatch accumulates effects from reducer in queue', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    // playCard returns [WaitForAnimations] in foundation
    useCombatStore.getState().dispatch({ type: 'playCard', payload: { cardId: 'slash' as never, srcId: asUnitId('roy'), targets: [] } }, rng)
    expect(useCombatStore.getState().effectQueue.length).toBeGreaterThan(0)
  })
})
