import { describe, expect, it } from 'vitest'
import {
  cleanse, consumeEmpower, empowerBonus, hasStatus, isImmobilized, isTaunting, mergeStatus, riposteStacks, slowDelta,
  tickOwnerTurnEnd, tickOwnerTurnStart,
} from '../../../../src/engine/combat/statuses'
import type { ActiveStatus, StatusId } from '../../../../src/engine/types'
import { dispatch, duel, env, handUid, patchUnit, unit, withHand } from '../../../helpers/battles'

const e = env()
const status = (id: StatusId, stacks: number, turns: number): ActiveStatus =>
  ({ id, stacks, turns, expiresAt: e.rules.combat.statuses[id].expiresAt, sourceId: null })

describe('combat/statuses — merge (§2.4)', () => {
  it('a new status takes its expiry moment from the rule table, not from the caller', () => {
    const merged = mergeStatus([], { id: 'taunt', stacks: 1, turns: 1, expiresAt: 'ownerTurnEnd', sourceId: 'x' }, e)
    expect(merged).toEqual([{ id: 'taunt', stacks: 1, turns: 1, expiresAt: 'ownerTurnStart', sourceId: 'x' }])
  })

  it('burn STACKS additively with duration = max', () => {
    const one = mergeStatus([], status('burn', 2, 2), e)
    const two = mergeStatus(one, status('burn', 3, 1), e)
    expect(two).toEqual([{ ...status('burn', 5, 2) }])
  })

  it('poison / slow reapply = max stacks, max duration (non-stacking)', () => {
    const one = mergeStatus([], status('poison', 3, 1), e)
    const two = mergeStatus(one, status('poison', 2, 3), e)
    expect(two).toEqual([status('poison', 3, 3)])
    expect(mergeStatus(mergeStatus([], status('slow', 1, 2), e), status('slow', 2, 1), e)).toEqual([status('slow', 2, 2)])
  })

  it('merging never mutates the input list', () => {
    const input = [status('poison', 1, 1)]
    const out = mergeStatus(input, status('poison', 4, 4), e)
    expect(input).toEqual([status('poison', 1, 1)])
    expect(out).not.toBe(input)
  })
})

describe('combat/statuses — selectors', () => {
  it('hasStatus / slowDelta / isImmobilized / isTaunting / riposteStacks / empowerBonus read the stacks', () => {
    const u = { ...unit(duel(), 'mc'), statuses: [status('slow', 2, 1), status('immobilize', 1, 1), status('taunt', 1, 1), status('riposte', 3, 1), status('empower', 4, 1)] }
    expect(hasStatus(u, 'poison')).toBe(false)
    expect(slowDelta(u)).toBe(-2)
    expect(isImmobilized(u)).toBe(true)
    expect(isTaunting(u)).toBe(true)
    expect(riposteStacks(u)).toBe(3)
    expect(empowerBonus(u)).toBe(4)
    const clean = unit(duel(), 'mc')
    expect(slowDelta(clean)).toBe(0)
    expect(riposteStacks(clean)).toBe(0)
  })

  it('consumeEmpower removes empower with reason consumed and is a no-op without it', () => {
    const u = { ...unit(duel(), 'mc'), statuses: [status('empower', 4, 1), status('taunt', 1, 1)] }
    const r = consumeEmpower(u)
    expect(r.unit.statuses).toEqual([status('taunt', 1, 1)])
    expect(r.effects).toEqual([{ kind: 'statusRemoved', unitId: 'mc', status: 'empower', reason: 'consumed' }])
    const none = consumeEmpower(unit(duel(), 'mc'))
    expect(none.effects).toEqual([])
  })
})

