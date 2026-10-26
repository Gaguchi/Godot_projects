/**
 * flow/fixtures.ts — the `?screen=` seeds (CONTRACT §10). `fixtureFor` reaches every `ScreenKind`, every fixture
 * is a state the REAL reducer could have produced (invariant-clean, save-round-trippable), and the same seed
 * always yields the same state — otherwise a Playwright failure is not reproducible.
 */
import { describe, expect, it } from 'vitest'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { checkInvariants } from '../../../../src/engine/flow/invariants'
import { overlayOf, resumeScreen } from '../../../../src/engine/flow/pump'
import { fromSaveFile, parseSave, serialize, toSaveFile } from '../../../../src/engine/save/codec'
import { firstDivergence } from '../../../../src/engine/save/replay'
import type { ScreenKind } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'

const KINDS: readonly ScreenKind[] = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver']
const SEEDS = [1, 3, 7, 11] as const

describe('fixtureFor reaches every ScreenKind', () => {
  for (const kind of KINDS) {
    it(`${kind}: the screen is the one asked for, and the slots agree`, () => {
      const s = fixtureFor(kind, 7, env)
      expect(s.screen.kind).toBe(kind)
      expect(s.screen.kind === 'title' || s.screen.kind === resumeScreen(s)).toBe(true)
      expect(checkInvariants(s, env)).toEqual([])
    })
  }
})

describe('fixtures are real states', () => {
  it('every kind × seed round-trips through the save codec unchanged', () => {
    for (const kind of KINDS) {
      for (const seed of SEEDS) {
        const s = fixtureFor(kind, seed, env)
        const parsed = parseSave(serialize(toSaveFile(s, env)), env)
        expect(parsed.ok, `${kind}@${seed}: ${parsed.ok ? '' : parsed.detail}`).toBe(true)
        if (!parsed.ok) continue
        const back = fromSaveFile(parsed.value)
        // `fromSaveFile` normalises screen/ledger/ui by contract; the persisted slices must be identical
        expect(firstDivergence({ ...back, screen: s.screen, ledger: s.ledger }, { ...s, ui: back.ui }), `${kind}@${seed}`).toBeNull()
      }
    }
  })

  it('the same seed builds the same state twice (Playwright reproducibility)', () => {
    for (const kind of KINDS) {
      expect(firstDivergence(fixtureFor(kind, 3, env), fixtureFor(kind, 3, env)), kind).toBeNull()
    }
  })

  it('the fixtures a player can act on are quiescent or hold exactly the overlay they advertise', () => {
    expect(overlayOf(fixtureFor('prologue', 7, env))?.kind).toBe('dialogue')
    expect(overlayOf(fixtureFor('overworld', 7, env))).toBeNull()
    expect(fixtureFor('battleEnd', 7, env).run?.lastBattle).not.toBeNull()
    expect(fixtureFor('combat', 7, env).combat?.phase).toBe('combat')
    expect(fixtureFor('dungeon', 7, env).run?.activeDungeon).not.toBeNull()
    expect(fixtureFor('town', 7, env).run?.town).not.toBeNull()
    expect(fixtureFor('camp', 7, env).run?.camp).not.toBeNull()
    expect(fixtureFor('win', 7, env).ledger?.outcome).toBe('won')
    expect(fixtureFor('gameOver', 7, env).ledger?.outcome).toBe('lost')
  })
})
