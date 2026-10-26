/**
 * ui/components/Button.tsx — the ONE button. Leather (`.btn-forged*` recipes in styles/index.css): chrome you ACT on.
 * Variants differ only in edge: primary = brass-edged (exactly one per view), secondary = plain, ghost = a lighter
 * etched slab, danger = oxblood. Every variant has an idle, a hover, a press and a disabled-with-reason: a control
 * with no idle chrome is not a control, it is a word.
 *
 * A disabled button keeps its reason and speaks it ON THE GLASS (`components/Tooltip`), never through the
 * browser's `title=` chrome: it renders `aria-disabled` (so it stays focusable and the reason is reachable by
 * Tab), `data-reason` (the string the tests read) and swallows the press.
 *
 * `pressed` is the fifth state, for the verbs that ARM rather than fire: Move and Capture put the board into a
 * mode and stay armed until the mode ends. They used to change nothing about themselves at all — the only
 * feedback was the board's own wash deepening by a few values, so two frames of the battle read as one
 * (RE-GATE B 2.3; crafting-game-ui signal D). Armed = `aria-pressed` + `.btn-forged--armed`: the strap is pushed
 * IN and edged in brass, the same reading a held key has.
 */
import React from 'react'
import { useTip } from './Tooltip'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps {
  readonly children: React.ReactNode
  readonly onPress?: () => void
  readonly variant?: ButtonVariant
  /** Disabled-with-reason: the reason is spoken on the glass, on hover and on focus. */
  readonly disabledReason?: string | null
  /** A mode this control ARMED and still holds. Renders `aria-pressed` and the pushed-in strap. */
  readonly pressed?: boolean
  readonly prose?: boolean
  readonly autoFocus?: boolean
  readonly className?: string
  readonly style?: React.CSSProperties
  readonly testId?: string
}

export function Button({ children, onPress, variant = 'secondary', disabledReason = null, pressed, prose = false, autoFocus, className = '', style, testId }: ButtonProps): React.JSX.Element {
  const disabled = disabledReason !== null
  const { tipRef, tipProps, tip } = useTip(disabled ? disabledReason : null)
  const classes = ['btn-forged', variant === 'secondary' ? '' : `btn-forged--${variant}`, pressed === true ? 'btn-forged--armed' : '', prose ? 'btn-prose' : '', className].filter((c) => c !== '').join(' ')
  return (
    <>
      <button
        ref={tipRef}
        type="button"
        className={classes}
        aria-pressed={pressed}
        aria-disabled={disabled || undefined}
        data-testid={testId}
        autoFocus={autoFocus}
        onClick={() => { if (!disabled) onPress?.() }}
        style={{ padding: '0.55rem 1.4rem', cursor: disabled ? 'default' : 'pointer', ...style }}
        {...tipProps}
      >
        {children}
      </button>
      {tip}
    </>
  )
}
