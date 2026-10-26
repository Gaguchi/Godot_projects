/**
 * Adversarial review of WP-NARRATIVE (reviewer did not write the package). Three edge cases the package's own
 * suite does not cover: ≥3 full check-event cycles with a strict save round-trip and a determinism replay,
 * the settle-cap boundary, and the intended "flag → stage.onEnter startDialogue" content pattern fired from
 * a check event. A failing case here documents a defect; it is kept on purpose.
 */
import { describe, expect, it } from 'vitest'
import type { Effect } from '../../../../src/engine/effects'
import { chooseCheck, dismissCheck, openCheckEvent } from '../../../../src/engine/run/checks'
import { choose, openDialogue } from '../../../../src/engine/run/dialogue'
import { settleQuests, startQuest } from '../../../../src/engine/run/quests'
import type { ActiveDungeon, DungeonGraph, RunState } from '../../../../src/engine/types'
import { env, envWith, makeRun } from './narrativeFixture'

const only = <K extends Effect['kind']>(effects: readonly Effect[], kind: K) => effects.filter((e): e is Extract<Effect, { kind: K }> => e.kind === kind)

/** `toStrictEqual` against a JSON copy: an `undefined` property (dropped by JSON) or a Set/Map fails by name. */
const expectJsonSafe = (state: RunState): void => {
  expect(JSON.parse(JSON.stringify(state)) as unknown).toStrictEqual(state)
}

