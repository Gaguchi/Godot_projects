import { z } from 'zod'
import { FlagValueSchema, IdSchema, MapNodeRefSchema, type FlagValue, type MapNodeRef } from './common'

/**
 * The predicate AST — 15 kinds (brief §2.12): the 13 shipped + `hasItem` +
 * `questStarted`. One evaluator serves quests, dialogue gates, encounter
 * conditions and tavern boards. Quest status is DERIVED from questStates:
 * notStarted = absent, started = present, complete = `__complete__`.
 */
export type Predicate =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'flag'; key: string; equals?: FlagValue | undefined }
  | { kind: 'notFlag'; key: string }
  | { kind: 'questStarted'; questId: string }
  | { kind: 'questStage'; questId: string; stage: string }
  | { kind: 'questComplete'; questId: string }
  | { kind: 'partyHas'; classId: string }
  | { kind: 'hasItem'; itemId: string }
  | { kind: 'goldAtLeast'; amount: number }
  | { kind: 'visited'; ref: MapNodeRef }
  | { kind: 'cleared'; encounterId: string }
  | { kind: 'allOf'; preds: Predicate[] }
  | { kind: 'anyOf'; preds: Predicate[] }
  | { kind: 'not'; pred: Predicate }

export const PREDICATE_KINDS = [
  'always', 'never', 'flag', 'notFlag', 'questStarted', 'questStage', 'questComplete',
  'partyHas', 'hasItem', 'goldAtLeast', 'visited', 'cleared', 'allOf', 'anyOf', 'not',
] as const satisfies readonly Predicate['kind'][]

export const PredicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('always') }).strict(),
    z.object({ kind: z.literal('never') }).strict(),
    z.object({ kind: z.literal('flag'), key: IdSchema, equals: FlagValueSchema.optional() }).strict(),
    z.object({ kind: z.literal('notFlag'), key: IdSchema }).strict(),
    z.object({ kind: z.literal('questStarted'), questId: IdSchema }).strict(),
    z.object({ kind: z.literal('questStage'), questId: IdSchema, stage: IdSchema }).strict(),
    z.object({ kind: z.literal('questComplete'), questId: IdSchema }).strict(),
    z.object({ kind: z.literal('partyHas'), classId: IdSchema }).strict(),
    z.object({ kind: z.literal('hasItem'), itemId: IdSchema }).strict(),
    z.object({ kind: z.literal('goldAtLeast'), amount: z.number().int().min(0) }).strict(),
    z.object({ kind: z.literal('visited'), ref: MapNodeRefSchema }).strict(),
    z.object({ kind: z.literal('cleared'), encounterId: IdSchema }).strict(),
    z.object({ kind: z.literal('allOf'), preds: z.array(PredicateSchema).min(1) }).strict(),
    z.object({ kind: z.literal('anyOf'), preds: z.array(PredicateSchema).min(1) }).strict(),
    z.object({ kind: z.literal('not'), pred: PredicateSchema }).strict(),
  ]),
)

/** Depth-first walk over a predicate tree (self first). */
export function* walkPredicate(p: Predicate): Generator<Predicate> {
  yield p
  if (p.kind === 'allOf' || p.kind === 'anyOf') for (const q of p.preds) yield* walkPredicate(q)
  else if (p.kind === 'not') yield* walkPredicate(p.pred)
}
