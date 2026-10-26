import { z } from 'zod'
import { IdSchema, StatKeySchema } from './common'

/**
 * Deterministic, single-unit checks (brief §2.12): `stat` passes iff the
 * attempting LIVING unit's stat >= threshold; `class` = any living member of
 * that class; `gold`/`food` compare party totals.
 */
export const CheckRequirementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stat'), stat: StatKeySchema, threshold: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal('class'), classId: IdSchema }).strict(),
  z.object({ kind: z.literal('gold'), amount: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal('food'), amount: z.number().int().min(0) }).strict(),
])
export type CheckRequirement = z.infer<typeof CheckRequirementSchema>
