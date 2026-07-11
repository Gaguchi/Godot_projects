import React from 'react'
import { useCombatStore } from '../../../state/combatStore'
import { Keycap } from './hudBits'

/**
 * Slim instruction strip shown during SELECTING_MOVE / SELECTING_TARGET.
 * Docked by CombatHud's top-center column (TopBar > InitiativeStrip > this),
 * so it needs no absolute offset of its own.
 *
 * Hidden while a forecast target is pinned — the ForecastPanel with its
 * Confirm/Cancel gate IS the instruction for that moment; two surfaces must
 * never instruct the same state.
 *
 * Uses pure CSS transitions (opacity + translate) instead of Framer Motion
 * so we don't pay for AnimatePresence in the bundle. Render is always
 * mounted; visibility is driven by data-active attribute.
 */
export function ModeLabel(): React.JSX.Element {
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const pinnedTile = useCombatStore((s) => s.state.pinnedTargetTile)
  const text = subPhase === 'SELECTING_MOVE'
    ? 'Choose a highlighted tile'
    : subPhase === 'SELECTING_TARGET'
      ? 'Choose a target'
      : ''

  const active = text.length > 0 && pinnedTile === null

  return (
    <div
      data-active={active || undefined}
      aria-hidden={!active}
      className={
        'hud-panel pointer-events-none flex items-center gap-3 px-3 py-1.5 ' +
        'motion-safe:transition-[opacity,transform] motion-safe:duration-150 ' +
        (active ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2')
      }
      style={{ borderLeft: '2px solid var(--color-hearth)' }}
    >
      <span
        className="voice-display text-[0.8rem] leading-none text-parchment"
        style={{ fontVariantCaps: 'small-caps' }}
      >
        {text || ' '}
      </span>
      <span className="flex items-center gap-1.5">
        <Keycap label="Esc" />
        <Keycap label="RMB" />
        <span className="text-[0.6rem] uppercase leading-none tracking-[0.1em] text-[color:var(--color-text-muted)]">
          cancel
        </span>
      </span>
    </div>
  )
}
