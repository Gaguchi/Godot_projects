import type { QuestId, StageId, FlagKey, ClassId, DialogueId } from './ids'
// QuestId, StageId already imported above; both referenced by advanceQuestStage
import type { Predicate } from './predicate'
import type { MapNodeRef } from './map'

export type FlagScope = 'run' | 'quest' | 'battle' | 'permanent'

// Quest effects (distinct from CardEffect — different domain).
//
// GP-B1: extended with resource deltas + statCheck so dialogue effects in the
// Godot dialogues (add_gold, add_food, heal_party, damage_party, stat_check)
// have a target shape during the port.
export type StatKind = 'str' | 'mag' | 'skl' | 'spd' | 'def' | 'res' | 'lck'

export type QuestEffect =
  | { kind: 'setFlag'; key: FlagKey; value: unknown; scope?: FlagScope }
  | { kind: 'recruitUnit'; classId: ClassId; level: number }
  | { kind: 'spawnNode'; ref: MapNodeRef }
  | { kind: 'unlockNode'; ref: MapNodeRef }
  | { kind: 'startDialogue'; treeId: DialogueId }
  | { kind: 'completeQuest'; questId: QuestId }
  | { kind: 'addGold'; amount: number }
  | { kind: 'addItem'; itemId: string }
  | { kind: 'addFood'; amount: number }
  | { kind: 'damageParty'; amount: number }
  | { kind: 'healParty'; percent: number }
  | { kind: 'statCheck'; stat: StatKind; threshold: number; successEffects: QuestEffect[]; failEffects: QuestEffect[] }
  | { kind: 'advanceQuestStage'; questId: QuestId; toStage: StageId }
  | { kind: 'startCombat'; enemyGroupId: string }

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
