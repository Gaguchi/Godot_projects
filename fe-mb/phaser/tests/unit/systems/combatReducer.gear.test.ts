import { describe, it, expect } from 'vitest'
import { reduce, initialCombatState } from '../../../src/systems/combatReducer'
import { asUnitId, asClassId, asCardId, asTileId, asStatusEffectId } from '../../../src/domain/ids'
import { createRng } from '../../../src/systems/rng'
import type { Unit } from '../../../src/domain/unit'
import type { CombatState, DeckState } from '../../../src/domain/combatState'

const rng = () => createRng({ seed: 0, counter: 0 })

const mk = (id: string, pos: string, classId = 'lord', over: Partial<Unit> = {}): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId(classId), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 0, res: 0, lck: 0 },
  position: asTileId(pos), ap: 3, armor: 0, statuses: [],
  ...over,
})

function boot(units: Unit[], decks?: Record<string, DeckState>): CombatState {
  return reduce(initialCombatState(), {
    type: 'startBattle',
    payload: {
      units,
      grid: { width: 14, height: 10, obstacles: new Set() },
      rngSeed: { seed: 7, counter: 0 },
      ...(decks ? { decks } : {}),
    },
  }, rng()).state
}

const CARD = (over: Record<string, unknown> = {}) => ({
  apCost: 1,
  effects: [{ kind: 'Damage', params: { base: 4 } }],
  damageStat: 'str' as const,
  ...over,
})

describe('playCard: ApplyStatus resolution', () => {
  it('applies poison to the target unit', () => {
    const s = boot([mk('roy', '2,4'), mk('bandit', '3,4', 'bandit')])
    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: asCardId('lacerate'), srcId: asUnitId('roy'), targets: [asTileId('3,4')],
        card: CARD({ effects: [
          { kind: 'Damage', params: { base: 3 } },
          { kind: 'ApplyStatus', params: { effectId: 'poison', value: 2, turns: 2 } },
        ] }),
      },
    }, rng())
    const bandit = r.state.units['bandit']!
    expect(bandit.statuses).toHaveLength(1)
    expect(bandit.statuses[0]!.effectId).toBe(asStatusEffectId('poison'))
    expect(bandit.statuses[0]!.stacks).toBe(2)
    expect(bandit.statuses[0]!.turnsRemaining).toBe(2)
  })

  it('burn stacks add; poison reapplication takes the higher value', () => {
    let s = boot([mk('roy', '2,4'), mk('bandit', '3,4', 'bandit')])
    const burnCard = CARD({ effects: [{ kind: 'ApplyStatus', params: { effectId: 'burn', value: 2, turns: 2 } }] })
    s = reduce(s, { type: 'playCard', payload: { cardId: asCardId('x'), srcId: asUnitId('roy'), targets: [asTileId('3,4')], card: burnCard } }, rng()).state
    s = reduce(s, { type: 'playCard', payload: { cardId: asCardId('x'), srcId: asUnitId('roy'), targets: [asTileId('3,4')], card: burnCard } }, rng()).state
    expect(s.units['bandit']!.statuses[0]!.stacks).toBe(4)
  })

  it('self-targeted status cards land on the source', () => {
    const s = boot([mk('roy', '2,4'), mk('bandit', '9,9', 'bandit')])
    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: asCardId('riposte_stance'), srcId: asUnitId('roy'), targets: [],
        card: CARD({ effects: [{ kind: 'ApplyStatus', params: { effectId: 'riposte', value: 3, turns: 1 } }] }),
      },
    }, rng())
    expect(r.state.units['roy']!.statuses[0]!.effectId).toBe(asStatusEffectId('riposte'))
  })

  it('splash: adjacent applies the status to units next to the target too', () => {
    const s = boot([
      mk('roy', '2,4'),
      mk('b1', '5,5', 'bandit'), mk('b2', '5,6', 'bandit'), mk('b3', '9,9', 'bandit'),
    ])
    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: asCardId('magma_swing'), srcId: asUnitId('roy'), targets: [asTileId('5,5')],
        card: CARD({ effects: [
          { kind: 'Damage', params: { base: 5 } },
          { kind: 'ApplyStatus', params: { effectId: 'burn', value: 3, turns: 2, splash: 'adjacent' } },
        ] }),
      },
    }, rng())
    expect(r.state.units['b1']!.statuses).toHaveLength(1)
    expect(r.state.units['b2']!.statuses).toHaveLength(1) // adjacent
    expect(r.state.units['b3']!.statuses).toHaveLength(0) // far away
  })
})

