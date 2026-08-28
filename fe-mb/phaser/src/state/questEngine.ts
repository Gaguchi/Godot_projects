import type { QuestDef } from '../domain/quest'
import type { DomainEvent } from '../contracts'
import type { EventBus } from './eventBus'
import type { QuestEngineState } from '../systems/questRunner'
import { onDomainEvent, transitionStages } from '../systems/questRunner'
import { useRunStore, predicateStateFromRun } from './runStore'
import { asQuestId, asStageId } from '../domain/ids'
import { diag } from './diagLog'

import bloodTies from '../data/content/quests/blood_ties.json'
import missingCaravan from '../data/content/quests/missing_caravan.json'

/**
 * Quest engine wiring — the piece that was missing.
 *
 * `systems/questRunner.ts` has always exported `onDomainEvent` and
 * `transitionStages`, but nothing in the app ever called them: quests only
 * advanced because dialogue nodes dispatched `advanceQuestStage` by hand. That
 * meant every `listeners` and `transitions` block in the quest JSON was dead
 * data, and a quest could not react to anything that happened outside a
 * conversation (a battle won, a place reached, a flag set by an event).
 *
 * This module owns the registry and the two pumps:
 *   - `settleQuests()` evaluates stage TRANSITIONS to a fixed point.
 *   - `attachQuestEngine(bus)` feeds DOMAIN EVENTS to stage listeners, then
 *     settles.
 *
 * Re-entrancy is the hazard here: applying a quest effect mutates the run
 * store, which is exactly what the engine reads. Both pumps are therefore
 * guarded by `pumping` and bounded by MAX_PASSES, so a quest whose stages
 * point at each other degrades into a logged warning instead of a hung tab.
 */

const QUEST_DEFS = [bloodTies, missingCaravan] as unknown as QuestDef[]

let engine: QuestEngineState = { quests: {} }

export function bootstrapQuests(): void {
  const quests: Record<string, QuestDef> = {}
  for (const q of QUEST_DEFS) quests[q.id as unknown as string] = q
  engine = { quests }
  diag('quest', 'registry bootstrapped', { ids: Object.keys(quests) })
}

export function getQuestEngine(): QuestEngineState {
  return engine
}

/** Test seam: replace the registry with fixtures. */
export function __setQuestEngineForTest(next: QuestEngineState): void {
  engine = next
}

/** A quest whose stages cycle would otherwise spin here forever. */
const MAX_PASSES = 8
let pumping = false

/**
 * Evaluate every active quest's stage transitions against current run state,
 * applying `onExit` + `onEnter` effects and advancing the stage, repeatedly
 * until nothing more fires. Returns how many transitions were applied.
 */
export function settleQuests(): number {
  if (pumping) return 0
  pumping = true
  let applied = 0
  try {
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const run = useRunStore.getState()
      const { transitions, effects } = transitionStages(engine, predicateStateFromRun(run))
      if (transitions.length === 0) break

      // Effects first, then the stage move: an `onExit` that sets a flag the
      // next stage reads must land before that stage is entered.
      if (effects.length > 0) {
        run.dispatch({ type: 'applyQuestEffects', payload: { effects } })
      }
      for (const t of transitions) {
        diag('quest', 'stage transition', t)
        run.dispatch({
          type: 'advanceQuestStage',
          payload: { questId: asQuestId(t.questId), toStage: asStageId(t.to) },
        })
      }
      applied += transitions.length

      if (pass === MAX_PASSES - 1) {
        diag('quest', 'transition loop hit MAX_PASSES — check for a stage cycle',
          { transitions }, 'warn')
      }
    }
  } finally {
    pumping = false
  }
  return applied
}

/**
 * Route a domain event to quest stage listeners, apply what they emit, then
 * settle transitions. Safe to call directly (tests, replay) as well as from
 * the bus subscription.
 */
export function handleDomainEvent(event: DomainEvent): void {
  const run = useRunStore.getState()
  const { effects } = onDomainEvent(event, engine, predicateStateFromRun(run))
  if (effects.length > 0) {
    diag('quest', 'listener fired', { event: event.type, effects: effects.map(e => e.kind) })
    run.dispatch({ type: 'applyQuestEffects', payload: { effects } })
  }
  settleQuests()
}

/**
 * Attach the engine to the running game. Returns an unsubscribe.
 *
 * Two feeds, deliberately:
 *   1. the domain event bus, for stage `listeners`;
 *   2. the run store itself, because most quest progress today comes from a
 *      dialogue choice setting a flag — no domain event is emitted for that,
 *      and without this feed the quest would sit at its old stage until some
 *      unrelated event happened to pump it.
 */
export function attachQuestEngine(bus: EventBus): () => void {
  const offBus = bus.subscribe(handleDomainEvent)
  const offStore = useRunStore.subscribe(() => { settleQuests() })
  return () => { offBus(); offStore() }
}
