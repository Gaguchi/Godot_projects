import { z } from 'zod'

export const DungeonDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  regionId: z.string(),
  floors: z.number().int().min(1),
  theme: z.string(),
  combatEnemyGroupId: z.string(),
  eliteEnemyGroupId: z.string(),
  bossEnemyGroupId: z.string(),
})
