/**
 * Brief §7.9 / §10 "save": ONE round-trip test over the REAL load path with every run field populated —
 * `serialize → parseSave → fromSaveFile` deep-equals the state on meta/run/combat, mid-selection included
 * (CONTRACT-CHANGES 0016), and lands on Title with no ledger (CONTRACT-CHANGES 0008).
 */
import { describe, expect, it } from 'vitest'
import { fromSaveFile, parseMeta, parseSave, parseSaveWith, serialize, toSaveFile, DEFAULT_UI } from '../../../../src/engine/save/codec'
import { checkInvariants } from '../../../../src/engine/flow/invariants'
import {
  META,
  blankState,
  hydratedExpectation,
  landed,
  populatedMidCombat,
  populatedRun,
  populatedVariants,
  roundTrip,
  roundTripStrict,
  testEnv,
} from '../../../helpers/saves'

const env = testEnv()
const flowLanded = (): boolean => landed(() => checkInvariants(blankState(), env))

describe('save/roundTrip', () => {
  it('populatedRun() deep-equals through the real load path (minus the WP-FLOW invariant gate)', () => {
    const state = populatedRun()
    expect(roundTrip(state, env)).toEqual(hydratedExpectation(state))
  })

  it('every slot variant deep-equals through the real load path', () => {
    for (const { name, state } of populatedVariants()) {
      expect(roundTrip(state, env), name).toEqual(hydratedExpectation(state))
    }
  })

  it('populatedRun() and every variant pass the real parseSave once flow/invariants has landed', (ctx) => {
    if (!flowLanded()) return ctx.skip()
    for (const { name, state } of populatedVariants()) {
      expect(roundTripStrict(state, env), name).toEqual(hydratedExpectation(state))
    }
  })

  it('toSaveFile copies the three slices by reference — nothing is rewritten (selection included)', () => {
    const state = populatedMidCombat()
    const file = toSaveFile(state, env)
    expect(file.meta).toBe(state.meta)
    expect(file.run).toBe(state.run)
    expect(file.combat).toBe(state.combat)
    expect(file.combat?.selection).toEqual({ kind: 'card', cardUid: 'iron_sword_slash#1', pinnedTile: '6,4' })
    expect(Object.keys(file).sort()).toEqual(['combat', 'contentVersion', 'meta', 'run', 'saveVersion'])
  })

  it('the file carries rules.save.version and the content hash', () => {
    const file = toSaveFile(populatedRun(), env)
    expect(file.saveVersion).toBe(env.rules.save.version)
    expect(file.contentVersion).toBe(env.content.version)
  })

  it('fromSaveFile lands on Title with ledger null and default ui — Continue decides via resumeScreen', () => {
    const state = populatedMidCombat()
    const hydrated = fromSaveFile(toSaveFile(state, env))
    expect(hydrated.screen).toEqual({ kind: 'title' })
    expect(hydrated.ledger).toBeNull()
    expect(hydrated.ui).toEqual(DEFAULT_UI)
    expect(hydrated.combat).toBe(state.combat)
    expect(hydrated.run).toBe(state.run)
  })

  it('a finished run persists as run: null and reloads with no Continue target', () => {
    const finished = populatedVariants().find((v) => v.name.startsWith('finished run'))!.state
    const file = toSaveFile(finished, env)
    expect(file.run).toBeNull()
    expect(file.combat).toBeNull()
    const back = roundTrip(finished, env)
    expect(back.run).toBeNull()
    expect(back.ledger).toBeNull()
    expect(back.screen.kind).toBe('title')
  })

  it('a mid-selection battle round-trips verbatim (CONTRACT-CHANGES 0016)', () => {
    const state = populatedMidCombat()
    const back = roundTrip(state, env)
    expect(back.combat).toEqual(state.combat)
    expect(back.combat?.selection).toEqual(state.combat?.selection)
    expect(back.combat?.grid.obstacles).toEqual(['11,2', '3,4', '5,2', '7,7'])
    expect(Array.isArray(back.combat?.grid.obstacles)).toBe(true)
  })

  it('scouted rolls survive: a quiet road (null), a one-shot check event and a battle with captureTargets', () => {
    const state = populatedVariants().find((v) => v.name.startsWith('Field Report'))!.state
    const back = roundTrip(state, env)
    expect(back.run?.scoutedEdges).toEqual(state.run?.scoutedEdges)
    expect(back.run?.scoutedEdges['border_fortress->pine_crossing#1']).toBeNull()
    expect(back.run?.pendingTravel?.hop?.encounter?.outcome).toEqual({ kind: 'battle', enemyGroupId: 'bandits', captureTargets: [expect.objectContaining({ unitId: 'daren' })] })
  })

  it('names, prisoners, deathLog, flags of every value type, quest states and the dungeon graph round-trip', () => {
    const dungeon = populatedVariants().find((v) => v.name.startsWith('inside a dungeon'))!.state
    const back = roundTrip(dungeon, env)
    expect(back.run?.mcName).toBe('Wren')
    expect(back.run?.companyName).toBe('The Ember Company')
    expect(back.run?.prisoners).toHaveLength(2)
    expect(back.run?.deathLog.map((d) => d.cause)).toEqual(['battle', 'starvation'])
    expect(back.run?.flags).toEqual(dungeon.run?.flags)
    expect(back.run?.questStates.sq_missing_caravan?.stage).toBe('__complete__')
    expect(back.run?.activeDungeon).toEqual(dungeon.run?.activeDungeon)
    expect(Object.keys(back.run?.activeDungeon?.cleared ?? {})).toHaveLength(3)
  })

  it('JSON.parse(JSON.stringify(state)) deep-equals the state for every fixture (types.ts pillar 2: no Set/Map/undefined)', () => {
    for (const { name, state } of populatedVariants()) {
      expect(JSON.parse(JSON.stringify(state)), name).toEqual(state)
    }
  })

  it('a populated save fits rules.save.maxBytes', () => {
    for (const { name, state } of populatedVariants()) {
      expect(serialize(toSaveFile(state, env)).length, name).toBeLessThanOrEqual(env.rules.save.maxBytes)
    }
  })

  it('parseSaveWith hands the invariant gate the HYDRATED state and reports its violations as reason schema', () => {
    const seen: string[] = []
    const result = parseSaveWith(serialize(toSaveFile(populatedRun(), env)), env, (state) => {
      seen.push(state.screen.kind)
      return ['turn.unitId is not living', 'gold < 0']
    })
    expect(seen).toEqual(['title'])
    expect(result).toEqual({ ok: false, reason: 'schema', detail: 'turn.unitId is not living; gold < 0' })
  })

  it('parseSave binds flow/invariants.ts#checkInvariants (throws TODO until WP-FLOW lands, never silently passes)', (ctx) => {
    const json = serialize(toSaveFile(populatedRun(), env))
    if (!flowLanded()) {
      expect(() => parseSave(json, env)).toThrow(/TODO\(flow\/invariants\)/)
      return ctx.skip()
    }
    expect(parseSave(json, env).ok).toBe(true)
  })

  it('parseMeta round-trips meta and every meta field is declared', () => {
    const json = JSON.stringify(META)
    const parsed = parseMeta(json)
    expect(parsed).toEqual({ ok: true, value: META })
    expect(Object.keys(META).sort()).toEqual(['audioMuted', 'gameStarted', 'runsLost', 'runsWon', 'totalRuns', 'tutorialSeen'])
  })
})
