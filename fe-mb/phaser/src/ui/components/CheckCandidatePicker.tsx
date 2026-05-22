import React from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { Icon } from './Icon'
import type { CheckCandidate } from '../../domain/check'

export interface CheckCandidatePickerProps {
  open: boolean
  statLabel: string         // e.g. "STR"
  threshold: number
  candidates: CheckCandidate[]
  onPick: (c: CheckCandidate) => void
  onCancel: () => void
}

/**
 * "Who tries this?" modal. Lists living party members with their value of
 * the requested stat. Each row is clickable; failing candidates remain
 * selectable so the player can deliberately fail (e.g. for narrative effect).
 *
 * Returns nothing when `open` is false. Always-on render stays cheap.
 */
export function CheckCandidatePicker({
  open, statLabel, threshold, candidates, onPick, onCancel,
}: CheckCandidatePickerProps): React.JSX.Element {
  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => { if (!o) onCancel() }}
      aria-label={`Choose unit for ${statLabel} ${threshold} check`}
    >
      <div id="check-picker" className="flex flex-col gap-2 min-w-[320px]">
        <div className="text-sm tracking-widest text-amber-200 mb-2">
          Who tries this? [{statLabel} {threshold}]
        </div>
        {candidates.length === 0 ? (
          <div className="text-stone-500 italic text-center py-4">No living party members.</div>
        ) : (
          candidates.map((c) => (
            <button
              key={c.unitId as unknown as string}
              data-testid="candidate-row"
              onClick={() => onPick(c)}
              className={`flex items-center gap-3 px-3 py-2 rounded border text-left
                ${c.meetsThreshold
                  ? 'border-emerald-700 hover:bg-emerald-950/30'
                  : 'border-red-900/50 hover:bg-red-950/20'}`}
            >
              <span className="font-bold w-24 truncate">{c.unitName}</span>
              <span className="text-stone-400 w-20">{statLabel} {c.statValue}</span>
              <span className={`flex items-center ${c.meetsThreshold ? 'text-emerald-400' : 'text-red-400'}`}>
                <Icon name={c.meetsThreshold ? 'check' : 'cross'} size={16} />
              </span>
            </button>
          ))
        )}
        <div className="mt-3">
          <Button variant="secondary" onPress={onCancel}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
