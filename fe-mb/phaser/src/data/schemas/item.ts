import { z } from 'zod'
import { WeaponTypeSchema } from './card'

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['weapon_1h','weapon_2h','shield','tome','staff','quiver','consumable']),
  weaponType: WeaponTypeSchema.optional(),
  rarity: z.enum(['common','uncommon','rare','epic','legendary']),
  region: z.enum(['borderlands','thornwood','ashfall','none']),
  gearCards: z.array(z.string()),
  quiverModifier: z.object({
    kind: z.enum(['poison','burn','slow','thunder','explosive']),
    value: z.number(),
    turns: z.number().int().optional(),
  }).optional(),
  isTwoHanded: z.boolean(),
  gridSize: z.object({ width: z.number().int().min(1), height: z.number().int().min(1) }),
  range: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }).optional(),
  buyPrice: z.number().int().min(0),
  sellPrice: z.number().int().min(0),
})
