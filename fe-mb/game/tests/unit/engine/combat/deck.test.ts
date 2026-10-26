import { describe, expect, it } from 'vitest'
import { buildDeck, deckSize, discardHand, drawCards, quiverEffects, shuffleDraw } from '../../../../src/engine/combat/deck'
import type { DeckState, QuiverModifier } from '../../../../src/engine/types'
import { env, unitFromClass } from '../../../helpers/battles'

const e = env()
const sources = (deck: DeckState) => Object.values(deck.cards).map((c) => `${c.cardId}:${c.source}`)

describe('combat/deck — buildDeck (§2.7)', () => {
  it('deck = innate + left + right + signature with source tags, all in draw, hand empty', () => {
    const u = unitFromClass('u', 'lord', 'party', { handLeft: 'iron_sword', handRight: 'iron_buckler', signatureCardIds: ['knight_taunt'] })
    const deck = buildDeck(u, e)
    expect(deck.hand).toEqual([])
    expect(deck.discard).toEqual([])
    expect(deck.draw).toHaveLength(5 + 4 + 3 + 1)
    expect(sources(deck)).toEqual([
      'lord_rally:innate', 'lord_inspiring_strike:innate', 'lord_nobility:innate', 'lord_command:innate', 'lord_charge:innate',
      'iron_sword_slash:hand_left', 'iron_sword_thrust:hand_left', 'iron_sword_guard_break:hand_left', 'iron_sword_riposte:hand_left',
      'iron_buckler_block:hand_right', 'iron_buckler_parry:hand_right', 'iron_buckler_deflect:hand_right',
      'knight_taunt:signature',
    ])
    expect(deck.draw).toEqual(Object.keys(deck.cards))
  })

  it('a card id held twice gets distinct uids `<id>#1` / `<id>#2`', () => {
    const u = unitFromClass('u', 'lord', 'party', { handLeft: 'iron_sword', signatureCardIds: ['iron_sword_slash'] })
    const deck = buildDeck(u, e)
    expect(deck.draw).toContain('iron_sword_slash#1')
    expect(deck.draw).toContain('iron_sword_slash#2')
    expect(deck.cards['iron_sword_slash#2']!.source).toBe('signature')
  })

  it('a 2H item occupies the left hand with 6 cards and a filled right hand is a programmer error', () => {
    const two = buildDeck(unitFromClass('u', 'lord', 'party', { handLeft: 'iron_greatsword' }), e)
    expect(Object.values(two.cards).filter((c) => c.source === 'hand_left')).toHaveLength(6)
    expect(() => buildDeck(unitFromClass('u', 'lord', 'party', { handLeft: 'iron_greatsword', handRight: 'iron_buckler' }), e)).toThrow(/two-handed/)
  })

  it('a quiver in one hand bakes its modifier onto the DAMAGE cards of a bow in the other, either way round', () => {
    const left = buildDeck(unitFromClass('u', 'bandit_archer', 'party', { handLeft: 'iron_bow', handRight: 'poison_quiver' }), e)
    const modded = Object.values(left.cards).filter((c) => c.mod !== null)
    expect(modded.map((c) => c.cardId).sort()).toEqual(['iron_bow_aimed_shot', 'iron_bow_quick_shot', 'iron_bow_volley'])
    expect(modded[0]!.mod).toEqual({ kind: 'poison', value: 2, turns: 2 })
    // innate bow cards of the class are NOT modified — only the gear in the other hand
    expect(left.cards['iron_bow_quick_shot#1']!.mod).toBeNull()
    expect(left.cards['iron_bow_quick_shot#2']!.mod).not.toBeNull()
    const right = buildDeck(unitFromClass('u', 'lord', 'party', { handLeft: 'thunder_quiver', handRight: 'steel_bow' }), e)
    expect(Object.values(right.cards).filter((c) => c.mod !== null).map((c) => c.source)).toEqual(['hand_right', 'hand_right', 'hand_right'])
  })

  it('quiver alone, bow alone, a non-bow beside a quiver, and a 2H bow all yield no modifier', () => {
    const noMod = (deck: DeckState) => Object.values(deck.cards).every((c) => c.mod === null)
    expect(noMod(buildDeck(unitFromClass('u', 'lord', 'party', { handLeft: 'poison_quiver' }), e))).toBe(true)
    expect(noMod(buildDeck(unitFromClass('u', 'lord', 'party', { handLeft: 'iron_bow' }), e))).toBe(true)
    expect(noMod(buildDeck(unitFromClass('u', 'lord', 'party', { handLeft: 'iron_sword', handRight: 'poison_quiver' }), e))).toBe(true)
    expect(noMod(buildDeck(unitFromClass('u', 'lord', 'party', { handLeft: 'longbow' }), e))).toBe(true)
  })

  it('unknown class / item / card ids throw (never a half deck)', () => {
    expect(() => buildDeck(unitFromClass('u', 'lord', 'party', { handLeft: 'nope' }), e)).toThrow(/unknown item/)
    expect(() => buildDeck({ ...unitFromClass('u', 'lord', 'party'), classId: 'nope' }, e)).toThrow(/unknown class/)
    expect(() => buildDeck(unitFromClass('u', 'lord', 'party', { signatureCardIds: ['nope'] }), e)).toThrow(/unknown card/)
  })

  it('returned arrays are detached from the inputs', () => {
    const u = unitFromClass('u', 'lord', 'party', { handLeft: 'iron_sword' })
    const deck = buildDeck(u, e)
    const again = buildDeck(u, e)
    expect(deck.draw).not.toBe(again.draw)
    expect(deck).toEqual(again)
  })
})

