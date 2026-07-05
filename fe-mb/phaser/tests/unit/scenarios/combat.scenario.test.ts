/**
 * Golden combat scenarios — deterministic, headless regression tests that drive
 * the SAME engine as the CLI (`scripts/cli/combat.ts`) through the real
 * combatStore + pure reducer. Fast (no browser); catches logic/balance drift.
 *
 * NOTE: these protect the systems/reducer layer. Phaser-input bugs (e.g. the
 * onUnitClick targeting regression) live in BoardScene and need a Playwright
 * test — see tests/e2e.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCombatStore } from '../../../src/state/combatStore'
import { seedStubBattle } from '../../../src/game/scenes/seedStubBattle'
import { createRng } from '../../../src/systems/rng'
import { buildUnit } from '../../../src/systems/buildUnit'
import type { Unit } from '../../../src/domain/unit'
import { applyCommand, autoBattle, battleOutcome, cstate } from '../../../scripts/cli/combat'

function seed(s: number): void {
  const store = useCombatStore.getState()
  store.reset()
  const party = [
    buildUnit('lord', 1, 'Roy', 'roy'),
    buildUnit('knight', 1, 'Marcus', 'marcus'),
    buildUnit('mage', 1, 'Lilina', 'lilina'),
  ].filter((u): u is Unit => u !== null)
  store.dispatch(seedStubBattle({ seed: s, counter: 0 }, party), createRng({ seed: s, counter: 0 }))
}

const livingHp = (): number =>
  Object.values(cstate().units).reduce((n, u) => n + Math.max(0, u.hp.current), 0)

describe('combat scenarios (headless)', () => {
  beforeEach(() => seed(1))

  it('seeds a valid 3v3 battle', () => {
    const s = cstate()
    expect(s.phase).toBe('COMBAT')
    expect(Object.keys(s.units)).toHaveLength(6)
    expect(s.turn.unitId).not.toBeNull()
  })

  it('rejects an out-of-range play and leaves state unchanged (range validation)', () => {
    const before = JSON.stringify(cstate().units)
    // enemies start in cols 8-9, out of reach of any starting card from cols 0-2
    for (let i = 0; i < 5; i++) {
      const log = applyCommand(`play ${i} 8,4`).join(' ')
      expect(log).toMatch(/not a valid target|no card|not enough AP|no active/i)
    }
    expect(JSON.stringify(cstate().units)).toBe(before)
  })

  it('autoBattle terminates with a decisive-or-stalemate outcome (no infinite loop)', () => {
    autoBattle()
    expect(['VICTORY', 'DEFEAT', 'STALEMATE']).toContain(battleOutcome())
  })

  it('combat engages — damage is actually dealt during an autoBattle', () => {
    const startHp = Object.values(cstate().units).reduce((n, u) => n + u.hp.max, 0)
    autoBattle()
    expect(livingHp()).toBeLessThan(startHp)
  })

  it('is deterministic — same seed yields the same outcome + turn count', () => {
    seed(7); autoBattle()
    const a = battleOutcome(); const ta = cstate().turn.number
    seed(7); autoBattle()
    const b = battleOutcome(); const tb = cstate().turn.number
    expect(b).toBe(a)
    expect(tb).toBe(ta)
  })
})
