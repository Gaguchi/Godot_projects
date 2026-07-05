import React from 'react'
import { useCombatStore } from '../../../state/combatStore'

/**
 * Mid-screen banner that appears during SELECTING_MOVE / SELECTING_TARGET.
 *
 * Uses pure CSS transitions (opacity + translate) instead of Framer Motion
 * so we don't pay for AnimatePresence in the bundle. Render is always
 * mounted; visibility is driven by data-active attribute.
 */
export function ModeLabel(): React.JSX.Element {
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const text = subPhase === 'SELECTING_MOVE'
    ? 'Click a highlighted tile to move (ESC to cancel)'
    : subPhase === 'SELECTING_TARGET'
      ? 'Click a target (ESC or right-click to cancel)'
      : ''

  const active = text.length > 0

  return (
    <div
      data-active={active || undefined}
      aria-hidden={!active}
      className={
        // below the (lowered) initiative strip.
        'absolute top-[13rem] left-1/2 -translate-x-1/2 px-4 py-2 ' +
        'bg-amber-900/85 border border-amber-500/70 text-amber-50 ' +
        'font-body font-medium text-sm tracking-wide rounded shadow-lg z-[80] ' +
        'motion-safe:transition-[opacity,transform] motion-safe:duration-150 ' +
        (active ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none')
      }
    >
      {text || ' '}
    </div>
  )
}
