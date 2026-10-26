/**
 * ARCHITECTURE §2: a saved game is `{ seed, actions[] }` OR a snapshot — both replay to the same state.
 * `replay` is `actions.reduce(reduce)` and nothing else; these cases drive the fold with a fake reducer (the real
 * one is WP-FLOW's and may still be a stub) and once with the real reducer when it has landed.
 */
import { describe, expect, it } from 'vitest'
import type { Action, ReduceResult } from '../../../../src/engine/actions'
import { reduce, reduceMany } from '../../../../src/engine/reducer'
import { firstDivergence, replay, replayWith, verifyReplay, verifyReplayWith, type Reducer } from '../../../../src/engine/save/replay'
import type { GameState } from '../../../../src/engine/types'
import { META, blankState, landed, populatedMidCombat, populatedRun, testEnv } from '../../../helpers/saves'

const env = testEnv()

/** A tiny deterministic reducer over real actions: gold, mute, screen, dev hud; everything else refused. */
const fake: Reducer = (state, action): ReduceResult => {
  switch (action.type) {
    case 'dev/addGold':
      return state.run === null
        ? { state, effects: [{ kind: 'refused', action: action.type, reason: 'no run' }] }
        : { state: { ...state, run: { ...state.run, gold: Math.max(0, state.run.gold + action.amount) } }, effects: [{ kind: 'goldChanged', delta: action.amount, reason: 'dev' }] }
    case 'meta/setAudioMuted':
      return { state: { ...state, meta: { ...state.meta, audioMuted: action.muted } }, effects: [] }
    case 'dev/setScreen':
      return { state: { ...state, screen: action.screen }, effects: [] }
    case 'ui/toggleDevHud':
      return { state: { ...state, ui: { ...state.ui, devHud: !state.ui.devHud } }, effects: [] }
    default:
      return { state, effects: [{ kind: 'refused', action: action.type, reason: 'fake' }] }
  }
}

const LOG: readonly Action[] = [
  { type: 'dev/addGold', amount: 10 },
  { type: 'ui/toggleDevHud' },
  { type: 'meta/setAudioMuted', muted: false },
  { type: 'dev/addGold', amount: -5 },
  { type: 'combat/cancel' }, // refused by the fake: state unchanged, still part of the log
  { type: 'dev/setScreen', screen: { kind: 'town' } },
]

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v)
  }
  return value
}

describe('save/replay — fold', () => {
  it('replayWith folds the reducer over the log in order', () => {
    const initial = populatedRun()
    const final = replayWith(fake, initial, LOG, env)
    expect(final.run?.gold).toBe(137 + 10 - 5)
    expect(final.meta.audioMuted).toBe(false)
    expect(final.ui.devHud).toBe(true)
    expect(final.screen).toEqual({ kind: 'town' })
  })

  it('an empty log is the identity', () => {
    const initial = populatedRun()
    expect(replayWith(fake, initial, [], env)).toBe(initial)
  })

  it('never mutates its inputs (frozen initial state and log)', () => {
    const initial = deepFreeze(populatedRun())
    const log = deepFreeze([...LOG])
    expect(() => replayWith(fake, initial, log, env)).not.toThrow()
    expect(initial.run?.gold).toBe(137)
  })
})

