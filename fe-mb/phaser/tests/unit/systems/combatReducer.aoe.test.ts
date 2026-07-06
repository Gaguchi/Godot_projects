import { describe, it, expect } from 'vitest'
import { reduce, initialCombatState } from '../../../src/systems/combatReducer'
import { asUnitId, asClassId, asCardId, asTileId, asStatusEffectId } from '../../../src/domain/ids'
import { createRng } from '../../../src/systems/rng'
import type { Unit } from '../../../src/domain/unit'
import type { CombatState } from '../../../src/domain/combatState'

const rng = () => createRng({ seed: 0, counter: 0 })

const mk = (id: string, pos: string, classId = 'lord', over: Partial<Unit> = {}): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId(classId), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 0, res: 0, lck: 0 },
  position: asTileId(pos), ap: 3, armor: 0, statuses: [],
  ...over,
})

function boot(units: Unit[]): CombatState {
  return reduce(initialCombatState(), {
    type: 'startBattle',
    payload: { units, grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 7, counter: 0 } },
  }, rng()).state
}

const play = (s: CombatState, card: Record<string, unknown>, target: string) =>
  reduce(s, {
    type: 'playCard',
    payload: {
      cardId: asCardId('test_card'), srcId: asUnitId('roy'), targets: [asTileId(target)],
      card: { apCost: 1, damageStat: 'str', ...card } as never,
    },
  }, rng())

describe('playCard: aoeRadius runtime expansion', () => {
  it('damages all FOES within the radius of the target tile, not allies', () => {
    const s = boot([
      mk('roy', '2,4'),
      mk('ally', '5,6'),                       // inside radius but friendly
      mk('b1', '5,5', 'bandit'),               // primary target
      mk('b2', '6,5', 'bandit'),               // adjacent foe
      mk('b3', '9,9', 'bandit'),               // out of range
    ])
    const r = play(s, { effects: [{ kind: 'Damage', params: { base: 5 } }], aoeRadius: 1, targetKind: 'enemy' }, '5,5')
    expect(r.state.units['b1']!.hp.current).toBe(10)  // 5+5 str
    expect(r.state.units['b2']!.hp.current).toBe(10)
    expect(r.state.units['b3']!.hp.current).toBe(20)
    expect(r.state.units['ally']!.hp.current).toBe(20)
  })

  it('radius 0 keeps single-target behavior', () => {
    const s = boot([mk('roy', '2,4'), mk('b1', '5,5', 'bandit'), mk('b2', '6,5', 'bandit')])
    const r = play(s, { effects: [{ kind: 'Damage', params: { base: 5 } }], targetKind: 'enemy' }, '5,5')
    expect(r.state.units['b1']!.hp.current).toBe(10)
    expect(r.state.units['b2']!.hp.current).toBe(20)
  })

  it('AOE ApplyStatus lands on all foes in radius', () => {
    const s = boot([mk('roy', '2,4'), mk('b1', '5,5', 'bandit'), mk('b2', '5,6', 'bandit')])
    const r = play(s, {
      effects: [{ kind: 'ApplyStatus', params: { effectId: 'burn', value: 2, turns: 2 } }],
      aoeRadius: 1, targetKind: 'enemy',
    }, '5,5')
    expect(r.state.units['b1']!.statuses).toHaveLength(1)
    expect(r.state.units['b2']!.statuses).toHaveLength(1)
  })
})

describe('playCard: beneficial riders route to the source on enemy-target cards', () => {
  it('Brace-family GrantArmor armors the SOURCE, not the enemy', () => {
    const s = boot([mk('roy', '2,4'), mk('bandit', '3,4', 'bandit')])
    const r = play(s, {
      effects: [
        { kind: 'Damage', params: { base: 4 } },
        { kind: 'GrantArmor', params: { amount: 2 } },
      ],
      targetKind: 'enemy',
    }, '3,4')
    expect(r.state.units['roy']!.armor).toBe(2)
    expect(r.state.units['bandit']!.armor).toBe(0)
  })

  it('ally-target GrantArmor still armors the ally', () => {
    const s = boot([mk('roy', '2,4'), mk('ally', '3,4'), mk('bandit', '9,9', 'bandit')])
    const r = play(s, {
      effects: [{ kind: 'GrantArmor', params: { amount: 3 } }],
      targetKind: 'ally',
    }, '3,4')
    expect(r.state.units['ally']!.armor).toBe(3)
    expect(r.state.units['roy']!.armor).toBe(0)
  })

  it('Heal on an enemy-target card heals the source (lifesteal approximation)', () => {
    const s = boot([mk('roy', '2,4', 'lord', { hp: { current: 10, max: 20 } }), mk('bandit', '3,4', 'bandit')])
    const r = play(s, {
      effects: [
        { kind: 'Damage', params: { base: 4 } },
        { kind: 'Heal', params: { amount: 3 } },
      ],
      targetKind: 'enemy',
    }, '3,4')
    expect(r.state.units['roy']!.hp.current).toBe(13)
    expect(r.state.units['bandit']!.hp.current).toBeLessThan(20)
  })
})

describe('playCard: RemoveStatus resolution', () => {
  it('armor shred reduces target armor', () => {
    const s = boot([mk('roy', '2,4'), mk('bandit', '3,4', 'bandit', { armor: 5 })])
    const r = play(s, {
      effects: [{ kind: 'RemoveStatus', params: { kind: 'armor', amount: 3 } }],
      targetKind: 'enemy',
    }, '3,4')
    expect(r.state.units['bandit']!.armor).toBe(2)
  })

  it('debuff cleanse strips harmful statuses from the ally target', () => {
    const debuffed = mk('ally', '3,4', 'lord', {
      statuses: [
        { effectId: asStatusEffectId('poison'), stacks: 2, turnsRemaining: 2, source: null },
        { effectId: asStatusEffectId('slow'), stacks: 1, turnsRemaining: 1, source: null },
        { effectId: asStatusEffectId('empower'), stacks: 4, turnsRemaining: 1, source: null },
      ],
    })
    const s = boot([mk('roy', '2,4'), debuffed, mk('bandit', '9,9', 'bandit')])
    const r = play(s, {
      effects: [{ kind: 'RemoveStatus', params: { kind: 'debuff', all: true } }],
      targetKind: 'ally',
    }, '3,4')
    const remaining = r.state.units['ally']!.statuses.map(x => x.effectId as unknown as string)
    expect(remaining).toEqual(['empower']) // buffs survive the cleanse
  })
})
