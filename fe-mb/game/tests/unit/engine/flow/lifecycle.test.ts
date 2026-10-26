/**
 * flow/lifecycle.ts — title, new run, quit, end of run, hydrate (CONTRACT §1 flow, §2.15 ledgers).
 * The named WP-FLOW cases: leaving a ledger screen leaves no ledger behind; a wipe outside combat ends the run
 * in the SAME dispatch; and a hydrated save lands on Title with Continue routing back to the exact slot.
 */
import { describe, expect, it } from 'vitest'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { checkInvariants } from '../../../../src/engine/flow/invariants'
import { initialState } from '../../../../src/engine/flow/lifecycle'
import { resumeScreen } from '../../../../src/engine/flow/pump'
import { reduce } from '../../../../src/engine/reducer'
import { toSaveFile } from '../../../../src/engine/save/codec'
import type { GameState } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'
import { envWithChance } from '../../../helpers/overworld'
import { Session } from '../../../helpers/session'

const SEED = 7

describe('lifecycle — leaving a terminal screen', () => {
  for (const kind of ['win', 'gameOver'] as const) {
    it(`toTitle from ${kind} leaves no ledger behind`, () => {
      const s = new Session(fixtureFor(kind, SEED, env))
      expect(s.state.ledger).not.toBeNull()
      s.do({ type: 'meta/toTitle' })
      expect(s.state.screen.kind).toBe('title')
      expect(s.state.ledger).toBeNull()
      expect(checkInvariants(s.state, env)).toEqual([])
      // and the title is now a plain title: nothing to dismiss, nothing to continue
      s.refuse({ type: 'meta/dismissLedger' }, 'no ledger to dismiss')
      s.refuse({ type: 'meta/continueRun' }, 'no run to continue')
      s.do({ type: 'meta/newRun', seed: 2 })
    })
  }

  it('dismissLedger does the same thing from the button the player actually has', () => {
    const s = new Session(fixtureFor('win', SEED, env))
    s.do({ type: 'meta/dismissLedger' })
    expect(s.state.screen.kind).toBe('title')
    expect(s.state.ledger).toBeNull()
  })

  it('quitting a live run keeps the run and the battle exactly as they stand', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    const combat = s.state.combat
    const run = s.state.run
    s.do({ type: 'meta/toTitle' })
    expect(s.state.combat).toBe(combat)
    expect(s.state.run).toBe(run)
    expect(s.kinds('autosave').some((e) => e.urgent)).toBe(true)
  })
})

describe('lifecycle — newRun', () => {
  it('a first run counts up, marks the game started and opens the tutorial', () => {
    const s = new Session(initialState())
    s.do({ type: 'meta/newRun', seed: SEED })
    expect(s.state.meta.totalRuns).toBe(1)
    expect(s.state.meta.gameStarted).toBe(true)
    expect(s.state.combat?.tag).toBe('tutorial')
    expect(s.kinds('runStarted')[0]?.seed).toBe(SEED)
  })

  it('a later run skips the lesson and opens the prologue', () => {
    const s = new Session(initialState({ tutorialSeen: true, gameStarted: true }))
    s.do({ type: 'meta/newRun', seed: SEED })
    expect(s.state.screen.kind).toBe('prologue')
    expect(s.state.combat).toBeNull()
  })

  it('New Run from a ledger screen replaces the ledger with a run', () => {
    const s = new Session(fixtureFor('gameOver', SEED, env))
    s.do({ type: 'meta/newRun', seed: 11 })
    expect(s.state.ledger).toBeNull()
    expect(s.state.run).not.toBeNull()
  })
})

