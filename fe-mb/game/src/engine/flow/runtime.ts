/**
 * flow/runtime.ts — the ONE dispatch chokepoint, host-agnostic (ARCHITECTURE §2; brief §7.13, §8.3).
 * IMPLEMENTED (not a stub): it carries no game rules. `ui/store.ts` binds React to it; `scripts/cli.ts`
 * drives it with no scheduler and `drain()`.
 *
 *   dispatch(action) → reduce → commit:
 *       state ← result.state; log
 *       DEV GUARD (`dev: true` only): `assertInvariants` then `freezeDeep` — the two guards ARCHITECTURE §7 names
 *       PERSIST on `autosave` (before anyone is told — a listener that throws can never leave storage holding a
 *                              run that memory has already ended; brief §2.14 rule 6)
 *       assert a pump was not refused (a refused pump means `nextPump` and `isLegal` disagree — a contract bug)
 *       state listeners → effect listeners (each may return a promise) → `settled()` aggregates them
 *     → schedule the next pump (if a scheduler is installed) with that settled promise
 *
 * Re-entrancy: a `dispatch` from inside a listener is queued and applied after the current commit, so a
 * subscriber never observes a half-applied state. One pump is scheduled at a time; every commit cancels
 * a stale schedule and re-derives `nextPump`. The runtime never touches timers, storage or the DOM —
 * those come in through `schedule` and `persist`.
 */
import { isPumpAction, type Action, type PumpAction, type ReduceResult } from '../actions'
import type { Effect } from '../effects'
import type { EngineEnv, GameState, SaveFile } from '../types'
import { reduce } from '../reducer'
import { toSaveFile } from '../save/codec'
import { assertInvariants } from './invariants'
import { nextPump } from './pump'
import { freezeDeep } from './settle'

export type StateListener = (state: GameState, prev: GameState) => void
/** `prev` is the state before this action (diff-driven animations: HP from→to, hand reorder, AP pips — no component
 *  memory needed). A returned promise holds back the next pump and `useSettled()` until it settles. */
export type EffectListener = (effects: readonly Effect[], action: Action, state: GameState, prev: GameState) => void | Promise<void>

export interface RuntimeOptions {
  readonly env: EngineEnv
  readonly initial: GameState
  /** Host persistence. The engine builds the SaveFile; the host writes it. `urgent` ⇒ write now, else coalesce.
   *  Called BEFORE listeners; a throw is routed to `onError` and never skips notification. Omit for CLI/tests. */
  readonly persist?: (file: SaveFile, urgent: boolean) => void
  /** Host scheduling of pump steps. `settled` resolves when every effect listener of the last commit has drained;
   *  the UI scheduler awaits it, then the hop/step delay. Must return a cancel. Omit for CLI/tests and call
   *  `pump()` / `drain()` yourself. */
  readonly schedule?: (pump: PumpAction, run: () => void, settled: Promise<void>) => () => void
  readonly onError?: (error: unknown, action: Action) => void
  /** Keep every dispatched action in memory (`actions`) for replay tests and the dev HUD. */
  readonly log?: boolean
  /** Dev/test guard, OFF by default so production's hot path is untouched (ARCHITECTURE §7): after every commit,
   *  `assertInvariants` (a state the slots contradict fails HERE, at the action that made it) and `freezeDeep`
   *  (a system that mutates a shared array throws instead of corrupting a later frame). */
  readonly dev?: boolean
}

export interface Runtime {
  /** The env this runtime reduces with — the ONE env the UI may read (selectors take it; never `defaultEnv()`). */
  readonly env: EngineEnv
  getState(): GameState
  /** Returns the effects of THIS action (queued re-entrant dispatches return `[]`). */
  dispatch(action: Action): readonly Effect[]
  subscribe(listener: StateListener): () => void
  onEffects(listener: EffectListener): () => void
  /** Dispatch one due pump synchronously; false when none is due, the runtime is paused, or a pump was refused. */
  pump(): boolean
  /** Pump until none is due; throws past `max` (default rules.combat.roundCap × 10). Returns the count. */
  drain(max?: number): number
  /** Pause modal / animation blocking: no pump is scheduled or run while paused. */
  setPaused(paused: boolean): void
  isPaused(): boolean
  /** Resolves when every effect-listener promise of the most recent commit has settled (immediately when none). */
  settled(): Promise<void>
  /** The in-memory action log (empty unless `log: true`). */
  readonly actions: readonly Action[]
  destroy(): void
}

