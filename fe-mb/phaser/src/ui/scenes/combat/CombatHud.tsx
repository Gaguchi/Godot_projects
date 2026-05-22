import React from 'react'
import { TopBar } from './TopBar'
import { ModeLabel } from './ModeLabel'
import { MoveBtn } from './MoveBtn'
import { EndTurnBtn } from './EndTurnBtn'
import { CardHand } from './CardHand'
import { CaptureBtn } from './CaptureBtn'
import { InitiativeStrip } from './InitiativeStrip'
import { ForecastPanel } from './ForecastPanel'
import { UnitDetailPanel } from './UnitDetailPanel'
import { useCombatUiStore } from '../../../state/combatUiStore'

/**
 * Top-level combat HUD overlay rendered over the Phaser canvas.
 *
 * The outer wrapper has `pointer-events: none` so the canvas underneath
 * receives clicks for tile/unit picking. Each interactive HUD element wraps
 * itself in `pointer-events: auto`.
 */
export function CombatHud(): React.JSX.Element {
  const pinnedDetailUnitId = useCombatUiStore((s) => s.pinnedDetailUnitId)
  const setPinned = useCombatUiStore((s) => s.setPinnedDetailUnit)
  return (
    <div
      id="combat-hud"
      className="pointer-events-none absolute inset-0 z-[100] font-mono"
    >
      <div className="pointer-events-auto"><TopBar /></div>
      <InitiativeStrip />
      <ForecastPanel />
      <ModeLabel />
      <CardHand />
      <CaptureBtn />
      <UnitDetailPanel pinnedUnitId={pinnedDetailUnitId} onClose={() => setPinned(null)} />
      <div className="absolute bottom-4 right-4 flex gap-3 pointer-events-auto">
        <MoveBtn />
        <EndTurnBtn />
      </div>
      <div className="absolute bottom-2 left-2 text-[10px] text-stone-500 font-mono pointer-events-none">
        [Tab] danger zone · click unit for detail
      </div>
    </div>
  )
}
