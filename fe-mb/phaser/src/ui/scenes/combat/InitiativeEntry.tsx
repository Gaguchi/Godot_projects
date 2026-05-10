import React from 'react'
import { CharacterPortrait } from '../../components/CharacterPortrait'
import type { InitiativeEntry as InitiativeEntryData } from '../../hooks/useInitiativeQueue'

export interface InitiativeEntryProps {
  entry: InitiativeEntryData
}

export function InitiativeEntry({ entry }: InitiativeEntryProps): React.JSX.Element {
  const { unit, isActive, team } = entry
  const ringClass = isActive
    ? team === 'party' ? 'ring-2 ring-amber-300' : 'ring-2 ring-red-500'
    : team === 'party' ? 'ring-1 ring-amber-700/50' : 'ring-1 ring-red-900/60'
  const portraitSize = isActive ? 56 : 40
  const hpPct = unit.hp.current / unit.hp.max
  const hpColor = hpPct > 0.5 ? 'text-amber-200' : hpPct > 0.25 ? 'text-amber-400' : 'text-red-400'

  return (
    <div
      data-testid="initiative-entry"
      data-unit-id={unit.id as unknown as string}
      data-active={isActive ? 'true' : 'false'}
      data-team={team}
      className={`flex flex-col items-center gap-1 transition-transform ${isActive ? 'scale-110' : 'opacity-80'}`}
      aria-label={`${unit.name}, ${unit.classId as unknown as string}, HP ${unit.hp.current} of ${unit.hp.max}${isActive ? ', active turn' : ''}`}
    >
      <div className={`rounded-full overflow-hidden ${ringClass}`}>
        <CharacterPortrait speaker={unit.name} size={portraitSize} active={isActive} />
      </div>
      <span className={`text-[10px] font-mono tabular-nums ${hpColor}`}>
        {unit.hp.current}/{unit.hp.max}
      </span>
    </div>
  )
}
