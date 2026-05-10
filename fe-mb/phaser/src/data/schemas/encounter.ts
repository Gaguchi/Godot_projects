import { z } from 'zod'
import { PredicateSchema } from './predicate'
import { CheckEventSchema } from './checkEvent'

const CaptureTargetSchema = z.object({
  unitName: z.string(),
  capturedDialogueId: z.string(),
  killedDialogueId: z.string(),
  capturedFlag: z.string(),
  killedFlag: z.string(),
})

const EncounterOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('dialogue'), dialogueId: z.string() }),
  z.object({
    kind: z.literal('battle'),
    enemyGroupId: z.string(),
    captureTargets: z.array(CaptureTargetSchema).optional(),
  }),
  z.object({
    kind: z.literal('checkEvent'),
    event: CheckEventSchema,
  }),
])

export const EncounterEntrySchema = z.object({
  id: z.string(),
  weight: z.number().positive(),
  oneShot: z.boolean(),
  conditions: z.array(PredicateSchema),
  outcome: EncounterOutcomeSchema,
})

export const EncounterTableSchema = z.object({
  id: z.string(),
  regionId: z.string().optional(),
  entries: z.array(EncounterEntrySchema),
})

export const EnemyGroupMemberSchema = z.object({
  name: z.string(),
  classId: z.string(),
  level: z.number().int().min(1),
  count: z.number().int().min(1),
  isCaptureTarget: z.boolean().optional(),
  bountyValue: z.number().int().min(0).optional(),
})

export const EnemyGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(EnemyGroupMemberSchema).min(1),
})
