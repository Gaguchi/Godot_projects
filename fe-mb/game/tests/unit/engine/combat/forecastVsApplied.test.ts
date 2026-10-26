/**
 * Brief §2.2 / §10: forecast breakdown equals applied numbers for EVERY card × target pair, including when cover
 * redirects the target and including the quiver pairs (CONTRACT-CHANGES 0011: `mod` in the matrix).
 */
import { describe, expect, it } from 'vitest'
import { forecast } from '../../../../src/engine/combat/damage'
import { playCard, resolvePlay } from '../../../../src/engine/combat/cards'
import { tileKey } from '../../../../src/engine/combat/grid'
import { mergeStatus } from '../../../../src/engine/combat/statuses'
import type { Card, CombatState, PlayableCard, QuiverModifier, UnitId } from '../../../../src/engine/types'
import type { Effect } from '../../../../src/engine/effects'
import { activate, authored, env, handUid, mc, oak, patchUnit, placeAt, seed, unit, unitFromClass, withHand } from '../../../helpers/battles'

const e = env()
const cards = Object.values(e.content.cards)
const quivers = Object.values(e.content.items).flatMap((i) => (i.quiverModifier === undefined ? [] : [{ id: i.id, mod: i.quiverModifier }]))

/** Board: mc at (2,4), oak at (2,5), lilina at (1,4), bandit 'b1' and 'b2' placed per card. */
function board(): CombatState {
  let st = seed({
    party: [mc(), oak(), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })],
    enemies: { kind: 'authored', units: [authored('b1', 'bandit', 6, 4, { hp: 40 }), authored('b2', 'bandit', 6, 5, { hp: 40 })] },
    seed: 5,
  })
  st = activate(st, 'mc')
  st = patchUnit(st, 'mc', { hp: { current: 20, max: 26 } }) // wounded, so heals show
  st = patchUnit(st, 'oak', { hp: { current: 20, max: 30 }, armor: 2 })
  st = patchUnit(st, 'b1', { armor: 3 })
  return st
}

interface Scenario { readonly state: CombatState; readonly targetId: UnitId; readonly tile: string | null }

/** Put the target where the card's minimum range points; `ring` needs a second foe beside it. */
function scenarioFor(card: Card, mod: QuiverModifier | null): Scenario | null {
  let st = board()
  const dist = Math.max(card.range.min, card.effects.some((x) => x.kind === 'Move') ? card.range.max : 0)
  switch (card.targetKind) {
    case 'enemy':
    case 'tile': {
      const tile = tileKey(2 + dist, 4)
      st = placeAt(st, 'b1', 2 + dist, 4)
      st = placeAt(st, 'b2', 2 + dist + 1, 4) // adjacent to the target (ring), out of the way otherwise
      st = withHand(st, 'mc', [card.id], [mod])
      return { state: st, targetId: 'b1', tile }
    }
    case 'ally': {
      st = withHand(st, 'mc', [card.id], [mod])
      return { state: st, targetId: 'oak', tile: '2,5' }
    }
    case 'self': {
      st = withHand(st, 'mc', [card.id], [mod])
      return { state: st, targetId: 'mc', tile: null }
    }
    case 'all_enemies':
    case 'all_allies':
      return null
  }
}

function sumFor(effects: readonly Effect[], unitId: UnitId, key: 'hpLost' | 'armorLost'): number {
  let total = 0
  for (const x of effects) if (x.kind === 'unitHit' && x.unitId === unitId && x.cause !== 'riposte') total += x[key]
  return total
}

function assertMatches(scn: Scenario, card: PlayableCard, mod: QuiverModifier | null, play: (st: CombatState) => { state: CombatState; effects: readonly Effect[] }): void {
  const f = forecast(scn.state, 'mc', { card, mod }, scn.targetId, e)
  const r = play(scn.state)
  expect(r.effects.some((x) => x.kind === 'refused')).toBe(false)
  const finalId = f?.redirectedTo ?? scn.targetId
  const after = unit(r.state, finalId)
  if (f === null) {
    // no Damage/Heal on this target: its HP and armor cannot have moved through a hit or a heal
    expect(sumFor(r.effects, scn.targetId, 'hpLost')).toBe(0)
    expect(r.effects.some((x) => x.kind === 'unitHealed' && x.unitId === scn.targetId)).toBe(false)
    return
  }
  expect(after.hp.current).toBe(f.predictedHp)
  expect(after.armor).toBe(f.predictedArmor)
  expect(sumFor(r.effects, finalId, 'hpLost') - (f.heal > 0 ? 0 : 0)).toBe(f.hpLost)
  expect(sumFor(r.effects, finalId, 'armorLost')).toBe(f.armorLost)
  const healed = r.effects.filter((x) => x.kind === 'unitHealed' && x.unitId === finalId).reduce((n, x) => n + (x.kind === 'unitHealed' ? x.amount : 0), 0)
  expect(healed).toBe(f.heal)
  expect(after.hp.current === 0).toBe(f.lethal)
  const applied = r.effects.filter((x) => x.kind === 'statusApplied' && x.unitId === finalId).map((x) => (x.kind === 'statusApplied' ? `${x.status}:${x.stacks}:${x.turns}` : ''))
  expect(applied.sort()).toEqual(f.riders.map((x) => `${x.status}:${x.stacks}:${x.turns}`).sort())
}

