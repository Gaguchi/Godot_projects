import React, { useEffect, useRef } from 'react'
import { Icon, type IconName } from './Icon'

export interface NodeQuickAction {
  id: string
  label: string
  icon: IconName
  description?: string
  /** Disable the action with this reason rendered as a tooltip-y line. */
  disabledReason?: string
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
  // Estimate the rendered height (header ~46px + ~34px per action row) and pull
  // it up if it would run off the bottom of the chart zone.
  const MAP_ZONE_H = 444
  const estHeight = 46 + actions.length * 34
  const top = Math.max(8, Math.min(anchor.y + offsetY, MAP_ZONE_H - estHeight - 8))

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${title} actions`}
      data-testid="node-quick-menu"
      className="absolute z-50 bg-stone-950/95 border border-amber-700 rounded shadow-xl backdrop-blur-sm pointer-events-auto"
      style={{
        left,
        top,
        width: MENU_W,
      }}
    >
      <div className="px-3 py-2 border-b border-stone-800">
        <div className="text-sm text-amber-200 voice-display tracking-[0.06em]">{title}</div>
        {subtitle && (
          <div className="text-[10px] text-stone-500 mt-0.5 tracking-widest uppercase">
            {subtitle}
          </div>
        )}
      </div>
      <ul className="py-1">
        {actions.map((a) => {
          const disabled = !!a.disabledReason
          return (
            <li key={a.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return
                  a.onChoose()
                  onDismiss()
                }}
                className={
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-body ' +
                  'outline-none focus-visible:bg-amber-900/30 hover:bg-amber-900/20 ' +
                  (disabled
                    ? 'text-stone-600 cursor-not-allowed'
                    : 'text-amber-100 cursor-pointer')
                }
                title={a.disabledReason}
                data-testid={`node-action-${a.id}`}
              >
                <Icon name={a.icon} size={14} className="text-amber-400" />
                <span className="flex-1">{a.label}</span>
              </button>
              {disabled && a.disabledReason && (
                <div className="px-3 pb-1 text-[10px] text-stone-500 italic">
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
