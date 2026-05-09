import { reduce } from '../systems/combatReducer'
import { createRng } from '../systems/rng'
import type { CombatState, CombatEvent, CombatEffect } from '../domain/combatState'

export interface ReproduceResult {
  before: CombatState
  after: CombatState
  effects: CombatEffect[]
}

export function reproduceCombatAction(state: CombatState, event: CombatEvent): ReproduceResult {
  const rng = createRng(state.rng)
  const r = reduce(state, event, rng)
  return { before: state, after: r.state, effects: r.effects }
}
