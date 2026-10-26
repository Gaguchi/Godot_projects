/**
 * Adversarial review of WP-SAVE (not written by the implementer). Three edge cases the package's own suite does
 * not cover; a failing case here documents a defect rather than being deleted.
 *
 *  1. Multi-cycle: three save → reload → dispatch cycles through the real codec, then the CONCATENATED log replays
 *     from the first hydrated state to the final live state — with and without the `ui/*` actions (CONTRACT §1:
 *     a replay may drop them losslessly). Selection is non-idle and `combat.rng` advances at every save point.
 *  2. Boundary: the schema's referential check `turn.unitId ∈ units` uses `in` on a plain object, so a unit id that
 *     names a prototype member (`constructor`, `toString`) passes the check with NO such unit in the file.
 *  3. Boundary: the sorted-obstacles refinement must agree with the REAL producer (`procgen/battleFloor.ts#battleGrid`,
 *     default `.sort()`) and the REAL consumer (`combat/grid.ts#isObstacle`, binary search on `<`) once coordinates
 *     reach two digits ('10,3' sorts before '2,9'); a numerically-sorted list is rejected by name.
 */
import { describe, expect, it } from 'vitest'
import type { Action, ReduceResult } from '../../../../src/engine/actions'
import { isUiAction } from '../../../../src/engine/actions'
import { isObstacle } from '../../../../src/engine/combat/grid'
import { battleGrid } from '../../../../src/engine/procgen/battleFloor'
import { fromSaveFile, parseSaveWith, serialize, toSaveFile } from '../../../../src/engine/save/codec'
import { firstDivergence, replayWith, verifyReplayWith, type Reducer } from '../../../../src/engine/save/replay'
import type { GameState } from '../../../../src/engine/types'
import { GRID, hydratedExpectation, populatedMidCombat, tamper, testEnv } from '../../../helpers/saves'

const env = testEnv()
const noInvariants = (): readonly string[] => []

/** A fake reducer that touches every persisted slice and rolls the combat stream, so a lossy codec would show. */
const fake: Reducer = (state, action): ReduceResult => {
  switch (action.type) {
    case 'dev/addGold':
      return state.run === null
        ? { state, effects: [{ kind: 'refused', action: action.type, reason: 'no run' }] }
        : { state: { ...state, run: { ...state.run, gold: Math.max(0, state.run.gold + action.amount) } }, effects: [] }
    case 'meta/setAudioMuted':
      return { state: { ...state, meta: { ...state.meta, audioMuted: action.muted } }, effects: [] }
    case 'combat/enterMove':
      return state.combat === null
        ? { state, effects: [{ kind: 'refused', action: action.type, reason: 'no combat' }] }
        : { state: { ...state, combat: { ...state.combat, selection: { kind: 'move' }, rng: { seed: state.combat.rng.seed, counter: state.combat.rng.counter + 1 } } }, effects: [] }
    case 'combat/selectCard':
      return state.combat === null
        ? { state, effects: [{ kind: 'refused', action: action.type, reason: 'no combat' }] }
        : { state: { ...state, combat: { ...state.combat, selection: { kind: 'card', cardUid: action.cardUid, pinnedTile: null } } }, effects: [] }
    case 'ui/toggleDevHud':
      return { state: { ...state, ui: { ...state.ui, devHud: !state.ui.devHud } }, effects: [] }
    case 'ui/setTownTab':
      return { state: { ...state, ui: { ...state.ui, townTab: action.tab } }, effects: [] }
    default:
      return { state, effects: [{ kind: 'refused', action: action.type, reason: 'fake' }] }
  }
}

function saveAndReload(live: GameState): GameState {
  const parsed = parseSaveWith(serialize(toSaveFile(live, env)), env, noInvariants)
  if (!parsed.ok) throw new Error(`${parsed.reason}: ${parsed.detail}`)
  const hydrated = fromSaveFile(parsed.value)
  expect(hydrated).toEqual(hydratedExpectation(live))
  // "Continue" (resumeScreen is WP-FLOW's): the slots are untouched, so the screen the player left is the one that resumes.
  return { ...hydrated, screen: live.screen }
}

