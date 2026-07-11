import React from 'react'
import { CharacterPortrait } from '../../components/CharacterPortrait'
import { TeamSigil } from './hudBits'
import { hpTextClass } from './hpTier'
import type { InitiativeEntry as InitiativeEntryData } from '../../hooks/useInitiativeQueue'

export interface InitiativeEntryProps {
  entry: InitiativeEntryData
}

export function InitiativeEntry({ entry }: InitiativeEntryProps): React.JSX.Element {
  const { unit, isActive, team } = entry
  const isEnemy = team !== 'party'
  const ringClass = isActive
    ? isEnemy ? 'ring-2 ring-enemy' : 'ring-2 ring-hearth'
    : isEnemy
      ? 'ring-1 ring-[color:color-mix(in_oklab,var(--color-enemy)_45%,transparent)]'
      : 'ring-1 ring-[color:color-mix(in_oklab,var(--color-hearth-soft)_50%,transparent)]'
  const portraitSize = isActive ? 54 : 40

  return (
    <div
      data-testid="initiative-entry"
      data-unit-id={unit.id as unknown as string}
      data-active={isActive ? 'true' : 'false'}
      data-team={team}
      className={`relative flex flex-col items-center gap-1 motion-safe:transition-transform motion-safe:duration-[var(--dur-move)] ${isActive ? 'scale-110' : 'opacity-75'}`}
      aria-label={`${unit.name}, ${unit.classId as unknown as string}, HP ${unit.hp.current} of ${unit.hp.max}${isActive ? ', active turn' : ''}`}
    >
      {/* active "acts now" caret — a shaped object, not a text glyph */}
      {isActive && (
        <span
          aria-hidden
          className="-mb-0.5 motion-safe:animate-[portraitBreath_2.5s_ease-in-out_infinite]"
          style={{
            width: 8,
            height: 5,
            background: isEnemy ? 'var(--color-enemy)' : 'var(--color-hearth)',
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          }}
        />
      )}
      <div className="relative">
        <div className={`rounded-full overflow-hidden ${ringClass}`}>
          <CharacterPortrait
            speaker={unit.name}
            size={portraitSize}
            active={isActive}
            team={isEnemy ? 'enemy' : 'party'}
          />
        </div>
        {/* team sigil badge — non-colour team signal */}
        <span className="absolute -bottom-1 -right-1 rounded-full bg-ink/90 p-0.5 ring-1 ring-black/50">
          <TeamSigil enemy={isEnemy} size={isActive ? 12 : 10} />
        </span>
      </div>
      <span className={`numeral text-[10px] ${hpTextClass(unit.hp.current, unit.hp.max)}`}>
        {unit.hp.current}/{unit.hp.max}
      </span>
    </div>
  )
}
