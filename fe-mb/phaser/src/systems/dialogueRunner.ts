import type { DialogueTree, DialogueChoice } from '../domain/dialogue'
import type { DialogueNodeId, UnitId } from '../domain/ids'
import type { QuestEffect } from '../domain/quest'
import type { Unit } from '../domain/unit'
import type { PredicateState } from './predicates'
import { evaluatePredicate } from './predicates'
import { evaluateCheck, getCheckCandidates, type PartyState } from './checkResolver'

export interface StepResult {
  nextNodeId: DialogueNodeId | 'end'
  effects: QuestEffect[]
}

/**
 * Optional runtime inputs to `step()`. Required only when a choice has
 * a `check` field. If omitted, check-bearing choices auto-pick the best
 * candidate from the supplied party (or fail outright if no party).
 */
export interface StepInputs {
  partyState?: PartyState
  attemptingUnitId?: UnitId | null
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

function pickAttemptingUnit(
  choice: DialogueChoice,
  inputs: StepInputs,
): Unit | null {
  if (!choice.check || choice.check.kind !== 'stat') return null
  const partyState = inputs.partyState
  if (!partyState) return null
  if (inputs.attemptingUnitId) {
    const found = partyState.party.find(
      (u) => (u.id as unknown as string) === (inputs.attemptingUnitId as unknown as string),
    )
    if (found) return found
  }
  // Auto-pick best candidate (highest stat) when no explicit attempting unit.
  const candidates = getCheckCandidates(choice.check, partyState.party)
  const top = candidates[0]
  if (!top) return null
  return partyState.party.find(
    (u) => (u.id as unknown as string) === (top.unitId as unknown as string),
  ) ?? null
}

export function resolveChoiceNext(
  choice: DialogueChoice,
  inputs: StepInputs,
): DialogueNodeId | 'end' {
  if (!choice.check) {
    return (choice.next ?? 'end') as DialogueNodeId | 'end'
  }
  const partyState = inputs.partyState ?? { gold: 0, foodCount: 0, party: [] }
  const attempting = pickAttemptingUnit(choice, inputs)
  const passed = evaluateCheck(choice.check, attempting, partyState)
  return (passed ? choice.onPass! : choice.onFail!) as DialogueNodeId | 'end'
}

export function step(
  tree: DialogueTree,
  currentNodeId: DialogueNodeId,
  choiceId: string,
  state: PredicateState,
  inputs: StepInputs = {},
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
  return { nextNodeId: resolveChoiceNext(choice, inputs), effects: choice.effects }
}
