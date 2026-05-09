import { z } from 'zod'
import { PredicateSchema } from './predicate'

export const TerrainTileSchema = z.object({
  kind: z.enum(['plain','forest','mountain','water','road','fortress']),
  defBonus: z.number().int(),
  resBonus: z.number().int(),
  movementCost: z.number().int().min(0),
  impassable: z.boolean(),
  blocksLOS: z.boolean(),
})

export const WorldMapSchema = z.object({
  id: z.string(),
  /** GP-D1: maps belong to a Region (driving encounter difficulty + UI tint). */
  regionId: z.string().optional(),
  name: z.string().optional(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  tileSize: z.number().int().min(1).optional(),
  terrainGrid: z.array(z.array(TerrainTileSchema)).optional(),
  nodes: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    type: z.enum(['town','camp','dungeon','exit']),
    position: z.object({ x: z.number().int(), y: z.number().int() }),
    spawnPoint: z.boolean().optional(),
    encounterTableId: z.string().optional(),
    visiblePredicate: PredicateSchema.optional(),
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    encounterTableId: z.string(),
    rollChance: z.number().min(0).max(1),
  })),
  /** GP-D4: edges that cross region boundaries. fromMapId/toMapId reference world map ids. */
  regionEdges: z.array(z.object({
    fromMapId: z.string(),
    fromNodeId: z.string(),
    toMapId: z.string(),
    toNodeId: z.string(),
    rollChance: z.number().min(0).max(1),
  })).optional(),
})

export const BattleMapSchema = z.object({
  id: z.string(),
  width: z.literal(14),
  height: z.literal(10),
  terrain: z.array(z.array(TerrainTileSchema)),
  spawnZones: z.object({
    party: z.array(z.string()),
    enemy: z.array(z.string()),
  }),
  obstacles: z.array(z.string()),
  source: z.enum(['handcrafted','procgen-template']),
})
