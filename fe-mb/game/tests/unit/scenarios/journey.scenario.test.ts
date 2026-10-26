/**
 * The whole game through the ROOT reducer, headless (CONTRACT §7 WP-FLOW; brief §10 journey):
 * title → new run → tutorial (played by the greedy policy, enemy turns pumped) → Field Report → prologue →
 * overworld → a hop → a town → and a defeat path. Ends with `verifyReplay`: the action log replays to the same state.
 */
import { describe, expect, it } from 'vitest'
import { initialState } from '../../../src/engine/flow/lifecycle'
import { overlayOf } from '../../../src/engine/flow/pump'
import { adjacency } from '../../../src/engine/run/overworld'
import { verifyReplay } from '../../../src/engine/save/replay'
import { env } from '../../helpers/env'
import { envWithChance } from '../../helpers/overworld'
import { Session } from '../../helpers/session'

describe('journey — the game end to end through reduce()', () => {
  it('first run: tutorial → field report → prologue → the map → a hop → a town, and the log replays', () => {
    const s = new Session(initialState())
    expect(s.state.screen.kind).toBe('title')

    // New Run on a fresh install lands in the tutorial (settle seeds the pending combat)
    s.do({ type: 'meta/newRun', seed: 7 })
    expect(s.state.screen.kind).toBe('combat')
    expect(s.state.combat?.tag).toBe('tutorial')
    expect(overlayOf(s.state)?.kind).toBe('tutorial')

    // play it out: greedy party turns, pumped enemy turns
    s.settle()
    expect(s.state.combat).toBeNull()
    expect(s.state.screen.kind).toBe('battleEnd')
    expect(s.state.run?.lastBattle?.tag).toBe('tutorial')
    expect(s.state.run?.lastBattle?.goldEarned).toBe(0) // the lesson pays nothing
    expect(overlayOf(s.state)).toEqual({ kind: 'tutorial', step: 'victory' })

    // the report closes into the prologue; the tutorial is remembered
    s.do({ type: 'battleEnd/dismiss' })
    expect(s.state.meta.tutorialSeen).toBe(true)
    expect(s.state.screen.kind).toBe('prologue')
    s.closeDialogue()
    expect(s.state.screen.kind).toBe('overworld')
    expect(s.state.run?.flags['prologue_seen']?.value).toBe(true)
    expect(s.effects.some((x) => x.kind === 'autosave' && x.urgent)).toBe(true)

    // one hop to a neighbour on a quiet road, then whatever the node menu offers
    const run = s.state.run!
    const next = adjacency(run, env)[run.nodeId]![0]!
    const days = run.daysElapsed
    s.do({ type: 'travel/goTo', nodeId: next })
    s.settle()
    // an encounter may have interrupted the walk: resolve dialogues / checks, then let the hop land
    for (let guard = 0; guard < 8 && s.state.run?.nodeId !== next; guard++) {
      const overlay = overlayOf(s.state)
      if (overlay?.kind === 'dialogue') s.closeDialogue()
      else if (overlay?.kind === 'checkEvent') {
        if (overlay.event.result === null) s.do({ type: 'check/choose', choiceId: env.content.checkEvents[overlay.event.checkEventId]!.choices[0]!.id, attemptingUnitId: null })
        else s.do({ type: 'check/dismiss' })
      } else if (s.state.screen.kind === 'battleEnd') s.do({ type: 'battleEnd/dismiss' })
      s.settle()
    }
    expect(s.state.run?.nodeId).toBe(next)
    expect(s.state.run?.daysElapsed).toBe(days + 1)
    expect(overlayOf(s.state)?.kind).toBe('quickMenu')

    // the log replays to the same state
    const verdict = verifyReplay(s.initial, s.log, s.state, env)
    expect(verdict).toEqual({ ok: true })
  })

  it('a town visit: inn, shop, tavern board, leave — screen follows the slots', () => {
    const quiet = envWithChance(0)
    const s = new Session(initialState({ tutorialSeen: true, gameStarted: true }), quiet)
    s.do({ type: 'meta/newRun', seed: 3 })
    s.closeDialogue()
    const town = quiet.content.overworld.nodes.find((n) => n.type === 'TOWN')!
    s.do({ type: 'dev/teleport', nodeId: town.id })
    s.do({ type: 'travel/goTo', nodeId: town.id })
    expect(overlayOf(s.state)?.kind).toBe('quickMenu')
    s.do({ type: 'town/enter' })
    expect(s.state.screen.kind).toBe('town')
    const potion = Object.values(quiet.content.items).find((i) => i.kind === 'potion' && i.buyPrice !== undefined)!
    const gold = s.state.run!.gold
    s.do({ type: 'town/buy', itemId: potion.id })
    expect(s.state.run!.gold).toBe(gold - potion.buyPrice!)
    s.do({ type: 'town/leave' })
    expect(s.state.screen.kind).toBe('overworld')
    s.do({ type: 'travel/stay' })
    expect(overlayOf(s.state)).toBeNull()
    s.do({ type: 'meta/toTitle' })
    expect(s.state.screen.kind).toBe('title')
    s.do({ type: 'meta/continueRun' })
    expect(s.state.screen.kind).toBe('overworld')
    expect(verifyReplay(s.initial, s.log, s.state, quiet)).toEqual({ ok: true })
  })

  it('defeat is terminal: a wipe on the road ends the run with a null save before the game-over screen', () => {
    const quiet = envWithChance(0)
    const s = new Session(initialState({ tutorialSeen: true, gameStarted: true }), quiet)
    s.do({ type: 'meta/newRun', seed: 5 })
    s.closeDialogue()
    // starve the company down to one hit point each, then walk with an empty bag
    const run = s.state.run!
    const weak = { ...run, party: Object.fromEntries(Object.entries(run.party).map(([id, u]) => [id, { ...u, hp: { ...u.hp, current: 1 } }])), bag: [] }
    s.do({ type: 'dev/seedState', state: { ...s.state, run: weak } })
    const next = adjacency(weak, quiet)[weak.nodeId]![0]!
    s.do({ type: 'travel/goTo', nodeId: next })
    const before = s.effects.length
    s.settle()
    expect(s.state.screen.kind).toBe('gameOver')
    expect(s.state.run).toBeNull()
    expect(s.state.ledger?.outcome).toBe('lost')
    expect(s.state.meta.runsLost).toBe(1)
    const tail = s.effects.slice(before)
    const ended = tail.findIndex((x) => x.kind === 'runEnded')
    const saved = tail.findIndex((x, i) => i > ended && x.kind === 'autosave' && x.urgent)
    expect(ended).toBeGreaterThanOrEqual(0)
    expect(saved).toBeGreaterThan(ended)
    s.do({ type: 'meta/dismissLedger' })
    expect(s.state.screen.kind).toBe('title')
  })
})
