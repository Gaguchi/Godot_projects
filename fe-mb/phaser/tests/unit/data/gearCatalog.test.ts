import { describe, it, expect } from 'vitest'
import { ItemSchema, CardSchema } from '../../../src/data/schemas'
import itemsJson from '../../../src/data/content/items.json'
import cardsJson from '../../../src/data/content/cards.json'

/**
 * Gear content catalog — ship plan 2026-03-29 §7 completeness contract.
 *
 * NOTE on totals: §7's "Total Gear Count" summary table says 39 items
 * (12/17/3/4/3 by rarity), but its own detail tables enumerate 46
 * (12 common / 24 uncommon / 3 rare / 4 epic / 3 legendary) — the summary
 * undercounts uncommon 1H weapons (15 enumerated vs 9 claimed) and uncommon
 * shields (4 enumerated vs 3 claimed). The catalog implements EVERY item in
 * the detail tables, so these tests assert the detail-table totals. The
 * discrepancy is logged in docs/research/gear-content-deviations.md.
 */

const GEAR_KINDS = new Set(['weapon', 'shield', 'quiver', 'tome', 'staff'])

const items = itemsJson.map((raw) => ItemSchema.parse(raw))
const cards = cardsJson.map((raw) => CardSchema.parse(raw))
const gear = items.filter((i) => GEAR_KINDS.has(i.kind))
const cardIds = new Set(cards.map((c) => c.id))

describe('gear catalog (ship plan §7)', () => {
  it('every items.json entry parses via ItemSchema', () => {
    for (const raw of itemsJson) {
      expect(() => ItemSchema.parse(raw), `item '${(raw as { id?: string }).id}' failed schema`).not.toThrow()
    }
  })

  it('every cards.json entry parses via CardSchema', () => {
    for (const raw of cardsJson) {
      expect(() => CardSchema.parse(raw), `card '${(raw as { id?: string }).id}' failed schema`).not.toThrow()
    }
  })

  it('has 46 gear items total (§7 detail tables), excluding consumables', () => {
    expect(gear.length).toBe(46)
    // consumables ride along untouched
    expect(items.length - gear.length).toBe(3)
  })

  it('matches §7 detail-table totals by rarity', () => {
    const byRarity: Record<string, number> = {}
    for (const g of gear) byRarity[g.rarity] = (byRarity[g.rarity] ?? 0) + 1
    expect(byRarity).toEqual({
      common: 12,
      uncommon: 24,
      rare: 3,
      epic: 4,
      legendary: 3,
    })
  })

  it('matches §7 detail-table totals by kind', () => {
    const byKind: Record<string, number> = {}
    for (const g of gear) byKind[g.kind] = (byKind[g.kind] ?? 0) + 1
    expect(byKind).toEqual({
      weapon: 27,
      shield: 7,
      quiver: 5,
      tome: 4,
      staff: 3,
    })
  })

  it('every gearCardIds entry resolves to a card in cards.json', () => {
    for (const g of gear) {
      for (const cid of g.gearCardIds ?? []) {
        expect(cardIds.has(cid), `item '${g.id}' references missing card '${cid}'`).toBe(true)
      }
    }
  })

  it('quivers contribute no cards; only Standard Quiver lacks a modifier', () => {
    const quivers = gear.filter((g) => g.kind === 'quiver')
    expect(quivers.length).toBe(5)
    for (const q of quivers) {
      expect(q.gearCardIds, `quiver '${q.id}' must not contribute cards`).toBeUndefined()
      if (q.id === 'standard_quiver') {
        expect(q.quiverModifier).toBeUndefined()
      } else {
        expect(q.quiverModifier, `quiver '${q.id}' must have a modifier`).toBeDefined()
      }
    }
  })

  it('card-bearing gear contributes 3-4 cards (6 for two-handed)', () => {
    for (const g of gear) {
      if (g.kind === 'quiver') continue
      const n = g.gearCardIds?.length ?? 0
      if (g.twoHanded === true) {
        expect(n, `2H '${g.id}' should contribute 6 cards, got ${n}`).toBe(6)
      } else {
        expect(n, `1H '${g.id}' should contribute 3-4 cards, got ${n}`).toBeGreaterThanOrEqual(3)
        expect(n, `1H '${g.id}' should contribute 3-4 cards, got ${n}`).toBeLessThanOrEqual(4)
      }
    }
  })

  it('has no duplicate card ids and no duplicate item ids', () => {
    expect(cardIds.size).toBe(cards.length)
    const itemIds = new Set(items.map((i) => i.id))
    expect(itemIds.size).toBe(items.length)
  })

  it('follows §11 economy: sell = 50% of buy for shop rarities; epic/legendary are sell-only', () => {
    for (const g of gear) {
      if (g.rarity === 'epic' || g.rarity === 'legendary') {
        expect(g.buyPrice, `'${g.id}' (${g.rarity}) is not sold — buyPrice must be 0`).toBe(0)
        const [lo, hi] = g.rarity === 'epic' ? [300, 500] : [500, 800]
        expect(g.sellPrice, `'${g.id}' sellPrice outside §11 band`).toBeGreaterThanOrEqual(lo)
        expect(g.sellPrice, `'${g.id}' sellPrice outside §11 band`).toBeLessThanOrEqual(hi)
      } else {
        expect(g.sellPrice * 2, `'${g.id}' sellPrice must be 50% of buyPrice`).toBe(g.buyPrice)
      }
    }
  })
})