describe('forecast == applied over every card × target', () => {
  it.each(cards.map((c) => [c.id, c] as const))('%s', (_id, card) => {
    const scn = scenarioFor(card, null)
    if (scn === null) return
    assertMatches(scn, card, null, (st) => playCard(st, handUid(st, 'mc', card.id), scn.tile, e))
  })

  it.each(cards.filter((c) => c.effects.some((x) => x.kind === 'Damage')).map((c) => [c.id, c] as const))('%s with empower up', (_id, card) => {
    const scn = scenarioFor(card, null)
    if (scn === null) return
    const st = patchUnit(scn.state, 'mc', { statuses: mergeStatus([], { id: 'empower', stacks: 3, turns: 1, expiresAt: 'ownerTurnStart', sourceId: 'mc' }, e) })
    assertMatches({ ...scn, state: st }, card, null, (s) => playCard(s, handUid(s, 'mc', card.id), scn.tile, e))
  })
})

describe('forecast == applied for the quiver pairs (mod in the matrix)', () => {
  const bowCards = cards.filter((c) => c.weaponType === 'bow' && c.effects.some((x) => x.kind === 'Damage'))
  const rows = bowCards.flatMap((c) => quivers.map((q) => [`${c.id} + ${q.id}`, c, q.mod] as const))
  it.each(rows)('%s', (_label, card, mod) => {
    const scn = scenarioFor(card, mod)
    if (scn === null) return
    assertMatches(scn, card, mod, (st) => playCard(st, handUid(st, 'mc', card.id), scn.tile, e))
  })

  it('thunder adds a flat, armor-piercing, DR-ignoring quiverTerm the forecast and the hit agree on', () => {
    const card = e.content.cards['iron_bow_quick_shot']!
    const mod: QuiverModifier = { kind: 'thunder', value: 3, turns: 0 }
    const scn = scenarioFor(card, mod)!
    const f = forecast(scn.state, 'mc', { card, mod }, 'b1', e)!
    expect(f.quiverTerm).toBe(3)
    expect(f.afterDr).toBe(8) // 4 + str 5 − DR 1; thunder is not in afterDr
    expect(f.armorLost).toBe(3)
    expect(f.hpLost).toBe(5 + 3)
    const r = playCard(scn.state, handUid(scn.state, 'mc', card.id), scn.tile, e)
    expect(unit(r.state, 'b1').hp.current).toBe(40 - 8)
  })

  it('explosive damages the ring around the target and never the target the forecast is about', () => {
    const card = e.content.cards['iron_bow_quick_shot']!
    const mod: QuiverModifier = { kind: 'explosive', value: 3, turns: 0 }
    const scn = scenarioFor(card, mod)!
    const f = forecast(scn.state, 'mc', { card, mod }, 'b1', e)!
    expect(f.quiverTerm).toBe(0)
    const r = playCard(scn.state, handUid(scn.state, 'mc', card.id), scn.tile, e)
    expect(unit(r.state, 'b1').hp.current).toBe(f.predictedHp)
    expect(unit(r.state, 'b2').hp.current).toBe(37)
    expect(r.effects.find((x) => x.kind === 'unitHit' && x.unitId === 'b2')).toMatchObject({ cause: 'quiver', hpLost: 3 })
  })
})

describe('forecast == applied through a Genatsvale redirect', () => {
  const swing: PlayableCard = { apCost: 0, range: { min: 1, max: 1 }, targetKind: 'enemy', damageStat: 'str', effects: [{ kind: 'Damage', target: 'target', base: 4, damageType: 'physical' }] }

  it('an enemy blow aimed at the MC lands on Oak with Oak DEF, in both the forecast and the hit', () => {
    let st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('b1', 'bandit', 3, 4)] } })
    st = activate(st, 'b1')
    const f = forecast(st, 'b1', { card: swing, mod: null }, 'mc', e)!
    expect(f.redirectedTo).toBe('oak')
    expect(f.drTerm).toBe(4) // Oak's DEF 9
    expect(f.afterDr).toBe(5) // 4 + str 5 − 4
    expect(f.predictedHp).toBe(25)
    const r = resolvePlay(st, { sourceId: 'b1', card: swing, cardId: null, tile: '2,4', mod: null, cause: 'enemyAction' }, e)
    expect(unit(r.state, 'oak').hp.current).toBe(f.predictedHp)
    expect(unit(r.state, 'mc').hp.current).toBe(26)
    expect(r.effects.find((x) => x.kind === 'unitHit')).toMatchObject({ unitId: 'oak', redirectedFrom: 'mc', tile: '2,5', hpLost: f.hpLost })
    expect(r.effects.find((x) => x.kind === 'covered')).toEqual({ kind: 'covered', protectorId: 'oak', protecteeId: 'mc' })
  })

  it('once Oak has covered the MC this activation, the forecast and the hit both fall on the MC', () => {
    let st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('b1', 'bandit', 3, 4)] } })
    st = activate(st, 'b1')
    st = patchUnit(st, 'oak', { coverUsed: ['mc'] })
    const f = forecast(st, 'b1', { card: swing, mod: null }, 'mc', e)!
    expect(f.redirectedTo).toBeNull()
    expect(f.drTerm).toBe(1)
    const r = resolvePlay(st, { sourceId: 'b1', card: swing, cardId: null, tile: '2,4', mod: null, cause: 'enemyAction' }, e)
    expect(unit(r.state, 'mc').hp.current).toBe(f.predictedHp)
    expect(unit(r.state, 'oak').hp.current).toBe(30)
  })
})
