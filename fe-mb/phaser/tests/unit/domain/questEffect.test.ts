import { describe, it, expect } from 'vitest'
import { QuestEffectSchema } from '../../../src/data/schemas/quest'

describe('QuestEffectSchema (GP-B1)', () => {
  it('accepts addGold', () => {
    expect(QuestEffectSchema.parse({ kind: 'addGold', amount: 50 })).toBeTruthy()
  })

  it('accepts addFood', () => {
    expect(QuestEffectSchema.parse({ kind: 'addFood', amount: 3 })).toBeTruthy()
  })

  it('accepts damageParty', () => {
    expect(QuestEffectSchema.parse({ kind: 'damageParty', amount: 5 })).toBeTruthy()
  })

  it('accepts healParty with percent in [0,1]', () => {
    expect(QuestEffectSchema.parse({ kind: 'healParty', percent: 0.3 })).toBeTruthy()
    expect(() => QuestEffectSchema.parse({ kind: 'healParty', percent: 1.5 })).toThrow()
  })

  it('accepts statCheck with nested success/fail effects', () => {
    expect(QuestEffectSchema.parse({
      kind: 'statCheck',
      stat: 'spd',
      threshold: 10,
      successEffects: [{ kind: 'addGold', amount: 100 }],
      failEffects: [{ kind: 'damageParty', amount: 5 }],
    })).toBeTruthy()
  })

  it('rejects unknown stat', () => {
    expect(() => QuestEffectSchema.parse({
      kind: 'statCheck', stat: 'wisdom', threshold: 10,
      successEffects: [], failEffects: [],
    })).toThrow()
  })
})
