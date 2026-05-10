import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInitiativeQueue } from '../../../../src/ui/hooks/useInitiativeQueue'
import { useCombatStore } from '../../../../src/state/combatStore'
import { initialCombatState } from '../../../../src/systems/combatReducer'
import { asUnitId, asClassId } from '../../../../src/domain/ids'
import type { Unit } from '../../../../src/domain/unit'

const mk = (id: string, spd: number, classId = 'lord', hp = 20): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId(classId), level: 1,
  hp: { current: hp, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd, def: 3, res: 1, lck: 0 },
  position: null, ap: 3, armor: 0, statuses: [],
})

const seed = (units: Unit[], turnUnitId: string): void => {
  const recordUnits: Record<string, Unit> = {}
  for (const u of units) recordUnits[u.id as unknown as string] = u
  useCombatStore.setState({
    state: {
      ...initialCombatState(),
      phase: 'COMBAT',
      units: recordUnits,
      turn: { number: 1, unitId: asUnitId(turnUnitId), team: 'party' },
    },
    lastEffectId: 0,
  })
}

describe('useInitiativeQueue', () => {
  beforeEach(() => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
  })

  it('returns empty array in BOOT phase', () => {
    const { result } = renderHook(() => useInitiativeQueue())
    expect(result.current).toEqual([])
  })

  it('returns SPD-descending order with current actor first', () => {
    seed([mk('a', 8), mk('b', 5), mk('c', 7)], 'a')
    const { result } = renderHook(() => useInitiativeQueue())
    expect(result.current.map((e) => e.unitId as unknown as string)).toEqual(['a', 'c', 'b'])
    expect(result.current[0]!.isActive).toBe(true)
    expect(result.current[1]!.isActive).toBe(false)
  })

  it('rotates so current actor is first when not at top of SPD', () => {
    seed([mk('a', 8), mk('b', 5), mk('c', 7)], 'b')
    const { result } = renderHook(() => useInitiativeQueue())
    expect(result.current.map((e) => e.unitId as unknown as string)).toEqual(['b', 'a', 'c'])
  })

  it('filters dead units', () => {
    seed([mk('a', 8), mk('b', 5, 'lord', 0), mk('c', 7)], 'a')
    const { result } = renderHook(() => useInitiativeQueue())
    expect(result.current.map((e) => e.unitId as unknown as string)).toEqual(['a', 'c'])
  })

  it('tags enemy units with team=enemy', () => {
    seed([mk('roy', 5, 'lord'), mk('bandit_a', 5, 'bandit')], 'roy')
    const { result } = renderHook(() => useInitiativeQueue())
    const banditEntry = result.current.find((e) => (e.unitId as unknown as string) === 'bandit_a')
    expect(banditEntry?.team).toBe('enemy')
  })

  it('updates when turn changes', () => {
    seed([mk('a', 8), mk('b', 5)], 'a')
    const { result } = renderHook(() => useInitiativeQueue())
    expect((result.current[0]!.unitId as unknown as string)).toBe('a')
    act(() => {
      useCombatStore.setState((s) => ({
        ...s,
        state: { ...s.state, turn: { ...s.state.turn, unitId: asUnitId('b') } },
      }))
    })
    expect((result.current[0]!.unitId as unknown as string)).toBe('b')
  })
})
