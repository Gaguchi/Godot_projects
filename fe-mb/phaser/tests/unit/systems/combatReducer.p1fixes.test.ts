import { describe, it, expect } from 'vitest'
import { reduce } from '../../../src/systems/combatReducer'
import { createRng } from '../../../src/systems/rng'
import { planTurn } from '../../../src/systems/enemyAI'
import { seedDungeonBattle } from '../../../src/game/scenes/seedDungeonBattle'
import { buildUnit } from '../../../src/systems/buildUnit'
import type { CombatState } from '../../../src/domain/combatState'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asTileId, asCardId } from '../../../src/domain/ids'

const rng = () => createRng({ seed: 7, counter: 0 })

function unit(id: string, classId: string, team: 'party' | 'enemy', pos: string, hp = 20): Unit {
  return {
    id: asUnitId(id), name: id, classId: classId as never, team, level: 1,
    hp: { current: hp, max: hp },
    stats: { str: 5, mag: 3, skl: 3, spd: 4, def: 2, res: 1, lck: 1 },
    position: asTileId(pos), ap: 3, armor: 0, statuses: [],
  }
}

function battle(units: Unit[], activeId: string): CombatState {
  const u: Record<string, Unit> = {}
  for (const x of units) u[x.id as unknown as string] = x
  return {
    phase: 'COMBAT', subPhase: 'IDLE',
    turn: { number: 1, unitId: asUnitId(activeId), team: 'party' },
    units: u, decks: {},
    grid: { width: 14, height: 10, obstacles: new Set() },
    rng: { seed: 7, counter: 0 },
    selectedCardId: null, pinnedTargetTile: null, effectQueue: [], battleTag: null,
  }
}

const strike = { apCost: 1, damageStat: 'str' as const, targetKind: 'enemy' as const, effects: [{ kind: 'Damage', params: { base: 6 } }] }

describe('P1 fix: a corpse cannot shield the living unit standing on it', () => {
  it('damages the LIVING unit at a tile shared with a dead one', () => {
    const dead = { ...unit('dead_bandit', 'bandit', 'enemy', '3,4'), hp: { current: 0, max: 18 } }
    const alive = unit('live_bandit', 'bandit', 'enemy', '3,4', 18)
    const roy = unit('roy', 'lord', 'party', '2,4')
    // Insertion order matters for the old bug: the corpse is found first.
    const s = battle([dead, alive, roy], 'roy')
    const r = reduce(s, {
      type: 'playCard',
      payload: { cardId: asCardId('jab'), srcId: asUnitId('roy'), targets: [asTileId('3,4')], card: strike },
    }, rng())
    expect(r.state.units['live_bandit']!.hp.current).toBeLessThan(18)
    expect(r.state.units['dead_bandit']!.hp.current).toBe(0)
  })
})

describe('P1 fix: fresh self-buffs survive the enemy phase', () => {
  it('a 1-turn taunt played on your own turn is still active after your endTurn', () => {
    const marcus = unit('marcus', 'knight', 'party', '2,4')
    const bandit = unit('bandit_a', 'bandit', 'enemy', '9,4')
    const s = battle([marcus, bandit], 'marcus')
    const buffed = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: asCardId('knight_taunt'), srcId: asUnitId('marcus'), targets: [asTileId('2,4')],
        card: { apCost: 1, targetKind: 'self', effects: [{ kind: 'ApplyStatus', params: { effectId: 'taunt', value: 1, turns: 1 } }] },
      },
    }, rng())
    const st = buffed.state.units['marcus']!.statuses.find(x => (x.effectId as unknown as string) === 'taunt')
    expect(st?.fresh).toBe(true)

    // End Marcus's turn — the old code decremented here and the buff died
    // before a single enemy ever acted.
    const afterEnd = reduce(buffed.state, { type: 'endTurn' }, rng())
    const still = afterEnd.state.units['marcus']!.statuses.find(x => (x.effectId as unknown as string) === 'taunt')
    expect(still).toBeDefined()
    expect(still!.turnsRemaining).toBe(1)
    expect(still!.fresh).toBeUndefined()

    // The enemy acts; when MARCUS's next turn ends, the buff expires normally.
    const enemyDone = reduce(afterEnd.state, { type: 'endTurn' }, rng())
    const expired = reduce(enemyDone.state, { type: 'endTurn' }, rng())
    // one of those two endTurns was marcus's — after his own tick it is gone
    const gone = expired.state.units['marcus']!.statuses.find(x => (x.effectId as unknown as string) === 'taunt')
    expect(gone).toBeUndefined()
  })

  it('poison inflicted by an opponent still ticks on the victim (not fresh)', () => {
    const roy = unit('roy', 'lord', 'party', '2,4')
    const bandit = unit('bandit_a', 'bandit', 'enemy', '3,4')
    const s = { ...battle([roy, bandit], 'bandit_a'), turn: { number: 1, unitId: asUnitId('bandit_a'), team: 'enemy' as const } }
    const poisoned = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: asCardId('venom'), srcId: asUnitId('bandit_a'), targets: [asTileId('2,4')],
        card: { apCost: 1, targetKind: 'enemy', effects: [{ kind: 'ApplyStatus', params: { effectId: 'poison', value: 2, turns: 2 } }] },
      },
    }, rng())
    const st = poisoned.state.units['roy']!.statuses.find(x => (x.effectId as unknown as string) === 'poison')
    expect(st).toBeDefined()
    expect(st!.fresh).toBeUndefined() // applied OUTSIDE roy's turn — ticks normally
  })
})

