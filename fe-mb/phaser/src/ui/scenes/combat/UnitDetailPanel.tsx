import React from 'react'
import { isEnemyUnit } from '../../../systems/team'
import { useCombatStore } from '../../../state/combatStore'
import { Button, Icon } from '../../components'
import { CharacterPortrait } from '../../components/CharacterPortrait'
import { ApPips, HpMeter, TeamSigil } from './hudBits'
import { hpTextClass } from './hpTier'

/**
 * Click-pinned panel showing detailed stats / status / class for one unit.
 * Triggered by clicking a unit on the board (hover shows range overlays only).
 *
 * "Forged & Lit": the shared iron HUD-panel recipe, display-serif name, tabular
 * numerals for every stat, team SHAPE sigil + colour (never colour alone).
 */
export interface UnitDetailPanelProps {
  /** ID of the pinned unit; null = panel hidden. */
  pinnedUnitId: string | null
  onClose: () => void
}

const STAT_KEYS = ['str', 'mag', 'skl', 'spd', 'def', 'res', 'lck'] as const

export function UnitDetailPanel({ pinnedUnitId, onClose }: UnitDetailPanelProps): React.JSX.Element | null {
  const unit = useCombatStore((s) => (pinnedUnitId ? s.state.units[pinnedUnitId] : undefined))
  const targeting = useCombatStore((s) => s.state.subPhase === 'SELECTING_TARGET')
  // While a card is selected, unit interaction means TARGETING — the detail
  // panel stays out of the way entirely (playtest feedback).
  if (targeting) return null
  if (!pinnedUnitId || !unit) return null

  const classId = unit.classId as unknown as string
  const isEnemy = isEnemyUnit(unit)

  return (
    <div
      id="unit-detail-panel"
      className="hud-panel fixed top-36 right-4 w-[270px] pointer-events-auto z-[95] text-sm"
    >
      <div className="hud-panel-header flex items-center justify-between px-3 py-2">
        <span className="flex items-center gap-2">
          <CharacterPortrait speaker={unit.name} unitId={unit.id as unknown as string} classId={unit.classId as unknown as string} size={28} active />
          <TeamSigil enemy={isEnemy} size={16} />
          <span className={`voice-display text-base ${isEnemy ? 'text-enemy' : 'text-parchment'}`}>
            {unit.name}
          </span>
        </span>
        <button
          onClick={onClose}
          className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-parchment)] transition-colors"
          aria-label="Close detail panel"
        >
          <Icon name="cross" size={16} />
        </button>
      </div>

      {/* vitals */}
      <div className="px-3 py-2.5 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-parchment-dim">{classId.replace(/_/g, ' ')}</span>
          <span className="text-parchment-dim">
            Lv <span className="numeral text-parchment">{unit.level}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[0.6rem] uppercase tracking-[0.18em] text-parchment-dim w-10">HP</span>
          <HpMeter current={unit.hp.current} max={unit.hp.max} width="100%" />
          <span className={`numeral text-xs whitespace-nowrap ${hpTextClass(unit.hp.current, unit.hp.max)}`}>
            {unit.hp.current}<span className="text-[color:var(--color-text-muted)]">/{unit.hp.max}</span>
          </span>
        </div>

        {unit.armor > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-parchment-dim w-10">Armor</span>
            <span className="numeral text-[color:var(--color-gem-ward)]">{unit.armor}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[0.6rem] uppercase tracking-[0.18em] text-parchment-dim w-10">AP</span>
          <ApPips current={unit.ap} max={3} />
        </div>
      </div>

      {/* stats */}
      <div className="px-3 py-2 border-t border-[rgba(120,98,60,0.22)]">
        <div className="text-parchment-dim text-[0.6rem] tracking-[0.2em] uppercase mb-1.5">Stats</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {STAT_KEYS.map((k) => (
            <div key={k} className="flex justify-between">
              <span className="text-[color:var(--color-text-muted)] uppercase">{k}</span>
              <span className="numeral text-parchment">{unit.stats[k]}</span>
            </div>
          ))}
        </div>
      </div>

      {unit.statuses.length > 0 && (
        <div className="px-3 py-2 border-t border-[rgba(120,98,60,0.22)]">
          <div className="text-parchment-dim text-[0.6rem] tracking-[0.2em] uppercase mb-1.5">Status</div>
          <div className="flex flex-wrap gap-1">
            {unit.statuses.map((s, i) => (
              <span
                key={`${s.effectId as unknown as string}-${i}`}
                className="px-1.5 py-0.5 rounded bg-black/30 border border-[color:var(--iron-edge)] text-parchment-dim text-[10px]"
              >
                {(s.effectId as unknown as string).replace(/_/g, ' ')}{' '}
                <span className="numeral text-[color:var(--color-text-muted)]">{s.turnsRemaining}t</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-2 border-t border-[rgba(120,98,60,0.22)]">
        <Button variant="secondary" onPress={onClose} className="w-full !text-xs">Close</Button>
      </div>
    </div>
  )
}
