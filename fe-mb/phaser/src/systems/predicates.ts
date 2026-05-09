import type { Predicate } from '../domain/predicate'
import type { FlagScope } from '../domain/quest'

// Minimal state shape for predicate evaluation. The real RunState provides this.
export interface PredicateState {
  flags: Map<string, { value: unknown; scope: FlagScope }>
  questStates: Record<string, { currentStage: string; metadata: Record<string, unknown> }>
  party: { units: Record<string, { classId: string }> }
  inventory: { items: { itemId: string }[] }
  gold: number
  visitedNodes: Set<string>
  clearedEncounters: Set<string>
}

const QUEST_COMPLETE_MARKER = '__complete__'

function refKey(ref: { mapKind: string; mapId: string; nodeId: string }): string {
  return `${ref.mapKind}:${ref.mapId}:${ref.nodeId}`
}

export function evaluatePredicate(pred: Predicate, state: PredicateState): boolean {
  switch (pred.kind) {
    case 'always': return true
    case 'never':  return false
    case 'flag': {
      const entry = state.flags.get(pred.key as unknown as string)
      if (!entry) return false
      return pred.equals === undefined ? true : entry.value === pred.equals
    }
    case 'notFlag':
      return !state.flags.has(pred.key as unknown as string)
    case 'questStage': {
      const q = state.questStates[pred.questId as unknown as string]
      return q?.currentStage === (pred.stage as unknown as string)
    }
    case 'questComplete': {
      const q = state.questStates[pred.questId as unknown as string]
      return q?.currentStage === QUEST_COMPLETE_MARKER
    }
    case 'partyHas':
      return Object.values(state.party.units).some(u => u.classId === (pred.classId as unknown as string))
    case 'goldAtLeast':
      return state.gold >= pred.amount
    case 'visited':
      return state.visitedNodes.has(refKey({
        mapKind: pred.ref.mapKind,
        mapId: pred.ref.mapId as unknown as string,
        nodeId: pred.ref.nodeId as unknown as string,
      }))
    case 'cleared':
      return state.clearedEncounters.has(pred.encounterId as unknown as string)
    case 'allOf':
      return pred.preds.every(p => evaluatePredicate(p, state))
    case 'anyOf':
      return pred.preds.some(p => evaluatePredicate(p, state))
    case 'not':
      return !evaluatePredicate(pred.pred, state)
  }
}

export const QUEST_COMPLETE = QUEST_COMPLETE_MARKER
