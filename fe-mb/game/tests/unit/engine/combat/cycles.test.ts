/**
 * Brief §7.1 / §10: every turn/round system ships a test that runs ≥ 3 FULL cycles asserting per-cycle restoration —
 * AP = 3, hand = 5, reshuffle with zero card loss, status expiry, cover counter cleared. The shipped engine's AP
 * bug lived for months because every harness resolved battles in one turn.
 */
import { describe, expect, it } from 'vitest'
import { deckSize } from '../../../../src/engine/combat/deck'
import { hasStatus, mergeStatus } from '../../../../src/engine/combat/statuses'
import { initiativeQueue } from '../../../../src/engine/combat/turn'
import type { CombatState } from '../../../../src/engine/types'
import type { Effect } from '../../../../src/engine/effects'
import { authored, dispatch, env, mc, oak, patchUnit, seed, unit } from '../../../helpers/battles'

/** The party's free move, spent on a one-tile shuffle so `hasMovedThisTurn` actually flips every turn. */
function spendFreeMove(st: CombatState, id: string): CombatState {
  const u = unit(st, id)
  const [x, y] = u.position!.split(',').map(Number) as [number, number]
  // even rows step north, odd rows step south, so the MC (row 4 ⇄ 3) and Oak (row 5 ⇄ 6) never share a tile
  const target = y % 2 === 0 ? `${x},${y - 1}` : `${x},${y + 1}`
  const r = dispatch(st, { type: 'combat/moveUnit', tile: target })
  expect(r.effects.some((e) => e.kind === 'refused')).toBe(false)
  return r.state
}

/** Play the first affordable self card in hand (if any) so AP and the discard actually move. */
function playASelfCard(st: CombatState, id: string): CombatState {
  const deck = st.decks[id]!
  const u = unit(st, id)
  const uid = deck.hand.find((h) => {
    const card = env().content.cards[deck.cards[h]!.cardId]!
    return card.targetKind === 'self' && card.apCost <= u.ap
  })
  if (uid === undefined) return st
  const r = dispatch(st, { type: 'combat/playCard', cardUid: uid, tile: null })
  expect(r.effects.some((e) => e.kind === 'refused')).toBe(false)
  return r.state
}

