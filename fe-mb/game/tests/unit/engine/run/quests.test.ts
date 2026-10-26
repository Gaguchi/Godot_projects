import { describe, expect, it } from 'vitest'
import { QUEST_COMPLETE_STAGE } from '../../../../src/content/schemas'
import { setFlag } from '../../../../src/engine/run/flags'
import { QUEST_COMPLETE, advanceQuest, bootstrapQuests, completeQuest, questStatus, settleQuests, startQuest } from '../../../../src/engine/run/quests'
import type { Effect } from '../../../../src/engine/effects'
import { env, envWith, kinds, makeRun } from './narrativeFixture'

const BT = 'sq_blood_ties'
const only = <K extends Effect['kind']>(effects: readonly Effect[], kind: K) => effects.filter((e): e is Extract<Effect, { kind: K }> => e.kind === kind)

/** A three-stage chain that fires start→mid→done on one flag, with hooks on every edge. */
const chain = {
  id: 'fx_chain',
  name: 'Chain',
  initialStage: 'start',
  stages: {
    start: { id: 'start', label: 'A stage', onEnter: [{ kind: 'setFlag', key: 'fx_entered_start', value: true, scope: 'run' }], transitions: [{ when: { kind: 'flag', key: 'fx_go', equals: true }, to: 'mid' }], onExit: [{ kind: 'setFlag', key: 'fx_left_start', value: true, scope: 'run' }] },
    mid: { id: 'mid', label: 'A stage', onEnter: [{ kind: 'setFlag', key: 'fx_entered_mid', value: true, scope: 'quest' }], transitions: [{ when: { kind: 'flag', key: 'fx_go', equals: true }, to: 'done' }], onExit: [] },
    done: { id: 'done', label: 'A stage', onEnter: [{ kind: 'addGold', amount: 0 }], transitions: [], onExit: [{ kind: 'setFlag', key: 'fx_left_done', value: true, scope: 'run' }] },
  },
}

/** Two stages whose predicates are both always true — the classic ping-pong. */
const cycle = {
  id: 'fx_cycle',
  name: 'Cycle',
  initialStage: 'a',
  stages: {
    a: { id: 'a', label: 'A stage', onEnter: [], transitions: [{ when: { kind: 'always' }, to: 'b' }], onExit: [] },
    b: { id: 'b', label: 'A stage', onEnter: [], transitions: [{ when: { kind: 'always' }, to: 'a' }], onExit: [] },
  },
}

/** A linear ladder longer than the pass cap, every rung always true. */
const ladder = (() => {
  const n = env.rules.quests.maxSettlePasses + 3
  const stages: Record<string, unknown> = {}
  for (let i = 0; i < n; i++) {
    const id = `s${i}`
    stages[id] = { id, label: 'A stage', onEnter: [], transitions: i + 1 < n ? [{ when: { kind: 'always' }, to: `s${i + 1}` }] : [], onExit: [] }
  }
  return { id: 'fx_ladder', name: 'Ladder', initialStage: 's0', stages }
})()

const fxEnv = envWith({ quests: [chain, cycle, ladder] })

describe('quests — activation', () => {
  it('startQuest seeds questStates[id] at initialStage and runs its onEnter', () => {
    const run = makeRun()
    const r = startQuest(run, 'fx_chain', fxEnv)
    expect(r.state.questStates['fx_chain']).toEqual({ stage: 'start', startedDay: run.daysElapsed })
    expect(r.state.flags['fx_entered_start']?.value).toBe(true)
    expect(kinds(r.effects)).toEqual(['questStarted', 'flagSet'])
    expect(questStatus(r.state, 'fx_chain')).toBe('active')
  })

  it('startQuest is idempotent (no-op + toast; onEnter does not fire twice)', () => {
    const once = startQuest(makeRun(), 'fx_chain', fxEnv).state
    const twice = startQuest(once, 'fx_chain', fxEnv)
    expect(twice.state).toBe(once)
    expect(kinds(twice.effects)).toEqual(['toast'])
  })

  it('startQuest rejects unknown ids (programmer error → throw)', () => {
    expect(() => startQuest(makeRun(), 'sq_nope', env)).toThrow(/unknown quest 'sq_nope'/)
  })

  it('questStatus is derived from questStates: absent / present / sentinel', () => {
    const run = makeRun()
    expect(questStatus(run, BT)).toBe('notStarted')
    const started = startQuest(run, BT, env).state
    expect(questStatus(started, BT)).toBe('active')
    const done = completeQuest(started, BT, env).state
    expect(questStatus(done, BT)).toBe('complete')
    expect(done.questStates[BT]?.stage).toBe(QUEST_COMPLETE)
    expect(QUEST_COMPLETE).toBe(QUEST_COMPLETE_STAGE)
    expect(QUEST_COMPLETE).toBe(env.rules.quests.completeSentinel)
  })
})

