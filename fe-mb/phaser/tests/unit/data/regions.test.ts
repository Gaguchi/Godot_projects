import { describe, it, expect } from 'vitest'
import { RegionSchema } from '../../../src/data/schemas/region'
import regionsJson from '../../../src/data/content/regions.json'

describe('regions.json (GP-C1)', () => {
  it('contains 3 regions', () => {
    expect(regionsJson.length).toBe(3)
  })

  it('every region passes RegionSchema', () => {
    for (const r of regionsJson) {
      expect(() => RegionSchema.parse(r)).not.toThrow()
    }
  })

  it('regions are tier 1, 2, 3 (one each)', () => {
    const tiers = new Set(regionsJson.map((r) => r.tier))
    expect(tiers).toEqual(new Set([1, 2, 3]))
  })

  it('region ids match Godot overworld regions', () => {
    const ids = regionsJson.map((r) => r.id).sort()
    expect(ids).toEqual(['ashfall', 'borderlands', 'thornwood'])
  })
})
