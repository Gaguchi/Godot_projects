/**
 * run/predicates.ts — one evaluator, 15 kinds (brief §2.12): always never flag{key, equals?} (strict ===,
 * missing → false) notFlag questStarted questStage questComplete partyHas hasItem goldAtLeast
 * visited{ref} cleared{encounterId} allOf anyOf not. Consumers: quest transitions, dialogue visibleIf/enabledIf,
 * encounter conditions, tavern board visibleIf.
 *
 * `evaluate` is pure over `PredicateState` (no env, no run): the same tree evaluated against the same state
 * always answers the same, and the state is JSON-safe so a predicate round-trips through a save untouched.
 */
import { QUEST_COMPLETE_STAGE, walkPredicate } from '../../content/schemas'
import type { Predicate, PredicateState, RunState } from '../types'
import { ownedItemIds } from './bag'
import { refKey } from './overworld'
import { livingUnits } from './party'

/** The ONLY builder. Living units only (a dead companion's class never satisfies `partyHas`, §2.12);
 *  `itemIds` = bag + every hand (`hasItem` counts equipped gear — the brief's "inventory/loot/equipment are back"). */
export function predicateState(run: RunState): PredicateState {
  return {
    flags: run.flags,
    questStates: run.questStates,
    partyClassIds: livingUnits(run).map((u) => u.classId),
    itemIds: ownedItemIds(run),
    gold: run.gold,
    visitedNodes: run.visitedNodes,
    clearedEncounters: run.clearedEncounters,
  }
}

export function evaluate(pred: Predicate, state: PredicateState): boolean {
  switch (pred.kind) {
    case 'always':
      return true
    case 'never':
      return false
    case 'flag': {
      // A missing flag is false even for `equals: false` — "set to false" and "never set" are different
      // authoring statements (brief §2.12: "strict ===; missing flag -> false").
      const entry = state.flags[pred.key]
      if (entry === undefined) return false
      return pred.equals === undefined ? true : entry.value === pred.equals
    }
    case 'notFlag':
      return state.flags[pred.key] === undefined
    case 'questStarted':
      // Status is DERIVED from questStates (§2.12, §7.32): present = started (active OR complete).
      return state.questStates[pred.questId] !== undefined
    case 'questStage':
      return state.questStates[pred.questId]?.stage === pred.stage
    case 'questComplete':
      return state.questStates[pred.questId]?.stage === QUEST_COMPLETE_STAGE
    case 'partyHas':
      return state.partyClassIds.includes(pred.classId)
    case 'hasItem':
      return state.itemIds.includes(pred.itemId)
    case 'goldAtLeast':
      return state.gold >= pred.amount
    case 'visited':
      return state.visitedNodes[refKey(pred.ref.mapKind, pred.ref.mapId, pred.ref.nodeId)] === true
    case 'cleared':
      return state.clearedEncounters[pred.encounterId] === true
    case 'allOf':
      return pred.preds.every((p) => evaluate(p, state))
    case 'anyOf':
      return pred.preds.some((p) => evaluate(p, state))
    case 'not':
      return !evaluate(pred.pred, state)
  }
}

/** Every flag key a predicate tree reads, depth-first, de-duplicated (content lint: every read has a writer). */
export function flagKeysRead(pred: Predicate): readonly string[] {
  const keys: string[] = []
  for (const p of walkPredicate(pred)) {
    if ((p.kind === 'flag' || p.kind === 'notFlag') && !keys.includes(p.key)) keys.push(p.key)
  }
  return keys
}
