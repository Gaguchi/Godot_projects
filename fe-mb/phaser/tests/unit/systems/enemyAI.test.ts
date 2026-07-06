import { describe, it, expect } from 'vitest'
import { planTurn } from '../../../src/systems/enemyAI'
import { asUnitId, asTileId, asClassId } from '../../../src/domain/ids'
import { createRng } from '../../../src/systems/rng'
import type { CombatState } from '../../../src/domain/combatState'
import type { Unit } from '../../../src/domain/unit'

const mkUnit = (id: string, classId: string, x: number, y: number, hp = 20): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId(classId), level: 1,
  hp: { current: hp, max: 20 },
  stats: { str: 4, mag: 0, skl: 3, spd: 4, def: 2, res: 1, lck: 0 },
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
    rng: { seed: 0, counter: 0 }, selectedCardId: null, pinnedTargetTile: null, effectQueue: [], battleTag: null,
  }
}

describe('enemyAI.planTurn (rusher)', () => {
  it('returns endTurn when no party alive', () => {
    const enemy = mkUnit('bandit_a', 'bandit', 5, 5)
    const events = planTurn(baseState([enemy]), createRng({ seed: 0, counter: 0 }), enemy.id)
    expect(events).toEqual([{ type: 'endTurn' }])
  })

  it('attacks adjacent party unit with playCard', () => {
    const enemy = mkUnit('bandit_a', 'bandit', 5, 5)
    const party = mkUnit('roy', 'lord', 6, 5)
    const events = planTurn(baseState([enemy, party]), createRng({ seed: 0, counter: 0 }), enemy.id)
    expect(events[events.length - 1]!.type).toBe('endTurn')
    expect(events.some((e) => e.type === 'playCard')).toBe(true)
  })

  it('rusher moves toward distant party unit (single moveUnit with final tile)', () => {
    // Distance 12->6 = 6 tiles. Movement = 4. Final destination should be
    // 4 tiles closer to target = x=8 (since target is at x=6 +1 for adjacent)
    const enemy = mkUnit('bandit_a', 'bandit', 12, 5)
    const party = mkUnit('roy', 'lord', 6, 5)
    const events = planTurn(baseState([enemy, party]), createRng({ seed: 0, counter: 0 }), enemy.id)
    const moves = events.filter((e) => e.type === 'moveUnit')
    expect(moves.length).toBe(1) // single move event with final destination
    if (moves[0]!.type === 'moveUnit') {
      const finalTile = moves[0]!.payload.tileId as unknown as string
      const [x] = finalTile.split(',').map(Number)
      // Should have moved 4 tiles toward target
      expect(x).toBeLessThan(12)
      expect(x).toBeGreaterThanOrEqual(7)
    }
  })

  it('targets lowest-HP party unit', () => {
    const enemy = mkUnit('bandit_a', 'bandit', 5, 5)
    const fullHp = mkUnit('full', 'lord', 4, 5, 20)
    const weakHp = mkUnit('weak', 'mage', 6, 5, 5)
    const events = planTurn(baseState([enemy, fullHp, weakHp]), createRng({ seed: 0, counter: 0 }), enemy.id)
    const playCard = events.find((e) => e.type === 'playCard')
    expect(playCard).toBeDefined()
    if (playCard?.type === 'playCard') {
      expect(playCard.payload.targets[0] as unknown as string).toBe('6,5')
    }
  })
})

describe('enemyAI.planTurn (archer)', () => {
  it('archer keeps preferred range (2-3 tiles) from target', () => {
    // Archer at distance 5, party at (5,5)
    const archer = mkUnit('arch_a', 'bandit_archer', 10, 5)
    const party = mkUnit('roy', 'lord', 5, 5)
    const events = planTurn(baseState([archer, party]), createRng({ seed: 0, counter: 0 }), archer.id)
    // Final position after moves: distance to (5,5) should be in [2, 3]
    const moves = events.filter((e) => e.type === 'moveUnit')
    let pos: [number, number] = [10, 5]
    for (const m of moves) {
      if (m.type === 'moveUnit') {
        const [x, y] = (m.payload.tileId as unknown as string).split(',').map(Number)
        pos = [x!, y!]
      }
    }
    const distAfterMove = Math.abs(pos[0] - 5) + Math.abs(pos[1] - 5)
    expect(distAfterMove).toBeGreaterThanOrEqual(2)
    expect(distAfterMove).toBeLessThanOrEqual(4)
  })

  it('archer fires from range with playCard', () => {
    const archer = mkUnit('arch_a', 'bandit_archer', 7, 5)
    const party = mkUnit('roy', 'lord', 5, 5)
    const events = planTurn(baseState([archer, party]), createRng({ seed: 0, counter: 0 }), archer.id)
    const play = events.find((e) => e.type === 'playCard')
    expect(play).toBeDefined()
  })
})

describe('enemyAI.planTurn (healer)', () => {
  it('healer prioritizes wounded ally over attacking party', () => {
    const healer = mkUnit('priest', 'bandit_priest', 8, 5)
    const woundedAlly = mkUnit('bandit_b', 'bandit', 7, 5, 5)   // wounded (5/20)
    const party = mkUnit('roy', 'lord', 4, 5)
    const events = planTurn(baseState([healer, woundedAlly, party]), createRng({ seed: 0, counter: 0 }), healer.id)
    const play = events.find((e) => e.type === 'playCard')
    expect(play).toBeDefined()
    // Heal target should be the wounded ally, not the party unit
    if (play?.type === 'playCard') {
      expect(play.payload.targets[0] as unknown as string).toBe('7,5')
    }
  })

  it('healer with no wounded ally falls back to cursing party', () => {
    const healer = mkUnit('priest', 'bandit_priest', 8, 5)
    const fullAlly = mkUnit('bandit_b', 'bandit', 7, 5, 20)    // full HP
    const party = mkUnit('roy', 'lord', 6, 5)
    const events = planTurn(baseState([healer, fullAlly, party]), createRng({ seed: 0, counter: 0 }), healer.id)
    const play = events.find((e) => e.type === 'playCard')
    expect(play).toBeDefined()
    if (play?.type === 'playCard') {
      expect(play.payload.targets[0] as unknown as string).toBe('6,5')
    }
  })
})
