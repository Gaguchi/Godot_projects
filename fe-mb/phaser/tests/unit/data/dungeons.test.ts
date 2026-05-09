import { describe, it, expect } from 'vitest'
import { DungeonDefSchema } from '../../../src/data/schemas/dungeonDef'
import smugglers from '../../../src/data/content/dungeons/smugglers_cave.json'
import ancient from '../../../src/data/content/dungeons/ancient_ruins.json'
import depths from '../../../src/data/content/dungeons/thornwood_depths.json'
import iron from '../../../src/data/content/dungeons/iron_mine.json'
import obsidian from '../../../src/data/content/dungeons/obsidian_cavern.json'

describe('ported dungeons (GP-F1)', () => {
  it('5 dungeons', () => {
    expect([smugglers, ancient, depths, iron, obsidian].length).toBe(5)
  })

  it('every dungeon parses DungeonDefSchema', () => {
    for (const d of [smugglers, ancient, depths, iron, obsidian]) {
      const r = DungeonDefSchema.safeParse(d)
      if (!r.success) console.error(d.id, JSON.stringify(r.error.format(), null, 2))
      expect(r.success).toBe(true)
    }
  })

  it('dungeons span all 3 regions', () => {
    const regions = new Set([smugglers, ancient, depths, iron, obsidian].map((d) => d.regionId))
    expect(regions).toEqual(new Set(['borderlands', 'thornwood', 'ashfall']))
  })
})
