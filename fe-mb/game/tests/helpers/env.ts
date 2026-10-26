/**
 * tests/helpers/env.ts — the shared engine env for the flow suite (CONTRACT §7 harness: WP-FLOW writes
 * `env` and `session`). One `createEnv()` per process, plus the two ways a flow test bends the world:
 * a rules patch (`withKnobs` / `envWithRules`) and a content patch (`envWithContent`).
 *
 * Nothing here builds state — states come from the REAL reducer through `tests/helpers/session.ts` or
 * `engine/flow/fixtures.ts`, so a helper can never encode a shape the engine would not produce.
 */
import { content as shippedContent, type ContentRegistry } from '../../src/content/index'
import { createEnv, withRules } from '../../src/engine/content'
import type { Rules } from '../../src/engine/rules'
import type { EngineEnv } from '../../src/engine/types'

/** The shipped content + shipped rules, built once per test file (frozen, safe to share). */
export const env: EngineEnv = createEnv()

export function envWithRules(patch: Partial<Rules>, e: EngineEnv = env): EngineEnv {
  return withRules(e, patch)
}

/** Flip one or more `rules.knobs` (armor cap, MC-death-is-defeat, …) without restating the rest. */
export function withKnobs(patch: Partial<Rules['knobs']>, e: EngineEnv = env): EngineEnv {
  return withRules(e, { knobs: { ...e.rules.knobs, ...patch } })
}

/** Shipped content with some registries replaced — fixture quests, fixture dialogues, a smaller map. */
export function envWithContent(patch: Partial<ContentRegistry>, e: EngineEnv = env): EngineEnv {
  return createEnv({ ...shippedContent, ...patch }, e.rules)
}
