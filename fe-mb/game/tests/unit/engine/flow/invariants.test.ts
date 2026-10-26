/**
 * flow/invariants.ts — the structural rules as runtime checks, and their second caller, `save/codec.ts#parseSave`:
 * a shape-valid but slot-inconsistent file fails BY NAME instead of letting the first selector throw.
 */
import { describe, expect, it } from 'vitest'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { assertInvariants, checkInvariants } from '../../../../src/engine/flow/invariants'
import { initialState } from '../../../../src/engine/flow/lifecycle'
import { parseSave, serialize, toSaveFile } from '../../../../src/engine/save/codec'
import type { CombatState, GameState, ScreenKind } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'

const SEED = 7
const at = (kind: ScreenKind): GameState => fixtureFor(kind, SEED, env)
const violations = (s: GameState): readonly string[] => checkInvariants(s, env)

describe('invariants — every fixture is clean', () => {
  const kinds: readonly ScreenKind[] = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver']
  for (const kind of kinds) {
    it(`${kind} satisfies every rule`, () => {
      expect(violations(at(kind))).toEqual([])
    })
  }
})

describe('invariants — screen and ledger', () => {
  it('a title screen carrying a ledger is named', () => {
    const won = at('win')
    expect(violations({ ...won, screen: { kind: 'title' } })).toContain('title screen with a ledger')
  })

  it('a ledger outside win/gameOver is named', () => {
    const map = at('overworld')
    const won = at('win')
    expect(violations({ ...map, ledger: won.ledger })).toContain('ledger must be set exactly on win/gameOver')
  })

  it('a screen the slots do not imply is named', () => {
    const map = at('overworld')
    const out = violations({ ...map, screen: { kind: 'town' } })
    expect(out.some((v) => v.startsWith("screen 'town'"))).toBe(true)
  })
})

describe('invariants — a finished battle is never a stored state', () => {
  it('checkInvariants names a persisted combat whose phase is not `combat`', () => {
    const battle = at('combat')
    const combat = battle.combat
    if (combat === null) throw new Error('fixture: no battle')
    const ended: CombatState = { ...combat, phase: 'victory' }
    expect(violations({ ...battle, combat: ended, screen: { kind: 'title' } })).toContain("a battle in phase 'victory' was stored instead of resolved")
  })

  it('parseSave rejects such a file by name instead of paying it out on the next action', () => {
    const battle = at('combat')
    const combat = battle.combat
    if (combat === null) throw new Error('fixture: no battle')
    const parked: GameState = { ...battle, combat: { ...combat, phase: 'victory' }, screen: { kind: 'title' } }
    const parsed = parseSave(serialize(toSaveFile(parked, env)), env)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toBe('schema')
    expect(parsed.detail).toMatch(/phase 'victory'/)
    // …while the honest mid-battle save of the very same fixture still loads
    expect(parseSave(serialize(toSaveFile(battle, env)), env).ok).toBe(true)
  })
})

describe('invariants — defeat is terminal', () => {
  it('a run whose party is all dead outside combat is named', () => {
    const map = at('overworld')
    const run = map.run
    if (run === null) throw new Error('fixture: no run')
    const dead = { ...run, party: Object.fromEntries(Object.entries(run.party).map(([id, u]) => [id, { ...u, hp: { ...u.hp, current: 0 } }])) }
    const out = violations({ ...map, run: dead })
    expect(out).toContain('a run with no living unit')
  })
})

describe('assertInvariants', () => {
  it('throws with every violation listed', () => {
    const won = at('win')
    expect(() => assertInvariants({ ...won, screen: { kind: 'title' } }, env)).toThrow(/title screen with a ledger/)
    expect(() => assertInvariants(initialState(), env)).not.toThrow()
  })
})

describe('invariants — the round ledger (0115)', () => {
  it('names a combat whose turn.acted lost the acting unit, or names a stranger', () => {
    const battle = at('combat')
    const combat = battle.combat
    if (combat === null) throw new Error('the combat fixture has no battle')
    expect(violations(battle)).toEqual([])
    const emptied: GameState = { ...battle, combat: { ...combat, turn: { ...combat.turn, acted: [] } } }
    expect(violations(emptied)).toContain(`turn.acted does not hold the acting unit '${combat.turn.unitId}'`)
    const stranger: GameState = { ...battle, combat: { ...combat, turn: { ...combat.turn, acted: [...combat.turn.acted, 'nobody'] } } }
    expect(violations(stranger)).toContain("turn.acted names 'nobody', who is not in this battle")
  })
})
