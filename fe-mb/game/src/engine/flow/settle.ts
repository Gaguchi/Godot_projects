/**
 * flow/settle.ts — the framework-free flow controller, run after EVERY reduce (§7.13, §7.16, §7.30,
 * §2.12 quests, §2.14 rule 6). Bounded loop (≤ `rules.quests.maxSettlePasses × 4` passes — CONTRACT-CHANGES 0035;
 * exhausting it throws `SettleCapError` with the walk) until nothing changes:
 *  1.  combat && phase !== 'combat' → `resolveBattle` (report incl. `field`) → for every tag but `tutorial`:
 *      `applyBattleResult` (payout; queues `pendingFollowUps`) → combat = null → `run.lastBattle` = report,
 *      screen battleEnd. Tutorial: NO payout / HP write-back / deathLog — `lastBattle` = the report as is, screen
 *      battleEnd, either outcome (`battleEnd/dismiss` then marks `tutorialSeen` and opens the prologue).
 *      EVERY battle ends on its report: a non-tutorial defeat rests at `battleEnd` exactly as a finalBoss victory
 *      does, and `endRun('lost')` happens on `battleEnd/dismiss` (CONTRACT-CHANGES 0082).
 *  1b. run !== null && combat === null && screen ∉ {title, battleEnd} && (livingUnits(run).length === 0 ||
 *      (knobs.mcDeathIsDefeat && !isMcAlive(run))) → `endRun('lost')` in the same pass (starvation on the road,
 *      `damageParty`): defeat is terminal everywhere, never only inside combat — ledger from the run, urgent
 *      null-save, no Continue. The battleEnd term is what lets a wiped company read the report of the fight that
 *      wiped it; turning that page is the only way off the screen, and it ends the run.
 *  2.  run → `settleQuests` (fixed point; onEnter effects may open slots or recruit).
 *  3.  run.pendingFollowUps non-empty && no blocking overlay && combat === null && screen ∉ {battleEnd, title}
 *      → shift the head and open it (dialogue → `openDialogue(source)`; checkEvent → `openCheckEvent(source)`).
 *  4.  run.pendingCombat && no blocking overlay && combat === null && screen ∉ {battleEnd, title}
 *      → combat = `seedBattle(battleSpecFor(run, pendingCombat))`, **pendingCombat = null**, screen combat, `battleStarted`.
 *      (The quick menu and the tutorial hint never block 3–4: a battle challenged FROM the node menu must start — 0025.)
 *  5.  run.pendingTravel?.status === 'suspended' && overlayOf === null && combat === null && no pendingCombat && screen === overworld → `resumeTravel`.
 *  6.  run.activeDungeon?.bossCleared && screen === dungeon && overlayOf === null → `leaveDungeon` → overworld.
 *  7.  a closed prologue dialogue (screen prologue, pendingDialogue null) → flag `prologue_seen` + screen overworld.
 * The autosave hint is appended by `reducer.ts`, which sees the pre-action state.
 * EVERY rule carries a title term (rule 1 included): a parked run stays exactly as saved until Continue, so no
 * `ui/*` toggle on the Title screen can resolve, pay out or route a battle that was saved mid-resolution.
 */
import type { ReduceResult } from '../actions'
import type { Effect } from '../effects'
import type { BattleReport, EngineEnv, GameState, RunState } from '../types'
import { resolveBattle } from '../combat/resolve'
import { seedBattle } from '../combat/seed'
import { applyBattleResult, battleSpecFor } from '../run/battle'
import { openCheckEvent } from '../run/checks'
import { openDialogue } from '../run/dialogue'
import { leaveDungeon } from '../run/dungeon'
import { setFlag } from '../run/flags'
import { isMcAlive, livingUnits } from '../run/party'
import { settleQuests } from '../run/quests'
import { resumeTravel } from '../run/travel'
import { endRun } from './lifecycle'
import { overlayOf } from './pump'

const PROLOGUE_SEEN_FLAG = 'prologue_seen'

/** A report for the lesson: no payout, no wounds, nothing found — the board and the outcome, so the Field Report can
 *  show the first victory (or the rare loss) before the prologue. */
function tutorialReport(run: RunState, result: ReturnType<typeof resolveBattle>): BattleReport {
  return {
    battleId: result.battleId,
    tag: result.tag,
    outcome: result.outcome,
    rounds: result.rounds,
    field: result.field,
    enemiesDefeated: result.enemiesDefeated,
    goldEarned: 0,
    survivors: Object.entries(result.survivorHp).flatMap(([unitId, current]) => {
      const u = run.party[unitId]
      return u === undefined ? [] : [{ unitId, name: u.name, hp: { current, max: u.hp.max } }]
    }),
    fallen: [],
    loot: [],
    prisoners: [],
    consumedItems: [],
  }
}

/** The quick menu and the tutorial hint are chrome, not suspenders: a queued scene or battle opens over them. */
function blocked(state: GameState): boolean {
  const o = overlayOf(state)
  return o !== null && o.kind !== 'quickMenu' && o.kind !== 'tutorial'
}

