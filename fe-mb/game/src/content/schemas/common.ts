import { z } from 'zod'

/** Every content id is snake_case. `__complete__` (leading underscore) is
 *  rejected on purpose: the quest-complete sentinel is engine-owned. */
export const IdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are lower snake_case')

export const StatKeySchema = z.enum(['str', 'mag', 'skl', 'spd', 'def', 'res', 'lck'])
export type StatKey = z.infer<typeof StatKeySchema>

export const DamageStatSchema = z.enum(['str', 'mag', 'skl'])
export type DamageStat = z.infer<typeof DamageStatSchema>

export const UnitStatsSchema = z
  .object({
    str: z.number().int(),
    mag: z.number().int(),
    skl: z.number().int(),
    spd: z.number().int(),
    def: z.number().int(),
    res: z.number().int(),
    lck: z.number().int(),
  })
  .strict()
export type UnitStats = z.infer<typeof UnitStatsSchema>

/** The seven fixed-number statuses (brief §2.4). `armor` is a unit field, not a status. */
export const StatusIdSchema = z.enum(['poison', 'burn', 'slow', 'immobilize', 'taunt', 'riposte', 'empower'])
export type StatusId = z.infer<typeof StatusIdSchema>

export const RangeSchema = z
  .object({ min: z.number().int().min(0), max: z.number().int().min(0) })
  .strict()
  .refine((r) => r.min <= r.max, { message: 'range.min must be <= range.max' })
export type Range = z.infer<typeof RangeSchema>

/** `mapId` is the overworld sheet id (`world`) or a dungeon id. */
export const MapNodeRefSchema = z
  .object({ mapKind: z.enum(['overworld', 'dungeon']), mapId: IdSchema, nodeId: IdSchema })
  .strict()
export type MapNodeRef = z.infer<typeof MapNodeRefSchema>

export const FlagValueSchema = z.union([z.boolean(), z.number(), z.string()])
export type FlagValue = z.infer<typeof FlagValueSchema>

export const FlagScopeSchema = z.enum(['run', 'quest', 'battle', 'permanent'])
export type FlagScope = z.infer<typeof FlagScopeSchema>

export const RegionIdSchema = z.enum(['borderlands', 'thornwood', 'ashfall'])
export type RegionId = z.infer<typeof RegionIdSchema>
