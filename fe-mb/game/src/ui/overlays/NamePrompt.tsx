/**
 * ui/overlays/NamePrompt.tsx — "what do they call you?" on a parchment slip: one ink-line input, one leather Set.
 *
 * This is the FIRST control the player ever presses, so the reason does not wait to be hovered: it sits under the
 * rule of the input as the player types, and the button carries it on the glass as well.
 *
 * The reason is the ENGINE's, read through `useLegal` — the slip used to keep its own copy ("write a name first")
 * of one of the two rules and know nothing of the other, so naming your lord after the authored warlord was
 * accepted in silence and the final board then read the same string on both sides (FINAL GATE C 3.15). One truth
 * behind the unlit button and the refusal: `run/naming.ts#canTakeName`.
 */
import React, { useState } from 'react'
import { overlayOf } from '../../engine/flow/pump'
import type { GameState } from '../../engine/types'
import { Button } from '../components/Button'
import { dispatch, useGame, useLegal } from '../store'

const selectTarget = (s: GameState): 'mc' | 'company' | null => {
  const o = overlayOf(s)
  return o?.kind === 'namePrompt' ? o.prompt.target : null
}

export function NamePrompt(): React.JSX.Element | null {
  const target = useGame(selectTarget)
  const [name, setName] = useState('')
  const legal = useLegal({ type: 'name/submit', name })
  if (target === null) return null
  const submit = (): void => { if (legal.ok) { dispatch({ type: 'name/submit', name: name.trim() }); setName('') } }
  return (
    <div className="event" data-testid="name-prompt">
      <div className="event__scrim" />
      <form className="page-canvas event__card event__card--slip" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="event__eyebrow voice-display">{target === 'mc' ? 'The foundling' : 'The company'}</div>
        <h2 className="event__title voice-display">{target === 'mc' ? 'What do they call you?' : 'What will the company be called?'}</h2>
        <input className="ink-line" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoFocus autoComplete="off" spellCheck={false} placeholder={target === 'mc' ? 'a name' : 'a banner'} data-testid="name-input" />
        <div className="slip__why" data-testid="name-why">{legal.ok ? ' ' : legal.reason}</div>
        <div className="event__choices">
          <Button variant="primary" disabledReason={legal.ok ? null : legal.reason} onPress={submit} testId="name-submit">Set</Button>
        </div>
      </form>
    </div>
  )
}
