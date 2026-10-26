/**
 * Naming data (brief §2.16 "Naming": two strings on the run, never baked into `Unit.name`; the MC placeholder
 * before the guild beat). The `run/setMcName` reducer path and the save round-trip belong to WP-FLOW / WP-SAVE;
 * this file pins the data shape they rely on.
 */
import { describe, expect, it } from 'vitest'
import { reduce } from '../../../../src/engine/reducer'
import { initialState } from '../../../../src/engine/flow/lifecycle'
import { NAME_EMPTY, NAME_IS_THE_OTHER, NAME_TAKEN, canTakeName } from '../../../../src/engine/run/naming'
import { MC_ID, displayName } from '../../../../src/engine/run/party'
import { isLegal } from '../../../../src/engine/flow/legality'
import type { GameState } from '../../../../src/engine/types'
import { env, newRun } from '../../../helpers/runs'

describe('naming', () => {
  it('a new run starts unnamed: mcName and companyName are null', () => {
    const run = newRun()
    expect(run.mcName).toBeNull()
    expect(run.companyName).toBeNull()
  })

  it("displayName renders the MC's content placeholder before naming and run.mcName after", () => {
    const run = newRun()
    const mc = run.party[MC_ID]!
    const placeholder = env.content.characters[MC_ID]!.displayName
    expect(displayName(mc, run)).toBe(placeholder)
    expect(displayName(mc, { mcName: 'Tamar' })).toBe('Tamar')
  })

  it('displayName never applies mcName to a companion', () => {
    const run = newRun()
    for (const id of run.partyOrder.filter((x) => x !== MC_ID)) {
      const u = run.party[id]!
      expect(displayName(u, { mcName: 'Tamar' })).toBe(u.name)
    }
  })

  it('the name lives on the run, not the unit: naming leaves every Unit untouched (save-shape invariant)', () => {
    const run = newRun()
    const named = { ...run, mcName: 'Tamar', companyName: 'The Ember March' }
    expect(named.party).toBe(run.party)
    for (const u of Object.values(named.party)) expect(Object.keys(u)).not.toContain('mcName')
    expect(displayName(named.party[MC_ID]!, named)).toBe('Tamar')
  })
})

/**
 * FINAL GATE C 3.15 — the one name the game must not be given is the one it invites the player to write.
 * A run-2 lord named "Mercer Kaine" put `party: A Mercer Kaine hp 73/73` above `enemy: b Mercer Kaine hp 265/265`
 * on the final board, and the Field Report and the ledger carried the one string for both sides.
 */
describe('a name the cast already answers to is refused', () => {
  const run = newRun()

  it("the authored warlord's name cannot be worn by the player's lord", () => {
    const warlord = env.content.characters['mercer_kaine']!.displayName
    expect(warlord).toBe('Mercer Kaine')
    expect(canTakeName(run, 'mc', warlord, env)).toEqual({ ok: false, reason: NAME_TAKEN })
    // …however it is typed: the collision is on the NAME, not on the keystrokes
    expect(canTakeName(run, 'mc', '  mercer   kaine ', env).ok).toBe(false)
    expect(canTakeName(run, 'company', 'MERCER KAINE', env).ok).toBe(false)
  })

  it('every other authored face is spoken for too, and nothing else is', () => {
    for (const c of Object.values(env.content.characters)) {
      if (c.id === MC_ID) continue
      expect(canTakeName(run, 'mc', c.displayName, env).ok, c.id).toBe(false)
    }
    // the foundling's own placeholder is the player's stand-in, not somebody else's face
    expect(canTakeName(run, 'mc', env.content.characters[MC_ID]!.displayName, env).ok).toBe(true)
    expect(canTakeName(run, 'mc', 'Verity Locke', env).ok).toBe(true)
    expect(canTakeName(run, 'company', 'The Ninth Lantern', env).ok).toBe(true)
  })

  it('the company and its captain may not be one word', () => {
    const named = { ...run, mcName: 'Verity Locke' }
    expect(canTakeName(named, 'company', 'verity locke', env)).toEqual({ ok: false, reason: NAME_IS_THE_OTHER })
    expect(canTakeName(named, 'company', 'The Ninth Lantern', env).ok).toBe(true)
  })

  it('empty is still the first reason', () => {
    expect(canTakeName(run, 'mc', '   ', env)).toEqual({ ok: false, reason: NAME_EMPTY })
  })

  it('every refusal reads as a §5.1 reason: a lowercase fragment with no terminal stop', () => {
    for (const reason of [NAME_EMPTY, NAME_TAKEN, NAME_IS_THE_OTHER]) {
      expect(reason).toMatch(/^[a-z]/)
      expect(reason).not.toMatch(/[.!?]$/)
    }
  })

  /** The gate and the reducer are ONE rule: the slip goes unlit with the sentence the press would have been
   *  refused with, and a refused press returns the SAME state reference plus exactly one `refused`. */
  it('the flow gate and the reducer refuse the collision with one sentence', () => {
    const base = initialState()
    const state: GameState = { ...base, screen: { kind: 'overworld' }, run: { ...run, pendingNamePrompt: { target: 'mc' } } }
    const gate = isLegal(state, { type: 'name/submit', name: 'Mercer Kaine' }, env)
    expect(gate).toEqual({ ok: false, reason: NAME_TAKEN })
    const out = reduce(state, { type: 'name/submit', name: 'Mercer Kaine' }, env)
    expect(out.state).toBe(state)
    expect(out.effects).toEqual([{ kind: 'refused', action: 'name/submit', reason: NAME_TAKEN }])
    // and the name the player may have goes through both doors
    expect(isLegal(state, { type: 'name/submit', name: 'Verity Locke' }, env).ok).toBe(true)
    expect(reduce(state, { type: 'name/submit', name: 'Verity Locke' }, env).state.run?.mcName).toBe('Verity Locke')
  })

  it('the other naming door — run/setMcName — is held to the same rule', () => {
    const base = initialState()
    const state: GameState = { ...base, screen: { kind: 'overworld' }, run }
    expect(isLegal(state, { type: 'run/setMcName', name: 'Mercer Kaine' }, env)).toEqual({ ok: false, reason: NAME_TAKEN })
    const out = reduce(state, { type: 'run/setMcName', name: 'Mercer Kaine' }, env)
    expect(out.state).toBe(state)
    expect(out.effects).toEqual([{ kind: 'refused', action: 'run/setMcName', reason: NAME_TAKEN }])
  })
})
