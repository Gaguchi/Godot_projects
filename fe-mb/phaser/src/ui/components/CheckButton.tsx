import React from 'react'
import { Button } from './Button'
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
 * NV-style choice button. When a `requirement` is set, prefixes the choice
 * text with a bracketed `[STR 7 (8)]` (or `[100g]`, `[CLERIC]`, etc.).
 * Green when passable, red when blocked. Disabled when `canPass` is false.
 */
export function CheckButton({
  text,
  requirement,
  candidates,
  canPass,
  onPress,
}: CheckButtonProps): React.JSX.Element {
  return (
    <Button
      onPress={onPress}
      isDisabled={!canPass}
      variant={canPass ? 'primary' : 'secondary'}
      className="!justify-start text-left w-full"
    >
      {requirement && (
        <span
          data-testid="check-prefix"
          className={`mr-2 text-xs font-mono ${canPass ? 'text-emerald-400' : 'text-red-500'}`}
        >
          [{formatPrefix(requirement, candidates)}]
        </span>
      )}
      <span>{text}</span>
    </Button>
  )
}
