import { describe, it, expect } from 'vitest'
import { reduce, initialCombatState } from '../../../src/systems/combatReducer'
import { resolveBattle } from '../../../src/systems/battleResolver'
import { seedStubBattle } from '../../../src/game/scenes/seedStubBattle'
import { createRng } from '../../../src/systems/rng'
import type { CombatState } from '../../../src/domain/combatState'
import { asUnitId } from '../../../src/domain/ids'

/** Seed a stub battle and wound the target so capture chance is near 1. */
function stateWithWeakEnemy(): CombatState {
  const rng = createRng({ seed: 1, counter: 0 })
  const { state } = reduce(initialCombatState(), seedStubBattle(rng.state()), rng)
  const enemy = state.units['bandit_a']!
  return {
    ...state,
    units: {
      ...state.units,
      bandit_a: { ...enemy, hp: { ...enemy.hp, current: 1 } },
    },
  }
}

/** Find an rng seed whose first roll lands under/over the given chance. */
function seedRolling(predicate: (roll: number) => boolean): number {
  for (let seed = 1; seed < 200; seed++) {
    if (predicate(createRng({ seed, counter: 0 }).next())) return seed
  }
  throw new Error('no seed found')
}

describe('capture marks state, never the display name', () => {
  it('success sets captured=true, hp 0, name untouched', () => {
    const state = stateWithWeakEnemy()
    // 1/18 HP + 1 adjacent attacker ≈ 0.82 chance — pick a seed that rolls under.
    const seed = seedRolling((r) => r < 0.8)
    const rng = createRng({ seed, counter: 0 })
    const out = reduce(state, {
      type: 'capture',
      payload: { targetId: asUnitId('bandit_a'), attackerIds: [asUnitId('roy')] },
    }, rng)
    const u = out.state.units['bandit_a']!
    expect(u.captured).toBe(true)
    expect(u.hp.current).toBe(0)
    expect(u.name).toBe('Bandit')
  })

  it('failure leaves the unit unmarked', () => {
    const state = stateWithWeakEnemy()
    const seed = seedRolling((r) => r > 0.9)
    const rng = createRng({ seed, counter: 0 })
    const out = reduce(state, {
      type: 'capture',
      payload: { targetId: asUnitId('bandit_a'), attackerIds: [asUnitId('roy')] },
    }, rng)
    const u = out.state.units['bandit_a']!
    expect(u.captured).toBeUndefined()
    expect(u.hp.current).toBe(1)
  })
})

describe('battleResolver reports captures by unit id', () => {
  it('captured enemies flow into capturedIds/capturedEnemies and pay no kill-gold', () => {
    const state = stateWithWeakEnemy()
    const downed = {
      ...state,
      units: {
        ...state.units,
        bandit_a: { ...state.units['bandit_a']!, hp: { current: 0, max: 18 }, captured: true },
        bandit_b: { ...state.units['bandit_b']!, hp: { current: 0, max: 18 } },
        bandit_c: { ...state.units['bandit_c']!, hp: { current: 0, max: 18 } },
      },
    }
    const result = resolveBattle({
      state: downed,
      battleId: 'b1',
      partyIds: [asUnitId('roy'), asUnitId('marcus'), asUnitId('lilina')],
      enemyIds: [asUnitId('bandit_a'), asUnitId('bandit_b'), asUnitId('bandit_c')],
      consumedTravelHop: null,
    })
    expect(result.outcome).toBe('victory')
    expect(result.capturedEnemies.map((c) => c.id)).toEqual([asUnitId('bandit_a')])
    expect(result.enemiesDefeated).toBe(2) // captured ≠ defeated
    const victory = result.emittedEvents.find((e) => e.type === 'BattleVictory')
    expect(victory && 'capturedIds' in victory.payload ? victory.payload.capturedIds : []).toEqual([asUnitId('bandit_a')])
  })
})
