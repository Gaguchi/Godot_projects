/**
 * main.tsx — boot (CONTRACT §2 ui/store, §10 dev fast-path).
 *  1. env = defaultEnv(); initial = the parsed autosave (`embermarch:run` — meta + run + combat) or `initialState(meta)`.
 *  2. `?screen=<kind>&seed=<n>` (dev only): build the fixture through the real reducer and dispatch `dev/seedState`;
 *     such a scratch session never writes localStorage.
 *  3. initStore with the localStorage persister (urgent = synchronous, else coalesced to the next macrotask) and the
 *     UI scheduler (waits for the effect consumer, then the hop/step delay; 0 under `?motion=0` / reduced motion).
 *  4. `window.__game` for Playwright (incl. the sanctioned wait primitives `settled()` / `isQuiescent()`);
 *     render <App/> inside the scaled Stage.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { defaultEnv } from './engine/content'
import { fixtureFor } from './engine/flow/fixtures'
import { initialState } from './engine/flow/lifecycle'
import { isQuiescent } from './engine/flow/pump'
import type { PumpAction } from './engine/actions'
import { parseMeta, parseSave, serialize } from './engine/save/codec'
import type { GameState, MetaState, SaveFile, ScreenKind } from './engine/types'
import { App } from './ui/App'
import { Stage, clientToStage } from './ui/StageView'
import { dispatch, getState, initStore } from './ui/store'
import { configureMotion, delayFor } from './ui/timings'

const SCREENS: readonly ScreenKind[] = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver']

const env = defaultEnv()
const params = new URLSearchParams(window.location.search)
configureMotion(window.location.search, window.matchMedia('(prefers-reduced-motion: reduce)').matches)

/** The parse failure in words the player owns — the file is already gone by the time this is read. */
function noteFor(reason: 'version' | 'content' | 'schema' | 'json'): string {
  switch (reason) {
    case 'version': return 'Your last run was saved by a different version of the game and could not be opened. It has been cleared.'
    case 'content': return 'Your last run belongs to a different version of the game’s content and could not be opened. It has been cleared.'
    case 'schema':
    case 'json': return 'Your last run’s save file was damaged and could not be read. It has been cleared.'
  }
}

function readSave(): { readonly initial: GameState; readonly note: string | null } {
  const { runKey, metaKey } = env.rules.save
  let meta: Partial<MetaState> = {}
  try {
    const rawMeta = localStorage.getItem(metaKey)
    if (rawMeta !== null) {
      const m = parseMeta(rawMeta)
      if (m.ok) meta = m.value
    }
    const raw = localStorage.getItem(runKey)
    if (raw !== null) {
      const parsed = parseSave(raw, env)
      if (parsed.ok) return { initial: { ...initialState(), meta: parsed.value.meta, run: parsed.value.run, combat: parsed.value.combat }, note: null }
      localStorage.removeItem(runKey)
      return { initial: initialState(meta), note: noteFor(parsed.reason) }
    }
  } catch {
    /* storage unavailable: play without saving */
  }
  return { initial: initialState(meta), note: null }
}

const fixtureScreen = import.meta.env.DEV ? (params.get('screen') as ScreenKind | null) : null
const scratch = fixtureScreen !== null && SCREENS.includes(fixtureScreen)
const boot = scratch ? { initial: initialState(), note: null } : readSave()

let pendingWrite: SaveFile | null = null
let writeTimer: number | null = null
function writeNow(file: SaveFile): void {
  try {
    localStorage.setItem(env.rules.save.runKey, serialize(file))
    localStorage.setItem(env.rules.save.metaKey, JSON.stringify(file.meta))
  } catch (e) {
    console.warn('autosave failed', e)
  }
}
function persist(file: SaveFile, urgent: boolean): void {
  if (scratch) return
  if (urgent) {
    if (writeTimer !== null) { window.clearTimeout(writeTimer); writeTimer = null }
    pendingWrite = null
    writeNow(file)
    return
  }
  pendingWrite = file
  if (writeTimer === null) {
    writeTimer = window.setTimeout(() => {
      writeTimer = null
      if (pendingWrite !== null) { writeNow(pendingWrite); pendingWrite = null }
    }, 0)
  }
}

function schedule(pump: PumpAction, run: () => void, settled: Promise<void>): () => void {
  let cancelled = false
  let timer: number | null = null
  void settled.then(() => {
    if (cancelled) return
    timer = window.setTimeout(() => { if (!cancelled) run() }, delayFor(pump.type))
  })
  return () => {
    cancelled = true
    if (timer !== null) window.clearTimeout(timer)
  }
}

const runtime = initStore({ env, initial: boot.initial, persist, schedule, log: import.meta.env.DEV, dev: import.meta.env.DEV, onError: (e) => console.error(e) })
if (scratch && fixtureScreen !== null) {
  const seed = Number(params.get('seed') ?? 1)
  dispatch({ type: 'dev/seedState', state: fixtureFor(fixtureScreen, seed, env) })
  // CONTRACT §10: a `?screen=` session writes no autosave, so it must wear the dev badge (`ui.devHud`).
  dispatch({ type: 'ui/toggleDevHud' })
}
if (boot.note !== null) console.warn(boot.note)

declare global {
  interface Window {
    __game?: {
      getState: typeof getState
      dispatch: typeof dispatch
      runtime: typeof runtime
      clientToStage: typeof clientToStage
      env: typeof env
      /** CONTRACT §10 / CONTRACT-CHANGES 0021 — the sanctioned e2e wait: `await settled()` then expect `isQuiescent()`. */
      isQuiescent: () => boolean
      settled: () => Promise<void>
    }
  }
}
// DEV ONLY (README "dev builds only"): the Playwright handle is not shipped — a production page exposes no
// dispatch into the reducer, so a built game cannot be driven from the console.
if (import.meta.env.DEV) {
  window.__game = {
    getState, dispatch, runtime, clientToStage, env,
    isQuiescent: () => isQuiescent(getState()),
    settled: () => runtime.settled(),
  }
}

const root = document.getElementById('root')
if (root === null) throw new Error('#root missing')
createRoot(root).render(
  <React.StrictMode>
    <Stage>
      <App bootNote={boot.note} />
    </Stage>
  </React.StrictMode>,
)
