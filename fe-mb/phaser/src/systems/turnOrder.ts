import type { Unit } from '../domain/unit'
import type { UnitId } from '../domain/ids'

export interface InitiativeModifier {
  unitId: UnitId
  spdDelta: number
}

export function buildInitiativeQueue(
  units: Unit[],
  modifiers: InitiativeModifier[] = [],
): UnitId[] {
  const modBySpd = new Map<string, number>(modifiers.map(m => [m.unitId as unknown as string, m.spdDelta]))
  const enriched = units.map(u => ({
    id: u.id,
    spd: u.stats.spd + (modBySpd.get(u.id as unknown as string) ?? 0),
    tieBreaker: (u.id as unknown as string),
  }))
  enriched.sort((a, b) => {
    if (b.spd !== a.spd) return b.spd - a.spd
    return a.tieBreaker.localeCompare(b.tieBreaker)
  })
  return enriched.map(e => e.id)
}
