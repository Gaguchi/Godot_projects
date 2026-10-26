import { z } from 'zod'
import { IdSchema, RegionIdSchema } from './common'

/** Regions are AREAS of the one open sheet; `tier` drives dungeon loot rows and enemy scaling. */
export const RegionSchema = z
  .object({
    id: RegionIdSchema,
    name: z.string().min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected hex color like #1a2b3c'),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** Per-hop encounter roll chance for edges without an override (DECISIONS: 0.25 / 0.40 / 0.55). */
    encounterChancePerHop: z.number().min(0).max(1),
    /** The `battlefields.json` boards a ROAD fight in this area is fought on; one is drawn per battle from the
     *  battle's own labelled stream, so the same road is the same field on every replay (0112). */
    battlefieldIds: z.array(IdSchema).min(1),
  })
  .strict()
export type RegionDef = z.infer<typeof RegionSchema>
