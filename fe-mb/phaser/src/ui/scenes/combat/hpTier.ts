/** HP-tier helpers (pure, no JSX) shared by the combat HUD readouts.
 *
 * Tier THRESHOLDS live in game/boardPalette (the single named-constant
 * palette module) so the canvas HP bars and these DOM readouts can never
 * disagree about when a unit turns "wounded". This module owns only the
 * CSS-var color variants, which the canvas can't consume.
 */
import { hpTierFor, type HpTier } from '../../../game/boardPalette'

export type { HpTier }

export function hpTier(current: number, max: number): HpTier {
  return hpTierFor(current, max)
}

export const HP_FILL: Record<HpTier, string> = {
  ok: 'var(--hp-ok)',
  warn: 'var(--hp-warn)',
  crit: 'var(--hp-crit)',
}

const HP_TEXT: Record<HpTier, string> = {
  ok: 'text-[color:var(--hp-ok)]',
  warn: 'text-[color:var(--hp-warn)]',
  crit: 'text-[color:var(--hp-crit-text)]', // AA-safe red for small text
}

export function hpTextClass(current: number, max: number): string {
  return HP_TEXT[hpTier(current, max)]
}
