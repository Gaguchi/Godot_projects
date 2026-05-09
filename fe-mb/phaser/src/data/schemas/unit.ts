import { z } from 'zod'

export const UnitStatsSchema = z.object({
  str: z.number().int(), mag: z.number().int(), skl: z.number().int(),
  spd: z.number().int(), def: z.number().int(), res: z.number().int(),
})

export const UnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  classId: z.string(),
  level: z.number().int().min(1),
  hp: z.object({ current: z.number().int().min(0), max: z.number().int().min(1) }),
  stats: UnitStatsSchema,
  position: z.string().nullable(),
  ap: z.number().int().min(0),
  armor: z.number().int().min(0),
  statuses: z.array(z.object({
    effectId: z.string(),
    stacks: z.number().int().min(0),
    turnsRemaining: z.number().int().min(0),
    source: z.string().nullable(),
  })),
})
