import { describe, expect, it } from 'vitest'
import { canPlay, playCard, resolvePlay, validatePlay } from '../../../../src/engine/combat/cards'
import { deckSize } from '../../../../src/engine/combat/deck'
import {
  A_WALL_THERE, NOT_IN_HAND, NOT_ON_THE_FIELD, NO_FOE_THERE, NO_FRIEND_THERE, NO_TILE_CHOSEN, NO_WAY_THROUGH,
  OFF_THE_FIELD, OUT_OF_REACH, ROOTED, STRIKES_ON_ITS_OWN, USED_ON_ONESELF, needsAp,
} from '../../../../src/engine/combat/reasons'
import { hasStatus } from '../../../../src/engine/combat/statuses'
import { legalTargets, planApproach, strikeRange } from '../../../../src/engine/combat/targeting'
import type { ActiveStatus, PlayableCard, StatusId } from '../../../../src/engine/types'
import { activate, at, authored, dispatch, duel, env, handUid, mc, oak, patchUnit, placeAt, seed, unit, withHand } from '../../../helpers/battles'

const e = env()
const card = (id: string) => e.content.cards[id]!
const status = (id: StatusId, stacks: number, turns: number): ActiveStatus =>
  ({ id, stacks, turns, expiresAt: e.rules.combat.statuses[id].expiresAt, sourceId: null })

describe('combat/cards — Charge / Move (CONTRACT-CHANGES 0006)', () => {
  it('strike range = [min, max(1, max − Σ distance)]: Charge 1-3 with Move 2 strikes from 1', () => {
    expect(strikeRange(card('lord_charge'))).toEqual({ min: 1, max: 1 })
    expect(strikeRange(card('iron_sword_slash'))).toEqual({ min: 1, max: 1 })
    expect(strikeRange({ ...card('lord_charge'), range: { min: 1, max: 2 } })).toEqual({ min: 1, max: 1 })
  })

  it('charge closes 2 tiles then hits', () => {
    let st = duel({ banditAt: [5, 4] })
    st = withHand(st, 'mc', ['lord_charge'])
    expect(legalTargets(st, 'mc', card('lord_charge'), e)).toContain('5,4')
    const r = dispatch(st, { type: 'combat/playCard', cardUid: handUid(st, 'mc', 'lord_charge'), tile: '5,4' })
    const kinds = r.effects.map((x) => x.kind)
    expect(kinds.slice(0, 4)).toEqual(['cardPlayed', 'sound', 'unitMoved', 'sound'])
    expect(r.effects[2]).toEqual({ kind: 'unitMoved', unitId: 'mc', from: '2,4', path: ['3,4', '4,4'] })
    expect(unit(r.state, 'mc').position).toBe('4,4')
    expect(unit(r.state, 'mc').hasMovedThisTurn).toBe(false) // the approach is the card's, not the free move
    expect(unit(r.state, 'bandit').hp.current).toBe(18 - (5 + 5 - 1))
    expect(unit(r.state, 'mc').ap).toBe(1)
  })

  it('charge is refused when no path reaches strike range', () => {
    let st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 5, 4)] }, grid: { obstacles: [at(3, 4)] } })
    st = withHand(st, 'mc', ['lord_charge'])
    expect(planApproach(st, 'mc', card('lord_charge'), '5,4')).toBeNull()
    expect(legalTargets(st, 'mc', card('lord_charge'), e)).not.toContain('5,4')
    expect(validatePlay(st, 'mc', card('lord_charge'), '5,4', e)).toEqual({ ok: false, reason: NO_WAY_THROUGH })
    const r = dispatch(st, { type: 'combat/playCard', cardUid: handUid(st, 'mc', 'lord_charge'), tile: '5,4' })
    expect(r.state).toBe(st)
    expect(r.effects).toEqual([{ kind: 'refused', action: 'combat/playCard', reason: NO_WAY_THROUGH }])
  })

  it('charge on an adjacent target is a plain hit (no move); immobilized charges only strike-range targets', () => {
    let st = duel({ banditAt: [3, 4] })
    st = withHand(st, 'mc', ['lord_charge'])
    const r = playCard(st, handUid(st, 'mc', 'lord_charge'), '3,4', e)
    expect(r.effects.some((x) => x.kind === 'unitMoved')).toBe(false)
    expect(unit(r.state, 'bandit').hp.current).toBe(9)
    const rooted = patchUnit(duel({ banditAt: [5, 4] }), 'mc', { statuses: [status('immobilize', 1, 1)] })
    expect(validatePlay(rooted, 'mc', card('lord_charge'), '5,4', e)).toEqual({ ok: false, reason: ROOTED })
    expect(validatePlay(withHand(rooted, 'mc', ['lord_charge']), 'mc', card('lord_charge'), '5,4', e).ok).toBe(false)
  })

  it('the approach picks the nearest free tile in strike range, shortest path then tile order, around obstacles', () => {
    const st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 4, 3)] }, grid: { obstacles: [at(3, 4)] } })
    const plan = planApproach(st, 'mc', card('lord_charge'), '4,3')!
    expect(plan.dest).toBe('3,3')
    expect(plan.path).toEqual(['2,3', '3,3'])
  })
})

