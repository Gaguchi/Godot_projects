import { describe, expect, it } from 'vitest'
import { PREDICATE_KINDS, PredicateSchema } from '../../../../src/content/schemas'
import { evaluate, flagKeysRead, predicateState } from '../../../../src/engine/run/predicates'
import type { Predicate, PredicateState } from '../../../../src/engine/types'
import { makeRun, unit } from './narrativeFixture'

/** A fixture `PredicateState` — the evaluator is pure over it (no run, no env). */
const state: PredicateState = {
  flags: { daren_captured: { value: true, scope: 'run' }, toll_paid: { value: 15, scope: 'run' }, mood: { value: 'grim', scope: 'quest' } },
  questStates: { sq_blood_ties: { stage: 'find_daren', startedDay: 1 }, sq_missing_caravan: { stage: '__complete__', startedDay: 1 } },
  partyClassIds: ['lord', 'shield_knight'],
  itemIds: ['iron_sword', 'healing_potion'],
  gold: 80,
  visitedNodes: { 'overworld:world:frontier_camp': true },
  clearedEncounters: { bandit_ambush: true },
}

const ev = (p: Predicate) => evaluate(p, state)

describe('predicates — all 15 kinds', () => {
  it('the schema and the evaluator agree on the 15 kinds', () => {
    expect(PREDICATE_KINDS).toHaveLength(15)
    expect(PREDICATE_KINDS).toContain('hasItem')
    expect(PREDICATE_KINDS).toContain('questStarted')
  })
  it('always', () => expect(ev({ kind: 'always' })).toBe(true))
  it('never', () => expect(ev({ kind: 'never' })).toBe(false))
  it('flag — present without equals is true, missing is false', () => {
    expect(ev({ kind: 'flag', key: 'daren_captured' })).toBe(true)
    expect(ev({ kind: 'flag', key: 'daren_killed' })).toBe(false)
  })
  it('flag equals is strict === (no coercion; a missing flag never equals false)', () => {
    expect(ev({ kind: 'flag', key: 'daren_captured', equals: true })).toBe(true)
    expect(ev({ kind: 'flag', key: 'daren_captured', equals: 'true' })).toBe(false)
    expect(ev({ kind: 'flag', key: 'toll_paid', equals: 15 })).toBe(true)
    expect(ev({ kind: 'flag', key: 'toll_paid', equals: '15' })).toBe(false)
    expect(ev({ kind: 'flag', key: 'mood', equals: 'grim' })).toBe(true)
    expect(ev({ kind: 'flag', key: 'daren_killed', equals: false })).toBe(false)
  })
  it('notFlag', () => {
    expect(ev({ kind: 'notFlag', key: 'daren_killed' })).toBe(true)
    expect(ev({ kind: 'notFlag', key: 'daren_captured' })).toBe(false)
  })
  it('questStarted — present in questStates (active or complete)', () => {
    expect(ev({ kind: 'questStarted', questId: 'sq_blood_ties' })).toBe(true)
    expect(ev({ kind: 'questStarted', questId: 'sq_missing_caravan' })).toBe(true)
    expect(ev({ kind: 'questStarted', questId: 'sq_nothing' })).toBe(false)
  })
  it('questStage', () => {
    expect(ev({ kind: 'questStage', questId: 'sq_blood_ties', stage: 'find_daren' })).toBe(true)
    expect(ev({ kind: 'questStage', questId: 'sq_blood_ties', stage: 'daren_resolved' })).toBe(false)
    expect(ev({ kind: 'questStage', questId: 'sq_nothing', stage: 'find_daren' })).toBe(false)
  })
  it('questComplete — the engine-owned sentinel', () => {
    expect(ev({ kind: 'questComplete', questId: 'sq_missing_caravan' })).toBe(true)
    expect(ev({ kind: 'questComplete', questId: 'sq_blood_ties' })).toBe(false)
    expect(ev({ kind: 'questComplete', questId: 'sq_nothing' })).toBe(false)
  })
  it('partyHas', () => {
    expect(ev({ kind: 'partyHas', classId: 'shield_knight' })).toBe(true)
    expect(ev({ kind: 'partyHas', classId: 'mage' })).toBe(false)
  })
  it('hasItem', () => {
    expect(ev({ kind: 'hasItem', itemId: 'iron_sword' })).toBe(true)
    expect(ev({ kind: 'hasItem', itemId: 'iron_bow' })).toBe(false)
  })
  it('goldAtLeast', () => {
    expect(ev({ kind: 'goldAtLeast', amount: 80 })).toBe(true)
    expect(ev({ kind: 'goldAtLeast', amount: 81 })).toBe(false)
  })
  it('visited — keyed `mapKind:mapId:nodeId`', () => {
    expect(ev({ kind: 'visited', ref: { mapKind: 'overworld', mapId: 'world', nodeId: 'frontier_camp' } })).toBe(true)
    expect(ev({ kind: 'visited', ref: { mapKind: 'overworld', mapId: 'world', nodeId: 'pine_crossing' } })).toBe(false)
    expect(ev({ kind: 'visited', ref: { mapKind: 'dungeon', mapId: 'world', nodeId: 'frontier_camp' } })).toBe(false)
  })
  it('cleared', () => {
    expect(ev({ kind: 'cleared', encounterId: 'bandit_ambush' })).toBe(true)
    expect(ev({ kind: 'cleared', encounterId: 'wolf_pack' })).toBe(false)
  })
  it('allOf', () => {
    expect(ev({ kind: 'allOf', preds: [{ kind: 'always' }, { kind: 'goldAtLeast', amount: 1 }] })).toBe(true)
    expect(ev({ kind: 'allOf', preds: [{ kind: 'always' }, { kind: 'never' }] })).toBe(false)
  })
  it('anyOf', () => {
    expect(ev({ kind: 'anyOf', preds: [{ kind: 'never' }, { kind: 'flag', key: 'daren_captured', equals: true }] })).toBe(true)
    expect(ev({ kind: 'anyOf', preds: [{ kind: 'never' }, { kind: 'flag', key: 'daren_killed', equals: true }] })).toBe(false)
  })
  it('not', () => {
    expect(ev({ kind: 'not', pred: { kind: 'never' } })).toBe(true)
    expect(ev({ kind: 'not', pred: { kind: 'questStarted', questId: 'sq_blood_ties' } })).toBe(false)
  })
})

