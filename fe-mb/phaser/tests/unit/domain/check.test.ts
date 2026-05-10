import { describe, it, expect } from 'vitest'
import { CheckRequirementSchema } from '../../../src/data/schemas/check'

describe('CheckRequirementSchema', () => {
  it('accepts stat check', () => {
    const r = CheckRequirementSchema.parse({ kind: 'stat', stat: 'str', threshold: 7 })
    expect(r.kind).toBe('stat')
  })

  it('accepts class check', () => {
    const r = CheckRequirementSchema.parse({ kind: 'class', classId: 'cleric' })
    expect(r.kind).toBe('class')
  })

  it('accepts gold check', () => {
    const r = CheckRequirementSchema.parse({ kind: 'gold', amount: 100 })
    expect(r.kind).toBe('gold')
  })

  it('accepts food check', () => {
    const r = CheckRequirementSchema.parse({ kind: 'food', amount: 3 })
    expect(r.kind).toBe('food')
  })

  it('rejects unknown stat', () => {
    expect(() => CheckRequirementSchema.parse({ kind: 'stat', stat: 'unknown', threshold: 5 }))
      .toThrow()
  })

  it('rejects negative thresholds', () => {
    expect(() => CheckRequirementSchema.parse({ kind: 'stat', stat: 'str', threshold: -1 }))
      .toThrow()
    expect(() => CheckRequirementSchema.parse({ kind: 'gold', amount: -5 })).toThrow()
  })

  it('rejects missing fields', () => {
    expect(() => CheckRequirementSchema.parse({ kind: 'stat' })).toThrow()
    expect(() => CheckRequirementSchema.parse({ kind: 'class' })).toThrow()
  })

  it('rejects unknown kind', () => {
    expect(() => CheckRequirementSchema.parse({ kind: 'phantom', x: 1 })).toThrow()
  })

  it('accepts all 7 stat keys including lck', () => {
    for (const stat of ['str', 'mag', 'skl', 'spd', 'def', 'res', 'lck']) {
      const r = CheckRequirementSchema.parse({ kind: 'stat', stat, threshold: 5 })
      expect(r.kind).toBe('stat')
    }
  })
})