describe('lifecycle — endRun', () => {
  it('starvation wipe ends the run with runsLost++ and run:null in the same dispatch', () => {
    const quiet = envWithChance(0)
    const s = new Session(initialState({ tutorialSeen: true, gameStarted: true }), quiet)
    s.do({ type: 'meta/newRun', seed: 5 })
    s.closeDialogue()
    const run = s.state.run
    if (run === null) throw new Error('no run')
    // one hit point each and an empty bag: the next hop starves the company off the road
    const weak = { ...run, party: Object.fromEntries(Object.entries(run.party).map(([id, u]) => [id, { ...u, hp: { ...u.hp, current: 1 } }])), bag: [] }
    s.do({ type: 'dev/seedState', state: { ...s.state, run: weak } })
    const edge = quiet.content.overworld.edges.find((e) => e.from === weak.nodeId || e.to === weak.nodeId)
    if (edge === undefined) throw new Error('the start node has no road')
    s.do({ type: 'travel/goTo', nodeId: edge.from === weak.nodeId ? edge.to : edge.from })
    const before = s.effects.length
    s.settle()
    expect(s.state.run).toBeNull()
    expect(s.state.combat).toBeNull()
    expect(s.state.screen.kind).toBe('gameOver')
    expect(s.state.ledger?.outcome).toBe('lost')
    expect(s.state.meta.runsLost).toBe(1)
    // the null save is urgent and lands AFTER runEnded, in the same dispatch (brief §2.14 rule 6)
    const tail = s.effects.slice(before)
    const ended = tail.findIndex((e) => e.kind === 'runEnded')
    expect(ended).toBeGreaterThanOrEqual(0)
    expect(tail.findIndex((e, i) => i > ended && e.kind === 'autosave' && e.urgent)).toBeGreaterThan(ended)
  })

  it('the ledger carries the run’s own seed so Restart rebuilds the same run', () => {
    const s = new Session(fixtureFor('win', SEED, env))
    const ledger = s.state.ledger
    if (ledger === null) throw new Error('no ledger')
    expect(typeof ledger.runSeed).toBe('number')
    expect(ledger.runId.length).toBeGreaterThan(0)
  })
})

describe('lifecycle — hydrate', () => {
  it('hydrate lands on title and Continue routes to the town the player quit from', () => {
    const inTown = fixtureFor('town', SEED, env)
    const file = toSaveFile(inTown, env)
    const s = new Session(initialState())
    s.do({ type: 'save/resume', file })
    expect(s.state.screen.kind).toBe('title')
    expect(s.state.ledger).toBeNull()
    expect(s.state.run?.town).not.toBeNull()
    expect(resumeScreen(s.state)).toBe('town')
    s.do({ type: 'meta/continueRun' })
    expect(s.state.screen.kind).toBe('town')
  })

  it('a hydrated mid-battle save resumes on the combat screen', () => {
    const battle = fixtureFor('combat', SEED, env)
    const s = new Session(initialState())
    s.do({ type: 'save/resume', file: toSaveFile(battle, env) })
    expect(s.state.screen.kind).toBe('title')
    s.do({ type: 'meta/continueRun' })
    expect(s.state.screen.kind).toBe('combat')
    expect(s.state.combat?.battleId).toBe(battle.combat?.battleId)
  })
})

describe('lifecycle — skipTutorial', () => {
  it('drops the lesson with no report and no payout, and remembers it', () => {
    const s = new Session(initialState())
    s.do({ type: 'meta/newRun', seed: SEED })
    const gold = s.state.run?.gold ?? -1
    s.do({ type: 'tutorial/skip' })
    expect(s.state.meta.tutorialSeen).toBe(true)
    expect(s.state.combat).toBeNull()
    expect(s.state.run?.lastBattle ?? null).toBeNull()
    expect(s.state.run?.gold).toBe(gold)
    expect(s.state.screen.kind).toBe('prologue')
  })
})

describe('lifecycle — initialState', () => {
  it('is a title screen with nothing in it, and is invariant-clean', () => {
    const s: GameState = initialState()
    expect(s.screen.kind).toBe('title')
    expect(s.run).toBeNull()
    expect(s.combat).toBeNull()
    expect(s.ledger).toBeNull()
    expect(checkInvariants(s, env)).toEqual([])
    // meta survives a run; the caller may seed it from the meta file
    expect(initialState({ runsWon: 3 }).meta.runsWon).toBe(3)
  })

  it('reduce refuses every run action on a bare title with the same reference', () => {
    const bare = initialState()
    const r = reduce(bare, { type: 'travel/goTo', nodeId: 'anywhere' }, env)
    expect(r.state).toBe(bare)
    expect(r.effects).toHaveLength(1)
  })
})