describe('predicates — state and round trip', () => {
  it('a predicate tree and its state round-trip through JSON (save format) unchanged', () => {
    const tree: Predicate = { kind: 'allOf', preds: [{ kind: 'not', pred: { kind: 'flag', key: 'daren_killed', equals: true } }, { kind: 'anyOf', preds: [{ kind: 'visited', ref: { mapKind: 'overworld', mapId: 'world', nodeId: 'frontier_camp' } }, { kind: 'never' }] }] }
    const again = PredicateSchema.parse(JSON.parse(JSON.stringify(tree)))
    const stateAgain = JSON.parse(JSON.stringify(state)) as PredicateState
    expect(again).toEqual(tree)
    expect(stateAgain).toEqual(state)
    expect(evaluate(again, stateAgain)).toBe(evaluate(tree, state))
    expect(evaluate(again, stateAgain)).toBe(true)
  })

  it('flagKeysRead lists every flag key a tree reads, once, depth-first', () => {
    const tree: Predicate = { kind: 'allOf', preds: [{ kind: 'flag', key: 'a' }, { kind: 'not', pred: { kind: 'notFlag', key: 'b' } }, { kind: 'anyOf', preds: [{ kind: 'flag', key: 'a', equals: 1 }, { kind: 'questStage', questId: 'q', stage: 's' }] }] }
    expect(flagKeysRead(tree)).toEqual(['a', 'b'])
    expect(flagKeysRead({ kind: 'always' })).toEqual([])
  })

  it('predicateState is built from the run: living class ids, bag + hands, gold, visited, cleared', () => {
    const dead = unit('garrik', 'knight', { hp: { current: 0, max: 20 } })
    const run = makeRun({ party: { ...makeRun().party, garrik: dead }, partyOrder: ['mc', 'oak', 'lilina', 'garrik'], gold: 42, clearedEncounters: { wolf_pack: true } })
    const s = predicateState(run)
    expect(s.partyClassIds).toEqual(['lord', 'shield_knight', 'mage'])
    expect(s.itemIds).toEqual(expect.arrayContaining(['food_rations', 'healing_potion', 'iron_sword', 'iron_lance', 'iron_buckler', 'fire_tome']))
    expect(s.gold).toBe(42)
    expect(s.visitedNodes).toBe(run.visitedNodes)
    expect(s.clearedEncounters).toEqual({ wolf_pack: true })
    expect(s.flags).toBe(run.flags)
    expect(s.questStates).toBe(run.questStates)
    expect(evaluate({ kind: 'partyHas', classId: 'knight' }, s)).toBe(false)
    expect(evaluate({ kind: 'hasItem', itemId: 'iron_lance' }, s)).toBe(true)
    expect(evaluate({ kind: 'visited', ref: { mapKind: 'overworld', mapId: 'world', nodeId: run.nodeId } }, s)).toBe(true)
  })
})