describe('review/wp-save — multi-cycle', () => {
  it('three save→reload→dispatch cycles: every reload is lossless and the concatenated log replays to the final state, ui actions or not', () => {
    const initial = populatedMidCombat() // screen combat, selection card, rng counter 17
    const cycles: readonly (readonly Action[])[] = [
      [{ type: 'combat/enterMove' }, { type: 'ui/toggleDevHud' }, { type: 'dev/addGold', amount: 10 }],
      [{ type: 'combat/selectCard', cardUid: 'lord_rally#1' }, { type: 'meta/setAudioMuted', muted: false }, { type: 'ui/setTownTab', tab: 'shop' }],
      [{ type: 'combat/enterMove' }, { type: 'dev/addGold', amount: -200 }, { type: 'combat/cancel' /* refused by the fake, still logged */ }],
    ]

    let live = initial
    const log: Action[] = []
    const counters: number[] = []
    for (const actions of cycles) {
      live = replayWith(fake, live, actions, env)
      log.push(...actions)
      counters.push(live.combat!.rng.counter)
      live = saveAndReload(live) // the next cycle starts from what the host wrote
    }

    // The combat stream advanced at every enterMove and survived every reload verbatim.
    expect(counters).toEqual([18, 18, 19])
    expect(live.combat?.rng).toEqual({ seed: 2077, counter: 19 })
    expect(live.combat?.selection).toEqual({ kind: 'move' })
    expect(live.run?.gold).toBe(0) // 137 + 10 − 200, clamped
    expect(live.meta.audioMuted).toBe(false)

    // The whole log, folded once from the very first state, lands on the same persisted slices as the three cycles did.
    expect(verifyReplayWith(fake, initial, log, live, env)).toEqual({ ok: true })
    expect(firstDivergence(replayWith(fake, initial, log, env), live)).toBeNull()

    // CONTRACT §1: dropping `ui/*` from the log is lossless for the persisted slices.
    const gameOnly = log.filter((a) => !isUiAction(a))
    expect(gameOnly.length).toBe(log.length - 2)
    expect(verifyReplayWith(fake, initial, gameOnly, live, env)).toEqual({ ok: true })
  })
})

describe('review/wp-save — referential check boundary', () => {
  it('turn.unitId naming a prototype member (constructor / toString) is rejected by name — no such unit is in the file', () => {
    const json = serialize(toSaveFile(populatedMidCombat({ selection: { kind: 'idle' } }), env))
    for (const ghost of ['constructor', 'toString', 'hasOwnProperty']) {
      const result = parseSaveWith(tamper(json, (doc) => { (doc.combat as { turn: { unitId: string } }).turn.unitId = ghost }), env, noInvariants)
      expect(result.ok, ghost).toBe(false)
      if (result.ok) continue
      expect(result.reason, ghost).toBe('schema')
      expect(result.detail, ghost).toMatch(/combat\.turn\.unitId/)
    }
  })
})

describe('review/wp-save — obstacle order agrees with the real producer and consumer', () => {
  const unsorted = ['3,4', '10,3', '2,9', '11,2', '9,0', '10,3']

  it('battleGrid-sorted two-digit obstacles round-trip and every one is found by isObstacle after the reload', () => {
    const grid = battleGrid({ grid: { width: 14, height: 10, obstacles: unsorted, terrain: null }, battleId: 'review', rng: { seed: 1, counter: 0 } }, env)
    expect(grid.obstacles).toEqual(['10,3', '11,2', '2,9', '3,4', '9,0']) // default string order, deduped
    const live = populatedMidCombat({ grid: { ...GRID, obstacles: grid.obstacles }, selection: { kind: 'idle' } })
    const back = saveAndReload(live)
    for (const key of grid.obstacles) expect(isObstacle(back.combat!.grid, key), key).toBe(true)
    for (const free of ['1,3', '10,2', '2,8', '13,9']) expect(isObstacle(back.combat!.grid, free), free).toBe(false)
  })

  it('a numerically-ordered list (what a naive x-then-y sort produces) is rejected naming combat.grid.obstacles', () => {
    const numeric = ['2,9', '3,4', '9,0', '10,3', '11,2']
    // The consumer would MISS obstacles on such a list — the schema must refuse it rather than let a reload play on a different board.
    expect(isObstacle({ ...GRID, obstacles: numeric }, '10,3')).toBe(false)
    const live = populatedMidCombat({ selection: { kind: 'idle' } })
    const result = parseSaveWith(tamper(serialize(toSaveFile(live, env)), (doc) => { (doc.combat as { grid: { obstacles: string[] } }).grid.obstacles = numeric }), env, noInvariants)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toMatch(/combat\.grid\.obstacles.*sorted/)
  })
})
