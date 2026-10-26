/**
 * The runtime half of brief §2.14 rule 6, pinned with a fake reducer so it holds before WP-FLOW lands: the file the
 * host is handed on `autosave{urgent}` already has `run: null` and `meta.runsLost++`, and that hand-off happens
 * BEFORE any state or effect listener runs (`flow/runtime.ts#commit`; CONTRACT-CHANGES 0012). `endRun.test.ts`
 * runs the same assertions through the real reducer.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Action, ReduceResult } from '../../../../src/engine/actions'
import type { GameState, SaveFile } from '../../../../src/engine/types'

const { fakeReduce } = vi.hoisted(() => ({ fakeReduce: vi.fn<(state: GameState, action: Action) => ReduceResult>() }))
vi.mock('../../../../src/engine/reducer', () => ({
  reduce: fakeReduce,
  reduceMany: fakeReduce,
  initialState: () => { throw new Error('not used by this test') },
  isLegal: () => ({ ok: true }),
}))

// Imported AFTER the mock so the runtime binds the fake reducer.
import { createRuntime } from '../../../../src/engine/flow/runtime'
import { fromSaveFile, parseSaveWith, serialize } from '../../../../src/engine/save/codec'
import { LEDGER, META, populatedRun, testEnv } from '../../../helpers/saves'

const env = testEnv()

/** `quest/applyEffects` = the wipe (run → null, runsLost++, gameOver, urgent autosave); `dev/addGold` = an ordinary
 *  autosaving dispatch; everything else leaves the state alone. */
fakeReduce.mockImplementation((state, action) => {
  if (action.type === 'quest/applyEffects') {
    return {
      state: { ...state, run: null, combat: null, ledger: LEDGER, meta: { ...state.meta, runsLost: state.meta.runsLost + 1 }, screen: { kind: 'gameOver' } },
      effects: [{ kind: 'runEnded', outcome: 'lost' }, { kind: 'autosave', urgent: true }, { kind: 'screenChanged', from: state.screen, to: { kind: 'gameOver' } }],
    }
  }
  if (action.type === 'dev/addGold' && state.run !== null) {
    return { state: { ...state, run: { ...state.run, gold: state.run.gold + action.amount } }, effects: [{ kind: 'autosave', urgent: false }] }
  }
  return { state, effects: [] }
})

describe('save/endRun — commit ordering with a fake reducer', () => {
  it('the null save is handed to the host before any listener sees the gameOver frame', () => {
    const timeline: string[] = []
    let persisted: { readonly file: SaveFile; readonly urgent: boolean } | null = null
    const rt = createRuntime({
      env,
      initial: populatedRun(),
      persist: (file, urgent) => {
        persisted = { file, urgent }
        timeline.push(`persist:${file.run === null ? 'null' : 'run'}`)
      },
    })
    rt.subscribe((state) => { timeline.push(`frame:${state.screen.kind}:${state.run === null ? 'null' : 'run'}`) })
    rt.onEffects((effects, _action, state) => { timeline.push(`effects:${state.screen.kind}:${effects.map((e) => e.kind).join(',')}`) })

    rt.dispatch({ type: 'quest/applyEffects', effects: [{ kind: 'damageParty', amount: 999 }] })

    expect(timeline).toEqual(['persist:null', 'frame:gameOver:null', 'effects:gameOver:runEnded,autosave,screenChanged'])
    expect(persisted).not.toBeNull()
    const { file, urgent } = persisted!
    expect(urgent).toBe(true)
    expect(file.run).toBeNull()
    expect(file.combat).toBeNull()
    expect(file.meta.runsLost).toBe(META.runsLost + 1)
    expect('ledger' in file).toBe(false)

    // What the host wrote reloads to Title with nothing to Continue — no retreat exists.
    const parsed = parseSaveWith(serialize(file), env, () => [])
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const reloaded = fromSaveFile(parsed.value)
    expect(reloaded.run).toBeNull()
    expect(reloaded.ledger).toBeNull()
    expect(reloaded.screen.kind).toBe('title')
  })

  it('an ordinary autosave hands the host the current run with urgent false, still before listeners', () => {
    const timeline: string[] = []
    const rt = createRuntime({
      env,
      initial: populatedRun(),
      persist: (file, urgent) => timeline.push(`persist:gold=${file.run?.gold}:urgent=${urgent}`),
    })
    rt.subscribe((state) => timeline.push(`frame:gold=${state.run?.gold}`))
    rt.dispatch({ type: 'dev/addGold', amount: 13 })
    expect(timeline).toEqual(['persist:gold=150:urgent=false', 'frame:gold=150'])
  })

  it('a dispatch without an autosave hint never touches the host', () => {
    const persist = vi.fn()
    const rt = createRuntime({ env, initial: populatedRun(), persist })
    rt.dispatch({ type: 'ui/toggleDevHud' })
    expect(persist).not.toHaveBeenCalled()
  })
})
