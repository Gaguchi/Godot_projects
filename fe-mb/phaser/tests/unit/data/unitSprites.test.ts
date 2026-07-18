import { describe, it, expect } from 'vitest'
import {
  spriteIdForUnit, spritePathFor, ALL_SPRITE_IDS, UNIT_ID_SPRITES,
} from '../../../src/data/unitSprites'

describe('unitSprites — id-keyed lookup, no name matching', () => {
  it('unit id wins over class fallback', () => {
    expect(spriteIdForUnit('daren', 'bandit')).toBe('daren')
    expect(spriteIdForUnit('roy', 'lord')).toBe('roy')
    expect(spriteIdForUnit('warlord_boss', 'warlord')).toBe('warlord')
  })

  it('pack copy-suffix strips to the member id (wolf_0 → wolf sprite)', () => {
    expect(spriteIdForUnit('wolf_0', 'bandit')).toBe('wolf')
    expect(spriteIdForUnit('wolf_2', 'bandit')).toBe('wolf')
  })

  it('generated group ids fall back to the class sprite', () => {
    expect(spriteIdForUnit('darens_gang_0', 'bandit')).toBe('bandit')
    expect(spriteIdForUnit('brigands_1', 'bandit')).toBe('bandit')
    expect(spriteIdForUnit(null, 'shield_knight')).toBe('shield_knight')
    expect(spriteIdForUnit(undefined, 'mage')).toBe('lilina')
  })

  it('unknown id + unknown class → null (shape token)', () => {
    expect(spriteIdForUnit('nobody', 'not_a_class')).toBeNull()
  })

  it('preload manifest is unique and covers every id-mapped sprite', () => {
    expect(new Set(ALL_SPRITE_IDS).size).toBe(ALL_SPRITE_IDS.length)
    for (const s of Object.values(UNIT_ID_SPRITES)) expect(ALL_SPRITE_IDS).toContain(s)
  })

  it('builds public sprite paths', () => {
    expect(spritePathFor('roy')).toBe('/sprites/units/roy.png')
  })
})
