/** HP-tier helpers (pure, no JSX) shared by the combat HUD readouts. */
export type HpTier = 'ok' | 'warn' | 'crit'

export function hpTier(current: number, max: number): HpTier {
  const p = current / Math.max(1, max)
  return p > 0.5 ? 'ok' : p > 0.25 ? 'warn' : 'crit'
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
