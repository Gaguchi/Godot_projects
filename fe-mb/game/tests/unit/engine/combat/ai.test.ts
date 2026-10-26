/**
 * Brief §2.5 / §7.4 / §7.21: role targeting, distance-field stepping (never axis-greedy), one action per turn,
 * statuses on enemy actions, taunt precedence, cover-aware expected damage.
 */
import { describe, expect, it } from 'vitest'
import { eligibleActions, expectedDamage, pickTarget, planEnemyStep, planEnemyTurn } from '../../../../src/engine/combat/ai'
import { withRules } from '../../../../src/engine/content'
import { forecast } from '../../../../src/engine/combat/damage'
import { distanceField, manhattan, occupiedTiles } from '../../../../src/engine/combat/grid'
import { hasStatus, mergeStatus } from '../../../../src/engine/combat/statuses'
import type { CombatState, EnemyAIProfile } from '../../../../src/engine/types'
import { activate, at, authored, env, mc, oak, patchUnit, placeAt, seed, unit, unitFromClass } from '../../../helpers/battles'

const e = env()
const profile = (classId: string) => e.content.enemyAI[classId]!

function enemyTurn(state: CombatState, id: string): ReturnType<typeof planEnemyTurn> {
  return planEnemyTurn(activate(state, id), e)
}

describe('combat/ai — rusher', () => {
  it('walks toward the weakest reachable party unit and stops after one action', () => {
    // 5 tiles out: within move + reach for the seeder's turn-1 rule, but not adjacent
    const st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 7, 4)] }, seed: 3 })
    const before = manhattan(unit(st, 'b').position!, unit(st, 'mc').position!)
    const turn = enemyTurn(st, 'b')
    const after = manhattan(unit(turn.state, 'b').position ?? '0,0', unit(turn.state, 'mc').position!)
    expect(after).toBeLessThan(before)
    expect(turn.actions.length).toBeGreaterThan(0)
    expect(turn.state.units['b']!.actionsTaken).toBeLessThanOrEqual(1)
  })

  it('attacks once when adjacent, then ends its turn (enemyActionBudget 1)', () => {
    const st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 3, 4)] }, seed: 3 })
    const turn = enemyTurn(st, 'b')
    const acted = turn.actions.length
    expect(acted).toBeGreaterThan(0)
    expect(unit(turn.state, 'mc').hp.current).toBeLessThan(unit(st, 'mc').hp.current)
    // the turn moved on to the party after exactly one action
    expect(unit(turn.state, turn.state.turn.unitId).team).toBe('party')
  })

  it('reaches around a wall that blocks the direct approach (§7.4: distance field, banned revisits)', () => {
    const st = seed({
      party: [mc()],
      enemies: { kind: 'authored', units: [authored('b', 'bandit', 5, 4)] },
      grid: { obstacles: [at(3, 3), at(3, 4), at(3, 5), at(4, 5), at(4, 3)] },
      seed: 3,
    })
    const b = unit(activate(st, 'b'), 'b')
    const plan = planEnemyStep(activate(st, 'b'), e)
    expect(plan.step.kind).toBe('move')
    if (plan.step.kind !== 'move') return
    const seat = pickTarget(st, b, profile('bandit'), e).desiredTile!
    const field = distanceField(st.grid, seat, occupiedTiles(st.units, 'b'), b.position!)
    expect(field[plan.step.to]!).toBeLessThan(field[b.position!]!)
  })
})

