import type { Item, Rarity } from '../domain/item'

/**
 * Regional shop stock rules (ship plan §5-6):
 *   Borderlands shops  → common + uncommon
 *   Thornwood shops    → uncommon + rare
 *   Ashfall shops      → uncommon + rare
 *
 * A shop stocks: explicit shopStockIds (any rarity — quest/spec overrides),
 * plus every item of its own region within the allowed rarity band, plus
 * region-less consumables (food/potions are sold everywhere).
 * Epic/legendary are NEVER shop-stocked (earned, not bought).
 */
const REGION_RARITIES: Record<string, readonly Rarity[]> = {
  borderlands: ['common', 'uncommon'],
  thornwood: ['uncommon', 'rare'],
  ashfall: ['uncommon', 'rare'],
}

export interface ShopTownLike {
  regionId?: string
  shopStockIds: readonly string[]
}

export function shopStockFor(town: ShopTownLike, items: readonly Item[]): Item[] {
  const regionId = town.regionId ?? 'borderlands'
  const allowed = REGION_RARITIES[regionId] ?? (['common', 'uncommon'] as const)
  return items.filter((i) => {
    if (i.rarity === 'epic' || i.rarity === 'legendary') return false
    if (town.shopStockIds.includes(i.id as unknown as string)) return true
    if (i.region === 'none' && (i.kind === 'food' || i.kind === 'potion')) return true
    return i.region === regionId && allowed.includes(i.rarity)
  })
}
