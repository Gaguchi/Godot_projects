/**
 * combat/reducer.ts — the isolated combat reducer: pure over `CombatState`, never sees `run`.
 * Cases: selectCard, pinTarget, enterMove, enterCapture, cancel, playCard, moveUnit, useItem, capture,
 * endTurn, enemyStep (`planEnemyStep` → rng written back → apply as moveUnit | enemyAct | endTurn), enemyAct.
 * Every legality rule lives here (bounds, obstacles, occupancy, move range, card range, targetKind, AP,
 * hand membership, active unit, team). Refusals return the SAME state object + one `refused` effect.
 * `tutorial/skip` and `battleEnd/dismiss` need meta/run and live in `flow/`.
 *
 * After every state-changing case `finish` runs: selection → idle, `settlePhase`, and — because `turn.unitId` must
 * never name a corpse while the battle runs — the turn passes at once when the acting unit fell mid-turn (a riposte,
 * its own poison). `rules.combat.autoEndTurnAtZeroAp` ends a party turn the same way at 0 AP with an empty hand.
 */
import type { CombatAction, SliceResult } from '../actions'
import type { CombatState, CombatUnit, EngineEnv, TileKey } from '../types'
import type { Effect } from '../effects'
import { actionAsPlay, planEnemyStep } from './ai'
import { canEnterCapture, capture } from './capture'
import { playCard, resolvePlay, validatePlay } from './cards'
import { inBounds, isLiving, isObstacle, reachable, unitAt } from './grid'
import { useItem } from './items'
import { withUnit } from './state'
import {
  ALREADY_THERE, A_WALL_THERE, BATTLE_OVER, ENEMY_ACTING, NOT_A_TARGET, NOT_ENEMY_TURN, NOT_IN_HAND,
  NOT_ON_THE_FIELD, NOT_THE_ACTIVE_UNIT, NO_ACTION_LEFT, NO_ACTIVE_UNIT, NO_CARD_CHOSEN, NO_SUCH_ACTION,
  NO_WAY_TO_FIGHT, OFF_THE_FIELD, SOMEONE_THERE, TOO_FAR_TO_WALK,
} from './reasons'
import { legalTargets } from './targeting'
import { canEnterMove, endTurn, settlePhase } from './turn'

type CombatActionType = CombatAction['type']

function refused(state: CombatState, action: CombatActionType, reason: string): SliceResult<CombatState> {
  return { state, effects: [{ kind: 'refused', action, reason }] }
}

function reasonOf(r: SliceResult<CombatState>): string {
  const first = r.effects[0]
  return first !== undefined && first.kind === 'refused' ? first.reason : 'refused'
}

/** The free move (§2.1): 4-dir BFS ≤ mov through free non-obstacle tiles; refused if moved or immobilized —
 *  `turn.ts#canEnterMove` owns those two rules and `flow/legality.ts` reads the same predicate. */
function moveActive(state: CombatState, unit: CombatUnit, tile: TileKey, action: CombatActionType): SliceResult<CombatState> {
  const refuse = (reason: string): SliceResult<CombatState> => refused(state, action, reason)
  if (unit.position === null) return refuse(NOT_ON_THE_FIELD)
  const allowed = canEnterMove(unit)
  if (!allowed.ok) return refuse(allowed.reason)
  if (!inBounds(state.grid, tile)) return refuse(OFF_THE_FIELD)
  if (isObstacle(state.grid, tile)) return refuse(A_WALL_THERE)
  if (unitAt(state, tile) !== null) return refuse(tile === unit.position ? ALREADY_THERE : SOMEONE_THERE)
  const path = reachable(state, unit.id)[tile]
  if (path === undefined) return refuse(TOO_FAR_TO_WALK)
  const from = unit.position
  return {
    state: withUnit(state, { ...unit, position: tile, hasMovedThisTurn: true }),
    effects: [{ kind: 'unitMoved', unitId: unit.id, from, path }, { kind: 'sound', cue: 'footsteps' }],
  }
}

/** The planned attack/heal/buff of the active ENEMY: budget → `actionAsPlay` → `validatePlay` → `resolvePlay`. */
function enemyAct(state: CombatState, actor: CombatUnit, actionId: string, tile: TileKey, action: CombatActionType, env: EngineEnv): SliceResult<CombatState> {
  const refuse = (reason: string): SliceResult<CombatState> => refused(state, action, reason)
  const profile = env.content.enemyAI[actor.classId]
  if (profile === undefined) return refuse(NO_WAY_TO_FIGHT)
  const enemyAction = profile.actions.find((a) => a.id === actionId)
  if (enemyAction === undefined) return refuse(NO_SUCH_ACTION)
  const budget = env.rules.knobs.enemyActionBudget
  const cost = env.rules.combat.enemyActionApCost
  if (budget === 1 ? actor.actionsTaken > 0 : actor.ap < cost) return refuse(NO_ACTION_LEFT)
  const card = actionAsPlay(enemyAction, actor)
  const playTile = enemyAction.kind === 'buff' ? null : tile // buffs are range 0-0: centred on the actor
  const legality = validatePlay(state, actor.id, card, playTile, env)
  if (!legality.ok) return refuse(legality.reason)
  const effects: Effect[] = [{ kind: 'enemyActed', unitId: actor.id, actionId, tile }]
  const resolved = resolvePlay(state, { sourceId: actor.id, card, cardId: null, tile: playTile, mod: null, cause: 'enemyAction' }, env)
  let st = resolved.state
  effects.push(...resolved.effects)
  const after = st.units[actor.id]
  if (after !== undefined) {
    const ap = budget === 'ap' ? Math.max(0, after.ap - cost) : after.ap
    st = withUnit(st, { ...after, actionsTaken: after.actionsTaken + 1, ap })
    if (ap !== after.ap) effects.push({ kind: 'apChanged', unitId: actor.id, ap, delta: ap - after.ap })
  }
  return { state: st, effects }
}

