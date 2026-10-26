/**
 * DECISIONS "one enemy action + free move"; CONTRACT §7 (WP-AI-SIM owes `ai.budget.test.ts`).
 * One `it` per `knobs.enemyActionBudget` value, the free move proved independent of the action, the
 * `enemyActionApCost: 0` guard, and the AoE centring rule the budget pays for (§2.5 `aoeRadius`).
 */
import { describe, expect, it } from 'vitest'
import { reduceCombat } from '../../../../src/engine/combat/reducer'
import { planEnemyStep } from '../../../../src/engine/combat/ai'
import { withRules } from '../../../../src/engine/content'
import type { Effect } from '../../../../src/engine/effects'
import type { CombatState, EngineEnv, UnitId } from '../../../../src/engine/types'
import { activate, authored, dispatch, env, mc, patchUnit, placeAt, seed, unit, unitFromClass, withKnobs } from '../../../helpers/battles'

const e = env()

/** Pump `combat/enemyStep` until `id`'s turn is over; a refusal is a planner/reducer disagreement, never a flow. */
function enemyTurn(state: CombatState, id: UnitId, ev: EngineEnv = e): { readonly state: CombatState; readonly effects: readonly Effect[] } {
  let st = activate(state, id, ev)
  const effects: Effect[] = []
  for (let guard = 0; guard < 32; guard++) {
    if (st.phase !== 'combat' || st.turn.unitId !== id) break
    const r = reduceCombat(st, { type: 'combat/enemyStep' }, ev)
    expect(r.effects.filter((x) => x.kind === 'refused')).toEqual([])
    effects.push(...r.effects)
    st = r.state
  }
  return { state: st, effects }
}

describe('combat/ai — the action budget', () => {
  it('enemyActionBudget 1: exactly one action per turn, whatever AP is left', () => {
    const st = seed({ party: [mc({ hp: 200 })], enemies: { kind: 'authored', units: [authored('b', 'bandit', 3, 4)] }, seed: 3 })
    const turn = enemyTurn(st, 'b')
    expect(turn.effects.filter((x) => x.kind === 'enemyActed')).toHaveLength(1)
    expect(unit(turn.state, 'b').actionsTaken).toBe(1)
    // the shipped knob prices nothing in AP: the enemy leaves its turn with a full bar
    expect(unit(turn.state, 'b').ap).toBe(e.rules.combat.apPerTurn)
  })

  it("enemyActionBudget 'ap': floor(apPerTurn / enemyActionApCost) actions, each one deducted and reported", () => {
    const ap = withKnobs(e, { enemyActionBudget: 'ap' })
    const expected = Math.floor(ap.rules.combat.apPerTurn / ap.rules.combat.enemyActionApCost)
    const st = seed({ party: [mc({ hp: 200 })], enemies: { kind: 'authored', units: [authored('b', 'bandit', 3, 4)] }, seed: 3 }, ap)
    const turn = enemyTurn(st, 'b', ap)
    expect(turn.effects.filter((x) => x.kind === 'enemyActed')).toHaveLength(expected)
    expect(unit(turn.state, 'b').actionsTaken).toBe(expected)
    expect(unit(turn.state, 'b').ap).toBe(ap.rules.combat.apPerTurn - expected * ap.rules.combat.enemyActionApCost)
    const deductions = turn.effects.filter((x) => x.kind === 'apChanged' && x.unitId === 'b')
    expect(deductions).toHaveLength(expected)
  })

  it('a 0-AP action cost cannot pump the turn forever — the AP branch still caps the turn', () => {
    const free = withRules(withKnobs(e, { enemyActionBudget: 'ap' }), { combat: { ...e.rules.combat, enemyActionApCost: 0 } })
    const st = seed({ party: [mc({ hp: 9999 })], enemies: { kind: 'authored', units: [authored('b', 'bandit', 3, 4)] }, seed: 3 }, free)
    const turn = enemyTurn(st, 'b', free)
    // the turn ENDED (the pump loop would otherwise run out its guard with 'b' still active)
    expect(turn.state.turn.unitId).not.toBe('b')
    expect(unit(turn.state, 'b').actionsTaken).toBe(free.rules.combat.apPerTurn)
  })

  it('the free move is not paid for with the action: an enemy that walks in still swings', () => {
    const st = seed({ party: [mc({ hp: 200 })], enemies: { kind: 'authored', units: [authored('b', 'bandit', 5, 4)] }, seed: 3 })
    const before = unit(st, 'mc').hp.current
    const turn = enemyTurn(st, 'b')
    expect(turn.effects.some((x) => x.kind === 'unitMoved' && x.unitId === 'b')).toBe(true)
    expect(unit(turn.state, 'b').hasMovedThisTurn).toBe(true)
    expect(unit(turn.state, 'b').actionsTaken).toBe(1)
    expect(unit(turn.state, 'mc').hp.current).toBeLessThan(before)
  })
})

describe('combat/ai — AoE centring', () => {
  /** A warlord wedged between a three-unit cluster (west) and one straggler (east). */
  function sweepBoard(): CombatState {
    let st = seed({
      // `lone` is the FRAILEST unit but out of the sweep's reach — and deliberately above one sweep's damage, so
      // the AoE cannot score a kill on it and the two picks have to disagree on placement, which is the point.
      party: [mc(), unitFromClass('b', 'mage', 'party'), unitFromClass('c', 'mage', 'party'), unitFromClass('lone', 'mage', 'party', { hp: 12 })],
      enemies: { kind: 'authored', units: [authored('w', 'warlord', 5, 4, { stats: { str: 0 } })] },
      seed: 21,
    })
    st = placeAt(st, 'mc', 4, 4)
    st = placeAt(st, 'b', 4, 3)
    st = placeAt(st, 'c', 4, 5)
    st = placeAt(st, 'lone', 6, 4)
    // isolate the action pick: the free move is already spent
    return patchUnit(activate(st, 'w'), 'w', { hasMovedThisTurn: true })
  }

  function partyHp(state: CombatState): number {
    return ['mc', 'b', 'c', 'lone'].reduce((sum, id) => sum + unit(state, id).hp.current, 0)
  }

  it('an AoE action is centred where it hits the most foes, while the single-target blow still takes the frailest', () => {
    const st = sweepBoard()
    const centres: Record<string, Set<string>> = {}
    for (let s = 1; s <= 40; s++) {
      const plan = planEnemyStep({ ...st, rng: { seed: s, counter: 0 } }, e)
      if (plan.step.kind === 'act') (centres[plan.step.actionId] ??= new Set()).add(plan.step.tile)
    }
    // the two picks disagree, which is the whole point: the sweep is placed by RECIPIENTS, not by who stands there
    expect([...(centres['warcry_sweep'] ?? [])]).toEqual(['4,4'])
    expect([...(centres['crush'] ?? [])]).toEqual(['6,4'])
  })

  it('the centre the planner picks is the one that actually costs the party more HP', () => {
    const st = sweepBoard()
    const before = partyHp(st)
    const cluster = dispatch(st, { type: 'combat/enemyAct', unitId: 'w', actionId: 'warcry_sweep', tile: '4,4' })
    const straggler = dispatch(st, { type: 'combat/enemyAct', unitId: 'w', actionId: 'warcry_sweep', tile: '6,4' })
    expect(before - partyHp(cluster.state)).toBeGreaterThan(before - partyHp(straggler.state))
  })
})
