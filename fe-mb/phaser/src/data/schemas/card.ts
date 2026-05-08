import { z } from 'zod'

export const WeaponTypeSchema = z.enum(['sword','lance','axe','bow','crossbow','tome','staff'])

export const CardSchema = z.object({
  id: z.string(),
  name: z.string(),
  apCost: z.number().int().min(0),
  effects: z.array(z.object({
    kind: z.string(),
    params: z.record(z.string(), z.unknown()),
  })),
  range: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }),
  targetKind: z.enum(['enemy','ally','self','tile','all_enemies','all_allies']),
  aoeRadius: z.number().int().min(0).optional(),
  weaponType: WeaponTypeSchema.nullable(),
  damageStat: z.enum(['str','mag','skl']).optional(),
})

export type CardInput = z.infer<typeof CardSchema>
