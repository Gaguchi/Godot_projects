import { z } from 'zod'

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['food', 'potion']),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  region: z.enum(['borderlands', 'thornwood', 'ashfall', 'none']),
  gridSize: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  }),
  buyPrice: z.number().int().min(0),
  sellPrice: z.number().int().min(0),
})
