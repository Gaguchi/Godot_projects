import type { Predicate } from './predicate'

/**
 * Town definition. One per town node on the overworld. Drives the TownScene
 * panels (Inn / Shop / Tavern / Camp / Arena).
 */
export interface TavernQuestEntry {
  questId: string
  npcName: string
  npcDescription: string
  dialogueId: string
  visibleIf?: Predicate
}

/**
 * A recruitable unit listed at this town's tavern. Cost is derived from
 * classId + level via `recruitmentCost()` unless `costOverride` is set.
 */
export interface TavernRecruitEntry {
  id: string             // stable id for this recruit slot (so a recruited slot stays gone across visits)
  name: string
  classId: string
  level: number
  description?: string
  costOverride?: number
  visibleIf?: Predicate
}

export interface TownDef {
  id: string
  name: string
  description: string
  regionId?: string
  /** Cost to heal one wounded unit at the inn. */
  innHealCostPerUnit: number
  /** Item ids the shop stocks (filtered to consumables after GP-A1). */
  shopStockIds: string[]
  /** Tavern rumor strings (3-4 per Godot town). */
  rumors: string[]
  /** Tavern quest NPCs. */
  tavernQuests: TavernQuestEntry[]
  /** Recruits available at the tavern. Optional — older content omits it. */
  recruits?: TavernRecruitEntry[]
  /** Whether the blacksmith panel is unlocked at this town. */
  blacksmithEnabled: boolean
  /** Arena lock state (always locked through parity pass; flavor text varies). */
  arenaLocked: boolean
  arenaLockedText?: string
}
