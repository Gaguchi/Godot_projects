/**
 * GATE1-01/02 — the SWEEP the legality gate exists for, as a test.
 *
 * `flow/legality.ts` is the single truth behind a disabled control and a reducer refusal (ARCHITECTURE §5,
 * CONTRACT §4). Nothing asserted the two halves agree: `legality.test.ts` reads one row at a time by hand, so
 * three actions shipped where `isLegal` said "ok" and the reducer then refused — `town/innHeal` at full HP,
 * `town/turnInAllPrisoners` with an empty wagon, `combat/enterCapture` with no foe in reach. Each was reachable
 * from a shipped fixture, and each meant a lit control that did nothing when pressed.
 *
 * The sweep is every screen fixture × two seeds × its RESOURCE variants (wounded, broke, starving and the
 * combinations — 0116) × EVERY parameterless action, in both directions:
 *   ok      ⇒ `reduce` emits no `refused`  (nothing is offered that the engine will then decline)
 *   not ok  ⇒ `reduce` returns the SAME reference plus exactly one `refused` carrying that same sentence
 *
 * The action list is read out of `actions.ts` itself rather than typed here, so a new parameterless action joins
 * the sweep the day it is declared — a hand-kept list is how the first three slipped through.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Action, ActionType } from '../../../../src/engine/actions'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { isLegal } from '../../../../src/engine/flow/legality'
import { reduce } from '../../../../src/engine/reducer'
import type { GameState, ScreenKind } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'

const SCREENS: readonly ScreenKind[] = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver']
const SEEDS: readonly number[] = [7, 21]

/** Every `{ readonly type: '…' }` member of the Action union — the ones `isLegal` can answer with no argument. */
function parameterlessActions(): readonly ActionType[] {
  const src = readFileSync(fileURLToPath(new URL('../../../../src/engine/actions.ts', import.meta.url)), 'utf8')
  const found = [...src.matchAll(/\{ readonly type: '([^']+)' \}/g)].map((m) => m[1] as ActionType)
  return [...new Set(found)]
}

/** A fixture, plus the derived states that reach the rules the table pulls in (0036 / 0052 / 0089). */
function statesUnderTest(): { readonly label: string; readonly state: GameState }[] {
  const out: { readonly label: string; readonly state: GameState }[] = []
  for (const seed of SEEDS) {
    for (const kind of SCREENS) {
      const state = fixtureFor(kind, seed, env)
      out.push({ label: `${kind}@${seed}`, state })
      const run = state.run
      if (run !== null) {
        // Every screen the run reaches gets its RESOURCES swept, not only the two whose rules were known to read
        // them: the audit used to be fixture-shaped, and the shipped fixtures all carry rations and gold, so the
        // camp's food gate hid behind a full satchel for as long as it existed (RE-GATE C 3.1).
        const party = Object.fromEntries(Object.entries(run.party).map(([id, u]) => [id, { ...u, hp: { ...u.hp, current: 1 } }]))
        out.push({ label: `${kind}@${seed}+wounded`, state: { ...state, run: { ...run, party } } })
        out.push({ label: `${kind}@${seed}+broke`, state: { ...state, run: { ...run, gold: 0 } } })
        out.push({ label: `${kind}@${seed}+wounded+broke`, state: { ...state, run: { ...run, party, gold: 0 } } })
        out.push({ label: `${kind}@${seed}+starving`, state: { ...state, run: { ...run, bag: [] } } })
        out.push({ label: `${kind}@${seed}+wounded+starving`, state: { ...state, run: { ...run, party, bag: [] } } })
        out.push({ label: `${kind}@${seed}+wounded+broke+starving`, state: { ...state, run: { ...run, party, gold: 0, bag: [] } } })
      }
      const combat = state.combat
      if (combat !== null && kind === 'combat') {
        const active = combat.units[combat.turn.unitId]
        if (active !== undefined) {
          // the two arming verbs, in the states that make them pointless: the free move spent, and no AP left
          out.push({ label: `${kind}@${seed}+moved`, state: { ...state, combat: { ...combat, units: { ...combat.units, [active.id]: { ...active, hasMovedThisTurn: true } } } } })
          out.push({ label: `${kind}@${seed}+spent`, state: { ...state, combat: { ...combat, units: { ...combat.units, [active.id]: { ...active, ap: 0 } } } } })
        }
      }
    }
  }
  return out
}

describe('legality is the single truth behind the control and the refusal', () => {
  const actions = parameterlessActions()

  it('reads a real action list out of actions.ts', () => {
    // A guard on the guard: if the regex ever stops matching, the sweep below would pass by testing nothing.
    expect(actions.length).toBeGreaterThan(20)
    for (const t of ['town/innHeal', 'town/turnInAllPrisoners', 'combat/enterCapture', 'combat/enterMove', 'camp/rest', 'camp/scout', 'dungeon/leave']) {
      expect(actions, `${t} must be in the sweep`).toContain(t)
    }
  })

  it('every screen × seed × parameterless action: ok ⇒ the reducer does NOT refuse', () => {
    const breaches: string[] = []
    for (const { label, state } of statesUnderTest()) {
      for (const type of actions) {
        const action = { type } as Action
        if (!isLegal(state, action, env).ok) continue
        const refused = reduce(state, action, env).effects.filter((e) => e.kind === 'refused')
        for (const r of refused) breaches.push(`${label} · ${type}: legal, then refused — ${r.kind === 'refused' ? r.reason : ''}`)
      }
    }
    expect(breaches).toEqual([])
  })

  it('every screen × seed × parameterless action: not ok ⇒ the same state and that same sentence', () => {
    const breaches: string[] = []
    for (const { label, state } of statesUnderTest()) {
      for (const type of actions) {
        const action = { type } as Action
        const verdict = isLegal(state, action, env)
        if (verdict.ok) continue
        const result = reduce(state, action, env)
        if (result.state !== state) breaches.push(`${label} · ${type}: refused but the state moved`)
        if (result.effects.length !== 1) breaches.push(`${label} · ${type}: ${result.effects.length} effects, expected exactly one refusal`)
        const only = result.effects[0]
        if (only === undefined || only.kind !== 'refused' || only.reason !== verdict.reason || only.action !== type) {
          breaches.push(`${label} · ${type}: the refusal does not carry the gate's own sentence (${verdict.reason})`)
        }
      }
    }
    expect(breaches).toEqual([])
  })

  it('no refusal reason the player can read is Title Case, machine-cased or ends in a stop (§5.1)', () => {
    // The one exception is the combat reducer's own rule-level codes, which never pass through `isLegal` — those
    // are GATE3-04's, not this gate's. Everything the TABLE answers with is prose.
    const seen = new Set<string>()
    for (const { state } of statesUnderTest()) {
      for (const type of actions) {
        const verdict = isLegal(state, { type } as Action, env)
        if (!verdict.ok) seen.add(verdict.reason)
      }
    }
    expect(seen.size).toBeGreaterThan(10)
    for (const reason of seen) {
      expect(reason, `"${reason}" must not end in a full stop`).not.toMatch(/\.$/)
      expect(reason, `"${reason}" must not open in Title Case`).not.toMatch(/^[A-Z][a-z]/)
      expect(reason, `"${reason}" must not be a camelCase code`).not.toMatch(/^[a-z]+[A-Z]/)
    }
  })
})
