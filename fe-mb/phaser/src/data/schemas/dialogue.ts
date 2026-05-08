import { z } from 'zod'
import { PredicateSchema } from './predicate'
import { QuestEffectSchema } from './quest'

export const DialogueChoiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  visibleIf: PredicateSchema.optional(),
  enabledIf: PredicateSchema.optional(),
  effects: z.array(QuestEffectSchema),
  next: z.union([z.string(), z.literal('end')]),
})

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
