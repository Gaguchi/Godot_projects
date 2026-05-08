import type { UnitId, ItemId, ClassId, QuestId, StageId, FlagKey } from '../domain/ids'
import type { MapNodeRef } from '../domain/map'
import type { FlagScope } from '../domain/quest'

export type DomainEvent =
  | { type: 'BattleStarted'; payload: { battleId: string; enemies: UnitId[] } }
  | { type: 'BattleVictory'; payload: { battleId: string; survivors: UnitId[]; capturedIds: UnitId[] } }
  | { type: 'BattleDefeat';  payload: { battleId: string } }
  | { type: 'UnitDied'; payload: { unitId: UnitId; cause: string } }
  | { type: 'EnemyCaptured'; payload: { unitId: UnitId; classId: ClassId; level: number } }
  | { type: 'LocationArrived'; payload: { nodeRef: MapNodeRef } }
  | { type: 'ItemAcquired'; payload: { itemId: ItemId; source: 'loot'|'shop'|'quest'|'event' } }
  | { type: 'FlagSet'; payload: { key: FlagKey; value: unknown; scope: FlagScope } }
  | { type: 'QuestStageAdvanced'; payload: { questId: QuestId; from: StageId; to: StageId } }
