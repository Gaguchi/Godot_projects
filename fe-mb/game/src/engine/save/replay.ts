/**
 * save/replay.ts — the action log is the other save format (ARCHITECTURE §2): `{ seed, actions[] }`
 * replays to the same state as a snapshot. Kept in memory by the runtime (`log: true`); tests and the
 * CLI `replay` command fold it and diff against a snapshot to find the first divergence.
 *
 * Correct by construction: `replay` is nothing but `actions.reduce(reduce)` — there is no second interpretation of
 * an action anywhere. The fold is exposed with an injectable reducer (`replayWith` / `verifyReplayWith`) so the
 * module is testable with a fake reducer while `engine/reducer.ts` is still landing; `replay` / `verifyReplay`
 * bind the real one.
 */
import type { Action, ReduceResult } from '../actions'
import type { EngineEnv, GameState } from '../types'
import { reduce } from '../reducer'
import { formatPath } from './schema'

export type Reducer = (state: GameState, action: Action, env: EngineEnv) => ReduceResult

export type ReplayVerdict = { readonly ok: true } | { readonly ok: false; readonly index: number; readonly path: string }

/** The slices a replay must reproduce. `ui` is deliberately absent: it is never persisted, never read by legality
 *  (CONTRACT-CHANGES 0015), so two folds that differ only in `ui` are the same game. */
const COMPARED_SLICES = ['meta', 'run', 'combat', 'ledger', 'screen'] as const

export function replayWith(reducer: Reducer, initial: GameState, actions: readonly Action[], env: EngineEnv): GameState {
  let state = initial
  for (const action of actions) state = reducer(state, action, env).state
  return state
}

/** Fold `reduce` over `actions` from `initial`. The runtime logs ui actions too; they may be kept or filtered out
 *  (`isUiAction`) — legality never reads `ui`, so either way the persisted slices come out identical. */
export function replay(initial: GameState, actions: readonly Action[], env: EngineEnv): GameState {
  return replayWith(reduce, initial, actions, env)
}

/**
 * Fold, then deep-compare meta/run/combat/ledger/screen against `snapshot`.
 *
 * `index` semantics: a reducer that THROWS on action `i` is a divergence at `i` (the live runtime only logs an
 * action after it reduced without throwing) and `path` is `<reduce threw: …>`. Otherwise only a terminal snapshot
 * exists, so a mismatch is pinned to the LAST action (`actions.length - 1`; `-1` when the log is empty and the
 * initial state itself differs) and `path` names the first differing field in `meta → run → combat → ledger →
 * screen` order. A caller holding intermediate snapshots bisects with prefixes of the log.
 */
export function verifyReplayWith(reducer: Reducer, initial: GameState, actions: readonly Action[], snapshot: GameState, env: EngineEnv): ReplayVerdict {
  let state = initial
  for (let i = 0; i < actions.length; i++) {
    try {
      state = reducer(state, actions[i]!, env).state
    } catch (error) {
      return { ok: false, index: i, path: `<reduce threw: ${error instanceof Error ? error.message : String(error)}>` }
    }
  }
  const path = firstDivergence(state, snapshot)
  return path === null ? { ok: true } : { ok: false, index: actions.length - 1, path }
}

/** Deep-equal on meta/run/combat/ledger/screen; reports the first diverging action index and JSON path. */
export function verifyReplay(initial: GameState, actions: readonly Action[], snapshot: GameState, env: EngineEnv): ReplayVerdict {
  return verifyReplayWith(reduce, initial, actions, snapshot, env)
}

/** The first path (e.g. `run.party.mc.hp.current`, `combat.grid.obstacles[2]`) where the persisted-or-routing slices of
 *  `a` and `b` differ, or `null` when they are deep-equal. Key order is irrelevant; `ui` is never compared. */
export function firstDivergence(a: GameState, b: GameState): string | null {
  for (const slice of COMPARED_SLICES) {
    const d = diff(a[slice], b[slice], [slice])
    if (d !== null) return d
  }
  return null
}

function diff(a: unknown, b: unknown, path: readonly (string | number)[]): string | null {
  // `===` folds ±0 (JSON writes -0 as 0, so a live `Math.round(-0.4)` must equal its hydrated twin); `Object.is` keeps NaN equal.
  if (a === b || Object.is(a, b)) return null
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return formatPath(path)
  const aArr = Array.isArray(a)
  const bArr = Array.isArray(b)
  if (aArr !== bArr) return formatPath(path)
  if (aArr && bArr) {
    const n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) {
      if (i >= a.length || i >= b.length) return formatPath([...path, i])
      const d = diff(a[i], b[i], [...path, i])
      if (d !== null) return d
    }
    return null
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  for (const key of Object.keys(ao)) {
    if (!Object.hasOwn(bo, key)) return formatPath([...path, key])
    const d = diff(ao[key], bo[key], [...path, key])
    if (d !== null) return d
  }
  for (const key of Object.keys(bo)) {
    if (!Object.hasOwn(ao, key)) return formatPath([...path, key])
  }
  return null
}
