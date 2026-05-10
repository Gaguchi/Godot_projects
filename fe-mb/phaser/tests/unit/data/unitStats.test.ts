import { describe, it, expect } from 'vitest'
import { UnitStatsSchema } from '../../../src/data/schemas/unit'

describe('UnitStats with lck', () => {
  it('parses with lck = 0', () => {
    const r = UnitStatsSchema.parse({ str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 0 })
    expect(r.lck).toBe(0)
  })

  it('rejects when lck is missing', () => {
    expect(() => UnitStatsSchema.parse({ str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 })).toThrow()
  })

  it('accepts non-zero lck', () => {
    const r = UnitStatsSchema.parse({ str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 4 })
    expect(r.lck).toBe(4)
  })
})
