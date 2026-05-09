import { create } from 'zustand'
import { createFlagStore, type TypedFlagStore } from './flags'
import type { Unit } from '../domain/unit'
import type { UnitId, ItemId, NodeId, MapId, FlagKey, QuestId, StageId, DungeonId, DialogueId } from '../domain/ids'
import type { FlagScope, QuestEffect } from '../domain/quest'
import type { BattleResult, PendingTravelPath } from '../contracts'
import type { DungeonGraph } from '../domain/map'
import type { RngState } from '../domain/rng'
import type { PredicateState } from '../systems/predicates'

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
  /** GP-B3: when set, the DialogueModal renders with the current dialogue tree + node. */
  pendingDialogue: { dialogueId: DialogueId; nodeId: string } | null
}

export type RunAction =
  | { type: 'recruitUnit'; payload: { unit: Unit } }
  | { type: 'fallenUnit'; payload: { unitId: UnitId; cause: string; turn: number } }
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
  | { type: 'applyQuestEffects'; payload: { effects: QuestEffect[] } }
  | { type: 'startDialogue'; payload: { dialogueId: DialogueId; nodeId: string } }
  | { type: 'endDialogue' }

interface RunStateWithDispatch extends RunState {
  dispatch(action: RunAction): void
  __resetForTest(): void
}

/**
 * Apply a single QuestEffect to runStore. Recursively handles statCheck.
 * Called from the applyQuestEffects RunAction handler.
 */
function applyQuestEffect(
  effect: QuestEffect,
  get: () => RunStateWithDispatch,
  set: (partial: Partial<RunState> | ((s: RunState) => Partial<RunState>)) => void,
): void {
  switch (effect.kind) {
    case 'setFlag':
      get().flags.set(effect.key, effect.value, effect.scope)
      set({})
      return
    case 'recruitUnit':
      // Unit construction lives elsewhere; recruitUnit here marks intent. The
      // overworld/town wiring (GP-E5) creates the actual Unit and dispatches
      // {type: 'recruitUnit', payload: {unit}}. For now, no-op so the effect
      // doesn't crash; questRunner-driven recruits are scaffolded in GP-B5.
      return
    case 'spawnNode':
    case 'unlockNode':
      // Dynamic quest nodes land in GP-D6. Stub: no-op.
      return
    case 'startDialogue':
      set({ pendingDialogue: { dialogueId: effect.treeId, nodeId: 'start' } })
      return
    case 'completeQuest':
      set(s => ({
        questStates: {
          ...s.questStates,
          [effect.questId as unknown as string]: {
            currentStage: '__complete__',
            metadata: s.questStates[effect.questId as unknown as string]?.metadata ?? {},
          },
        },
      }))
      return
    case 'addGold':
      set(s => ({ gold: s.gold + effect.amount }))
      return
    case 'addFood': {
      // Food = food_rations item charges. Each food_rations item is +1 charge
      // for now (GP-C6 may switch to a charges field). Naively append items.
      const newItems: { itemId: ItemId; gridX: number; gridY: number }[] = []
      for (let i = 0; i < effect.amount; i++) {
        newItems.push({ itemId: 'food_rations' as unknown as ItemId, gridX: 0, gridY: 0 })
      }
      set(s => ({ inventory: { items: [...s.inventory.items, ...newItems] } }))
      return
    }
    case 'damageParty':
      set(s => {
        const newUnits: Record<string, Unit> = {}
        for (const [id, u] of Object.entries(s.party.units)) {
          newUnits[id] = { ...u, hp: { ...u.hp, current: Math.max(0, u.hp.current - effect.amount) } }
        }
        return { party: { ...s.party, units: newUnits } }
      })
      return
    case 'healParty':
      set(s => {
        const newUnits: Record<string, Unit> = {}
        for (const [id, u] of Object.entries(s.party.units)) {
          const heal = Math.floor(u.hp.max * effect.percent)
          newUnits[id] = { ...u, hp: { ...u.hp, current: Math.min(u.hp.max, u.hp.current + heal) } }
        }
        return { party: { ...s.party, units: newUnits } }
      })
      return
    case 'statCheck': {
      // Sum the chosen stat across the active party; pass if >= threshold.
      const state = get()
      const total = Object.values(state.party.units).reduce(
        (sum, u) => sum + (u.stats[effect.stat as keyof typeof u.stats] ?? 0),
        0,
      )
      const branch = total >= effect.threshold ? effect.successEffects : effect.failEffects
      for (const sub of branch) applyQuestEffect(sub, get, set)
      return
    }
    case 'advanceQuestStage':
      set(s => ({
        questStates: {
          ...s.questStates,
          [effect.questId as unknown as string]: {
            currentStage: effect.toStage as unknown as string,
            metadata: s.questStates[effect.questId as unknown as string]?.metadata ?? {},
          },
        },
      }))
      return
    case 'startCombat':
      // Combat seeding from a dialogue effect lands in GP-C5 when the encounter
      // roller wires combat boots through the runStore. For now, set a flag so
      // the next overworld arrival or test can react.
      get().flags.set(
        ('pending_combat_group:' + effect.enemyGroupId) as never,
        true as unknown,
        'run',
      )
      set({})
      return
  }
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
    pendingDialogue: null,
  }
}

/**
 * GP-B2: PredicateState facade derived from RunState. Used by questRunner and
 * dialogueRunner to evaluate predicates without coupling to the full store.
 */
export function predicateStateFromRun(s: RunState): PredicateState {
  return {
    flags: s.flags.asPredicateMap(),
    questStates: s.questStates,
    party: { units: Object.fromEntries(Object.entries(s.party.units).map(([k, u]) => [k, { classId: u.classId as unknown as string }])) },
    inventory: { items: s.inventory.items.map(i => ({ itemId: i.itemId as unknown as string })) },
    gold: s.gold,
    visitedNodes: new Set(Object.keys(s.visitedNodes).filter(k => s.visitedNodes[k])),
    clearedEncounters: new Set(Object.keys(s.clearedEncounters).filter(k => s.clearedEncounters[k])),
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
        }))
        return
      }
      case 'applyQuestEffects': {
        for (const effect of action.payload.effects) {
          applyQuestEffect(effect, get, set)
        }
        return
      }
      case 'startDialogue':
        set({ pendingDialogue: { dialogueId: action.payload.dialogueId, nodeId: action.payload.nodeId } })
        return
      case 'endDialogue':
        set({ pendingDialogue: null })
        return
    }
  },
  __resetForTest() { set(freshState()) },
}))
