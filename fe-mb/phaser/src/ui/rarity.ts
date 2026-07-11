import type { Rarity } from '../domain/item'

/**
 * Rarity color language (ship plan §5), retuned for Forged & Lit: common
 * white/grey, uncommon green, rare blue, epic purple, legendary gold — but
 * every hue is desaturated into the warm palette via color-mix against
 * existing tokens so rarity reads as a NAME color plus a subtle edge strip,
 * never a saturated web-form border. Legendary uses --color-gem-focus, not
 * --color-hearth: the hearth accent stays reserved for "act here".
 */
export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-[color:var(--color-parchment)]',
  uncommon: 'text-[color:color-mix(in_oklab,var(--color-gem-ward)_55%,var(--color-parchment))]',
  rare: 'text-[color:color-mix(in_oklab,var(--color-ally)_65%,var(--color-parchment))]',
  epic: 'text-[color:color-mix(in_oklab,var(--color-gem-arcane)_60%,var(--color-parchment))]',
  legendary: 'text-[color:color-mix(in_oklab,var(--color-gem-focus)_72%,var(--color-parchment))]',
}

/**
 * Full-border tint (loadout slots and other framed wells) — heavily
 * desaturated so it sits quietly on iron; the name color carries the read.
 */
export const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-[color:color-mix(in_oklab,var(--color-parchment-dim)_35%,transparent)]',
  uncommon: 'border-[color:color-mix(in_oklab,var(--color-gem-ward)_45%,transparent)]',
  rare: 'border-[color:color-mix(in_oklab,var(--color-ally)_45%,transparent)]',
  epic: 'border-[color:color-mix(in_oklab,var(--color-gem-arcane)_45%,transparent)]',
  legendary: 'border-[color:color-mix(in_oklab,var(--color-gem-focus)_55%,transparent)]',
}

/**
 * Left edge strip (shop/bag rows): rarity as a quiet 2px edge accent — pair
 * with `border-l-2` on a row whose other edges keep the panel recipe.
 */
export const RARITY_EDGE: Record<Rarity, string> = {
  common: 'border-l-[color:color-mix(in_oklab,var(--color-parchment-dim)_45%,transparent)]',
  uncommon: 'border-l-[color:color-mix(in_oklab,var(--color-gem-ward)_65%,transparent)]',
  rare: 'border-l-[color:color-mix(in_oklab,var(--color-ally)_65%,transparent)]',
  epic: 'border-l-[color:color-mix(in_oklab,var(--color-gem-arcane)_65%,transparent)]',
  legendary: 'border-l-[color:color-mix(in_oklab,var(--color-gem-focus)_75%,transparent)]',
}
