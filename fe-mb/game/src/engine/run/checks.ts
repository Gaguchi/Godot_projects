/**
 * run/checks.ts — deterministic single-unit checks and check events (brief §2.12, ported semantics).
 * stat: the attempting LIVING unit's stat ≥ threshold (a dead unit with a passing stat fails);
 * class: any living member; gold/food: party totals. No picker input ⇒ auto-pick the best living candidate.
 *
 * Why single-unit: the party-sum variant ("recruit four 4-STR units to pass STR 12") was rejected by the check
 * spec and is the §7.32 bug — branching lives ONLY at the choice layer, never inside an effect.
 */
import type { SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { CheckCandidate, CheckEventSource, CheckRequirement, EngineEnv, PendingCheckEvent, QuestEffect, RunState, Unit, UnitId } from '../types'
import { foodCount } from './bag'
import { markRoomCleared } from './dungeon'
import { displayName, livingUnits } from './party'
import { applyQuestEffects } from './questEffects'

/** `rules.checks.statCheckRequiresLiving` is the data home of "a dead unit with a passing stat does not pass"
 *  (CONTRACT-CHANGES 0022). Class/gold/food ignore `attempting`. */
export function evaluateCheck(req: CheckRequirement, attempting: Unit | null, run: RunState, env: EngineEnv): boolean {
  switch (req.kind) {
    case 'stat': {
      if (attempting === null) return false
      if (env.rules.checks.statCheckRequiresLiving && attempting.hp.current <= 0) return false
      return attempting.stats[req.stat] >= req.threshold
    }
    case 'class':
      return livingUnits(run).some((u) => u.classId === req.classId)
    case 'gold':
      return run.gold >= req.amount
    case 'food':
      return foodCount(run.bag, env) >= req.amount
  }
}

/** Living units sorted by the stat desc (ties keep party order — a stable sort) with `meetsThreshold`;
 *  `[]` for non-stat checks (they need no picker). Failing candidates stay listed: the player may try anyway. */
export function checkCandidates(req: CheckRequirement, run: RunState): readonly CheckCandidate[] {
  if (req.kind !== 'stat') return []
  const stat = req.stat
  return livingUnits(run)
    .map((u): CheckCandidate => ({
      unitId: u.id,
      name: displayName(u, run),
      classId: u.classId,
      statValue: u.stats[stat],
      meetsThreshold: u.stats[stat] >= req.threshold,
    }))
    .sort((a, b) => b.statValue - a.statValue)
}

/** The best living candidate for a stat check when the player gave no picker input (the headless CLI relies on it);
 *  null for class/gold/food (they auto-resolve) and when `rules.checks.autoPickBestCandidate` is off. */
export function autoPick(req: CheckRequirement, run: RunState, env: EngineEnv): Unit | null {
  if (req.kind !== 'stat' || !env.rules.checks.autoPickBestCandidate) return null
  const best = checkCandidates(req, run)[0]
  return best === undefined ? null : (run.party[best.unitId] ?? null)
}

/** What a resolved event may be sealed with. `untested` is the honest third: a choice with no `check` was never
 *  put to the test, so neither PASSED nor FAILED is true of it. */
export type CheckVerdict = 'passed' | 'failed' | 'untested'

/**
 * The seal, decided in ONE place for the card and for the headless frame. The engine resolves a choice with no
 * `check` as `passed: true` because the outcome branch has to pick a side — but passing implies a test was taken,
 * and there was none: declining an impossible crossing came back stamped PASSED (RE-GATE C 3.11, 0118). `null` while the
 * event is still unresolved.
 */
export function verdictOf(pending: PendingCheckEvent, env: EngineEnv): CheckVerdict | null {
  const result = pending.result
  if (result === null) return null
  const choice = env.content.checkEvents[pending.checkEventId]?.choices.find((c) => c.id === result.choiceId)
  if (choice?.check === undefined) return 'untested'
  return result.passed ? 'passed' : 'failed'
}

function refuse(run: RunState, action: 'check/choose' | 'check/dismiss', reason: string): SliceResult<RunState> {
  return { state: run, effects: [{ kind: 'refused', action, reason }] }
}

/** Refused (programmer error → throw) if a dialogue is already open: checkEvent and dialogue never coexist. */
export function openCheckEvent(run: RunState, checkEventId: string, source: CheckEventSource, env: EngineEnv): SliceResult<RunState> {
  if (run.pendingDialogue !== null) throw new Error(`openCheckEvent('${checkEventId}'): dialogue '${run.pendingDialogue.dialogueId}' is open — one suspender at a time (CONTRACT §3)`)
  if (env.content.checkEvents[checkEventId] === undefined) throw new Error(`openCheckEvent: unknown check event '${checkEventId}'`)
  return { state: { ...run, pendingCheckEvent: { checkEventId, source, result: null } }, effects: [] }
}

/** Resolve → outcome effects applied in order EXCEPT `startDialogue` (kept, in order, in `result.deferredEffects`)
 *  → `result` stored in the slot; emits `checkResolved`. */
export function chooseCheck(run: RunState, choiceId: string, attemptingUnitId: UnitId | null, env: EngineEnv): SliceResult<RunState> {
  const pending = run.pendingCheckEvent
  if (pending === null) return refuse(run, 'check/choose', 'no check event is open')
  if (pending.result !== null) return refuse(run, 'check/choose', 'the check is already resolved')
  const ev = env.content.checkEvents[pending.checkEventId]
  if (ev === undefined) throw new Error(`chooseCheck: unknown check event '${pending.checkEventId}'`)
  const choice = ev.choices.find((c) => c.id === choiceId)
  if (choice === undefined) return refuse(run, 'check/choose', `unknown choice '${choiceId}'`)

  let passed = true
  let attempting: Unit | null = null
  if (choice.check !== undefined) {
    if (attemptingUnitId !== null) {
      attempting = run.party[attemptingUnitId] ?? null
      if (attempting === null) return refuse(run, 'check/choose', `unknown unit '${attemptingUnitId}'`)
    } else {
      attempting = autoPick(choice.check, run, env)
    }
    passed = evaluateCheck(choice.check, attempting, run, env)
  }
  // The schema guarantees `onFail` whenever `check` exists; the `?? onPass` mirrors the shipped modal's fallback.
  const outcome = passed ? choice.onPass : (choice.onFail ?? choice.onPass)
  // `startDialogue` would set the second suspender slot while the narration is still up (CONTRACT-CHANGES 0009):
  // it waits in `deferredEffects` and `dismissCheck` applies it once the slot is clear. Everything else lands now.
  const deferred: QuestEffect[] = []
  const immediate: QuestEffect[] = []
  for (const e of outcome.effects) (e.kind === 'startDialogue' ? deferred : immediate).push(e)

  const attemptingId = choice.check?.kind === 'stat' ? (attempting?.id ?? null) : null
  const resolved: RunState = {
    ...run,
    pendingCheckEvent: {
      ...pending,
      result: { choiceId, passed, attemptingUnitId: attemptingId, narration: outcome.narration, deferredEffects: deferred },
    },
  }
  const applied = applyQuestEffects(resolved, immediate, env)
  const head: Effect = { kind: 'checkResolved', checkEventId: pending.checkEventId, choiceId, passed, attemptingUnitId: attemptingId }
  return { state: applied.state, effects: [head, ...applied.effects] }
}

/** Clears the slot, THEN applies `result.deferredEffects` (dungeon source also marks the room cleared). Travel resume is `flow/settle.ts`. */
export function dismissCheck(run: RunState, env: EngineEnv): SliceResult<RunState> {
  const pending = run.pendingCheckEvent
  if (pending === null) return refuse(run, 'check/dismiss', 'no check event is open')
  if (pending.result === null) return refuse(run, 'check/dismiss', 'the check is not resolved yet')
  let state: RunState = { ...run, pendingCheckEvent: null }
  const effects: Effect[] = []
  const room = run.activeDungeon?.position ?? null
  if (pending.source === 'dungeon' && room !== null) {
    // An event room is "done" when its narration closes — the same moment a combat room is done at payout.
    const cleared = markRoomCleared(state, room, env)
    state = cleared.state
    effects.push(...cleared.effects)
  }
  const deferred = applyQuestEffects(state, pending.result.deferredEffects, env)
  return { state: deferred.state, effects: [...effects, ...deferred.effects] }
}
