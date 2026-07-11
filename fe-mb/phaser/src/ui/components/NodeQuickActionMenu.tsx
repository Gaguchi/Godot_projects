import React, { useEffect, useRef } from 'react'
import { Icon, type IconName } from './Icon'
import { Button } from './Button'

export interface NodeQuickAction {
  id: string
  label: string
  icon: IconName
  description?: string
  /** Disable the action with this reason rendered as a muted line below. */
  disabledReason?: string
  /** The menu's lead action — gets the hearth accent (one per menu). */
  primary?: boolean
  /** What it does when chosen. The menu dismisses itself afterward. */
  onChoose: () => void
}

export interface NodeQuickActionMenuProps {
  title: string
  /** Optional sub-label below the title — e.g. region name. */
  subtitle?: string
  /** Screen-space anchor (the node's center on the pan layer in pixels). */
  anchor: { x: number; y: number }
  actions: NodeQuickAction[]
  onDismiss: () => void
  /**
   * Which side of the anchor the menu opens toward. `'right'` (default) places
   * it to the right of the node; `'left'` flips it so the far-right exit node
   * doesn't clip past the stage edge. Caller decides based on screen-space room.
   */
  side?: 'left' | 'right'
}

/**
 * M&B-style quick-action menu anchored to a town/camp/dungeon node on the
 * overworld. Replaces the prior auto-enter behavior (clicking a node
 * force-dropped the player into the scene). Player gets a small menu of
 * choices instead — Enter Town, Visit Inn, Visit Shop, etc. — and can
 * dismiss with Esc / outside click to stay on the overworld at that node.
 * Rows are numbered; pressing the matching digit chooses that row.
 *
 * Positioning notes:
 *  - `anchor` is in pan-layer coordinates (same coordinate space as node
 *    positions in OverworldScene). The menu is rendered inside the pan
 *    layer so it follows the player's drag/scroll of the map.
 *  - Horizontal placement: `side` opens the menu to the right (default) or
 *    left of the node; the caller picks the side that keeps it on-screen.
 *  - Vertical placement: top is clamped to the chart zone so the menu never
 *    runs off the bottom edge.
 */
export function NodeQuickActionMenu({
  title,
  subtitle,
  anchor,
  actions,
  onDismiss,
  side = 'right',
}: NodeQuickActionMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  // Esc to dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onDismiss()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  // Digit hotkeys — 1..9 choose the matching row (mirrors the keycap chips).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > Math.min(actions.length, 9)) return
      const a = actions[n - 1]
      if (!a || a.disabledReason) return
      e.stopPropagation()
      a.onChoose()
      onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions, onDismiss])

  // Outside click to dismiss
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node | null
      if (!ref.current) return
      if (target && ref.current.contains(target)) return
      onDismiss()
    }
    // Slight delay so the click that opened the menu doesn't immediately dismiss it
    const timer = setTimeout(() => window.addEventListener('mousedown', onDown), 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', onDown)
    }
  }, [onDismiss])

  // Auto-focus the first non-disabled action
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])')
    first?.focus()
  }, [])

  // Position: place the menu beside the node anchor. `side='right'` opens to the
  // right (default); `side='left'` mirrors it to the left so a far-right node's
  // menu doesn't clip past the stage edge.
  const MENU_W = 220
  const offsetX = 36   // gap from node center
  const offsetY = -8
  const left = side === 'left' ? anchor.x - offsetX - MENU_W : anchor.x + offsetX

  // Vertical clamp: the menu lives in the map-zone pan layer (X-only translate),
  // so its `top` in anchor coords maps 1:1 to its on-screen Y within the chart.
  // Estimate the rendered height (header ~52px + ~38px per action row) and pull
  // it up if it would run off the bottom of the chart zone.
  const MAP_ZONE_H = 444
  const estHeight = 52 + actions.length * 38
  const top = Math.max(8, Math.min(anchor.y + offsetY, MAP_ZONE_H - estHeight - 8))

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${title} actions`}
      data-testid="node-quick-menu"
      className="hud-panel absolute z-50 overflow-hidden pointer-events-auto"
      style={{
        left,
        top,
        width: MENU_W,
        // --dur-quick collapses to ~0 under prefers-reduced-motion, so the
        // rise-in is motion-safe by construction.
        animation: 'nodeMenuIn var(--dur-quick) var(--ease-out-quart) both',
      }}
    >
      <style>{`
        @keyframes nodeMenuIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="hud-panel-header px-3 py-2">
        <div className="voice-display text-sm tracking-[0.06em] text-[color:var(--color-parchment)]">{title}</div>
        {subtitle && (
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            {subtitle}
          </div>
        )}
      </div>
      <ul className="py-1">
        {actions.map((a, i) => {
          const disabled = !!a.disabledReason
          return (
            <li key={a.id} className="relative">
              {/* Hearth accent bar — marks the menu's single lead action. */}
              {a.primary && !disabled && (
                <span
                  aria-hidden
                  className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-[color:var(--color-hearth)]"
                />
              )}
              <Button
                variant="ghost"
                prose
                isDisabled={disabled}
                onPress={() => {
                  a.onChoose()
                  onDismiss()
                }}
                className="w-full rounded-none"
                data-testid={`node-action-${a.id}`}
              >
                <span className="flex w-full items-center gap-2 text-left text-xs">
                  <Icon
                    name={a.icon}
                    size={14}
                    className={a.primary ? 'text-[color:var(--color-hearth)]' : 'text-[color:var(--color-hearth-soft)]'}
                  />
                  <span className={`flex-1 ${a.primary ? 'text-[color:var(--color-hearth)]' : ''}`}>{a.label}</span>
                  {i < 9 && (
                    <kbd className="numeral rounded-[2px] border border-[color:color-mix(in_oklab,var(--color-hearth-soft)_45%,transparent)] px-1 text-[0.6rem] leading-4 text-[color:var(--color-parchment-dim)]">
                      {i + 1}
                    </kbd>
                  )}
                </span>
              </Button>
              {disabled && a.disabledReason && (
                <div className="px-4 pb-1 text-[10px] text-[color:var(--color-text-muted)]">
                  {a.disabledReason}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
