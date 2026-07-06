import React from 'react'
import { useForecastPreview } from '../../hooks/useForecastPreview'
import { useCombatStore } from '../../../state/combatStore'
import { createRng } from '../../../systems/rng'
import { ForecastCombatantRow } from './ForecastCombatantRow'
import { ForecastHpBar } from './ForecastHpBar'
import { ForecastMathRow } from './ForecastMathRow'
import { ForecastStatusRow } from './ForecastStatusRow'

/**
 * Top-right pinned panel showing damage forecast for the currently-selected
 * card × pinned target. Renders nothing when no preview is active.
 *
 * Numbers shown === numbers applied (anti-drift guarantee via shared damage.ts).
 *
 * Buttons:
 *   - Confirm: dispatches playCard, reducer clears pin + selection
 *   - Cancel : dispatches unpinTarget, keeps card selected
 */
export function ForecastPanel(): React.JSX.Element | null {
  const preview = useForecastPreview()
  const dispatch = useCombatStore((s) => s.dispatch)
  if (!preview) return null
  const { card, source, target, forecast } = preview
  const lethal = forecast.lethal

  const onConfirm = (): void => {
    if (!target.position) return
    const cardPayload: {
      apCost: number
      damageStat?: 'str' | 'mag' | 'skl'
      targetKind?: string
      aoeRadius?: number
      effects: Array<{ kind: string; params: Record<string, unknown> }>
    } = {
      apCost: card.apCost,
      effects: card.effects.map((e) => ({ kind: e.kind, params: e.params as Record<string, unknown> })),
    }
    if (card.damageStat) cardPayload.damageStat = card.damageStat
    const extra = card as { targetKind?: string; aoeRadius?: number }
    if (extra.targetKind) cardPayload.targetKind = extra.targetKind
    if (extra.aoeRadius) cardPayload.aoeRadius = extra.aoeRadius
    dispatch({
      type: 'playCard',
      payload: {
        cardId: card.id as never,
        srcId: source.id,
        targets: [target.position],
        card: cardPayload,
      },
    }, createRng({ seed: 0, counter: 0 }))
  }
  const onCancel = (): void => {
    dispatch({ type: 'unpinTarget' }, createRng({ seed: 0, counter: 0 }))
  }

  return (
    <div
      id="forecast-panel"
      className="hud-panel absolute top-4 right-4 w-80 pointer-events-auto z-[95]"
      role="dialog"
      aria-label="Damage forecast"
    >
      <div className="hud-panel-header flex items-center justify-between px-3 py-2">
        <span className="voice-display text-amber-100 text-base">{card.name ?? card.id}</span>
        <div className="flex items-center gap-2">
          {lethal && (
            <span className="voice-display text-[0.6rem] tracking-[0.15em] px-1.5 py-0.5 rounded bg-red-950/70 text-red-200 border border-red-700/70">
              LETHAL
            </span>
          )}
          <span className="numeral text-[0.7rem] text-parchment-dim">{card.apCost} AP</span>
        </div>
      </div>

      <ForecastCombatantRow source={source} target={target} />

      <div className="px-3 py-2 flex flex-col gap-1.5">
        <ForecastHpBar
          label="HP"
          current={target.hp.current}
          max={target.hp.max}
          predictedAfter={forecast.predictedHp}
          fillColor="bg-red-700"
          lossColor="bg-red-900/50"
        />
        {target.armor > 0 && (
          <ForecastHpBar
            label="Armor"
            current={target.armor}
            max={target.armor}
            predictedAfter={forecast.predictedArmor}
            fillColor="bg-amber-600"
            lossColor="bg-amber-900/50"
          />
        )}
      </div>

      <ForecastMathRow forecast={forecast} />
      <ForecastStatusRow statuses={target.statuses} />

      <div className="px-3 py-2 flex gap-2 border-t border-[rgba(120,98,60,0.22)]">
        <button
          data-testid="forecast-confirm-btn"
          onClick={onConfirm}
          className="flex-1 px-3 py-1.5 rounded font-body font-medium text-sm tracking-wide text-amber-50 bg-amber-900/55 border border-amber-700/60 hover:bg-amber-900/75 hover:border-amber-500 transition-colors"
        >
          Confirm
        </button>
        <button
          data-testid="forecast-cancel-btn"
          onClick={onCancel}
          className="px-3 py-1.5 rounded font-body text-sm text-stone-300 bg-stone-800/60 border border-stone-600/40 hover:bg-stone-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
