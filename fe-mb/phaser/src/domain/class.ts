import type { ClassId, CardId } from './ids'
import type { UnitStats } from './unit'

export interface ClassDef {
  id: ClassId
  name: string
  baseStats: UnitStats
  growthRates: UnitStats   // % per level (0–100)
  innateCardIds: CardId[]
  startingMov: number
  startingHp: number
}
