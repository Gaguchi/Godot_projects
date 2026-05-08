import { describe, it, expect } from 'vitest'
import { reduce, initialCombatState } from '../../../src/systems/combatReducer'
import { asUnitId, asClassId, asStatusEffectId } from '../../../src/domain/ids'
import { createRng } from '../../../src/systems/rng'
import type { Unit, ActiveStatus } from '../../../src/domain/unit'

const mk = (id: string, spd: number, classId = 'lord'): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId(classId), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd, def: 3, res: 1 },
  hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
})

describe('combatReducer (core)', () => {
  it('initialCombatState is BOOT phase', () => {
    expect(initialCombatState().phase).toBe('BOOT')
  })

  it('startBattle transitions to COMBAT and seeds the first turn', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const r = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [mk('roy', 5, 'lord'), mk('bandit', 4, 'bandit')],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 1, counter: 0 },
      },
    }, rng)
    expect(r.state.phase).toBe('COMBAT')
    expect(r.state.turn.unitId).toBe(asUnitId('roy'))
    expect(r.state.turn.team).toBe('party')
  })

  it('endTurn advances to next unit in initiative order', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('a', 8, 'lord'), mk('b', 5, 'bandit')], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    expect(s.turn.unitId).toBe(asUnitId('b'))
  })

  it('endTurn after last unit increments turn number and wraps', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('a', 8, 'lord'), mk('b', 5, 'bandit')], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    expect(s.turn.number).toBe(2)
    expect(s.turn.unitId).toBe(asUnitId('a'))
  })

  it('tickStatus: poison emits Damage effect at turn end', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const u = mk('e', 5, 'bandit')
    const poisonStatus: ActiveStatus = {
      effectId: asStatusEffectId('poison'),
      stacks: 3, turnsRemaining: 2, source: null,
    }
    u.statuses = [poisonStatus]
    const s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [u], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    const r = reduce(s, { type: 'tickStatus' }, rng)
    const damageEffect = r.effects.find(e => e.kind === 'ApplyCardEffect' && e.effect.kind === 'Damage')
    expect(damageEffect).toBeDefined()
  })

  it('victory: when all enemies dead, phase = VICTORY at turn end', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const enemy = mk('bandit', 4, 'bandit')
    enemy.hp.current = 0
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('roy', 5, 'lord'), enemy], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    expect(s.phase).toBe('VICTORY')
  })

  it('defeat: when all party dead, phase = DEFEAT at turn end', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const ally = mk('roy', 5, 'lord')
    ally.hp.current = 0
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [ally, mk('bandit', 4, 'bandit')], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    expect(s.phase).toBe('DEFEAT')
  })

  it('selectCard transitions sub-phase to SELECTING_TARGET', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('roy', 5, 'lord')], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'selectCard', payload: { cardId: 'slash' as never } }, rng).state
    expect(s.subPhase).toBe('SELECTING_TARGET')
    expect(s.selectedCardId).toBe('slash')
  })

  it('cancelSelection returns to IDLE', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('roy', 5, 'lord')], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'selectCard', payload: { cardId: 'slash' as never } }, rng).state
    s = reduce(s, { type: 'cancelSelection' }, rng).state
    expect(s.subPhase).toBe('IDLE')
    expect(s.selectedCardId).toBeNull()
  })
})
