import { describe, it, expect } from 'vitest'
import { rollEncounter } from '../../../src/systems/encounterRoller'
import { createRng } from '../../../src/systems/rng'
import type { EncounterTable } from '../../../src/domain/encounter'
import { asEncounterId } from '../../../src/domain/encounter'
import type { PredicateState } from '../../../src/systems/predicates'

const baseState = (): PredicateState => ({
  flags: new Map(),
  questStates: {},
  party: { units: {} },
  inventory: { items: [] },
  gold: 0,
  visitedNodes: new Set(),
  clearedEncounters: new Set(),
})

const fakeTable: EncounterTable = {
  id: 'test_table',
  entries: [
    { id: asEncounterId('a'), weight: 1, oneShot: false, conditions: [], outcome: { kind: 'dialogue', dialogueId: 'd1' } },
    { id: asEncounterId('b'), weight: 99, oneShot: false, conditions: [], outcome: { kind: 'battle', enemyGroupId: 'g1' } },
    { id: asEncounterId('c'), weight: 50, oneShot: true, conditions: [], outcome: { kind: 'battle', enemyGroupId: 'g2' } },
    {
      id: asEncounterId('d_quest'),
      weight: 100,
      oneShot: false,
      conditions: [{ kind: 'flag', key: 'questA_active' as never, equals: true }],
      outcome: { kind: 'dialogue', dialogueId: 'questD' },
    },
  ],
}

describe('encounterRoller (GP-C3)', () => {
  it('returns null when table is empty', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    expect(rollEncounter({ id: 'empty', entries: [] }, baseState(), new Set(), rng)).toBeNull()
  })

  it('weighted pick is deterministic for given RNG', () => {
    const rng1 = createRng({ seed: 42, counter: 0 })
    const rng2 = createRng({ seed: 42, counter: 0 })
    const r1 = rollEncounter(fakeTable, baseState(), new Set(), rng1)
    const r2 = rollEncounter(fakeTable, baseState(), new Set(), rng2)
    expect(r1?.entryId).toBe(r2?.entryId)
  })

  it('one-shot tracking excludes fired entries', () => {
    // Force entry "c" out via one-shot set; then "d_quest" filtered by predicate fail
    const fired = new Set(['c'])
    const rng = createRng({ seed: 0, counter: 0 })
    const r = rollEncounter(fakeTable, baseState(), fired, rng)
    expect(r?.entryId).not.toBe('c')
  })

  it('predicate-filtered entries are excluded if condition fails', () => {
    // questA flag absent → 'd_quest' should never fire
    let sawDQuest = false
    for (let i = 0; i < 50; i++) {
      const r = rollEncounter(fakeTable, baseState(), new Set(), createRng({ seed: i, counter: 0 }))
      if (r?.entryId === 'd_quest') sawDQuest = true
    }
    expect(sawDQuest).toBe(false)
  })

  it('predicate-filtered entry CAN fire when its condition holds', () => {
    const state = baseState()
    state.flags.set('questA_active', { value: true, scope: 'run' })
    let sawDQuest = false
    for (let i = 0; i < 50; i++) {
      const r = rollEncounter(fakeTable, state, new Set(), createRng({ seed: i, counter: 0 }))
      if (r?.entryId === 'd_quest') sawDQuest = true
    }
    expect(sawDQuest).toBe(true)
  })

  it('returns oneShot=true when picked entry is one-shot', () => {
    // Force 'c' to be picked by giving only c eligible
    const onlyC: EncounterTable = {
      id: 't',
      entries: [{ id: asEncounterId('c'), weight: 1, oneShot: true, conditions: [], outcome: { kind: 'battle', enemyGroupId: 'x' } }],
    }
    const rng = createRng({ seed: 0, counter: 0 })
    const r = rollEncounter(onlyC, baseState(), new Set(), rng)
    expect(r?.oneShot).toBe(true)
  })
})
