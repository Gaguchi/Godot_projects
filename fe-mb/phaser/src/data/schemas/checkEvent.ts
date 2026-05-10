import { z } from 'zod'
import { CheckRequirementSchema } from './check'
import { QuestEffectSchema } from './quest'

const CheckEventOutcomeSchema = z.object({
  narration: z.string(),
  effects: z.array(QuestEffectSchema).default([]),
})

const CheckEventChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  check: CheckRequirementSchema.optional(),
  onPass: CheckEventOutcomeSchema,
  onFail: CheckEventOutcomeSchema.optional(),
}).refine(
  (c) => c.check === undefined || c.onFail !== undefined,
  { message: 'choice with `check` must define `onFail`' },
)

export const CheckEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  choices: z.array(CheckEventChoiceSchema).min(1),
})

export type CheckEventParsed = z.infer<typeof CheckEventSchema>
