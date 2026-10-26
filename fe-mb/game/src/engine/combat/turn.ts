/**
 * combat/turn.ts — per-unit initiative and turn boundaries (brief §2.1, §2.4, §7.1).
 * The queue is DERIVED from `combat.units` at every call — never stored. What IS stored is the cursor's memory:
 * `turn.acted`, the units already handed the cursor this round (CONTRACT-CHANGES 0115). A round deals every living
 * unit exactly one turn; a slow landing or expiring mid-round re-sorts whoever is LEFT, and can no longer drop a
 * unit back behind the cursor for a second turn or lift one over it and skip it.
 */
import type { Legality, SliceResult } from '../actions'
import type { CombatPhase, CombatState, CombatUnit, EngineEnv, UnitId } from '../types'
import type { Effect } from '../effects'
import { discardHand, drawCards } from './deck'
import { isLiving } from './grid'
import { ALREADY_MOVED, ROOTED } from './reasons'
import { unitOrThrow, withDeck, withUnit } from './state'
import { isImmobilized, slowDelta, tickOwnerTurnEnd, tickOwnerTurnStart } from './statuses'

/** The foundling's unit id (DECISIONS: characters.json ships `mc`; the chosen name lives in `run.mcName`).
 *  Read by `checkEnd` for the `mcDeathIsDefeat` knob; a battle without an `mc` unit (sims) ignores the knob. */
export const MC_UNIT_ID: UnitId = 'mc'

/** stats.spd + slow delta. */
export function effectiveSpd(u: CombatUnit): number {
  return u.stats.spd + slowDelta(u)
}

/**
 * The free move's own rule: one per turn, and not while rooted. Read by `combat/reducer.ts` (both the arming verb
 * and the step itself) AND by `flow/legality.ts`, so MOVE goes unlit with the sentence the reducer would have
 * refused with (CONTRACT-CHANGES 0089). The reason is the one the command column already spoke on the glass.
 */
export function canEnterMove(unit: CombatUnit): Legality {
  if (unit.hasMovedThisTurn) return { ok: false, reason: ALREADY_MOVED }
  if (isImmobilized(unit)) return { ok: false, reason: ROOTED }
  return { ok: true }
}

