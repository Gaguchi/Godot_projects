import { describe, it, expect } from 'vitest'
import { buildDeckForUnit, type DeckBuildDeps } from '../../../src/systems/deckBuilder'
import type { Item } from '../../../src/domain/item'
import type { Unit } from '../../../src/domain/unit'
import type { ItemId } from '../../../src/domain/ids'
import { asUnitId, asItemId } from '../../../src/domain/ids'

const iid = (s: string): ItemId => asItemId(s)

const ITEMS: Record<string, Item> = {
  iron_sword: {
    id: iid('iron_sword'), name: 'Iron Sword', kind: 'weapon', weaponClass: 'sword',
    rarity: 'common', region: 'borderlands', gridSize: { width: 1, height: 2 },
    buyPrice: 80, sellPrice: 40,
    gearCardIds: ['iron_sword_slash', 'iron_sword_thrust', 'iron_sword_guard_break'],
  },
  iron_buckler: {
    id: iid('iron_buckler'), name: 'Iron Buckler', kind: 'shield', weaponClass: 'shield',
    rarity: 'common', region: 'borderlands', gridSize: { width: 1, height: 1 },
    buyPrice: 60, sellPrice: 30,
    gearCardIds: ['buckler_block', 'buckler_parry', 'buckler_deflect'],
  },
  darkwood_bow: {
    id: iid('darkwood_bow'), name: 'Darkwood Bow', kind: 'weapon', weaponClass: 'bow',
    rarity: 'uncommon', region: 'thornwood', gridSize: { width: 1, height: 3 },
    buyPrice: 160, sellPrice: 80,
    gearCardIds: ['darkwood_thorn_arrow', 'darkwood_natures_aim', 'darkwood_briar_volley'],
  },
  poison_quiver: {
    id: iid('poison_quiver'), name: 'Poison Quiver', kind: 'quiver',
    rarity: 'uncommon', region: 'thornwood', gridSize: { width: 1, height: 1 },
    buyPrice: 120, sellPrice: 60,
    quiverModifier: { kind: 'poison', value: 2, turns: 2 },
  },
  iron_greatsword: {
    id: iid('iron_greatsword'), name: 'Iron Greatsword', kind: 'weapon', weaponClass: 'greatsword',
    twoHanded: true, rarity: 'common', region: 'borderlands', gridSize: { width: 2, height: 3 },
    buyPrice: 150, sellPrice: 75,
    gearCardIds: ['gs_a', 'gs_b', 'gs_c', 'gs_d', 'gs_e', 'gs_f'],
  },
}

const INNATE = ['lord_rally', 'lord_inspiring_strike', 'lord_nobility', 'lord_command']
const DAMAGE_CARDS = new Set([
  'iron_sword_slash', 'iron_sword_thrust', 'iron_sword_guard_break',
  'darkwood_thorn_arrow', 'darkwood_natures_aim', 'darkwood_briar_volley',
  'lord_inspiring_strike', 'gs_a', 'gs_b',
])

const deps: DeckBuildDeps = {
  itemById: id => ITEMS[id as unknown as string],
  innateCardIds: INNATE,
  cardDealsDamage: id => DAMAGE_CARDS.has(id),
}

const mkUnit = (handLeft: string | null, handRight: string | null): Unit => ({
  id: asUnitId('roy'), name: 'Roy', classId: 'lord' as never, level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 4 },
  position: null, ap: 3, armor: 0, statuses: [],
  handLeft: handLeft ? iid(handLeft) : null,
  handRight: handRight ? iid(handRight) : null,
})

describe('buildDeckForUnit', () => {
  it('composes innate + left + right with source tags (sword + shield)', () => {
    const deck = buildDeckForUnit(mkUnit('iron_sword', 'iron_buckler'), deps)
    expect(deck.draw).toHaveLength(4 + 3 + 3)
    expect(deck.hand).toHaveLength(0) // dealt by the reducer at startBattle
    expect(deck.sources?.['lord_rally']).toBe('innate')
    expect(deck.sources?.['iron_sword_slash']).toBe('hand_left')
    expect(deck.sources?.['buckler_block']).toBe('hand_right')
    expect(deck.cardMods).toBeUndefined()
  })

  it('empty slots contribute nothing (innate-only unit)', () => {
    const deck = buildDeckForUnit(mkUnit(null, null), deps)
    expect(deck.draw).toHaveLength(4)
    expect(Object.values(deck.sources ?? {}).every(s => s === 'innate')).toBe(true)
  })

  it('2H weapon contributes its full card set from the left slot', () => {
    const deck = buildDeckForUnit(mkUnit('iron_greatsword', null), deps)
    expect(deck.draw).toHaveLength(4 + 6)
    expect(deck.sources?.['gs_a']).toBe('hand_left')
  })

  it('bow + quiver: mods attach to bow DAMAGE cards only', () => {
    const deck = buildDeckForUnit(mkUnit('darkwood_bow', 'poison_quiver'), deps)
    expect(deck.cardMods?.['darkwood_thorn_arrow']?.kind).toBe('poison')
    expect(deck.cardMods?.['darkwood_natures_aim']?.kind).toBe('poison')
    // innate damage card is NOT bow-sourced → no mod
    expect(deck.cardMods?.['lord_inspiring_strike']).toBeUndefined()
  })

  it('quiver in LEFT hand modifies a bow in RIGHT hand', () => {
    const deck = buildDeckForUnit(mkUnit('poison_quiver', 'darkwood_bow'), deps)
    expect(deck.cardMods?.['darkwood_thorn_arrow']?.kind).toBe('poison')
  })

  it('quiver without a bow does nothing', () => {
    const deck = buildDeckForUnit(mkUnit('iron_sword', 'poison_quiver'), deps)
    expect(deck.cardMods).toBeUndefined()
    expect(deck.draw).toHaveLength(4 + 3) // quiver adds no cards
  })

  it('bow without a quiver has no mods', () => {
    const deck = buildDeckForUnit(mkUnit('darkwood_bow', null), deps)
    expect(deck.cardMods).toBeUndefined()
  })

  it('returns detached arrays (mutating draw leaves nothing aliased)', () => {
    const deck = buildDeckForUnit(mkUnit('iron_sword', null), deps)
    expect(deck.draw).not.toBe(deck.hand)
    deck.draw.pop()
    expect(buildDeckForUnit(mkUnit('iron_sword', null), deps).draw).toHaveLength(7)
  })
})
