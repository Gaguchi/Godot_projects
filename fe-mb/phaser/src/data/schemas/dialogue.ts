import { z } from 'zod'
import { PredicateSchema } from './predicate'
import { QuestEffectSchema } from './quest'
import { CheckRequirementSchema } from './check'

export const DialogueChoiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  visibleIf: PredicateSchema.optional(),
  enabledIf: PredicateSchema.optional(),
  effects: z.array(QuestEffectSchema),
  next: z.union([z.string(), z.literal('end')]).optional(),
  check: CheckRequirementSchema.optional(),
  onPass: z.union([z.string(), z.literal('end')]).optional(),
  onFail: z.union([z.string(), z.literal('end')]).optional(),
}).refine(
  (c) => {
    if (c.check === undefined) {
      return c.next !== undefined
    }
    return c.onPass !== undefined && c.onFail !== undefined && c.next === undefined
  },
  {
    message: 'choice must define `next` (no check) OR `check`+`onPass`+`onFail` (no next)',
  },
)

export const DialogueNodeSchema = z.object({
  id: z.string(),
  speaker: z.string().optional(),
  text: z.string(),
  choices: z.array(DialogueChoiceSchema),
  onEnter: z.array(QuestEffectSchema).optional(),
})

export const DialogueTreeSchema = z.object({
  id: z.string(),
  startNodeId: z.string(),
  nodes: z.record(z.string(), DialogueNodeSchema),
})
