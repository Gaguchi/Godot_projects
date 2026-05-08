import type { FlagKey, QuestId, StageId, ClassId, ItemId, EncounterId } from './ids'
import type { MapNodeRef } from './map'

export type Predicate =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'flag'; key: FlagKey; equals?: unknown }
  | { kind: 'notFlag'; key: FlagKey }
  | { kind: 'questStage'; questId: QuestId; stage: StageId }
  | { kind: 'questComplete'; questId: QuestId }
  | { kind: 'partyHas'; classId: ClassId }
  | { kind: 'hasItem'; itemId: ItemId }
  | { kind: 'goldAtLeast'; amount: number }
  | { kind: 'visited'; ref: MapNodeRef }
  | { kind: 'cleared'; encounterId: EncounterId }
  | { kind: 'allOf'; preds: Predicate[] }
  | { kind: 'anyOf'; preds: Predicate[] }
  | { kind: 'not'; pred: Predicate }
