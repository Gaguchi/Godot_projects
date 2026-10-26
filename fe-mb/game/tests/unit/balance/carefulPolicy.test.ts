/**
 * `combat/sim.ts#carefulPolicy` — the player the balance gate measures (0110).
 *
 * Every row of `npm run cli -- balance` printed "careful-player policy" while running `greedyPolicy` underneath,
 * and a greedy player is not a careful one in the two ways that decide a permadeath road: he never drinks and he
 * never holds the line. Measured, that gap WAS the difficulty reading — the same shipped rules gave a 25% road
 * clear under greedy play and an 88% one under careful play, so the bands were policing a player nobody plays as
 * (RE-GATE C 3.15). These cases pin the two verbs the policy adds and the fall-through to greedy.
 */
import { describe, expect, it } from 'vitest'
import { carefulPolicy, greedyPolicy } from '../../../src/engine/combat/sim'
import { env, mc, oak, seed, patchUnit, activate, placeAt, authored, unitFromClass } from '../../helpers/battles'
import type { CombatState } from '../../../src/engine/types'

const e = env()

function field(consumables: readonly string[] = []): CombatState {
  let st = seed({
    party: [mc(), oak(), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })],
    enemies: { kind: 'authored', units: [authored('b', 'bandit', 5, 4), authored('c', 'bandit', 5, 5)] },
    seed: 2,   // the deal that puts Oak's Cover in his opening hand
    consumables,
  })
  st = placeAt(st, 'oak', 3, 4)
  st = placeAt(st, 'mc', 2, 4)
  st = placeAt(st, 'lilina', 1, 4)
  return st
}

/** The uid in Oak's hand whose card puts `taunt` on himself, if the deal gave him one. */
function tauntUid(st: CombatState): string | undefined {
  return st.decks['oak']?.hand.find((uid) => {
    const inst = st.decks['oak']?.cards[uid]
    const card = inst === undefined ? undefined : e.content.cards[inst.cardId]
    return card !== undefined && card.targetKind === 'self' && card.effects.some((x) => x.kind === 'ApplyStatus' && x.effectId === 'taunt')
  })
}

describe('combat/sim — the careful player', () => {
  it('holds the line: with a frailer ally on the field and foes closing, the tank plays its taunt', () => {
    const st = activate(field(), 'oak')
    const uid = tauntUid(st)
    expect(uid, 'the shield knight was dealt no taunt to play').toBeDefined()
    expect(carefulPolicy(st, e)).toEqual({ type: 'combat/playCard', cardUid: uid, tile: null })
    // and the greedy player, measured on the same board, does not
    expect(greedyPolicy(st, e)).not.toEqual({ type: 'combat/playCard', cardUid: uid, tile: null })
  })

  it('does not spend the turn taunting when it is already taunting', () => {
    let st = activate(field(), 'oak')
    st = patchUnit(st, 'oak', { statuses: [{ id: 'taunt', stacks: 1, turns: 1, expiresAt: 'ownerTurnStart', sourceId: 'oak' }] })
    expect(carefulPolicy(st, e)).toEqual(greedyPolicy(st, e))
  })

  it('does not put a DYING tank in front: below the low-HP mark it fights instead of standing there', () => {
    const st = activate(field(), 'oak')
    const max = st.units['oak']!.hp.max
    const dying = patchUnit(st, 'oak', { hp: { current: Math.floor(max * e.rules.combat.aiLowHpFraction) - 1, max } })
    expect(carefulPolicy(dying, e)).toEqual(greedyPolicy(dying, e))
  })

  it('taunts on round ONE, before anyone is hurt: the mage cannot afford the blow at full health either', () => {
    const st = activate(field(), 'oak')
    for (const u of Object.values(st.units)) expect(u.hp.current).toBe(u.hp.max)
    expect(carefulPolicy(st, e)).toEqual({ type: 'combat/playCard', cardUid: tauntUid(st), tile: null })
  })

  it('drinks before it swings when a unit is about to be lost, and only then', () => {
    const potion = 'healing_potion'
    let st = activate(field([potion]), 'mc')
    const full = carefulPolicy(st, e)
    expect(full).not.toEqual({ type: 'combat/useItem', itemId: potion })
    const unit = st.units['mc']!
    st = patchUnit(st, 'mc', { hp: { current: Math.floor(unit.hp.max * e.rules.combat.aiLowHpFraction) - 1, max: unit.hp.max } })
    expect(carefulPolicy(st, e)).toEqual({ type: 'combat/useItem', itemId: potion })
  })

  it('does not reach for a potion the satchel does not hold', () => {
    let st = activate(field(), 'mc')
    const unit = st.units['mc']!
    st = patchUnit(st, 'mc', { hp: { current: 1, max: unit.hp.max } })
    expect(carefulPolicy(st, e)).toEqual(greedyPolicy(st, e))
  })
})
