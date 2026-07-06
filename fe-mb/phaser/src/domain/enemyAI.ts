import type { ClassId } from './ids'

export type EnemyRole = 'rusher' | 'archer' | 'healer' | 'tank'

/**
 * One discrete action an enemy can take per turn. Sourced from
 * `data/content/enemyActions/<classId>.json`.
 */
export interface EnemyAction {
  id: string
  kind: 'attack' | 'heal'
  range: { min: number; max: number }
  /** For attacks: base damage; for heals: amount restored. */
  amount: number
  damageStat: 'str' | 'mag' | 'skl' | null
  weight: number
  /** Only consider this action if the situation matches. */
  situation?: 'always' | 'self_low_hp' | 'ally_wounded' | 'target_low_hp'
  /** Attack splashes to tiles within this radius of the target (boss sweeps). */
  aoeRadius?: number
}

export interface EnemyClassAI {
  classId: ClassId
  role: EnemyRole
  actions: EnemyAction[]
  /** Movement allowance per turn (Manhattan tiles). */
  movement: number
  /** Preferred range to maintain from primary target (used by archer/healer). */
  preferredRange?: { min: number; max: number }
}
