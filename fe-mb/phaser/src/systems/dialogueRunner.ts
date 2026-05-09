import type { DialogueTree, DialogueChoice } from '../domain/dialogue'
import type { DialogueNodeId } from '../domain/ids'
import type { QuestEffect } from '../domain/quest'
import type { PredicateState } from './predicates'
import { evaluatePredicate } from './predicates'

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

export function step(
  tree: DialogueTree,
  currentNodeId: DialogueNodeId,
  choiceId: string,
  state: PredicateState,
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
  return { nextNodeId: choice.next, effects: choice.effects }
}