export function createRuntime(opts: RuntimeOptions): Runtime {
  const { env } = opts
  let state = opts.initial
  let paused = false
  let destroyed = false
  let dispatching = false
  /** Set when a pump came back `refused`; automatic pumping halts until the next non-pump dispatch. */
  let pumpHalted = false
  let cancelPump: (() => void) | null = null
  let lastSettled: Promise<void> = Promise.resolve()
  const queue: Action[] = []
  const actions: Action[] = []
  const stateListeners = new Set<StateListener>()
  const effectListeners = new Set<EffectListener>()

  function commit(action: Action): readonly Effect[] {
    const prev = state
    let result: ReduceResult
    try {
      result = reduce(prev, action, env)
    } catch (error) {
      opts.onError?.(error, action)
      throw error
    }
    state = result.state
    if (opts.log) actions.push(action)

    // 0. Dev guard (opt-in): the state the action produced must satisfy the invariants, and nothing downstream may
    //    mutate it. Both throw through `onError` at the guilty action rather than at the frame that trips over it.
    if (opts.dev === true) {
      try {
        assertInvariants(state, env)
      } catch (error) {
        opts.onError?.(error, action)
        throw error
      }
      freezeDeep(state)
    }

    // 1. Persistence precedes notification (brief §2.14 rule 6).
    if (opts.persist) {
      const hint = result.effects.find((e): e is Extract<Effect, { kind: 'autosave' }> => e.kind === 'autosave')
      if (hint) {
        try {
          opts.persist(toSaveFile(state, env), hint.urgent)
        } catch (error) {
          opts.onError?.(error, action)
        }
      }
    }

    // 2. A refused pump is a contract bug, never a flow: halt automatic pumping and report it.
    if (isPumpAction(action)) {
      const refused = result.effects.find((e): e is Extract<Effect, { kind: 'refused' }> => e.kind === 'refused')
      if (refused) {
        pumpHalted = true
        const error = new Error(`runtime: pump ${action.type} was refused (${refused.reason}) — nextPump and isLegal disagree`)
        opts.onError?.(error, action)
        throw error
      }
    } else {
      pumpHalted = false
    }

    // 3. Notification.
    for (const l of stateListeners) l(state, prev)
    const pending: Promise<void>[] = []
    for (const l of effectListeners) {
      const r = l(result.effects, action, state, prev)
      if (r) pending.push(r.catch((error: unknown) => { opts.onError?.(error, action) }))
    }
    lastSettled = pending.length === 0 ? Promise.resolve() : Promise.all(pending).then(() => undefined)
    return result.effects
  }

  function schedulePump(): void {
    if (cancelPump) {
      cancelPump()
      cancelPump = null
    }
    if (!opts.schedule || paused || destroyed || pumpHalted) return
    const due = nextPump(state)
    if (!due) return
    cancelPump = opts.schedule(due, () => {
      cancelPump = null
      dispatch(due)
    }, lastSettled)
  }

  function dispatch(action: Action): readonly Effect[] {
    if (destroyed) return []
    if (dispatching) {
      queue.push(action)
      return []
    }
    dispatching = true
    try {
      const effects = commit(action)
      while (queue.length > 0) commit(queue.shift()!)
      return effects
    } finally {
      dispatching = false
      schedulePump()
    }
  }

  function pump(): boolean {
    if (paused || destroyed || pumpHalted) return false
    const due = nextPump(state)
    if (!due) return false
    dispatch(due)
    return true
  }

  return {
    env,
    getState: () => state,
    dispatch,
    subscribe(listener) {
      stateListeners.add(listener)
      return () => { stateListeners.delete(listener) }
    },
    onEffects(listener) {
      effectListeners.add(listener)
      return () => { effectListeners.delete(listener) }
    },
    pump,
    drain(max = env.rules.combat.roundCap * 10) {
      let n = 0
      while (pump()) {
        n += 1
        if (n > max) throw new Error(`runtime.drain: more than ${max} pumps without reaching a quiescent state`)
      }
      return n
    },
    setPaused(next) {
      paused = next
      schedulePump()
    },
    isPaused: () => paused,
    settled: () => lastSettled,
    actions,
    destroy() {
      destroyed = true
      if (cancelPump) cancelPump()
      cancelPump = null
      stateListeners.clear()
      effectListeners.clear()
    },
  }
}
