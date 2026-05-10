import { useMemo } from 'react'
import { useCombatStore } from '../../state/combatStore'
import { buildInitiativeQueue } from '../../systems/turnOrder'
import type { UnitId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'

export interface InitiativeEntry {
  unitId: UnitId
  unit: Unit
  isActive: boolean
  team: 'party' | 'enemy'
}

const ENEMY_CLASS_FRAGMENTS = ['bandit', 'brigand', 'wolf']
function teamOf(u: Unit): 'party' | 'enemy' {
  const id = u.classId as unknown as string
  return ENEMY_CLASS_FRAGMENTS.some((s) => id.includes(s)) ? 'enemy' : 'party'
}

/**
 * Selector hook returning the current battle's turn order, rotated so the
 * active actor is first. Filters dead units; returns [] outside COMBAT.
 *
 * Pure derivation from `state.units` and `state.turn.unitId`. We subscribe
 * to those slices via stable references and useMemo the array build to
 * avoid the "getSnapshot should be cached" Zustand v5 warning.
 */
export function useInitiativeQueue(): InitiativeEntry[] {
  const phase = useCombatStore((s) => s.state.phase)
  const units = useCombatStore((s) => s.state.units)
  const turnUnitId = useCombatStore((s) => s.state.turn.unitId)

  return useMemo<InitiativeEntry[]>(() => {
    if (phase !== 'COMBAT') return []
    const alive = Object.values(units).filter((u) => u.hp.current > 0)
    if (alive.length === 0) return []
    const order = buildInitiativeQueue(alive)
    const currentIdx = turnUnitId === null
      ? 0
      : order.findIndex((id) => (id as unknown as string) === (turnUnitId as unknown as string))
    const startIdx = currentIdx === -1 ? 0 : currentIdx
    const rotated = [...order.slice(startIdx), ...order.slice(0, startIdx)]
    return rotated.map((uid, i) => {
      const u = units[uid as unknown as string]!
      return {
        unitId: uid,
        unit: u,
        isActive: i === 0 && currentIdx !== -1,
        team: teamOf(u),
      }
    })
  }, [phase, units, turnUnitId])
}
