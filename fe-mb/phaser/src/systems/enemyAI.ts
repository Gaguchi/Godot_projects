import type { CombatState, CombatEvent } from '../domain/combatState'
import type { RNG } from '../domain/rng'
import type { UnitId } from '../domain/ids'
import { asCardId, asTileId } from '../domain/ids'

const tileXY = (t: string): [number, number] => {
  const [xs, ys] = t.split(',')
  return [parseInt(xs!, 10), parseInt(ys!, 10)]
}

const manhattan = (a: string, b: string): number => {
  const [ax, ay] = tileXY(a)
  const [bx, by] = tileXY(b)
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

/**
 * Plans an enemy unit's full turn worth of events.
 *
 * Strategy:
 *   1. Find closest alive party unit (manhattan distance; ties broken by lowest HP).
 *   2. If adjacent: attack with `bandit_swing` (1 AP, 4 base damage).
 *   3. Otherwise: move one step toward the target.
 *   4. End turn.
 *
 * Real AI (line-of-sight, multi-step move, card selection, etc.) lands in later milestones.
 */
export function planTurn(state: CombatState, _rng: RNG, enemyId: UnitId): CombatEvent[] {
  const events: CombatEvent[] = []
  const enemyKey = enemyId as unknown as string
  const enemy = state.units[enemyKey]
  if (!enemy || !enemy.position || enemy.hp.current <= 0) {
    return [{ type: 'endTurn' as const }]
  }

  const enemyPos = enemy.position as unknown as string

  // Find party units (non-enemies, alive, with positions)
  const partyAlive = Object.values(state.units).filter((u) => {
    if (u.hp.current <= 0 || !u.position) return false
    return !(u.classId as unknown as string).includes('bandit')
  })

  if (partyAlive.length === 0) return [{ type: 'endTurn' as const }]

  // Pick closest, tie-break on lowest HP
  let target = partyAlive[0]!
  let bestDist = manhattan(enemyPos, target.position as unknown as string)
  for (const u of partyAlive.slice(1)) {
    const d = manhattan(enemyPos, u.position as unknown as string)
    if (d < bestDist || (d === bestDist && u.hp.current < target.hp.current)) {
      target = u
      bestDist = d
    }
  }
  const targetPos = target.position as unknown as string

  if (bestDist <= 1) {
    // In melee range — attack
    events.push({
      type: 'playCard',
      payload: {
        cardId: asCardId('bandit_swing'),
        srcId: enemyId,
        targets: [target.position!],
        card: {
          apCost: 1,
          damageStat: 'str',
          effects: [{ kind: 'Damage', params: { base: 4 } }],
        },
      },
    })
  } else {
    // Move one step toward target
    const [ex, ey] = tileXY(enemyPos)
    const [tx, ty] = tileXY(targetPos)
    let nx = ex
    let ny = ey
    if (tx < ex) nx--
    else if (tx > ex) nx++
    else if (ty < ey) ny--
    else if (ty > ey) ny++

    // Don't step onto an occupied tile
    const candidate = `${nx},${ny}`
    const occupied = Object.values(state.units).some(
      (u) => u.hp.current > 0 && u.position && (u.position as unknown as string) === candidate,
    )
    if (!occupied) {
      events.push({
        type: 'moveUnit',
        payload: { unitId: enemyId, tileId: asTileId(candidate) },
      })
    }
  }

  events.push({ type: 'endTurn' as const })
  return events
}
