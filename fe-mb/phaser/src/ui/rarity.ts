import type { Rarity } from '../domain/item'

/**
 * Rarity color language (ship plan §5): common white/grey, uncommon green,
 * rare blue, epic purple, legendary amber-gold. Used on item borders + names
 * across bag, shop, loadout, and loot toasts.
 */
export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-stone-200',
  uncommon: 'text-emerald-400',
  rare: 'text-sky-400',
  epic: 'text-purple-400',
  legendary: 'text-amber-400',
}

export const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-stone-700',
  uncommon: 'border-emerald-700',
  rare: 'border-sky-700',
  epic: 'border-purple-700',
  legendary: 'border-amber-600',
}
