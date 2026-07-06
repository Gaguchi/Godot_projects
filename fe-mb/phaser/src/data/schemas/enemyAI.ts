import { z } from 'zod'

export const EnemyRoleSchema = z.enum(['rusher', 'archer', 'healer', 'tank'])

export const EnemyActionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['attack', 'heal']),
  range: z.object({ min: z.number().int().nonnegative(), max: z.number().int().min(1) }),
  amount: z.number().int(),
  damageStat: z.enum(['str', 'mag', 'skl']).nullable(),
  weight: z.number().int().nonnegative(),
  situation: z.enum(['always', 'self_low_hp', 'ally_wounded', 'target_low_hp']).optional(),
  /** Attack splashes to tiles within this radius of the target (boss sweeps). */
  aoeRadius: z.number().int().min(0).optional(),
})

export const EnemyClassAISchema = z.object({
  classId: z.string(),
  role: EnemyRoleSchema,
  actions: z.array(EnemyActionSchema).min(1),
  movement: z.number().int().min(0),
  preferredRange: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().min(1),
  }).optional(),
})
