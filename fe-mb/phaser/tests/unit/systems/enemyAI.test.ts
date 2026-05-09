import { describe, it, expect } from 'vitest'
import { planTurn } from '../../../src/systems/enemyAI'
import { asUnitId, asTileId, asClassId } from '../../../src/domain/ids'
import { createRng } from '../../../src/systems/rng'
import type { CombatState } from '../../../src/domain/combatState'
import type { Unit } from '../../../src/domain/unit'

const mkUnit = (id: string, classId: string, x: number, y: number, hp = 20): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId(classId), level: 1,
  hp: { current: hp, max: 20 },
  stats: { str: 4, mag: 0, skl: 3, spd: 4, def: 2, res: 1 },
  position: asTileId(`${x},${y}`),
  ap: 3, armor: 0, statuses: [],
})

const baseState = (units: Unit[]): CombatState => {
  const unitsMap: Record<string, Unit> = {}
  for (const u of units) unitsMap[u.id as unknown as string] = u
  const enemyId = units.find((u) => (u.classId as unknown as string).includes('bandit'))?.id
  return {
    phase: 'COMBAT', subPhase: 'IDLE',
    turn: { number: 1, unitId: enemyId ?? null, team: 'enemy' },
    units: unitsMap,
    decks: {}, grid: { width: 14, height: 10, obstacles: new Set() },
    rng: { seed: 0, counter: 0 }, selectedCardId: null, effectQueue: [],
  }
}

describe('enemyAI.planTurn', () => {
  it('returns endTurn when no party alive', () => {
    const enemy = mkUnit('bandit_a', 'bandit', 5, 5)
    const events = planTurn(baseState([enemy]), createRng({ seed: 0, counter: 0 }), enemy.id)
    expect(events).toEqual([{ type: 'endTurn' }])
  })

  it('attacks adjacent party unit with playCard', () => {
    const enemy = mkUnit('bandit_a', 'bandit', 5, 5)
    const party = mkUnit('roy', 'lord', 6, 5)
    const events = planTurn(baseState([enemy, party]), createRng({ seed: 0, counter: 0 }), enemy.id)
    expect(events.length).toBe(2)
    expect(events[0]!.type).toBe('playCard')
    expect(events[1]!.type).toBe('endTurn')
  })

  it('moves toward distant party unit', () => {
    const enemy = mkUnit('bandit_a', 'bandit', 12, 5)
    const party = mkUnit('roy', 'lord', 6, 5)
    const events = planTurn(baseState([enemy, party]), createRng({ seed: 0, counter: 0 }), enemy.id)
    expect(events[0]!.type).toBe('moveUnit')
    if (events[0]!.type === 'moveUnit') {
      expect(events[0]!.payload.tileId as unknown as string).toBe('11,5')
    }
  })

  it('targets lowest-HP unit on tie', () => {
    const enemy = mkUnit('bandit_a', 'bandit', 5, 5)
    const party1 = mkUnit('full', 'lord', 4, 5, 20)
    const party2 = mkUnit('weak', 'mage', 6, 5, 5)
    const events = planTurn(baseState([enemy, party1, party2]), createRng({ seed: 0, counter: 0 }), enemy.id)
    expect(events[0]!.type).toBe('playCard')
    if (events[0]!.type === 'playCard') {
      expect(events[0]!.payload.targets[0] as unknown as string).toBe('6,5')
    }
  })
})
