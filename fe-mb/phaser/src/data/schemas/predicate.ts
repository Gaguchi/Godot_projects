import { z } from 'zod'

export const PredicateSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('always') }),
    z.object({ kind: z.literal('never') }),
    z.object({ kind: z.literal('flag'), key: z.string(), equals: z.unknown().optional() }),
    z.object({ kind: z.literal('notFlag'), key: z.string() }),
    z.object({ kind: z.literal('questStage'), questId: z.string(), stage: z.string() }),
    z.object({ kind: z.literal('questComplete'), questId: z.string() }),
    z.object({ kind: z.literal('partyHas'), classId: z.string() }),
    z.object({ kind: z.literal('goldAtLeast'), amount: z.number() }),
    z.object({ kind: z.literal('visited'), ref: z.object({ mapKind: z.enum(['overworld','dungeon','battle']), mapId: z.string(), nodeId: z.string() }) }),
    z.object({ kind: z.literal('cleared'), encounterId: z.string() }),
    z.object({ kind: z.literal('allOf'), preds: z.array(PredicateSchema) }),
    z.object({ kind: z.literal('anyOf'), preds: z.array(PredicateSchema) }),
    z.object({ kind: z.literal('not'), pred: PredicateSchema }),
  ])
)
