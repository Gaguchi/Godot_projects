import type { DialogueId, DialogueNodeId } from './ids'
import type { Predicate } from './predicate'
import type { QuestEffect } from './quest'

export interface DialogueChoice {
  id: string
  text: string
  visibleIf?: Predicate
  enabledIf?: Predicate
  effects: QuestEffect[]
  next: DialogueNodeId | 'end'
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
