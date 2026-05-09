import { z } from 'zod'
import { PredicateSchema } from './predicate'

export const QuestEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('setFlag'), key: z.string(), value: z.unknown(), scope: z.enum(['run','quest','battle','permanent']).optional() }),
  z.object({ kind: z.literal('recruitUnit'), classId: z.string(), level: z.number().int().min(1) }),
  z.object({ kind: z.literal('spawnNode'), ref: z.object({ mapKind: z.enum(['overworld','dungeon','battle']), mapId: z.string(), nodeId: z.string() }) }),
  z.object({ kind: z.literal('unlockNode'), ref: z.object({ mapKind: z.enum(['overworld','dungeon','battle']), mapId: z.string(), nodeId: z.string() }) }),
  z.object({ kind: z.literal('startDialogue'), treeId: z.string() }),
  z.object({ kind: z.literal('completeQuest'), questId: z.string() }),
])

export const QuestStageSchema = z.object({
  id: z.string(),
  onEnter: z.array(QuestEffectSchema),
  listeners: z.array(z.object({
    on: z.enum(['BattleVictory','LocationArrived','FlagSet']),
    predicate: PredicateSchema,
    emit: z.array(QuestEffectSchema),
  })),
  transitions: z.array(z.object({
    when: PredicateSchema,
    to: z.string(),
  })),
  onExit: z.array(QuestEffectSchema),
})

export const QuestSchema = z.object({
  id: z.string(),
  name: z.string(),
  initialStage: z.string(),
  stages: z.record(z.string(), QuestStageSchema),
})