describe('combat/deck — quiverEffects, one per kind', () => {
  const mod = (kind: QuiverModifier['kind'], value: number, turns: number): QuiverModifier => ({ kind, value, turns })

  it('poison → ApplyStatus poison on the target', () => {
    expect(quiverEffects(mod('poison', 2, 2))).toEqual([{ kind: 'ApplyStatus', target: 'target', effectId: 'poison', value: 2, turns: 2 }])
  })
  it('slow → ApplyStatus slow on the target', () => {
    expect(quiverEffects(mod('slow', 2, 1))).toEqual([{ kind: 'ApplyStatus', target: 'target', effectId: 'slow', value: 2, turns: 1 }])
  })
  it('thunder → armor-piercing physical Damage on the target', () => {
    expect(quiverEffects(mod('thunder', 3, 0))).toEqual([{ kind: 'Damage', target: 'target', base: 3, damageType: 'physical', armorPiercing: true }])
  })
  it('explosive → physical Damage on the ring around the target', () => {
    expect(quiverEffects(mod('explosive', 3, 0))).toEqual([{ kind: 'Damage', target: 'ring', base: 3, damageType: 'physical' }])
  })
})

describe('combat/deck — draw / discard / shuffle', () => {
  const deck = buildDeck(unitFromClass('u', 'lord', 'party', { handLeft: 'iron_sword' }), e) // 9 cards
  const rng = { seed: 11, counter: 0 }

  it('drawCards takes from the top of draw without touching the rng while draw lasts', () => {
    const r = drawCards(deck, 3, rng)
    expect(r.deck.hand).toEqual(deck.draw.slice(0, 3))
    expect(r.deck.draw).toEqual(deck.draw.slice(3))
    expect(r.rng).toBe(rng)
    expect(r.reshuffled).toBe(false)
    expect(deckSize(r.deck)).toBe(9)
  })

  it('drawCards reshuffles the discard into draw when dry, advancing the rng, with zero card loss', () => {
    const dealt = drawCards(deck, 5, rng)
    const spent = discardHand(dealt.deck) // draw 4, discard 5
    const r = drawCards(spent, 5, rng)
    expect(r.reshuffled).toBe(true)
    expect(r.rng.counter).toBeGreaterThan(rng.counter)
    expect(r.deck.hand).toHaveLength(5)
    expect(r.deck.discard).toEqual([])
    expect(r.deck.draw).toHaveLength(4)
    expect(deckSize(r.deck)).toBe(9)
    expect([...r.deck.draw, ...r.deck.hand].sort()).toEqual(Object.keys(deck.cards).sort())
    // deterministic: the same rng position reshuffles the same way
    expect(drawCards(spent, 5, rng).deck).toEqual(r.deck)
  })

  it('drawCards stops when the whole deck is already in hand', () => {
    const all = drawCards(deck, 9, rng)
    const more = drawCards(all.deck, 3, rng)
    expect(more.deck.hand).toHaveLength(9)
    expect(more.reshuffled).toBe(false)
    expect(deckSize(more.deck)).toBe(9)
  })

  it('discardHand moves the whole hand to the discard pile', () => {
    const dealt = drawCards(deck, 4, rng).deck
    const d = discardHand(dealt)
    expect(d.hand).toEqual([])
    expect(d.discard).toEqual(dealt.hand)
    expect(deckSize(d)).toBe(9)
    expect(discardHand(deck)).toBe(deck) // nothing to discard ⇒ same reference
  })

  it('shuffleDraw is a deterministic permutation per rng position', () => {
    const a = shuffleDraw(deck, rng)
    const b = shuffleDraw(deck, rng)
    expect(a.deck.draw).toEqual(b.deck.draw)
    expect([...a.deck.draw].sort()).toEqual([...deck.draw].sort())
    expect(a.rng.counter).toBeGreaterThan(0)
    expect(shuffleDraw(deck, { seed: 12, counter: 0 }).deck.draw).not.toEqual(a.deck.draw)
    expect(deck.draw).toEqual(Object.keys(deck.cards)) // input untouched
  })
})
