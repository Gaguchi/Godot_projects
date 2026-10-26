/**
 * combat/deck.ts — gear-as-deck (brief §2.7).
 * Deck = class innate cards + handLeft gear cards + handRight gear cards + character signature cards,
 * each a `CardInstance` tagged by source with uid `${cardId}#${n}`. A 2H item occupies the left hand
 * (6 cards) and the right must be null. A quiver contributes 0 cards and bakes its `quiverModifier`
 * onto the DAMAGE cards of a `weaponClass: 'bow'` item in the other hand; quiver alone / bow alone /
 * 2H bow ⇒ no modifier. All cards start in draw, hand empty. Returned arrays are detached.
 */
import type { Card, CardEffect, CardInstance, CardSource, CardUid, DeckState, EngineEnv, Item, QuiverModifier, RngState, Unit } from '../types'
import { createRng, type RNG } from '../rng'
import { rngState } from '../rngState'

function dealsDamage(card: Card): boolean {
  return card.effects.some((e) => e.kind === 'Damage')
}

export function buildDeck(unit: Unit, env: EngineEnv): DeckState {
  const { cards: cardDefs, classes, items } = env.content
  const cls = classes[unit.classId]
  if (cls === undefined) throw new Error(`combat/deck: unit '${unit.id}' has unknown class '${unit.classId}'`)
  const itemOf = (id: string | null): Item | null => {
    if (id === null) return null
    const item = items[id]
    if (item === undefined) throw new Error(`combat/deck: unit '${unit.id}' holds unknown item '${id}'`)
    return item
  }
  const left = itemOf(unit.handLeft)
  const right = itemOf(unit.handRight)
  // A 2H item occupies the left hand and LOCKS the right (§2.7). The equipment planner guarantees it, so a
  // violation here is a programmer error — fail loudly, never build a half-deck (§7.20).
  if (left?.twoHanded === true && right !== null) throw new Error(`combat/deck: unit '${unit.id}' holds two-handed '${left.id}' with a right-hand item`)

  // Quiver pairing (§2.7): a quiver in one hand modifies the DAMAGE cards of a bow in the other, at build time.
  // A 2H bow never pairs (its right hand is locked); quiver alone or bow alone ⇒ nothing.
  const modFor = (bow: Item | null, other: Item | null): QuiverModifier | null => {
    if (bow === null || other === null) return null
    if (bow.weaponClass !== env.rules.gear.quiverPairsWith || bow.twoHanded === true) return null
    if (other.kind !== 'quiver' || other.quiverModifier === undefined) return null
    return other.quiverModifier
  }
  const leftMod = modFor(left, right)
  const rightMod = modFor(right, left)

  const entries: { readonly cardId: string; readonly source: CardSource; readonly mod: QuiverModifier | null }[] = []
  for (const cardId of cls.innateCardIds) entries.push({ cardId, source: 'innate', mod: null })
  for (const cardId of left?.gearCardIds ?? []) entries.push({ cardId, source: 'hand_left', mod: leftMod })
  for (const cardId of right?.gearCardIds ?? []) entries.push({ cardId, source: 'hand_right', mod: rightMod })
  for (const cardId of unit.signatureCardIds) entries.push({ cardId, source: 'signature', mod: null })

  const counts = new Map<string, number>()
  const cards: Record<CardUid, CardInstance> = {}
  const draw: CardUid[] = []
  for (const e of entries) {
    const def = cardDefs[e.cardId]
    if (def === undefined) throw new Error(`combat/deck: unit '${unit.id}' deck names unknown card '${e.cardId}'`)
    const n = (counts.get(e.cardId) ?? 0) + 1
    counts.set(e.cardId, n)
    const uid: CardUid = `${e.cardId}#${n}`
    cards[uid] = { uid, cardId: e.cardId, source: e.source, mod: e.mod !== null && dealsDamage(def) ? e.mod : null }
    draw.push(uid)
  }
  return { cards, draw, hand: [], discard: [] }
}

/**
 * The ONE table mapping a baked quiver modifier to the effects `resolvePlay` appends after the card's own
 * (foes only; `value`/`turns` from the item):
 *   poison    → `ApplyStatus { target: 'target', effectId: 'poison', value, turns }`
 *   slow      → `ApplyStatus { target: 'target', effectId: 'slow',   value, turns }`
 *   thunder   → `Damage { target: 'target', base: value, damageType: 'physical', armorPiercing: true }`
 *               (`forecast` shows it as `quiverTerm`)
 *   explosive → `Damage { target: 'ring', base: value, damageType: 'physical' }` — foes ADJACENT to the target, centre excluded.
 * Quiver Damage is FLAT (no stat, no DR — "+3 armor-ignoring", "3 physical to adjacent foes", §2.7); `resolvePlay`
 * therefore sends it through `dealFlatDamage`, and the `forecast` adds it as `quiverTerm` after DR.
 */
export function quiverEffects(mod: QuiverModifier): readonly CardEffect[] {
  switch (mod.kind) {
    case 'poison':
      return [{ kind: 'ApplyStatus', target: 'target', effectId: 'poison', value: mod.value, turns: mod.turns }]
    case 'slow':
      return [{ kind: 'ApplyStatus', target: 'target', effectId: 'slow', value: mod.value, turns: mod.turns }]
    case 'thunder':
      return [{ kind: 'Damage', target: 'target', base: mod.value, damageType: 'physical', armorPiercing: true }]
    case 'explosive':
      return [{ kind: 'Damage', target: 'ring', base: mod.value, damageType: 'physical' }]
  }
}

/** Draws `count`; when draw runs dry, shuffles discard into draw with `rng` (advanced and returned). Zero card loss.
 *  The caller emits `cardsDrawn { uids }` from `deck.hand`'s new tail. */
export function drawCards(deck: DeckState, count: number, rng: RngState): { readonly deck: DeckState; readonly rng: RngState; readonly reshuffled: boolean } {
  let draw = [...deck.draw]
  let discard = [...deck.discard]
  const hand = [...deck.hand]
  let r: RNG | null = null
  let reshuffled = false
  for (let i = 0; i < count; i++) {
    if (draw.length === 0) {
      if (discard.length === 0) break // the whole deck is in hand — nothing to draw, nothing lost
      r ??= createRng(rng)
      draw = r.shuffle(discard)
      discard = []
      reshuffled = true
    }
    const [top, ...rest] = draw
    if (top === undefined) break
    hand.push(top)
    draw = rest
  }
  return { deck: { cards: deck.cards, draw, hand, discard }, rng: r === null ? rng : rngState(r), reshuffled }
}

export function discardHand(deck: DeckState): DeckState {
  if (deck.hand.length === 0) return deck
  return { cards: deck.cards, draw: [...deck.draw], hand: [], discard: [...deck.discard, ...deck.hand] }
}

export function shuffleDraw(deck: DeckState, rng: RngState): { readonly deck: DeckState; readonly rng: RngState } {
  const r = createRng(rng)
  return { deck: { cards: deck.cards, draw: r.shuffle(deck.draw), hand: [...deck.hand], discard: [...deck.discard] }, rng: rngState(r) }
}

/** draw + hand + discard — the invariant the cycle test asserts is constant. */
export function deckSize(deck: DeckState): number {
  return deck.draw.length + deck.hand.length + deck.discard.length
}
