import { describe, it, expect } from 'vitest'
import { manhattan, tilesInRange, tilesInAoe } from '../../../src/systems/targeting'
import { asTileId } from '../../../src/domain/ids'

const grid = (w: number, h: number) => ({ width: w, height: h, obstacles: new Set([]) })

describe('targeting', () => {
  it('manhattan distance', () => {
    expect(manhattan(asTileId('0,0'), asTileId('3,4'))).toBe(7)
  })

  it('tilesInRange respects min/max', () => {
    const out = tilesInRange(asTileId('5,5'), 1, 1, grid(10, 10))
    expect(out.length).toBe(4)
    expect(out.map(t => t as unknown as string).sort()).toEqual(['4,5', '5,4', '5,6', '6,5'])
  })

  it('tilesInAoe includes center', () => {
    const out = tilesInAoe(asTileId('5,5'), 1, grid(10, 10))
    expect(out.length).toBe(5)  // center + 4 neighbors
  })

  it('obstacles excluded', () => {
    const state = { width: 10, height: 10, obstacles: new Set([asTileId('5,4')]) }
    const out = tilesInRange(asTileId('5,5'), 1, 1, state)
    expect(out.length).toBe(3)
  })
})
