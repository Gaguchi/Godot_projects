import { describe, it, expect } from 'vitest'
import { buildUnit } from '../../../src/systems/buildUnit'

describe('buildUnit', () => {
  it('returns null for unknown class', () => {
    expect(buildUnit('phantom', 1)).toBeNull()
  })

  it('L1 Knight uses class base stats verbatim', () => {
    const u = buildUnit('knight', 1, 'Garrik', 'recruit_knight_1')!
    expect(u.classId as unknown as string).toBe('knight')
    expect(u.name).toBe('Garrik')
    expect(u.id as unknown as string).toBe('recruit_knight_1')
    // Knight base stats: str 7, mag 0, skl 4, spd 3, def 8, res 1, lck 2
    expect(u.stats.str).toBe(7)
    expect(u.stats.def).toBe(8)
    expect(u.stats.mag).toBe(0) // zero stats stay zero (no +lvl lift)
    expect(u.hp.current).toBe(28)
    expect(u.hp.max).toBe(28)
    expect(u.level).toBe(1)
  })

  it('L3 Knight lifts positive stats by +2, hp by +6', () => {
    const u = buildUnit('knight', 3, 'Greta', 'recruit_knight_3')!
    expect(u.stats.str).toBe(9)   // 7 + 2
    expect(u.stats.def).toBe(10)  // 8 + 2
    expect(u.stats.mag).toBe(0)   // stays 0
    expect(u.hp.current).toBe(34) // 28 + 6
    expect(u.hp.max).toBe(34)
    expect(u.level).toBe(3)
  })

  it('falls back to class name when no nameHint', () => {
    const u = buildUnit('mage', 1, undefined, 'recruit_mage')!
    expect(u.name).toBe('Mage')
  })
})