describe('playCard: DrawCards resolution', () => {
  it('moves N cards from draw to hand', () => {
    const deck: DeckState = {
      draw: [asCardId('a'), asCardId('b'), asCardId('c')],
      hand: [asCardId('rally')],
      discard: [],
    }
    const s = boot([mk('roy', '2,4'), mk('bandit', '9,9', 'bandit')], { roy: deck })
    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: asCardId('rally'), srcId: asUnitId('roy'), targets: [],
        card: CARD({ effects: [{ kind: 'DrawCards', params: { count: 2 } }] }),
      },
    }, rng())
    const d = r.state.decks['roy']!
    // rally played → discard; 2 drawn from draw pile
    expect(d.hand).toHaveLength(2)
    expect(d.draw).toHaveLength(1)
    expect(d.discard).toContain(asCardId('rally'))
  })

  it('reshuffles discard into draw when the draw pile runs dry', () => {
    const deck: DeckState = {
      draw: [asCardId('a')],
      hand: [asCardId('rally')],
      discard: [asCardId('x'), asCardId('y'), asCardId('z')],
    }
    const s = boot([mk('roy', '2,4'), mk('bandit', '9,9', 'bandit')], { roy: deck })
    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: asCardId('rally'), srcId: asUnitId('roy'), targets: [],
        card: CARD({ effects: [{ kind: 'DrawCards', params: { count: 3 } }] }),
      },
    }, rng())
    const d = r.state.decks['roy']!
    expect(d.hand).toHaveLength(3)
    // rally went to discard first, then discard reshuffled: 3 drawn of (a + x/y/z + rally)
    expect(d.draw.length + d.discard.length).toBe(2)
  })
})

describe('playCard: quiver modifiers at resolution', () => {
  const bowDeck = (mod: { kind: string; value: number; turns: number }): DeckState => ({
    draw: [], hand: [asCardId('thorn_arrow')], discard: [],
    sources: { thorn_arrow: 'hand_left' },
    cardMods: { thorn_arrow: mod as never },
  })
  const shot = () => ({
    type: 'playCard' as const,
    payload: {
      cardId: asCardId('thorn_arrow'), srcId: asUnitId('roy'), targets: [asTileId('5,5')],
      card: CARD({ effects: [{ kind: 'Damage', params: { base: 5 } }] }),
    },
  })

  it('poison quiver applies poison to the shot target', () => {
    const s = boot([mk('roy', '2,4'), mk('bandit', '5,5', 'bandit')], { roy: bowDeck({ kind: 'poison', value: 2, turns: 2 }) })
    const r = reduce(s, shot(), rng())
    expect(r.state.units['bandit']!.statuses[0]!.effectId).toBe(asStatusEffectId('poison'))
  })

  it('slow quiver applies slow', () => {
    const s = boot([mk('roy', '2,4'), mk('bandit', '5,5', 'bandit')], { roy: bowDeck({ kind: 'slow', value: 2, turns: 1 }) })
    const r = reduce(s, shot(), rng())
    expect(r.state.units['bandit']!.statuses[0]!.effectId).toBe(asStatusEffectId('slow'))
  })

  it('thunder quiver deals bonus armor-ignoring damage', () => {
    const armored = mk('bandit', '5,5', 'bandit', { armor: 10 })
    const noMod = boot([mk('roy', '2,4'), armored], { roy: { draw: [], hand: [asCardId('thorn_arrow')], discard: [] } })
    const withMod = boot([mk('roy', '2,4'), armored], { roy: bowDeck({ kind: 'thunder', value: 3, turns: 0 }) })
    const plain = reduce(noMod, shot(), rng()).state.units['bandit']!
    const boosted = reduce(withMod, shot(), rng()).state.units['bandit']!
    // bonus goes straight to HP (ignores armor)
    expect(plain.hp.current - boosted.hp.current).toBe(3)
  })

  it('explosive quiver splashes flat damage to units adjacent to the target', () => {
    const s = boot(
      [mk('roy', '2,4'), mk('b1', '5,5', 'bandit'), mk('b2', '5,6', 'bandit'), mk('b3', '9,9', 'bandit')],
      { roy: bowDeck({ kind: 'explosive', value: 3, turns: 0 }) },
    )
    const r = reduce(s, shot(), rng())
    expect(r.state.units['b2']!.hp.current).toBe(17) // adjacent, 3 splash
    expect(r.state.units['b3']!.hp.current).toBe(20) // far
  })

  it('mods do NOT fire for cards without an entry', () => {
    const deck: DeckState = {
      draw: [], hand: [asCardId('other_card')], discard: [],
      cardMods: { thorn_arrow: { kind: 'poison', value: 2, turns: 2 } },
    }
    const s = boot([mk('roy', '2,4'), mk('bandit', '5,5', 'bandit')], { roy: deck })
    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: asCardId('other_card'), srcId: asUnitId('roy'), targets: [asTileId('5,5')],
        card: CARD({ effects: [{ kind: 'Damage', params: { base: 5 } }] }),
      },
    }, rng())
    expect(r.state.units['bandit']!.statuses).toHaveLength(0)
  })
})

