/**
 * run/camp.ts — Camp: ONE action per visit — Rest / Scout (`run/scout.ts`) / Leave (brief §2.10).
 * Rest spends food through `consumeFood` (its own verb): the day and hop counters never move at a camp
 * (§7.22 — the old build's Rest went through the hop executor and aged the run).
 *
 * A "visit" is a camp-DAY, not a `camp/enter` (CONTRACT-CHANGES 0029): Leave and Camp again costs no hop, no day
 * and no food, so the counter lives in the PERSISTED `run.campAction` — `run.camp.actionTaken` is only its shadow,
 * recomputed on entry and after each action. `rules.camp.actionsPerVisit` is the live limit.
 */
import type { ActionType, Legality, SliceResult } from '../actions'
import type { EngineEnv, RunState } from '../types'
import { consumeFood, foodCount } from './bag'
import { nodeOf } from './overworld'
import { healParty, livingUnits } from './party'

function refused(run: RunState, action: ActionType, reason: string): SliceResult<RunState> {
  return { state: run, effects: [{ kind: 'refused', action, reason }] }
}

/** One sentence, shared by the flow gate and the rule, so the disabled button and the refusal cannot drift. */
export const NOTHING_TO_MEND = 'nobody is wounded — a ration for nothing'

/** The other one. Both camp verbs are bought with the same ration, and the satchel is the word the camp screen
 *  already uses for where it is kept ("8 rations in the satchel"). */
export const NO_RATIONS = 'no rations in the satchel'

/** The camp's one action, priced. Read by `flow/legality.ts` AND by `campRest`, so REST goes unlit carrying the
 *  sentence the reducer would have refused with instead of swallowing the press (`canInnHeal`'s shape, 0089).
 *  Both halves of the price are here: something to mend, and a ration to burn mending it. */
export function canCampRest(run: RunState, env: EngineEnv): Legality {
  if (!campRestWouldMend(run)) return { ok: false, reason: NOTHING_TO_MEND }
  if (foodCount(run.bag, env) < env.rules.camp.restFoodCost) return { ok: false, reason: NO_RATIONS }
  return { ok: true }
}

/** Camp actions already spent at THIS node TODAY. */
export function campActionsUsed(run: RunState): number {
  const a = run.campAction
  return a !== null && a.nodeId === run.nodeId && a.day === run.daysElapsed ? a.actions : 0
}

/** The day's allowance (`rules.camp.actionsPerVisit`) is gone. */
export function campExhausted(run: RunState, env: EngineEnv): boolean {
  return campActionsUsed(run) >= env.rules.camp.actionsPerVisit
}

/** Books one camp action against (node, day) and refreshes the transient `camp.actionTaken`. */
export function spendCampAction(run: RunState, env: EngineEnv): RunState {
  const actions = campActionsUsed(run) + 1
  return { ...run, campAction: { nodeId: run.nodeId, day: run.daysElapsed, actions }, camp: { actionTaken: actions >= env.rules.camp.actionsPerVisit } }
}

/** Refused unless the current node is a CAMP; `camp.actionTaken` resumes the day's tally, never a fresh one. */
export function enterCamp(run: RunState, env: EngineEnv): SliceResult<RunState> {
  const node = nodeOf(run.nodeId, env)
  if (node.type !== 'CAMP') return refused(run, 'camp/enter', `${node.name} is no place to make camp`)
  if (run.camp !== null) return { state: run, effects: [] }
  return { state: { ...run, camp: { actionTaken: campExhausted(run, env) } }, effects: [] }
}

export function leaveCamp(run: RunState): RunState {
  return run.camp === null ? run : { ...run, camp: null }
}

/**
 * Whether a Rest would mend anything. `campRest` heals EVERY living unit by a fraction of its max, so with a whole
 * company at full HP it spends the ration and the day's one action and changes nothing — a live button that does
 * nothing (the inn already refuses the same night with 'nobody is wounded'). Pure over the run, so
 * `flow/legality.ts` can gate `camp/rest` on it and the button carries the reason before it is pressed
 * (the `canEnterDungeon` shape, CONTRACT-CHANGES 0036).
 */
export function campRestWouldMend(run: RunState): boolean {
  return livingUnits(run).some((u) => u.hp.current < u.hp.max)
}

/** Refused at 0 food, with nobody wounded, or when `camp.actionTaken` — the first two through `canCampRest`, which
 *  the flow gate reads too; `consumeFood(1, 'rest')`; heal every living unit floor(max × restHealFraction);
 *  day and hop counters untouched. */
export function campRest(run: RunState, env: EngineEnv): SliceResult<RunState> {
  if (run.camp === null) return refused(run, 'camp/rest', 'not in camp')
  if (run.camp.actionTaken) return refused(run, 'camp/rest', 'the camp has done its one thing for today')
  const gate = canCampRest(run, env)
  if (!gate.ok) return refused(run, 'camp/rest', gate.reason)
  const fed = consumeFood(run, env.rules.camp.restFoodCost, 'rest', env)
  const healed = healParty(fed.state, env.rules.camp.restHealFraction, false, 'campRest', env)
  return { state: spendCampAction(healed.state, env), effects: [...fed.effects, ...healed.effects] }
}
