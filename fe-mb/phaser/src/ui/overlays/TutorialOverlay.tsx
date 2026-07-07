import React from 'react'
import { useCombatStore } from '../../state/combatStore'
import { useMetaStore } from '../../state/metaStore'
import { Button } from '../components'
import { isEnemyUnit } from '../../systems/team'

/**
 * Guided first-battle instructions (ship plan §12). Renders only while the
 * active battle carries battleTag 'tutorial'. Derives the current step from
 * combat state (declarative — no separate step machine to desync):
 *
 *   1. move   — free move not used yet
 *   2. card   — hand visible, nothing selected
 *   3. target — a card is selected, waiting for a target
 *   4. finish — enemy dead → victory modal takes over
 *
 * Skip marks the tutorial seen and hides the overlay (the battle continues
 * as a normal fight).
 */
export function TutorialOverlay(): React.JSX.Element | null {
  const battleTag = useCombatStore((s) => s.state.battleTag)
  const phase = useCombatStore((s) => s.state.phase)
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const units = useCombatStore((s) => s.state.units)
  const turnUnitId = useCombatStore((s) => s.state.turn.unitId)
  const dispatchMeta = useMetaStore((s) => s.dispatch)
  const [skipped, setSkipped] = React.useState(false)

  if (battleTag !== 'tutorial' || skipped || phase !== 'COMBAT') return null

  const roy = turnUnitId ? units[turnUnitId as unknown as string] : undefined
  const enemyAlive = Object.values(units).some((u) => isEnemyUnit(u) && u.hp.current > 0)

  let step: { n: number; text: string }
  if (!enemyAlive) {
    step = { n: 4, text: 'The bandit falls. Victory is yours.' }
  } else if (roy && isEnemyUnit(roy)) {
    step = { n: 0, text: "The bandit takes its turn. Watch what it does." }
  } else if (subPhase === 'SELECTING_TARGET') {
    step = { n: 3, text: 'Now click the bandit to strike. The forecast shows the damage before you commit.' }
  } else if (roy && !roy.hasMovedThisTurn) {
    step = { n: 1, text: 'Every unit gets one free MOVE per turn. Click Roy, then click a highlighted tile to advance toward the bandit.' }
  } else {
    step = { n: 2, text: 'Pick a card from your hand below. The amber coin is its ACTION POINT cost — you have 3 AP each turn.' }
  }

  return (
    <div
      id="tutorial-overlay"
      className="fixed right-5 top-32 z-[90] pointer-events-auto hud-panel px-4 py-3 w-[320px] border border-amber-700/60"
    >
      <div className="flex items-start gap-3">
        <span className="numeral text-amber-400 text-lg leading-none mt-0.5">{step.n > 0 ? step.n : '•'}</span>
        <div className="flex-1">
          <div className="text-[0.6rem] uppercase tracking-[0.2em] text-parchment-dim mb-1">First Steps</div>
          <div className="text-sm text-amber-50">{step.text}</div>
        </div>
        <Button
          variant="ghost"
          className="!px-2 !py-0.5 !text-[10px] shrink-0"
          onPress={() => { setSkipped(true); dispatchMeta({ type: 'markTutorialSeen' }) }}
        >
          Skip
        </Button>
      </div>
    </div>
  )
}
