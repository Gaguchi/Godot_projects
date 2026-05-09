import type { EncounterTable, EncounterEntry, EncounterOutcome } from '../domain/encounter'
import type { Predicate } from '../domain/predicate'
import type { PredicateState } from './predicates'
import { evaluatePredicate } from './predicates'
import type { RNG } from '../domain/rng'

/**
 * Pick an outcome from an EncounterTable using:
 *  1. predicate filter — entry must satisfy ALL conditions
 *  2. one-shot filter — entries already in `oneShotsFired` are excluded
 *  3. weighted random — `rng.next()` * sum of weights → pick
 *
 * Returns null if no eligible entry remains.
 */
export interface EncounterRollResult {
  entryId: string
  outcome: EncounterOutcome
  oneShot: boolean
}

function entryEligible(
  entry: EncounterEntry,
  state: PredicateState,
  oneShotsFired: ReadonlySet<string>,
): boolean {
  if (entry.oneShot && oneShotsFired.has(entry.id as unknown as string)) return false
  for (const cond of entry.conditions) {
    if (!evaluatePredicate(cond as Predicate, state)) return false
  }
  return true
}

export function rollEncounter(
  table: EncounterTable,
  state: PredicateState,
  oneShotsFired: ReadonlySet<string>,
  rng: RNG,
): EncounterRollResult | null {
  const eligible = table.entries.filter((e) => entryEligible(e, state, oneShotsFired))
  if (eligible.length === 0) return null

  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0)
  if (totalWeight <= 0) return null

  let r = rng.next() * totalWeight
  for (const entry of eligible) {
    r -= entry.weight
    if (r <= 0) {
      return {
        entryId: entry.id as unknown as string,
        outcome: entry.outcome,
        oneShot: entry.oneShot,
      }
    }
  }
  // Fallback (rounding edge)
  const last = eligible[eligible.length - 1]!
  return {
    entryId: last.id as unknown as string,
    outcome: last.outcome,
    oneShot: last.oneShot,
  }
}
