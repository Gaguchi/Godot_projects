/**
 * ui/store.ts — the React binding over the engine runtime (ARCHITECTURE §3). The only file that
 * knows both worlds. `useSyncExternalStore` with a memoised selector; effects are handed to one
 * consumer (`ui/effects`) and dropped. Boot (`main.tsx`) calls `initStore` once with the localStorage
 * persister and the UI scheduler; tests call it with fakes and `resetStore()` between cases.
 *
 * The env every selector needs is the RUNTIME's (`getEnv` / `useEnv`) — never `defaultEnv()`, which would be a
 * second source that drifts under `withRules` flips and fixture content. Disabled-with-reason comes from
 * `canDispatch` / `useLegal` (= `flow/legality.ts#isLegal`), never from a dispatch-and-read-`refused`.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { createRuntime, type EffectListener, type Runtime, type RuntimeOptions, type StateListener } from '../engine/flow/runtime'
import { isLegal } from '../engine/flow/legality'
import { isDevAction, type Action, type Legality } from '../engine/actions'
import type { Effect } from '../engine/effects'
import type { EngineEnv, GameState } from '../engine/types'

let runtime: Runtime | null = null

// ── settled tracking: true while any effect-listener promise of the last commit is pending ──
let settledPending = false
let settledVersion = 0
const settledListeners = new Set<() => void>()
const notifySettled = (): void => { for (const l of settledListeners) l() }

function trackSettled(rt: Runtime): void {
  rt.subscribe(() => {
    const version = ++settledVersion
    if (!settledPending) { settledPending = true; notifySettled() }
    // `commit` builds this commit's aggregate AFTER the state listeners run — read it a microtask later.
    queueMicrotask(() => {
      void rt.settled().then(() => {
        if (version !== settledVersion) return
        settledPending = false
        notifySettled()
      })
    })
  })
}

/** Idempotent (StrictMode double-mount safe): the first call wins. */
export function initStore(opts: RuntimeOptions): Runtime {
  if (runtime === null) {
    runtime = createRuntime(opts)
    trackSettled(runtime)
  }
  return runtime
}

export function resetStore(): void {
  runtime?.destroy()
  runtime = null
  settledPending = false
  settledVersion = 0
  settledListeners.clear()
}

function rt(): Runtime {
  if (runtime === null) throw new Error('store not initialised — call initStore() at boot')
  return runtime
}

export const getState = (): GameState => rt().getState()
/** The runtime's env — the ONE env the UI reads (selectors: `legalTargets(state, …, env)`, `shopStock(town, run, env)`, …). */
export const getEnv = (): EngineEnv => rt().env

/** CONTRACT §10: "Production refuses `dev/*` at the store". A built game exposes no `window.__game` either, so this
 *  is belt-and-braces — but the belt is the one the contract names, and it makes `isDevAction` a live reader. */
const DEV_REFUSED: Legality = { ok: false, reason: 'developer actions are not available in this build' }
const blockedInProduction = (action: Action): boolean => !import.meta.env.DEV && isDevAction(action)

export const dispatch = (action: Action): readonly Effect[] => (blockedInProduction(action) ? [] : rt().dispatch(action))
export const subscribe = (listener: StateListener): (() => void) => rt().subscribe(listener)
export const onEffects = (listener: EffectListener): (() => void) => rt().onEffects(listener)
/** `isLegal(getState(), action, env)` — the disabled-with-reason for imperative code (drag handlers, key handlers). */
export const canDispatch = (action: Action): Legality => (blockedInProduction(action) ? DEV_REFUSED : isLegal(rt().getState(), action, rt().env))
/** Pause the pump loop (`travel/step`, `combat/enemyStep`). `state.ui.modal` is the ONE pause source: `ui/modals`
 *  binds it here, because `nextPump` never reads `state.ui` (CONTRACT §3, CONTRACT-CHANGES 0015). */
export const setPaused = (paused: boolean): void => { rt().setPaused(paused) }
export const isPaused = (): boolean => rt().isPaused()

const subscribeVoid = (notify: () => void): (() => void) => rt().subscribe(notify)

/** Select a slice; re-renders only when `isEqual` (default `Object.is`) says the selection changed. Pass `shallow` for objects/arrays. */
export function useGame<T>(selector: (state: GameState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const cache = useRef<{ state: GameState; selector: typeof selector; value: T } | null>(null)
  const getSnapshot = useCallback((): T => {
    const state = rt().getState()
    const c = cache.current
    if (c !== null && c.state === state && c.selector === selector) return c.value
    const value = selector(state)
    const kept = c !== null && isEqual(c.value, value) ? c.value : value
    cache.current = { state, selector, value: kept }
    return kept
  }, [selector, isEqual])
  return useSyncExternalStore(subscribeVoid, getSnapshot, getSnapshot)
}

/** The runtime's env (stable for the runtime's lifetime — no subscription needed). */
export function useEnv(): EngineEnv {
  return rt().env
}

const legalityEqual = (a: Legality, b: Legality): boolean =>
  a.ok === b.ok && (a.ok || b.ok || a.reason === b.reason)

/** Disabled-with-reason for a rendered control, memoised on state (ARCHITECTURE §5: every interactive element has one). */
export function useLegal(action: Action): Legality {
  const selector = useCallback((state: GameState): Legality => isLegal(state, action, rt().env), [action])
  return useGame(selector, legalityEqual)
}

/** Subscribe a component to the effect stream for its lifetime (the effect consumer, the dev HUD). */
export function useEffects(handler: EffectListener): void {
  useEffect(() => onEffects(handler), [handler])
}

const subscribeSettled = (notify: () => void): (() => void) => {
  settledListeners.add(notify)
  return () => { settledListeners.delete(notify) }
}
const getSettledSnapshot = (): boolean => !settledPending

/** false while an effect listener of the last commit is still animating — the ONE sanctioned transient flag: overlays
 *  and screens that mount in the same commit as preceding effects (a dialogue after a hop) defer their enter animation on it. */
export function useSettled(): boolean {
  return useSyncExternalStore(subscribeSettled, getSettledSnapshot, getSettledSnapshot)
}

export function shallow<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a) as (keyof T)[]
  const kb = Object.keys(b) as (keyof T)[]
  if (ka.length !== kb.length) return false
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]))
}
