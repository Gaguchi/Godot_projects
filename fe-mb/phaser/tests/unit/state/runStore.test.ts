import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStore } from '../../../src/state/runStore'
import { asUnitId, asNodeId, asFlagKey, asQuestId, asStageId, asClassId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

const mkUnit = (id: string): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId('lord'), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 },
  hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
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
    expect(s.visitedNodes['overworld:test_overworld:pine']).toBe(true)
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
})
