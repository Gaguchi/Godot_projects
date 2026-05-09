import type { ItemId } from './ids'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type Region = 'borderlands' | 'thornwood' | 'ashfall' | 'none'

/**
 * After the GP-A1 equipment removal, items are consumables only.
 * Weapons / armor / shields / tomes / staves / quivers all gone.
 *
 * - 'food': consumed by per-hop overworld travel (1 charge / hop).
 * - 'potion': single-use combat consumable (heal, +AP, etc.) — use action lands later.
 */
export type ItemKind = 'food' | 'potion'

export interface Item {
  id: ItemId
  name: string
  kind: ItemKind
  rarity: Rarity
  region: Region
  gridSize: { width: number; height: number }
  buyPrice: number
  sellPrice: number
}