describe('combat/ai — archer, healer, taunt, statuses', () => {
  it('an archer settles at its preferred range and shoots from there', () => {
    const st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('a', 'bandit_archer', 8, 4)] }, seed: 5 })
    const turn = enemyTurn(st, 'a')
    const d = manhattan(unit(turn.state, 'a').position!, unit(turn.state, 'mc').position!)
    const pref = profile('bandit_archer').preferredRange!
    expect(d).toBeGreaterThanOrEqual(pref.min)
    expect(d).toBeLessThanOrEqual(pref.max)
    expect(unit(turn.state, 'mc').hp.current).toBeLessThan(unit(st, 'mc').hp.current)
  })

  it('a healer mends the ally with the lowest HP fraction', () => {
    const healer = Object.values(e.content.enemyAI).find((p) => p.role === 'healer')!
    let st = seed({
      party: [mc()],
      enemies: { kind: 'authored', units: [authored('h', healer.classId, 6, 4), authored('w1', 'bandit', 6, 5), authored('w2', 'bandit', 5, 4)] },
      seed: 5,
    })
    st = patchUnit(st, 'w1', { hp: { current: 4, max: 18 } })
    st = patchUnit(st, 'w2', { hp: { current: 12, max: 18 } })
    const turn = enemyTurn(st, 'h')
    expect(unit(turn.state, 'w1').hp.current).toBeGreaterThan(4)
    expect(unit(turn.state, 'w2').hp.current).toBe(12)
  })

  it('a taunting unit is targeted over a weaker one', () => {
    let st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 4, 4)] }, seed: 7 })
    st = patchUnit(st, 'mc', { hp: { current: 3, max: 26 } })
    st = patchUnit(st, 'oak', { statuses: mergeStatus([], { id: 'taunt', stacks: 1, turns: 2, expiresAt: 'ownerTurnStart', sourceId: 'oak' }, e) })
    expect(pickTarget(st, unit(st, 'b'), profile('bandit'), e).primary).toBe('oak')
  })

  it('an enemy action can apply a status (thief poison)', () => {
    const st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('t', 'thief', 3, 4)] }, seed: 9 })
    const actions = eligibleActions(activate(st, 't'), 't', e)
    expect(actions.some((a) => a.applyStatus?.effectId === 'poison')).toBe(true)
    let poisoned = false
    for (let s = 1; s <= 6 && !poisoned; s++) {
      const turn = enemyTurn({ ...st, rng: { seed: s, counter: 0 } }, 't')
      poisoned = hasStatus(unit(turn.state, 'mc'), 'poison')
    }
    expect(poisoned).toBe(true)
  })

  it('expected damage is cover-aware: a blow at the MC beside Oak is scored on Oak', () => {
    const st = seed({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 3, 4)] }, seed: 11 })
    const strike = profile('bandit').actions.find((a) => a.kind === 'attack')!
    const f = forecast(st, 'b', { card: { apCost: 0, range: strike.range, targetKind: 'enemy', aoeRadius: 0, damageStat: strike.damageStat ?? 'str', effects: [{ kind: 'Damage', target: 'target', base: strike.amount, damageType: 'physical' }] }, mod: null }, 'mc', e)
    expect(f?.redirectedTo).toBe('oak')
    expect(expectedDamage(st, 'b', strike, 'mc', e)).toBe(f?.hpLost)
  })
})

describe('combat/ai — the free move never costs the turn its blow', () => {
  it('an enemy already in reach swings instead of walking off toward a juicier target', () => {
    let st = seed({
      party: [unitFromClass('tanky', 'shield_knight', 'party', { handLeft: 'iron_lance', hp: 32 }), unitFromClass('squishy', 'mage', 'party', { hp: 4 })],
      enemies: { kind: 'authored', units: [authored('b', 'bandit', 5, 4)] },
      seed: 4,
    })
    st = placeAt(st, 'tanky', 4, 4)
    st = placeAt(st, 'squishy', 11, 9)
    const active = activate(st, 'b')
    // the role WANTS the 4-HP mage — it is worth `hp × 100 + distance` less than the knight
    expect(pickTarget(active, unit(active, 'b'), profile('bandit'), e).primary).toBe('squishy')
    const plan = planEnemyStep(active, e)
    expect(plan.step.kind).toBe('act')
    if (plan.step.kind !== 'act') return
    expect(plan.step.tile).toBe(at(4, 4))
    const turn = planEnemyTurn(active, e)
    expect(unit(turn.state, 'tanky').hp.current).toBeLessThan(32)
  })

  it('a plugged corridor closes on the blocker instead of freezing in place (§7.4)', () => {
    // a full wall at x = 4 with one gap at y = 4, and the gap is plugged by a knight
    const wall = [0, 1, 2, 3, 5, 6, 7, 8, 9].map((y) => at(4, y))
    let st = seed({
      party: [unitFromClass('blocker', 'shield_knight', 'party', { handLeft: 'iron_lance', hp: 32 }), unitFromClass('bait', 'mage', 'party', { hp: 8 })],
      enemies: { kind: 'authored', units: [authored('b', 'bandit', 6, 4)] },
      grid: { obstacles: wall },
      seed: 4,
    })
    st = placeAt(st, 'blocker', 4, 4)
    st = placeAt(st, 'bait', 2, 4)
    const active = activate(st, 'b')
    // the seat it wants is behind the plug: every flood from it dies at the wall
    expect(pickTarget(active, unit(active, 'b'), profile('bandit'), e).desiredTile).toBe(at(3, 4))
    const turn = planEnemyTurn(active, e)
    expect(unit(turn.state, 'b').position).toBe(at(5, 4))
    expect(manhattan(unit(turn.state, 'b').position!, at(4, 4))).toBe(1)
    expect(unit(turn.state, 'blocker').hp.current).toBeLessThan(32)
  })
})

