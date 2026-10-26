/**
 * reducer.ts — the root reducer (ARCHITECTURE §2): `GameState × Action ──▶ { state, effects }`.
 *
 * Algorithm (one function, ~80 lines):
 *  1. `isLegal` gate (`flow/legality.ts`, table in docs/rewrite/CONTRACT.md §4). Illegal → `{ state, effects: [refused] }`,
 *     same reference.
 *  2. Route by `action.type` prefix: `ui/` → the ui slice; `combat/` → `combat/reducer` on `state.combat`;
 *     `meta/ save/ tutorial/` → `flow/lifecycle`; `dev/` inline; everything else → `run/reducer`.
 *  3. `flow/settle` on the result (battle resolution, out-of-combat defeat, quest fixed point, follow-up openings,
 *     pending-combat seeding, travel resume, dungeon exit).
 *  4. `screenChanged` when the screen differs; an `autosave` hint when a persisted slice changed (urgent on a screen
 *     change or when the run ended). Freezing is the test harness's job (`flow/settle.ts#freezeDeep`).
 */
import type { Action, CombatAction, DevAction, ReduceResult, UiAction } from './actions'
import type { Effect } from './effects'
import type { EngineEnv, GameState, RunState } from './types'
import { reduceCombat } from './combat/reducer'
import { seedBattle } from './combat/seed'
import { mergeStatus } from './combat/statuses'
import { withUnit } from './combat/state'
import { continueRun, dismissLedger, endRun, hydrate, newRun, quitToTitle, skipTutorial } from './flow/lifecycle'
import { isLegal } from './flow/legality'
import { settle } from './flow/settle'
import { addFood, placeInBag } from './run/bag'
import { addGold } from './run/economy'
import { refKey } from './run/overworld'
import { reduceRun, type RunSideAction } from './run/reducer'

export { initialState } from './flow/lifecycle'
/** Re-exported for engine-side callers; the UI imports it from `flow/legality` (import fence, CONTRACT §6). */
export { isLegal } from './flow/legality'

function reduceUi(state: GameState, action: UiAction): ReduceResult {
  const ui = state.ui
  switch (action.type) {
    case 'ui/openModal': return { state: { ...state, ui: { ...ui, modal: action.modal } }, effects: [] }
    case 'ui/closeModal': return { state: ui.modal === null ? state : { ...state, ui: { ...ui, modal: null } }, effects: [] }
    case 'ui/setTownTab': return { state: { ...state, ui: { ...ui, townTab: action.tab } }, effects: [] }
    case 'ui/toggleDanger': return { state: { ...state, ui: { ...ui, showDanger: !ui.showDanger } }, effects: [] }
    case 'ui/toggleDevHud': return { state: { ...state, ui: { ...ui, devHud: !ui.devHud } }, effects: [] }
    case 'ui/setMapPan': return { state: { ...state, ui: { ...ui, mapPan: action.pan } }, effects: [] }
  }
}

function reduceDev(state: GameState, action: DevAction, env: EngineEnv): ReduceResult {
  const run = state.run
  const withRun = (next: RunState): ReduceResult => ({ state: { ...state, run: next }, effects: [] })
  switch (action.type) {
    case 'dev/seedState': return { state: action.state, effects: [] }
    case 'dev/setScreen': return { state: { ...state, screen: action.screen }, effects: [] }
    case 'dev/startBattle': {
      const combat = seedBattle(action.spec, env)
      const enemyIds = Object.values(combat.units).filter((u) => u.team === 'enemy').map((u) => u.id)
      return { state: { ...state, combat, screen: { kind: 'combat' } }, effects: [{ kind: 'battleStarted', battleId: combat.battleId, enemyIds }] }
    }
    case 'dev/addUnit': {
      if (run === null) return { state, effects: [] }
      const partyOrder = run.partyOrder.includes(action.unit.id) ? run.partyOrder : [...run.partyOrder, action.unit.id]
      return withRun({ ...run, party: { ...run.party, [action.unit.id]: action.unit }, partyOrder })
    }
    case 'dev/addItem': {
      if (run === null) return { state, effects: [] }
      const bag = placeInBag(run.bag, [action.itemId], env)
      return bag === null ? { state, effects: [{ kind: 'refused', action: action.type, reason: 'bag full' }] } : withRun({ ...run, bag })
    }
    case 'dev/addGold': {
      if (run === null) return { state, effects: [] }
      return { state: { ...state, run: addGold(run, action.amount) }, effects: [{ kind: 'goldChanged', delta: action.amount, reason: 'dev' }] }
    }
    case 'dev/addFood': {
      if (run === null) return { state, effects: [] }
      const r = addFood(run, action.amount, 'dev', env)
      return { state: { ...state, run: r.state }, effects: r.effects }
    }
    case 'dev/teleport': {
      if (run === null) return { state, effects: [] }
      const ref = refKey('overworld', env.content.overworld.id, action.nodeId)
      return withRun({ ...run, nodeId: action.nodeId, visitedNodes: { ...run.visitedNodes, [ref]: true }, pendingTravel: null, town: null, camp: null })
    }
    case 'dev/setRunRng': return run === null ? { state, effects: [] } : withRun({ ...run, rng: action.rng })
    case 'dev/setCombatRng': return state.combat === null ? { state, effects: [] } : { state: { ...state, combat: { ...state.combat, rng: action.rng } }, effects: [] }
    case 'dev/applyStatus': {
      const combat = state.combat
      const unit = combat?.units[action.unitId]
      if (combat === undefined || combat === null || unit === undefined) return { state, effects: [] }
      const statuses = mergeStatus(unit.statuses, action.status, env)
      return { state: { ...state, combat: withUnit(combat, { ...unit, statuses }) }, effects: [] }
    }
  }
}