describe('quests — transitions', () => {
  it('advanceQuest runs onExit then onEnter and emits questStageAdvanced{from,to} between them', () => {
    const started = startQuest(makeRun(), 'fx_chain', fxEnv).state
    const r = advanceQuest(started, 'fx_chain', 'mid', fxEnv)
    expect(r.state.questStates['fx_chain']?.stage).toBe('mid')
    expect(r.state.flags['fx_left_start']?.value).toBe(true)
    expect(r.state.flags['fx_entered_mid']?.scope).toBe('quest')
    const fs = only(r.effects, 'flagSet').map((e) => e.key)
    expect(fs).toEqual(['fx_left_start', 'fx_entered_mid'])
    expect(kinds(r.effects)).toEqual(['flagSet', 'questStageAdvanced', 'flagSet'])
    expect(only(r.effects, 'questStageAdvanced')[0]).toEqual({ kind: 'questStageAdvanced', questId: 'fx_chain', from: 'start', to: 'mid' })
  })

  it('advanceQuest refuses on not-started / complete quests, unknown stages and the current stage (state reference unchanged, one refused)', () => {
    const run = makeRun()
    const notStarted = advanceQuest(run, 'fx_chain', 'mid', fxEnv)
    expect(notStarted.state).toBe(run)
    expect(kinds(notStarted.effects)).toEqual(['refused'])

    const started = startQuest(run, 'fx_chain', fxEnv).state
    const unknownStage = advanceQuest(started, 'fx_chain', 'nowhere', fxEnv)
    expect(unknownStage.state).toBe(started)
    expect(kinds(unknownStage.effects)).toEqual(['refused'])

    const sentinel = advanceQuest(started, 'fx_chain', QUEST_COMPLETE, fxEnv)
    expect(sentinel.state).toBe(started)
    expect(kinds(sentinel.effects)).toEqual(['refused'])

    const same = advanceQuest(started, 'fx_chain', 'start', fxEnv)
    expect(same.state).toBe(started)
    expect(kinds(same.effects)).toEqual(['refused'])

    const done = completeQuest(started, 'fx_chain', fxEnv).state
    const complete = advanceQuest(done, 'fx_chain', 'mid', fxEnv)
    expect(complete.state).toBe(done)
    expect(kinds(complete.effects)).toEqual(['refused'])

    const unknownQuest = advanceQuest(started, 'sq_nope', 'mid', fxEnv)
    expect(unknownQuest.state).toBe(started)
    expect(kinds(unknownQuest.effects)).toEqual(['refused'])
  })

  it('completeQuest runs onExit, sets the engine-owned sentinel, clears quest-scope flags, emits questCompleted — exactly once', () => {
    const mid = advanceQuest(startQuest(makeRun(), 'fx_chain', fxEnv).state, 'fx_chain', 'mid', fxEnv).state
    const done = advanceQuest(mid, 'fx_chain', 'done', fxEnv).state
    const withRunFlag = setFlag(done, 'fx_keep', true, 'run').state
    expect(withRunFlag.flags['fx_entered_mid']).toBeDefined()
    const r = completeQuest(withRunFlag, 'fx_chain', fxEnv)
    expect(r.state.questStates['fx_chain']?.stage).toBe('__complete__')
    expect(r.state.flags['fx_left_done']?.value).toBe(true)
    expect(r.state.flags['fx_entered_mid']).toBeUndefined() // quest scope cleared
    expect(r.state.flags['fx_keep']).toBeDefined() // run scope kept
    expect(kinds(r.effects)).toEqual(['flagSet', 'questCompleted'])
    const again = completeQuest(r.state, 'fx_chain', fxEnv)
    expect(again.state).toBe(r.state)
    expect(again.effects).toEqual([])
    const never = completeQuest(makeRun(), 'fx_chain', fxEnv)
    expect(never.state).toEqual(makeRun())
    expect(kinds(never.effects)).toEqual(['refused'])
  })

  it('transitions settle within maxSettlePasses after any run dispatch (chain start→mid→done on one flag)', () => {
    const started = startQuest(makeRun(), 'fx_chain', fxEnv).state
    const idle = settleQuests(started, fxEnv)
    expect(idle.state).toBe(started) // nothing fired ⇒ same reference
    expect(idle.effects).toEqual([])
    expect(idle.passes).toBe(1)

    const flagged = setFlag(started, 'fx_go', true, 'run').state
    const r = settleQuests(flagged, fxEnv)
    expect(r.state.questStates['fx_chain']?.stage).toBe('done')
    expect(r.passes).toBeLessThanOrEqual(fxEnv.rules.quests.maxSettlePasses)
    expect(r.passes).toBe(3) // fire, fire, quiet
    expect(only(r.effects, 'questStageAdvanced').map((e) => `${e.from}->${e.to}`)).toEqual(['start->mid', 'mid->done'])
    expect(only(r.effects, 'toast')).toEqual([])
    expect(settleQuests(r.state, fxEnv).state).toBe(r.state)
  })

  it('a cycling quest settles ≤ maxSettlePasses with a warning toast instead of spinning', () => {
    const started = startQuest(makeRun(), 'fx_cycle', fxEnv).state
    const r = settleQuests(started, fxEnv)
    expect(r.passes).toBeLessThanOrEqual(fxEnv.rules.quests.maxSettlePasses)
    expect(only(r.effects, 'questStageAdvanced').length).toBeLessThanOrEqual(2)
    expect(only(r.effects, 'toast').length).toBeGreaterThanOrEqual(1)
    expect(['a', 'b']).toContain(r.state.questStates['fx_cycle']?.stage)
  })

  it('a ladder longer than the cap stops at the cap with a toast and continues on the next settle', () => {
    const max = fxEnv.rules.quests.maxSettlePasses
    const started = startQuest(makeRun(), 'fx_ladder', fxEnv).state
    const r = settleQuests(started, fxEnv)
    expect(r.passes).toBe(max)
    expect(r.state.questStates['fx_ladder']?.stage).toBe(`s${max}`)
    expect(only(r.effects, 'toast').length).toBe(1)
    const again = settleQuests(r.state, fxEnv)
    expect(again.state.questStates['fx_ladder']?.stage).toBe(`s${max + 2}`)
  })
})

