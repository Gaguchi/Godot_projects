import { describe, it, expect } from 'vitest'
import { createRng, deriveRng } from '../../../src/systems/rng'

describe('rng', () => {
  it('is deterministic given same seed', () => {
    const a = createRng({ seed: 12345, counter: 0 })
    const b = createRng({ seed: 12345, counter: 0 })
    const seqA = [a.next(), a.next(), a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })

  it('differs across distinct seeds', () => {
    const a = createRng({ seed: 1, counter: 0 })
    const b = createRng({ seed: 2, counter: 0 })
    expect(a.next()).not.toBe(b.next())
  })

  it('nextInt is in [min, max] inclusive', () => {
    const r = createRng({ seed: 99, counter: 0 })
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it('pick returns an element from the array', () => {
    const r = createRng({ seed: 7, counter: 0 })
    const arr = ['a', 'b', 'c'] as const
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(r.pick(arr as unknown as string[]))
    }
  })

  it('shuffle returns a NEW array, same elements', () => {
    const r = createRng({ seed: 42, counter: 0 })
    const orig = [1, 2, 3, 4, 5]
    const out = r.shuffle(orig)
    expect(out).not.toBe(orig)
    expect(out.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('derive produces deterministic sub-rng per (parent, label)', () => {
    const parent = createRng({ seed: 100, counter: 0 })
    const a = deriveRng(parent, 'world')
    const b = deriveRng(parent, 'world')
    expect(a.next()).toBe(b.next())
  })

  it('derive produces different streams per label', () => {
    const parent = createRng({ seed: 100, counter: 0 })
    const a = deriveRng(parent, 'world')
    const b = deriveRng(parent, 'dungeon')
    expect(a.next()).not.toBe(b.next())
  })
})
