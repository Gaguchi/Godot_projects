/**
 * `rules.gear` had no reader anywhere in the tree: `cardsPerOneHanded`, `cardsPerTwoHanded`, `cardsPerQuiver` and
 * `deckSizeRange` were four constants nobody consulted, and the shipped decks already violated the last one — the
 * starting hands build 7-11 cards against an authored floor of 10 (BAL-09). CONTRACT §8: a value lives in
 * `rules.ts` or in content, and "a test that needs it reads `env.rules`" — this file is that reader, so the
 * constants now fail loudly when content drifts away from them instead of documenting a fiction.
 *
 * Deck size is a live balance driver, not bookkeeping: `rules.combat.handSize` is 5, so an 8-card deck is redrawn
 * whole about every other turn and the opening burst is maximally consistent.
 */
import { describe, expect, it } from 'vitest'
import { createEnv } from '../../../src/engine/content'
import type { Item, UnitCharacter } from '../../../src/engine/types'

const env = createEnv()
const { gear, combat } = env.rules
const cardBearing = (it: Item): boolean => (it.gearCardIds?.length ?? 0) > 0 || it.kind === 'weapon' || it.kind === 'shield'
const partyCharacters = Object.values(env.content.characters).filter((c): c is UnitCharacter => c.kind === 'unit' && c.team === 'party')

function deckSize(ch: UnitCharacter): number {
  const cls = env.content.classes[ch.classId]!
  const hands = [ch.startingGear.left, ch.startingGear.right]
  const gearCards = hands.reduce((n, id) => n + (id === null ? 0 : env.content.items[id]?.gearCardIds?.length ?? 0), 0)
  return cls.innateCardIds.length + ch.signatureCardIds.length + gearCards
}

describe('rules.gear card counts describe the shipped gear', () => {
  it('every card-bearing item carries exactly what its slot allows', () => {
    for (const it of Object.values(env.content.items)) {
      if (it.kind === 'quiver') {
        expect(it.gearCardIds?.length ?? 0, `quiver ${it.id}`).toBe(gear.cardsPerQuiver)
        continue
      }
      if (!cardBearing(it)) continue
      const n = it.gearCardIds?.length ?? 0
      if (it.twoHanded === true) expect(n, `2H ${it.id}`).toBe(gear.cardsPerTwoHanded)
      else {
        expect(n, `1H ${it.id}`).toBeGreaterThanOrEqual(gear.cardsPerOneHanded[0])
        expect(n, `1H ${it.id}`).toBeLessThanOrEqual(gear.cardsPerOneHanded[1])
      }
    }
  })

  it('quivers pair with the weapon class the rules name', () => {
    for (const it of Object.values(env.content.items)) {
      if (it.kind !== 'quiver') continue
      expect(it.quiverModifier, `quiver ${it.id}`).toBeDefined()
    }
    expect(Object.values(env.content.items).some((it) => it.weaponClass === gear.quiverPairsWith)).toBe(true)
  })
})

describe('rules.gear.deckSizeRange brackets the decks the game actually builds', () => {
  it('every party character starts inside the band', () => {
    expect(partyCharacters.length).toBeGreaterThan(0)
    for (const ch of partyCharacters) {
      const n = deckSize(ch)
      expect(n, `${ch.id} deck`).toBeGreaterThanOrEqual(gear.deckSizeRange[0])
      expect(n, `${ch.id} deck`).toBeLessThanOrEqual(gear.deckSizeRange[1])
    }
  })

  it('the band is reachable at both ends and never below the hand it feeds', () => {
    // the ceiling: the richest legal pair of hands on the richest chassis
    const richestClass = Math.max(...Object.values(env.content.classes).map((c) => c.innateCardIds.length))
    expect(gear.deckSizeRange[1]).toBe(richestClass + 2 * gear.cardsPerOneHanded[1])
    // the floor: the smallest deck any shipped starting loadout builds
    expect(gear.deckSizeRange[0]).toBe(Math.min(...partyCharacters.map(deckSize)))
    // and a deck the size of the hand is drawn whole every turn — the floor must clear it (content lint's rule)
    expect(gear.deckSizeRange[0]).toBeGreaterThan(combat.handSize)
  })
})
