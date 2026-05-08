import type { CombatState, CombatEvent } from '../domain/combatState'
import type { RNG } from '../domain/rng'
import type { UnitId } from '../domain/ids'

export function planTurn(_state: CombatState, _rng: RNG, _enemyId: UnitId): CombatEvent[] {
  // Foundation stub: always end turn. Real movement+attack logic in next milestone.
  return [{ type: 'endTurn' as const }]
}
