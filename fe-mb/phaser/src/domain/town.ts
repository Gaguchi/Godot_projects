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
  /** Whether the blacksmith panel is unlocked at this town. */
  blacksmithEnabled: boolean
  /** Arena lock state (always locked through parity pass; flavor text varies). */
  arenaLocked: boolean
  arenaLockedText?: string
}
