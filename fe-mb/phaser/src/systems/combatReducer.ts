import type { CombatState, CombatEvent, CombatEffect } from '../domain/combatState'
import type { Unit } from '../domain/unit'
import type { UnitId } from '../domain/ids'
import type { RNG } from '../domain/rng'
import { buildInitiativeQueue } from './turnOrder'
import { getStatusEffect } from './statusEffects'

interface UnitTeam { partyIds: UnitId[]; enemyIds: UnitId[] }

export interface ReduceResult {
  state: CombatState
  effects: CombatEffect[]
}

export function initialCombatState(): CombatState {
  return {
    phase: 'BOOT',
    subPhase: 'IDLE',
    turn: { number: 0, unitId: null, team: 'party' },
    units: {},
    decks: {},
    grid: { width: 14, height: 10, obstacles: new Set() },
    rng: { seed: 0, counter: 0 },
    selectedCardId: null,
    effectQueue: [],
  }
}

function teamsOf(units: Record<string, Unit>): UnitTeam {
  // Convention for foundation: classId containing 'bandit' marks an enemy.
  // (mage_bandit and similar enemy variants will still match.) Pure 'mage'
  // is a player class — see classes.json. Real battles will set team
  // explicitly via Unit metadata; tracked as future refactor.
  const partyIds: UnitId[] = []
  const enemyIds: UnitId[] = []
  for (const u of Object.values(units)) {
    const cid = u.classId as unknown as string
    if (cid.includes('bandit')) enemyIds.push(u.id)
    else partyIds.push(u.id)
  }
  return { partyIds, enemyIds }
}

function isAlive(u: Unit): boolean { return u.hp.current > 0 }

function checkEnd(state: CombatState): CombatState['phase'] {
  const { partyIds, enemyIds } = teamsOf(state.units)
  const partyAlive = partyIds.some(id => {
    const u = state.units[id as unknown as string]
    return u !== undefined && isAlive(u)
  })
  const enemiesAlive = enemyIds.some(id => {
    const u = state.units[id as unknown as string]
    return u !== undefined && isAlive(u)
  })
  if (!partyAlive) return 'DEFEAT'
  if (!enemiesAlive) return 'VICTORY'
  return 'COMBAT'
}

export function reduce(state: CombatState, event: CombatEvent, _rng: RNG): ReduceResult {
  switch (event.type) {
    case 'startBattle': {
      const units: Record<string, Unit> = {}
      for (const u of event.payload.units) units[u.id as unknown as string] = u
      const order = buildInitiativeQueue(event.payload.units)
      const first = order[0]!
      const team: 'party' | 'enemy' = teamsOf(units).partyIds.includes(first) ? 'party' : 'enemy'
      const newState: CombatState = {
        ...state,
        phase: 'COMBAT',
        subPhase: 'IDLE',
        turn: { number: 1, unitId: first, team },
        units,
        decks: event.payload.decks ?? state.decks,
        grid: event.payload.grid,
        rng: event.payload.rngSeed,
      }
      return { state: newState, effects: [] }
    }

    case 'startTurn': {
      const u = state.units[event.payload.unitId as unknown as string]
      if (!u) return { state, effects: [] }
      const team: 'party' | 'enemy' = teamsOf(state.units).partyIds.includes(u.id) ? 'party' : 'enemy'
      return {
        state: { ...state, turn: { ...state.turn, unitId: u.id, team } },
        effects: [],
      }
    }

    case 'endTurn': {
      const aliveUnits = Object.values(state.units).filter(isAlive)
      if (aliveUnits.length === 0) {
        // Edge: nobody alive — just check end condition and exit.
        const phase = checkEnd(state)
        return { state: { ...state, phase }, effects: [] }
      }
      const order = buildInitiativeQueue(aliveUnits)
      const currentIdx = order.findIndex(id => id === state.turn.unitId)
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % order.length
      const wrapped = currentIdx !== -1 && nextIdx === 0
      const nextId = order[nextIdx]!
      const team: 'party' | 'enemy' = teamsOf(state.units).partyIds.includes(nextId) ? 'party' : 'enemy'

      const phase = checkEnd(state)
      if (phase !== 'COMBAT') return { state: { ...state, phase }, effects: [] }

      return {
        state: {
          ...state,
          phase: 'COMBAT',
          subPhase: 'IDLE',
          turn: {
            number: wrapped ? state.turn.number + 1 : state.turn.number,
            unitId: nextId,
            team,
          },
        },
        effects: [],
      }
    }

    case 'tickStatus': {
      const effects: CombatEffect[] = []
      for (const u of Object.values(state.units)) {
        for (const s of u.statuses) {
          const def = getStatusEffect(s.effectId)
          if (!def?.onTurnEnd) continue
          const cardEffects = def.onTurnEnd({
            selfUnitId: u.id, selfStacks: s.stacks, selfTurnsRemaining: s.turnsRemaining,
          })
          for (const e of cardEffects) effects.push({ kind: 'ApplyCardEffect', effect: e })
        }
      }
      return { state, effects }
    }

    case 'selectCard':
      return {
        state: { ...state, selectedCardId: event.payload.cardId, subPhase: 'SELECTING_TARGET' },
        effects: [],
      }

    case 'cancelSelection':
      return {
        state: { ...state, selectedCardId: null, subPhase: 'IDLE' },
        effects: [],
      }

    case 'playCard':
    case 'moveUnit':
    case 'capture':
    case 'animationsCompleted':
      // Rich implementations land in next milestone (combat scene rendering).
      // Foundation no-op: emit a WaitForAnimations as a synchronization placeholder
      // so subscribers know "something happened" — useful for the Phaser firewall test.
      return { state, effects: [{ kind: 'WaitForAnimations' }] }
  }
}
