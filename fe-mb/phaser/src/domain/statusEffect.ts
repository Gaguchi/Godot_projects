import type { StatusEffectId, UnitId } from './ids'
import type { CardEffect, DamageKind } from './card'

export interface HookCtx {
  selfUnitId: UnitId
  selfStacks: number
  selfTurnsRemaining: number
}

export interface StatusEffectDef {
  id: StatusEffectId
  name: string
  stackable: boolean
  onApply?(ctx: HookCtx): CardEffect[]
  onTurnStart?(ctx: HookCtx): CardEffect[]
  onTurnEnd?(ctx: HookCtx): CardEffect[]
  onDamageTaken?(ctx: HookCtx, dmg: number, kind: DamageKind): { dmg: number; effects: CardEffect[] }
  onDamageDealt?(ctx: HookCtx, dmg: number): { dmg: number; effects: CardEffect[] }
  onTick?(ctx: HookCtx): CardEffect[]
  interactsWith?: Partial<Record<StatusEffectId, 'remove' | 'consume' | 'amplify'>>
}
