/**
 * Brief §2.16 Genatsvale: "each turn, the first blow aimed at an adjacent ally lands on him instead (per ally,
 * per turn)" — resolved BEFORE DR so Oak's DEF applies, one redirect per protectee per protector activation, the
 * ledger cleared when the protector's own turn starts.
 */
import { describe, expect, it } from 'vitest'
import { resolvePlay } from '../../../../src/engine/combat/cards'
import { recordCover, resolveCoverTarget } from '../../../../src/engine/combat/cover'
import { dealDamage, dealFlatDamage, forecast } from '../../../../src/engine/combat/damage'
import { startTurn } from '../../../../src/engine/combat/turn'
import type { CombatState, PlayableCard } from '../../../../src/engine/types'
import { activate, authored, env, mc, oak, patchUnit, seed, unit, unitFromClass } from '../../../helpers/battles'

const e = env()
const swing: PlayableCard = { apCost: 0, range: { min: 1, max: 1 }, targetKind: 'enemy', damageStat: 'str', effects: [{ kind: 'Damage', target: 'target', base: 4, damageType: 'physical' }] }

/** mc (2,4), oak (2,5), lilina (1,4); bandit b1 at (3,4) — adjacent to the MC, not to Oak. */
function field(): CombatState {
  const st = seed({
    party: [mc(), oak(), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })],
    enemies: { kind: 'authored', units: [authored('b1', 'bandit', 3, 4), authored('b2', 'bandit', 1, 5)] },
  })
  return activate(st, 'b1')
}

const strike = (st: CombatState, attacker: string, targetTile: string) =>
  resolvePlay(st, { sourceId: attacker, card: swing, cardId: null, tile: targetTile, mod: null, cause: 'enemyAction' }, e)

describe('combat/cover — resolveCoverTarget', () => {
  it('redirects a hostile blow at an ally adjacent to Oak onto Oak', () => {
    expect(resolveCoverTarget(field(), 'b1', 'mc', e)).toEqual({ targetId: 'oak', protectorId: 'oak' })
  })

  it('does not redirect: Oak attacked directly, Oak not adjacent, Oak dead, same-team blow, unknown ids', () => {
    const st = field()
    expect(resolveCoverTarget(st, 'b1', 'oak', e)).toEqual({ targetId: 'oak', protectorId: null })
    expect(resolveCoverTarget(patchUnit(st, 'oak', { position: '5,9' }), 'b1', 'mc', e).protectorId).toBeNull()
    expect(resolveCoverTarget(patchUnit(st, 'oak', { hp: { current: 0, max: 30 }, position: null, lastTile: '2,5' }), 'b1', 'mc', e).protectorId).toBeNull()
    expect(resolveCoverTarget(st, 'lilina', 'mc', e).protectorId).toBeNull()
    expect(resolveCoverTarget(st, 'ghost', 'mc', e).protectorId).toBeNull()
    expect(resolveCoverTarget(st, 'b1', 'ghost', e)).toEqual({ targetId: 'ghost', protectorId: null })
  })

  it('a protectee already in coverUsed is not covered again; the lowest protector id wins when two qualify', () => {
    const st = field()
    expect(resolveCoverTarget(patchUnit(st, 'oak', { coverUsed: ['mc'] }), 'b1', 'mc', e).protectorId).toBeNull()
    const two = patchUnit(st, 'lilina', { passives: ['genatsvale'] })
    expect(resolveCoverTarget(two, 'b1', 'mc', e).protectorId).toBe('lilina')
    expect(resolveCoverTarget(patchUnit(two, 'lilina', { coverUsed: ['mc'] }), 'b1', 'mc', e).protectorId).toBe('oak')
  })

  it('recordCover appends once and is idempotent', () => {
    const st = field()
    const once = recordCover(st, 'oak', 'mc')
    expect(unit(once, 'oak').coverUsed).toEqual(['mc'])
    expect(recordCover(once, 'oak', 'mc')).toBe(once)
    expect(unit(recordCover(once, 'oak', 'lilina'), 'oak').coverUsed).toEqual(['mc', 'lilina'])
  })
})

