import { z } from 'zod'
import { IdSchema, RegionIdSchema } from './common'

/**
 * TOWN (inn/shop/tavern), CAMP (rest/scout), DUNGEON (def keyed by node id),
 * BOSS (the run's end; carries its enemy group), TRAIL (pass-through, auto-walk
 * chains silently once cleared), DISCOVERY (one-time event slot; a decision
 * node the auto-walk pauses at).
 */
export const NodeTypeSchema = z.enum(['TOWN', 'CAMP', 'DUNGEON', 'BOSS', 'TRAIL', 'DISCOVERY'])
export type NodeType = z.infer<typeof NodeTypeSchema>

/** Render hint only; gameplay keys off `type`. */
export const NodeSigilSchema = z.enum(['fortress', 'waypoint', 'bridge', 'shrine', 'battle', 'dungeon', 'boss'])
export type NodeSigil = z.infer<typeof NodeSigilSchema>

export const AreaTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
export type AreaTier = z.infer<typeof AreaTierSchema>

export const OverworldNodeSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    type: NodeTypeSchema,
    regionId: RegionIdSchema,
    /** Difficulty tier of the AREA: authored per node; default = BFS hop distance
     *  from `startNodeId` (0-2 -> 1, 3-5 -> 2, 6+ -> 3), boss forced 3. */
    areaTier: AreaTierSchema,
    /** Sheet pixels (top-left origin). */
    position: z.object({ x: z.number().int().min(0), y: z.number().int().min(0) }).strict(),
    sigil: NodeSigilSchema.optional(),
    /** Not on the map until a `spawnNode` effect reveals it. */
    hidden: z.boolean().optional(),
    /** BOSS only: the final battle's enemy group. */
    enemyGroupId: IdSchema.optional(),
    /** DISCOVERY only: the one-time check event opened on the FIRST arrival (`run/travel.ts#travelStep` LAND).
     *  The lint warns while a DISCOVERY node has none (the discovery deck is owed by WP-CONTENT). */
    discoveryEventId: IdSchema.optional(),
    /** DUNGEON only: `dungeon/enter` is refused until a quest `unlockNode` effect lists the node in
     *  `run.unlockedNodes` (brief §2.11). Lint: every locked node has an `unlockNode` writer and vice versa. */
    locked: z.literal(true).optional(),
    /** This node's OWN board, overriding the region's list for any fight that happens here — the throne hall is
     *  a place, not a draw from the Ashfall deck (0112). */
    battlefieldId: IdSchema.optional(),
  })
  .strict()
  .superRefine((n, ctx) => {
    if (n.type === 'BOSS' && n.enemyGroupId === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['enemyGroupId'], message: `BOSS node '${n.id}' needs an enemyGroupId` })
    if (n.type !== 'BOSS' && n.enemyGroupId !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['enemyGroupId'], message: `only BOSS nodes carry an enemyGroupId ('${n.id}')` })
    if (n.type !== 'DISCOVERY' && n.discoveryEventId !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discoveryEventId'], message: `only DISCOVERY nodes carry a discoveryEventId ('${n.id}')` })
    if (n.type !== 'DUNGEON' && n.locked !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['locked'], message: `only DUNGEON nodes can be locked ('${n.id}')` })
  })
export type OverworldNode = z.infer<typeof OverworldNodeSchema>

/** Undirected. Encounter rolls are per EDGE (brief §2.9). */
export const OverworldEdgeSchema = z
  .object({
    from: IdSchema,
    to: IdSchema,
    encounterTableId: IdSchema,
    /** Override of the region's `encounterChancePerHop`. */
    rollChance: z.number().min(0).max(1).optional(),
  })
  .strict()
  .refine((e) => e.from !== e.to, { message: 'an edge cannot loop onto its own node' })
export type OverworldEdge = z.infer<typeof OverworldEdgeSchema>

export const OverworldSheetSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    startNodeId: IdSchema,
    nodes: z.array(OverworldNodeSchema).min(1),
    edges: z.array(OverworldEdgeSchema).min(1),
  })
  .strict()
  .superRefine((sheet, ctx) => {
    const ids = sheet.nodes.map((n) => n.id)
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodes'], message: 'node ids must be unique' })
    const bosses = sheet.nodes.filter((n) => n.type === 'BOSS')
    if (bosses.length !== 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodes'], message: `exactly one BOSS node (found ${bosses.length})` })
    const keys = sheet.edges.map((e) => [e.from, e.to].sort().join('|'))
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['edges'], message: 'duplicate undirected edge' })
  })
export type OverworldSheet = z.infer<typeof OverworldSheetSchema>
