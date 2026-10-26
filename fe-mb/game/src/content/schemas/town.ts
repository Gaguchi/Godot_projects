import { z } from 'zod'
import { IdSchema, RegionIdSchema } from './common'
import { PredicateSchema } from './predicate'

/** The tavern quest board — also the only quest turn-in surface (brief §2.10). */
export const TavernQuestEntrySchema = z
  .object({
    questId: IdSchema,
    npcName: z.string().min(1),
    npcDescription: z.string().min(1),
    dialogueId: IdSchema,
    visibleIf: PredicateSchema.optional(),
  })
  .strict()
export type TavernQuestEntry = z.infer<typeof TavernQuestEntrySchema>

/** No recruits (companions come from quests), no arena, no blacksmith. */
export const TownDefSchema = z
  .object({
    /** Also the overworld TOWN node id. */
    id: IdSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    regionId: RegionIdSchema,
    innHealCostPerUnit: z.number().int().min(1),
    /** Always-stocked ids; the shop adds region gear by rarity gate and potions everywhere. */
    shopStockIds: z.array(IdSchema),
    rumors: z.array(z.string().min(1)),
    tavernQuests: z.array(TavernQuestEntrySchema),
  })
  .strict()
export type TownDef = z.infer<typeof TownDefSchema>
