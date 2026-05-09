import type { QuestId, StageId, FlagKey, ClassId, DialogueId } from './ids'
import type { Predicate } from './predicate'
import type { MapNodeRef } from './map'

export type FlagScope = 'run' | 'quest' | 'battle' | 'permanent'

// Quest effects (distinct from CardEffect — different domain).
export type QuestEffect =
  | { kind: 'setFlag'; key: FlagKey; value: unknown; scope?: FlagScope }
  | { kind: 'recruitUnit'; classId: ClassId; level: number }
  | { kind: 'spawnNode'; ref: MapNodeRef }
  | { kind: 'unlockNode'; ref: MapNodeRef }
  | { kind: 'startDialogue'; treeId: DialogueId }
  | { kind: 'completeQuest'; questId: QuestId }

export type QuestListenerEvent = 'BattleVictory' | 'LocationArrived' | 'FlagSet'

export interface QuestListener {
  on: QuestListenerEvent
  predicate: Predicate
  emit: QuestEffect[]
}

export interface QuestStage {
  id: StageId
  onEnter: QuestEffect[]
  listeners: QuestListener[]
  transitions: { when: Predicate; to: StageId }[]
  onExit: QuestEffect[]
}

export interface QuestDef {
  id: QuestId
  name: string
  initialStage: StageId
  stages: Record<string, QuestStage>   // keyed by StageId-as-string
}
