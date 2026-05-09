import type { DialogueTree, DialogueChoice, DialogueBranch } from '../domain/dialogue'
import type { DialogueNodeId } from '../domain/ids'
import type { QuestEffect } from '../domain/quest'
import type { PredicateState } from './predicates'
import { evaluatePredicate } from './predicates'

function isBranch(next: DialogueChoice['next']): next is DialogueBranch {
  return typeof next === 'object' && next !== null && 'kind' in next
}

export interface StepResult {
  nextNodeId: DialogueNodeId | 'end'
  effects: QuestEffect[]
}

export function visibleChoices(
  tree: DialogueTree,
  currentNodeId: DialogueNodeId,
  state: PredicateState,
): DialogueChoice[] {
  const node = tree.nodes[currentNodeId as unknown as string]
  if (!node) return []
  return node.choices.filter(c =>
    !c.visibleIf || evaluatePredicate(c.visibleIf, state)
  )
}

export function isChoiceEnabled(choice: DialogueChoice, state: PredicateState): boolean {
  return !choice.enabledIf || evaluatePredicate(choice.enabledIf, state)
}

export interface ResolveBranchPartyState {
  /** Sum the stat across the active party. */
  partyStatTotal(stat: 'str' | 'mag' | 'skl' | 'spd' | 'def' | 'res' | 'lck'): number
}

export function resolveNext(
  next: DialogueChoice['next'],
  party: ResolveBranchPartyState,
): DialogueNodeId | 'end' {
  if (isBranch(next)) {
    if (next.kind === 'statCheck') {
      // 'lck' folded to 0 if party stats don't include it
      const total = party.partyStatTotal(next.stat)
      return total >= next.threshold ? next.successNext : next.failNext
    }
  }
  return next as DialogueNodeId | 'end'
}

export function step(
  tree: DialogueTree,
  currentNodeId: DialogueNodeId,
  choiceId: string,
  state: PredicateState,
  party?: ResolveBranchPartyState,
): StepResult {
  const node = tree.nodes[currentNodeId as unknown as string]
  if (!node) throw new Error(`dialogueRunner: unknown node ${currentNodeId as unknown as string}`)
  const choice = node.choices.find(c => c.id === choiceId)
  if (!choice) throw new Error(`dialogueRunner: unknown choice ${choiceId}`)
  if (choice.visibleIf && !evaluatePredicate(choice.visibleIf, state)) {
    throw new Error(`dialogueRunner: choice ${choiceId} not visible`)
  }
  if (choice.enabledIf && !evaluatePredicate(choice.enabledIf, state)) {
    throw new Error(`dialogueRunner: choice ${choiceId} not enabled`)
  }
  // For statCheck-branch choices, party must be supplied; if missing, the
  // branch falls back to failNext (treat as a failed check).
  const effectiveParty: ResolveBranchPartyState = party ?? { partyStatTotal: () => 0 }
  return { nextNodeId: resolveNext(choice.next, effectiveParty), effects: choice.effects }
}
