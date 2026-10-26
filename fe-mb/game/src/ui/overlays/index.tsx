/**
 * ui/overlays/index.tsx — the overlay layer above every screen, rendered from `overlayOf(state)` (priority
 * namePrompt > checkEvent > dialogue > quickMenu > tutorial). The quick menu is the overworld's own node card
 * and the tutorial hint lives in the combat screen, so this layer draws the three narrative modals only.
 */
import React from 'react'
import '../../styles/overlays.css'
import { overlayOf } from '../../engine/flow/pump'
import type { GameState } from '../../engine/types'
import { useGame } from '../store'
import { CheckOverlay } from './CheckOverlay'
import { DialogueOverlay } from './DialogueOverlay'
import { NamePrompt } from './NamePrompt'

const selectKind = (s: GameState): string | null => overlayOf(s)?.kind ?? null

export function Overlays(): React.JSX.Element | null {
  const kind = useGame(selectKind)
  switch (kind) {
    case 'namePrompt': return <NamePrompt />
    case 'checkEvent': return <CheckOverlay />
    case 'dialogue': return <DialogueOverlay />
    default: return null
  }
}
