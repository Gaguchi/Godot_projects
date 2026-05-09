import type { CombatState } from '../domain/combatState'
import type { ActionLogEntry } from '../state/actionLog'
import type { SerializedFlag } from '../state/flags'

export const SAVE_VERSION = '0.6.0-cards-only' as const
export type SaveVersion = typeof SAVE_VERSION

export interface SerializedRunState {
  runId: string
  runSeed: number
  partyUnits: unknown[]
  partyOrder: string[]
  inventoryItems: { itemId: string; gridX: number; gridY: number }[]
  gold: number
  worldPosition: { mapId: string; nodeId: string }
  visitedNodes: Record<string, boolean>
  clearedEncounters: Record<string, boolean>
  pendingTravelPath: unknown
  flags: SerializedFlag[]
  questStates: Record<string, { currentStage: string; metadata: Record<string, unknown> }>
  activeDungeon: unknown
  rngState: { seed: number; counter: number }
  deathLog: { unitId: string; cause: string; turn: number }[]
}

export interface SerializedMetaState {
  gameStarted: boolean
  totalRuns: number
}

export interface SaveFile {
  saveVersion: SaveVersion
  createdAt: number
  meta: SerializedMetaState
  run: SerializedRunState | null
  combat: CombatState | null
  actionLog: ActionLogEntry[]
  contentAliasesApplied: string
}
