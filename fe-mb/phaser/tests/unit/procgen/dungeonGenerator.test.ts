import { describe, it, expect } from 'vitest'
import { generateDungeon } from '../../../src/procgen/dungeonGenerator'
import { createRng } from '../../../src/systems/rng'

describe('dungeonGenerator (StS-style)', () => {
  it('produces a 6+1 row graph with boss at last row', () => {
    const g = generateDungeon(createRng({ seed: 1, counter: 0 }), { dungeonId: 'd1' })
    expect(g.rows.length).toBe(7)
    expect(g.bossRow).toBe(6)
    const bossRow = g.rows[g.bossRow]!
    expect(bossRow.some((r) => r.type === 'boss')).toBe(true)
  })

  it('is deterministic given seed', () => {
    const a = generateDungeon(createRng({ seed: 42, counter: 0 }), { dungeonId: 'd1' })
    const b = generateDungeon(createRng({ seed: 42, counter: 0 }), { dungeonId: 'd1' })
    expect(a).toEqual(b)
  })

  it('all paths converge to boss (every last-data-row room connects to boss)', () => {
    const g = generateDungeon(createRng({ seed: 7, counter: 0 }), { dungeonId: 'd1' })
    const lastDataRow = g.rows[g.bossRow - 1]!
    const bossId = g.rows[g.bossRow]!.find((r) => r.type === 'boss')!.id as unknown as string
    for (const room of lastDataRow) {
      const fromId = room.id as unknown as string
      const hasEdge = g.edges.some(
        ([f, t]) => (f as unknown as string) === fromId && (t as unknown as string) === bossId,
      )
      expect(hasEdge, `room ${fromId} should connect to boss`).toBe(true)
    }
  })

  it('row 0 is all combat rooms (StS canonical)', () => {
    const g = generateDungeon(createRng({ seed: 13, counter: 0 }), { dungeonId: 'd1' })
    for (const room of g.rows[0]!) {
      expect(room.type).toBe('combat')
    }
  })

  it('last data row is all rest rooms', () => {
    const g = generateDungeon(createRng({ seed: 99, counter: 0 }), { dungeonId: 'd1' })
    const lastDataRow = g.rows[g.bossRow - 1]!
    for (const room of lastDataRow) {
      expect(room.type).toBe('rest')
    }
  })
})
