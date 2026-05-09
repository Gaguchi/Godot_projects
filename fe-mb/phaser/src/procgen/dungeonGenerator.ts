import type { DungeonGraph, DungeonRoom } from '../domain/map'
import type { RNG } from '../domain/rng'
import { asDungeonId, asNodeId, type NodeId } from '../domain/ids'

export interface DungeonGenerateParams {
  dungeonId: string
  fogOfWar?: DungeonGraph['fogOfWar']
}

export function generateDungeon(rng: RNG, params: DungeonGenerateParams): DungeonGraph {
  // Foundation stub: 3-row linear corridor: row 0 combat → row 1 combat → row 2 boss.
  const r0: DungeonRoom = { id: asNodeId('r0'), type: 'combat', encounterRef: null }
  const r1: DungeonRoom = { id: asNodeId('r1'), type: 'combat', encounterRef: null }
  const r2: DungeonRoom = { id: asNodeId('r2'), type: 'boss', encounterRef: null }

  const seed = rng.state().seed

  return {
    id: asDungeonId(params.dungeonId),
    rows: [[r0], [r1], [r2]],
    edges: [
      [r0.id, r1.id] as [NodeId, NodeId],
      [r1.id, r2.id] as [NodeId, NodeId],
    ],
    entryRow: 0,
    bossRow: 2,
    genSeed: seed,
    fogOfWar: params.fogOfWar ?? 'reveal-on-enter',
  }
}
