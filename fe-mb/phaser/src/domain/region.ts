export type RegionId = string & { readonly __brand: 'RegionId' }
export const asRegionId = (s: string): RegionId => s as RegionId

/**
 * Overworld region. Tier modulates encounter difficulty + shop pricing.
 * Pulled from Godot's overworld.json `regions` block (borderlands tier 1,
 * thornwood tier 2, ashfall tier 3).
 */
export interface Region {
  id: RegionId
  name: string
  /** Hex color for MapBackground tinting + UI accents. */
  color: string
  /** 1 = starter, 2 = mid-game, 3 = endgame. Drives enemy stat scaling. */
  tier: number
}
