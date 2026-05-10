import type { ClassId, UnitId } from './ids'

export type StatKey = 'str' | 'mag' | 'skl' | 'spd' | 'def' | 'res' | 'lck'

/**
 * Discriminated union for all check kinds.
 *   - stat: per-unit attribute test (one party member must meet threshold)
 *   - class: any living party member of this class enables the choice
 *   - gold / food: party-wide resource thresholds
 *
 * Resolved by `systems/checkResolver.evaluateCheck`.
 */
export type CheckRequirement =
  | { kind: 'stat'; stat: StatKey; threshold: number }
  | { kind: 'class'; classId: ClassId }
  | { kind: 'gold'; amount: number }
  | { kind: 'food'; amount: number }

export interface CheckAttempt {
  requirement: CheckRequirement
  attemptingUnitId: UnitId | null
  passed: boolean
}

export interface CheckCandidate {
  unitId: UnitId
  unitName: string
  classId: ClassId
  statValue: number
  meetsThreshold: boolean
}
