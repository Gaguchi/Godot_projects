import { describe, expect, it } from 'vitest'
import { deckSize } from '../../../../src/engine/combat/deck'
import { mergeStatus } from '../../../../src/engine/combat/statuses'
import {
  activeUnit, checkEnd, effectiveSpd, endTurn, initiativeQueue, initiativeStrip, isPartyTurn, startTurn, successor,
} from '../../../../src/engine/combat/turn'
import type { ActiveStatus, CombatState } from '../../../../src/engine/types'
import { authored, dispatch, duel, env, mc, oak, patchUnit, seed, unit, unitFromClass, withKnobs } from '../../../helpers/battles'

const slow = (stacks: number): ActiveStatus => ({ id: 'slow', stacks, turns: 2, expiresAt: 'ownerTurnEnd', sourceId: null })

describe('combat/turn — initiative', () => {
  it('effectiveSpd is SPD plus the slow delta', () => {
    const st = duel()
    expect(effectiveSpd(unit(st, 'mc'))).toBe(5)
    expect(effectiveSpd({ ...unit(st, 'mc'), statuses: [slow(2)] })).toBe(3)
  })

  it('sorts SPD desc, party wins ties, then id asc, and drops dead / captured units', () => {
    const st = seed({
      party: [mc(), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })], // both spd 5
      enemies: { kind: 'authored', units: [authored('b', 'bandit', 4, 4, { stats: { spd: 5 } }), authored('a', 'bandit', 4, 5, { stats: { spd: 5 } }), authored('w', 'wolf', 5, 4)] }, // wolf spd 7
    })
    expect(initiativeQueue(st.units)).toEqual(['w', 'lilina', 'mc', 'a', 'b'])
    const dead = patchUnit(patchUnit(st, 'w', { hp: { current: 0, max: 14 }, position: null, lastTile: '5,4' }), 'a', { captured: true, hp: { current: 0, max: 18 }, position: null, lastTile: '4,5' })
    expect(initiativeQueue(dead.units)).toEqual(['lilina', 'mc', 'b'])
  })

  it('slow re-sorts the derived queue immediately (it is rebuilt at every call)', () => {
    const st = duel() // mc 5, bandit 4
    expect(initiativeQueue(st.units)).toEqual(['mc', 'bandit'])
    const slowed = patchUnit(st, 'mc', { statuses: [slow(2)] })
    expect(initiativeQueue(slowed.units)).toEqual(['bandit', 'mc'])
  })

  it('successor deals the round to whoever has not held the cursor, and wraps when nobody is left', () => {
    const st = duel()
    expect(successor(st.units, 'mc', ['mc'])).toEqual({ unitId: 'bandit', wrapped: false })
    expect(successor(st.units, 'bandit', ['mc', 'bandit'])).toEqual({ unitId: 'mc', wrapped: true })
    // the current unit may already be dead (its own poison): the cursor still moves on from where it stood
    const dead = patchUnit(st, 'mc', { hp: { current: 0, max: 26 }, position: null, lastTile: '2,4' })
    expect(successor(dead.units, 'mc', ['mc'])).toEqual({ unitId: 'bandit', wrapped: false })
    expect(() => successor(st.units, 'ghost', [])).toThrow(/unknown unit/)
  })

  it('initiativeStrip leads with the active unit, then the rest of the round, then the next one', () => {
    const st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('b1', 'bandit', 5, 4), authored('b2', 'bandit', 5, 5), authored('b3', 'bandit', 6, 4)] } })
    const queue = initiativeQueue(st.units)
    const mid = { ...st, turn: { round: 1, unitId: queue[2]!, acted: queue.slice(0, 3) } }
    const strip = initiativeStrip(mid, 3)
    expect(strip.ids).toEqual([queue[2], queue[3], queue[4]])
    expect(strip.more).toBe(2)
    expect(initiativeStrip(st, 8).more).toBe(0)
    // and it never promises a turn to somebody who has already taken one: slow the leader after it acted and the
    // strip still shows the two who are owed a turn, not the leader sitting between them (RE-GATE C 3.3)
    const slowedLeader = patchUnit(mid, queue[0]!, { statuses: [slow(4)] })
    expect(initiativeStrip(slowedLeader, 3).ids).toEqual([queue[2], queue[3], queue[4]])
  })

  it('activeUnit / isPartyTurn read the derived turn', () => {
    const st = duel()
    expect(activeUnit(st).id).toBe('mc')
    expect(isPartyTurn(st)).toBe(true)
    expect(isPartyTurn({ ...st, turn: { round: 1, unitId: 'bandit', acted: ['mc', 'bandit'] } })).toBe(false)
  })
})

