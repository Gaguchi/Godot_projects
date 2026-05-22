import { z } from 'zod'
import { PredicateSchema } from './predicate'

export const TavernQuestEntrySchema = z.object({
  questId: z.string(),
  npcName: z.string(),
  npcDescription: z.string(),
  dialogueId: z.string(),
  visibleIf: PredicateSchema.optional(),
})

export const TavernRecruitEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  classId: z.string(),
  level: z.number().int().min(1),
  description: z.string().optional(),
  costOverride: z.number().int().min(0).optional(),
  visibleIf: PredicateSchema.optional(),
})

export const TownDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  regionId: z.string().optional(),
  innHealCostPerUnit: z.number().int().min(1),
  shopStockIds: z.array(z.string()),
  rumors: z.array(z.string()),
  tavernQuests: z.array(TavernQuestEntrySchema),
  recruits: z.array(TavernRecruitEntrySchema).optional(),
  blacksmithEnabled: z.boolean(),
  arenaLocked: z.boolean(),
  arenaLockedText: z.string().optional(),
})
