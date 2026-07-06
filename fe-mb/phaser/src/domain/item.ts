import type { ItemId } from './ids'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type Region = 'borderlands' | 'thornwood' | 'ashfall' | 'none'

/**
 * Items are consumables (food/potion) or GEAR (equipment-card system,
 * ship plan 2026-03-29 §2-8). Gear contributes cards to its wielder's combat
 * deck via `gearCardIds`; quivers contribute no cards but modify bow cards.
 *
 * - 'food': consumed by per-hop overworld travel (1 charge / hop).
 * - 'potion': single-use combat consumable (heal, +AP, etc.) — use action lands later.
 * - 'weapon' | 'shield' | 'tome' | 'staff': hand-slot gear; each contributes 3-4
 *   cards (6-8 when twoHanded).
 * - 'quiver': off-hand gear; modifies all damage cards sourced from a bow in
 *   the other hand slot.
 */
export type ItemKind = 'food' | 'potion' | 'weapon' | 'shield' | 'quiver' | 'tome' | 'staff'

/** Weapon family — drives quiver pairing (bow) and loadout UI grouping. */
export type WeaponClass =
  | 'sword' | 'lance' | 'axe' | 'bow' | 'crossbow' | 'dagger'
  | 'greatsword' | 'tome' | 'staff' | 'shield'

export type QuiverModifierKind = 'poison' | 'slow' | 'thunder' | 'explosive'

/**
 * Quiver effect applied at deck-build time to bow-sourced damage cards.
 * - poison: apply `value` poison stacks for `turns` turns
 * - slow: target loses `value` SPD for `turns` turns
 * - thunder: +`value` bonus magic damage (ignores armor); `turns` unused (0)
 * - explosive: `value` damage to all enemies adjacent to the target; `turns` unused (0)
 */
export interface QuiverModifier {
  kind: QuiverModifierKind
  value: number
  turns: number
}

export interface Item {
  id: ItemId
  name: string
  kind: ItemKind
  rarity: Rarity
  region: Region
  gridSize: { width: number; height: number }
  buyPrice: number
  sellPrice: number
  /** Weapon family; present on gear kinds. */
  weaponClass?: WeaponClass
  /** True for two-handed weapons: occupies handLeft and locks handRight. */
  twoHanded?: boolean
  /** Cards this gear contributes to its wielder's deck (card registry ids). */
  gearCardIds?: string[]
  /** Quivers only: the modifier applied to bow-sourced damage cards. */
  quiverModifier?: QuiverModifier
}

/** Item kinds that occupy a hand slot. */
export const HAND_SLOT_KINDS: ReadonlySet<ItemKind> = new Set([
  'weapon', 'shield', 'quiver', 'tome', 'staff',
])

export function isHandSlotItem(item: Pick<Item, 'kind'>): boolean {
  return HAND_SLOT_KINDS.has(item.kind)
}
