import { describe, it, expect } from 'vitest'
import { seedStubBattle } from '../../../src/game/scenes/seedStubBattle'
import { buildUnit } from '../../../src/systems/buildUnit'

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

  it('places enemies (Bandits) in middle-right columns (close enough for engagement on turn 1-2)', () => {
    const evt = seedStubBattle({ seed: 42, counter: 0 })
    for (const u of evt.payload.units) {
      if ((u.id as unknown as string).startsWith('bandit_')) {
        const x = tileX(u.position as unknown as string)
        // Bandits at 8-9 — close enough that movement-5 units can engage
        // on turn 1 (party at column 1-2, distance 6-8). Was 11-13, which
        // forced 2-3 turns of pure walking before any combat could happen.
        expect(x).toBeGreaterThanOrEqual(7)
        expect(x).toBeLessThanOrEqual(10)
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

  it('builds a deck for every unit with hand populated from innate cards', () => {
    const evt = seedStubBattle({ seed: 42, counter: 0 })
    expect(evt.payload.decks).toBeDefined()
    const decks = evt.payload.decks!
    for (const u of evt.payload.units) {
      const deck = decks[u.id as unknown as string]
      expect(deck).toBeDefined()
      expect(deck!.hand.length).toBeGreaterThan(0)
      expect(deck!.draw.length).toBeGreaterThan(0)
      expect(deck!.discard).toEqual([])
    }
  })

  it('is deterministic given the same seed', () => {
    const a = seedStubBattle({ seed: 42, counter: 0 })
    const b = seedStubBattle({ seed: 42, counter: 0 })
    expect(a.payload.units).toEqual(b.payload.units)
    expect(a.payload.rngSeed).toEqual(b.payload.rngSeed)
  })
})

describe('seedStubBattle — recruited party (post-recruitment)', () => {
  it('uses recruited party when provided (Garrik + Lyra instead of Roy/Marcus/Lilina)', () => {
    const garrik = buildUnit('knight', 1, 'Garrik', 'recruit_garrik')!
    const lyra = buildUnit('mage', 1, 'Lyra', 'recruit_lyra')!
    const evt = seedStubBattle({ seed: 1, counter: 0 }, [garrik, lyra])
    const partyNames = evt.payload.units
      .filter((u) => (u.classId as unknown as string) !== 'bandit')
      .map((u) => u.name)
      .sort()
    expect(partyNames).toEqual(['Garrik', 'Lyra'])
  })

  it('positions recruited party in left columns + scrubs runtime state', () => {
    const u = buildUnit('knight', 5, 'Garrik', 'r1')!
    // Pollute runtime state to confirm seedStubBattle clears it before spawn
    u.position = '8,8' as never
    u.ap = 99
    u.armor = 50
    const evt = seedStubBattle({ seed: 1, counter: 0 }, [u])
    const seeded = evt.payload.units.find((x) => x.name === 'Garrik')!
    expect(tileX(seeded.position as unknown as string)).toBeLessThanOrEqual(2)
    expect(seeded.ap).toBe(3)
    expect(seeded.armor).toBe(0)
    expect(seeded.stats.def).toBe(12) // knight L5 = base 8 + lvl-bonus 4
  })

  it('caps recruited party at 6 units (6 spawn slots)', () => {
    const big = Array.from({ length: 10 }, (_, i) =>
      buildUnit('knight', 1, `Unit${i}`, `r${i}`)!,
    )
    const evt = seedStubBattle({ seed: 1, counter: 0 }, big)
    const partyCount = evt.payload.units.filter(
      (u) => (u.classId as unknown as string) !== 'bandit',
    ).length
    expect(partyCount).toBe(6)
  })

  it('empty recruited array still falls back to default trio', () => {
    const evt = seedStubBattle({ seed: 1, counter: 0 }, [])
    const names = evt.payload.units.map((u) => u.name).sort()
    expect(names).toEqual(['Bandit', 'Bandit', 'Bandit', 'Lilina', 'Marcus', 'Roy'])
  })
})
