import type { UnitId, ItemId, ClassId, TileId, StatusEffectId } from './ids'

export interface UnitStats {
  str: number; mag: number; skl: number
  spd: number; def: number; res: number
}

export interface UnitHp { current: number; max: number }

export interface ActiveStatus {
  effectId: StatusEffectId
  stacks: number
  turnsRemaining: number
  source: UnitId | null
}

export interface HandSlots {
  left: ItemId | null
  right: ItemId | null
}

export interface Unit {
  id: UnitId
  name: string
  classId: ClassId
  level: number
  hp: UnitHp
  stats: UnitStats
  hand: HandSlots
  position: TileId | null
  ap: number
  armor: number
  statuses: ActiveStatus[]
}
