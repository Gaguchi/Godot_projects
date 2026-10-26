import { z } from 'zod'
import { CheckRequirementSchema } from './check'
import { IdSchema } from './common'
import { PredicateSchema } from './predicate'
import { QuestEffectSchema } from './questEffect'

/** `end` is the runner's terminal sentinel, never a node id. */
export const DIALOGUE_END = 'end'
const NodeTargetSchema = z.union([IdSchema, z.literal(DIALOGUE_END)])

/** EITHER `next` OR `check` + `onPass` + `onFail` (the XOR refinement the brief keeps). */
export const DialogueChoiceSchema = z
  .object({
    id: IdSchema,
    text: z.string().min(1),
    visibleIf: PredicateSchema.optional(),
    enabledIf: PredicateSchema.optional(),
    effects: z.array(QuestEffectSchema),
    next: NodeTargetSchema.optional(),
    check: CheckRequirementSchema.optional(),
    onPass: NodeTargetSchema.optional(),
    onFail: NodeTargetSchema.optional(),
  })
  .strict()
  .refine(
    (c) => (c.check === undefined ? c.next !== undefined && c.onPass === undefined && c.onFail === undefined : c.next === undefined && c.onPass !== undefined && c.onFail !== undefined),
    { message: 'choice must define `next` (no check) OR `check`+`onPass`+`onFail` (no next)' },
  )
export type DialogueChoice = z.infer<typeof DialogueChoiceSchema>

export const DialogueNodeSchema = z
  .object({
    id: IdSchema,
    /** A character id (`mc`, `oak`, `kael`, ...). Absent = narrator. */
    speaker: IdSchema.optional(),
    /** Supports `{mc}` and `{company}` substitution. */
    text: z.string().min(1),
    onEnter: z.array(QuestEffectSchema).min(1).optional(),
    /** Empty = terminal node (the runner ends after onEnter). */
    choices: z.array(DialogueChoiceSchema),
  })
  .strict()
  .refine((n) => new Set(n.choices.map((c) => c.id)).size === n.choices.length, { message: 'choice ids must be unique within a node' })
export type DialogueNode = z.infer<typeof DialogueNodeSchema>

export const DialogueTreeSchema = z
  .object({
    id: IdSchema,
    startNodeId: IdSchema,
    nodes: z.record(IdSchema, DialogueNodeSchema),
  })
  .strict()
  .superRefine((tree, ctx) => {
    if (!(tree.startNodeId in tree.nodes)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startNodeId'], message: `dialogue '${tree.id}' startNodeId '${tree.startNodeId}' is not a node` })
    for (const [key, node] of Object.entries(tree.nodes)) {
      if (key !== node.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodes', key, 'id'], message: `node key '${key}' != node.id '${node.id}'` })
      for (const [i, c] of node.choices.entries()) {
        for (const [field, target] of [['next', c.next], ['onPass', c.onPass], ['onFail', c.onFail]] as const) {
          if (target !== undefined && target !== DIALOGUE_END && !(target in tree.nodes)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodes', key, 'choices', i, field], message: `dialogue '${tree.id}' choice '${c.id}' ${field} -> unknown node '${target}'` })
          }
        }
      }
    }
  })
export type DialogueTree = z.infer<typeof DialogueTreeSchema>
