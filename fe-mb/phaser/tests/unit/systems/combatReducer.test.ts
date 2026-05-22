import { describe, it, expect } from 'vitest'
import { reduce, initialCombatState } from '../../../src/systems/combatReducer'
import { asUnitId, asClassId, asStatusEffectId } from '../../../src/domain/ids'
import { createRng } from '../../../src/systems/rng'
import type { Unit, ActiveStatus } from '../../../src/domain/unit'

const mk = (id: string, spd: number, classId = 'lord'): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId(classId), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd, def: 3, res: 1, lck: 0 },
  position: null, ap: 3, armor: 0, statuses: [],
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

  it('playCard with damage applies HP loss + AP cost + discards card', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const roy = mk('roy', 5, 'lord')
    roy.position = '1,4' as never
    roy.stats.str = 5
    const bandit = mk('bandit_a', 4, 'bandit')
    bandit.position = '2,4' as never
    bandit.hp.max = 20
    bandit.hp.current = 20
    bandit.stats.def = 4

    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [roy, bandit],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 0, counter: 0 },
        decks: {
          roy: { draw: [], hand: ['slash' as never], discard: [] },
          bandit_a: { draw: [], hand: [], discard: [] },
        },
      },
    }, rng).state

    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: 'slash' as never,
        srcId: roy.id,
        targets: ['2,4' as never],
        card: {
          apCost: 1,
          damageStat: 'str',
          effects: [{ kind: 'Damage', params: { base: 4 } }],
        },
      },
    }, rng)

    // Damage = base 4 + str 5 - floor(def 4 / 2) = 7
    const updatedBandit = r.state.units['bandit_a']!
    expect(updatedBandit.hp.current).toBe(13)

    // Roy AP decremented from 3 → 2
    const updatedRoy = r.state.units['roy']!
    expect(updatedRoy.ap).toBe(2)

    // Card moved hand → discard
    const royDeck = r.state.decks['roy']!
    expect(royDeck.hand).not.toContain('slash')
    expect(royDeck.discard).toContain('slash')

    // Effects emitted: FloatDamage, HitFlash, PlayTween, WaitForAnimations
    const kinds = r.effects.map(e => e.kind).sort()
    expect(kinds).toContain('FloatDamage')
    expect(kinds).toContain('HitFlash')
    expect(kinds).toContain('PlayTween')
    expect(kinds).toContain('WaitForAnimations')

    // subPhase transitioned to RESOLVING
    expect(r.state.subPhase).toBe('RESOLVING')
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

  it('playCard with physical damage: armor absorbs first, overflow to HP', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const roy = mk('roy', 5, 'lord')
    roy.position = '1,4' as never
    roy.stats.str = 5
    const bandit = mk('bandit_a', 4, 'bandit')
    bandit.position = '2,4' as never
    bandit.hp.max = 20
    bandit.hp.current = 20
    bandit.stats.def = 4
    bandit.armor = 3

    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [roy, bandit],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 0, counter: 0 },
        decks: {
          roy: { draw: [], hand: ['slash' as never], discard: [] },
          bandit_a: { draw: [], hand: [], discard: [] },
        },
      },
    }, rng).state

    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: 'slash' as never,
        srcId: roy.id,
        targets: ['2,4' as never],
        card: {
          apCost: 1,
          damageStat: 'str',
          effects: [{ kind: 'Damage', params: { base: 4 } }],
        },
      },
    }, rng)

    // raw = 4 + 5 - floor(4/2) = 7; armor 3 absorbs 3, hp loses 4
    const updated = r.state.units['bandit_a']!
    expect(updated.armor).toBe(0)
    expect(updated.hp.current).toBe(16)
  })

  it('playCard with magic damage: armor takes half (with overflow), hp takes half', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const roy = mk('roy', 5, 'lord')
    roy.position = '1,4' as never
    roy.stats.mag = 6
    const bandit = mk('bandit_a', 4, 'bandit')
    bandit.position = '2,4' as never
    bandit.hp.max = 20
    bandit.hp.current = 20
    bandit.stats.res = 4
    bandit.armor = 2

    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [roy, bandit],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 0, counter: 0 },
        decks: {
          roy: { draw: [], hand: ['fireball' as never], discard: [] },
          bandit_a: { draw: [], hand: [], discard: [] },
        },
      },
    }, rng).state

    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: 'fireball' as never,
        srcId: roy.id,
        targets: ['2,4' as never],
        card: {
          apCost: 1,
          damageStat: 'mag',
          effects: [{ kind: 'Damage', params: { base: 4, damageType: 'magic' } }],
        },
      },
    }, rng)

    // raw = 4 + 6 - floor(4/2) = 8; magic: 4 to armor (2 absorbed, 2 overflow), 4 always to hp → hp -= 6
    const updated = r.state.units['bandit_a']!
    expect(updated.armor).toBe(0)
    expect(updated.hp.current).toBe(14)
  })

  it('playCard with no armor: behavior matches pre-fix damage (regression)', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const roy = mk('roy', 5, 'lord')
    roy.position = '1,4' as never
    roy.stats.str = 5
    const bandit = mk('bandit_a', 4, 'bandit')
    bandit.position = '2,4' as never
    bandit.hp.max = 20
    bandit.hp.current = 20
    bandit.stats.def = 4
    // armor=0 (from mk default)

    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [roy, bandit],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 0, counter: 0 },
        decks: {
          roy: { draw: [], hand: ['slash' as never], discard: [] },
          bandit_a: { draw: [], hand: [], discard: [] },
        },
      },
    }, rng).state

    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: 'slash' as never,
        srcId: roy.id,
        targets: ['2,4' as never],
        card: {
          apCost: 1,
          damageStat: 'str',
          effects: [{ kind: 'Damage', params: { base: 4 } }],
        },
      },
    }, rng)

    // Pre-fix expectation: 7 damage to HP; armor stays 0
    const updated = r.state.units['bandit_a']!
    expect(updated.hp.current).toBe(13)
    expect(updated.armor).toBe(0)
  })
})

