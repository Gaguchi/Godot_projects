import { describe, it, expect } from 'vitest'
import { onDomainEvent, transitionStages, type QuestEngineState } from '../../../src/systems/questRunner'
import type { QuestDef } from '../../../src/domain/quest'
import type { DomainEvent } from '../../../src/contracts'
import type { PredicateState } from '../../../src/systems/predicates'
import { asQuestId, asStageId, asFlagKey, asUnitId } from '../../../src/domain/ids'

const bloodTies: QuestDef = {
  id: asQuestId('blood_ties'),
  name: 'Blood Ties',
  initialStage: asStageId('start'),
  stages: {
    start: {
      id: asStageId('start'),
      onEnter: [{ kind: 'setFlag', key: asFlagKey('blood_ties.started'), value: true }],
      listeners: [{
        on: 'BattleVictory',
        predicate: { kind: 'always' },
        emit: [{ kind: 'setFlag', key: asFlagKey('blood_ties.daren_killed'), value: true }],
      }],
      transitions: [{
        when: { kind: 'flag', key: asFlagKey('blood_ties.daren_killed') },
        to: asStageId('end'),
      }],
      onExit: [],
    },
    end: {
      id: asStageId('end'),
      onEnter: [{ kind: 'completeQuest', questId: asQuestId('blood_ties') }],
      listeners: [], transitions: [], onExit: [],
    },
  },
}

const baseState = (): PredicateState => ({
  flags: new Map(),
  questStates: { 'blood_ties': { currentStage: 'start', metadata: {} } },
  party: { units: {} },
  inventory: { items: [] },
  gold: 0,
  visitedNodes: new Set(),
  clearedEncounters: new Set(),
})

describe('questRunner.onDomainEvent', () => {
  it('emits effects from matching listener at current stage', () => {
    const eng: QuestEngineState = { quests: { 'blood_ties': bloodTies } }
    const evt: DomainEvent = { type: 'BattleVictory', payload: { battleId: 'b', survivors: [], capturedIds: [asUnitId('daren')] } }
    const r = onDomainEvent(evt, eng, baseState())
    expect(r.effects.length).toBe(1)
    expect(r.effects[0]).toMatchObject({ kind: 'setFlag', key: 'blood_ties.daren_killed' })
  })

  it('skips listener when predicate fails', () => {
    const guarded: QuestDef = {
      ...bloodTies,
      stages: {
        ...bloodTies.stages,
        start: {
          ...bloodTies.stages.start!,
          listeners: [{
            on: 'BattleVictory',
            predicate: { kind: 'never' },
            emit: [{ kind: 'setFlag', key: asFlagKey('x'), value: 1 }],
          }],
        },
      },
    }
    const eng: QuestEngineState = { quests: { 'blood_ties': guarded } }
    const evt: DomainEvent = { type: 'BattleVictory', payload: { battleId: 'b', survivors: [], capturedIds: [] } }
    const r = onDomainEvent(evt, eng, baseState())
    expect(r.effects.length).toBe(0)
  })

  it('does not fire listeners from inactive stages', () => {
    const eng: QuestEngineState = { quests: { 'blood_ties': bloodTies } }
    const state = baseState()
    state.questStates['blood_ties']!.currentStage = 'end'
    const r = onDomainEvent({ type: 'BattleVictory', payload: { battleId: 'b', survivors: [], capturedIds: [] } }, eng, state)
    expect(r.effects.length).toBe(0)
  })
})

describe('questRunner.transitionStages', () => {
  it('advances stage when transition predicate passes', () => {
    const eng: QuestEngineState = { quests: { 'blood_ties': bloodTies } }
    const state = baseState()
    state.flags.set('blood_ties.daren_killed', { value: true, scope: 'quest' })
    const r = transitionStages(eng, state)
    expect(r.transitions).toEqual([{ questId: 'blood_ties', from: 'start', to: 'end' }])
  })

  it('no transition when predicate fails', () => {
    const eng: QuestEngineState = { quests: { 'blood_ties': bloodTies } }
    const r = transitionStages(eng, baseState())
    expect(r.transitions.length).toBe(0)
  })
})
