import React from 'react'
import { useCombatStore } from '../../../state/combatStore'
import { Button } from '../../components'

/**
 * Click-pinned panel showing detailed stats / status / class for a single
 * unit. Triggered by clicking a unit on the board (vs. hover which only
 * shows range overlays). Closes via the X button or by clicking elsewhere.
 *
 * State lives in combatStore.state.pinnedDetailUnitId. We derive the unit
 * from the store; if the unit dies or leaves combat, the panel auto-hides.
 */
export interface UnitDetailPanelProps {
  /** ID of the pinned unit; null = panel hidden. */
  pinnedUnitId: string | null
  onClose: () => void
}

export function UnitDetailPanel({ pinnedUnitId, onClose }: UnitDetailPanelProps): React.JSX.Element | null {
  const unit = useCombatStore((s) => (pinnedUnitId ? s.state.units[pinnedUnitId] : undefined))
  if (!pinnedUnitId || !unit) return null

  const isEnemy = (unit.classId as unknown as string).includes('bandit')
    || (unit.classId as unknown as string).includes('brigand')
    || (unit.classId as unknown as string).includes('wolf')
  const teamColor = isEnemy ? 'border-red-700/60' : 'border-amber-700/60'
  const teamText = isEnemy ? 'text-red-300' : 'text-amber-300'

  return (
    <div
      id="unit-detail-panel"
      className={`fixed top-32 right-4 w-[280px] bg-stone-950/95 border ${teamColor} rounded backdrop-blur-sm pointer-events-auto z-[95] font-mono text-sm`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800">
        <span className={`tracking-widest font-bold ${teamText}`}>{unit.name}</span>
        <button
          onClick={onClose}
          className="text-stone-400 hover:text-amber-300 px-2"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>
      <div className="px-3 py-2 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-stone-400">Class</span>
          <span>{unit.classId as unknown as string}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-400">Level</span>
          <span>{unit.level}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-400">HP</span>
          <span className={unit.hp.current / unit.hp.max < 0.3 ? 'text-red-400' : 'text-amber-200'}>
            {unit.hp.current} / {unit.hp.max}
          </span>
        </div>
        {unit.armor > 0 && (
          <div className="flex justify-between">
            <span className="text-stone-400">Armor</span>
            <span className="text-amber-700">{unit.armor}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-stone-400">AP</span>
          <span>{unit.ap} / 3</span>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-stone-800">
        <div className="text-stone-400 text-[10px] tracking-widest mb-1">STATS</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div><span className="text-stone-500">STR</span> {unit.stats.str}</div>
          <div><span className="text-stone-500">MAG</span> {unit.stats.mag}</div>
          <div><span className="text-stone-500">SKL</span> {unit.stats.skl}</div>
          <div><span className="text-stone-500">SPD</span> {unit.stats.spd}</div>
          <div><span className="text-stone-500">DEF</span> {unit.stats.def}</div>
          <div><span className="text-stone-500">RES</span> {unit.stats.res}</div>
          <div><span className="text-stone-500">LCK</span> {unit.stats.lck}</div>
        </div>
      </div>
      {unit.statuses.length > 0 && (
        <div className="px-3 py-2 border-t border-stone-800">
          <div className="text-stone-400 text-[10px] tracking-widest mb-1">STATUS</div>
          <div className="flex flex-wrap gap-1">
            {unit.statuses.map((s, i) => (
              <span
                key={`${s.effectId as unknown as string}-${i}`}
                className="px-1.5 py-0.5 rounded bg-stone-800 text-amber-300 text-[10px]"
              >
                {s.effectId as unknown as string} ({s.turnsRemaining}t)
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="px-3 py-2 border-t border-stone-800">
        <Button variant="secondary" onPress={onClose} className="w-full !text-xs">Close</Button>
      </div>
    </div>
  )
}