/** SPD desc → party first on a tie → id asc (brief §2.1). */
function compareInitiative(a: CombatUnit, b: CombatUnit): number {
  const spd = effectiveSpd(b) - effectiveSpd(a)
  if (spd !== 0) return spd
  if (a.team !== b.team) return a.team === 'party' ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Living, uncaptured, on-board units in initiative order. The dead are simply not in the round: the cursor is
 *  remembered in `turn.acted`, so a unit that dies at its own tick no longer has to stay in the queue to be found. */
function orderedIds(units: Readonly<Record<UnitId, CombatUnit>>): readonly UnitId[] {
  return Object.values(units).filter(isLiving).sort(compareInitiative).map((u) => u.id)
}

/** Living, uncaptured, on-board units: effectiveSpd desc, party first on tie, then id asc. */
export function initiativeQueue(units: Readonly<Record<UnitId, CombatUnit>>): readonly UnitId[] {
  return orderedIds(units)
}

/** Who still owes a turn this round: living, in initiative order, minus everyone `acted` names and minus the unit
 *  holding the cursor. The ORDER of what is left is re-derived (a slow still decides who of them goes first);
 *  membership is not, which is the whole of the fix for a mid-round speed change. */
export function remainingThisRound(units: Readonly<Record<UnitId, CombatUnit>>, acted: readonly UnitId[], currentId: UnitId): readonly UnitId[] {
  const done = new Set<UnitId>([...acted, currentId])
  return orderedIds(units).filter((id) => !done.has(id))
}

/** The next unit of THIS round — the first living one that has not held the cursor yet. When none is left the
 *  round turns over (`wrapped`, round++ in `endTurn`) and the fresh queue's leader takes it. A unit that died at
 *  its own tick still anchors the hand-off: it is excluded either way, so the cursor moves on from where it stood. */
export function successor(units: Readonly<Record<UnitId, CombatUnit>>, currentId: UnitId, acted: readonly UnitId[]): { readonly unitId: UnitId; readonly wrapped: boolean } {
  if (units[currentId] === undefined) throw new Error(`combat/turn: unknown unit '${currentId}'`)
  const next = remainingThisRound(units, acted, currentId)[0]
  if (next !== undefined) return { unitId: next, wrapped: false }
  const fresh = orderedIds(units)
  return { unitId: fresh[0] ?? currentId, wrapped: true }
}

/** HUD selector: who acts next, in the order they actually will — the unit holding the cursor, then the rest of
 *  THIS round, then the next round's queue behind them. It reads `turn.acted` for the same reason `successor` does:
 *  a rotation of the re-sorted queue would promise a turn to somebody who has already taken one. */
export function initiativeStrip(state: CombatState, visible: number): { readonly ids: readonly UnitId[]; readonly more: number } {
  const queue = initiativeQueue(state.units)
  const active = state.turn.unitId
  const order: readonly UnitId[] = [...(queue.includes(active) ? [active] : []), ...remainingThisRound(state.units, state.turn.acted, active), ...queue]
  const ids = [...new Set(order)].slice(0, visible) // each unit appears once, as the rotation always did
  return { ids, more: Math.max(0, queue.length - ids.length) }
}

export function activeUnit(state: CombatState): CombatUnit {
  return unitOrThrow(state, state.turn.unitId)
}

export function isPartyTurn(state: CombatState): boolean {
  return activeUnit(state).team === 'party'
}

/** victory: no enemy alive-and-uncaptured; defeat: no party unit alive, or the MC dead when `knobs.mcDeathIsDefeat`. */
export function checkEnd(state: CombatState, env: EngineEnv): CombatPhase {
  const living = Object.values(state.units).filter(isLiving)
  const partyAlive = living.some((u) => u.team === 'party')
  const enemiesAlive = living.some((u) => u.team === 'enemy')
  const mc = state.units[MC_UNIT_ID]
  const mcDead = env.rules.knobs.mcDeathIsDefeat && mc !== undefined && !isLiving(mc)
  // Defeat is checked first: a mutual kill (a riposte felling the last party unit as it lands the last blow) is a loss.
  if (!partyAlive || mcDead) return 'defeat'
  if (!enemiesAlive) return 'victory'
  return 'combat'
}

/** Flips `phase` when `checkEnd` says so; idempotent once the battle is over. Emits `battleEnded` exactly once. */
export function settlePhase(state: CombatState, env: EngineEnv): SliceResult<CombatState> {
  if (state.phase !== 'combat') return { state, effects: [] }
  const phase = checkEnd(state, env)
  if (phase === 'combat') return { state, effects: [] }
  return {
    state: { ...state, phase, selection: { kind: 'idle' } },
    effects: [{ kind: 'battleEnded', battleId: state.battleId, outcome: phase }, { kind: 'sound', cue: phase }],
  }
}

/** ap = apPerTurn, hasMovedThisTurn false, actionsTaken 0, coverUsed [], ownerTurnStart statuses decrement/expire,
 *  armor reset when the knob says so, draw to handSize (reshuffle via rng, zero loss). Emits `turnStarted`. */
export function startTurn(state: CombatState, unitId: UnitId, env: EngineEnv): SliceResult<CombatState> {
  const u = unitOrThrow(state, unitId)
  const ticked = tickOwnerTurnStart(u, env)
  const fresh: CombatUnit = {
    ...ticked.unit,
    ap: env.rules.combat.apPerTurn,
    hasMovedThisTurn: false,
    actionsTaken: 0,
    coverUsed: [], // Genatsvale's "per ally, per turn" ledger clears at the PROTECTOR's activation (§2.16)
    armor: env.rules.knobs.armorCap === 'resetOnOwnerTurn' ? 0 : ticked.unit.armor,
  }
  // Taking the cursor is what books a unit into the round's ledger — `successor` reads it and never deals twice.
  const acted = state.turn.acted.includes(unitId) ? state.turn.acted : [...state.turn.acted, unitId]
  let st = withUnit({ ...state, turn: { ...state.turn, unitId, acted } }, fresh)
  const effects: Effect[] = [{ kind: 'turnStarted', unitId, team: fresh.team, round: st.turn.round }, ...ticked.effects]
  // Enemies never play their decks (§2.5), so only party units draw — an enemy draw would burn the stream for nothing.
  const deck = st.decks[unitId]
  if (fresh.team === 'party' && deck !== undefined) {
    const need = env.rules.combat.handSize - deck.hand.length
    if (need > 0) {
      const drawn = drawCards(deck, need, st.rng)
      const uids = drawn.deck.hand.slice(deck.hand.length)
      st = withDeck({ ...st, rng: drawn.rng }, unitId, drawn.deck)
      if (uids.length > 0) effects.push({ kind: 'cardsDrawn', unitId, uids, reshuffled: drawn.reshuffled })
    }
  }
  return { state: st, effects }
}

/** endTurn order (§2.1): (1) tick the ENDING unit's ownerTurnEnd statuses (DOT, decrement, expire) (2) checkEnd
 *  (3) successor → `startTurn` (4) ending unit discards its whole hand (5) selection idle; round++ on wrap.
 *  The status tick at (1) can change every unit's `effectiveSpd`; (3) reads `turn.acted`, so it cannot re-deal. */
export function endTurn(state: CombatState, env: EngineEnv): SliceResult<CombatState> {
  const endingId = state.turn.unitId
  unitOrThrow(state, endingId)
  const ticked = tickOwnerTurnEnd(state, endingId, env) // (1) + (2): a DOT death flips the phase inside the tick
  let st = ticked.state
  if (st.phase !== 'combat') return { state: st, effects: ticked.effects }
  const next = successor(st.units, endingId, st.turn.acted)
  // (4) before (3)'s draw: the ending unit's hand hits the discard first, so a lone unit reshuffles cleanly.
  const deck = st.decks[endingId]
  if (deck !== undefined) st = withDeck(st, endingId, discardHand(deck))
  // The round turns over only when nobody is left owing a turn — and the ledger opens empty for the new one.
  if (next.wrapped) st = { ...st, turn: { ...st.turn, round: st.turn.round + 1, acted: [] } }
  const started = startTurn(st, next.unitId, env)
  return { state: { ...started.state, selection: { kind: 'idle' } }, effects: [...ticked.effects, ...started.effects] }
}
