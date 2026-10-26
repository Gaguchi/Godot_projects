import { z } from 'zod'
import { IdSchema, UnitStatsSchema } from './common'
import { WeaponClassSchema } from './item'

/** No growthRates: progression is gear, not levels (brief §2.13). */
export const ClassSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    baseStats: UnitStatsSchema,
    startingHp: z.number().int().min(1),
    startingMov: z.number().int().min(1),
    /** 4-5 innate cards; always in the deck regardless of gear. */
    innateCardIds: z.array(IdSchema).min(2).max(5),
    /**
     * What this chassis is TRAINED to hold — `run/equipment.ts#canHold` refuses every other hand-slot item, and a
     * quiver rides `rules.gear.quiverPairsWith` (an archer's kit, so it needs the bow). DECISIONS removed the
     * weapon TRIANGLE; that was never the same as no restriction at all, and without one a Mage held a tower
     * shield and a Lord a tome while the game's own vocabulary promised otherwise (RE-GATE C 3.13).
     * Empty is legal and means exactly what it says — a wolf holds nothing.
     */
    weaponClasses: z.array(WeaponClassSchema),
  })
  .strict()
export type ClassDef = z.infer<typeof ClassSchema>
