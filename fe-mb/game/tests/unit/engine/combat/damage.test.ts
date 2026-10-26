import { describe, expect, it } from 'vitest'
import { endTurn } from '../../../../src/engine/combat/turn'
import { damageReduction, dealDamage, dealFlatDamage, grantArmor, rawDamage, splitDamage } from '../../../../src/engine/combat/damage'
import type { ActiveStatus, StatusId } from '../../../../src/engine/types'
import { withRules } from '../../../../src/engine/content'
import { authored, duel, env, mc, patchUnit, seed, unit, withKnobs } from '../../../helpers/battles'

const e = env()
const status = (id: StatusId, stacks: number, turns: number): ActiveStatus =>
  ({ id, stacks, turns, expiresAt: e.rules.combat.statuses[id].expiresAt, sourceId: null })

describe('combat/damage — splitDamage (§2.2)', () => {
  it('physical: armor absorbs first, overflow to HP', () => {
    expect(splitDamage({ current: 20, max: 20 }, 5, 8, 'physical', false)).toEqual({ hpLost: 3, armorLost: 5, newHp: 17, newArmor: 0 })
    expect(splitDamage({ current: 20, max: 20 }, 5, 3, 'physical', false)).toEqual({ hpLost: 0, armorLost: 3, newHp: 20, newArmor: 2 })
  })
  it('magic: floor(amount/2) hits armor (leak to HP), ceil(amount/2) pierces', () => {
    expect(splitDamage({ current: 20, max: 20 }, 5, 7, 'magic', false)).toEqual({ hpLost: 4, armorLost: 3, newHp: 16, newArmor: 2 })
    expect(splitDamage({ current: 20, max: 20 }, 1, 7, 'magic', false)).toEqual({ hpLost: 6, armorLost: 1, newHp: 14, newArmor: 0 }) // 3 armored: 1 absorbed, 2 leak
  })
  it('armor-piercing skips armor entirely', () => {
    expect(splitDamage({ current: 20, max: 20 }, 5, 4, 'physical', true)).toEqual({ hpLost: 4, armorLost: 0, newHp: 16, newArmor: 5 })
  })
  it('hpLost is clamped to current HP and amount ≤ 0 is a no-op', () => {
    expect(splitDamage({ current: 3, max: 20 }, 0, 10, 'physical', false)).toEqual({ hpLost: 3, armorLost: 0, newHp: 0, newArmor: 0 })
    expect(splitDamage({ current: 3, max: 20 }, 2, 0, 'physical', false)).toEqual({ hpLost: 0, armorLost: 0, newHp: 3, newArmor: 2 })
    expect(splitDamage({ current: 3, max: 20 }, 2, -4, 'magic', false)).toEqual({ hpLost: 0, armorLost: 0, newHp: 3, newArmor: 2 })
  })
})

describe('combat/damage — reduction and raw damage', () => {
  it('DR = floor(DEF/2) for physical, floor(RES/2) for magic; terrain only when the knob is on', () => {
    const st = duel()
    const oakLike = { ...unit(st, 'mc'), stats: { ...unit(st, 'mc').stats, def: 9, res: 7 } }
    expect(damageReduction(oakLike, 'physical', st.grid, e)).toEqual({ dr: 4, terrainDr: 0 })
    expect(damageReduction(oakLike, 'magic', st.grid, e)).toEqual({ dr: 3, terrainDr: 0 })
    const terrainGrid = { ...st.grid, terrain: { [oakLike.position!]: 'fort' as const } }
    expect(damageReduction(oakLike, 'physical', terrainGrid, e)).toEqual({ dr: 4, terrainDr: 0 }) // knob off ⇒ terrain ignored
    const on = withKnobs(e, { terrain: 'on' })
    expect(damageReduction(oakLike, 'physical', terrainGrid, on)).toEqual({ dr: 6, terrainDr: 2 })
    expect(damageReduction(oakLike, 'magic', terrainGrid, on)).toEqual({ dr: 5, terrainDr: 2 })
  })

  it('rawDamage = base + STAT + empower − DR with min 0 and every breakdown term', () => {
    const st = duel()
    const lord = unit(st, 'mc') // str 5
    const bandit = unit(st, 'bandit') // def 2 → DR 1
    expect(rawDamage(4, 'str', lord, bandit, 'physical', st.grid, e)).toEqual({
      damageType: 'physical', baseTerm: 4, statName: 'str', statTerm: 5, empowerTerm: 0, drTerm: 1, terrainDr: 0, afterDr: 8,
    })
    const empowered = { ...lord, statuses: [status('empower', 4, 1)] }
    expect(rawDamage(4, 'str', empowered, bandit, 'physical', st.grid, e).afterDr).toBe(12)
    expect(rawDamage(0, null, lord, { ...bandit, stats: { ...bandit.stats, def: 40 } }, 'physical', st.grid, e).afterDr).toBe(0)
    expect(rawDamage(6, 'mag', lord, bandit, 'magic', st.grid, e)).toMatchObject({ statName: 'mag', statTerm: 0, drTerm: 0, afterDr: 6 })
  })
})

