import { z } from 'zod'
import { IdSchema } from './common'

export const EnemyGroupMemberSchema = z
  .object({
    /** Stable unit id for named members (`daren`, `wolf`, `brigand_chief`). The
     *  seeder uses it verbatim (count 1) or suffixed `_N` (packs); it drives
     *  sprite lookup and capture-target matching. Absent -> `<groupId>_<idx>`. */
    id: IdSchema.optional(),
    name: z.string().min(1),
    classId: IdSchema,
    /** Authored floor; the seeder takes max(level, area level). */
    level: z.number().int().min(1),
    count: z.number().int().min(1),
    /** Bounty-board override; absent -> bountyFor(level) 20/40/60. */
    bountyValue: z.number().int().min(1).optional(),
    /** Starting armor on the board (the boss's plate, throne guards); absent -> 0. Read by `combat/seed.ts#buildEnemyUnits`. */
    armor: z.number().int().min(1).optional(),
  })
  .strict()
export type EnemyGroupMember = z.infer<typeof EnemyGroupMemberSchema>

export const EnemyGroupSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    members: z.array(EnemyGroupMemberSchema).min(1),
    /** Check event opened after victory, keyed on the GROUP. */
    victoryEvent: IdSchema.optional(),
  })
  .strict()
  .superRefine((g, ctx) => {
    const ids = g.members.flatMap((m) => (m.id ? [m.id] : []))
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['members'], message: `group '${g.id}' repeats a member id` })
  })
export type EnemyGroup = z.infer<typeof EnemyGroupSchema>
