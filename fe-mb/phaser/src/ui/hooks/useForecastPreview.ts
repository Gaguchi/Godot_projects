import { useMemo } from 'react'
import { useCombatStore } from '../../state/combatStore'
import { computeForecast, type ForecastCard, type ForecastResult } from '../../systems/damage'
import type { Unit } from '../../domain/unit'
import cardsJson from '../../data/content/cards.json'

const cardsMap = new Map<string, ForecastCard>(
  (cardsJson as ForecastCard[]).map((c) => [c.id, c]),
)

export interface ForecastPreview {
  card: ForecastCard
  source: Unit
  target: Unit
  forecast: ForecastResult
}

/**
 * Returns the active forecast (card × source × target) when the player has
 * both a card selected AND a target tile pinned, OR null otherwise.
 *
 * Pattern matches useInitiativeQueue: subscribe to slice references (stable),
 * useMemo the derived object so React sees reference-equal results between
 * unchanged ticks (prevents the "Maximum update depth" infinite-render loop
 * we hit with a single-selector object construction).
 *
 * Terrain DR is 0 for now — wire when terrain types land in BoardScene.
 */
export function useForecastPreview(): ForecastPreview | null {
  const selectedCardId = useCombatStore((s) => s.state.selectedCardId)
  const pinnedTile = useCombatStore((s) => s.state.pinnedTargetTile)
  const units = useCombatStore((s) => s.state.units)
  const turnUnitId = useCombatStore((s) => s.state.turn.unitId)

  return useMemo<ForecastPreview | null>(() => {
    if (selectedCardId === null || pinnedTile === null) return null
    const card = cardsMap.get(selectedCardId as unknown as string)
    if (!card) return null
    if (turnUnitId === null) return null
    const source = units[turnUnitId as unknown as string]
    if (!source) return null
    const tileStr = pinnedTile as unknown as string
    const target = Object.values(units).find(
      (u) => (u.position as unknown as string) === tileStr,
    )
    if (!target) return null
    const forecast = computeForecast(card, source, target, 0)
    if (!forecast) return null
    return { card, source, target, forecast }
  }, [selectedCardId, pinnedTile, units, turnUnitId])
}
