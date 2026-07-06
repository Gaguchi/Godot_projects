import { z } from 'zod'

export const QuiverModifierSchema = z.object({
  kind: z.enum(['poison', 'slow', 'thunder', 'explosive']),
  value: z.number().int().min(1),
  turns: z.number().int().min(0),
})

/** Gear kinds that must contribute cards (quiver contributes none). */
const CARD_BEARING_KINDS = new Set(['weapon', 'shield', 'tome', 'staff'])

export const ItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['food', 'potion', 'weapon', 'shield', 'quiver', 'tome', 'staff']),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    region: z.enum(['borderlands', 'thornwood', 'ashfall', 'none']),
    gridSize: z.object({
      width: z.number().int().min(1),
      height: z.number().int().min(1),
    }),
    buyPrice: z.number().int().min(0),
    sellPrice: z.number().int().min(0),
    weaponClass: z
      .enum(['sword', 'lance', 'axe', 'bow', 'crossbow', 'dagger', 'greatsword', 'tome', 'staff', 'shield'])
      .optional(),
    twoHanded: z.boolean().optional(),
    gearCardIds: z.array(z.string()).min(1).optional(),
    quiverModifier: QuiverModifierSchema.optional(),
  })
  .superRefine((item, ctx) => {
    if (CARD_BEARING_KINDS.has(item.kind) && (item.gearCardIds?.length ?? 0) === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gearCardIds'],
        message: `${item.kind} '${item.id}' must contribute at least one gear card`,
      })
    }
    if (item.kind === 'quiver' && item.gearCardIds !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gearCardIds'],
        message: `quiver '${item.id}' must not contribute cards (quivers modify bow cards)`,
      })
    }
    if (item.quiverModifier !== undefined && item.kind !== 'quiver') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quiverModifier'],
        message: `only quivers may carry a quiverModifier ('${item.id}' is ${item.kind})`,
      })
    }
  })
