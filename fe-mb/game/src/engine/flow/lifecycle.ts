/**
 * flow/lifecycle.ts — title, new run, end of run, resume (§1 flow, §2.14 rule 6, §2.15 ledgers).
 * Routing on the way IN to a run is always `flow/pump.ts#resumeScreen` (CONTRACT-CHANGES 0008).
 */
import type { ReduceResult } from '../actions'
import type { Effect } from '../effects'
import type { EngineEnv, GameState, MetaState, RunState, SaveFile } from '../types'
import { runLedger } from '../run/battle'
import { openDialogue } from '../run/dialogue'
import { seedNewRun } from '../run/newRun'
import { PROLOGUE_DIALOGUE_ID } from '../run/reducer'
import { defaultUiState, fromSaveFile } from '../save/codec'
import { resumeScreen } from './pump'

const DEFAULT_META: MetaState = { gameStarted: false, totalRuns: 0, runsWon: 0, runsLost: 0, tutorialSeen: false, audioMuted: false }

/** Title screen, run/combat/ledger null, ui defaults. */
export function initialState(meta?: Partial<MetaState>): GameState {
  return { meta: { ...DEFAULT_META, ...meta }, run: null, combat: null, ledger: null, screen: { kind: 'title' }, ui: defaultUiState() }
}

/** The prologue, or the map if content has no prologue tree. */
function openPrologue(run: RunState, env: EngineEnv): { readonly run: RunState; readonly effects: readonly Effect[] } {
  if (env.content.dialogues[PROLOGUE_DIALOGUE_ID] === undefined) return { run, effects: [] }
  const opened = openDialogue(run, PROLOGUE_DIALOGUE_ID, 'prologue', env)
  return { run: opened.state, effects: opened.effects }
}

/** Deletes any run, `seedNewRun(seed)`, totalRuns++, gameStarted; tutorial battle (first run — `pendingCombat` with the
 *  authored bandit, seeded by settle) or prologue dialogue. `runStarted`. */
export function newRun(state: GameState, seed: number, env: EngineEnv): ReduceResult {
  const meta: MetaState = { ...state.meta, totalRuns: state.meta.totalRuns + 1, gameStarted: true }
  let run = seedNewRun(seed, env)
  const effects: Effect[] = [{ kind: 'runStarted', runId: run.runId, seed }]
  if (!meta.tutorialSeen) {
    // The bandit is authored by `combat/tutorial.ts#tutorialSpec` from the origin alone; `enemies` is a placeholder.
    run = { ...run, pendingCombat: { origin: { kind: 'tutorial' }, enemies: { kind: 'authored', units: [] }, captureTargets: [] } }
  } else {
    const opened = openPrologue(run, env)
    run = opened.run
    effects.push(...opened.effects)
  }
  const next: GameState = { ...state, meta, run, combat: null, ledger: null }
  return { state: { ...next, screen: { kind: resumeScreen(next) } }, effects }
}

/** Title Continue with a run in memory → `screen = resumeScreen(state)` (combat if a battle is up, town if the player
 *  quit from the Inn, …). Nothing else changes; a parked enemy turn resumes from `nextPump` with no input. */
export function continueRun(state: GameState): ReduceResult {
  return { state: { ...state, screen: { kind: resumeScreen(state) } }, effects: [] }
}

/** Screen → title; run + combat kept exactly (autosave urgent). `nextPump` is null on title by construction, so the
 *  enemy-turn pump simply stops; `resumeScreen` still knows where the player was because the slots are untouched.
 *  The ledger is DROPPED (`meta/toTitle` is legal on win/gameOver too, CONTRACT §4): leaving a terminal screen
 *  discards the summary exactly as `dismissLedger` does, so the title can never carry one (`flow/invariants.ts`). */
export function quitToTitle(state: GameState): ReduceResult {
  return { state: { ...state, ledger: null, screen: { kind: 'title' } }, effects: [{ kind: 'autosave', urgent: true }] }
}

/** ledger = runLedger(run, outcome, trophy); run = null; combat = null; meta.runsWon/Lost++; screen win/gameOver;
 *  `runEnded` + urgent autosave in the SAME result — the terminal screen can never render before the null save lands
 *  (the runtime persists BEFORE any listener runs). Called from settle step 1 (combat defeat), step 1b (starvation /
 *  quest-damage wipe) and `battleEnd/dismiss` (finalBoss victory). */
export function endRun(state: GameState, outcome: 'won' | 'lost', env: EngineEnv): ReduceResult {
  void env
  const run = state.run
  if (run === null) return { state, effects: [] }
  // The trophy is the final report's drop (the finalBoss row is 100% legendary); null on any other ending.
  const trophy = outcome === 'won' && run.lastBattle?.tag === 'finalBoss' ? run.lastBattle.loot[0]?.itemId ?? null : null
  const meta: MetaState = outcome === 'won' ? { ...state.meta, runsWon: state.meta.runsWon + 1 } : { ...state.meta, runsLost: state.meta.runsLost + 1 }
  return {
    state: { ...state, meta, run: null, combat: null, ledger: runLedger(run, outcome, trophy), screen: { kind: outcome === 'won' ? 'win' : 'gameOver' } },
    effects: [{ kind: 'runEnded', outcome }, { kind: 'autosave', urgent: true }],
  }
}

export function dismissLedger(state: GameState): ReduceResult {
  return { state: { ...state, ledger: null, screen: { kind: 'title' } }, effects: [] }
}

/** Atomic install of meta/run/combat from a parsed file; `ledger: null`, `screen: title`, ui defaults. The player
 *  presses Continue (→ `resumeScreen`) or New Run on the Title screen — boot never jumps straight into the run. */
export function hydrate(state: GameState, file: SaveFile, env: EngineEnv): ReduceResult {
  void state
  void env
  return { state: fromSaveFile(file), effects: [] }
}

/** tutorialSeen = true; combat dropped without report or payout; prologue dialogue opens. */
export function skipTutorial(state: GameState, env: EngineEnv): ReduceResult {
  const run = state.run
  if (run === null) return { state, effects: [] }
  const opened = openPrologue({ ...run, pendingCombat: null, lastBattle: null }, env)
  const next: GameState = { ...state, meta: { ...state.meta, tutorialSeen: true }, combat: null, run: opened.run }
  return { state: { ...next, screen: { kind: resumeScreen(next) } }, effects: opened.effects }
}