function finish(r: SliceResult<CombatState>, env: EngineEnv): SliceResult<CombatState> {
  let st: CombatState = r.state.selection.kind === 'idle' ? r.state : { ...r.state, selection: { kind: 'idle' } }
  const effects: Effect[] = [...r.effects]
  const settled = settlePhase(st, env)
  st = settled.state
  effects.push(...settled.effects)
  if (st.phase !== 'combat') return { state: st, effects }
  const active = st.units[st.turn.unitId]
  const activeDead = active === undefined || !isLiving(active)
  const spent = active !== undefined &&
    env.rules.combat.autoEndTurnAtZeroAp &&
    active.team === 'party' &&
    active.ap === 0 &&
    (st.decks[active.id]?.hand.length ?? 0) === 0
  if (activeDead || spent) {
    const ended = endTurn(st, env)
    return { state: ended.state, effects: [...effects, ...ended.effects] }
  }
  return { state: st, effects }
}

export function reduceCombat(state: CombatState, action: CombatAction, env: EngineEnv): SliceResult<CombatState> {
  const refuse = (reason: string): SliceResult<CombatState> => refused(state, action.type, reason)
  if (state.phase !== 'combat') return refuse(BATTLE_OVER)
  const active = state.units[state.turn.unitId]
  if (active === undefined) return refuse(NO_ACTIVE_UNIT)
  const partyTurn = active.team === 'party'

  switch (action.type) {
    case 'combat/selectCard': {
      if (!partyTurn) return refuse(ENEMY_ACTING)
      const deck = state.decks[active.id]
      if (deck === undefined || !deck.hand.includes(action.cardUid)) return refuse(NOT_IN_HAND)
      return { state: { ...state, selection: { kind: 'card', cardUid: action.cardUid, pinnedTile: null } }, effects: [] }
    }
    case 'combat/pinTarget': {
      if (!partyTurn) return refuse(ENEMY_ACTING)
      if (state.selection.kind !== 'card') return refuse(NO_CARD_CHOSEN)
      const inst = state.decks[active.id]?.cards[state.selection.cardUid]
      const card = inst === undefined ? undefined : env.content.cards[inst.cardId]
      if (card === undefined) return refuse(NOT_IN_HAND)
      if (!legalTargets(state, active.id, card, env).includes(action.tile)) return refuse(NOT_A_TARGET)
      return { state: { ...state, selection: { ...state.selection, pinnedTile: action.tile } }, effects: [] }
    }
    // The two ARMING verbs. Their rules are exported predicates because `flow/legality.ts` gates them on exactly
    // these sentences (CONTRACT-CHANGES 0089): arming a mode with nothing to aim at cannot change the board, so
    // the button is unlit rather than pressable-and-refused, and there is one home for each refusal.
    case 'combat/enterMove': {
      if (!partyTurn) return refuse(ENEMY_ACTING)
      const allowed = canEnterMove(active)
      return allowed.ok ? { state: { ...state, selection: { kind: 'move' } }, effects: [] } : refuse(allowed.reason)
    }
    case 'combat/enterCapture': {
      if (!partyTurn) return refuse(ENEMY_ACTING)
      const allowed = canEnterCapture(state, active, env)
      return allowed.ok ? { state: { ...state, selection: { kind: 'capture' } }, effects: [] } : refuse(allowed.reason)
    }
    case 'combat/cancel':
      return state.selection.kind === 'idle' ? { state, effects: [] } : { state: { ...state, selection: { kind: 'idle' } }, effects: [] }
    case 'combat/playCard': {
      if (!partyTurn) return refuse(ENEMY_ACTING)
      const r = playCard(state, action.cardUid, action.tile, env)
      return r.state === state ? r : finish(r, env)
    }
    case 'combat/moveUnit': {
      const r = moveActive(state, active, action.tile, action.type)
      return r.state === state ? r : finish(r, env)
    }
    case 'combat/useItem': {
      if (!partyTurn) return refuse(ENEMY_ACTING)
      const r = useItem(state, action.itemId, env)
      return r.state === state ? r : finish(r, env)
    }
    case 'combat/capture': {
      if (!partyTurn) return refuse(ENEMY_ACTING)
      const r = capture(state, action.targetId, env)
      return r.state === state ? r : finish(r, env)
    }
    case 'combat/endTurn':
      return endTurn(state, env)
    case 'combat/enemyStep': {
      if (partyTurn) return refuse(NOT_ENEMY_TURN)
      const plan = planEnemyStep(state, env)
      // The planner's rolls are written back BEFORE the step applies (§7.19) — even a refused step keeps them out of
      // the state only because a refusal returns the ORIGINAL reference (a refused pump is a contract bug).
      const st: CombatState = { ...state, rng: plan.rng }
      switch (plan.step.kind) {
        case 'move': {
          const r = moveActive(st, active, plan.step.to, action.type)
          return r.state === st ? refuse(reasonOf(r)) : finish(r, env)
        }
        case 'act': {
          const r = enemyAct(st, active, plan.step.actionId, plan.step.tile, action.type, env)
          return r.state === st ? refuse(reasonOf(r)) : finish(r, env)
        }
        case 'endTurn':
          return endTurn(st, env)
      }
      break
    }
    case 'combat/enemyAct': {
      if (partyTurn) return refuse(NOT_ENEMY_TURN)
      if (action.unitId !== active.id) return refuse(NOT_THE_ACTIVE_UNIT)
      const r = enemyAct(state, active, action.actionId, action.tile, action.type, env)
      return r.state === state ? r : finish(r, env)
    }
  }
  return refuse(NO_SUCH_ACTION)
}
