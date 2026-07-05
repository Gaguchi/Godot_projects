import React, { useState } from 'react'
import type { ForecastResult } from '../../../systems/damage'
import { Icon } from '../../components/Icon'

export interface ForecastMathRowProps {
  forecast: ForecastResult
}

export function ForecastMathRow({ forecast }: ForecastMathRowProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  if (forecast.heal > 0) {
    return (
      <div className="px-3 py-2 text-xs font-body text-emerald-300">
        <span className="numeral">+{forecast.heal}</span> healed
      </div>
    )
  }
  const total = forecast.damageBefore
  return (
    <div className="px-3 py-2 text-xs font-body">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 text-left w-full text-stone-300 hover:text-amber-200"
        data-testid="forecast-math-toggle"
      >
        <span className="text-stone-500 flex items-center"><Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={12} /></span>
        <span className="text-amber-300"><span className="numeral">{total}</span> damage</span>
        {forecast.armorLost > 0 && (
          <span className="text-stone-500">
            (−<span className="numeral">{forecast.armorLost}</span> armor, −<span className="numeral">{forecast.hpLost}</span> HP)
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-1 ml-4 text-stone-400">
          <div>
            <span className="numeral">{forecast.baseTerm}</span> base
            {forecast.statName && (
              <> + <span className="numeral">{forecast.statTerm}</span> {forecast.statName.toUpperCase()}</>
            )}
            {forecast.drTerm > 0 && <> − <span className="numeral">{forecast.drTerm}</span> DR</>}
            {' = '}
            <span className="text-amber-300 numeral">{total}</span>
          </div>
        </div>
      )}
    </div>
  )
}
