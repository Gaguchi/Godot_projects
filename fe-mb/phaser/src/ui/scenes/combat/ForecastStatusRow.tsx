import React from 'react'
import type { ActiveStatus } from '../../../domain/unit'

export interface ForecastStatusRowProps {
  statuses: ActiveStatus[]
}

export function ForecastStatusRow({ statuses }: ForecastStatusRowProps): React.JSX.Element | null {
  if (statuses.length === 0) return null
  return (
    <div className="px-3 py-2 flex flex-wrap gap-1" data-testid="forecast-status-row">
      {statuses.map((s, i) => (
        <span
          key={i}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-amber-300 border border-amber-900/40"
        >
          {s.effectId as unknown as string}
          {s.stacks > 1 && <span className="text-stone-400"> ×{s.stacks}</span>}
        </span>
      ))}
    </div>
  )
}
