import React from 'react'
import { useRunStore } from '../../state/runStore'
import { CharacterPortrait } from './CharacterPortrait'

/**
 * Compact party display for use in topbars (overworld + town).
 *
 * Shows up to 4 portraits + HP labels. Renders nothing when the party is
 * empty so the topbar stays clean during the seed-on-combat pre-alpha
 * window.
 */
export function PartyChip(): React.JSX.Element | null {
  const party = useRunStore((s) => s.party.units)
  const order = useRunStore((s) => s.party.partyOrder)
  if (order.length === 0) return null
  const display = order.slice(0, 4)

  return (
    <div
      data-testid="party-chip"
      className="px-3 py-1.5 bg-stone-950/85 border border-amber-900/50 rounded flex items-center gap-2 pointer-events-auto"
      aria-label="Party"
    >
      <span className="text-[10px] text-stone-500 tracking-widest mr-1">PARTY</span>
      {display.map((uid) => {
        const u = party[uid as unknown as string]
        if (!u) return null
        const pct = u.hp.current / u.hp.max
        const hpColor = pct > 0.5 ? 'text-amber-200' : pct > 0.25 ? 'text-amber-400' : 'text-red-400'
        return (
          <div
            key={uid as unknown as string}
            className="flex flex-col items-center gap-0.5"
            title={`${u.name} — ${u.classId as unknown as string} L${u.level} — HP ${u.hp.current}/${u.hp.max}`}
          >
            <div className="rounded-full overflow-hidden ring-1 ring-amber-700/50">
              <CharacterPortrait speaker={u.name} size={26} active={false} />
            </div>
            <span className={`text-[9px] font-mono tabular-nums ${hpColor}`}>
              {u.hp.current}/{u.hp.max}
            </span>
          </div>
        )
      })}
      {order.length > 4 && (
        <span className="text-[10px] text-stone-500 ml-1">+{order.length - 4}</span>
      )}
    </div>
  )
}