describe('combat/statuses — ticks and expiry', () => {
  it('tickOwnerTurnStart decrements taunt/riposte/empower and expires them at 0, leaving ownerTurnEnd statuses alone', () => {
    const u = { ...unit(duel(), 'mc'), statuses: [status('taunt', 1, 2), status('riposte', 3, 1), status('poison', 2, 2)] }
    const r = tickOwnerTurnStart(u, e)
    expect(r.unit.statuses).toEqual([status('taunt', 1, 1), status('poison', 2, 2)])
    expect(r.effects).toEqual([{ kind: 'statusRemoved', unitId: 'mc', status: 'riposte', reason: 'expired' }])
  })

  it('poison ticks armor-piercing and flat (no DR): armor and DEF never absorb it', () => {
    let st = duel()
    st = patchUnit(st, 'bandit', { armor: 5, stats: { ...unit(st, 'bandit').stats, def: 20 }, statuses: [status('poison', 2, 2)] })
    const r = tickOwnerTurnEnd(st, 'bandit', e)
    const b = unit(r.state, 'bandit')
    expect(b.hp.current).toBe(16)
    expect(b.armor).toBe(5)
    expect(b.statuses).toEqual([status('poison', 2, 1)])
    expect(r.effects.filter((x) => x.kind === 'statusTicked')).toEqual([{ kind: 'statusTicked', unitId: 'bandit', status: 'poison', damage: 2 }])
    expect(r.effects.find((x) => x.kind === 'unitHit')).toMatchObject({ unitId: 'bandit', hpLost: 2, armorLost: 0, cause: 'poison', damageType: 'physical' })
  })

  it('burn stacks additively and ticks with the magic split (floor to armor, ceil to HP), no DR', () => {
    let st = duel()
    st = patchUnit(st, 'bandit', { armor: 5, statuses: mergeStatus(mergeStatus([], status('burn', 1, 2), e), status('burn', 2, 2), e) })
    expect(unit(st, 'bandit').statuses[0]!.stacks).toBe(3)
    const r = tickOwnerTurnEnd(st, 'bandit', e)
    const b = unit(r.state, 'bandit')
    expect(b.armor).toBe(4) // floor(3/2) = 1 hits armor
    expect(b.hp.current).toBe(16) // ceil(3/2) = 2 pierces
    expect(r.effects.find((x) => x.kind === 'unitHit')).toMatchObject({ hpLost: 2, armorLost: 1, cause: 'burn', damageType: 'magic' })
  })

  it('a DOT death flips the phase at the tick and leaves the corpse off the board', () => {
    let st = duel({ bandit: { hp: 3 } })
    st = patchUnit(st, 'bandit', { statuses: [status('poison', 3, 1)] })
    const r = tickOwnerTurnEnd(st, 'bandit', e)
    expect(r.state.phase).toBe('victory')
    const b = unit(r.state, 'bandit')
    expect(b.position).toBeNull()
    expect(b.lastTile).toBe('4,4')
    expect(r.effects.map((x) => x.kind)).toEqual(['statusTicked', 'unitHit', 'sound', 'unitDied', 'sound', 'statusRemoved', 'battleEnded', 'sound'])
    expect(r.effects.find((x) => x.kind === 'unitDied')).toMatchObject({ cause: 'dot', tile: '4,4' })
  })

  it('a status that expires while the owner is dead or absent is harmless', () => {
    const st = duel()
    expect(tickOwnerTurnEnd(st, 'ghost', e)).toEqual({ state: st, effects: [] })
    const dead = patchUnit(st, 'bandit', { hp: { current: 0, max: 18 }, position: null, lastTile: '4,4', statuses: [status('poison', 2, 2)] })
    expect(tickOwnerTurnEnd(dead, 'bandit', e).state).toBe(dead)
  })

  it('a riposte played on the owner turn survives the enemy phase and expires at the owner next turn start; opponent poison still ticks', () => {
    let st = duel({ bandit: { hp: 200 } })
    st = withHand(st, 'mc', ['iron_sword_riposte'])
    st = patchUnit(st, 'mc', { statuses: [status('poison', 1, 2)] }) // inflicted by the bandit earlier
    st = dispatch(st, { type: 'combat/playCard', cardUid: handUid(st, 'mc', 'iron_sword_riposte'), tile: null }).state
    expect(riposteStacks(unit(st, 'mc'))).toBe(3)
    const toBandit = dispatch(st, { type: 'combat/endTurn' })
    expect(toBandit.state.turn.unitId).toBe('bandit')
    expect(riposteStacks(unit(toBandit.state, 'mc'))).toBe(3) // still up during the enemy phase
    expect(unit(toBandit.state, 'mc').hp.current).toBe(25) // and the poison ticked at the MC's own turn end
    const backToMc = dispatch(toBandit.state, { type: 'combat/endTurn' })
    expect(backToMc.state.turn.unitId).toBe('mc')
    expect(riposteStacks(unit(backToMc.state, 'mc'))).toBe(0)
    expect(backToMc.effects).toContainEqual({ kind: 'statusRemoved', unitId: 'mc', status: 'riposte', reason: 'expired' })
  })
})

describe('combat/statuses — cleanse', () => {
  it('armor N shreds up to N, armor all shreds everything, nothing to shred emits nothing', () => {
    const u = { ...unit(duel(), 'bandit'), armor: 5 }
    expect(cleanse(u, 'armor', 2, e)).toEqual({ unit: { ...u, armor: 3 }, effects: [{ kind: 'armorShredded', unitId: 'bandit', amount: 2 }] })
    expect(cleanse(u, 'armor', 'all', e)).toEqual({ unit: { ...u, armor: 0 }, effects: [{ kind: 'armorShredded', unitId: 'bandit', amount: 5 }] })
    expect(cleanse(u, 'armor', 9, e).unit.armor).toBe(0)
    expect(cleanse({ ...u, armor: 0 }, 'armor', 'all', e).effects).toEqual([])
  })

  it('debuff strips exactly the harmful statuses and keeps the buffs', () => {
    const u = { ...unit(duel(), 'mc'), statuses: [status('poison', 2, 2), status('riposte', 3, 1), status('slow', 1, 1), status('empower', 2, 1), status('immobilize', 1, 1), status('burn', 2, 2), status('taunt', 1, 1)] }
    const r = cleanse(u, 'debuff', 'all', e)
    expect(r.unit.statuses.map((s) => s.id)).toEqual(['riposte', 'empower', 'taunt'])
    expect(r.effects.map((x) => x.kind === 'statusRemoved' ? x.status : x.kind)).toEqual(['poison', 'slow', 'immobilize', 'burn'])
    expect(r.effects.every((x) => x.kind === 'statusRemoved' && x.reason === 'cleansed')).toBe(true)
  })
})
