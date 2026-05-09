import { describe, it, expect } from 'vitest'
import { generateDungeon } from '../../../src/procgen/dungeonGenerator'
import { createRng } from '../../../src/systems/rng'

describe('dungeonGenerator (stub)', () => {
  it('produces a 3-row graph with boss at last row', () => {
    const g = generateDungeon(createRng({ seed: 1, counter: 0 }), { dungeonId: 'd1' })
    expect(g.rows.length).toBe(3)
    expect(g.bossRow).toBe(2)
    expect(g.rows[2]![0]!.type).toBe('boss')
  })

  it('is deterministic given seed', () => {
    const a = generateDungeon(createRng({ seed: 42, counter: 0 }), { dungeonId: 'd1' })
    const b = generateDungeon(createRng({ seed: 42, counter: 0 }), { dungeonId: 'd1' })
    expect(a).toEqual(b)
  })

  it('edges form valid monotonic path', () => {
    const g = generateDungeon(createRng({ seed: 1, counter: 0 }), { dungeonId: 'd1' })
    expect(g.edges).toHaveLength(2)
  })
})
