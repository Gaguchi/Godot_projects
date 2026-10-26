import { z } from 'zod'
import { CheckRequirementSchema } from './check'
import { IdSchema } from './common'
import { QuestEffectSchema } from './questEffect'

export const CheckEventOutcomeSchema = z
  .object({ narration: z.string().min(1), effects: z.array(QuestEffectSchema) })
  .strict()
export type CheckEventOutcome = z.infer<typeof CheckEventOutcomeSchema>

/** `check` requires `onFail` (the third superRefine the brief keeps). */
export const CheckEventChoiceSchema = z
  .object({
    id: IdSchema,
    text: z.string().min(1),
    check: CheckRequirementSchema.optional(),
    onPass: CheckEventOutcomeSchema,
    onFail: CheckEventOutcomeSchema.optional(),
  })
  .strict()
  .refine((c) => c.check === undefined || c.onFail !== undefined, { message: 'choice with `check` must define `onFail`' })
  .refine((c) => c.check !== undefined || c.onFail === undefined, { message: 'choice without `check` must not define `onFail`' })
export type CheckEventChoice = z.infer<typeof CheckEventChoiceSchema>

/** One id-keyed registry serves travel encounters, dungeon event rooms and post-victory events. */
export const CheckEventSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    choices: z.array(CheckEventChoiceSchema).min(1),
  })
  .strict()
  .refine((ev) => new Set(ev.choices.map((c) => c.id)).size === ev.choices.length, { message: 'choice ids must be unique' })
export type CheckEvent = z.infer<typeof CheckEventSchema>
