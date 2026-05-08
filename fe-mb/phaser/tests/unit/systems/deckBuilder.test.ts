import { describe, it, expect } from 'vitest'
import { buildDeck } from '../../../src/systems/deckBuilder'
import type { Unit } from '../../../src/domain/unit'
import type { Item } from '../../../src/domain/item'
import type { ClassDef } from '../../../src/domain/class'
import { asUnitId, asClassId, asCardId, asItemId } from '../../../src/domain/ids'

const lordClass: ClassDef = {
  id: asClassId('lord'), name: 'Lord',
  baseStats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 },
  growthRates: { str: 50, mag: 10, skl: 50, spd: 40, def: 30, res: 20 },
  innateCardIds: [asCardId('rally'), asCardId('inspiring_strike')],
  startingMov: 5, startingHp: 20,
}

const ironSword: Item = {
  id: asItemId('iron_sword'), name: 'Iron Sword', kind: 'weapon_1h',
  weaponType: 'sword', rarity: 'common', region: 'borderlands',
  gearCards: [asCardId('slash'), asCardId('thrust'), asCardId('guard_break')],
  isTwoHanded: false, gridSize: { width: 1, height: 3 },
  range: { min: 1, max: 1 }, buyPrice: 120, sellPrice: 60,
}

const ironBuckler: Item = {
  id: asItemId('iron_buckler'), name: 'Iron Buckler', kind: 'shield',
  rarity: 'common', region: 'borderlands',
  gearCards: [asCardId('block'), asCardId('parry')],
  isTwoHanded: false, gridSize: { width: 1, height: 2 },
  buyPrice: 80, sellPrice: 40,
}

const greatsword: Item = {
  id: asItemId('iron_greatsword'), name: 'Iron Greatsword', kind: 'weapon_2h',
  weaponType: 'sword', rarity: 'common', region: 'borderlands',
  gearCards: [asCardId('heavy_slash'), asCardId('cleave'), asCardId('overhead'), asCardId('whirlwind')],
  isTwoHanded: true, gridSize: { width: 2, height: 4 },
  range: { min: 1, max: 1 }, buyPrice: 200, sellPrice: 100,
}

const mkUnit = (left: string | null, right: string | null): Unit => ({
  id: asUnitId('roy'), name: 'Roy', classId: asClassId('lord'), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 },
  hand: { left: left ? asItemId(left) : null, right: right ? asItemId(right) : null },
  position: null, ap: 3, armor: 0, statuses: [],
})

describe('deckBuilder', () => {
  it('1H + 1H = innate + leftCards + rightCards', () => {
    const items = new Map([[ironSword.id, ironSword], [ironBuckler.id, ironBuckler]])
    const deck = buildDeck(mkUnit('iron_sword', 'iron_buckler'), lordClass, items)
    expect(deck.length).toBe(2 + 3 + 2) // 7
    expect(deck.filter(c => c.source === 'innate').length).toBe(2)
    expect(deck.filter(c => c.source === 'hand_left').length).toBe(3)
    expect(deck.filter(c => c.source === 'hand_right').length).toBe(2)
  })

  it('2H weapon contributes all its cards from left slot, right slot is empty', () => {
    const items = new Map([[greatsword.id, greatsword]])
    const deck = buildDeck(mkUnit('iron_greatsword', null), lordClass, items)
    expect(deck.length).toBe(2 + 4)
    expect(deck.filter(c => c.source === 'hand_left').length).toBe(4)
    expect(deck.filter(c => c.source === 'hand_right').length).toBe(0)
  })

  it('empty hands = innate only', () => {
    const deck = buildDeck(mkUnit(null, null), lordClass, new Map())
    expect(deck.length).toBe(2)
    expect(deck.every(c => c.source === 'innate')).toBe(true)
  })

  it('unknown itemId throws', () => {
    expect(() => buildDeck(mkUnit('phantom', null), lordClass, new Map())).toThrow()
  })
})
