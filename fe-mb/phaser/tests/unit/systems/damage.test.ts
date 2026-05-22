import { describe, it, expect } from 'vitest'
import { applyDamage, computeForecast } from '../../../src/systems/damage'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mkUnit = (id: string, hp: number, armor: number, def = 4, res = 4): Unit => ({
  id: asUnitId(id),
  name: id,
  classId: asClassId('lord'),
  level: 1,
  hp: { current: hp, max: hp },
  stats: { str: 5, mag: 5, skl: 4, spd: 5, def, res, lck: 0 },
  position: null,
  ap: 3,
  armor,
  statuses: [],
})

describe('applyDamage', () => {
  it('physical damage with no armor: full HP loss', () => {
    const u = mkUnit('u', 20, 0)
    const r = applyDamage(u, 8, 'physical')
    expect(r).toEqual({ newArmor: 0, newHp: 12, hpLost: 8, armorLost: 0 })
  })

  it('physical damage absorbed entirely by armor', () => {
    const u = mkUnit('u', 20, 10)
    const r = applyDamage(u, 6, 'physical')
    expect(r).toEqual({ newArmor: 4, newHp: 20, hpLost: 0, armorLost: 6 })
  })

  it('physical damage exceeds armor: residual to HP', () => {
    const u = mkUnit('u', 20, 3)
    const r = applyDamage(u, 8, 'physical')
    expect(r).toEqual({ newArmor: 0, newHp: 15, hpLost: 5, armorLost: 3 })
  })

  it('magic damage with no armor: full HP loss', () => {
    const u = mkUnit('u', 20, 0)
    const r = applyDamage(u, 8, 'magic')
    expect(r).toEqual({ newArmor: 0, newHp: 12, hpLost: 8, armorLost: 0 })
  })

  it('magic damage with armor: half-armor / half-pierce', () => {
    // dmg 8 → halfArmored 4, halfPiercing 4
    // armor=3 absorbs 3 of the 4 armored half; 1 leaks
    // total hpLost = 1 + 4 = 5
    const u = mkUnit('u', 20, 3)
    const r = applyDamage(u, 8, 'magic')
    expect(r).toEqual({ newArmor: 0, newHp: 15, hpLost: 5, armorLost: 3 })
  })

  it('magic damage with abundant armor: armored half fully blocked, pierce half through', () => {
    // dmg 6 → halfArmored 3, halfPiercing 3
    const u = mkUnit('u', 20, 10)
    const r = applyDamage(u, 6, 'magic')
    expect(r).toEqual({ newArmor: 7, newHp: 17, hpLost: 3, armorLost: 3 })
  })

  it('odd damage with armor: floor(amount/2) for armored half', () => {
    // dmg 7 → halfArmored 3 (floor), halfPiercing 4
    // armor=2 absorbs 2 of armored half; 1 leaks; pierce 4
    // hpLost = 1 + 4 = 5
    const u = mkUnit('u', 20, 2)
    const r = applyDamage(u, 7, 'magic')
    expect(r).toEqual({ newArmor: 0, newHp: 15, hpLost: 5, armorLost: 2 })
  })

  it('zero damage is a no-op', () => {
    const u = mkUnit('u', 20, 5)
    const r = applyDamage(u, 0, 'physical')
    expect(r).toEqual({ newArmor: 5, newHp: 20, hpLost: 0, armorLost: 0 })
  })

  it('damage exceeds HP: clamped at 0', () => {
    const u = mkUnit('u', 5, 0)
    const r = applyDamage(u, 100, 'physical')
    expect(r.newHp).toBe(0)
    expect(r.hpLost).toBe(5)
  })
})

const card = {
  id: 'iron_sword_thrust',
  name: 'Iron Sword Thrust',
  apCost: 2,
  damageStat: 'str' as const,
  effects: [{ kind: 'Damage', params: { base: 8 } }],
}

describe('computeForecast', () => {
  it('returns null when card has no Damage or Heal effect', () => {
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 20, 0)
    const utility = { ...card, effects: [{ kind: 'GainAp', params: { amount: 1 } }] }
    expect(computeForecast(utility, src, tgt, 0)).toBeNull()
  })

  it('damage forecast: base + STR − DR, then armor absorbs', () => {
    const src = mkUnit('src', 20, 0)        // STR 5
    const tgt = mkUnit('tgt', 14, 2, 4, 4)  // armor 2, def 4 → DR 2
    // raw = 8 + 5 = 13; afterDR = 13 − 2 = 11; armor 2 absorbs; hp loss 9
    const r = computeForecast(card, src, tgt, 0)!
    expect(r).toMatchObject({
      damageBefore: 11,
      armorLost: 2,
      hpLost: 9,
      predictedHp: 5,
      predictedArmor: 0,
      lethal: false,
      damageType: 'physical',
    })
  })

  it('damage forecast: lethal flag when predicted HP === 0', () => {
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 5, 0, 0, 0)
    const r = computeForecast(card, src, tgt, 0)!
    expect(r.predictedHp).toBe(0)
    expect(r.lethal).toBe(true)
  })

  it('terrain DR adds to defensive DR', () => {
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 20, 0, 0, 0)
    // raw=13; afterDR = 13 − 0 (def) − 3 (terrain) = 10
    const r = computeForecast(card, src, tgt, 3)!
    expect(r.damageBefore).toBe(10)
    expect(r.hpLost).toBe(10)
    expect(r.drTerm).toBe(3)
    expect(r.terrainDr).toBe(3)
  })

  it('heal forecast: positive heal capped at max HP', () => {
    const heal = {
      id: 'heal_staff_heal',
      apCost: 1,
      effects: [{ kind: 'Heal', params: { amount: 8 } }],
    }
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 12, 0)
    tgt.hp.current = 12
    tgt.hp.max = 22
    const r = computeForecast(heal, src, tgt, 0)!
    expect(r).toMatchObject({
      heal: 8,
      predictedHp: 20,
      damageBefore: 0,
      hpLost: 0,
      lethal: false,
    })
  })

  it('heal forecast: caps when overflow', () => {
    const heal = {
      id: 'heal_staff_restore',
      apCost: 2,
      effects: [{ kind: 'Heal', params: { amount: 15 } }],
    }
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 18, 0)
    tgt.hp.current = 18
    tgt.hp.max = 22
    const r = computeForecast(heal, src, tgt, 0)!
    expect(r.heal).toBe(4)
    expect(r.predictedHp).toBe(22)
  })

  it('exposes breakdown terms for math row', () => {
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 14, 0, 4, 4)
    const r = computeForecast(card, src, tgt, 0)!
    expect(r.baseTerm).toBe(8)
    expect(r.statName).toBe('str')
    expect(r.statTerm).toBe(5)
    expect(r.drTerm).toBe(2)
  })
})
