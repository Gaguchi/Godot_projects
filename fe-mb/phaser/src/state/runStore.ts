import { create } from 'zustand'
import { createFlagStore, type TypedFlagStore } from './flags'
import type { Unit } from '../domain/unit'
import type { UnitId, ItemId, NodeId, MapId, FlagKey, QuestId, StageId, DungeonId, DialogueId } from '../domain/ids'
import type { FlagScope, QuestEffect } from '../domain/quest'
import type { BattleResult, PendingTravelPath } from '../contracts'
import type { DungeonGraph } from '../domain/map'
import type { RngState } from '../domain/rng'
import type { PredicateState } from '../systems/predicates'
import { planEquip, planUnequip, placeInBag } from '../systems/equipment'
import { getItemDef } from '../data/itemRegistry'
import { diag } from './diagLog'

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
  /** GP-C5: ids of one-shot encounter entries already fired (excluded from future rolls). */
  oneShotsFired: Set<string>
  /** GP-C6: HP damage applied to whole party when food = 0 on a hop. */
  starvationDamagePerHop: number
  /** Combat requested from a dialogue or quest effect — OverworldScene routes the next tick. */
  pendingCombat: { enemyGroupId: string } | null
  /** Days on the road — starts at 1, +1 per overworld hop. Shown in the HUD. */
  daysElapsed: number
  /** Run summary counters (win / game-over screens). Updated by
   *  applyBattleResult and consumeTravelHop. */
  runStats: {
    battlesWon: number
    enemiesDefeated: number
    unitsLost: number
    goldEarned: number
    gearFound: number
    enemiesCaptured: number
    hops: number
  }
}

