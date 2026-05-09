import type { WorldMap, BattleMap, MapNodeRef, DungeonGraph, MapKind } from '../domain/map'
import type { MapId, DungeonId } from '../domain/ids'
import type { RNG } from '../domain/rng'

export type DungeonGenerator = (rng: RNG) => DungeonGraph

export interface MapRegistry {
  overworld: Record<string, WorldMap>
  battleTemplates: Record<string, BattleMap>
  dungeonGenerators: Record<string, DungeonGenerator>
  resolveRef(ref: MapNodeRef): {
    mapKind: MapKind
    mapId: MapId | DungeonId
    nodeId: string
  } | null
  validate(): { ok: true } | { ok: false; issues: string[] }
}

export function createMapRegistry(input: {
  overworld?: Record<string, WorldMap>
  battleTemplates?: Record<string, BattleMap>
  dungeonGenerators?: Record<string, DungeonGenerator>
}): MapRegistry {
  const overworld = input.overworld ?? {}
  const battleTemplates = input.battleTemplates ?? {}
  const dungeonGenerators = input.dungeonGenerators ?? {}

  return {
    overworld, battleTemplates, dungeonGenerators,

    resolveRef(ref) {
      switch (ref.mapKind) {
        case 'overworld': {
          const m = overworld[ref.mapId as unknown as string]
          if (!m) return null
          const node = m.nodes.find(n => n.id === ref.nodeId)
          return node ? { mapKind: 'overworld', mapId: ref.mapId, nodeId: ref.nodeId as unknown as string } : null
        }
        case 'battle': {
          const m = battleTemplates[ref.mapId as unknown as string]
          if (!m) return null
          return { mapKind: 'battle', mapId: ref.mapId, nodeId: ref.nodeId as unknown as string }
        }
        case 'dungeon':
          // dungeon refs resolve at runtime against the active dungeon graph, not the registry
          return null
      }
    },

    validate() {
      const issues: string[] = []
      // Ensure every world edge references existing nodes
      for (const [mapId, wm] of Object.entries(overworld)) {
        const nodeIds = new Set(wm.nodes.map(n => n.id as unknown as string))
        for (const e of wm.edges) {
          if (!nodeIds.has(e.from as unknown as string)) issues.push(`${mapId}: edge from unknown node ${e.from as unknown as string}`)
          if (!nodeIds.has(e.to as unknown as string)) issues.push(`${mapId}: edge to unknown node ${e.to as unknown as string}`)
        }
      }
      return issues.length === 0 ? { ok: true } : { ok: false, issues }
    },
  }
}
