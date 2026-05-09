import type { Predicate } from './predicate'

/**
 * One entry in an encounter table. Filtered by `conditions` (all must pass),
 * then weighted-randomly picked among the eligible. `oneShot` means after
 * firing once, the entry is excluded from future rolls.
 */
export type EncounterId = string & { readonly __brand: 'EncounterId' }
export const asEncounterId = (s: string): EncounterId => s as EncounterId

export type EncounterOutcome =
  | { kind: 'dialogue'; dialogueId: string }
  | { kind: 'battle'; enemyGroupId: string; captureTargets?: CaptureTarget[] }

export interface CaptureTarget {
  unitName: string
  capturedDialogueId: string
  killedDialogueId: string
  capturedFlag: string
  killedFlag: string
}

export interface EncounterEntry {
  id: EncounterId
  weight: number
  oneShot: boolean
  conditions: Predicate[]
  outcome: EncounterOutcome
}

export interface EncounterTable {
  id: string
  /** Optional region anchor — for region-specific tables. */
  regionId?: string
  entries: EncounterEntry[]
}

/**
 * Enemy group template used by both travel-encounter battles and dungeon
 * combats. Members expand to N units of the given class at the given level.
 */
export interface EnemyGroupMember {
  name: string
  classId: string
  level: number
  count: number
  /** When true, this member is a capture target (Daren etc.). */
  isCaptureTarget?: boolean
  bountyValue?: number
}

export interface EnemyGroup {
  id: string
  name: string
  members: EnemyGroupMember[]
}
