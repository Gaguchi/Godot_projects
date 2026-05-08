import { describe, it, expect } from 'vitest'
import { STATUS_EFFECTS, getStatusEffect } from '../../../src/systems/statusEffects'
import { asStatusEffectId, asUnitId } from '../../../src/domain/ids'

describe('statusEffects registry', () => {
  it('registers poison and burn', () => {
    expect(getStatusEffect(asStatusEffectId('poison'))).toBeDefined()
    expect(getStatusEffect(asStatusEffectId('burn'))).toBeDefined()
  })

  it('poison is non-stacking (refresh-on-reapply)', () => {
    expect(getStatusEffect(asStatusEffectId('poison'))!.stackable).toBe(false)
  })

  it('burn is stacking', () => {
    expect(getStatusEffect(asStatusEffectId('burn'))!.stackable).toBe(true)
  })

  it('poison onTurnEnd emits Damage equal to stacks', () => {
    const def = getStatusEffect(asStatusEffectId('poison'))!
    const out = def.onTurnEnd!({ selfUnitId: asUnitId('e'), selfStacks: 3, selfTurnsRemaining: 2 })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'Damage', amount: 3, damageType: 'physical', armorPiercing: true })
  })

  it('burn onTurnEnd emits Damage equal to stacks', () => {
    const def = getStatusEffect(asStatusEffectId('burn'))!
    const out = def.onTurnEnd!({ selfUnitId: asUnitId('e'), selfStacks: 5, selfTurnsRemaining: 2 })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'Damage', amount: 5, damageType: 'magic' })
  })

  it('exposes registry as iterable', () => {
    expect(STATUS_EFFECTS.length).toBe(2)
  })
})
