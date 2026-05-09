import { describe, it, expect } from 'vitest'
import { evaluatePredicate } from '../../../src/systems/predicates'
import { asFlagKey, asQuestId, asStageId, asClassId, asEncounterId, asMapId, asNodeId } from '../../../src/domain/ids'
import type { Predicate } from '../../../src/domain/predicate'

const baseState = () => ({
  flags: new Map<string, { value: unknown; scope: 'run'|'quest'|'battle'|'permanent' }>(),
  questStates: {} as Record<string, { currentStage: string; metadata: Record<string, unknown> }>,
  party: { units: {} as Record<string, { classId: string }> },
  inventory: { items: [] as { itemId: string }[] },
  gold: 0,
  visitedNodes: new Set<string>(),
  clearedEncounters: new Set<string>(),
})

describe('evaluatePredicate', () => {
  it('always = true; never = false', () => {
    const s = baseState()
    expect(evaluatePredicate({ kind: 'always' }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'never' }, s)).toBe(false)
  })

  it('flag (no equals) checks existence', () => {
    const s = baseState()
    s.flags.set('quest.test.complete', { value: true, scope: 'quest' })
    const p: Predicate = { kind: 'flag', key: asFlagKey('quest.test.complete') }
    expect(evaluatePredicate(p, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'flag', key: asFlagKey('absent') }, s)).toBe(false)
  })

  it('flag (with equals) compares value', () => {
    const s = baseState()
    s.flags.set('counter', { value: 3, scope: 'run' })
    expect(evaluatePredicate({ kind: 'flag', key: asFlagKey('counter'), equals: 3 }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'flag', key: asFlagKey('counter'), equals: 4 }, s)).toBe(false)
  })

  it('notFlag', () => {
    const s = baseState()
    expect(evaluatePredicate({ kind: 'notFlag', key: asFlagKey('absent') }, s)).toBe(true)
    s.flags.set('present', { value: 1, scope: 'run' })
    expect(evaluatePredicate({ kind: 'notFlag', key: asFlagKey('present') }, s)).toBe(false)
  })

  it('questStage', () => {
    const s = baseState()
    s.questStates['blood_ties'] = { currentStage: 'stage_2', metadata: {} }
    expect(evaluatePredicate({ kind: 'questStage', questId: asQuestId('blood_ties'), stage: asStageId('stage_2') }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'questStage', questId: asQuestId('blood_ties'), stage: asStageId('stage_3') }, s)).toBe(false)
  })

  it('questComplete', () => {
    const s = baseState()
    s.questStates['blood_ties'] = { currentStage: '__complete__', metadata: {} }
    expect(evaluatePredicate({ kind: 'questComplete', questId: asQuestId('blood_ties') }, s)).toBe(true)
  })

  it('partyHas', () => {
    const s = baseState()
    s.party.units['roy'] = { classId: 'lord' }
    expect(evaluatePredicate({ kind: 'partyHas', classId: asClassId('lord') }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'partyHas', classId: asClassId('mage') }, s)).toBe(false)
  })

  it('goldAtLeast', () => {
    const s = baseState()
    s.gold = 100
    expect(evaluatePredicate({ kind: 'goldAtLeast', amount: 50 }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'goldAtLeast', amount: 200 }, s)).toBe(false)
  })

  it('visited', () => {
    const s = baseState()
    s.visitedNodes.add('overworld:test:pine')
    const ref = { mapKind: 'overworld' as const, mapId: asMapId('test'), nodeId: asNodeId('pine') }
    expect(evaluatePredicate({ kind: 'visited', ref }, s)).toBe(true)
  })

  it('cleared', () => {
    const s = baseState()
    s.clearedEncounters.add('bandit_road')
    expect(evaluatePredicate({ kind: 'cleared', encounterId: asEncounterId('bandit_road') }, s)).toBe(true)
  })

  it('allOf — all must pass', () => {
    const s = baseState()
    s.gold = 100
    s.flags.set('a', { value: 1, scope: 'run' })
    expect(evaluatePredicate({ kind: 'allOf', preds: [
      { kind: 'goldAtLeast', amount: 50 },
      { kind: 'flag', key: asFlagKey('a') },
    ]}, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'allOf', preds: [
      { kind: 'goldAtLeast', amount: 200 },
      { kind: 'flag', key: asFlagKey('a') },
    ]}, s)).toBe(false)
  })

  it('anyOf — at least one passes', () => {
    const s = baseState()
    expect(evaluatePredicate({ kind: 'anyOf', preds: [
      { kind: 'never' }, { kind: 'always' },
    ]}, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'anyOf', preds: [
      { kind: 'never' }, { kind: 'never' },
    ]}, s)).toBe(false)
  })

  it('not — inverts', () => {
    const s = baseState()
    expect(evaluatePredicate({ kind: 'not', pred: { kind: 'never' } }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'not', pred: { kind: 'always' } }, s)).toBe(false)
  })
})
