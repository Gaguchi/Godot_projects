import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useForecastPreview } from '../../../../src/ui/hooks/useForecastPreview'
import { useCombatStore } from '../../../../src/state/combatStore'
import { initialCombatState } from '../../../../src/systems/combatReducer'
import { asUnitId, asClassId, asCardId, asTileId } from '../../../../src/domain/ids'
import type { Unit } from '../../../../src/domain/unit'

const mk = (id: string, classId = 'lord'): Unit => ({
  id: asUnitId(id),
  name: id.toUpperCase(),
  classId: asClassId(classId),
  level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 0, res: 0, lck: 0 },
  position: id === 'roy' ? ('0,0' as never) : ('1,0' as never),
  ap: 3,
  armor: 0,
  statuses: [],
})

const seed = (selectedCardId: string | null, pinnedTile: string | null): void => {
  const roy = mk('roy', 'lord')
  const bandit = mk('bandit', 'bandit')
  bandit.hp.current = 14
  useCombatStore.setState({
    state: {
      ...initialCombatState(),
      phase: 'COMBAT',
      subPhase: 'SELECTING_TARGET',
      units: { roy, bandit },
      turn: { number: 1, unitId: asUnitId('roy'), team: 'party' },
      selectedCardId: selectedCardId === null ? null : asCardId(selectedCardId),
      pinnedTargetTile: pinnedTile === null ? null : asTileId(pinnedTile),
    },
    lastEffectId: 0,
  })
}

describe('useForecastPreview', () => {
  beforeEach(() => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
  })

  it('returns null when no card selected', () => {
    seed(null, '1,0')
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).toBeNull()
  })

  it('returns null when no target pinned', () => {
    seed('lord_inspiring_strike', null)
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).toBeNull()
  })

  it('returns null when card id not in catalog', () => {
    seed('phantom_card', '1,0')
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).toBeNull()
  })

  it('returns null when pinned tile has no unit', () => {
    seed('lord_inspiring_strike', '9,9')
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).toBeNull()
  })

  it('returns ForecastPreview with card+units+forecast when valid', () => {
    seed('lord_inspiring_strike', '1,0')
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).not.toBeNull()
    const r = result.current!
    expect(r.card.id).toBe('lord_inspiring_strike')
    expect(r.source.id as unknown as string).toBe('roy')
    expect(r.target.id as unknown as string).toBe('bandit')
    // Inspiring Strike: base 4 + STR 5 - def 0/2 = 9; target hp 14 → predicted 5
    expect(r.forecast.damageBefore).toBe(9)
    expect(r.forecast.predictedHp).toBe(5)
  })
})
