import type { UnitId, ClassId, TileId, StatusEffectId, ItemId } from './ids'

export interface UnitStats {
  str: number; mag: number; skl: number
  spd: number; def: number; res: number
  lck: number
}

export interface UnitHp { current: number; max: number }

export interface ActiveStatus {
  effectId: StatusEffectId
  stacks: number
  turnsRemaining: number
  source: UnitId | null
}

export interface Unit {
  id: UnitId
  name: string
  classId: ClassId
  level: number
  hp: UnitHp
  stats: UnitStats
  position: TileId | null
  ap: number
  armor: number
  statuses: ActiveStatus[]
  // Set when the unit consumes its free move this turn. Reset to false when
  // the unit's next turn starts. Optional so older saves and lightweight test
  // fixtures (which omit it) round-trip safely; reducer treats undefined as
  // "has not moved".
  hasMovedThisTurn?: boolean
  // Equipment-card hand slots (ship plan §3). Owned at run level; combat unit
  // copies carry them read-only. undefined ≡ null ≡ empty slot. A two-handed
  // item sits in handLeft and locks handRight (must stay empty).
  handLeft?: ItemId | null
  handRight?: ItemId | null
}
