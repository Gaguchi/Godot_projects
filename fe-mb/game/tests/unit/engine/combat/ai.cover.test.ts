/**
 * Brief §2.16 / §2.2 (Genatsvale) and §10 "the enemy AI's expected-damage pick … reflects the redirect".
 * CONTRACT §7 (WP-AI-SIM owes `ai.cover.test.ts`): the redirect must change WHICH TILE the planner picks, not
 * merely the number it reads off a forecast.
 */
import { describe, expect, it } from 'vitest'
import { expectedDamage, planEnemyStep } from '../../../../src/engine/combat/ai'
import { startTurn } from '../../../../src/engine/combat/turn'
import { withUnit } from '../../../../src/engine/combat/state'
import type { CombatState } from '../../../../src/engine/types'
import { activate, authored, env, mc, oak, patchUnit, placeAt, seed, unit, unitFromClass } from '../../../helpers/battles'

const e = env()
const strike = e.content.enemyAI['bandit']!.actions.find((a) => a.id === 'swing')!

/** A bandit wedged between a nearly-dead MC (screened by Oak) and an unscreened mage. */
function board(): CombatState {
  let st = seed({
    party: [mc(), oak(), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })],
    enemies: { kind: 'authored', units: [authored('b', 'bandit', 5, 4)] },
    seed: 13,
  })
  st = placeAt(st, 'mc', 4, 4)
  st = placeAt(st, 'oak', 4, 3)
  st = placeAt(st, 'lilina', 6, 4)
  st = patchUnit(st, 'mc', { hp: { current: 3, max: 26 } })
  return patchUnit(activate(st, 'b'), 'b', { hasMovedThisTurn: true })
}

describe('combat/ai — cover changes the pick', () => {
  it("Oak's screen makes the killing blow worthless, so the planner turns on the unscreened mage", () => {
    const st = board()
    // aimed at the MC the blow lands on Oak (and does not kill him); aimed at Lilina it lands on Lilina
    expect(expectedDamage(st, 'b', strike, 'mc', e)).toBeLessThan(unit(st, 'oak').hp.current)
    expect(expectedDamage(st, 'b', strike, 'mc', e)).toBeLessThan(expectedDamage(st, 'b', strike, 'lilina', e))
    const plan = planEnemyStep(st, e)
    expect(plan.step.kind).toBe('act')
    if (plan.step.kind !== 'act') return
    expect(plan.step.tile).toBe('6,4')
  })

  it('with the screen already spent on the MC the blow goes through, and the kill wins the pick', () => {
    const spent = patchUnit(board(), 'oak', { coverUsed: ['mc'] })
    expect(expectedDamage(spent, 'b', strike, 'mc', e)).toBeGreaterThanOrEqual(unit(spent, 'mc').hp.current)
    const plan = planEnemyStep(spent, e)
    expect(plan.step.kind).toBe('act')
    if (plan.step.kind !== 'act') return
    expect(plan.step.tile).toBe('4,4')
  })

  it("Oak's turn start clears `coverUsed`, and the planner goes back to the mage", () => {
    const spent = patchUnit(board(), 'oak', { coverUsed: ['mc'] })
    const started = startTurn(spent, 'oak', e).state
    expect(unit(started, 'oak').coverUsed).toEqual([])
    // hand the turn back to the bandit without touching the freshly cleared ledger
    const back: CombatState = withUnit({ ...started, turn: { ...started.turn, unitId: 'b' } }, { ...unit(started, 'b'), hasMovedThisTurn: true })
    const plan = planEnemyStep(back, e)
    expect(plan.step.kind).toBe('act')
    if (plan.step.kind !== 'act') return
    expect(plan.step.tile).toBe('6,4')
  })
})
