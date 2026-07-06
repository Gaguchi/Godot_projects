import type { SaveFile, SerializedRunState, SerializedMetaState } from './saveFormat'
import { SAVE_VERSION } from './saveFormat'
import { CONTENT_ALIASES_VERSION } from './contentAliases'
import type { RunState } from '../state/runStore'
import type { CombatState } from '../domain/combatState'
import type { ActionLogEntry } from '../state/actionLog'

export function serializeRun(run: RunState | null): SerializedRunState | null {
  if (!run) return null
  return {
    runId: run.runId,
    runSeed: run.runSeed,
    partyUnits: Object.values(run.party.units),
    partyOrder: run.party.partyOrder.map(id => id as unknown as string),
    inventoryItems: run.inventory.items.map(i => ({
      itemId: i.itemId as unknown as string,
      gridX: i.gridX,
      gridY: i.gridY,
    })),
    gold: run.gold,
    worldPosition: {
      mapId: run.worldPosition.mapId as unknown as string,
      nodeId: run.worldPosition.nodeId as unknown as string,
    },
    visitedNodes: { ...run.visitedNodes },
    clearedEncounters: { ...run.clearedEncounters },
    pendingTravelPath: run.pendingTravelPath,
    flags: run.flags.serialize(),
    questStates: { ...run.questStates },
    activeDungeon: run.activeDungeon ? {
      ...run.activeDungeon,
      clearedRooms: Array.from(run.activeDungeon.clearedRooms),
    } : null,
    rngState: { ...run.rngState },
    deathLog: run.deathLog.map(d => ({
      unitId: d.unitId as unknown as string, cause: d.cause, turn: d.turn,
    })),
    runStats: { ...run.runStats },
    daysElapsed: run.daysElapsed,
    oneShotsFired: Array.from(run.oneShotsFired),
  }
}

export function buildSaveFile(input: {
  meta: SerializedMetaState
  run: RunState | null
  combat: CombatState | null
  actionLog: ActionLogEntry[]
}): SaveFile {
  return {
    saveVersion: SAVE_VERSION,
    createdAt: Date.now(),
    meta: input.meta,
    run: serializeRun(input.run),
    combat: input.combat,
    actionLog: input.actionLog,
    contentAliasesApplied: CONTENT_ALIASES_VERSION,
  }
}

export function saveToString(save: SaveFile): string {
  return JSON.stringify(save)
}