describe('combat/cover — Genatsvale in play', () => {
  it('the first blow at the MC lands on Oak using Oak DEF; the second at the same ally lands on the MC', () => {
    const st = field()
    const first = strike(st, 'b1', '2,4')
    expect(unit(first.state, 'oak').hp.current).toBe(25) // 4 + 5 − ⌊9/2⌋ = 5
    expect(unit(first.state, 'mc').hp.current).toBe(26)
    expect(unit(first.state, 'oak').coverUsed).toEqual(['mc'])
    const hit = first.effects.find((x) => x.kind === 'unitHit')
    expect(hit).toMatchObject({ unitId: 'oak', tile: '2,5', redirectedFrom: 'mc', hpLost: 5 })
    const second = strike(first.state, 'b1', '2,4')
    expect(unit(second.state, 'mc').hp.current).toBe(18) // 9 − ⌊3/2⌋ = 8
    expect(unit(second.state, 'oak').hp.current).toBe(25)
    expect(second.effects.some((x) => x.kind === 'covered')).toBe(false)
  })

  it('a blow at a DIFFERENT adjacent ally is redirected again within the same Oak activation', () => {
    let st = field()
    st = patchUnit(st, 'lilina', { position: '3,5' }) // adjacent to Oak (2,5) and to b1 (3,4)
    const first = strike(st, 'b1', '2,4')
    const second = strike(first.state, 'b1', '3,5')
    expect(unit(second.state, 'lilina').hp.current).toBe(22)
    expect(unit(second.state, 'oak').hp.current).toBe(20)
    expect(unit(second.state, 'oak').coverUsed).toEqual(['mc', 'lilina'])
  })

  it('the counter clears when Oak turn starts, so the next enemy phase is covered again', () => {
    const st = field()
    const covered = strike(st, 'b1', '2,4').state
    expect(unit(covered, 'oak').coverUsed).toEqual(['mc'])
    const oaksTurn = startTurn(covered, 'oak', e).state
    expect(unit(oaksTurn, 'oak').coverUsed).toEqual([])
    const again = strike(activate(oaksTurn, 'b1'), 'b1', '2,4')
    expect(again.effects.some((x) => x.kind === 'covered')).toBe(true)
    expect(unit(again.state, 'oak').hp.current).toBe(20)
  })

  it('the forecast reflects the redirect: DR is the protector, the predicted HP is the protector', () => {
    const st = field()
    const f = forecast(st, 'b1', { card: swing, mod: null }, 'mc', e)!
    expect(f.redirectedTo).toBe('oak')
    expect(f.drTerm).toBe(4)
    expect(f.predictedHp).toBe(25)
    const applied = strike(st, 'b1', '2,4')
    expect(unit(applied.state, 'oak').hp.current).toBe(f.predictedHp)
  })

  it('DOT, riposte and party-on-party damage are never redirected (cover false / same team)', () => {
    const st = field()
    const poisonTick = dealFlatDamage(st, null, 'mc', 2, 'physical', { armorPiercing: true, cause: 'poison' }, e)
    expect(unit(poisonTick.state, 'mc').hp.current).toBe(24)
    expect(unit(poisonTick.state, 'oak').coverUsed).toEqual([])
    const friendly = dealDamage(st, 'lilina', 'mc', 5, 'physical', { armorPiercing: false, cause: 'card', cover: true }, e)
    expect(friendly.effects.some((x) => x.kind === 'covered')).toBe(false)
    const noCover = dealDamage(st, 'b1', 'mc', 9, 'physical', { armorPiercing: false, cause: 'enemyAction', cover: false }, e)
    expect(unit(noCover.state, 'mc').hp.current).toBe(18)
  })

  it('an AOE that catches Oak AND the MC redirects the MC blow onto Oak, so Oak is hit twice', () => {
    const cleave: PlayableCard = { apCost: 0, range: { min: 1, max: 1 }, targetKind: 'enemy', aoeRadius: 1, damageStat: 'str', effects: [{ kind: 'Damage', target: 'area', base: 4, damageType: 'physical' }] }
    let st = field()
    st = patchUnit(st, 'b1', { position: '3,5' }) // adjacent to Oak (2,5); the MC (2,4) is within radius 1 of the centre (2,5)
    const r = resolvePlay(st, { sourceId: 'b1', card: cleave, cardId: null, tile: '2,5', mod: null, cause: 'enemyAction' }, e)
    const hits = r.effects.filter((x) => x.kind === 'unitHit')
    // recipients resolve in row-major tile order (grid.ts#tilesInAoe): the MC at (2,4) precedes Oak at (2,5), so the
    // redirected blow lands first, then Oak's own
    expect(hits.map((x) => (x.kind === 'unitHit' ? `${x.unitId}<${x.redirectedFrom ?? '-'}` : ''))).toEqual(['oak<mc', 'oak<-'])
    expect(unit(r.state, 'oak').hp.current).toBe(20)
    expect(unit(r.state, 'mc').hp.current).toBe(26)
  })
})
