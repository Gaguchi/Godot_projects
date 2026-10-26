/**
 * combat/statuses.ts — fixed numbers, explicit expiry (brief §2.4, §7.6).
 * Merge/expiry/tick rules come from `env.rules.combat.statuses`; a card may not override them.
 *
 * Expiry model (types.ts `StatusExpiry`): a status decrements at ONE named moment of its OWNER's turn.
 * `ownerTurnStart` buffs (taunt/riposte/empower) played on the owner's turn therefore survive the whole enemy
 * phase and drop when the owner's next turn begins — the semantics the shipped `fresh` flag faked (§7.6).
 * `ownerTurnEnd` debuffs (poison/burn/slow/immobilize) tick and decrement when the VICTIM's turn ends.
 */
import type { SliceResult } from '../actions'
import type { ActiveStatus, CombatState, CombatUnit, EngineEnv, StatusId, UnitId } from '../types'
import type { Effect } from '../effects'
import { dealFlatDamage } from './damage'
import { isLiving } from './grid'
import { withUnit } from './state'
import { settlePhase } from './turn'

/** Stackable: stacks sum, turns = max. Non-stackable: stacks = max, turns = max. `expiresAt` from the rule. */
export function mergeStatus(statuses: readonly ActiveStatus[], next: ActiveStatus, env: EngineEnv): readonly ActiveStatus[] {
  const rule = env.rules.combat.statuses[next.id]
  const incoming: ActiveStatus = { ...next, expiresAt: rule.expiresAt }
  const idx = statuses.findIndex((s) => s.id === next.id)
  if (idx < 0) return [...statuses, incoming]
  const existing = statuses[idx]!
  const merged: ActiveStatus = {
    ...existing,
    stacks: rule.stackable ? existing.stacks + next.stacks : Math.max(existing.stacks, next.stacks),
    turns: Math.max(existing.turns, next.turns),
    sourceId: next.sourceId,
  }
  return statuses.map((s, i) => (i === idx ? merged : s))
}

function stacksOf(u: CombatUnit, id: StatusId): number {
  let total = 0
  for (const s of u.statuses) if (s.id === id) total += s.stacks
  return total
}

export function hasStatus(u: CombatUnit, id: StatusId): boolean {
  return u.statuses.some((s) => s.id === id)
}

/** −slow stacks (initiative only). */
export function slowDelta(u: CombatUnit): number {
  return 0 - stacksOf(u, 'slow') // `0 - x`, not `-x`: keeps +0 for an unslowed unit (Object.is in tests, JSON)
}

export function isImmobilized(u: CombatUnit): boolean {
  return hasStatus(u, 'immobilize')
}

export function isTaunting(u: CombatUnit): boolean {
  return hasStatus(u, 'taunt')
}

export function riposteStacks(u: CombatUnit): number {
  return stacksOf(u, 'riposte')
}

export function empowerBonus(u: CombatUnit): number {
  return stacksOf(u, 'empower')
}

/** Empower is consumed by the next Damage card (`statusRemoved reason:'consumed'`). */
export function consumeEmpower(u: CombatUnit): { readonly unit: CombatUnit; readonly effects: readonly Effect[] } {
  if (!hasStatus(u, 'empower')) return { unit: u, effects: [] }
  return {
    unit: { ...u, statuses: u.statuses.filter((s) => s.id !== 'empower') },
    effects: [{ kind: 'statusRemoved', unitId: u.id, status: 'empower', reason: 'consumed' }],
  }
}

/** Decrement every status expiring at `moment`; drop the ones that reach 0. */
function decrement(u: CombatUnit, moment: ActiveStatus['expiresAt']): { readonly unit: CombatUnit; readonly effects: readonly Effect[] } {
  const kept: ActiveStatus[] = []
  const effects: Effect[] = []
  let changed = false
  for (const s of u.statuses) {
    if (s.expiresAt !== moment) {
      kept.push(s)
      continue
    }
    changed = true
    const turns = s.turns - 1
    if (turns > 0) kept.push({ ...s, turns })
    else effects.push({ kind: 'statusRemoved', unitId: u.id, status: s.id, reason: 'expired' })
  }
  return { unit: changed ? { ...u, statuses: kept } : u, effects }
}

/**
 * DOT (poison piercing, burn magic split) then decrement every `ownerTurnEnd` status, expire at 0.
 * A DOT death flips phase via `checkEnd` at the tick. A tick is FLAT — no DR (brief §2.4 "X dmg"; the shipped
 * `tickUnitStatuses` never subtracted DEF/RES either) — so it goes through `dealFlatDamage`, not `dealDamage`.
 */
export function tickOwnerTurnEnd(state: CombatState, unitId: UnitId, env: EngineEnv): SliceResult<CombatState> {
  const u = state.units[unitId]
  if (u === undefined || !isLiving(u)) return { state, effects: [] }
  let st = state
  const effects: Effect[] = []
  for (const s of u.statuses) {
    if (s.expiresAt !== 'ownerTurnEnd') continue
    const tick = env.rules.combat.statuses[s.id].tick
    if (tick === null) continue
    const live = st.units[unitId]
    if (live === undefined || !isLiving(live)) break // an earlier tick killed the owner; a corpse takes no more
    const hit = tick === 'poisonPiercing'
      ? dealFlatDamage(st, null, unitId, s.stacks, 'physical', { armorPiercing: true, cause: 'poison' }, env)
      : dealFlatDamage(st, null, unitId, s.stacks, 'magic', { armorPiercing: false, cause: 'burn' }, env)
    st = hit.state
    effects.push({ kind: 'statusTicked', unitId, status: s.id, damage: s.stacks }, ...hit.effects)
  }
  const after = st.units[unitId]
  if (after !== undefined) {
    const dec = decrement(after, 'ownerTurnEnd')
    if (dec.unit !== after) st = withUnit(st, dec.unit)
    effects.push(...dec.effects)
  }
  const settled = settlePhase(st, env)
  return { state: settled.state, effects: [...effects, ...settled.effects] }
}

/** Decrement every `ownerTurnStart` status (taunt/riposte/empower), expire at 0. */
export function tickOwnerTurnStart(u: CombatUnit, env: EngineEnv): { readonly unit: CombatUnit; readonly effects: readonly Effect[] } {
  void env // WHICH moment a status uses is data (`expiresAt` on the instance); the decrement itself is always one turn
  return decrement(u, 'ownerTurnStart')
}

/** `RemoveStatus`: armor N | all; debuff = every `harmful` status (content always pairs debuff with `all`). */
export function cleanse(u: CombatUnit, remove: 'armor' | 'debuff', amount: number | 'all', env: EngineEnv): { readonly unit: CombatUnit; readonly effects: readonly Effect[] } {
  if (remove === 'armor') {
    const lost = amount === 'all' ? u.armor : Math.min(u.armor, amount)
    if (lost <= 0) return { unit: u, effects: [] } // nothing to shred emits nothing — the hit before it already reported the armor loss
    return { unit: { ...u, armor: u.armor - lost }, effects: [{ kind: 'armorShredded', unitId: u.id, amount: lost }] }
  }
  const effects: Effect[] = []
  const kept = u.statuses.filter((s) => {
    if (!env.rules.combat.statuses[s.id].harmful) return true
    effects.push({ kind: 'statusRemoved', unitId: u.id, status: s.id, reason: 'cleansed' })
    return false
  })
  return { unit: effects.length === 0 ? u : { ...u, statuses: kept }, effects }
}
