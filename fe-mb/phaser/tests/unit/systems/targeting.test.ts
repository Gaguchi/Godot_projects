import { describe, it, expect } from 'vitest'
import { manhattan, tilesInRange, tilesInAoe, tilesReachable } from '../../../src/systems/targeting'
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

  it('tilesReachable: 4 steps in open field reaches diamond of 40 tiles', () => {
    const out = tilesReachable(asTileId('5,5'), 4, grid(14, 14), new Set())
    // Diamond manhattan ≤ 4 minus origin: 1+3+5+7+9 + 7+5+3+1 - 1 = 41 - 1 = 40
    expect(out.length).toBe(40)
  })

  it('tilesReachable: blocked tile prevents passage', () => {
    // Block 5,5 entirely with neighbors blocked → unit at 5,5 with 1 step reaches nothing
    const blocked = new Set(['5,4', '5,6', '4,5', '6,5'])
    const out = tilesReachable(asTileId('5,5'), 4, grid(14, 14), blocked)
    expect(out).toEqual([])
  })

  it('tilesReachable: respects grid boundary', () => {
    // Corner unit with 2 steps — can reach 5 tiles total in a 3x3 quadrant minus origin
    const out = tilesReachable(asTileId('0,0'), 2, grid(14, 14), new Set())
    const set = new Set(out.map((t) => t as unknown as string))
    expect(set.has('1,0')).toBe(true)
    expect(set.has('0,1')).toBe(true)
    expect(set.has('2,0')).toBe(true)
    expect(set.has('0,2')).toBe(true)
    expect(set.has('1,1')).toBe(true)
    expect(set.has('-1,0')).toBe(false)
  })

  it('tilesReachable: maxSteps 0 returns empty', () => {
    expect(tilesReachable(asTileId('5,5'), 0, grid(14, 14), new Set())).toEqual([])
  })
})
