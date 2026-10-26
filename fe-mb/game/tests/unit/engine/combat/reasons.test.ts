/**
 * GATE1-04 / GATE3-04 — a refusal reason is TEXT THE PLAYER READS, and the whole combat package answered with
 * camelCase enum members instead: `noPath`, `notInHand`, `outOfMoveRange`, `alreadyMoved`, twenty-three of them.
 * They were printed verbatim to the headless player (`· REFUSED combat/playCard: noPath`), who is playing the
 * same game the browser plays (ARCHITECTURE §6, CONTRACT §10).
 *
 * `flow/legalityAudit.test.ts` holds every reason the FLOW GATE can answer with to ARCHITECTURE §5.1 and says in
 * its own comment that the combat reducer's rule-level codes are "GATE3-04's, not this gate's". This is that
 * guard: the same three rules, over the reasons the COMBAT package produces — measured by driving real refusals
 * through `reduceCombat`, not by reading the constants, so a rule that goes back to a code fails here.
 */
import { describe, expect, it } from 'vitest'
import type { CombatAction } from '../../../../src/engine/actions'
import { canEnterCapture } from '../../../../src/engine/combat/capture'
import { canPlay, validatePlay } from '../../../../src/engine/combat/cards'
import * as reasons from '../../../../src/engine/combat/reasons'
import { reduceCombat } from '../../../../src/engine/combat/reducer'
import { canEnterMove } from '../../../../src/engine/combat/turn'
import type { CombatState } from '../../../../src/engine/types'
import { at, authored, duel, env, handUid, mc, oak, patchUnit, seed, withHand } from '../../../helpers/battles'

const e = env()

/** ARCHITECTURE §5.1: "a lowercase fragment, no stop — it completes an implied 'because …'". */
function expectFragment(reason: string, where: string): void {
  expect(reason, `${where}: must not be empty`).not.toBe('')
  expect(reason, `"${reason}" (${where}) must not end in a full stop`).not.toMatch(/\.$/)
  expect(reason, `"${reason}" (${where}) must not open in Title Case`).not.toMatch(/^[A-Z][a-z]/)
  expect(reason, `"${reason}" (${where}) must not be a camelCase code`).not.toMatch(/^[a-z]+[A-Z]/)
  expect(reason, `"${reason}" (${where}) must be words, not one token`).toMatch(/\s/)
}

/** A board with the MC, Oak, a bandit at (4,4) and a wall at (3,3) — enough to reach every card rule. */
function field(): CombatState {
  const st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 4, 4)] }, grid: { obstacles: [at(3, 3)] } })
  return withHand(st, 'mc', ['iron_sword_slash'])
}

describe('combat refusal reasons are sentences, not codes', () => {
  it('every reason `combat/reasons.ts` publishes obeys §5.1', () => {
    const values = Object.entries(reasons).flatMap(([name, v]) => (typeof v === 'string' ? [[name, v] as const] : []))
    expect(values.length).toBeGreaterThan(20)
    for (const [name, value] of values) expectFragment(value, name)
    expectFragment(reasons.needsAp(2), 'needsAp(2)')
  })

  it('every refusal a real battle produces is a sentence — the card table, the free move, the satchel and capture', () => {
    const st = field()
    const slash = e.content.cards.iron_sword_slash!
    const nobility = e.content.cards.lord_nobility!
    const fortify = e.content.cards.knight_fortify!
    const burst = e.content.cards.fire_tome_flame_burst!
    const measured: { readonly where: string; readonly reason: string }[] = []
    const record = (where: string, legality: { readonly ok: boolean } | { readonly ok: false; readonly reason: string }): void => {
      expect(legality.ok, `${where} was meant to be refused`).toBe(false)
      measured.push({ where, reason: (legality as { readonly reason: string }).reason })
    }

    // the card table (`cards.ts#validatePlay` / `canPlay`)
    record('no AP', validatePlay(patchUnit(st, 'mc', { ap: 0 }), 'mc', slash, '4,4', e))
    record('out of reach', validatePlay(st, 'mc', slash, '4,4', e))
    record('no foe there', validatePlay(st, 'mc', slash, '2,5', e))
    record('no friend there', validatePlay(st, 'mc', nobility, '3,4', e))
    record('no tile', validatePlay(st, 'mc', slash, null, e))
    record('self only', validatePlay(st, 'mc', fortify, '2,5', e))
    record('a wall', validatePlay(st, 'mc', burst, '3,3', e))
    record('off the field', validatePlay(st, 'mc', burst, '-1,4', e))
    record('needs no tile', validatePlay(st, 'mc', { ...slash, targetKind: 'all_enemies' }, '4,4', e))
    record('not on the field', validatePlay(st, 'ghost', slash, '3,4', e))
    record('not in hand', canPlay(st, 'nope#1', '3,4', e))
    // the two arming rules the flow gate also reads (0089)
    record('already moved', canEnterMove({ ...st.units.mc!, hasMovedThisTurn: true }))
    record('no foe in reach', canEnterCapture(st, st.units.mc!, e))

    // and through the reducer itself, which is where the refusal reaches the player
    const refusalOf = (state: CombatState, action: CombatAction, where: string): void => {
      const r = reduceCombat(state, action, e)
      expect(r.state, `${where} must return the same reference`).toBe(state)
      const only = r.effects[0]
      expect(only?.kind, where).toBe('refused')
      if (only?.kind === 'refused') measured.push({ where, reason: only.reason })
    }
    refusalOf(st, { type: 'combat/moveUnit', tile: '13,9' }, 'too far to walk')
    refusalOf(st, { type: 'combat/moveUnit', tile: '3,3' }, 'walking into a wall')
    refusalOf(st, { type: 'combat/moveUnit', tile: '-1,0' }, 'walking off the field')
    refusalOf(st, { type: 'combat/useItem', itemId: 'nothing_like_it' }, 'a potion the satchel never had')
    refusalOf(st, { type: 'combat/capture', targetId: 'nobody' }, 'capturing thin air')
    refusalOf(st, { type: 'combat/pinTarget', tile: '4,4' }, 'pinning with no card chosen')
    refusalOf(duel({ banditAt: [5, 4] }), { type: 'combat/playCard', cardUid: 'nope#1', tile: '5,4' }, 'a card not in hand')
    refusalOf({ ...st, phase: 'victory' }, { type: 'combat/endTurn' }, 'a battle already over')

    // a real charge with no seat to strike from — the refusal GATE3-04 hit live (`noPath`)
    const walled = withHand(seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 5, 4)] }, grid: { obstacles: [at(3, 4)] } }), 'mc', ['lord_charge'])
    refusalOf(walled, { type: 'combat/playCard', cardUid: handUid(walled, 'mc', 'lord_charge'), tile: '5,4' }, 'a charge with no way through')

    expect(measured.length).toBeGreaterThan(20)
    for (const m of measured) expectFragment(m.reason, m.where)
    // and each rule says something of its own: a table of one repeated sentence would pass the shape check
    expect(new Set(measured.map((m) => m.reason)).size).toBeGreaterThan(12)
  })

  it('the board this is measured on is the one it claims — a guard on the guard', () => {
    const st = field()
    expect(oak().id).toBe('oak')
    expect(st.units.oak?.position).not.toBeNull()
    expect(st.units.bandit?.position).toBe('4,4')
  })
})
