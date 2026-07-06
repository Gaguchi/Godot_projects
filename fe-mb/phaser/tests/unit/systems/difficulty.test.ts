import { describe, it, expect } from 'vitest'
import { enemyLevelFor, scaleEnemyForLevel, regionTierOf } from '../../../src/systems/difficulty'
import { seedGroupBattle } from '../../../src/game/scenes/seedGroupBattle'
import { buildStarterParty } from '../../../src/systems/starterParty'

describe('difficulty scaling (ship plan §12)', () => {
  it('region tiers map to level bands: borderlands 1-2, thornwood 3-4, ashfall 5-6', () => {
    for (let i = 0; i < 20; i++) {
      const b = enemyLevelFor('borderlands', `salt${i}`)
      const t = enemyLevelFor('thornwood', `salt${i}`)
      const a = enemyLevelFor('ashfall', `salt${i}`)
      expect(b).toBeGreaterThanOrEqual(1); expect(b).toBeLessThanOrEqual(2)
      expect(t).toBeGreaterThanOrEqual(3); expect(t).toBeLessThanOrEqual(4)
      expect(a).toBeGreaterThanOrEqual(5); expect(a).toBeLessThanOrEqual(6)
    }
  })

  it('is deterministic for the same salt', () => {
    expect(enemyLevelFor('thornwood', 'x')).toBe(enemyLevelFor('thornwood', 'x'))
  })

  it('unknown regions default to tier 1', () => {
    expect(regionTierOf('nowhere')).toBe(1)
  })

  it('stat curve is monotonic and gentle', () => {
    const base = { str: 4, mag: 0, skl: 3, spd: 4, def: 2, res: 1, lck: 0 }
    let prevHp = 0
    let prevStr = 0
    for (let lvl = 1; lvl <= 7; lvl++) {
      const s = scaleEnemyForLevel(base, 18, lvl)
      expect(s.hp).toBeGreaterThanOrEqual(prevHp)
      expect(s.stats.str).toBeGreaterThanOrEqual(prevStr)
      prevHp = s.hp; prevStr = s.stats.str
    }
    // L6 enemy: +10 HP, +2-3 str over base — gear-pace, not one-shot territory
    const l6 = scaleEnemyForLevel(base, 18, 6)
    expect(l6.hp).toBe(28)
    expect(l6.stats.str).toBe(6)
    // zero mag stays zero (physical classes don't grow casting)
    expect(l6.stats.mag).toBe(0)
  })
})

describe('seedGroupBattle', () => {
  it('scales members to the node level (authored level wins when higher)', () => {
    const evt = seedGroupBattle('bandits_small', 5, { seed: 1, counter: 0 }, buildStarterParty())
    const enemies = evt.payload.units.filter(u => u.team === 'enemy')
    expect(enemies.length).toBeGreaterThan(0)
    for (const e of enemies) {
      expect(e.level).toBeGreaterThanOrEqual(5)
      expect(e.hp.max).toBeGreaterThan(18) // scaled above base
    }
  })

  it('unknown group throws (caller falls back to stub)', () => {
    expect(() => seedGroupBattle('nope', 1, { seed: 1, counter: 0 }, [])).toThrow()
  })

  it('sets explicit teams and builds decks for everyone', () => {
    const evt = seedGroupBattle('wolves', 2, { seed: 1, counter: 0 }, buildStarterParty())
    for (const u of evt.payload.units) expect(u.team === 'party' || u.team === 'enemy').toBe(true)
    for (const u of evt.payload.units) {
      expect(evt.payload.decks?.[u.id as unknown as string]?.draw.length).toBeGreaterThan(0)
    }
  })
})