function route(state: GameState, action: Action, env: EngineEnv): ReduceResult {
  const t = action.type
  if (t.startsWith('ui/')) return reduceUi(state, action as UiAction)
  if (t.startsWith('dev/')) return reduceDev(state, action as DevAction, env)
  if (t.startsWith('combat/')) {
    if (state.combat === null) return { state, effects: [{ kind: 'refused', action: t, reason: 'not in a battle' }] }
    const r = reduceCombat(state.combat, action as CombatAction, env)
    return { state: r.state === state.combat ? state : { ...state, combat: r.state }, effects: r.effects }
  }
  switch (action.type) {
    case 'meta/newRun': return newRun(state, action.seed, env)
    case 'meta/continueRun': return continueRun(state)
    case 'meta/toTitle': return quitToTitle(state)
    case 'meta/dismissLedger': return dismissLedger(state)
    case 'meta/setAudioMuted': return { state: state.meta.audioMuted === action.muted ? state : { ...state, meta: { ...state.meta, audioMuted: action.muted } }, effects: [] }
    case 'save/resume': return hydrate(state, action.file, env)
    case 'tutorial/skip': return skipTutorial(state, env)
    case 'battleEnd/dismiss': {
      // The two endings that close a run FROM the report (the flow layer owns `endRun`; `run/reducer` never
      // imports it): a won finale, and any lost battle — the lesson excepted, which has no stakes and no payout.
      // Turning the page IS the act that ends a lost run, so the last fight gets its report like every other
      // (CONTRACT-CHANGES 0082).
      const report = state.run?.lastBattle ?? null
      if (report !== null && report.tag === 'finalBoss' && report.outcome === 'victory') return endRun(state, 'won', env)
      if (report !== null && report.tag !== 'tutorial' && report.outcome === 'defeat') return endRun(state, 'lost', env)
      return reduceRun(state, action, env)
    }
    default:
      return reduceRun(state, action as RunSideAction, env)
  }
}

export function reduce(state: GameState, action: Action, env: EngineEnv): ReduceResult {
  const legal = isLegal(state, action, env)
  if (!legal.ok) return { state, effects: [{ kind: 'refused', action: action.type, reason: legal.reason }] }
  const routed = route(state, action, env)
  // A rule-level refusal (same reference + one `refused`) is final: nothing to settle, nothing to save.
  if (routed.state === state && routed.effects.some((e) => e.kind === 'refused')) return routed
  const settled = settle(routed, env)
  const effects: Effect[] = [...settled.effects]
  const next = settled.state
  const screenChanged = next.screen.kind !== state.screen.kind
  if (screenChanged) effects.push({ kind: 'screenChanged', from: state.screen, to: next.screen })
  const persistedChanged = next.meta !== state.meta || next.run !== state.run || next.combat !== state.combat
  if (persistedChanged && !effects.some((e) => e.kind === 'autosave')) {
    effects.push({ kind: 'autosave', urgent: screenChanged || (state.run !== null && next.run === null) })
  }
  return { state: next, effects }
}

/** Fold; effects concatenated (tests, fixtures, replay). */
export function reduceMany(state: GameState, actions: readonly Action[], env: EngineEnv): ReduceResult {
  const effects: Effect[] = []
  let current = state
  for (const action of actions) {
    const r = reduce(current, action, env)
    current = r.state
    effects.push(...r.effects)
  }
  return { state: current, effects }
}
