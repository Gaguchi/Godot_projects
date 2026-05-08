import type { CardEffect } from '../domain/card'
import type { UnitId } from '../domain/ids'

export interface PipelineCtx {
  sourceUnitId: UnitId
  now: number
}

export type Middleware = (effect: CardEffect, ctx: PipelineCtx) => CardEffect[]

export interface StagedMiddleware {
  stage: 1 | 2 | 3 | 4 | 5 | 6
  fn: Middleware
}

export interface PipelineResult {
  emitted: CardEffect[]
}

export function runEffects(
  effects: CardEffect[],
  middlewares: StagedMiddleware[],
  ctx: PipelineCtx,
): PipelineResult {
  const sorted = [...middlewares].sort((a, b) => a.stage - b.stage)

  let current = effects
  for (const { fn } of sorted) {
    const next: CardEffect[] = []
    for (const e of current) {
      next.push(...fn(e, ctx))
    }
    current = next
  }

  return { emitted: current }
}
