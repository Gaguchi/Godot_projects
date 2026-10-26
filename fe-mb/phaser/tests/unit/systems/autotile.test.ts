import { describe, expect, it } from 'vitest'
import { autotileKey, allTileKeys, cellKey } from '../../../src/systems/autotile'

const paint = (...cells: Array<[number, number]>): Set<string> => new Set(cells.map(([x, y]) => cellKey(x, y)))

describe('autotileKey', () => {
  it('fully surrounded cell is the plain fill', () => {
    const p = paint([0, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1])
    expect(autotileKey(p, 0, 0, 'dirt')).toBe('px_dirt')
  })
  it('one missing side uses the authored edge (named by where the dirt continues)', () => {
    // ground to the NORTH → the dirt's edge is on its north side → "edge_s"
    // in the tileset's authored naming (the tile faces south into the dirt).
    const p = paint([0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0])
    expect(autotileKey(p, 0, 0, 'dirt')).toBe('px_dirt_edge_s')
  })
  it('two adjacent missing sides use the authored outer corner', () => {
    const p = paint([0, 0], [1, 0], [1, 1], [0, 1])
    expect(autotileKey(p, 0, 0, 'dirt')).toBe('px_dirt_outer_se')
  })
  it('missing diagonal with both orthogonals present is a concave notch', () => {
    const p = paint([0, 0], [0, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]) // NE absent
    expect(autotileKey(p, 0, 0, 'dirt')).toBe('px_dirt_b0_NE')
  })
  it('an isolated cell is the all-sides piece', () => {
    expect(autotileKey(paint([0, 0]), 0, 0, 'dirt')).toBe('px_dirt_bNESW_0')
  })
  it('opposite sides missing is a generated strip', () => {
    const p = paint([0, 0], [1, 0], [-1, 0])
    expect(autotileKey(p, 0, 0, 'dirt')).toBe('px_dirt_bNS_0')
  })
})

describe('allTileKeys', () => {
  it('is exactly the 47-piece blob set (46 boundary pieces + the fill)', () => {
    const keys = allTileKeys('dirt')
    expect(keys).toHaveLength(47)
    expect(keys).toContain('px_dirt')
    expect(keys).toContain('px_dirt_edge_n')
    expect(keys).toContain('px_dirt_outer_nw')
    expect(keys).toContain('px_dirt_bNESW_0')
    expect(keys).not.toContain('px_dirt_b0_0')
  })
})
