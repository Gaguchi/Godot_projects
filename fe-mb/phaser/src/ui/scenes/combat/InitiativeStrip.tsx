import React from 'react'
import { useInitiativeQueue } from '../../hooks/useInitiativeQueue'
import { InitiativeEntry } from './InitiativeEntry'

const MAX_VISIBLE = 8

/**
 * Banner-Saga-style horizontal portrait queue. Renders the current actor and
 * up to 7 upcoming. +N badge if queue exceeds 8.
 *
 * Positioned by CombatHud's top-center flex column (TopBar > strip >
 * ModeLabel) — no absolute offset of its own.
 *
 * Independent of player selection — only depends on combatStore.state.units
 * and state.turn.unitId. Always present, always reflecting the same data.
 */
export function InitiativeStrip(): React.JSX.Element | null {
  const queue = useInitiativeQueue()
  if (queue.length === 0) return null

  const visible = queue.slice(0, MAX_VISIBLE)
  const overflow = queue.length - MAX_VISIBLE

  return (
    <div
      id="initiative-strip"
      className="hud-panel flex items-end gap-2 px-3 py-2 pointer-events-auto"
      aria-label="Turn order"
    >
      {visible.map((entry) => (
        <InitiativeEntry key={entry.unitId as unknown as string} entry={entry} />
      ))}
      {overflow > 0 && (
        <div
          data-testid="initiative-overflow"
          className="numeral flex items-center justify-center w-10 h-10 rounded-full border border-[color:var(--iron-edge)] text-[color:var(--color-text-muted)] text-xs"
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
