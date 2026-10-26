/**
 * run/naming.ts — the two names the PLAYER writes (the foundling's, and the company's), and the one rule they owe
 * the rest of the cast: they must not already belong to somebody.
 *
 * FINAL GATE C 3.15: `name/submit` accepted any non-empty string, so a player who named their lord after the
 * project's own warlord read `party: A Mercer Kaine hp 73/73` above `enemy: b Mercer Kaine hp 265/265` on the
 * final board, with the Field Report and the ledger carrying the same string for both sides. One name per thing
 * (ARCHITECTURE §5.1) binds the names the player supplies too — the game cannot enforce it on the cast and then
 * hand the player the one name it must not be given.
 *
 * The rule lives here, beside the state it protects, and is read by `flow/legality.ts` AND by the reducer, so the
 * slip's Set button carries the sentence the reducer would refuse with rather than swallowing the press
 * (`canCampRest` / `canInnHeal` shape, CONTRACT-CHANGES 0089/0116).
 */
import type { Legality } from '../actions'
import type { EngineEnv, RunState } from '../types'
import { MC_ID } from './party'

/** §5.1 refusal voice: a lowercase fragment completing an implied "because …", no terminal stop. */
export const NAME_EMPTY = 'a name cannot be empty'
export const NAME_TAKEN = 'someone on these roads already answers to that'
/** The banner and the person under it are two things, so they may not be one word. */
export const NAME_IS_THE_OTHER = 'the company and its captain need different names'

/** Fold to the form a collision is judged on: trimmed, case- and space-insensitive. */
function key(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Every name already spoken for. The foundling's own placeholder is NOT among them — "The Foundling" is what the
 * game calls the player before they answer, so choosing it is choosing your own stand-in, not stealing a face.
 */
function spokenFor(env: EngineEnv): ReadonlySet<string> {
  const taken = new Set<string>()
  for (const c of Object.values(env.content.characters)) {
    if (c.id === MC_ID) continue
    taken.add(key(c.displayName))
  }
  return taken
}

/**
 * Whether the player may write `name` into `target`. Empty first (the slip's own first reason), then the cast,
 * then the other half of the pair the player has already written.
 */
export function canTakeName(run: RunState, target: 'mc' | 'company', name: string, env: EngineEnv): Legality {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { ok: false, reason: NAME_EMPTY }
  const k = key(trimmed)
  if (spokenFor(env).has(k)) return { ok: false, reason: NAME_TAKEN }
  const other = target === 'mc' ? run.companyName : run.mcName
  if (other !== null && key(other) === k) return { ok: false, reason: NAME_IS_THE_OTHER }
  return { ok: true }
}
