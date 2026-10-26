/**
 * tests/helpers/session.ts — the flow harness (CONTRACT §7: WP-FLOW writes `env` and `session`).
 *
 * A `Session` is the headless player: it dispatches through the ROOT reducer, keeps the action log for
 * `verifyReplay`, and calls `assertInvariants` after EVERY action — so a rule that leaves the state
 * self-contradictory fails at the action that made it, not three screens later.
 *
 *   const s = new Session(initialState())
 *   s.do({ type: 'meta/newRun', seed: 7 })   // throws if the action is refused
 *   s.settle()                                // pumps + greedy party turns until the state waits for a decision
 *   s.refuse({ type: 'travel/step' })         // asserts the refusal AND that the state reference is unchanged
 */
import { expect } from 'vitest'
import type { Action } from '../../src/engine/actions'
import type { Effect } from '../../src/engine/effects'
import { greedyPolicy } from '../../src/engine/combat/sim'
import { assertInvariants } from '../../src/engine/flow/invariants'
import { nextPump, overlayOf } from '../../src/engine/flow/pump'
import { reduce } from '../../src/engine/reducer'
import { currentNode } from '../../src/engine/run/dialogue'
import type { EngineEnv, GameState } from '../../src/engine/types'
import { env as defaultTestEnv } from './env'

function refusalOf(effects: readonly Effect[]): string | null {
  const refused = effects.find((e) => e.kind === 'refused')
  return refused !== undefined && refused.kind === 'refused' ? refused.reason : null
}

export class Session {
  state: GameState
  readonly log: Action[] = []
  readonly effects: Effect[] = []

  constructor(readonly initial: GameState, readonly env: EngineEnv = defaultTestEnv) {
    this.state = initial
    assertInvariants(initial, env)
  }

  /** Dispatch; throw on a refusal (a test that wants one calls `refuse`). Invariants are asserted after. */
  do(action: Action): readonly Effect[] {
    const r = reduce(this.state, action, this.env)
    const reason = refusalOf(r.effects)
    if (reason !== null) throw new Error(`${action.type} refused: ${reason}`)
    this.state = r.state
    this.log.push(action)
    this.effects.push(...r.effects)
    assertInvariants(this.state, this.env)
    return r.effects
  }

  /** Dispatch expecting a refusal: asserts the reason (if given), the SAME state reference, and exactly one
   *  `refused` effect — the reducer contract for every illegal action (CONTRACT §4, §8). */
  refuse(action: Action, reason?: string | RegExp): string {
    const before = this.state
    const r = reduce(before, action, this.env)
    const refused = r.effects.filter((e) => e.kind === 'refused')
    expect(refused, `${action.type} was expected to be refused`).toHaveLength(1)
    expect(r.state, `${action.type} changed the state while refusing`).toBe(before)
    const only = refused[0]
    const text = only !== undefined && only.kind === 'refused' ? only.reason : ''
    if (typeof reason === 'string') expect(text).toBe(reason)
    else if (reason instanceof RegExp) expect(text).toMatch(reason)
    return text
  }

  /** Run pumps (enemy turns, hops) and party turns (greedy) until the state waits for a player decision. */
  settle(maxSteps = 2000): void {
    for (let i = 0; i < maxSteps; i++) {
      const pump = nextPump(this.state)
      if (pump !== null) {
        this.do(pump)
        continue
      }
      const combat = this.state.combat
      if (this.state.screen.kind === 'combat' && combat !== null && combat.phase === 'combat') {
        this.do(greedyPolicy(combat, this.env))
        continue
      }
      return
    }
    throw new Error('session: the state never settled')
  }

  /** Walk an open dialogue to its end, taking the first available choice at every fork. */
  closeDialogue(): void {
    for (let i = 0; i < 64 && overlayOf(this.state)?.kind === 'dialogue' && this.state.run !== null; i++) {
      const node = currentNode(this.state.run, this.env)
      const choice = node?.choices[0]
      this.do(choice === undefined ? { type: 'dialogue/continue' } : { type: 'dialogue/choose', choiceId: choice.id, attemptingUnitId: null })
      this.settle()
    }
  }

  /** Effects of the whole session, filtered — `s.kinds('autosave')` reads like the log the player caused. */
  kinds<K extends Effect['kind']>(kind: K): readonly Extract<Effect, { kind: K }>[] {
    return this.effects.filter((e): e is Extract<Effect, { kind: K }> => e.kind === kind)
  }
}
