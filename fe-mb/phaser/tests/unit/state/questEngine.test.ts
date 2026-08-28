import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStore } from '../../../src/state/runStore'
import {
  bootstrapQuests, getQuestEngine, settleQuests, handleDomainEvent, attachQuestEngine,
  __setQuestEngineForTest,
} from '../../../src/state/questEngine'
import { createEventBus } from '../../../src/state/eventBus'
import { asQuestId, asStageId, asMapId, asNodeId } from '../../../src/domain/ids'
import type { QuestDef } from '../../../src/domain/quest'

describe('quest engine wiring', () => {
  beforeEach(() => {
    useRunStore.getState().__resetForTest()
    bootstrapQuests()
  })

  it('registers the shipped quests', () => {
    expect(Object.keys(getQuestEngine().quests).sort())
      .toEqual(['sq_blood_ties', 'sq_missing_caravan'])
  })

  it('advances Blood Ties when the world sets the flag — no dialogue involved', () => {
    // This is the behaviour that never worked: the quest JSON has always had a
    // transition from find_daren on `daren_captured`, and nothing evaluated it.
    const store = useRunStore.getState()
    store.dispatch({
      type: 'advanceQuestStage',
      payload: { questId: asQuestId('sq_blood_ties'), toStage: asStageId('find_daren') },
    })
    expect(useRunStore.getState().questStates['sq_blood_ties']?.currentStage).toBe('find_daren')

    // Nothing has happened yet, so nothing should move.
    expect(settleQuests()).toBe(0)

    store.dispatch({ type: 'setFlag', payload: { key: 'daren_captured' as never, value: true } })
    expect(settleQuests()).toBeGreaterThan(0)
    expect(useRunStore.getState().questStates['sq_blood_ties']?.currentStage).toBe('daren_resolved')
  })

  it('runs a chain of transitions to a fixed point in one settle', () => {
    const chain: QuestDef = {
      id: asQuestId('q_chain'),
      name: 'Chain',
      initialStage: asStageId('a'),
      stages: {
        a: { id: asStageId('a'), onEnter: [], onExit: [], listeners: [], transitions: [{ when: { kind: 'always' }, to: asStageId('b') }] },
        b: { id: asStageId('b'), onEnter: [], onExit: [], listeners: [], transitions: [{ when: { kind: 'always' }, to: asStageId('c') }] },
        c: { id: asStageId('c'), onEnter: [], onExit: [], listeners: [], transitions: [] },
      },
    } as unknown as QuestDef
    __setQuestEngineForTest({ quests: { q_chain: chain } })

    useRunStore.getState().dispatch({
      type: 'advanceQuestStage',
      payload: { questId: asQuestId('q_chain'), toStage: asStageId('a') },
    })
    settleQuests()
    expect(useRunStore.getState().questStates['q_chain']?.currentStage).toBe('c')
  })

  it('does not hang on a stage cycle', () => {
    const cycle: QuestDef = {
      id: asQuestId('q_cycle'),
      name: 'Cycle',
      initialStage: asStageId('x'),
      stages: {
        x: { id: asStageId('x'), onEnter: [], onExit: [], listeners: [], transitions: [{ when: { kind: 'always' }, to: asStageId('y') }] },
        y: { id: asStageId('y'), onEnter: [], onExit: [], listeners: [], transitions: [{ when: { kind: 'always' }, to: asStageId('x') }] },
      },
    } as unknown as QuestDef
    __setQuestEngineForTest({ quests: { q_cycle: cycle } })
    useRunStore.getState().dispatch({
      type: 'advanceQuestStage',
      payload: { questId: asQuestId('q_cycle'), toStage: asStageId('x') },
    })
    // Bounded, so this returns rather than spinning.
    const applied = settleQuests()
    expect(applied).toBeLessThanOrEqual(8)
  })

  it('fires a stage listener from a domain event', () => {
    const onArrival: QuestDef = {
      id: asQuestId('q_arrive'),
      name: 'Arrive',
      initialStage: asStageId('travel'),
      stages: {
        travel: {
          id: asStageId('travel'),
          onEnter: [], onExit: [],
          listeners: [{
            on: 'LocationArrived',
            predicate: { kind: 'always' },
            emit: [{ kind: 'addGold', amount: 25 }],
          }],
          transitions: [],
        },
      },
    } as unknown as QuestDef
    __setQuestEngineForTest({ quests: { q_arrive: onArrival } })
    useRunStore.getState().dispatch({
      type: 'advanceQuestStage',
      payload: { questId: asQuestId('q_arrive'), toStage: asStageId('travel') },
    })

    const goldBefore = useRunStore.getState().gold
    handleDomainEvent({
      type: 'LocationArrived',
      payload: { nodeRef: { mapKind: 'overworld', mapId: asMapId('borderlands'), nodeId: asNodeId('pine_crossing') } },
    })
    expect(useRunStore.getState().gold).toBe(goldBefore + 25)
  })

  it('attaches to a bus and detaches cleanly', () => {
    const bus = createEventBus()
    const detach = attachQuestEngine(bus)

    const onArrival: QuestDef = {
      id: asQuestId('q_bus'),
      name: 'Bus',
      initialStage: asStageId('s'),
      stages: {
        s: {
          id: asStageId('s'), onEnter: [], onExit: [],
          listeners: [{ on: 'LocationArrived', predicate: { kind: 'always' }, emit: [{ kind: 'addGold', amount: 10 }] }],
          transitions: [],
        },
      },
    } as unknown as QuestDef
    __setQuestEngineForTest({ quests: { q_bus: onArrival } })
    useRunStore.getState().dispatch({
      type: 'advanceQuestStage',
      payload: { questId: asQuestId('q_bus'), toStage: asStageId('s') },
    })

    const ev = {
      type: 'LocationArrived' as const,
      payload: { nodeRef: { mapKind: 'overworld' as const, mapId: asMapId('borderlands'), nodeId: asNodeId('n') } },
    }
    const before = useRunStore.getState().gold
    bus.emit(ev)
    expect(useRunStore.getState().gold).toBe(before + 10)

    detach()
    bus.emit(ev)
    expect(useRunStore.getState().gold).toBe(before + 10) // unchanged
  })
})
