import { z } from 'zod'
import { PredicateSchema } from './predicate'

// statCheck recursion forced through z.lazy to support nested QuestEffect[]
// success/fail arrays. Disable the union's discriminator-recursion warning by
// using z.union for the lazy variant.
export const QuestEffectSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal('setFlag'), key: z.string(), value: z.unknown(), scope: z.enum(['run','quest','battle','permanent']).optional() }),
    z.object({ kind: z.literal('recruitUnit'), classId: z.string(), level: z.number().int().min(1) }),
    z.object({ kind: z.literal('spawnNode'), ref: z.object({ mapKind: z.enum(['overworld','dungeon','battle']), mapId: z.string(), nodeId: z.string() }) }),
    z.object({ kind: z.literal('unlockNode'), ref: z.object({ mapKind: z.enum(['overworld','dungeon','battle']), mapId: z.string(), nodeId: z.string() }) }),
    z.object({ kind: z.literal('startDialogue'), treeId: z.string() }),
    z.object({ kind: z.literal('completeQuest'), questId: z.string() }),
    z.object({ kind: z.literal('addGold'), amount: z.number().int() }),
    z.object({ kind: z.literal('addFood'), amount: z.number().int() }),
    z.object({ kind: z.literal('damageParty'), amount: z.number().int().min(0) }),
    z.object({ kind: z.literal('healParty'), percent: z.number().min(0).max(1) }),
    z.object({
      kind: z.literal('statCheck'),
      stat: z.enum(['str','mag','skl','spd','def','res','lck']),
      threshold: z.number().int(),
      successEffects: z.array(QuestEffectSchema),
      failEffects: z.array(QuestEffectSchema),
    }),
    z.object({ kind: z.literal('advanceQuestStage'), questId: z.string(), toStage: z.string() }),
    z.object({ kind: z.literal('startCombat'), enemyGroupId: z.string() }),
  ])
)

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
