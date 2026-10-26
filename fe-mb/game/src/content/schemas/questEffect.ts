import { z } from 'zod'
import { FlagScopeSchema, FlagValueSchema, IdSchema, MapNodeRefSchema } from './common'
import { CaptureTargetSchema } from './encounter'

/**
 * Quest/dialogue/check-event effects — flat, non-recursive, ALL implemented
 * by the engine (brief §2.12). No `statCheck` (branching lives at the choice
 * layer), no `recruitUnit` (replaced by `recruitCharacter`).
 */
export const QuestEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('setFlag'), key: IdSchema, value: FlagValueSchema, scope: FlagScopeSchema }).strict(),
  z.object({ kind: z.literal('recruitCharacter'), characterId: IdSchema }).strict(),
  z.object({ kind: z.literal('promptName'), target: z.enum(['mc', 'company']) }).strict(),
  z.object({ kind: z.literal('startQuest'), questId: IdSchema }).strict(),
  z.object({ kind: z.literal('advanceQuestStage'), questId: IdSchema, toStage: IdSchema }).strict(),
  z.object({ kind: z.literal('completeQuest'), questId: IdSchema }).strict(),
  z.object({ kind: z.literal('addGold'), amount: z.number().int() }).strict(),
  z.object({ kind: z.literal('addFood'), amount: z.number().int() }).strict(),
  z.object({ kind: z.literal('addItem'), itemId: IdSchema }).strict(),
  z.object({ kind: z.literal('spawnNode'), ref: MapNodeRefSchema }).strict(),
  z.object({ kind: z.literal('unlockNode'), ref: MapNodeRefSchema }).strict(),
  z.object({ kind: z.literal('startDialogue'), dialogueId: IdSchema }).strict(),
  /** `captureTargets` — the named enemies THIS fight cares about (Daren at his camp). Same shape and same payout
   *  path as `EncounterOutcome.battle`, so a quest-origin fight resolves its flags too (CONTRACT-CHANGES 0030). */
  z.object({ kind: z.literal('startCombat'), enemyGroupId: IdSchema, captureTargets: z.array(CaptureTargetSchema).min(1).optional() }).strict(),
  z.object({ kind: z.literal('damageParty'), amount: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal('healParty'), percent: z.number().min(0).max(1) }).strict(),
])
export type QuestEffect = z.infer<typeof QuestEffectSchema>
export type QuestEffectKind = QuestEffect['kind']

export const QUEST_EFFECT_KINDS = [
  'setFlag', 'recruitCharacter', 'promptName', 'startQuest', 'advanceQuestStage', 'completeQuest',
  'addGold', 'addFood', 'addItem', 'spawnNode', 'unlockNode', 'startDialogue', 'startCombat',
  'damageParty', 'healParty',
] as const satisfies readonly QuestEffectKind[]
