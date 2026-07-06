import type { CardId, UnitId, StatusEffectId, TileId } from './ids'

export type WeaponType = 'sword'|'lance'|'axe'|'bow'|'crossbow'|'tome'|'staff'|'greatsword'|'dagger'|'shield'

export type DamageKind = 'physical' | 'magic'

export type CardEffect =
  | { kind: 'Damage'; targetId: UnitId; amount: number; damageType: DamageKind; source: CardId; armorPiercing?: boolean }
  | { kind: 'Heal'; targetId: UnitId; amount: number; source: CardId }
  | { kind: 'ApplyStatus'; targetId: UnitId; effect: StatusEffectId; stacks: number; turns: number }
  | { kind: 'RemoveStatus'; targetId: UnitId; effect: StatusEffectId }
  | { kind: 'Move'; unitId: UnitId; tileId: TileId }
  | { kind: 'GrantArmor'; targetId: UnitId; amount: number }
  | { kind: 'DrawCards'; unitId: UnitId; count: number }
  | { kind: 'GainAp'; unitId: UnitId; amount: number }

export type CardSource = 'innate' | 'hand_left' | 'hand_right'

export type CardTargetKind = 'enemy' | 'ally' | 'self' | 'tile' | 'all_enemies' | 'all_allies'

export interface CardEffectTemplate {
  kind: CardEffect['kind']
  // Card definitions store template parameters (e.g., damage amount, status duration);
  // resolution at play time fills in concrete IDs.
  params: Record<string, unknown>
}

export interface Card {
  id: CardId
  name: string
  apCost: number
  source: CardSource           // populated at deck-build time, not in JSON
  effects: CardEffectTemplate[]
  range: { min: number; max: number }
  targetKind: CardTargetKind
  aoeRadius?: number
  weaponType: WeaponType | null  // null = innate (any weapon)
  damageStat?: 'str' | 'mag' | 'skl'
}
