import { z } from 'zod'
import { IdSchema } from './common'
import { PredicateSchema } from './predicate'
import { QuestEffectSchema } from './questEffect'

/** Engine-owned completion sentinel. Content never declares it (IdSchema rejects it too). */
export const QUEST_COMPLETE_STAGE = '__complete__'

export const QuestTransitionSchema = z.object({ when: PredicateSchema, to: IdSchema }).strict()
export type QuestTransition = z.infer<typeof QuestTransitionSchema>

/** No listeners (brief §2.12): a one-shot reaction is a transition into a stage whose onEnter carries the effects. */
export const QuestStageSchema = z
  .object({
    id: IdSchema,
    /**
     * What the company is trying to DO while this stage is current — the line Contracts prints under the quest's
     * name, on the page and in the headless log. Authored, never derived: `stage.replace(/_/g, ' ')` printed
     * "Find daren" on the one page whose job is naming things (FINAL GATE C 3.4), so the label is content and
     * `content/lint.ts` refuses a stage without one. Sentence case, no terminal stop (ARCHITECTURE §5.1).
     */
    label: z.string().min(1),
    onEnter: z.array(QuestEffectSchema),
    /** First passing transition wins; settled to a fixed point (max 8 passes) after every run dispatch. */
    transitions: z.array(QuestTransitionSchema),
    onExit: z.array(QuestEffectSchema),
  })
  .strict()
export type QuestStage = z.infer<typeof QuestStageSchema>

export const QuestSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    /** Seeded by `startQuest`; its onEnter runs then. */
    initialStage: IdSchema,
    stages: z.record(IdSchema, QuestStageSchema),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (!(q.initialStage in q.stages)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['initialStage'], message: `quest '${q.id}' initialStage '${q.initialStage}' is not a declared stage` })
    for (const [key, stage] of Object.entries(q.stages)) {
      if (key !== stage.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stages', key, 'id'], message: `stage key '${key}' != stage.id '${stage.id}'` })
      for (const [i, t] of stage.transitions.entries()) {
        if (!(t.to in q.stages)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stages', key, 'transitions', i, 'to'], message: `transition target '${t.to}' is not a declared stage (completion is the completeQuest effect)` })
      }
    }
  })
export type QuestDef = z.infer<typeof QuestSchema>
