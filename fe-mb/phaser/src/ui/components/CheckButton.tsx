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

function requirementLabel(req: CheckRequirement): string {
  switch (req.kind) {
    case 'stat':
      return `${req.stat.toUpperCase()} ${req.threshold}`
    case 'class':
      return (req.classId as unknown as string).toUpperCase()
    case 'gold':
      return `${req.amount}g`
    case 'food':
      return `${req.amount} food`
  }
}

/**
 * FNV-style choice button for check events, forged on Button.tsx.
 *
 * Requirement checks carry a small-caps stat chip (`STR 7`): hearth-bordered
 * when someone in the party can pass, desaturated `needs STR 7` when nobody
 * can — the chip IS the disabled-reason, so a blocked check stays a real,
 * legible, visibly-locked option (opacity floor below keeps it readable
 * through the forged disabled treatment). The best-candidate math lives in
 * the CheckCandidatePicker that opens on click, not on the chip.
 *
 * Action rank: requirement choices that can pass are the modal's committed
 * actions (hearth-lit primary); requirement-free prose choices ("Walk on.")
 * read as quiet iron so a decline never shouts as loud as a commit.
 */
export function CheckButton({
  text,
  requirement,
  canPass,
  onPress,
}: CheckButtonProps): React.JSX.Element {
  return (
    <Button
      variant={requirement && canPass ? 'primary' : 'secondary'}
      prose
      isDisabled={!canPass}
      onPress={onPress}
      className="w-full"
      // Blocked checks must stay legible (they're information, not chrome) —
      // lift the forged disabled opacity while keeping its desaturation.
      {...(canPass ? {} : { style: { opacity: 0.8 } })}
    >
      <span className="flex w-full items-center gap-2.5 py-0.5 text-left">
        {requirement && (
          <span
            data-testid="check-prefix"
            className={
              'numeral shrink-0 self-center rounded-[3px] border px-1.5 py-0.5 text-[0.68rem] tracking-[0.05em] [font-variant-caps:small-caps] '
              + (canPass
                ? 'border-[color:color-mix(in_oklab,var(--color-hearth-soft)_60%,transparent)] bg-[color-mix(in_oklab,var(--color-hearth)_10%,transparent)] text-[color:var(--color-hearth)]'
                : 'border-[color:color-mix(in_oklab,var(--hp-crit-text)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-ember)_12%,transparent)] text-[color:var(--hp-crit-text)]')
            }
          >
            {canPass ? requirementLabel(requirement) : `needs ${requirementLabel(requirement)}`}
          </span>
        )}
        <span className="flex-1">{text}</span>
      </span>
    </Button>
  )
}
