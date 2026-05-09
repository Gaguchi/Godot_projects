import React from 'react'
import { useCombatStore } from '../../../state/combatStore'

export function TopBar(): React.JSX.Element {
  const turnNumber = useCombatStore((s) => s.state.turn.number)
  const activeId = useCombatStore((s) => s.state.turn.unitId)
  const team = useCombatStore((s) => s.state.turn.team)
  const unit = useCombatStore((s) => activeId ? s.state.units[activeId as unknown as string] : null)

  return (
    <div
      id="combat-topbar"
      className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-stone-950/85 border border-amber-900/50 rounded font-mono text-amber-100 text-sm tracking-wider z-10 backdrop-blur-sm"
    >
      <span>Turn {turnNumber}</span>
      <span className="text-stone-600">•</span>
      <span className={team === 'party' ? 'text-amber-300' : 'text-red-400'}>
        {team === 'party' ? 'YOUR TURN' : 'ENEMY TURN'}
      </span>
      {unit && (
        <>
          <span className="text-stone-600">•</span>
          <span className="font-bold">{unit.name}</span>
          <span className="text-stone-600">•</span>
          <span>
            HP <span className={unit.hp.current < unit.hp.max * 0.3 ? 'text-red-400' : 'text-amber-300'}>
              {unit.hp.current}
            </span>
            <span className="text-stone-500">/{unit.hp.max}</span>
          </span>
          {team === 'party' && (
            <>
              <span className="text-stone-600">•</span>
              <span>AP <span className="text-amber-300">{unit.ap}</span><span className="text-stone-500">/3</span></span>
            </>
          )}
        </>
      )}
    </div>
  )
}
