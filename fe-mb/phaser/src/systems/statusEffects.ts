import type { StatusEffectDef, HookCtx } from '../domain/statusEffect'
import type { CardEffect } from '../domain/card'
import type { Unit, ActiveStatus } from '../domain/unit'
import { asStatusEffectId, asCardId, type StatusEffectId, type UnitId } from '../domain/ids'

const POISON: StatusEffectDef = {
  id: asStatusEffectId('poison'),
  name: 'Poison',
  stackable: false,
  onTurnEnd(ctx: HookCtx): CardEffect[] {
    return [{
      kind: 'Damage',
      targetId: ctx.selfUnitId,
      amount: ctx.selfStacks,
      damageType: 'physical',
      source: asCardId('status:poison'),
      armorPiercing: true,
    }]
  },
}

const BURN: StatusEffectDef = {
  id: asStatusEffectId('burn'),
  name: 'Burn',
  stackable: true,
  onTurnEnd(ctx: HookCtx): CardEffect[] {
    return [{
      kind: 'Damage',
      targetId: ctx.selfUnitId,
      amount: ctx.selfStacks,
      damageType: 'magic',
      source: asCardId('status:burn'),
    }]
  },
}

/** Slow: -stacks SPD while active (turn order); no on-tick damage. */
const SLOW: StatusEffectDef = {
  id: asStatusEffectId('slow'),
  name: 'Slow',
  stackable: false,
}

/** Immobilize: MOV = 0 while active; no on-tick damage. */
const IMMOBILIZE: StatusEffectDef = {
  id: asStatusEffectId('immobilize'),
  name: 'Immobilize',
  stackable: false,
}

/** Taunt: tracked for AI targeting (enemyAI reads it); no on-tick damage. */
const TAUNT: StatusEffectDef = {
  id: asStatusEffectId('taunt'),
  name: 'Taunt',
  stackable: false,
}

/** Riposte: tracked; retaliation mechanics land with the balance pass. */
const RIPOSTE: StatusEffectDef = {
  id: asStatusEffectId('riposte'),
  name: 'Riposte',
  stackable: false,
}

/**
 * Empower: the unit's NEXT damage card deals +stacks bonus damage, then the
 * status is consumed. Powers "Take Aim" / "Power Stance" / "Steady Aim" style
 * cards. Consumed in the reducer's Damage resolution, not on turn end.
 */
const EMPOWER: StatusEffectDef = {
  id: asStatusEffectId('empower'),
  name: 'Empower',
  stackable: false,
}

export const STATUS_EFFECTS: StatusEffectDef[] = [POISON, BURN, SLOW, IMMOBILIZE, TAUNT, RIPOSTE, EMPOWER]

const byId = new Map<string, StatusEffectDef>(
  STATUS_EFFECTS.map(s => [s.id as unknown as string, s])
)

export function getStatusEffect(id: StatusEffectId): StatusEffectDef | undefined {
  return byId.get(id as unknown as string)
}

/**
 * Pure stacking semantics (ship plan §9):
 * - stackable (burn): stacks ADD; duration refreshes to the longer of the two.
 * - non-stackable (poison, slow, …): reapplying keeps the HIGHER stack value
 *   and refreshes duration.
 * Unknown effect ids default to non-stackable so content never crashes.
 */
export function mergeStatus(
  statuses: readonly ActiveStatus[],
  effectId: StatusEffectId,
  stacks: number,
  turns: number,
  source: UnitId | null,
): ActiveStatus[] {
  const def = getStatusEffect(effectId)
  const stackable = def?.stackable === true
  const idx = statuses.findIndex(s => (s.effectId as unknown as string) === (effectId as unknown as string))
  if (idx === -1) {
    return [...statuses, { effectId, stacks, turnsRemaining: turns, source }]
  }
  const existing = statuses[idx]!
  const merged: ActiveStatus = stackable
    ? {
        ...existing,
        stacks: existing.stacks + stacks,
        turnsRemaining: Math.max(existing.turnsRemaining, turns),
        source,
      }
    : {
        ...existing,
        stacks: Math.max(existing.stacks, stacks),
        turnsRemaining: Math.max(existing.turnsRemaining, turns),
        source,
      }
  const out = statuses.slice()
  out[idx] = merged
  return out
}

export function isImmobilized(unit: Pick<Unit, 'statuses'>): boolean {
  return unit.statuses.some(
    s => (s.effectId as unknown as string) === 'immobilize' && s.turnsRemaining > 0,
  )
}

/** SPD delta from active statuses (slow → −stacks). Used by turn order. */
export function statusSpdDelta(unit: Pick<Unit, 'statuses'>): number {
  let delta = 0
  for (const s of unit.statuses) {
    if ((s.effectId as unknown as string) === 'slow' && s.turnsRemaining > 0) delta -= s.stacks
  }
  return delta
}

/** Active empower bonus (next-attack damage boost), 0 if none. */
export function empowerBonus(unit: Pick<Unit, 'statuses'>): number {
  const s = unit.statuses.find(
    x => (x.effectId as unknown as string) === 'empower' && x.turnsRemaining > 0,
  )
  return s?.stacks ?? 0
}

/** Statuses with the consumed empower removed (call after a damage card resolves). */
export function consumeEmpower(statuses: readonly ActiveStatus[]): ActiveStatus[] {
  return statuses.filter(s => (s.effectId as unknown as string) !== 'empower')
}
