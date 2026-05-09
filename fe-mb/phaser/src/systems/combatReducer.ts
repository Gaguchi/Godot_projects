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

    case 'playCard': {
      const { srcId, targets, card, cardId } = event.payload
      const src = state.units[srcId as unknown as string]
      if (!src || !card) {
        // Legacy path or invalid src — no-op stub for backwards compatibility.
        return { state, effects: [{ kind: 'WaitForAnimations' }] }
      }
      // Insufficient AP — refuse to play
      if (src.ap < card.apCost) {
        return { state, effects: [] }
      }

      const newUnits: Record<string, Unit> = { ...state.units }
      const effects: CombatEffect[] = []

      // Find a target unit at each target tile (if any)
      const targetUnits: Unit[] = []
      for (const tile of targets) {
        const tileStr = tile as unknown as string
        const u = Object.values(newUnits).find(
          (cand) => cand.position && (cand.position as unknown as string) === tileStr,
        )
        if (u) targetUnits.push(u)
      }

      // Resolve each effect against each target
      for (const eff of card.effects) {
        const params = eff.params
        if (eff.kind === 'Damage') {
          const base = (params.base as number | undefined) ?? 0
          const damageType = (params.damageType as string | undefined) ?? 'physical'
          const stat = card.damageStat
          let statBonus = 0
          if (stat === 'str') statBonus = src.stats.str
          else if (stat === 'mag') statBonus = src.stats.mag
          else if (stat === 'skl') statBonus = src.stats.skl
          for (const target of targetUnits) {
            const dr = damageType === 'magic'
              ? Math.floor(target.stats.res / 2)
              : Math.floor(target.stats.def / 2)
            const dmg = Math.max(0, base + statBonus - dr)
            const newCurrent = Math.max(0, target.hp.current - dmg)
            const tStr = target.id as unknown as string
            const updated: Unit = { ...target, hp: { ...target.hp, current: newCurrent } }
            newUnits[tStr] = updated
            effects.push({
              kind: 'FloatDamage',
              tile: target.position!,
              amount: dmg,
              damageKind: damageType === 'magic' ? 'magic' : 'physical',
            })
            effects.push({
              kind: 'HitFlash',
              sprite: { id: tStr },
              durationMs: 80,
            })
          }
        } else if (eff.kind === 'Heal') {
          const amount = (params.amount as number | undefined) ?? 0
          for (const target of targetUnits) {
            const newCurrent = Math.min(target.hp.max, target.hp.current + amount)
            const tStr = target.id as unknown as string
            const updated: Unit = { ...target, hp: { ...target.hp, current: newCurrent } }
            newUnits[tStr] = updated
            effects.push({
              kind: 'FloatDamage',
              tile: target.position!,
              amount,
              damageKind: 'heal',
            })
          }
        } else if (eff.kind === 'GrantArmor') {
          const amount = (params.amount as number | undefined) ?? 0
          // Self-target if no targetUnits (e.g. self cards)
          const recipients = targetUnits.length > 0 ? targetUnits : [src]
          for (const target of recipients) {
            const tStr = target.id as unknown as string
            const updated: Unit = { ...target, armor: target.armor + amount }
            newUnits[tStr] = updated
          }
        } else if (eff.kind === 'GainAp') {
          const amount = (params.amount as number | undefined) ?? 0
          const tStr = (src.id as unknown as string)
          const updatedSrc = newUnits[tStr] ?? src
          newUnits[tStr] = { ...updatedSrc, ap: updatedSrc.ap + amount }
        }
      }

      // Decrement source AP and discard the played card
      const srcStr = srcId as unknown as string
      const updatedSrc = newUnits[srcStr] ?? src
      newUnits[srcStr] = { ...updatedSrc, ap: Math.max(0, updatedSrc.ap - card.apCost) }

      const newDecks = { ...state.decks }
      const srcDeck = newDecks[srcStr]
      if (srcDeck) {
        const handIdx = srcDeck.hand.findIndex((c) => (c as unknown as string) === (cardId as unknown as string))
        if (handIdx !== -1) {
          const newHand = srcDeck.hand.slice()
          const removed = newHand.splice(handIdx, 1)
          newDecks[srcStr] = {
            ...srcDeck,
            hand: newHand,
            discard: [...srcDeck.discard, ...removed],
          }
        }
      }

      // Tween source toward first target tile, if any
      if (targets.length > 0) {
        effects.push({
          kind: 'PlayTween',
          sprite: { id: srcStr },
          props: { targetTile: targets[0] as unknown as string },
          durationMs: 250,
        })
      }
      // Camera shake on big hits
      const totalDmg = effects
        .filter((e) => e.kind === 'FloatDamage' && e.damageKind !== 'heal')
        .reduce((sum, e) => sum + (e.kind === 'FloatDamage' ? e.amount : 0), 0)
      if (totalDmg >= 10) {
        effects.push({ kind: 'ShakeCamera', intensity: 0.005, durationMs: 200 })
      }
      effects.push({ kind: 'WaitForAnimations' })

      // Check end conditions after damage applied
      const stateAfter: CombatState = {
        ...state,
        units: newUnits,
        decks: newDecks,
        subPhase: 'RESOLVING',
        selectedCardId: null,
      }
      const phase = checkEnd(stateAfter)
      const finalState: CombatState = phase !== 'COMBAT' ? { ...stateAfter, phase } : stateAfter

      return { state: finalState, effects }
    }

    case 'animationsCompleted':
      // Resolution finished; back to IDLE so player can pick another card
      return {
        state: { ...state, subPhase: 'IDLE' },
        effects: [],
      }

    case 'moveUnit': {
      const { unitId, tileId } = event.payload
      const u = state.units[unitId as unknown as string]
      if (!u) return { state, effects: [] }
      const newUnits: Record<string, Unit> = {
        ...state.units,
        [unitId as unknown as string]: { ...u, position: tileId, ap: Math.max(0, u.ap - 1) },
      }
      return {
        state: { ...state, units: newUnits },
        effects: [
          { kind: 'PlayTween', sprite: { id: unitId as unknown as string }, props: { targetTile: tileId as unknown as string }, durationMs: 200 },
          { kind: 'WaitForAnimations' },
        ],
      }
    }

    case 'capture':
      // Rich implementation lands with capture+recruitment feature.
      return { state, effects: [{ kind: 'WaitForAnimations' }] }
  }
}
