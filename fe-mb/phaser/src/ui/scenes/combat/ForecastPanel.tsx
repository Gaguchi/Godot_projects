import React from 'react'
import { Button } from '../../components/Button'
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
      // The combat RNG, not a fresh seed-0 stream: this panel was the one
      // dispatch site off the deterministic chain, so any panel-confirmed
      // card broke replay reproducibility.
    }, createRng(useCombatStore.getState().state.rng))
  }
  const onCancel = (): void => {
    dispatch({ type: 'unpinTarget' }, createRng(useCombatStore.getState().state.rng))
  }

  return (
    <div
      id="forecast-panel"
      className="hud-panel absolute top-14 right-4 w-80 pointer-events-auto z-[95]"
      role="dialog"
      aria-label="Damage forecast"
    >
      <div className="hud-panel-header flex items-center justify-between px-3 py-2">
        <span className="voice-display text-parchment text-base">{card.name ?? card.id}</span>
        <div className="flex items-center gap-2">
          {lethal && (
            <span
              className="voice-display text-[0.6rem] tracking-[0.15em] px-1.5 py-0.5 rounded-[3px] text-[color:var(--hp-crit-text)]"
              style={{
                background: 'color-mix(in oklab, var(--color-ember) 22%, transparent)',
                border: '1px solid color-mix(in oklab, var(--color-ember) 65%, transparent)',
              }}
            >
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
          fillColor="bg-[color:var(--hp-crit)]"
          lossColor="bg-[color:color-mix(in_oklab,var(--color-ember)_38%,transparent)]"
        />
        {target.armor > 0 && (
          <ForecastHpBar
            label="Armor"
            current={target.armor}
            max={target.armor}
            predictedAfter={forecast.predictedArmor}
            fillColor="bg-[color:var(--color-hearth-soft)]"
            lossColor="bg-[color:color-mix(in_oklab,var(--color-hearth-soft)_35%,transparent)]"
          />
        )}
      </div>

      <ForecastMathRow forecast={forecast} />
      <ForecastStatusRow statuses={target.statuses} />

      {/* Commit gate — while the forecast is open, Confirm is THE hearth focus
          of the screen (the ModeLabel strip hides itself when a target pins). */}
      <div className="relative px-3 py-2.5 flex gap-2 border-t border-[rgba(120,98,60,0.22)]">
        <div aria-hidden className="hearth-glow pointer-events-none absolute inset-x-0 -inset-y-5" />
        <Button
          variant="primary"
          data-testid="forecast-confirm-btn"
          onPress={onConfirm}
          className="relative flex-1 !px-3 !py-1.5 !text-[0.75rem]"
        >
          Confirm
        </Button>
        <Button
          variant="ghost"
          data-testid="forecast-cancel-btn"
          onPress={onCancel}
          className="relative !px-3 !py-1.5 !text-[0.75rem]"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