describe('combat/damage — dealDamage', () => {
  it('applies the final target DR, the split, and reports hpLost/armorLost with the tile', () => {
    let st = duel()
    st = patchUnit(st, 'bandit', { armor: 3 })
    const r = dealDamage(st, 'mc', 'bandit', 9, 'physical', { armorPiercing: false, cause: 'card', cover: true }, e)
    const b = unit(r.state, 'bandit')
    expect(b.armor).toBe(0)
    expect(b.hp.current).toBe(13) // 9 − DR 1 = 8: 3 to armor, 5 to HP
    expect(r.effects[0]).toEqual({ kind: 'unitHit', unitId: 'bandit', tile: '4,4', sourceId: 'mc', hpLost: 5, armorLost: 3, damageType: 'physical', lethal: false, redirectedFrom: null, cause: 'card' })
    expect(st.units['bandit']!.hp.current).toBe(18) // input untouched
  })

  it('a killing blow nulls the position, keeps lastTile and emits unitDied with the tile', () => {
    const st = duel({ bandit: { hp: 5 } })
    const r = dealDamage(st, 'mc', 'bandit', 9, 'physical', { armorPiercing: false, cause: 'card', cover: true }, e)
    const b = unit(r.state, 'bandit')
    expect(b.hp.current).toBe(0)
    expect(b.position).toBeNull()
    expect(b.lastTile).toBe('4,4')
    expect(r.effects.map((x) => x.kind)).toEqual(['unitHit', 'sound', 'unitDied', 'sound'])
    expect(r.effects[0]).toMatchObject({ lethal: true, hpLost: 5 })
    expect(r.effects[2]).toEqual({ kind: 'unitDied', unitId: 'bandit', tile: '4,4', team: 'enemy', cause: 'damage' })
  })

  it('a corpse or unknown target is a no-op that returns the same state', () => {
    const st = patchUnit(duel(), 'bandit', { hp: { current: 0, max: 18 }, position: null, lastTile: '4,4' })
    expect(dealDamage(st, 'mc', 'bandit', 9, 'physical', { armorPiercing: false, cause: 'card', cover: true }, e)).toEqual({ state: st, effects: [] })
    expect(dealDamage(st, 'mc', 'ghost', 9, 'physical', { armorPiercing: false, cause: 'card', cover: true }, e).state).toBe(st)
  })

  it('riposte: an adjacent physical attacker takes the defender stacks straight to HP, ignoring armor and not consuming the stance', () => {
    let st = duel({ banditAt: [3, 4] })
    st = patchUnit(st, 'mc', { statuses: [status('riposte', 3, 1)] })
    st = patchUnit(st, 'bandit', { armor: 10 })
    const r = dealDamage(st, 'bandit', 'mc', 9, 'physical', { armorPiercing: false, cause: 'enemyAction', cover: true }, e)
    expect(unit(r.state, 'mc').hp.current).toBe(18)
    expect(unit(r.state, 'bandit').hp.current).toBe(15)
    expect(unit(r.state, 'bandit').armor).toBe(10)
    expect(unit(r.state, 'mc').statuses).toEqual([status('riposte', 3, 1)])
    expect(r.effects.map((x) => x.kind)).toEqual(['unitHit', 'sound', 'riposte', 'unitHit'])
    expect(r.effects[2]).toEqual({ kind: 'riposte', fromId: 'mc', toId: 'bandit', amount: 3 })
    expect(r.effects[3]).toMatchObject({ unitId: 'bandit', sourceId: 'mc', cause: 'riposte', hpLost: 3, armorLost: 0 })
  })

  it('riposte does not fire for magic, for 0 damage, for a non-adjacent attacker, or for DOT', () => {
    let st = duel({ banditAt: [4, 4] })
    st = patchUnit(st, 'mc', { statuses: [status('riposte', 3, 1)] })
    const far = dealDamage(st, 'bandit', 'mc', 9, 'physical', { armorPiercing: false, cause: 'enemyAction', cover: true }, e)
    expect(far.effects.some((x) => x.kind === 'riposte')).toBe(false)
    const near = patchUnit(st, 'bandit', { position: '3,4' })
    const magic = dealDamage(near, 'bandit', 'mc', 9, 'magic', { armorPiercing: false, cause: 'enemyAction', cover: true }, e)
    expect(magic.effects.some((x) => x.kind === 'riposte')).toBe(false)
    const blocked = dealDamage(patchUnit(near, 'mc', { stats: { ...unit(near, 'mc').stats, def: 40 } }), 'bandit', 'mc', 9, 'physical', { armorPiercing: false, cause: 'enemyAction', cover: true }, e)
    expect(blocked.effects.some((x) => x.kind === 'riposte')).toBe(false)
    const dot = dealFlatDamage(near, null, 'mc', 2, 'physical', { armorPiercing: true, cause: 'poison' }, e)
    expect(dot.effects.some((x) => x.kind === 'riposte')).toBe(false)
  })

  it('a riposte can kill the attacker (cause riposte, lastTile kept)', () => {
    let st = duel({ banditAt: [3, 4], bandit: { hp: 2 } })
    st = patchUnit(st, 'mc', { statuses: [status('riposte', 3, 1)] })
    const r = dealDamage(st, 'bandit', 'mc', 9, 'physical', { armorPiercing: false, cause: 'enemyAction', cover: true }, e)
    expect(unit(r.state, 'bandit')).toMatchObject({ hp: { current: 0 }, position: null, lastTile: '3,4' })
    expect(r.effects.find((x) => x.kind === 'unitDied')).toEqual({ kind: 'unitDied', unitId: 'bandit', tile: '3,4', team: 'enemy', cause: 'riposte' })
  })

  it('dealFlatDamage skips DR and cover but still splits, kills and ripostes like any hit', () => {
    let st = duel()
    st = patchUnit(st, 'bandit', { armor: 2, stats: { ...unit(st, 'bandit').stats, def: 40 } })
    const pierce = dealFlatDamage(st, 'mc', 'bandit', 3, 'physical', { armorPiercing: true, cause: 'quiver' }, e)
    expect(unit(pierce.state, 'bandit')).toMatchObject({ hp: { current: 15 }, armor: 2 })
    const split = dealFlatDamage(st, 'mc', 'bandit', 3, 'physical', { armorPiercing: false, cause: 'quiver' }, e)
    expect(unit(split.state, 'bandit')).toMatchObject({ hp: { current: 17 }, armor: 0 })
    expect(dealFlatDamage(st, 'mc', 'bandit', -5, 'physical', { armorPiercing: false, cause: 'quiver' }, e).effects[0]).toMatchObject({ hpLost: 0, armorLost: 0 })
  })

  it('minDamage is data: a positive floor lands even through a wall of DEF', () => {
    const st = duel()
    const floored = withRules(e, { combat: { ...e.rules.combat, minDamage: 1 } })
    const r = dealDamage(patchUnit(st, 'bandit', { stats: { ...unit(st, 'bandit').stats, def: 40 } }), 'mc', 'bandit', 5, 'physical', { armorPiercing: false, cause: 'card', cover: true }, floored)
    expect(unit(r.state, 'bandit').hp.current).toBe(17)
  })
})

