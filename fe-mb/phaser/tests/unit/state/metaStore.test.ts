import { describe, it, expect, beforeEach } from 'vitest'
import { useMetaStore } from '../../../src/state/metaStore'

describe('metaStore', () => {
  beforeEach(() => useMetaStore.getState().__reset())

  it('starts un-started, 0 runs', () => {
    expect(useMetaStore.getState().gameStarted).toBe(false)
    expect(useMetaStore.getState().totalRuns).toBe(0)
  })

  it('startNewRun marks gameStarted, increments totalRuns', () => {
    useMetaStore.getState().dispatch({ type: 'startNewRun' })
    expect(useMetaStore.getState().gameStarted).toBe(true)
    expect(useMetaStore.getState().totalRuns).toBe(1)
  })

  it('recordRunCompleted is a no-op for skeletal store (will track wins later)', () => {
    useMetaStore.getState().dispatch({ type: 'startNewRun' })
    useMetaStore.getState().dispatch({ type: 'recordRunCompleted', payload: { won: true } })
    expect(useMetaStore.getState().gameStarted).toBe(true)
  })
})
