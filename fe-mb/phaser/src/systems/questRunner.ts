import type { QuestDef, QuestEffect, QuestListenerEvent } from '../domain/quest'
import type { DomainEvent } from '../contracts'
import type { PredicateState } from './predicates'
import { evaluatePredicate } from './predicates'

export interface QuestEngineState {
  quests: Record<string, QuestDef>
}

export interface OnEventResult {
  effects: QuestEffect[]
}

const EVENT_TYPE_MAP: Record<DomainEvent['type'], QuestListenerEvent | null> = {
  BattleStarted: null,
  BattleVictory: 'BattleVictory',
  BattleDefeat: null,
  UnitDied: null,
  EnemyCaptured: null,
  LocationArrived: 'LocationArrived',
  FlagSet: 'FlagSet',
  QuestStageAdvanced: null,
}

export function onDomainEvent(
  event: DomainEvent,
  engine: QuestEngineState,
  state: PredicateState,
): OnEventResult {
  const listenerKind = EVENT_TYPE_MAP[event.type]
  if (!listenerKind) return { effects: [] }

  const effects: QuestEffect[] = []
  for (const [questIdStr, quest] of Object.entries(engine.quests)) {
    const qs = state.questStates[questIdStr]
    if (!qs) continue
    const stage = quest.stages[qs.currentStage]
    if (!stage) continue
    for (const listener of stage.listeners) {
      if (listener.on !== listenerKind) continue
      if (!evaluatePredicate(listener.predicate, state)) continue
      effects.push(...listener.emit)
    }
  }
  return { effects }
}

export interface TransitionResult {
  transitions: { questId: string; from: string; to: string }[]
  effects: QuestEffect[]
}

export function transitionStages(engine: QuestEngineState, state: PredicateState): TransitionResult {
  const transitions: TransitionResult['transitions'] = []
  const effects: QuestEffect[] = []

  for (const [questIdStr, quest] of Object.entries(engine.quests)) {
    const qs = state.questStates[questIdStr]
    if (!qs) continue
    const stage = quest.stages[qs.currentStage]
    if (!stage) continue
    for (const t of stage.transitions) {
      if (evaluatePredicate(t.when, state)) {
        transitions.push({ questId: questIdStr, from: qs.currentStage, to: t.to as unknown as string })
        effects.push(...stage.onExit)
        const nextStage = quest.stages[t.to as unknown as string]
        if (nextStage) effects.push(...nextStage.onEnter)
        break
      }
    }
  }
  return { transitions, effects }
}
