import type { StatusEffectDef, HookCtx } from '../domain/statusEffect'
import type { CardEffect } from '../domain/card'
import { asStatusEffectId, asCardId, type StatusEffectId } from '../domain/ids'

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

export const STATUS_EFFECTS: StatusEffectDef[] = [POISON, BURN]

const byId = new Map<string, StatusEffectDef>(
  STATUS_EFFECTS.map(s => [s.id as unknown as string, s])
)

export function getStatusEffect(id: StatusEffectId): StatusEffectDef | undefined {
  return byId.get(id as unknown as string)
}
