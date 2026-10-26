/**
 * combat/capture.ts — the only die in combat (brief §2.6; DECISIONS: 2 AP, adjacent, no HP gate).
 * chance = clamp01((1 − hp/max) × 0.6 + 0.25 × supportingAllies + 0.15 if bounty hunter), where the supporters
 * are the captor's OTHER living allies with hands on the target — the captor is the one doing the taking, never
 * their own help (RE-GATE C 3.18, 0119).
 * Roll = `rng.next() < chance` from `combat.rng`, written back either way (`rngState(r)`). Success → hp 0,
 * captured true, position null, `lastTile` set, `unitCaptured { tile }`, no kill gold. Captives count as
 * not-alive for `checkEnd` (all captured = victory). `captureChance` / `captureContext` are UI-readable
 * selectors (the % shown before committing).
 */
import type { Legality, SliceResult } from '../actions'
import type { CombatState, CombatUnit, EngineEnv, UnitId } from '../types'
import type { Effect } from '../effects'
import { createRng } from '../rng'
import { rngState } from '../rngState'
import { isLiving, manhattan } from './grid'
import { NOT_IN_ARMS_REACH, NOT_OF_THE_COMPANY, NO_FOE_IN_REACH, NO_FOE_TO_TAKE, needsAp } from './reasons'
import { withUnit } from './state'
import { activeUnit, settlePhase } from './turn'

/** No such passive exists in `PassiveIdSchema` yet (rules.ts `bountyHunterBonus` doc); read as a plain string so the
 *  class can land as content without touching this module. */
const BOUNTY_HUNTER_PASSIVE = 'bounty_hunter'

export function captureChance(target: CombatUnit, supportingAllies: number, bountyHunter: boolean, env: EngineEnv): number {
  const c = env.rules.combat.capture
  const hpFraction = target.hp.current / Math.max(1, target.hp.max)
  const raw = (1 - hpFraction) * c.hpWeight + c.adjacencyWeight * supportingAllies + (bountyHunter ? c.bountyHunterBonus : 0)
  return Math.max(0, Math.min(1, raw))
}

/**
 * Adjacency + how many OTHER allies have hands on the target + `bountyHunter` = the attacker's `passives` contains
 * a bounty-hunter passive (none exists in `PassiveIdSchema` today ⇒ always false).
 *
 * `supportingAllies` counts every living member of the attacker's team on an orthogonal neighbour of the target
 * EXCEPT the attacker: a captor is not their own support. Counting themselves put every lone captor one full
 * adjacency step up the curve and made two hands on a wounded foe read 100% — six of seven captures in a shipped
 * playthrough rolled a certainty, so "the only die in combat" was not a die (RE-GATE C 3.18, 0119). A lone captor now
 * runs on the wound alone; each mate who pins the target buys a real step.
 */
export function captureContext(state: CombatState, attackerId: UnitId, targetId: UnitId, env: EngineEnv): { readonly adjacent: boolean; readonly supportingAllies: number; readonly bountyHunter: boolean } {
  void env
  const attacker = state.units[attackerId]
  const target = state.units[targetId]
  if (attacker === undefined || target === undefined || attacker.position === null || target.position === null) {
    return { adjacent: false, supportingAllies: 0, bountyHunter: false }
  }
  const targetTile = target.position
  const adjacent = manhattan(attacker.position, targetTile) === 1
  const supportingAllies = Object.values(state.units).filter((u) =>
    u.id !== attacker.id && u.team === attacker.team && u.position !== null && isLiving(u) && manhattan(u.position, targetTile) === 1).length
  const bountyHunter = (attacker.passives as readonly string[]).includes(BOUNTY_HUNTER_PASSIVE)
  return { adjacent, supportingAllies, bountyHunter }
}

/** A living enemy on an orthogonal neighbour — the reach the capture verb needs before it is worth arming. */
export function hasAdjacentFoe(state: CombatState, unit: CombatUnit): boolean {
  const tile = unit.position
  if (tile === null) return false
  return Object.values(state.units).some((u) => u.team !== unit.team && u.position !== null && isLiving(u) && manhattan(u.position, tile) === 1)
}

/**
 * The whole rule behind ARMING a capture: the AP is there and somebody is in reach. Read by `combat/reducer.ts`
 * (`combat/enterCapture`) AND by `flow/legality.ts`, so the CAPTURE button goes unlit with the sentence the
 * reducer would have refused with instead of looking pressable (CONTRACT-CHANGES 0089). The roll itself, and the
 * rules that only a chosen target can answer, stay in `capture` below.
 */
export function canEnterCapture(state: CombatState, unit: CombatUnit, env: EngineEnv): Legality {
  const cost = env.rules.combat.capture.apCost
  if (unit.ap < cost) return { ok: false, reason: needsAp(cost) }
  if (!hasAdjacentFoe(state, unit)) return { ok: false, reason: NO_FOE_IN_REACH }
  return { ok: true }
}

export function capture(state: CombatState, targetId: UnitId, env: EngineEnv): SliceResult<CombatState> {
  const refuse = (reason: string): SliceResult<CombatState> => ({ state, effects: [{ kind: 'refused', action: 'combat/capture', reason }] })
  const attacker = activeUnit(state)
  if (attacker.team !== 'party') return refuse(NOT_OF_THE_COMPANY)
  const target = state.units[targetId]
  if (target === undefined || target.position === null || !isLiving(target) || target.team === attacker.team) return refuse(NO_FOE_TO_TAKE)
  const ctx = captureContext(state, attacker.id, targetId, env)
  if (!ctx.adjacent) return refuse(NOT_IN_ARMS_REACH)
  const cost = env.rules.combat.capture.apCost
  if (attacker.ap < cost) return refuse(needsAp(cost))
  const chance = captureChance(target, ctx.supportingAllies, ctx.bountyHunter, env)
  const r = createRng(state.rng)
  const success = r.next() < chance
  const ap = attacker.ap - cost
  // The roll is written back whether it hit or missed (§7.19): a failed capture never re-rolls the same number.
  let st: CombatState = { ...withUnit(state, { ...attacker, ap }), rng: rngState(r) }
  const effects: Effect[] = [
    { kind: 'apChanged', unitId: attacker.id, ap, delta: -cost },
    { kind: 'captureRolled', targetId, attackerId: attacker.id, chance, success },
  ]
  if (success) {
    const tile = target.position
    st = withUnit(st, { ...target, hp: { ...target.hp, current: 0 }, captured: true, position: null, lastTile: tile })
    effects.push({ kind: 'unitCaptured', unitId: targetId, tile }, { kind: 'sound', cue: 'capture' })
  } else {
    effects.push({ kind: 'sound', cue: 'captureFail' })
  }
  const settled = settlePhase(st, env)
  return { state: settled.state, effects: [...effects, ...settled.effects] }
}
