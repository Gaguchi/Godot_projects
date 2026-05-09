import type { DialogueId, DialogueNodeId } from './ids'
import type { Predicate } from './predicate'
import type { QuestEffect, StatKind } from './quest'

/**
 * GP-B4: A choice's destination can be a fixed node, end, or a stat-check
 * branch evaluated at press-time. The branch's stat is summed across the
 * party; if total >= threshold, go to successNext, else failNext.
 */
export type DialogueBranch = {
  kind: 'statCheck'
  stat: StatKind
  threshold: number
  successNext: DialogueNodeId | 'end'
  failNext: DialogueNodeId | 'end'
}

export interface DialogueChoice {
  id: string
  text: string
  visibleIf?: Predicate
  enabledIf?: Predicate
  effects: QuestEffect[]
  next: DialogueNodeId | 'end' | DialogueBranch
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
  nodes: Record<string, DialogueNode>   // keyed by DialogueNodeId-as-string
}
