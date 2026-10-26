/**
 * ui/components/RefusalToast.tsx — the belt to the disabled-with-reason braces. Every control on a screen should
 * carry its own reason BEFORE it is pressed (that is the rule); this is what speaks when one slips through anyway,
 * so a refusal is never silent — the player presses, and the game answers in words.
 *
 * It listens to the effect stream for `refused` (the reducer's own sentence, from `flow/legality.ts` or the module
 * that owns the rule) and for `toast` — the engine's ONE channel for a line addressed to the player that no panel
 * owns (a room with nothing left in it, a recruit who declines). Both print over the screen for a beat. It is not
 * state: nothing here survives a reload, and the toast never carries an action of its own.
 *
 * ONE mount, at the frame (`ui/App.tsx`), never one per screen — two of the ten screens had it and the other eight
 * swallowed every refusal in silence (RE-GATE C 3.6). `screen` is not a behaviour, only a SEAT: the foot of the
 * stage is empty on nine screens and is the card hand on the tenth, so the stylesheet moves the sentence up there
 * rather than printing it over the cards the player is choosing between.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
// The recipe travels with the surface now that the surface is mounted at the frame rather than inside a screen.
import '../../styles/places.css'
import type { Effect } from '../../engine/effects'
import type { ScreenKind } from '../../engine/types'
import { useEffects } from '../store'

const DWELL_MS = 2200

export function RefusalToast({ testId = 'refusal', screen }: { readonly testId?: string; readonly screen?: ScreenKind } = {}): React.JSX.Element | null {
  const [text, setText] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])
  useEffects(useCallback((effects: readonly Effect[]) => {
    const spoken = effects.find((e): e is Extract<Effect, { kind: 'refused' | 'toast' }> => e.kind === 'refused' || e.kind === 'toast')
    if (spoken === undefined) return
    setText(spoken.kind === 'refused' ? spoken.reason : spoken.text)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setText(null), DWELL_MS)
  }, []))
  if (text === null) return null
  return <div className="place__toast" role="status" data-testid={testId} data-screen={screen}>{text}</div>
}
