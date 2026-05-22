import { describe, it, expect } from 'vitest'
import { baseClassCost, recruitmentCost } from '../../../src/systems/recruitmentCost'

describe('recruitmentCost', () => {
  it('L1 cost equals base for known classes', () => {
    expect(recruitmentCost('knight', 1)).toBe(140)
    expect(recruitmentCost('mage', 1)).toBe(180)
    expect(recruitmentCost('lord', 1)).toBe(220)
    expect(recruitmentCost('bandit', 1)).toBe(80)
  })

  it('unknown class falls back to 120 baseline', () => {
    expect(baseClassCost('phantom_class')).toBe(120)
    expect(recruitmentCost('phantom_class', 1)).toBe(120)
  })

  it('level multiplier: L2 = base × 1.5, L5 = base × 3', () => {
    expect(recruitmentCost('knight', 2)).toBe(210) // 140 × 1.5
    expect(recruitmentCost('knight', 5)).toBe(420) // 140 × 3
  })

  it('L0 / negative level clamped to L1', () => {
    expect(recruitmentCost('knight', 0)).toBe(140)
    expect(recruitmentCost('knight', -3)).toBe(140)
  })
})
