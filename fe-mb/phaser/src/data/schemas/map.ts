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
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  tileSize: z.number().int().min(1),
  terrainGrid: z.array(z.array(TerrainTileSchema)),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['town','camp','dungeon','exit']),
    position: z.object({ x: z.number().int(), y: z.number().int() }),
    visiblePredicate: PredicateSchema,
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    encounterTableId: z.string(),
    rollChance: z.number().min(0).max(1),
  })),
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
