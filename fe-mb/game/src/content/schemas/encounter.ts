import { z } from 'zod'
import { IdSchema, RegionIdSchema } from './common'
import { PredicateSchema } from './predicate'

/** Named enemy whose fate (captured/killed) sets a flag and opens a dialogue. */
export const CaptureTargetSchema = z
  .object({
    /** Must be a member id of the battle's enemy group. */
    unitId: IdSchema,
    capturedDialogueId: IdSchema,
    killedDialogueId: IdSchema,
    capturedFlag: IdSchema,
    killedFlag: IdSchema,
  })
  .strict()
export type CaptureTarget = z.infer<typeof CaptureTargetSchema>

export const EncounterOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('dialogue'), dialogueId: IdSchema }).strict(),
  z.object({ kind: z.literal('battle'), enemyGroupId: IdSchema, captureTargets: z.array(CaptureTargetSchema).min(1).optional() }).strict(),
  z.object({ kind: z.literal('checkEvent'), checkEventId: IdSchema }).strict(),
])
export type EncounterOutcome = z.infer<typeof EncounterOutcomeSchema>

export const EncounterEntrySchema = z
  .object({
    /** Globally unique across tables: `cleared{encounterId}` and `oneShotsFired` key on it. */
    id: IdSchema,
    weight: z.number().int().min(1),
    oneShot: z.boolean(),
    conditions: z.array(PredicateSchema),
    outcome: EncounterOutcomeSchema,
  })
  .strict()
export type EncounterEntry = z.infer<typeof EncounterEntrySchema>

export const EncounterTableSchema = z
  .object({
    id: IdSchema,
    regionId: RegionIdSchema,
    entries: z.array(EncounterEntrySchema).min(1),
  })
  .strict()
  .refine((t) => new Set(t.entries.map((e) => e.id)).size === t.entries.length, { message: 'entry ids must be unique within a table' })
export type EncounterTable = z.infer<typeof EncounterTableSchema>
