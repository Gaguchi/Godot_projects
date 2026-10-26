import { describe, expect, it } from 'vitest'
import { generateDirtRegion } from '../../../src/systems/boardFloor'
import { createRng } from '../../../src/systems/rng'

describe('generateDirtRegion', () => {
  it('is deterministic for the same rng state', () => {
    const a = generateDirtRegion(14, 10, createRng({ seed: 7, counter: 0 }))
    const b = generateDirtRegion(14, 10, createRng({ seed: 7, counter: 0 }))
    expect([...a].sort()).toEqual([...b].sort())
  })
  it('differs across seeds', () => {
    const a = generateDirtRegion(14, 10, createRng({ seed: 7, counter: 0 }))
    const b = generateDirtRegion(14, 10, createRng({ seed: 8, counter: 0 }))
    expect([...a].sort()).not.toEqual([...b].sort())
  })
  it('stays inside the grid and leaves most of the board as grass', () => {
    for (const seed of [1, 2, 3, 11, 42, 99]) {
      for (const [w, h] of [[5, 5], [14, 10]] as const) {
        const cells = generateDirtRegion(w, h, createRng({ seed, counter: 0 }))
        for (const key of cells) {
          const [x, y] = key.split(',').map(Number) as [number, number]
          expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThan(w); expect(y).toBeLessThan(h)
        }
        expect(cells.size).toBeLessThanOrEqual(Math.floor(w * h * 0.35))
      }
    }
  })
  it('never leaves an orphan dirt cell', () => {
    for (const seed of [1, 2, 3, 11, 42, 99]) {
      const cells = generateDirtRegion(14, 10, createRng({ seed, counter: 0 }))
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number) as [number, number]
        const hasOrth = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => cells.has(`${x + dx!},${y + dy!}`))
        expect(hasOrth).toBe(true)
      }
    }
  })
})
