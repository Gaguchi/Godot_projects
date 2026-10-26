import { z } from 'zod'
import { IdSchema } from './common'

export const RaritySchema = z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary'])
export type Rarity = z.infer<typeof RaritySchema>

export const ItemKindSchema = z.enum(['food', 'potion', 'weapon', 'shield', 'quiver', 'tome', 'staff'])
export type ItemKind = z.infer<typeof ItemKindSchema>

/** `none` = sold/dropped everywhere (consumables, epic/legendary). */
export const ItemRegionSchema = z.enum(['borderlands', 'thornwood', 'ashfall', 'none'])
export type ItemRegion = z.infer<typeof ItemRegionSchema>

export const WeaponClassSchema = z.enum(['sword', 'lance', 'axe', 'bow', 'crossbow', 'dagger', 'greatsword', 'tome', 'staff', 'shield'])
export type WeaponClass = z.infer<typeof WeaponClassSchema>

/** Potions are 1-AP self-drinks (brief §2.3); the effect reuses card effect kinds. */
export const ConsumableEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('Heal'), amount: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal('GainAp'), amount: z.number().int().min(1) }).strict(),
])
export type ConsumableEffect = z.infer<typeof ConsumableEffectSchema>

/** Quivers modify the DAMAGE cards of a bow in the other hand at deck-build time (brief §2.7). */
export const QuiverModifierSchema = z
  .object({
    kind: z.enum(['poison', 'slow', 'thunder', 'explosive']),
    value: z.number().int().min(1),
    turns: z.number().int().min(0),
  })
  .strict()
  .superRefine((mod, ctx) => {
    // `combat/deck.ts#quiverEffects` turns poison/slow straight into an `ApplyStatus { turns }`, and
    // `CardEffectSchema` rejects `turns: 0` there (`min(1)`) — so a duration-less status quiver would mint a
    // CardEffect the rest of the engine considers malformed. Damage quivers carry no duration at all.
    const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['turns'], message })
    if ((mod.kind === 'poison' || mod.kind === 'slow') && mod.turns < 1) issue(`${mod.kind} quivers apply a status and need turns >= 1`)
    if ((mod.kind === 'thunder' || mod.kind === 'explosive') && mod.turns !== 0) issue(`${mod.kind} quivers deal damage and carry no duration (turns must be 0)`)
  })
export type QuiverModifier = z.infer<typeof QuiverModifierSchema>

export const CARD_BEARING_KINDS: ReadonlySet<ItemKind> = new Set<ItemKind>(['weapon', 'shield', 'tome', 'staff'])
export const GEAR_KINDS: ReadonlySet<ItemKind> = new Set<ItemKind>(['weapon', 'shield', 'tome', 'staff', 'quiver'])

export const ItemSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    kind: ItemKindSchema,
    rarity: RaritySchema,
    region: ItemRegionSchema,
    gridSize: z.object({ width: z.number().int().min(1), height: z.number().int().min(1) }).strict(),
    /** Absent = not for sale (epic/legendary are drop-only). Never 0. */
    buyPrice: z.number().int().min(1).optional(),
    sellPrice: z.number().int().min(1),
    weaponClass: WeaponClassSchema.optional(),
    /** 2H occupies the left hand and locks the right. */
    twoHanded: z.boolean().optional(),
    gearCardIds: z.array(IdSchema).min(1).optional(),
    quiverModifier: QuiverModifierSchema.optional(),
    /** Food: hop-charges per ration. */
    charges: z.number().int().min(1).optional(),
    /** Potions: what one drink does to the drinker. */
    effect: ConsumableEffectSchema.optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    const cardBearing = CARD_BEARING_KINDS.has(item.kind)
    if (cardBearing && (item.gearCardIds?.length ?? 0) === 0) issue('gearCardIds', `${item.kind} '${item.id}' must contribute at least one gear card`)
    if (!cardBearing && item.gearCardIds !== undefined) issue('gearCardIds', `${item.kind} '${item.id}' must not contribute cards`)
    if (cardBearing && item.weaponClass === undefined) issue('weaponClass', `${item.kind} '${item.id}' needs a weaponClass`)
    if (!cardBearing && item.weaponClass !== undefined) issue('weaponClass', `${item.kind} '${item.id}' must not carry a weaponClass`)
    if (item.twoHanded && !cardBearing) issue('twoHanded', `only card-bearing gear can be two-handed ('${item.id}')`)
    if (item.quiverModifier !== undefined && item.kind !== 'quiver') issue('quiverModifier', `only quivers may carry a quiverModifier ('${item.id}' is ${item.kind})`)
    // …and the converse: a quiver carries no cards, so a quiver WITHOUT a modifier occupies a hand slot and does
    // nothing at all (`combat/deck.ts#modFor` returns null). There is no such thing as an inert quiver.
    if (item.kind === 'quiver' && item.quiverModifier === undefined) issue('quiverModifier', `quiver '${item.id}' carries no cards, so it must carry a quiverModifier or it does nothing`)
    if (item.kind === 'potion' && item.effect === undefined) issue('effect', `potion '${item.id}' must carry an effect`)
    if (item.kind !== 'potion' && item.effect !== undefined) issue('effect', `only potions carry an effect ('${item.id}')`)
    if (item.kind === 'food' && item.charges === undefined) issue('charges', `food '${item.id}' must declare charges`)
    if (item.kind !== 'food' && item.charges !== undefined) issue('charges', `only food carries charges ('${item.id}')`)
    if ((item.rarity === 'epic' || item.rarity === 'legendary') && item.buyPrice !== undefined) issue('buyPrice', `${item.rarity} '${item.id}' is drop-only and must not have a buyPrice`)
  })
export type Item = z.infer<typeof ItemSchema>