function pass(state: GameState, effects: Effect[], env: EngineEnv): GameState {
  const screen = state.screen.kind
  const combat = state.combat
  const run = state.run

  // 1. a battle has ended (never on the title screen: a parked run stays exactly as saved until Continue — §3)
  if (combat !== null && combat.phase !== 'combat' && run !== null && screen !== 'title') {
    const result = resolveBattle(combat, env)
    if (combat.tag === 'tutorial') {
      const report = tutorialReport(run, result)
      effects.push({ kind: 'battleResolved', report })
      return { ...state, combat: null, run: { ...run, lastBattle: report }, screen: { kind: 'battleEnd' } }
    }
    const applied = applyBattleResult(run, result, env)
    effects.push(...applied.effects)
    // Defeat included: the fight that ended the run is the one whose report the player most wants, and it is the
    // last thing the run has to say. `battleEnd/dismiss` calls `endRun('lost')` (reducer.ts), exactly as a won
    // finale calls `endRun('won')`.
    return { ...state, combat: null, run: { ...applied.state, lastBattle: applied.report }, screen: { kind: 'battleEnd' } }
  }

  // 1b. defeat is terminal everywhere (starvation, quest damage, an MC lost on a won field) — but a company under
  // its OWN field report is allowed to be wiped for exactly as long as the report is up (rule 1 above).
  if (run !== null && combat === null && screen !== 'title' && screen !== 'battleEnd' && (livingUnits(run).length === 0 || (env.rules.knobs.mcDeathIsDefeat && !isMcAlive(run)))) {
    const ended = endRun(state, 'lost', env)
    effects.push(...ended.effects)
    return ended.state
  }

  if (run === null || screen === 'title') return state

  // 2. quests settle to a fixed point
  const settled = settleQuests(run, env)
  if (settled.state !== run) {
    effects.push(...settled.effects)
    return { ...state, run: settled.state }
  }

  // 3. one post-battle scene at a time
  const head = run.pendingFollowUps[0]
  if (head !== undefined && combat === null && screen !== 'battleEnd' && !blocked(state)) {
    const rest = { ...run, pendingFollowUps: run.pendingFollowUps.slice(1) }
    const opened = head.kind === 'dialogue' ? openDialogue(rest, head.dialogueId, head.source, env) : openCheckEvent(rest, head.checkEventId, head.source, env)
    effects.push(...opened.effects)
    return { ...state, run: opened.state }
  }

  // 4. a waiting battle is seeded once nothing suspends it
  if (run.pendingCombat !== null && combat === null && screen !== 'battleEnd' && !blocked(state)) {
    const spec = battleSpecFor(run, run.pendingCombat, env)
    const seeded = seedBattle(spec, env)
    effects.push({ kind: 'battleStarted', battleId: seeded.battleId, enemyIds: Object.values(seeded.units).filter((u) => u.team === 'enemy').map((u) => u.id) })
    return { ...state, combat: seeded, run: { ...run, pendingCombat: null }, screen: { kind: 'combat' } }
  }

  // 5. the road picks up where the encounter interrupted it
  if (run.pendingTravel?.status === 'suspended' && combat === null && run.pendingCombat === null && screen === 'overworld' && overlayOf(state) === null) {
    return { ...state, run: resumeTravel(run) }
  }

  // 6. a cleared dungeon returns the company to the map
  if (run.activeDungeon?.bossCleared === true && screen === 'dungeon' && overlayOf(state) === null) {
    const left = leaveDungeon(run)
    if (left.ok) return { ...state, run: left.run, screen: { kind: 'overworld' } }
  }

  // 7. the prologue closed
  if (screen === 'prologue' && run.pendingDialogue === null) {
    const flagged = setFlag(run, PROLOGUE_SEEN_FLAG, true, 'run')
    effects.push(...flagged.effects)
    return { ...state, run: flagged.state, screen: { kind: 'overworld' } }
  }

  return state
}

/** The settle loop reached its cap without a fixed point — a rule cycle, never a flow. `dump` holds the states the
 *  loop walked (oldest first), so a test fails with the chain in hand instead of shipping a half-settled soft-lock
 *  (the same contract as `combat/sim.ts#RoundCapError`). */
export class SettleCapError extends Error {
  constructor(message: string, readonly dump: readonly GameState[]) {
    super(message)
    this.name = 'SettleCapError'
  }
}

/** Passes per settle = `rules.quests.maxSettlePasses` × this: one quest fixed point can be followed by a report, a
 *  follow-up, a battle, a resume and a dungeon exit, each re-running rule 2 (CONTRACT-CHANGES 0035). */
const PASS_BUDGET_PER_QUEST_PASS = 4

export function settle(result: ReduceResult, env: EngineEnv): ReduceResult {
  const effects: Effect[] = [...result.effects]
  let state = result.state
  // Each rule fires at most once per pass and the passes are bounded: a chain (battle → payout → quest → follow-up →
  // pending battle) settles in a handful, and a cycle can only reach the cap — where it THROWS with the walk, rather
  // than returning an unseeded battle / unopened scene nothing in the log explains.
  const max = env.rules.quests.maxSettlePasses * PASS_BUDGET_PER_QUEST_PASS
  const dump: GameState[] = [state]
  for (let i = 0; i < max; i++) {
    const next = pass(state, effects, env)
    if (next === state) return { state, effects }
    state = next
    dump.push(state)
  }
  throw new SettleCapError(`settle: no fixed point after ${max} passes — a settle rule is cycling`, dump)
}

/** Dev/test invariant guard: recursively `Object.freeze`. Production skips it. */
export function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const v of Object.values(value as Record<string, unknown>)) freezeDeep(v)
  return Object.freeze(value)
}