describe('combat — ≥ 3 full rounds restore every per-turn resource', () => {
  const ROUNDS = 4
  const e = env()
  const handSize = e.rules.combat.handSize
  const apPerTurn = e.rules.combat.apPerTurn

  it('AP = 3, hand = 5, zero card loss through reshuffles, statuses expire on schedule, coverUsed clears each activation', () => {
    // Two party units (9- and 10-card decks) vs two sturdy bandits. Nobody dies: the party only plays self cards.
    let st = seed({
      party: [mc(), oak()],
      enemies: { kind: 'authored', units: [authored('b1', 'bandit', 5, 4, { hp: 200 }), authored('b2', 'bandit', 5, 5, { hp: 200 })] },
      seed: 7,
    })
    const order = initiativeQueue(st.units)
    expect(order).toEqual(['mc', 'b1', 'b2', 'oak']) // lord 5, bandits 4 (id asc), shield knight 2
    const sizes = { mc: deckSize(st.decks['mc']!), oak: deckSize(st.decks['oak']!) }
    expect(sizes.mc).toBe(9)
    expect(sizes.oak).toBe(10)

    // Round-1 instrumentation: a 1-turn riposte on the MC (ownerTurnStart), a 2-turn poison on b1 (ownerTurnEnd),
    // and a dirty cover ledger on Oak that MUST be wiped when Oak's own turn starts.
    st = patchUnit(st, 'mc', { statuses: mergeStatus([], { id: 'riposte', stacks: 3, turns: 1, expiresAt: 'ownerTurnStart', sourceId: 'mc' }, e) })
    st = patchUnit(st, 'b1', { armor: 5, statuses: mergeStatus([], { id: 'poison', stacks: 2, turns: 2, expiresAt: 'ownerTurnEnd', sourceId: 'mc' }, e) })
    st = patchUnit(st, 'oak', { coverUsed: ['mc'] })

    const log: Effect[] = []
    let reshuffles = 0
    let mcTurnsSeen = 0
    let oakTurnsSeen = 0
    let b1Ticks = 0

    for (let round = 1; round <= ROUNDS; round++) {
      for (const id of order) {
        // the round's ledger fills as the cursor goes round and opens empty again on the wrap (0115)
        expect(st.turn).toEqual({ round, unitId: id, acted: order.slice(0, order.indexOf(id) + 1) })
        const u = unit(st, id)
        // every activation begins fully restored
        expect(u.ap).toBe(apPerTurn)
        expect(u.hasMovedThisTurn).toBe(false)
        expect(u.actionsTaken).toBe(0)
        if (id === 'oak') {
          expect(u.coverUsed).toEqual([]) // cleared at the PROTECTOR's turn start (§2.16)
          oakTurnsSeen++
        }
        if (u.team === 'party') {
          expect(st.decks[id]!.hand).toHaveLength(handSize)
          expect(deckSize(st.decks[id]!)).toBe(sizes[id as 'mc' | 'oak'])
        }
        if (id === 'mc') {
          mcTurnsSeen++
          // the riposte bought in round 1 lasts through the enemy phase and is gone at the MC's NEXT turn start
          expect(hasStatus(u, 'riposte')).toBe(round === 1)
        }
        if (id === 'b1') {
          // opponent-inflicted poison: 2 ticks (rounds 1 and 2), then gone; armor never absorbs it
          expect(hasStatus(u, 'poison')).toBe(round <= 2)
          expect(u.armor).toBe(5)
        }

        if (u.team === 'party') {
          st = spendFreeMove(st, id)
          st = playASelfCard(st, id)
          expect(unit(st, id).hasMovedThisTurn).toBe(true)
        }
        const hpBefore = unit(st, 'b1').hp.current
        const r = dispatch(st, { type: 'combat/endTurn' })
        log.push(...r.effects)
        expect(r.state.phase).toBe('combat')
        if (id === 'b1' && round <= 2) {
          expect(unit(r.state, 'b1').hp.current).toBe(hpBefore - 2)
          b1Ticks++
        }
        if (u.team === 'party') {
          expect(r.state.decks[id]!.hand).toEqual([]) // the ending unit discards its whole hand
          expect(deckSize(r.state.decks[id]!)).toBe(sizes[id as 'mc' | 'oak'])
        }
        for (const ef of r.effects) if (ef.kind === 'cardsDrawn' && ef.reshuffled) reshuffles++
        st = r.state
      }
    }

    expect(mcTurnsSeen).toBe(ROUNDS)
    expect(oakTurnsSeen).toBe(ROUNDS)
    expect(b1Ticks).toBe(2)
    expect(reshuffles).toBeGreaterThanOrEqual(ROUNDS) // a 9-card deck dealt 5 a turn must reshuffle at least once per round
    expect(unit(st, 'b1').hp.current).toBe(200 - 4)
    expect(st.turn.round).toBe(ROUNDS + 1)
    // the battle never resolved and every unit is still standing on a unique tile
    expect(st.phase).toBe('combat')
    const tiles = Object.values(st.units).map((u) => u.position)
    expect(new Set(tiles).size).toBe(4)
    expect(log.some((ef) => ef.kind === 'battleEnded')).toBe(false)
  })

  it('the whole deck cycles: after enough turns every instance has been in hand at least once, none twice-in-hand', () => {
    let st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('b1', 'bandit', 5, 4, { hp: 200 })] }, seed: 3 })
    const seen = new Map<string, number>()
    for (let i = 0; i < 6; i++) {
      // mc turn
      for (const uid of st.decks['mc']!.hand) seen.set(uid, (seen.get(uid) ?? 0) + 1)
      const hand = st.decks['mc']!.hand
      expect(new Set(hand).size).toBe(hand.length)
      st = dispatch(st, { type: 'combat/endTurn' }).state // → b1
      st = dispatch(st, { type: 'combat/endTurn' }).state // → mc
    }
    expect(seen.size).toBe(9)
    expect(deckSize(st.decks['mc']!)).toBe(9)
    expect(Object.keys(st.decks['mc']!.cards)).toHaveLength(9)
  })
})