export type RunAction =
  | { type: 'recruitUnit'; payload: { unit: Unit } }
  | { type: 'fallenUnit'; payload: { unitId: UnitId; cause: string; turn: number } }
  | { type: 'sweepFallenUnits'; payload: { unitIds: UnitId[] } }
  | { type: 'moveItemInBag'; payload: { itemId: ItemId; x: number; y: number } }
  | { type: 'equipItem'; payload: { unitId: UnitId; itemId: ItemId; slot: 'left' | 'right' } }
  | { type: 'unequipItem'; payload: { unitId: UnitId; slot: 'left' | 'right' } }
  | { type: 'buyItem'; payload: { itemId: ItemId; price: number } }
  | { type: 'sellItem'; payload: { itemId: ItemId; sellPrice: number } }
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
  | { type: 'resetRun' }
  | { type: 'clearPendingCombat' }
  | { type: 'markEncounterFired'; payload: { encounterId: string } }
  | { type: 'consumeFoodPerHop' }
  | { type: 'enterMap'; payload: { mapId: MapId; nodeId: NodeId } }
  | { type: 'restParty'; payload: { percent: number } }
  | { type: 'hydrateFromSave'; payload: {
      gold: number
      worldPosition: { mapId: string; nodeId: string }
      partyUnits: { id: string; [k: string]: unknown }[]
      partyOrder: string[]
      inventoryItems: { itemId: string; gridX: number; gridY: number }[]
    } }

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
      // Combat requested from inside a dialogue's choice effects. We surface
      // it via `pendingCombat`; OverworldScene watches that field and routes
      // the player into the combat scene as soon as the dialogue closes.
      get().flags.set(
        ('pending_combat_group:' + effect.enemyGroupId) as never,
        true as unknown,
        'run',
      )
      set({ pendingCombat: { enemyGroupId: effect.enemyGroupId } })
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
    worldPosition: { mapId: 'borderlands' as unknown as MapId, nodeId: 'frontier_camp' as unknown as NodeId },
    visitedNodes: {},
    clearedEncounters: {},
    pendingTravelPath: null,
    flags: createFlagStore(),
    questStates: {},
    activeDungeon: null,
    rngState: { seed: 0, counter: 0 },
    deathLog: [],
    pendingDialogue: null,
    pendingCombat: null,
    oneShotsFired: new Set<string>(),
    starvationDamagePerHop: 3,
    daysElapsed: 1,
    runStats: {
      battlesWon: 0, enemiesDefeated: 0, unitsLost: 0,
      goldEarned: 0, gearFound: 0, enemiesCaptured: 0, hops: 0,
    },
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
    // Diagnostic log: every action recorded so I can replay sequences via
    // window.__debug.diag.recent() / .byCategory('store.run').
    diag('store.run', action.type, 'payload' in action ? action.payload : undefined)
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
      case 'sweepFallenUnits': {
        const idSet = new Set(
          action.payload.unitIds.map(u => u as unknown as string),
        )
        if (idSet.size === 0) return
        set(s => {
          const newUnits: typeof s.party.units = { ...s.party.units }
          for (const id of idSet) delete newUnits[id]
          return {
            party: {
              units: newUnits,
              partyOrder: s.party.partyOrder.filter(
                uid => !idSet.has(uid as unknown as string),
              ),
            },
          }
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
      case 'equipItem': {
        const { unitId, itemId, slot } = action.payload
        set(s => {
          const unit = s.party.units[unitId as unknown as string]
          if (!unit) return s
          const plan = planEquip(unit, slot, itemId, s.inventory.items, getItemDef)
          if (!plan.ok) {
            diag('store.run', `equipItem rejected: ${plan.reason}`, { unitId, itemId, slot }, 'warn')
            return s
          }
          return {
            party: {
              ...s.party,
              units: {
                ...s.party.units,
                [unitId as unknown as string]: { ...unit, handLeft: plan.handLeft, handRight: plan.handRight },
              },
            },
            inventory: { items: plan.bag },
          }
        })
        return
      }
      case 'unequipItem': {
        const { unitId, slot } = action.payload
        set(s => {
          const unit = s.party.units[unitId as unknown as string]
          if (!unit) return s
          const plan = planUnequip(unit, slot, s.inventory.items, getItemDef)
          if (!plan.ok) {
            diag('store.run', `unequipItem rejected: ${plan.reason}`, { unitId, slot }, 'warn')
            return s
          }
          return {
            party: {
              ...s.party,
              units: {
                ...s.party.units,
                [unitId as unknown as string]: { ...unit, handLeft: plan.handLeft, handRight: plan.handRight },
              },
            },
            inventory: { items: plan.bag },
          }
        })
        return
      }
      case 'buyItem': {
        const { itemId, price } = action.payload
        set(s => {
          if (s.gold < price) return s
          const occupied = new Set(
            s.inventory.items.map(i => `${i.gridX},${i.gridY}`),
          )
          for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 8; x++) {
              if (!occupied.has(`${x},${y}`)) {
                return {
                  gold: s.gold - price,
                  inventory: {
                    items: [
                      ...s.inventory.items,
                      { itemId, gridX: x, gridY: y },
                    ],
                  },
                }
              }
            }
          }
          return s
        })
        return
      }
      case 'sellItem': {
        const { itemId, sellPrice } = action.payload
        set(s => {
          const idx = s.inventory.items.findIndex(i => i.itemId === itemId)
          if (idx === -1) return s
          return {
            gold: s.gold + sellPrice,
            inventory: {
              items: [
                ...s.inventory.items.slice(0, idx),
                ...s.inventory.items.slice(idx + 1),
              ],
            },
          }
        })
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
        set(s => {
          // Loot into the bag at first-free cells; overflow is dropped with a warning.
          let items = s.inventory.items
          if (r.loot.length > 0) {
            const placed = placeInBag(items, r.loot)
            if (placed) items = placed
            else diag('store.run', 'battle loot dropped — bag full', { loot: r.loot }, 'warn')
          }
          const won = r.outcome === 'victory'
          return {
            gold: s.gold + r.goldEarned,
            inventory: items === s.inventory.items ? s.inventory : { items },
            deathLog: [
              ...s.deathLog,
              ...r.fallen.map(unitId => ({ unitId, cause: 'battle', turn: 0 })),
            ],
            runStats: {
              ...s.runStats,
              battlesWon: s.runStats.battlesWon + (won ? 1 : 0),
              enemiesDefeated: s.runStats.enemiesDefeated + r.enemiesDefeated,
              unitsLost: s.runStats.unitsLost + r.fallen.length,
              goldEarned: s.runStats.goldEarned + r.goldEarned,
              gearFound: s.runStats.gearFound + r.loot.length,
              enemiesCaptured: s.runStats.enemiesCaptured + r.capturedEnemies.length,
            },
          }
        })
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
      case 'resetRun':
        // New Run from win/game-over: wipe the whole run state atomically.
        set(freshState())
        return
      case 'clearPendingCombat':
        set({ pendingCombat: null })
        return
      case 'markEncounterFired':
        set(s => {
          const next = new Set(s.oneShotsFired); next.add(action.payload.encounterId)
          return { oneShotsFired: next }
        })
        return
      case 'enterMap':
        set(s => {
          const key = visitedKey(action.payload.mapId, action.payload.nodeId)
          return {
            worldPosition: { mapId: action.payload.mapId, nodeId: action.payload.nodeId },
            visitedNodes: { ...s.visitedNodes, [key]: true },
          }
        })
        return
      case 'restParty': {
        const percent = action.payload.percent
        set(s => {
          const newUnits: Record<string, Unit> = {}
          for (const [id, u] of Object.entries(s.party.units)) {
            const heal = Math.floor(u.hp.max * percent)
            newUnits[id] = { ...u, hp: { ...u.hp, current: Math.min(u.hp.max, u.hp.current + heal) } }
          }
          return { party: { ...s.party, units: newUnits } }
        })
        return
      }
      case 'consumeFoodPerHop': {
        // A day passes with every hop on the road.
        set(s => ({
          daysElapsed: s.daysElapsed + 1,
          runStats: { ...s.runStats, hops: s.runStats.hops + 1 },
        }))
        // Find the first food_rations item in the bag; remove one. If no
        // food remains, deal starvationDamagePerHop HP to each living party
        // member (mirrors Godot starvation rule).
        const state = get()
        const idx = state.inventory.items.findIndex(i => (i.itemId as unknown as string) === 'food_rations')
        if (idx >= 0) {
          set(s => ({
            inventory: { items: s.inventory.items.filter((_, i) => i !== idx) },
          }))
        } else {
          set(s => {
            const newUnits: Record<string, Unit> = {}
            for (const [id, u] of Object.entries(s.party.units)) {
              if (u.hp.current <= 0) { newUnits[id] = u; continue }
              newUnits[id] = { ...u, hp: { ...u.hp, current: Math.max(0, u.hp.current - s.starvationDamagePerHop) } }
            }
            return { party: { ...s.party, units: newUnits } }
          })
        }
        return
      }
      case 'hydrateFromSave': {
        const p = action.payload
        set({
          gold: p.gold,
          worldPosition: {
            mapId: p.worldPosition.mapId as unknown as MapId,
            nodeId: p.worldPosition.nodeId as unknown as NodeId,
          },
          party: {
            units: Object.fromEntries(
              p.partyUnits.map(u => [u.id, u as unknown as Unit]),
            ),
            partyOrder: p.partyOrder.map(id => id as unknown as UnitId),
          },
          inventory: {
            items: p.inventoryItems.map(i => ({
              itemId: i.itemId as unknown as ItemId,
              gridX: i.gridX,
              gridY: i.gridY,
            })),
          },
        })
        return
      }
    }
  },
  __resetForTest() { set(freshState()) },
}))
