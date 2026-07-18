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
  | { kind: 'checkEvent'; event: CheckEventDef }

/**
 * Static event-card data: title + description + choices, each with optional
 * stat/class/gold/food check and pass/fail outcomes. Mirrors the runtime
 * shape consumed by `<CheckEventModal>` (deliberately structural — no domain
 * branding so JSON parses straight into the runtime).
 */
export interface CheckEventDef {
  id: string
  title: string
  description: string
  choices: CheckEventChoiceDef[]
}

export interface CheckEventChoiceDef {
  id: string
  text: string
  check?: import('./check').CheckRequirement
  onPass: { narration: string; effects: import('./quest').QuestEffect[] }
  onFail?: { narration: string; effects: import('./quest').QuestEffect[] }
}

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
  /** Stable unit id ('daren', 'wolf'). Seeders use it verbatim (count 1) or
   *  `_N`-suffixed (packs); drives sprite lookup + quest capturedIds.
   *  Omitted → generated `<groupId>_<idx>` id, class-fallback art. */
  id?: string
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
  /**
   * SC-10: post-victory check-event id. When set, the BattleEndModal mounts
   * the referenced CheckEventModal first, then proceeds to victory UI.
   */
  victoryEvent?: string
}
