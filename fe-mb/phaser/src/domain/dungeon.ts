/**
 * GP-F1: One per dungeon node on the overworld. Drives seedDungeonBattle
 * and theming for the room generator.
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
}
