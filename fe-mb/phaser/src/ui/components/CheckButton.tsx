import React from 'react'
import type { CheckRequirement, CheckCandidate } from '../../domain/check'

export interface CheckButtonProps {
  text: string
  requirement: CheckRequirement | null
  candidates: CheckCandidate[]   // for stat checks; [] otherwise
  canPass: boolean                // any party member meets requirement (or class/gold/food satisfied)
  onPress: () => void
}

function formatPrefix(req: CheckRequirement, candidates: CheckCandidate[]): string {
  switch (req.kind) {
    case 'stat': {
      const best = candidates[0]?.statValue ?? 0
      return `${req.stat.toUpperCase()} ${req.threshold} (${best})`
    }
    case 'class':
      return (req.classId as unknown as string).toUpperCase()
    case 'gold':
      return `${req.amount}g`
    case 'food':
      return `${req.amount} food`
  }
}

/**
 * Fallout-NV-style choice button. A `requirement` prefixes the choice with a
 * bracketed `[STR 7 (8)]` chip (green when passable, red when blocked).
 *
 * Unlike a plain disabled button, a BLOCKED check stays fully legible — it
 * reads as a real, visibly-locked option (muted iron box + red requirement
 * chip) rather than fading to near-invisible prose. Enabled checks get the
 * hearth-lit primary treatment so they're obviously clickable.
 */
export function CheckButton({
  text,
  requirement,
  candidates,
  canPass,
  onPress,
}: CheckButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={!canPass}
      onClick={() => { if (canPass) onPress() }}
      className={
        'flex w-full items-center gap-2.5 rounded border px-4 py-2.5 text-left font-body text-[0.95rem] ' +
        'outline-none transition-colors focus-visible:[box-shadow:var(--focus-ring)] ' +
        (canPass
          ? 'cursor-pointer border-amber-700/60 bg-amber-900/45 text-amber-50 hover:border-amber-500 hover:bg-amber-900/70'
          : 'cursor-not-allowed border-stone-700/60 bg-stone-900/70 text-stone-300')
      }
      title={canPass ? undefined : 'No one in the party meets this requirement'}
    >
      {requirement && (
        <span
          data-testid="check-prefix"
          className={
            'numeral shrink-0 rounded border px-1.5 py-0.5 text-xs ' +
            (canPass
              ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-300'
              : 'border-red-800/60 bg-red-950/30 text-red-300')
          }
        >
          [{formatPrefix(requirement, candidates)}]
        </span>
      )}
      <span className="flex-1">{text}</span>
    </button>
  )
}
