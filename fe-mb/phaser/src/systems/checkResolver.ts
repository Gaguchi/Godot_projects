import type { CheckRequirement, CheckCandidate, StatKey } from '../domain/check'
import type { Unit } from '../domain/unit'

export interface PartyState {
  gold: number
  foodCount: number
  party: Unit[]
}

/**
 * Evaluate whether a check requirement is met. Pure function.
 *
 *   - stat: passes iff `attemptingUnit` is alive and its stat ≥ threshold.
 *   - class: passes iff any LIVING party member has that classId.
 *   - gold/food: party-wide resource thresholds.
 *
 * For class/gold/food, `attemptingUnit` is ignored (pass null).
 */
export function evaluateCheck(
  req: CheckRequirement,
  attemptingUnit: Unit | null,
  partyState: PartyState,
): boolean {
  switch (req.kind) {
    case 'stat':
      return attemptingUnit !== null
        && attemptingUnit.hp.current > 0
        && attemptingUnit.stats[req.stat] >= req.threshold
    case 'class':
      return partyState.party.some(
        (u) => u.hp.current > 0
          && (u.classId as unknown as string) === (req.classId as unknown as string),
      )
    case 'gold':
      return partyState.gold >= req.amount
    case 'food':
      return partyState.foodCount >= req.amount
  }
}

/**
 * Build the list of candidates for a stat check. Living party members only,
 * sorted by stat value descending (best candidate first). Each entry tags
 * whether that unit meets the threshold so the picker can render ✓/✗.
 *
 * Returns `[]` for non-stat checks (those don't need a picker).
 */
export function getCheckCandidates(req: CheckRequirement, party: Unit[]): CheckCandidate[] {
  if (req.kind !== 'stat') return []
  const stat: StatKey = req.stat
  const candidates: CheckCandidate[] = party
    .filter((u) => u.hp.current > 0)
    .map((u) => ({
      unitId: u.id,
      unitName: u.name,
      classId: u.classId,
      statValue: u.stats[stat],
      meetsThreshold: u.stats[stat] >= req.threshold,
    }))
  candidates.sort((a, b) => b.statValue - a.statValue)
  return candidates
}