/**
 * RE-GATE C 3.3 — a round deals every living unit exactly ONE turn, whatever happens to SPD inside it.
 * The queue is still derived (a slow re-sorts who of the REMAINING goes first); what a mid-round speed change can
 * no longer do is drop a unit back behind the cursor for a second turn, or lift one over it and skip it.
 */
describe('combat/turn — a slow lands mid-round', () => {
  // fast 6, foe 4 and an oak whose SPD the case picks: at 2 a slow on the FOE drops it behind oak, at 5 a slow on
  // OAK drops oak behind the foe. Both are one step across the cursor, in the two directions.
  const trio = (oakSpd: number): CombatState => seed({
    party: [unitFromClass('fast', 'lord', 'party', { stats: { spd: 6 } }), unitFromClass('oak', 'shield_knight', 'party', { stats: { spd: oakSpd } })],
    enemies: { kind: 'authored', units: [authored('foe', 'bandit', 4, 4, { stats: { spd: 4 } })] },
  })

  it('nobody takes a second turn when the slow re-sorts the queue behind the cursor', () => {
    let st = trio(2)
    expect(initiativeQueue(st.units)).toEqual(['fast', 'foe', 'oak'])
    // fast opens the round and lands the slow, which moves the foe BEHIND oak
    st = patchUnit(st, 'foe', { statuses: [{ ...slow(2), turns: 1 }] })
    expect(initiativeQueue(st.units)).toEqual(['fast', 'oak', 'foe'])
    st = endTurn(st, env()).state
    expect(st.turn).toEqual({ round: 1, unitId: 'oak', acted: ['fast', 'oak'] })
    // oak ends: the foe is the last of the round, and the round has NOT turned over
    st = endTurn(st, env()).state
    expect(st.turn.unitId).toBe('foe')
    expect(st.turn.round).toBe(1)
    // the slow expires at the foe's own turn end, putting it back ahead of oak — oak must not act twice
    st = endTurn(st, env()).state
    expect(unit(st, 'foe').statuses).toEqual([])
    expect(st.turn).toEqual({ round: 2, unitId: 'fast', acted: ['fast'] })
  })

  it('nobody is skipped when the slow comes off ahead of the cursor', () => {
    // oak (5) normally goes second; slowed to 3 it falls behind the foe and is the LAST of the round
    let st = patchUnit(trio(5), 'oak', { statuses: [slow(2)] })
    expect(initiativeQueue(st.units)).toEqual(['fast', 'foe', 'oak'])
    st = endTurn(st, env()).state // fast → foe
    expect(st.turn.unitId).toBe('foe')
    // the slow comes off while the foe holds the cursor (a cleanse at the foe's own tick): oak is back in FRONT of
    // the foe in the derived queue, which used to wrap the round straight past it
    st = patchUnit(st, 'oak', { statuses: [] })
    expect(initiativeQueue(st.units)).toEqual(['fast', 'oak', 'foe'])
    st = endTurn(st, env()).state
    expect(st.turn).toEqual({ round: 1, unitId: 'oak', acted: ['fast', 'foe', 'oak'] })
  })

  it('three full rounds deal every living unit exactly one turn each (§7.1)', () => {
    let st = trio(5)
    const seenPerRound: Record<number, string[]> = {}
    for (let i = 0; i < 9; i++) {
      const round = st.turn.round
      const seen = seenPerRound[round] ?? []
      seen.push(st.turn.unitId)
      seenPerRound[round] = seen
      // a status that changes SPD every single turn: the queue is re-sorted under the cursor at every hand-off
      st = patchUnit(st, i % 2 === 0 ? 'foe' : 'oak', { statuses: [slow(3)] })
      st = endTurn(st, env()).state
    }
    for (const round of [1, 2, 3]) {
      expect([...seenPerRound[round]!].sort()).toEqual(['fast', 'foe', 'oak'])
    }
  })
})