describe('save/replay — verify', () => {
  it('is ok when the snapshot is the fold\'s own result', () => {
    const initial = populatedRun()
    const snapshot = replayWith(fake, initial, LOG, env)
    expect(verifyReplayWith(fake, initial, LOG, snapshot, env)).toEqual({ ok: true })
  })

  it('ignores ui: a snapshot that differs only in state.ui still verifies (ui is never persisted or read by legality)', () => {
    const initial = populatedRun()
    const snapshot = replayWith(fake, initial, LOG, env)
    const uiDrift: GameState = { ...snapshot, ui: { ...snapshot.ui, devHud: !snapshot.ui.devHud, townTab: 'tavern' } }
    expect(verifyReplayWith(fake, initial, LOG, uiDrift, env)).toEqual({ ok: true })
  })

  it('reports the first diverging JSON path, pinned to the last action of a terminal-only log', () => {
    const initial = populatedRun()
    const snapshot = replayWith(fake, initial, LOG, env)
    const tampered: GameState = { ...snapshot, run: { ...snapshot.run!, gold: 999 } }
    expect(verifyReplayWith(fake, initial, LOG, tampered, env)).toEqual({ ok: false, index: LOG.length - 1, path: 'run.gold' })
  })

  it('walks meta → run → combat → ledger → screen and names the earliest slice that differs', () => {
    const initial = populatedMidCombat()
    const snapshot = replayWith(fake, initial, [], env)
    const metaAndScreen: GameState = { ...snapshot, meta: { ...snapshot.meta, runsWon: 9 }, screen: { kind: 'title' } }
    expect(verifyReplayWith(fake, initial, [], metaAndScreen, env)).toEqual({ ok: false, index: -1, path: 'meta.runsWon' })
    const combatOnly: GameState = { ...snapshot, combat: { ...snapshot.combat!, grid: { ...snapshot.combat!.grid, obstacles: ['3,4', '5,2'] } } }
    expect(verifyReplayWith(fake, initial, [], combatOnly, env)).toEqual({ ok: false, index: -1, path: 'combat.grid.obstacles[0]' })
  })

  it('a reducer that throws mid-log is reported at that index (the runtime never logs an action that threw)', () => {
    const throwing: Reducer = (state, action, e) => {
      if (action.type === 'meta/setAudioMuted') throw new Error('boom')
      return fake(state, action, e)
    }
    const initial = populatedRun()
    const verdict = verifyReplayWith(throwing, initial, LOG, initial, env)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.index).toBe(2)
      expect(verdict.path).toBe('<reduce threw: boom>')
    }
  })
})

describe('save/replay — firstDivergence', () => {
  it('is null for deep-equal states regardless of key order, and never looks at ui', () => {
    const a = populatedMidCombat()
    const reordered = JSON.parse(JSON.stringify({ ...a, combat: { ...a.combat, rng: { counter: 17, seed: 2077 } } })) as GameState
    expect(firstDivergence(a, reordered)).toBeNull()
    expect(firstDivergence(a, { ...a, ui: { ...a.ui, showDanger: true } })).toBeNull()
  })

  it('names a missing key, an extra key, a length change and a null-vs-object mismatch', () => {
    const a = populatedRun()
    const run = a.run!
    const withoutGold = { ...run } as Record<string, unknown>
    delete withoutGold.gold
    expect(firstDivergence(a, { ...a, run: withoutGold as unknown as typeof run })).toBe('run.gold')
    expect(firstDivergence({ ...a, run: withoutGold as unknown as typeof run }, a)).toBe('run.gold')
    expect(firstDivergence(a, { ...a, run: { ...run, partyOrder: [...run.partyOrder, 'lyra'] } })).toBe('run.partyOrder[3]')
    expect(firstDivergence(a, { ...a, run: { ...run, town: null } })).toBe('run.town')
    expect(firstDivergence(a, { ...a, run: null })).toBe('run')
    expect(firstDivergence(a, { ...a, ledger: { outcome: 'won', runId: 'x', runSeed: 1, mcName: null, companyName: null, daysElapsed: 1, stats: run.stats, fallen: [], survivors: [], trophyItemId: null } })).toBe('ledger')
  })

  it('descends into arrays of objects and records', () => {
    const a = populatedRun()
    const run = a.run!
    const bag = run.bag.map((e, i) => (i === 1 ? { ...e, charges: 7 } : e))
    expect(firstDivergence(a, { ...a, run: { ...run, bag } })).toBe('run.bag[1].charges')
    expect(firstDivergence(a, { ...a, run: { ...run, party: { ...run.party, oak: { ...run.party.oak!, hp: { current: 1, max: 30 } } } } })).toBe('run.party.oak.hp.current')
  })
})

describe('save/replay — real reducer', () => {
  it('replay(initial, actions) equals reduceMany(...).state and verifyReplay is ok (once WP-FLOW has landed)', (ctx) => {
    const initial = blankState(META)
    const log: readonly Action[] = [{ type: 'ui/toggleDevHud' }, { type: 'meta/setAudioMuted', muted: false }]
    if (!landed(() => reduce(initial, log[0]!, env))) return ctx.skip()
    const direct = reduceMany(initial, log, env).state
    const folded = replay(initial, log, env)
    expect(firstDivergence(folded, direct)).toBeNull()
    expect(verifyReplay(initial, log, direct, env)).toEqual({ ok: true })
  })
})
