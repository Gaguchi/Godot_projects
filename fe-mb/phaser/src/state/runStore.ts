import { create } from 'zustand'
import { createFlagStore, type TypedFlagStore } from './flags'
import type { Unit } from '../domain/unit'
import type { UnitId, ItemId, NodeId, MapId, FlagKey, QuestId, StageId, DungeonId } from '../domain/ids'
import type { FlagScope } from '../domain/quest'
import type { BattleResult, PendingTravelPath } from '../contracts'
import type { DungeonGraph } from '../domain/map'
import type { RngState } from '../domain/rng'

export interface RunState {
  runId: string
  runSeed: number
  party: { units: Record<string, Unit>; partyOrder: UnitId[] }
  inventory: { items: { itemId: ItemId; gridX: number; gridY: number }[] }
  gold: number
  worldPosition: { mapId: MapId; nodeId: NodeId }
  visitedNodes: Record<string, boolean>
  clearedEncounters: Record<string, boolean>
  pendingTravelPath: PendingTravelPath | null
  flags: TypedFlagStore
  questStates: Record<string, { currentStage: string; metadata: Record<string, unknown> }>
  activeDungeon: { dungeonId: DungeonId; graph: DungeonGraph; position: NodeId; clearedRooms: Set<NodeId> } | null
  rngState: RngState
  deathLog: { unitId: UnitId; cause: string; turn: number }[]
}

export type RunAction =
  | { type: 'recruitUnit'; payload: { unit: Unit } }
  | { type: 'fallenUnit'; payload: { unitId: UnitId; cause: string; turn: number } }
  | { type: 'equipHand'; payload: { unitId: UnitId; slot: 'left' | 'right'; itemId: ItemId | null } }
  | { type: 'moveItemInBag'; payload: { itemId: ItemId; x: number; y: number } }
  | { type: 'addGold'; payload: { amount: number } }
  | { type: 'arriveAtNode'; payload: { nodeId: NodeId } }
  | { type: 'startTravelPath'; payload: { path: PendingTravelPath } }
  | { type: 'consumeTravelHop'; payload: { hopIndex: number } }
  | { type: 'enterDungeon'; payload: { dungeonId: DungeonId; graph: DungeonGraph } }
  | { type: 'advanceDungeonRoom'; payload: { roomId: NodeId } }
  | { type: 'exitDungeon' }
  | { type: 'setFlag'; payload: { key: FlagKey; value: unknown; scope?: FlagScope } }
  | { type: 'clearFlagsByScope'; payload: { scope: FlagScope } }
  | { type: 'advanceQuestStage'; payload: { questId: QuestId; toStage: StageId } }
  | { type: 'applyBattleResult'; payload: { result: BattleResult } }

interface RunStateWithDispatch extends RunState {
  dispatch(action: RunAction): void
  __resetForTest(): void
}

function freshState(): RunState {
  return {
    runId: 'run-' + Date.now(),
    runSeed: 0,
    party: { units: {}, partyOrder: [] },
    inventory: { items: [] },
    gold: 0,
    worldPosition: { mapId: 'test_overworld' as unknown as MapId, nodeId: 'pine' as unknown as NodeId },
    visitedNodes: {},
    clearedEncounters: {},
    pendingTravelPath: null,
    flags: createFlagStore(),
    questStates: {},
    activeDungeon: null,
    rngState: { seed: 0, counter: 0 },
    deathLog: [],
  }
}

function visitedKey(mapId: MapId, nodeId: NodeId): string {
  return `overworld:${mapId as unknown as string}:${nodeId as unknown as string}`
}

export const useRunStore = create<RunStateWithDispatch>((set, get) => ({
  ...freshState(),
  dispatch(action) {
    switch (action.type) {
      case 'recruitUnit': {
        const u = action.payload.unit
        set(s => ({
          party: {
            units: { ...s.party.units, [u.id as unknown as string]: u },
            partyOrder: [...s.party.partyOrder, u.id],
          },
        }))
        return
      }
      case 'fallenUnit': {
        const { unitId, cause, turn } = action.payload
        set(s => ({
          deathLog: [...s.deathLog, { unitId, cause, turn }],
        }))
        return
      }
      case 'equipHand': {
        const { unitId, slot, itemId } = action.payload
        set(s => {
          const u = s.party.units[unitId as unknown as string]
          if (!u) return s
          const updated: Unit = { ...u, hand: { ...u.hand, [slot]: itemId } }
          return { party: { ...s.party, units: { ...s.party.units, [unitId as unknown as string]: updated } } }
        })
        return
      }
      case 'moveItemInBag': {
        const { itemId, x, y } = action.payload
        set(s => ({
          inventory: {
            items: s.inventory.items.map(i =>
              i.itemId === itemId ? { ...i, gridX: x, gridY: y } : i,
            ),
          },
        }))
        return
      }
      case 'addGold':
        set(s => ({ gold: s.gold + action.payload.amount }))
        return
      case 'arriveAtNode': {
        const nid = action.payload.nodeId
        set(s => {
          const key = visitedKey(s.worldPosition.mapId, nid)
          return {
            worldPosition: { ...s.worldPosition, nodeId: nid },
            visitedNodes: { ...s.visitedNodes, [key]: true },
          }
        })
        return
      }
      case 'startTravelPath':
        set({ pendingTravelPath: action.payload.path })
        return
      case 'consumeTravelHop':
        set(s => {
          if (!s.pendingTravelPath) return s
          return { pendingTravelPath: { ...s.pendingTravelPath, remainingNodeIds: s.pendingTravelPath.remainingNodeIds.slice(1) } }
        })
        return
      case 'enterDungeon': {
        const { dungeonId, graph } = action.payload
        const entry = graph.rows[graph.entryRow]?.[0]?.id
        if (!entry) return
        set({ activeDungeon: { dungeonId, graph, position: entry, clearedRooms: new Set() } })
        return
      }
      case 'advanceDungeonRoom':
        set(s => {
          if (!s.activeDungeon) return s
          const cleared = new Set(s.activeDungeon.clearedRooms); cleared.add(s.activeDungeon.position)
          return { activeDungeon: { ...s.activeDungeon, position: action.payload.roomId, clearedRooms: cleared } }
        })
        return
      case 'exitDungeon':
        set({ activeDungeon: null })
        return
      case 'setFlag': {
        const { key, value, scope } = action.payload
        get().flags.set(key, value, scope)
        // trigger React subscribers by reassigning a marker
        set({})
        return
      }
      case 'clearFlagsByScope':
        get().flags.clearScope(action.payload.scope)
        set({})
        return
      case 'advanceQuestStage': {
        const { questId, toStage } = action.payload
        set(s => ({
          questStates: {
            ...s.questStates,
            [questId as unknown as string]: {
              currentStage: toStage as unknown as string,
              metadata: s.questStates[questId as unknown as string]?.metadata ?? {},
            },
          },
        }))
        return
      }
      case 'applyBattleResult': {
        const r = action.payload.result
        set(s => ({
          gold: s.gold + r.goldEarned,
          deathLog: [
            ...s.deathLog,
            ...r.fallen.map(unitId => ({ unitId, cause: 'battle', turn: 0 })),
          ],
          inventory: {
            items: [
              ...s.inventory.items,
              ...r.loot.map((l, idx) => ({ itemId: l.itemId, gridX: idx % 8, gridY: Math.floor(idx / 8) })),
            ],
          },
        }))
        return
      }
    }
  },
  __resetForTest() { set(freshState()) },
}))
