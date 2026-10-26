/**
 * engine/rngState.ts — the ONLY bridge between `rng.ts` (a mutable generator with a `label?`) and
 * `types.ts#RngState` (the readonly `{ seed, counter }` that lives in state and in saves; CONTRACT-CHANGES 0004).
 * IMPLEMENTED (not a stub): it carries no game rules.
 *
 * Every rolling case follows the same three lines:
 *   const r = createRng(state.rng)        // resume the stream
 *   … r.next() / r.pick() / r.shuffle() … // roll
 *   return { …state, rng: rngState(r) }   // write the advanced position back, label stripped
 *
 * Child streams (`rngLabels.*`) derive from the PARENT SEED only, so deriving never advances the parent:
 *   const combatRng = deriveState(run.rng, battleId)
 */
import { createRng, deriveRng, type RNG } from './rng'
import type { RngState } from './types'

/** The generator's current position as state (no `label`). */
export function rngState(r: RNG): RngState {
  const s = r.state()
  return { seed: s.seed, counter: s.counter }
}

/** `deriveRng(createRng(parent), label)` as state: a fresh labelled stream at counter 0. `parent` is untouched. */
export function deriveState(parent: RngState, label: string): RngState {
  return rngState(deriveRng(createRng(parent), label))
}
