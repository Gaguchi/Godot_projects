/**
 * ui/components/Switch.tsx — a two-state setting, drawn as a switch.
 *
 * `Sound: on` shipped as a fifth full-width button identical to Resume, The company, Contracts and Save & quit —
 * a LABEL: VALUE toggle in a stack of equal-rank slabs, which is a settings FORM, not a pause card. A switch says
 * what it is before it is read: the knob's SIDE carries the state, the word beside it carries it again (colour is
 * never the only channel), and the whole row is one control with an idle, a hover, a press and a focus ring.
 */
import React from 'react'

export function Switch({ label, on, onWord = 'on', offWord = 'off', onToggle, testId }: {
  readonly label: string
  readonly on: boolean
  readonly onWord?: string
  readonly offWord?: string
  readonly onToggle: () => void
  readonly testId?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="switch"
      data-testid={testId}
      onClick={onToggle}
    >
      <span className="switch__label">{label}</span>
      <span className="switch__state">{on ? onWord : offWord}</span>
      <span className="switch__track" aria-hidden><i className="switch__knob" /></span>
    </button>
  )
}