describe('P2 fix: DrawCards honours gainAp', () => {
  it('Focus refunds the AP its text promises', () => {
    const lilina = unit('lilina', 'mage', 'party', '2,4')
    const s = battle([lilina, unit('bandit_a', 'bandit', 'enemy', '9,4')], 'lilina')
    s.decks['lilina'] = { draw: [asCardId('a'), asCardId('b')], hand: [asCardId('mage_focus')], discard: [] }
    const r = reduce(s, {
      type: 'playCard',
      payload: {
        cardId: asCardId('mage_focus'), srcId: asUnitId('lilina'), targets: [asTileId('2,4')],
        card: { apCost: 1, targetKind: 'self', effects: [{ kind: 'DrawCards', params: { count: 1, gainAp: 1 } }] },
      },
    }, rng())
    expect(r.state.units['lilina']!.ap).toBe(3) // 3 − 1 cost + 1 refund
    expect(r.state.decks['lilina']!.hand).toHaveLength(1) // focus left, one drawn
  })
})

describe('P2 fix: moveUnit validates the board', () => {
  it('rejects occupied and out-of-bounds tiles, allows a legal one', () => {
    const roy = unit('roy', 'lord', 'party', '2,4')
    const marcus = unit('marcus', 'knight', 'party', '2,5')
    const s = battle([roy, marcus, unit('bandit_a', 'bandit', 'enemy', '9,4')], 'roy')

    const ontoAlly = reduce(s, { type: 'moveUnit', payload: { unitId: asUnitId('roy'), tileId: asTileId('2,5') } }, rng())
    expect(ontoAlly.state.units['roy']!.position).toBe('2,4')
    expect(ontoAlly.state.units['roy']!.hasMovedThisTurn).toBeFalsy()

    const offBoard = reduce(s, { type: 'moveUnit', payload: { unitId: asUnitId('roy'), tileId: asTileId('99,4') } }, rng())
    expect(offBoard.state.units['roy']!.position).toBe('2,4')

    const legal = reduce(s, { type: 'moveUnit', payload: { unitId: asUnitId('roy'), tileId: asTileId('3,4') } }, rng())
    expect(legal.state.units['roy']!.position).toBe('3,4')
  })
})

describe('P1 fix: melee AI sidesteps a body-blocked approach', () => {
  it('still closes distance when the direct axis tile is occupied', () => {
    // bandit at 3,4 wants lilina at 1,4 (lowest HP); roy stands on 2,4 —
    // the ONLY distance-reducing tile. Old stepToward: null → stall forever.
    const lilina = { ...unit('lilina', 'mage', 'party', '1,4'), hp: { current: 5, max: 22 } }
    const roy = unit('roy', 'lord', 'party', '2,4')
    const bandit = unit('bandit_a', 'bandit', 'enemy', '3,4')
    const s = { ...battle([lilina, roy, bandit], 'bandit_a'), turn: { number: 1, unitId: asUnitId('bandit_a'), team: 'enemy' as const } }
    const events = planTurn(s, rng(), asUnitId('bandit_a'))
    // The enemy must DO something besides endTurn: either sidestep-move, or
    // attack roy who is adjacent (both beat the old permanent stall).
    expect(events.length).toBeGreaterThan(1)
  })
})

describe('P1 fix: dungeon battles place the party on the board', () => {
  it('every seeded party unit has a position', () => {
    const party = [
      buildUnit('lord', 1, 'Roy', 'roy'),
      buildUnit('knight', 1, 'Marcus', 'marcus'),
    ].filter((u): u is Unit => u !== null)
    // Run-store units outside combat have position null — the exact shape
    // that used to reach startBattle unpositioned and soft-lock the room.
    for (const u of party) (u as { position: unknown }).position = null
    const ev = seedDungeonBattle('smugglers_cave', 'combat', { seed: 3, counter: 0 }, party)
    const partyUnits = ev.payload.units.filter(u => u.team === 'party')
    expect(partyUnits.length).toBe(2)
    for (const u of partyUnits) {
      expect(u.position).not.toBeNull()
      const [x] = (u.position as unknown as string).split(',').map(Number)
      expect(x).toBeLessThan(5) // left-column slots
    }
  })
})
