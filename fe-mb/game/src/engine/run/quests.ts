/**
 * run/quests.ts — activation, transitions, completion (brief §2.12, §7.32). ONE engine path; status is
 * DERIVED from `questStates`; the `__complete__` sentinel is engine-owned (content never declares it).
 *
 * Why one path: the shipped game had dialogues hand-dispatching stage advances that skipped `onEnter`/`onExit`
 * while engine transitions ran them — two paths, two behaviours (§7.32). Here `startQuest`, `advanceQuest` and
 * `completeQuest` are the only writers of `questStates`, and `settleQuests` (the automatic transition pump) is
 * built on `advanceQuest`, so a stage change fires the same hooks whether a dialogue or a flag caused it.
 */
import { QUEST_COMPLETE_STAGE, walkPredicate } from '../../content/schemas'
import type { SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { Rules } from '../rules'
import type { EngineEnv, Predicate, QuestEffect, QuestState, RunState } from '../types'
import { clearFlagScope } from './flags'
import { evaluate, predicateState } from './predicates'
import { applyQuestEffects } from './questEffects'

/** The sentinel value. `rules.quests.completeSentinel` is typed to this exact literal, so the two homes can never
 *  drift (a change to either is a type error); content cannot declare it (`IdSchema` rejects the underscores). */
export const QUEST_COMPLETE: Rules['quests']['completeSentinel'] = QUEST_COMPLETE_STAGE

export type QuestStatus = 'notStarted' | 'active' | 'complete'

/** What Contracts says about a quest whose stage no shipped content claims — a save that outlived the quest that
 *  wrote it. Never an id, never a derivation of one (ARCHITECTURE §5.1). */
const UNCLAIMED_STAGE = 'Underway'

/**
 * A quest STAGE's line in Contracts — the AUTHORED `label` on the stage, never a humanisation of its id.
 * `stage.replace(/_/g, ' ')` used to stand here and printed "Find daren" on the one page whose job is naming
 * things (FINAL GATE C 3.4); the label is content now, and `content/lint.ts` refuses a stage without one.
 * It lives beside the rule rather than in `ui/names.ts` because the headless game reads Contracts too
 * (CONTRACT §10) and `scripts/**` may not import `ui/**`: `ui/names.ts` re-exports it, so both surfaces write a
 * stage the same way (CONTRACT-CHANGES 0093).
 */
export function stageLabel(questId: string, stage: string, env: EngineEnv): string {
  return env.content.quests[questId]?.stages[stage]?.label ?? UNCLAIMED_STAGE
}

/** absent = notStarted; present & stage !== sentinel = active; sentinel = complete (§2.12). */
export function questStatus(run: RunState, questId: string): QuestStatus {
  const qs = run.questStates[questId]
  if (qs === undefined) return 'notStarted'
  return qs.stage === QUEST_COMPLETE ? 'complete' : 'active'
}

function refuse(run: RunState, action: 'quest/advance' | 'quest/complete', reason: string): SliceResult<RunState> {
  return { state: run, effects: [{ kind: 'refused', action, reason }] }
}

function withQuestState(run: RunState, questId: string, qs: QuestState): RunState {
  return { ...run, questStates: { ...run.questStates, [questId]: qs } }
}

/** Idempotent (no-op + `toast` if present); throws on an unknown id; seeds `{ stage: initialStage, startedDay }`;
 *  applies the initial stage's onEnter; emits `questStarted`. */
export function startQuest(run: RunState, questId: string, env: EngineEnv): SliceResult<RunState> {
  const def = env.content.quests[questId]
  // Unknown content id = programmer/content error (§7.20): throw, never a silent stub.
  if (def === undefined) throw new Error(`startQuest: unknown quest '${questId}'`)
  const existing = run.questStates[questId]
  if (existing !== undefined) {
    // Godot quest_manager.gd:27-35 idiom kept by the brief: warn, do not restart, do not re-run onEnter.
    return { state: run, effects: [{ kind: 'toast', text: `Quest "${def.name}" is already ${questStatus(run, questId)}` }] }
  }
  const seeded = withQuestState(run, questId, { stage: def.initialStage, startedDay: run.daysElapsed })
  const started: Effect = { kind: 'questStarted', questId, stage: def.initialStage }
  // The initial stage's onEnter fires HERE — the one place activation happens (brief §2.12 "initial onEnter never fired").
  const entered = applyQuestEffects(seeded, def.stages[def.initialStage]?.onEnter ?? [], env)
  return { state: entered.state, effects: [started, ...entered.effects] }
}

/** Refused if not started / complete / unknown stage / already at that stage; runs from.onExit then to.onEnter;
 *  emits `questStageAdvanced`. Never throws on a bad request: content-driven advances surface as `refused`. */
export function advanceQuest(run: RunState, questId: string, toStage: string, env: EngineEnv): SliceResult<RunState> {
  const def = env.content.quests[questId]
  if (def === undefined) return refuse(run, 'quest/advance', `unknown quest '${questId}'`)
  const qs = run.questStates[questId]
  if (qs === undefined) return refuse(run, 'quest/advance', `quest '${questId}' is not started`)
  if (qs.stage === QUEST_COMPLETE) return refuse(run, 'quest/advance', `quest '${questId}' is complete`)
  const to = def.stages[toStage]
  if (to === undefined || toStage === QUEST_COMPLETE) return refuse(run, 'quest/advance', `quest '${questId}' has no stage '${toStage}' (completion is completeQuest)`)
  // Re-entering the current stage would re-fire its onEnter — exactly the double-dispatch bug the brief cites
  // (sq_blood_ties_accept advancing to the first stage twice, §2.12).
  if (toStage === qs.stage) return refuse(run, 'quest/advance', `quest '${questId}' is already at stage '${toStage}'`)
  const from = qs.stage

  const exited = applyQuestEffects(run, def.stages[from]?.onExit ?? [], env)
  // An onExit effect may itself have moved or completed this quest (content can do anything); do not resurrect
  // or overwrite what it did — the effects it produced already describe the change.
  if (exited.state.questStates[questId]?.stage !== from) return exited

  const moved = withQuestState(exited.state, questId, { ...qs, stage: toStage })
  const advanced: Effect = { kind: 'questStageAdvanced', questId, from, to: toStage }
  const entered = applyQuestEffects(moved, to.onEnter, env)
  return { state: entered.state, effects: [...exited.effects, advanced, ...entered.effects] }
}

/** Runs the current stage's onExit, sets the sentinel, clears quest-scope flags, emits `questCompleted`; idempotent
 *  (already complete ⇒ same reference, no effects); refused when the quest was never started. */
export function completeQuest(run: RunState, questId: string, env: EngineEnv): SliceResult<RunState> {
  const qs = run.questStates[questId]
  if (qs === undefined) return refuse(run, 'quest/complete', `quest '${questId}' is not started`)
  if (qs.stage === QUEST_COMPLETE) return { state: run, effects: [] }
  const from = qs.stage
  const def = env.content.quests[questId]
  const exited = applyQuestEffects(run, def?.stages[from]?.onExit ?? [], env)
  if (exited.state.questStates[questId]?.stage !== from) return exited
  const completed = withQuestState(exited.state, questId, { ...qs, stage: QUEST_COMPLETE })
  // `quest` scope = "lives while the quest does" (brief §2.12); the completion is the one clearing point.
  const cleared = clearFlagScope(completed, 'quest')
  return { state: cleared, effects: [...exited.effects, { kind: 'questCompleted', questId }] }
}

function firstPassingTransition(stageTransitions: readonly { readonly when: Predicate; readonly to: string }[], run: RunState): string | null {
  const pred = predicateState(run)
  for (const t of stageTransitions) if (evaluate(t.when, pred)) return t.to
  return null
}

/** First passing transition per active quest, repeated to a fixed point ≤ `rules.quests.maxSettlePasses`
 *  (a `toast` warning at the cap). Run by `flow/settle.ts` after EVERY dispatch that changed `run`.
 *
 *  Returns the SAME run reference when nothing fired. The cycle guard refuses to fire the same
 *  `(quest, from → to)` transition twice in one settle: two stages whose predicates both hold would otherwise
 *  ping-pong until the cap on every dispatch (the shipped `MAX_PASSES` warning, now a terminating rule). */
export function settleQuests(run: RunState, env: EngineEnv): SliceResult<RunState> & { readonly passes: number } {
  const max = env.rules.quests.maxSettlePasses
  const fired = new Set<string>()
  const effects: Effect[] = []
  let state = run
  let passes = 0
  let changedLastPass = false
  while (passes < max) {
    passes++
    changedLastPass = false
    for (const questId of Object.keys(state.questStates)) {
      const qs = state.questStates[questId]
      if (qs === undefined || qs.stage === QUEST_COMPLETE) continue
      const stage = env.content.quests[questId]?.stages[qs.stage]
      if (stage === undefined) continue
      const to = firstPassingTransition(stage.transitions, state)
      if (to === null) continue
      const key = `${questId}:${qs.stage}->${to}`
      if (fired.has(key)) {
        effects.push({ kind: 'toast', text: `Quest '${questId}' cycles between '${qs.stage}' and '${to}' — check its transitions` })
        continue
      }
      fired.add(key)
      const res = advanceQuest(state, questId, to, env)
      if (res.state === state) continue // refused (a hook moved the quest under us) — nothing to settle further
      state = res.state
      effects.push(...res.effects)
      changedLastPass = true
    }
    if (!changedLastPass) break
  }
  // A chain that reaches its fixed point exactly on the last pass is settled; warn only if something would still fire.
  if (changedLastPass && passes === max && hasPendingTransition(state, env)) {
    effects.push({ kind: 'toast', text: `Quest settle hit ${max} passes — a transition chain is longer than rules.quests.maxSettlePasses` })
  }
  return { state, effects, passes }
}

function hasPendingTransition(state: RunState, env: EngineEnv): boolean {
  for (const questId of Object.keys(state.questStates)) {
    const qs = state.questStates[questId]
    if (qs === undefined || qs.stage === QUEST_COMPLETE) continue
    const stage = env.content.quests[questId]?.stages[qs.stage]
    if (stage !== undefined && firstPassingTransition(stage.transitions, state) !== null) return true
  }
  return false
}

function* effectSites(env: EngineEnv): Generator<{ readonly at: string; readonly effect: QuestEffect }> {
  const c = env.content
  for (const q of Object.values(c.quests)) {
    for (const s of Object.values(q.stages)) {
      for (const e of s.onEnter) yield { at: `quest ${q.id}/${s.id}.onEnter`, effect: e }
      for (const e of s.onExit) yield { at: `quest ${q.id}/${s.id}.onExit`, effect: e }
    }
  }
  for (const d of Object.values(c.dialogues)) {
    for (const n of Object.values(d.nodes)) {
      for (const e of n.onEnter ?? []) yield { at: `dialogue ${d.id}/${n.id}.onEnter`, effect: e }
      for (const ch of n.choices) for (const e of ch.effects) yield { at: `dialogue ${d.id}/${n.id}/${ch.id}`, effect: e }
    }
  }
  for (const ev of Object.values(c.checkEvents)) {
    for (const ch of ev.choices) {
      for (const e of ch.onPass.effects) yield { at: `checkEvent ${ev.id}/${ch.id}.onPass`, effect: e }
      for (const e of ch.onFail?.effects ?? []) yield { at: `checkEvent ${ev.id}/${ch.id}.onFail`, effect: e }
    }
  }
}

function* predicateSites(env: EngineEnv): Generator<{ readonly at: string; readonly pred: Predicate }> {
  const c = env.content
  for (const q of Object.values(c.quests)) {
    for (const s of Object.values(q.stages)) for (const t of s.transitions) yield { at: `quest ${q.id}/${s.id} -> ${t.to}`, pred: t.when }
  }
  for (const d of Object.values(c.dialogues)) {
    for (const n of Object.values(d.nodes)) {
      for (const ch of n.choices) {
        if (ch.visibleIf) yield { at: `dialogue ${d.id}/${n.id}/${ch.id}.visibleIf`, pred: ch.visibleIf }
        if (ch.enabledIf) yield { at: `dialogue ${d.id}/${n.id}/${ch.id}.enabledIf`, pred: ch.enabledIf }
      }
    }
  }
  for (const t of Object.values(c.encounterTables)) for (const e of t.entries) for (const p of e.conditions) yield { at: `encounter ${t.id}/${e.id}`, pred: p }
  for (const t of Object.values(c.towns)) for (const q of t.tavernQuests) if (q.visibleIf) yield { at: `town ${t.id} tavern ${q.questId}`, pred: q.visibleIf }
}

/** Boot validation errors: every content `advanceQuestStage.toStage` and `questStage.stage` resolves; nothing declares
 *  the sentinel; every quest id an effect or predicate names exists. `[]` = ok. The Zod schema already checks each
 *  quest's own `initialStage` / transition targets; this is the CROSS-file half (`lint:content` runs both). */
export function bootstrapQuests(env: EngineEnv): readonly string[] {
  const errors: string[] = []
  const quests = env.content.quests
  const stageOf = (questId: string, stage: string, at: string): void => {
    const q = quests[questId]
    if (q === undefined) errors.push(`${at}: unknown quest '${questId}'`)
    else if (stage === QUEST_COMPLETE) errors.push(`${at}: names the engine-owned sentinel '${QUEST_COMPLETE}'`)
    else if (!(stage in q.stages)) errors.push(`${at}: '${stage}' is not a stage of ${questId}`)
  }
  for (const [id, q] of Object.entries(quests)) {
    if (QUEST_COMPLETE in q.stages) errors.push(`quest ${id}: declares the engine-owned '${QUEST_COMPLETE}' stage`)
    if (q.initialStage === QUEST_COMPLETE) errors.push(`quest ${id}: initialStage is the sentinel`)
    else if (!(q.initialStage in q.stages)) errors.push(`quest ${id}: initialStage '${q.initialStage}' is not a declared stage`)
    for (const s of Object.values(q.stages)) for (const t of s.transitions) stageOf(id, t.to, `quest ${id}/${s.id} -> ${t.to}`)
  }
  for (const { at, effect } of effectSites(env)) {
    switch (effect.kind) {
      case 'advanceQuestStage': stageOf(effect.questId, effect.toStage, `${at} advanceQuestStage`); break
      case 'startQuest': case 'completeQuest':
        if (quests[effect.questId] === undefined) errors.push(`${at} ${effect.kind}: unknown quest '${effect.questId}'`)
        break
      default: break
    }
  }
  for (const { at, pred } of predicateSites(env)) {
    for (const p of walkPredicate(pred)) {
      if (p.kind === 'questStage') stageOf(p.questId, p.stage, `${at} questStage`)
      else if ((p.kind === 'questStarted' || p.kind === 'questComplete') && quests[p.questId] === undefined) errors.push(`${at} ${p.kind}: unknown quest '${p.questId}'`)
    }
  }
  return errors
}
