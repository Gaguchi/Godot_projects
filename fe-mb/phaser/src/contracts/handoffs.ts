import type { NodeId, MapId, EnemyGroupId, DungeonId } from '../domain/ids'
import type { RngState } from '../domain/rng'

export interface PendingTravelPath {
  remainingNodeIds: NodeId[]
  totalHopsThisLeg: number
  rngBranch: RngState
}

export interface CombatBootRequest {
  battleId: string
  battleMapId: MapId
  enemyGroupId: EnemyGroupId
  rngSeed: RngState
  triggeringHopIndex: number | null
  returnTo:
    | { sceneId: 'overworld'; resumeWith: PendingTravelPath }
    | { sceneId: 'dungeon'; resumeWith: { dungeonId: DungeonId; nodeId: NodeId } }
}
