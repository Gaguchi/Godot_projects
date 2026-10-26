import { z } from 'zod'
import { IdSchema, RegionIdSchema } from './common'
import { CaptureTargetSchema } from './encounter'

/** Trimmed per brief §2.11: no floors/theme/fogOfWar. Rooms are procgen per (runSeed, dungeonId). */
export const DungeonDefSchema = z
  .object({
    /** Also the overworld DUNGEON node id. */
    id: IdSchema,
    name: z.string().min(1),
    /** Drives enemy scaling tier and the loot rows. */
    regionId: RegionIdSchema,
    combatEnemyGroupId: IdSchema,
    eliteEnemyGroupId: IdSchema,
    bossEnemyGroupId: IdSchema,
    /** Named enemies in the BOSS room's group whose fate sets a flag and opens a scene (CONTRACT-CHANGES 0030). */
    bossCaptureTargets: z.array(CaptureTargetSchema).min(1).optional(),
    /** Check-event ids drawn by Event rooms; empty = the engine's gold fallback. */
    roomEvents: z.array(IdSchema),
    /** The `battlefields.json` boards this dungeon's ROOMS are fought on; drawn per room (0112). */
    battlefieldIds: z.array(IdSchema).min(1),
  })
  .strict()
export type DungeonDef = z.infer<typeof DungeonDefSchema>