describe('combat/damage — grantArmor per knob', () => {
  it('none: uncapped', () => {
    const u = { ...unit(duel(), 'mc'), armor: 40 }
    expect(grantArmor(u, 11, e)).toEqual({ unit: { ...u, armor: 51 }, capped: false })
  })
  it('halfMaxHp: capped at ⌊max/2⌋ and never lowers armor already above it', () => {
    const half = withKnobs(e, { armorCap: 'halfMaxHp' })
    const u = unit(duel(), 'mc') // max 26 → cap 13
    expect(grantArmor({ ...u, armor: 10 }, 5, half)).toEqual({ unit: { ...u, armor: 13 }, capped: true })
    expect(grantArmor({ ...u, armor: 20 }, 5, half)).toEqual({ unit: { ...u, armor: 20 }, capped: true })
    expect(grantArmor({ ...u, armor: 2 }, 5, half)).toEqual({ unit: { ...u, armor: 7 }, capped: false })
  })
  it('resetOnOwnerTurn: uncapped here (the reset lives in startTurn) and 0 amount is a no-op', () => {
    const reset = withKnobs(e, { armorCap: 'resetOnOwnerTurn' })
    const u = { ...unit(duel(), 'mc'), armor: 30 }
    expect(grantArmor(u, 9, reset).unit.armor).toBe(39)
    expect(grantArmor(u, 0, e).unit).toBe(u)
  })
  it('the armor knob resets armor at the owner turn start when it says so', () => {
    const st = patchUnit(seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 4, 4)] } }), 'mc', { armor: 9 })
    const reset = withKnobs(e, { armorCap: 'resetOnOwnerTurn' })
    let s = st
    s = { ...s, turn: { round: 1, unitId: 'b', acted: ['mc', 'b'] } }
    expect(unit(endTurn(s, reset).state, 'mc').armor).toBe(0)
    expect(unit(endTurn(s, e).state, 'mc').armor).toBe(9)
  })
})
