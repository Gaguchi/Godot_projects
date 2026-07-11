import React from 'react'
import { useCombatStore } from '../../../state/combatStore'
import { ApPips, HpMeter, TeamSigil } from './hudBits'
import { hpTextClass } from './hpTier'

/**
 * Combat status — a herald's iron plaque, not a key:value status bar.
 *
 * Hierarchy (Refactoring-UI: vary size/weight/colour, don't list at one weight):
 *   - the active unit's NAME dominates (display serif),
 *   - AP is the single glowing element (pips),
 *   - HP is a quiet token meter + numeral,
 *   - "Turn N" is demoted to a small label chip,
 *   - team is a SHAPE sigil (shield/fangs) + colour, never colour alone.
 */
export function TopBar(): React.JSX.Element {
  const turnNumber = useCombatStore((s) => s.state.turn.number)
  const activeId = useCombatStore((s) => s.state.turn.unitId)
  const team = useCombatStore((s) => s.state.turn.team)
  const unit = useCombatStore((s) => (activeId ? s.state.units[activeId as unknown as string] : null))
  const isEnemy = team !== 'party'

  return (
    <div
      id="combat-topbar"
      className="hud-panel relative flex items-center gap-4 px-4 py-2"
    >
      {/* Turn — demoted label chip */}
      <div className="flex flex-col items-center leading-none">
        <span className="text-[0.55rem] uppercase tracking-[0.22em] text-parchment-dim">Turn</span>
        <span className="numeral text-lg text-parchment">{turnNumber}</span>
      </div>

      <div className="hud-divider" />

      {/* Team sigil + active unit name (dominant) + phase label */}
      <div className="flex items-center gap-2.5">
        <TeamSigil enemy={isEnemy} size={20} />
        <div className="flex flex-col leading-tight">
          <span className={`voice-display text-lg ${isEnemy ? 'text-enemy' : 'text-parchment'}`}>
            {unit ? unit.name : '—'}
          </span>
          <span
            className={`text-[0.55rem] uppercase tracking-[0.24em] ${isEnemy ? 'text-enemy' : 'text-hearth/90'}`}
          >
            {team === 'party' ? 'Your Turn' : 'Enemy Turn'}
          </span>
        </div>
      </div>

      {unit && (
        <>
          <div className="hud-divider" />

          {/* HP — quiet meter + numeral */}
          <div className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-[0.22em] text-parchment-dim">Health</span>
            <div className="flex items-center gap-2">
              <HpMeter current={unit.hp.current} max={unit.hp.max} width={84} />
              <span className={`numeral text-sm ${hpTextClass(unit.hp.current, unit.hp.max)}`}>
                {unit.hp.current}
                <span className="text-[color:var(--color-text-muted)]">/{unit.hp.max}</span>
              </span>
            </div>
          </div>

          {/* AP — the single glowing readout (party turns only) */}
          {team === 'party' && (
            <>
              <div className="hud-divider" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[0.55rem] uppercase tracking-[0.22em] text-parchment-dim">Actions</span>
                <ApPips current={unit.ap} max={3} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
