import { describe, it, expect } from 'vitest'
import { seedStubBattle } from '../../../src/game/scenes/seedStubBattle'

const tileX = (t: string): number => parseInt(t.split(',')[0]!, 10)

describe('seedStubBattle', () => {
  it('produces a startBattle event with 6 units (3 party + 3 enemies)', () => {
    const evt = seedStubBattle({ seed: 42, counter: 0 })
    expect(evt.type).toBe('startBattle')
    expect(evt.payload.units.length).toBe(6)
  })

  it('includes Roy, Marcus, Lilina, and three Bandits', () => {
    const evt = seedStubBattle({ seed: 42, counter: 0 })
    const ids = evt.payload.units.map((u) => u.id as unknown as string)
    expect(ids).toContain('roy')
    expect(ids).toContain('marcus')
    expect(ids).toContain('lilina')
    expect(ids).toContain('bandit_a')
    expect(ids).toContain('bandit_b')
    expect(ids).toContain('bandit_c')
  })

  it('places party (Roy/Marcus/Lilina) in columns 0-2', () => {
    const evt = seedStubBattle({ seed: 42, counter: 0 })
    const partyIds = new Set(['roy', 'marcus', 'lilina'])
    for (const u of evt.payload.units) {
      if (partyIds.has(u.id as unknown as string)) {
        expect(tileX(u.position as unknown as string)).toBeLessThanOrEqual(2)
      }
    }
  })

  it('places enemies (Bandits) in columns 11-13', () => {
    const evt = seedStubBattle({ seed: 42, counter: 0 })
    for (const u of evt.payload.units) {
      if ((u.id as unknown as string).startsWith('bandit_')) {
        expect(tileX(u.position as unknown as string)).toBeGreaterThanOrEqual(11)
      }
    }
  })

  it('grid is 14×10 with no obstacles', () => {
    const evt = seedStubBattle({ seed: 42, counter: 0 })
    expect(evt.payload.grid.width).toBe(14)
    expect(evt.payload.grid.height).toBe(10)
    expect(evt.payload.grid.obstacles.size).toBe(0)
  })

  it('threads rngSeed through to the payload', () => {
    const evt = seedStubBattle({ seed: 99, counter: 7 })
    expect(evt.payload.rngSeed).toEqual({ seed: 99, counter: 7 })
  })

  it('all party units have full HP and 3 AP', () => {
    const evt = seedStubBattle({ seed: 42, counter: 0 })
    for (const u of evt.payload.units) {
      expect(u.hp.current).toBe(u.hp.max)
      expect(u.ap).toBe(3)
      expect(u.armor).toBe(0)
      expect(u.statuses).toEqual([])
    }
  })

  it('is deterministic given the same seed', () => {
    const a = seedStubBattle({ seed: 42, counter: 0 })
    const b = seedStubBattle({ seed: 42, counter: 0 })
    expect(a.payload.units).toEqual(b.payload.units)
    expect(a.payload.rngSeed).toEqual(b.payload.rngSeed)
  })
})
