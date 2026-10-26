import { z } from 'zod'
import { IdSchema } from './common'

/**
 * A BATTLEFIELD is the authored half of a board: the tiles nothing may stand on or walk through.
 *
 * DECISIONS' `terrain: off` knob reads "flat boards, AUTHORED obstacles, cosmetic floor", and until 0112 the
 * second word had no channel at all — `run/battle.ts` handed every non-tutorial fight `obstacles: []`, so the whole
 * tactical layer was a bare rectangle with no cover, no chokepoint and no reason to prefer one tile to another
 * (RE-GATE C 3.17). This is that channel. A board is named and reusable: a region lists the fields its roads are
 * fought on, a dungeon the ones its rooms are, and a single node may name its own (the throne hall).
 *
 * `obstacles` are `[x, y]` pairs on the `rules.combat.grid` board. Everything a board must OBEY —
 * in bounds, off the deployment slots, and one connected walkable region — is an authoring gate in
 * `engine/content.ts#createEnv`, beside the BOSS-distance and area-tier gates, because those rules need
 * `rules` and this file may not see them.
 */
export const BattlefieldSchema = z
  .object({
    id: IdSchema,
    /** Title Case, the way every named thing is (ARCHITECTURE §5.1) — it is a place. */
    name: z.string().min(1),
    /** `[x, y]` tiles that are not floor. An empty list is a legal, deliberately bare field. */
    obstacles: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])),
  })
  .strict()
  .refine((b) => new Set(b.obstacles.map(([x, y]) => `${x},${y}`)).size === b.obstacles.length, {
    message: 'obstacle tiles must be unique',
  })
export type Battlefield = z.infer<typeof BattlefieldSchema>
