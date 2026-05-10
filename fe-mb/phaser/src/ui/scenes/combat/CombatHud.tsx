import React from 'react'
import { TopBar } from './TopBar'
import { ModeLabel } from './ModeLabel'
import { MoveBtn } from './MoveBtn'
import { EndTurnBtn } from './EndTurnBtn'
import { CardHand } from './CardHand'
import { CaptureBtn } from './CaptureBtn'
import { InitiativeStrip } from './InitiativeStrip'

/**
 * Top-level combat HUD overlay rendered over the Phaser canvas.
 *
 * The outer wrapper has `pointer-events: none` so the canvas underneath
 * receives clicks for tile/unit picking. Each interactive HUD element wraps
 * itself in `pointer-events: auto`.
 */
export function CombatHud(): React.JSX.Element {
  return (
    <div
      id="combat-hud"
      className="pointer-events-none absolute inset-0 z-[100] font-mono"
    >
      <div className="pointer-events-auto"><TopBar /></div>
      <InitiativeStrip />
      <ModeLabel />
      <CardHand />
      <CaptureBtn />
      <div className="absolute bottom-4 right-4 flex gap-3 pointer-events-auto">
        <MoveBtn />
        <EndTurnBtn />
      </div>
    </div>
  )
}
