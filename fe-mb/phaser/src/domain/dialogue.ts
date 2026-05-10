import type { DialogueId, DialogueNodeId } from './ids'
import type { Predicate } from './predicate'
import type { QuestEffect } from './quest'
import type { CheckRequirement } from './check'

/**
 * SC-4: Dialogue choices can route via a stat/class/gold/food check.
 *   - Without a check: `next` carries the destination (back-compat).
 *   - With a check: `onPass` and `onFail` are required; `next` must be absent.
 *
 * The check field uses the unified CheckRequirement union from domain/check;
 * party-sum semantics replaced by per-unit attempts via checkResolver.
 */
export interface DialogueChoice {
  id: string
  text: string
  visibleIf?: Predicate
  enabledIf?: Predicate
  effects: QuestEffect[]
  next?: DialogueNodeId | 'end'
  check?: CheckRequirement
  onPass?: DialogueNodeId | 'end'
  onFail?: DialogueNodeId | 'end'
}

export interface DialogueNode {
  id: DialogueNodeId
  speaker?: string
  text: string
  choices: DialogueChoice[]
  onEnter?: QuestEffect[]
}

export interface DialogueTree {
  id: DialogueId
  startNodeId: DialogueNodeId
  nodes: Record<string, DialogueNode>
}