describe('combat/ai — a healer never spends its turn on nothing', () => {
  function clericBoard(): CombatState {
    const healer = Object.values(e.content.enemyAI).find((p) => p.role === 'healer')!
    let st = seed({
      party: [mc()],
      enemies: { kind: 'authored', units: [authored('h', healer.classId, 6, 4), authored('f', 'bandit', 7, 4), authored('w', 'bandit', 13, 9)] },
      seed: 5,
    })
    st = placeAt(st, 'mc', 5, 4)
    st = patchUnit(st, 'w', { hp: { current: 3, max: 18 } })
    return activate(st, 'h')
  }

  it('`ally_wounded` reads the allies the heal can REACH, not the whole board', () => {
    const st = clericBoard()
    expect(unit(st, 'w').hp.current).toBeLessThan(unit(st, 'w').hp.max)
    expect(eligibleActions(st, 'h', e).map((a) => a.id)).not.toContain('mend')
  })

  it('pinned beside a full-HP friend it smites — every seed, never a 0-HP mend', () => {
    let st = clericBoard()
    st = patchUnit(st, 'h', { statuses: mergeStatus([], { id: 'immobilize', stacks: 1, turns: 2, expiresAt: 'ownerTurnEnd', sourceId: 'h' }, e) })
    for (let s = 1; s <= 20; s++) {
      const turn = planEnemyTurn({ ...st, rng: { seed: s, counter: 0 } }, e)
      expect(unit(turn.state, 'f').hp.current).toBe(unit(st, 'f').hp.current)
      expect(unit(turn.state, 'w').hp.current).toBe(3)
      expect(unit(turn.state, 'mc').hp.current).toBeLessThan(unit(st, 'mc').hp.current)
    }
  })
})

describe('combat/ai — the rules knobs are live', () => {
  it('`rules.combat.aiLowHpFraction` decides which situations fire', () => {
    const st = activate(seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 3, 4)] }, seed: 3 }), 'b')
    expect(eligibleActions(st, 'b', e).map((a) => a.id)).toEqual(['swing'])
    const twitchy = withRules(e, { combat: { ...e.rules.combat, aiLowHpFraction: 1.01 } })
    expect(eligibleActions(st, 'b', twitchy).map((a) => a.id)).toEqual(['swing', 'wild_lunge', 'kick'])
  })

  it('`rules.combat.aiDefaultPreferredRange.archer` is the band a profile without one holds', () => {
    const st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('a', 'bandit_archer', 8, 4)] }, seed: 5 })
    const bare: EnemyAIProfile = { classId: 'bandit_archer', role: 'archer', movement: 4, actions: profile('bandit_archer').actions }
    const self = unit(activate(st, 'a'), 'a')
    const [min, max] = e.rules.combat.aiDefaultPreferredRange.archer
    const seat = pickTarget(activate(st, 'a'), self, bare, e).desiredTile!
    const d = manhattan(seat, unit(st, 'mc').position!)
    expect(d).toBeGreaterThanOrEqual(min)
    expect(d).toBeLessThanOrEqual(max)
    const far = withRules(e, { combat: { ...e.rules.combat, aiDefaultPreferredRange: { ...e.rules.combat.aiDefaultPreferredRange, archer: [4, 5] } } })
    const farSeat = pickTarget(activate(st, 'a'), self, bare, far).desiredTile!
    expect(manhattan(farSeat, unit(st, 'mc').position!)).toBeGreaterThanOrEqual(4)
  })
})
