import { z } from 'zod'

export const StatKeySchema = z.enum(['str', 'mag', 'skl', 'spd', 'def', 'res', 'lck'])

export const CheckRequirementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stat'),
    stat: StatKeySchema,
    threshold: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('class'),
    classId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('gold'),
    amount: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('food'),
    amount: z.number().int().nonnegative(),
  }),
])

export type CheckRequirementParsed = z.infer<typeof CheckRequirementSchema>
