import { z } from 'zod'

export const RegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected hex color like #1a2b3c'),
  tier: z.number().int().min(1).max(3),
})
