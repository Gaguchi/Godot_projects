import type { UnitId, ClassId, ItemId } from '../domain/ids'
import type { Unit } from '../domain/unit'
import type { DomainEvent } from './domainEvents'

export interface BattleResult {
  outcome: 'victory' | 'defeat' | 'fled'
  battleId: string
  survivors: UnitId[]
  fallen: UnitId[]
  xpAwards: Record<string, number>     // keyed by UnitId-as-string
  capturedEnemies: { id: UnitId; classId: ClassId; level: number }[]
  goldEarned: number
  /** Gear dropped on victory (ship plan §11) — rolled via deriveRng('loot:BATTLE'). */
  loot: ItemId[]
  consumedTravelHop: number | null
  emittedEvents: DomainEvent[]
}

export interface RecruitmentResult {
  unit: Unit
  goldCost: number
  source: 'tavern' | 'event' | 'quest'
  emittedEvents: DomainEvent[]
}
