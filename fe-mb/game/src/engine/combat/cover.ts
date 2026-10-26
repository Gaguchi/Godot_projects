/**
 * combat/cover.ts — damage redirect is a first-class step (brief §2.2, §2.16 Genatsvale).
 * Only hostile Damage effects are redirected (not DOT, not riposte, not self-inflicted).
 * Candidates: living units of the target's team with `rules.combat.coverPassive` in `passives`,
 * orthogonally adjacent to the target, whose `coverUsed` lacks `targetId`, id ≠ target; lowest id wins.
 * The forecast, the reducer's Damage path and the AI scorer all call this ONE function.
 */
import type { CombatState, EngineEnv, UnitId } from '../types'
import { isLiving, manhattan } from './grid'
import { withUnit } from './state'

export function resolveCoverTarget(state: CombatState, attackerId: UnitId, targetId: UnitId, env: EngineEnv): { readonly targetId: UnitId; readonly protectorId: UnitId | null } {
  const attacker = state.units[attackerId]
  const target = state.units[targetId]
  const none = { targetId, protectorId: null }
  // Self-inflicted and friendly blows are never covered (§2.16: "the first blow AIMED at an adjacent ally").
  if (attacker === undefined || target === undefined || target.position === null || attacker.team === target.team) return none
  const targetTile = target.position
  const passive = env.rules.combat.coverPassive
  const candidates = Object.values(state.units)
    .filter((u) =>
      u.id !== targetId &&
      u.team === target.team &&
      u.position !== null &&
      isLiving(u) &&
      u.passives.includes(passive) &&
      manhattan(u.position, targetTile) === 1 &&
      !u.coverUsed.includes(targetId))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const protector = candidates[0]
  if (protector === undefined) return none
  return { targetId: protector.id, protectorId: protector.id }
}

/** Appends `protecteeId` to the protector's `coverUsed` (cleared at the protector's turn start — "per ally, per turn"). */
export function recordCover(state: CombatState, protectorId: UnitId, protecteeId: UnitId): CombatState {
  const protector = state.units[protectorId]
  if (protector === undefined || protector.coverUsed.includes(protecteeId)) return state
  return withUnit(state, { ...protector, coverUsed: [...protector.coverUsed, protecteeId] })
}