describe('review — WP-NARRATIVE edge cases', () => {
  it('three dungeon check-event cycles (open → choose → dismiss) stay JSON-safe mid-flight, clear their rooms, and replay identically', () => {
    const rooms = {
      r0c0: { id: 'r0c0', row: 0, col: 0, type: 'event' as const, checkEventId: 'bandit_parley' },
      r1c0: { id: 'r1c0', row: 1, col: 0, type: 'event' as const, checkEventId: 'ancient_shrine' },
      r2c0: { id: 'r2c0', row: 2, col: 0, type: 'event' as const, checkEventId: 'ancient_inscription' },
      r3c0: { id: 'r3c0', row: 3, col: 0, type: 'boss' as const, checkEventId: null },
    }
    const graph: DungeonGraph = { dungeonId: 'smugglers_cave', rooms, rows: [['r0c0'], ['r1c0'], ['r2c0'], ['r3c0']], edges: { r0c0: ['r1c0'], r1c0: ['r2c0'], r2c0: ['r3c0'], r3c0: [] }, bossId: 'r3c0' }
    const cycles: readonly { readonly room: 'r0c0' | 'r1c0' | 'r2c0'; readonly choice: string }[] = [
      { room: 'r0c0', choice: 'intimidate' },       // stat str 6 — Oak passes
      { room: 'r1c0', choice: 'search_offerings' }, // stat lck 6 — auto-picked
      { room: 'r2c0', choice: 'leave' },            // no check
    ]

    const play = (): { readonly state: RunState; readonly effects: readonly Effect[] } => {
      const dungeon: ActiveDungeon = { dungeonId: 'smugglers_cave', graph, position: null, cleared: {}, bossCleared: false }
      let state = makeRun({ nodeId: 'smugglers_cave', activeDungeon: dungeon, gold: 100 })
      const effects: Effect[] = []
      for (const c of cycles) {
        // Room movement is WP-DUNGEON's; stand in the room directly.
        state = { ...state, activeDungeon: { ...state.activeDungeon!, position: c.room } }
        const opened = openCheckEvent(state, rooms[c.room].checkEventId!, 'dungeon', env)
        expectJsonSafe(opened.state)
        const chosen = chooseCheck(opened.state, c.choice, null, env)
        expect(chosen.state.pendingCheckEvent?.result).not.toBeNull()
        expectJsonSafe(chosen.state) // result { attemptingUnitId, narration, deferredEffects } mid-flight
        const dismissed = dismissCheck(chosen.state, env)
        expect(dismissed.state.pendingCheckEvent).toBeNull()
        expect(dismissed.state.activeDungeon?.cleared[c.room]).toBe(true)
        expectJsonSafe(dismissed.state)
        effects.push(...opened.effects, ...chosen.effects, ...dismissed.effects)
        state = dismissed.state
      }
      // A dialogue mid-tree with both bust slots filled is also persisted state.
      let talking = openDialogue(state, 'sq_blood_ties_daren_captured', 'captureTarget', env).state
      talking = choose(talking, 'continue', null, env).state
      expect(talking.pendingDialogue?.busts).toEqual(['kael', 'daren'])
      expectJsonSafe(talking)
      return { state, effects }
    }

    const a = play()
    const b = play()
    expect(a.state).toStrictEqual(b.state)
    expect(a.effects).toStrictEqual(b.effects)
    expect(only(a.effects, 'checkResolved')).toHaveLength(3)
    expect(only(a.effects, 'refused')).toEqual([])
    expect(Object.keys(a.state.activeDungeon?.cleared ?? {})).toEqual(['r0c0', 'r1c0', 'r2c0'])
    expect(a.state.activeDungeon?.bossCleared).toBe(false)
  })

  it('a chain of exactly maxSettlePasses transitions reaches its fixed point in one settle without a cap warning', () => {
    const max = env.rules.quests.maxSettlePasses
    const stages: Record<string, unknown> = {}
    for (let i = 0; i <= max; i++) {
      const id = `s${i}`
      stages[id] = { id, label: 'A stage', onEnter: [], transitions: i < max ? [{ when: { kind: 'always' }, to: `s${i + 1}` }] : [], onExit: [] }
    }
    const fx = envWith({ quests: [{ id: 'fx_exact', name: 'Exact', initialStage: 's0', stages }] })
    const started = startQuest(makeRun(), 'fx_exact', fx).state
    const r = settleQuests(started, fx)
    expect(r.state.questStates['fx_exact']?.stage).toBe(`s${max}`)
    expect(only(r.effects, 'questStageAdvanced')).toHaveLength(max)
    // Truly settled: the next settle is a no-op by identity …
    expect(settleQuests(r.state, fx).state).toBe(r.state)
    // … so no "chain is longer than the cap" warning is warranted. (Documents the spurious toast at the boundary.)
    expect(only(r.effects, 'toast')).toEqual([])
  })

  it("the brief's listener replacement — a flag-driven stage whose onEnter starts a dialogue — survives being fired by a check event", () => {
    // Brief §2.12: "A one-shot reaction becomes a transition into a stage whose onEnter carries the effects."
    const reactor = {
      id: 'fx_reactor',
      name: 'Reactor',
      initialStage: 'wait',
      stages: {
        wait: { id: 'wait', label: 'A stage', onEnter: [], transitions: [{ when: { kind: 'flag', key: 'fx_signal', equals: true }, to: 'react' }], onExit: [] },
        react: { id: 'react', label: 'A stage', onEnter: [{ kind: 'startDialogue', dialogueId: 'sq_blood_ties_accept' }], transitions: [], onExit: [] },
      },
    }
    const signal = {
      id: 'fx_signal_event',
      title: 'A courier.',
      description: 'He hands you a sealed letter.',
      choices: [{ id: 'read', text: 'Break the seal.', onPass: { narration: 'The seal cracks.', effects: [{ kind: 'setFlag', key: 'fx_signal', value: true, scope: 'run' }] } }],
    }
    const fx = envWith({ quests: [reactor], checkEvents: [signal] })
    const started = startQuest(makeRun(), 'fx_reactor', fx).state
    const opened = openCheckEvent(started, 'fx_signal_event', 'travel', fx).state
    const chosen = chooseCheck(opened, 'read', null, fx).state
    expect(chosen.flags['fx_signal']?.value).toBe(true)
    expect(chosen.pendingCheckEvent?.result).not.toBeNull()

    // flow/settle step 2 runs settleQuests right after check/choose — while the narration is still on screen.
    expect(() => settleQuests(chosen, fx)).not.toThrow()
    const settled = settleQuests(chosen, fx).state
    expect(settled.questStates['fx_reactor']?.stage).toBe('react')
    // The dialogue is never lost: either queued for settle step 3 or opened once the check slot clears.
    const dismissed = dismissCheck(settled, fx).state
    const queued = dismissed.pendingFollowUps.some((f) => f.kind === 'dialogue' && f.dialogueId === 'sq_blood_ties_accept')
    const open = dismissed.pendingDialogue?.dialogueId === 'sq_blood_ties_accept'
    expect(queued || open).toBe(true)
    expect(dismissed.pendingCheckEvent).toBeNull()
  })
})
