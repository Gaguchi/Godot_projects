import type { Unit } from '../domain/unit'
import type { UnitId } from '../domain/ids'
import { statusSpdDelta } from './statusEffects'
import { isEnemyUnit } from './team'

export interface InitiativeModifier {
  unitId: UnitId
  spdDelta: number
}


/**
 * Build the per-round initiative queue. Order rules (top → bottom):
 *   1. Higher SPD acts first.
 *   2. On SPD tie, party units beat enemy units (FE GBA-era convention).
 *   3. On further tie, alphabetic by unit id (deterministic).
 *
 * `modifiers` adds situational SPD deltas on top of the automatic
 * status-derived deltas (Slow subtracts its stacks while active).
 */
export function buildInitiativeQueue(
  units: Unit[],
  modifiers: InitiativeModifier[] = [],
): UnitId[] {
  const modBySpd = new Map<string, number>(
    modifiers.map((m) => [m.unitId as unknown as string, m.spdDelta]),
  )
  const enriched = units.map((u) => ({
    id: u.id,
    spd: u.stats.spd + statusSpdDelta(u) + (modBySpd.get(u.id as unknown as string) ?? 0),
    isEnemy: isEnemyUnit(u),
    tieBreaker: u.id as unknown as string,
  }))
  enriched.sort((a, b) => {
    if (b.spd !== a.spd) return b.spd - a.spd
    if (a.isEnemy !== b.isEnemy) return a.isEnemy ? 1 : -1   // party first
    return a.tieBreaker.localeCompare(b.tieBreaker)
  })
  return enriched.map((e) => e.id)
}
