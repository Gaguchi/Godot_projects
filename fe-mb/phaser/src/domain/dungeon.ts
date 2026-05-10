import type { CheckEventDef } from './encounter'

/**
 * GP-F1: One per dungeon node on the overworld. Drives seedDungeonBattle
 * and theming for the room generator.
 *
 * SC-9 adds roomEvents: pool of CheckEventDefs the dungeon generator picks
 * from when assigning an `event` room. Empty array → event rooms fall back
 * to the legacy stub.
 */
export interface DungeonDef {
  id: string
  name: string
  regionId: string
  /** Number of floors (Godot defaults to 3). */
  floors: number
  theme: string
  combatEnemyGroupId: string
  eliteEnemyGroupId: string
  bossEnemyGroupId: string
  roomEvents?: CheckEventDef[]
}