describe('combat/cards — resolution order (§2.3)', () => {
  it('the card leaves the hand for the discard FIRST, so DrawCards on the same card draws other cards', () => {
    let st = duel()
    st = withHand(st, 'mc', ['lord_rally'])
    const before = deckSize(st.decks['mc']!)
    const uid = handUid(st, 'mc', 'lord_rally')
    const r = dispatch(st, { type: 'combat/playCard', cardUid: uid, tile: null })
    const deck = r.state.decks['mc']!
    expect(deck.hand).toHaveLength(2)
    expect(deck.hand).not.toContain(uid)
    expect(deck.discard).toContain(uid)
    expect(deckSize(deck)).toBe(before)
    expect(r.effects.find((x) => x.kind === 'cardsDrawn')).toMatchObject({ unitId: 'mc', uids: deck.hand })
    expect(r.effects[0]).toEqual({ kind: 'cardPlayed', unitId: 'mc', cardUid: uid, cardId: 'lord_rally', tile: null, apCost: 1 })
  })

  it('AP is deducted after the effects (floor 0): Inspiring Strike nets −1', () => {
    let st = duel({ banditAt: [3, 4] })
    st = withHand(st, 'mc', ['lord_inspiring_strike'])
    const r = dispatch(st, { type: 'combat/playCard', cardUid: handUid(st, 'mc', 'lord_inspiring_strike'), tile: '3,4' })
    expect(unit(r.state, 'mc').ap).toBe(2)
    expect(r.effects.filter((x) => x.kind === 'apChanged')).toEqual([
      { kind: 'apChanged', unitId: 'mc', ap: 4, delta: 1 },
      { kind: 'apChanged', unitId: 'mc', ap: 2, delta: -2 },
    ])
  })

  it('empower is consumed by the next Damage card only, and adds to every hit of that play', () => {
    let st = duel({ banditAt: [3, 4] })
    st = patchUnit(st, 'mc', { statuses: [status('empower', 4, 1)] })
    st = withHand(st, 'mc', ['knight_fortify', 'iron_sword_slash'])
    const buff = dispatch(st, { type: 'combat/playCard', cardUid: handUid(st, 'mc', 'knight_fortify'), tile: null })
    expect(hasStatus(unit(buff.state, 'mc'), 'empower')).toBe(true)
    const hit = dispatch(buff.state, { type: 'combat/playCard', cardUid: handUid(buff.state, 'mc', 'iron_sword_slash'), tile: '3,4' })
    expect(unit(hit.state, 'bandit').hp.current).toBe(18 - (4 + 5 + 4 - 1))
    expect(hasStatus(unit(hit.state, 'mc'), 'empower')).toBe(false)
    expect(hit.effects).toContainEqual({ kind: 'statusRemoved', unitId: 'mc', status: 'empower', reason: 'consumed' })
  })

  it('checkEnd runs at the end of the play: a killing card flips the phase and idles the selection', () => {
    let st = duel({ banditAt: [3, 4], bandit: { hp: 4 } })
    st = withHand(st, 'mc', ['iron_sword_slash'])
    st = { ...st, selection: { kind: 'card', cardUid: handUid(st, 'mc', 'iron_sword_slash'), pinnedTile: '3,4' } }
    const r = dispatch(st, { type: 'combat/playCard', cardUid: handUid(st, 'mc', 'iron_sword_slash'), tile: '3,4' })
    expect(r.state.phase).toBe('victory')
    expect(r.state.selection).toEqual({ kind: 'idle' })
    expect(r.effects.map((x) => x.kind)).toContain('battleEnded')
  })
})

