import React from 'react'
import { CharacterPortrait } from '../../components/CharacterPortrait'
import type { Unit } from '../../../domain/unit'

export interface ForecastCombatantRowProps {
  source: Unit
  target: Unit
}

export function ForecastCombatantRow({ source, target }: ForecastCombatantRowProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <div className="flex flex-col items-center gap-1" aria-label={`source: ${source.name}`}>
        <CharacterPortrait speaker={source.name} size={48} active />
        <span className="text-[10px] font-mono text-amber-200">{source.name}</span>
      </div>
      <span className="text-2xl text-amber-700 select-none">→</span>
      <div className="flex flex-col items-center gap-1" aria-label={`target: ${target.name}`}>
        <CharacterPortrait speaker={target.name} size={48} active={false} />
        <span className="text-[10px] font-mono text-red-300">{target.name}</span>
      </div>
    </div>
  )
}
