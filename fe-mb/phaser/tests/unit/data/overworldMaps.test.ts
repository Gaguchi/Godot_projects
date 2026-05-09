import { describe, it, expect } from 'vitest'
import { WorldMapSchema } from '../../../src/data/schemas/map'
import borderlands from '../../../src/data/content/overworld/borderlands.json'
import thornwood from '../../../src/data/content/overworld/thornwood.json'
import ashfall from '../../../src/data/content/overworld/ashfall.json'

describe('ported overworld maps (GP-D1)', () => {
  it('borderlands has 15 nodes and parses', () => {
    expect(borderlands.nodes.length).toBe(15)
    const r = WorldMapSchema.safeParse(borderlands)
    if (!r.success) console.error(JSON.stringify(r.error.format(), null, 2))
    expect(r.success).toBe(true)
  })

  it('thornwood has 15 nodes and parses', () => {
    expect(thornwood.nodes.length).toBe(15)
    expect(WorldMapSchema.safeParse(thornwood).success).toBe(true)
  })

  it('ashfall has 16 nodes and parses', () => {
    expect(ashfall.nodes.length).toBe(16)
    expect(WorldMapSchema.safeParse(ashfall).success).toBe(true)
  })

  it('every map has at least 1 town', () => {
    for (const m of [borderlands, thornwood, ashfall]) {
      const towns = m.nodes.filter((n) => n.type === 'town')
      expect(towns.length).toBeGreaterThan(0)
    }
  })

  it('borderlands has Pine Crossing town', () => {
    const pine = borderlands.nodes.find((n) => n.id === 'pine_crossing')
    expect(pine).toBeDefined()
    expect(pine?.type).toBe('town')
  })

  it('region edges link borderlands ↔ thornwood ↔ ashfall', () => {
    const all = [...(borderlands.regionEdges ?? []), ...(thornwood.regionEdges ?? []), ...(ashfall.regionEdges ?? [])]
    const pairs = new Set(all.map((e) => `${e.fromMapId}|${e.toMapId}`))
    expect(pairs.size).toBeGreaterThanOrEqual(2)
  })
})
