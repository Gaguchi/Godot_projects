/**
 * flow/pump.ts — the derivations everyone shares (CONTRACT §3). Both pump rules carry a SCREEN term, so no pump
 * is ever due on Title; `resumeScreen` is total over the slots; none of the three reads `state.ui`.
 */
import { describe, expect, it } from 'vitest'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { initialState } from '../../../../src/engine/flow/lifecycle'
import { isQuiescent, nextPump, overlayOf, resumeScreen } from '../../../../src/engine/flow/pump'
import { reduce } from '../../../../src/engine/reducer'
import type { GameState, ScreenKind } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'
import { Session } from '../../../helpers/session'

const SEED = 7
const at = (kind: ScreenKind): GameState => fixtureFor(kind, SEED, env)

/** End party turns until an enemy holds the clock — no damage, so the battle cannot end under us. */
function toEnemyTurn(s: Session): void {
  for (let i = 0; i < 32; i++) {
    const combat = s.state.combat
    if (combat === null) throw new Error('the battle ended')
    if (combat.units[combat.turn.unitId]?.team === 'enemy') return
    s.do({ type: 'combat/endTurn' })
  }
  throw new Error('never reached an enemy turn')
}

describe('nextPump', () => {
  it('an enemy on the clock during a battle is a combat/enemyStep', () => {
    const s = new Session(at('combat'))
    toEnemyTurn(s)
    expect(nextPump(s.state)).toEqual({ type: 'combat/enemyStep' })
  })

  it('no pump is due on title with a live enemy-turn combat; Continue resumes it with no input', () => {
    const s = new Session(at('combat'))
    toEnemyTurn(s)
    s.do({ type: 'meta/toTitle' })
    expect(s.state.screen.kind).toBe('title')
    expect(s.state.combat).not.toBeNull()
    expect(nextPump(s.state)).toBeNull()
    s.do({ type: 'meta/continueRun' })
    expect(s.state.screen.kind).toBe('combat')
    expect(nextPump(s.state)).toEqual({ type: 'combat/enemyStep' })
  })

  it('a walking hop on the map is a travel/step; an overlay parks it', () => {
    const map = at('overworld')
    const run = map.run
    if (run === null) throw new Error('fixture: no run')
    const s = new Session(map)
    const neighbour = env.content.overworld.edges.find((e) => e.from === run.nodeId || e.to === run.nodeId)
    if (neighbour === undefined) throw new Error('the start node has no road')
    s.do({ type: 'travel/goTo', nodeId: neighbour.from === run.nodeId ? neighbour.to : neighbour.from })
    expect(s.state.run?.pendingTravel?.status).toBe('walking')
    expect(nextPump(s.state)).toEqual({ type: 'travel/step' })
    const suspended: GameState = { ...s.state, run: { ...s.state.run!, pendingNamePrompt: { target: 'mc' } } }
    expect(overlayOf(suspended)?.kind).toBe('namePrompt')
    expect(nextPump(suspended)).toBeNull()
  })

  it('never reads state.ui', () => {
    for (const kind of ['title', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win'] as const) {
      const base = at(kind)
      const noisy: GameState = { ...base, ui: { ...base.ui, modal: { kind: 'pause' }, showDanger: !base.ui.showDanger, mapPan: { x: 5, y: 5 } } }
      expect(nextPump(noisy), kind).toEqual(nextPump(base))
      expect(overlayOf(noisy), kind).toEqual(overlayOf(base))
      expect(isQuiescent(noisy), kind).toBe(isQuiescent(base))
    }
  })
})

describe('isQuiescent', () => {
  it('is false on title, false under an overlay, and true when the map is waiting for a click', () => {
    expect(isQuiescent(initialState())).toBe(false)
    expect(isQuiescent(at('prologue'))).toBe(false)
    const map = at('overworld')
    expect(overlayOf(map)).toBeNull()
    expect(nextPump(map)).toBeNull()
    expect(isQuiescent(map)).toBe(true)
  })
})

describe('resumeScreen maps every slot', () => {
  it('ledger → win / gameOver, and it wins over every other slot', () => {
    expect(resumeScreen(at('win'))).toBe('win')
    expect(resumeScreen(at('gameOver'))).toBe('gameOver')
  })

  it('run null → title', () => {
    expect(resumeScreen(initialState())).toBe('title')
  })

  it('combat → combat, and it wins over lastBattle', () => {
    const battle = at('combat')
    expect(resumeScreen(battle)).toBe('combat')
    const parked = reduce(battle, { type: 'meta/toTitle' }, env).state
    expect(resumeScreen(parked)).toBe('combat')
  })

  it('lastBattle → battleEnd', () => {
    expect(resumeScreen(at('battleEnd'))).toBe('battleEnd')
  })

  it('a prologue dialogue → prologue', () => {
    const prologue = at('prologue')
    expect(prologue.run?.pendingDialogue?.source).toBe('prologue')
    expect(resumeScreen(prologue)).toBe('prologue')
  })

  it('town → town, camp → camp, activeDungeon → dungeon, else overworld', () => {
    expect(resumeScreen(at('town'))).toBe('town')
    expect(resumeScreen(at('camp'))).toBe('camp')
    expect(resumeScreen(at('dungeon'))).toBe('dungeon')
    expect(resumeScreen(at('overworld'))).toBe('overworld')
  })

  it('every fixture screen agrees with its own slots (the invariant the checker asserts)', () => {
    const kinds: readonly ScreenKind[] = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver']
    for (const kind of kinds) {
      const s = at(kind)
      expect(s.screen.kind === 'title' || s.screen.kind === resumeScreen(s), kind).toBe(true)
    }
  })
})