describe('combatReducer (movement)', () => {
  const setupForMove = (): { state: ReturnType<typeof initialCombatState>; rng: ReturnType<typeof createRng> } => {
    const rng = createRng({ seed: 0, counter: 0 })
    const roy = mk('roy', 5, 'lord')
    roy.position = '1,4' as never
    const r = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [roy, mk('bandit', 4, 'bandit')],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 0, counter: 0 },
      },
    }, rng)
    return { state: r.state, rng }
  }

  it('enterMoveMode transitions subPhase to SELECTING_MOVE', () => {
    const { state, rng } = setupForMove()
    const r = reduce(state, { type: 'enterMoveMode', payload: { unitId: asUnitId('roy') } }, rng)
    expect(r.state.subPhase).toBe('SELECTING_MOVE')
  })

  it('moveUnit with hasMovedThisTurn=false moves unit and marks moved without AP cost', () => {
    const { state, rng } = setupForMove()
    const apBefore = state.units['roy']!.ap
    const r = reduce(state, {
      type: 'moveUnit',
      payload: { unitId: asUnitId('roy'), tileId: '3,4' as never },
    }, rng)
    const royAfter = r.state.units['roy']!
    expect(royAfter.position).toBe('3,4')
    expect(royAfter.hasMovedThisTurn).toBe(true)
    expect(royAfter.ap).toBe(apBefore) // AP unchanged
    expect(r.state.subPhase).toBe('RESOLVING')
  })

  it('moveUnit when hasMovedThisTurn=true is a no-op', () => {
    const { state, rng } = setupForMove()
    let s = reduce(state, {
      type: 'moveUnit',
      payload: { unitId: asUnitId('roy'), tileId: '3,4' as never },
    }, rng).state
    s = reduce(s, { type: 'animationsCompleted' }, rng).state
    const positionAfterFirst = s.units['roy']!.position
    // Second move should not change position
    const r = reduce(s, {
      type: 'moveUnit',
      payload: { unitId: asUnitId('roy'), tileId: '5,4' as never },
    }, rng)
    expect(r.state.units['roy']!.position).toBe(positionAfterFirst)
    expect(r.effects).toEqual([])
  })

  it('endTurn resets hasMovedThisTurn for the next active unit', () => {
    const { state, rng } = setupForMove()
    let s = reduce(state, {
      type: 'moveUnit',
      payload: { unitId: asUnitId('roy'), tileId: '3,4' as never },
    }, rng).state
    s = reduce(s, { type: 'animationsCompleted' }, rng).state
    expect(s.units['roy']!.hasMovedThisTurn).toBe(true)
    s = reduce(s, { type: 'endTurn' }, rng).state // → bandit
    s = reduce(s, { type: 'endTurn' }, rng).state // → roy again
    expect(s.units['roy']!.hasMovedThisTurn).toBe(false)
  })

  it('cancelSelection from SELECTING_MOVE returns to IDLE', () => {
    const { state, rng } = setupForMove()
    let s = reduce(state, { type: 'enterMoveMode', payload: { unitId: asUnitId('roy') } }, rng).state
    s = reduce(s, { type: 'cancelSelection' }, rng).state
    expect(s.subPhase).toBe('IDLE')
  })
})
