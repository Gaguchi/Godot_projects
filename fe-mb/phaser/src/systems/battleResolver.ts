import type { CombatState } from '../domain/combatState'
import type { BattleResult } from '../contracts'
import type { Unit } from '../domain/unit'
import type { UnitId } from '../domain/ids'
import type { DomainEvent } from '../contracts'

export interface ResolveBattleInput {
  state: CombatState
  battleId: string
  partyIds: UnitId[]
  enemyIds: UnitId[]
  consumedTravelHop: number | null
}

function isAlive(u: Unit): boolean { return u.hp.current > 0 }

export function resolveBattle(input: ResolveBattleInput): BattleResult {
  const { state, battleId, partyIds, enemyIds, consumedTravelHop } = input

  const allUnits = state.units
  const survivors: UnitId[] = []
  const fallen: UnitId[] = []
  for (const id of partyIds) {
    const u = allUnits[id as unknown as string]
    if (!u) continue
    if (isAlive(u)) survivors.push(id); else fallen.push(id)
  }

  const enemiesAlive = enemyIds.filter(id => {
    const u = allUnits[id as unknown as string]
    return u !== undefined && isAlive(u)
  })
  const partyAlive = survivors.length > 0
  const outcome: BattleResult['outcome'] = !partyAlive ? 'defeat'
    : enemiesAlive.length === 0 ? 'victory' : 'fled'

  // Foundation: simple gold reward formula 10 + level*5 per defeated enemy.
  let goldEarned = 0
  for (const id of enemyIds) {
    const u = allUnits[id as unknown as string]
    if (u && !isAlive(u)) goldEarned += 10 + u.level * 5
  }

  // Foundation: no XP awards yet — leveling lands in next milestone.
  const xpAwards: Record<string, number> = {}
  for (const id of survivors) xpAwards[id as unknown as string] = 0

  const battleOutcomeEvent: DomainEvent = outcome === 'defeat'
    ? { type: 'BattleDefeat', payload: { battleId } }
    : { type: 'BattleVictory', payload: { battleId, survivors, capturedIds: [] } }

  const emittedEvents: DomainEvent[] = [
    battleOutcomeEvent,
    ...fallen.map<DomainEvent>(unitId => ({ type: 'UnitDied', payload: { unitId, cause: 'battle' } })),
  ]

  return {
    outcome,
    battleId,
    survivors,
    fallen,
    xpAwards,
    capturedEnemies: [],   // populated when capture event fires (next milestone)
    goldEarned,
    consumedTravelHop,
    emittedEvents,
  }
}