describe('combat/turn — checkEnd', () => {
  it('victory when no enemy is alive-and-uncaptured, defeat when no party unit lives', () => {
    const st = duel()
    expect(checkEnd(st, env())).toBe('combat')
    expect(checkEnd(patchUnit(st, 'bandit', { hp: { current: 0, max: 18 }, position: null, lastTile: '4,4' }), env())).toBe('victory')
    expect(checkEnd(patchUnit(st, 'bandit', { captured: true, hp: { current: 0, max: 18 }, position: null, lastTile: '4,4' }), env())).toBe('victory')
    expect(checkEnd(patchUnit(st, 'mc', { hp: { current: 0, max: 26 }, position: null, lastTile: '2,4' }), env())).toBe('defeat')
  })

  it('the MC falling is a defeat under mcDeathIsDefeat even with allies standing, and is not without it', () => {
    const st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 4, 4)] } })
    const mcDead = patchUnit(st, 'mc', { hp: { current: 0, max: 26 }, position: null, lastTile: '2,4' })
    expect(checkEnd(mcDead, env())).toBe('defeat')
    expect(checkEnd(mcDead, withKnobs(env(), { mcDeathIsDefeat: false }))).toBe('combat')
  })

  it('a mutual kill is a defeat (defeat is checked before victory)', () => {
    const st = duel()
    const both = patchUnit(patchUnit(st, 'mc', { hp: { current: 0, max: 26 }, position: null, lastTile: '2,4' }), 'bandit', { hp: { current: 0, max: 18 }, position: null, lastTile: '4,4' })
    expect(checkEnd(both, env())).toBe('defeat')
  })
})

describe('combat/turn — startTurn / endTurn', () => {
  it('startTurn restores AP, the free move, the action budget and the cover ledger, ticks ownerTurnStart statuses and draws to 5', () => {
    let st = duel()
    st = patchUnit(st, 'mc', {
      ap: 0, hasMovedThisTurn: true, actionsTaken: 2, coverUsed: ['oak'],
      statuses: mergeStatus([], { id: 'riposte', stacks: 3, turns: 1, expiresAt: 'ownerTurnStart', sourceId: 'mc' }, env()),
    })
    const deck = st.decks['mc']!
    st = { ...st, decks: { ...st.decks, mc: { ...deck, hand: deck.hand.slice(0, 2), discard: deck.hand.slice(2) } } }
    const r = startTurn(st, 'mc', env())
    const u = unit(r.state, 'mc')
    expect(u.ap).toBe(env().rules.combat.apPerTurn)
    expect(u.hasMovedThisTurn).toBe(false)
    expect(u.actionsTaken).toBe(0)
    expect(u.coverUsed).toEqual([])
    expect(u.statuses).toEqual([])
    expect(r.state.decks['mc']!.hand).toHaveLength(env().rules.combat.handSize)
    expect(r.effects.map((e) => e.kind)).toEqual(['turnStarted', 'statusRemoved', 'cardsDrawn'])
    expect(deckSize(r.state.decks['mc']!)).toBe(deckSize(deck))
  })

  it('startTurn never draws for an enemy (enemies do not play their decks)', () => {
    const st = duel()
    const r = startTurn(st, 'bandit', env())
    expect(r.state.decks['bandit']!.hand).toEqual([])
    expect(r.state.rng).toEqual(st.rng)
    expect(r.effects.map((e) => e.kind)).toEqual(['turnStarted'])
  })

  it('endTurn ticks the ending unit, discards its hand, hands over, draws for the successor and bumps the round on wrap', () => {
    const st = duel()
    const first = dispatch(st, { type: 'combat/endTurn' })
    expect(first.state.turn).toEqual({ round: 1, unitId: 'bandit', acted: ['mc', 'bandit'] })
    expect(first.state.decks['mc']!.hand).toEqual([])
    expect(first.state.decks['mc']!.discard).toHaveLength(5)
    expect(first.state.selection).toEqual({ kind: 'idle' })
    const second = endTurn(first.state, env())
    expect(second.state.turn).toEqual({ round: 2, unitId: 'mc', acted: ['mc'] })
    expect(second.state.decks['mc']!.hand).toHaveLength(5)
    expect(deckSize(second.state.decks['mc']!)).toBe(deckSize(st.decks['mc']!))
  })

  it('endTurn on a poisoned unit ticks the DOT first and a DOT death ends the battle at the tick', () => {
    let st = duel({ bandit: { hp: 2 } })
    st = { ...st, turn: { round: 1, unitId: 'bandit', acted: ['mc', 'bandit'] } }
    st = patchUnit(st, 'bandit', { statuses: mergeStatus([], { id: 'poison', stacks: 3, turns: 2, expiresAt: 'ownerTurnEnd', sourceId: 'mc' }, env()) })
    const r = endTurn(st, env())
    expect(r.state.phase).toBe('victory')
    expect(unit(r.state, 'bandit').hp.current).toBe(0)
    expect(r.effects.map((e) => e.kind)).toContain('statusTicked')
    expect(r.effects.map((e) => e.kind)).toContain('battleEnded')
    // no hand-off happened: the turn still names the unit that died at its own tick
    expect(r.state.turn.unitId).toBe('bandit')
  })
})
