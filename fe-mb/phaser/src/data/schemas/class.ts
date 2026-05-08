import { z } from 'zod'
import { UnitStatsSchema } from './unit'

export const ClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseStats: UnitStatsSchema,
  growthRates: UnitStatsSchema,
  innateCardIds: z.array(z.string()),
  startingMov: z.number().int().min(1),
  startingHp: z.number().int().min(1),
})
