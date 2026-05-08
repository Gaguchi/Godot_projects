import type { ItemId, CardId } from './ids'
import type { WeaponType } from './card'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type Region = 'borderlands' | 'thornwood' | 'ashfall' | 'none'

export type ItemKind =
  | 'weapon_1h' | 'weapon_2h'
  | 'shield' | 'tome' | 'staff' | 'quiver'
  | 'consumable'

export type QuiverEffectKind = 'poison' | 'burn' | 'slow' | 'thunder' | 'explosive'

export interface QuiverModifier {
  kind: QuiverEffectKind
  value: number
  turns?: number
}

export interface Item {
  id: ItemId
  name: string
  kind: ItemKind
  weaponType?: WeaponType
  rarity: Rarity
  region: Region
  gearCards: CardId[]
  quiverModifier?: QuiverModifier
  isTwoHanded: boolean
  gridSize: { width: number; height: number }
  range?: { min: number; max: number }
  buyPrice: number
  sellPrice: number
}
