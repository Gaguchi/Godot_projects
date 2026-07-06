import { describe, it, expect } from 'vitest'
import { CardSchema, ItemSchema, ClassSchema } from '../../../src/data/schemas'
import { validateContent } from '../../../src/data/load'
import classesJson from '../../../src/data/content/classes.json'
import itemsJson from '../../../src/data/content/items.json'
import cardsJson from '../../../src/data/content/cards.json'

describe('representative content', () => {
  it('classes.json passes ClassSchema (player classes + enemy classes incl. warlord boss)', () => {
    expect(classesJson.length).toBeGreaterThanOrEqual(4)
    for (const c of classesJson) {
      expect(() => ClassSchema.parse(c)).not.toThrow()
    }
  })

  it('items.json passes ItemSchema (consumables + gear)', () => {
    expect(itemsJson.length).toBeGreaterThanOrEqual(3)
    const kinds = new Set(itemsJson.map(i => i.kind))
    expect(kinds.has('food')).toBe(true)
    for (const i of itemsJson) {
      expect(() => ItemSchema.parse(i)).not.toThrow()
    }
  })

  it('cards.json passes CardSchema (~50 cards, ≥40)', () => {
    expect(cardsJson.length).toBeGreaterThanOrEqual(40)
    for (const c of cardsJson) {
      expect(() => CardSchema.parse(c)).not.toThrow()
    }
  })

  it('validateContent succeeds for the full bundle', () => {
    const r = validateContent({
      cards: cardsJson,
      units: [],
      items: itemsJson,
      classes: classesJson,
      quests: [],
      dialogues: [],
      battleMaps: [],
      worldMaps: [],
    })
    expect(r.ok).toBe(true)
  })

  it('every innate card referenced by a class exists in cards.json', () => {
    const cardIds = new Set(cardsJson.map((c) => c.id))
    for (const cls of classesJson) {
      for (const cardId of cls.innateCardIds) {
        expect(cardIds.has(cardId), `Missing card: ${cardId}`).toBe(true)
      }
    }
  })
})
