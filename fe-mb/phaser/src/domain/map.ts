import type { MapId, NodeId, TileId, EncounterTableId, DungeonId, ClassId, EnemyGroupId } from './ids'
import type { Predicate } from './predicate'

export type MapKind = 'overworld' | 'dungeon' | 'battle'

export interface MapNodeRef {
  mapKind: MapKind
  mapId: MapId
  nodeId: NodeId
}

export interface TerrainTile {
  kind: 'plain' | 'forest' | 'mountain' | 'water' | 'road' | 'fortress'
  defBonus: number
  resBonus: number
  movementCost: number
  impassable: boolean
  blocksLOS: boolean
}

// --- Overworld ---

export interface WorldNode {
  id: NodeId
  type: 'town' | 'camp' | 'dungeon' | 'exit'
  position: { x: number; y: number }
  visiblePredicate: Predicate
}

export interface WorldEdge {
  from: NodeId
  to: NodeId
  encounterTableId: EncounterTableId
  rollChance: number   // [0, 1]
}

export interface WorldMap {
  id: MapId
  width: number
  height: number
  tileSize: number
  terrainGrid: TerrainTile[][]   // [y][x]
  nodes: WorldNode[]
  edges: WorldEdge[]
}

// --- Battle ---

export interface BattleMap {
  id: MapId
  width: 14
  height: 10
  terrain: TerrainTile[][]            // [y][x]
  spawnZones: { party: TileId[]; enemy: TileId[] }
  obstacles: TileId[]
  source: 'handcrafted' | 'procgen-template'
}

// --- Dungeon (Slay the Spire-style) ---

export interface DungeonRoom {
  id: NodeId
  type: 'combat' | 'elite' | 'rest' | 'shop' | 'event' | 'treasure' | 'boss'
  encounterRef: MapNodeRef | null
}

export interface DungeonGraph {
  id: DungeonId
  rows: DungeonRoom[][]               // rows[0] = entry; rows[bossRow] = boss
  edges: Array<[NodeId, NodeId]>      // monotonic — each edge advances one row
  entryRow: 0
  bossRow: number
  genSeed: number                     // independent from runSeed
  fogOfWar: 'full' | 'lookahead-1' | 'reveal-on-enter'
}

// Enemy group ref (used by battle setup)
export interface EnemyGroupRef {
  id: EnemyGroupId
  enemies: { classId: ClassId; level: number }[]
}