describe('combat/cards — effect kinds', () => {
  it('frost_axe_shatter removes all armor; guard_break removes exactly 2', () => {
    let st = duel({ banditAt: [3, 4] })
    st = patchUnit(st, 'bandit', { armor: 9, hp: { current: 60, max: 60 } })
    st = withHand(st, 'mc', ['frost_axe_shatter', 'iron_sword_guard_break'])
    const shatter = playCard(st, handUid(st, 'mc', 'frost_axe_shatter'), '3,4', e)
    expect(unit(shatter.state, 'bandit').armor).toBe(0)
    // the 14-point hit (10 + STR 5 − DR 1) already emptied the 9 armor, so the shatter has nothing left to report
    const shred = shatter.effects.find((x) => x.kind === 'armorShredded')
    expect(shred?.kind === 'armorShredded' ? shred.amount : 0).toBe(9 - Math.min(9, 10 + 5 - 1))
    const gb = playCard(patchUnit(st, 'bandit', { armor: 9 }), handUid(st, 'mc', 'iron_sword_guard_break'), '3,4', e)
    // the hit lands first (7 into armor → 2 left), then the shred takes the remaining 2
    expect(unit(gb.state, 'bandit').armor).toBe(0)
    expect(gb.effects).toContainEqual({ kind: 'armorShredded', unitId: 'bandit', amount: 2 })
  })

  it('beneficial riders on enemy-target cards land on the source (Hold the Line armors the knight)', () => {
    let st = duel({ banditAt: [3, 4] })
    st = withHand(st, 'mc', ['knight_hold_line'])
    const r = playCard(st, handUid(st, 'mc', 'knight_hold_line'), '3,4', e)
    expect(unit(r.state, 'mc').armor).toBe(2)
    expect(unit(r.state, 'bandit').armor).toBe(0)
    expect(unit(r.state, 'bandit').hp.current).toBe(18 - (3 + 5 - 1))
    expect(r.effects).toContainEqual({ kind: 'armorGranted', unitId: 'mc', amount: 2, capped: false })
  })

  it('Heal on an ally clamps to max and reports the amount actually healed; Purify strips debuffs only', () => {
    let st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 4, 4)] } })
    st = patchUnit(st, 'oak', { hp: { current: 25, max: 30 }, statuses: [status('poison', 2, 2), status('riposte', 2, 1)] })
    st = withHand(st, 'mc', ['heal_staff_heal', 'heal_staff_purify'])
    const heal = playCard(st, handUid(st, 'mc', 'heal_staff_heal'), '2,5', e)
    expect(unit(heal.state, 'oak').hp.current).toBe(30)
    expect(heal.effects).toContainEqual({ kind: 'unitHealed', unitId: 'oak', amount: 5, cause: 'card' })
    const full = playCard(heal.state, handUid(heal.state, 'mc', 'heal_staff_purify'), '2,5', e)
    expect(unit(full.state, 'oak').statuses).toEqual([status('riposte', 2, 1)])
    expect(playCard(full.state, handUid(st, 'mc', 'heal_staff_heal'), '2,5', e).effects.some((x) => x.kind === 'unitHealed')).toBe(false)
  })

  it('ApplyStatus riders land on the target with the source recorded; GainAp on an ally raises its AP', () => {
    let st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 3, 4)] } })
    st = withHand(st, 'mc', ['mage_chill', 'lord_command'])
    const chill = playCard(st, handUid(st, 'mc', 'mage_chill'), '3,4', e)
    expect(unit(chill.state, 'bandit').statuses).toEqual([{ id: 'slow', stacks: 1, turns: 2, expiresAt: 'ownerTurnEnd', sourceId: 'mc' }])
    expect(chill.effects).toContainEqual({ kind: 'statusApplied', unitId: 'bandit', status: 'slow', stacks: 1, turns: 2 })
    const cmd = playCard(chill.state, handUid(chill.state, 'mc', 'lord_command'), '2,5', e)
    expect(unit(cmd.state, 'oak').ap).toBe(4)
  })

  it('quiver riders: poison and slow status the target; thunder pierces armor and DR; explosive hits the ring only', () => {
    const base = () => {
      let st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('b1', 'bandit', 4, 4, { hp: 40, armor: 2 }), authored('b2', 'bandit', 5, 4, { hp: 40 })] } })
      st = patchUnit(st, 'b1', { stats: { ...unit(st, 'b1').stats, def: 40 } })
      return st
    }
    const shot = (mod: NonNullable<PlayableCard['effects'][number]> extends never ? never : { kind: 'poison' | 'slow' | 'thunder' | 'explosive'; value: number; turns: number }) => {
      const st = withHand(base(), 'mc', ['iron_bow_quick_shot'], [mod])
      return playCard(st, handUid(st, 'mc', 'iron_bow_quick_shot'), '4,4', e)
    }
    const poison = shot({ kind: 'poison', value: 2, turns: 2 })
    expect(unit(poison.state, 'b1').statuses).toEqual([{ id: 'poison', stacks: 2, turns: 2, expiresAt: 'ownerTurnEnd', sourceId: 'mc' }])
    const slow = shot({ kind: 'slow', value: 2, turns: 1 })
    expect(unit(slow.state, 'b1').statuses[0]).toMatchObject({ id: 'slow', stacks: 2, turns: 1 })
    const thunder = shot({ kind: 'thunder', value: 3, turns: 0 })
    expect(unit(thunder.state, 'b1')).toMatchObject({ hp: { current: 37 }, armor: 2 }) // main hit is walled off by DEF 40; +3 goes straight to HP
    expect(thunder.effects.find((x) => x.kind === 'unitHit' && x.cause === 'quiver')).toMatchObject({ unitId: 'b1', hpLost: 3, armorLost: 0 })
    const boom = shot({ kind: 'explosive', value: 3, turns: 0 })
    expect(unit(boom.state, 'b1').hp.current).toBe(40)
    expect(unit(boom.state, 'b2').hp.current).toBe(37)
  })

  it('an enemy action resolves through the same resolver with cause enemyAction and its status rider', () => {
    const stab: PlayableCard = { apCost: 0, range: { min: 1, max: 1 }, targetKind: 'enemy', damageStat: 'str', effects: [{ kind: 'Damage', target: 'target', base: 5, damageType: 'physical' }, { kind: 'ApplyStatus', target: 'target', effectId: 'poison', value: 2, turns: 2 }] }
    let st = duel({ banditAt: [3, 4] })
    st = activate(st, 'bandit')
    const r = resolvePlay(st, { sourceId: 'bandit', card: stab, cardId: null, tile: '2,4', mod: null, cause: 'enemyAction' }, e)
    expect(unit(r.state, 'mc').hp.current).toBe(26 - (5 + 5 - 1))
    expect(unit(r.state, 'mc').statuses).toEqual([{ id: 'poison', stacks: 2, turns: 2, expiresAt: 'ownerTurnEnd', sourceId: 'bandit' }])
    expect(r.effects[0]).toMatchObject({ kind: 'unitHit', cause: 'enemyAction' })
  })
})

