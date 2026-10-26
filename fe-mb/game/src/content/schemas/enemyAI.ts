import { z } from 'zod'
import { DamageStatSchema, IdSchema, RangeSchema, StatusIdSchema } from './common'

export const EnemyRoleSchema = z.enum(['rusher', 'archer', 'healer', 'tank'])
export type EnemyRole = z.infer<typeof EnemyRoleSchema>

/** self/target HP < 40%; ally_wounded = any ally hp < max. */
export const AiSituationSchema = z.enum(['always', 'self_low_hp', 'ally_wounded', 'target_low_hp'])
export type AiSituation = z.infer<typeof AiSituationSchema>

/** Status rider on an enemy action (brief §2.5 / lesson 21). */
export const AiApplyStatusSchema = z
  .object({ effectId: StatusIdSchema, value: z.number().int().min(1), turns: z.number().int().min(1) })
  .strict()
export type AiApplyStatus = z.infer<typeof AiApplyStatusSchema>

/**
 * - `attack`: `amount + stat` damage to the target (and every foe within
 *   `aoeRadius`); `applyStatus` lands on every unit hit.
 * - `heal`: `amount` HP to the chosen ally.
 * - `buff`: no damage (amount 0, range 0-0 = self-centred); `applyStatus` lands
 *   on the actor and every ally within `aoeRadius`.
 */
export const EnemyActionSchema = z
  .object({
    id: IdSchema,
    kind: z.enum(['attack', 'heal', 'buff']),
    range: RangeSchema,
    amount: z.number().int().min(0),
    damageStat: DamageStatSchema.nullable(),
    weight: z.number().int().min(1),
    situation: AiSituationSchema,
    aoeRadius: z.number().int().min(1).max(2).optional(),
    applyStatus: AiApplyStatusSchema.optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    if (a.kind === 'attack' && (a.damageStat === null || a.amount < 1)) issue('amount', `attack '${a.id}' needs amount >= 1 and a damageStat`)
    if (a.kind === 'heal' && (a.damageStat !== null || a.amount < 1)) issue('amount', `heal '${a.id}' needs amount >= 1 and damageStat null`)
    if (a.kind === 'buff' && (a.applyStatus === undefined || a.amount !== 0 || a.damageStat !== null)) issue('applyStatus', `buff '${a.id}' needs applyStatus, amount 0 and damageStat null`)
    if (a.kind === 'buff' && a.range.max !== 0) issue('range', `buff '${a.id}' is self-centred: range must be 0-0`)
  })
export type EnemyAction = z.infer<typeof EnemyActionSchema>

export const EnemyAIProfileSchema = z
  .object({
    classId: IdSchema,
    role: EnemyRoleSchema,
    movement: z.number().int().min(0),
    /** Archers/healers hold this distance from their target. */
    preferredRange: RangeSchema.optional(),
    actions: z.array(EnemyActionSchema).min(1),
  })
  .strict()
export type EnemyAIProfile = z.infer<typeof EnemyAIProfileSchema>