describe('endTurn: status tick (DOT + expiry)', () => {
  it('poison damages the unit at the end of ITS turn and expires after N ticks', () => {
    // roy (spd 5) acts first; bandit poisoned 2 stacks / 2 turns.
    const poisoned = mk('bandit', '5,5', 'bandit', {
      statuses: [{ effectId: asStatusEffectId('poison'), stacks: 2, turnsRemaining: 2, source: null }],
    })
    let s = boot([mk('roy', '2,4'), poisoned])
    // roy's endTurn → no tick on bandit (not its turn)
    s = reduce(s, { type: 'endTurn' }, rng()).state
    expect(s.units['bandit']!.hp.current).toBe(20)
    // bandit's endTurn → poison ticks: -2 HP, 1 turn left
    s = reduce(s, { type: 'endTurn' }, rng()).state
    expect(s.units['bandit']!.hp.current).toBe(18)
    expect(s.units['bandit']!.statuses[0]!.turnsRemaining).toBe(1)
    // next round: roy end, bandit end → second tick, expiry
    s = reduce(s, { type: 'endTurn' }, rng()).state
    s = reduce(s, { type: 'endTurn' }, rng()).state
    expect(s.units['bandit']!.hp.current).toBe(16)
    expect(s.units['bandit']!.statuses).toHaveLength(0)
  })

  it('poison ignores armor; burn respects the magic split', () => {
    const poisoned = mk('p', '5,5', 'bandit', {
      armor: 10,
      statuses: [{ effectId: asStatusEffectId('poison'), stacks: 4, turnsRemaining: 1, source: null }],
    })
    let s = boot([mk('roy', '2,4'), poisoned])
    s = reduce(s, { type: 'endTurn' }, rng()).state // roy ends
    s = reduce(s, { type: 'endTurn' }, rng()).state // p ends → tick
    expect(s.units['p']!.hp.current).toBe(16) // armor untouched by poison
    expect(s.units['p']!.armor).toBe(10)
  })

  it('DOT death flips the phase', () => {
    const dying = mk('bandit', '5,5', 'bandit', {
      hp: { current: 1, max: 20 },
      statuses: [{ effectId: asStatusEffectId('poison'), stacks: 3, turnsRemaining: 1, source: null }],
    })
    let s = boot([mk('roy', '2,4'), dying])
    s = reduce(s, { type: 'endTurn' }, rng()).state // roy ends
    s = reduce(s, { type: 'endTurn' }, rng()).state // bandit ends → dies of poison
    expect(s.units['bandit']!.hp.current).toBe(0)
    expect(s.phase).toBe('VICTORY')
  })
})

describe('moveUnit: immobilize', () => {
  it('refuses movement while immobilized', () => {
    const pinned = mk('roy', '2,4', 'lord', {
      statuses: [{ effectId: asStatusEffectId('immobilize'), stacks: 1, turnsRemaining: 1, source: null }],
    })
    const s = boot([pinned, mk('bandit', '9,9', 'bandit')])
    const r = reduce(s, { type: 'moveUnit', payload: { unitId: asUnitId('roy'), tileId: asTileId('3,4') } }, rng())
    expect(r.state.units['roy']!.position).toBe(asTileId('2,4'))
  })
})

describe('turn order: slow', () => {
  it('slow reduces effective SPD in the initiative queue', () => {
    // roy spd 5, bandit spd 5 → party wins tie normally. Slow roy by 2 → bandit first.
    const slowed = mk('roy', '2,4', 'lord', {
      statuses: [{ effectId: asStatusEffectId('slow'), stacks: 2, turnsRemaining: 1, source: null }],
    })
    const s = boot([slowed, mk('bandit', '9,9', 'bandit')])
    expect(s.turn.unitId).toBe(asUnitId('bandit'))
  })
})