describe('combat/cards — validatePlay / canPlay reasons', () => {
  // The reasons are the SENTENCES the player reads (ARCHITECTURE §5.1) — `combat/reasons.ts` is their one home,
  // so this case is written against the constants: a rule that changes its words changes them everywhere at once.
  it('reports the AP, reach, targetKind, tile, wall and bounds rules in words', () => {
    let st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 4, 4)] }, grid: { obstacles: [at(3, 3)] } })
    st = withHand(st, 'mc', ['iron_sword_slash'])
    const slash = card('iron_sword_slash')
    expect(validatePlay(patchUnit(st, 'mc', { ap: 0 }), 'mc', slash, '4,4', e)).toEqual({ ok: false, reason: needsAp(slash.apCost) })
    expect(validatePlay(st, 'mc', slash, '4,4', e)).toEqual({ ok: false, reason: OUT_OF_REACH })
    expect(validatePlay(st, 'mc', slash, '2,5', e)).toEqual({ ok: false, reason: NO_FOE_THERE }) // Oak stands there
    expect(validatePlay(st, 'mc', card('lord_nobility'), '3,4', e)).toEqual({ ok: false, reason: NO_FRIEND_THERE })
    expect(validatePlay(st, 'mc', slash, null, e)).toEqual({ ok: false, reason: NO_TILE_CHOSEN })
    expect(validatePlay(st, 'mc', card('knight_fortify'), '2,5', e)).toEqual({ ok: false, reason: USED_ON_ONESELF })
    expect(validatePlay(st, 'mc', card('knight_fortify'), '2,4', e)).toEqual({ ok: true })
    expect(validatePlay(st, 'mc', card('fire_tome_flame_burst'), '3,3', e)).toEqual({ ok: false, reason: A_WALL_THERE })
    expect(validatePlay(st, 'mc', card('fire_tome_flame_burst'), '-1,4', e)).toEqual({ ok: false, reason: OFF_THE_FIELD })
    expect(validatePlay(st, 'mc', { ...slash, targetKind: 'all_enemies' }, '4,4', e)).toEqual({ ok: false, reason: STRIKES_ON_ITS_OWN })
    expect(validatePlay(st, 'mc', { ...slash, targetKind: 'all_enemies' }, null, e)).toEqual({ ok: true })
    expect(validatePlay(placeAt(st, 'bandit', 3, 4), 'mc', slash, '3,4', e)).toEqual({ ok: true })
    expect(validatePlay(st, 'ghost', slash, '3,4', e)).toEqual({ ok: false, reason: NOT_ON_THE_FIELD })
  })

  it('canPlay refuses a card not in the active hand and returns the def when playable', () => {
    let st = duel({ banditAt: [3, 4] })
    st = withHand(st, 'mc', ['iron_sword_slash'])
    expect(canPlay(st, 'nope#1', '3,4', e)).toEqual({ ok: false, reason: NOT_IN_HAND })
    const ok = canPlay(st, handUid(st, 'mc', 'iron_sword_slash'), '3,4', e)
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.card.id).toBe('iron_sword_slash')
  })

  it('a self card accepts tile null or the own tile and resolves centred on the source', () => {
    let st = duel()
    st = withHand(st, 'mc', ['knight_fortify', 'knight_fortify'])
    const a = playCard(st, st.decks['mc']!.hand[0]!, null, e)
    const b = playCard(a.state, a.state.decks['mc']!.hand[0]!, '2,4', e)
    expect(unit(b.state, 'mc').armor).toBe(10)
    expect(b.effects[0]).toMatchObject({ kind: 'cardPlayed', tile: null })
  })

  it('legalTargets lists foes for enemy cards, friends (self included at range 0) for ally cards, every free tile for tile cards, nothing for all_*', () => {
    const st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 3, 4)] } })
    expect(legalTargets(st, 'mc', card('iron_sword_slash'), e)).toEqual(['3,4'])
    expect(legalTargets(st, 'mc', card('lord_nobility'), e)).toEqual(['2,4', '2,5'])
    expect(legalTargets(st, 'mc', card('knight_fortify'), e)).toEqual(['2,4'])
    expect(legalTargets(st, 'mc', card('fire_tome_flame_burst'), e)).toHaveLength(12) // r1-2 annulus around (2,4) on a 14×10 board
    expect(legalTargets(st, 'mc', { ...card('iron_sword_slash'), targetKind: 'all_enemies' }, e)).toEqual([])
  })
})

describe('combat/cards — oak fixture sanity', () => {
  it('Oak brings 10 cards and the lance brace armors him', () => {
    let st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 3, 5)] } })
    st = activate(st, 'oak')
    st = withHand(st, 'oak', ['iron_lance_brace'])
    const r = playCard(st, handUid(st, 'oak', 'iron_lance_brace'), '3,5', e)
    expect(unit(r.state, 'oak').armor).toBe(2)
    expect(deckSize(st.decks['oak']!)).toBe(11)
  })
})