describe('quests — Blood Ties (shipped content)', () => {
  it('Blood Ties advances on the capture flag with no dialogue involved and completes exactly once (incl. unlockNode smugglers_cave)', () => {
    const run = makeRun()
    expect(run.spawnedNodes['darens_camp']).toBeUndefined()
    expect(run.unlockedNodes['smugglers_cave']).toBeUndefined()

    const started = startQuest(run, BT, env)
    expect(started.state.questStates[BT]?.stage).toBe('find_daren')
    expect(started.state.spawnedNodes['darens_camp']).toBe(true)
    expect(started.state.unlockedNodes['smugglers_cave']).toBe(true)
    expect(kinds(started.effects)).toEqual(['questStarted'])
    expect(settleQuests(started.state, env).state).toBe(started.state)

    const captured = setFlag(started.state, 'daren_captured', true, 'run').state
    const settled = settleQuests(captured, env)
    expect(settled.state.questStates[BT]?.stage).toBe('daren_resolved')
    expect(settled.passes).toBe(2)
    expect(only(settled.effects, 'questStageAdvanced')).toEqual([{ kind: 'questStageAdvanced', questId: BT, from: 'find_daren', to: 'daren_resolved' }])
    expect(settled.state.pendingDialogue).toBeNull()

    const done = completeQuest(settled.state, BT, env)
    expect(only(done.effects, 'questCompleted')).toHaveLength(1)
    expect(questStatus(done.state, BT)).toBe('complete')
    const after = settleQuests(done.state, env)
    expect(after.state).toBe(done.state)
    expect(only(completeQuest(done.state, BT, env).effects, 'questCompleted')).toHaveLength(0)
  })

  it('the killed flag resolves the same stage', () => {
    const started = startQuest(makeRun(), BT, env).state
    const killed = setFlag(started, 'daren_killed', true, 'run').state
    expect(settleQuests(killed, env).state.questStates[BT]?.stage).toBe('daren_resolved')
  })
})

describe('quests — bootstrap validation', () => {
  it('bootstrapQuests passes on shipped content', () => {
    expect(bootstrapQuests(env)).toEqual([])
  })

  it('bootstrapQuests reports a dangling advanceQuestStage.toStage and questStage.stage', () => {
    const badDialogue = {
      id: 'fx_bad',
      startNodeId: 'start',
      nodes: {
        start: {
          id: 'start',
          text: 'x',
          onEnter: [{ kind: 'advanceQuestStage', questId: BT, toStage: 'nowhere' }],
          choices: [{ id: 'c', text: 'go', visibleIf: { kind: 'questStage', questId: BT, stage: 'elsewhere' }, effects: [{ kind: 'startQuest', questId: 'sq_ghost' }], next: 'end' }],
        },
      },
    }
    const errors = bootstrapQuests(envWith({ dialogues: [badDialogue] }))
    expect(errors.some((e) => e.includes("'nowhere' is not a stage of sq_blood_ties"))).toBe(true)
    expect(errors.some((e) => e.includes("'elsewhere' is not a stage of sq_blood_ties"))).toBe(true)
    expect(errors.some((e) => e.includes("unknown quest 'sq_ghost'"))).toBe(true)
  })
})
