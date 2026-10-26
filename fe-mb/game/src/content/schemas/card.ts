import { z } from 'zod'
import { DamageStatSchema, IdSchema, RangeSchema, StatusIdSchema } from './common'

export const WeaponTypeSchema = z.enum(['sword', 'lance', 'axe', 'bow', 'crossbow', 'tome', 'staff', 'greatsword', 'dagger', 'shield'])
export type WeaponType = z.infer<typeof WeaponTypeSchema>

export const CardTargetKindSchema = z.enum(['enemy', 'ally', 'self', 'tile', 'all_enemies', 'all_allies'])
export type CardTargetKind = z.infer<typeof CardTargetKindSchema>

/**
 * Who an effect lands on (brief §2.3 — explicit, never inferred). The CENTRE is the chosen tile, or the
 * source's own tile when the card takes no tile (`self`, `all_enemies`, `all_allies`, enemy buffs) — so a self
 * card may carry `area`/`ally` selectors with an `aoeRadius` (self-centred AOE) — engine rule in
 * `engine/combat/targeting.ts#recipients`:
 * - `self`   — the unit playing the card.
 * - `target` — the single living unit on the centre (the source itself for self cards).
 * - `area`   — every HOSTILE living unit within `aoeRadius` of the centre, centre included; on an
 *              `all_enemies` card: every living foe on the board (no radius). Never touches allies.
 * - `ally`   — every FRIENDLY living unit within `aoeRadius` of the centre, centre included; on an
 *              `all_allies` card: every living friend on the board.
 * - `ring`   — every HOSTILE living unit on the four tiles orthogonally adjacent to the centre, centre
 *              EXCLUDED (quiver `explosive`; ring-only AOEs). Needs no `aoeRadius`.
 */
export const EffectTargetSchema = z.enum(['self', 'target', 'ally', 'area', 'ring'])
export type EffectTarget = z.infer<typeof EffectTargetSchema>

export const DamageTypeSchema = z.enum(['physical', 'magic'])
export type DamageType = z.infer<typeof DamageTypeSchema>

/**
 * The card effect union. Every field here is consumed by the engine; the
 * shipped `magic`/`scalesWithShield`/`splash` params were dropped (`splash:
 * 'adjacent'` on a radius-1 card is exactly `target: 'area'`).
 */
export const CardEffectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('Damage'),
    target: EffectTargetSchema,
    base: z.number().int().min(0),
    damageType: DamageTypeSchema,
    /** Ignores armor entirely (quiver `thunder` sets it at deck build). */
    armorPiercing: z.boolean().optional(),
  }).strict(),
  z.object({ kind: z.literal('Heal'), target: EffectTargetSchema, amount: z.number().int().min(1) }).strict(),
  z.object({
    kind: z.literal('ApplyStatus'),
    target: EffectTargetSchema,
    effectId: StatusIdSchema,
    /** Stacks (poison/burn damage per tick, slow SPD delta, riposte return, empower bonus). 1 for taunt/immobilize. */
    value: z.number().int().min(1),
    turns: z.number().int().min(1),
  }).strict(),
  z.object({
    kind: z.literal('RemoveStatus'),
    target: EffectTargetSchema,
    remove: z.enum(['armor', 'debuff']),
    /** Exactly one of `amount` / `all` (enforced by CardSchema — discriminated unions cannot carry refinements). */
    amount: z.number().int().min(1).optional(),
    all: z.literal(true).optional(),
  }).strict(),
  z.object({ kind: z.literal('Move'), target: z.literal('self'), distance: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal('GrantArmor'), target: EffectTargetSchema, amount: z.number().int().min(1) }).strict(),
  z.object({
    kind: z.literal('DrawCards'),
    target: z.literal('self'),
    count: z.number().int().min(1),
    gainAp: z.number().int().min(1).optional(),
  }).strict(),
  z.object({ kind: z.literal('GainAp'), target: EffectTargetSchema, amount: z.number().int().min(1) }).strict(),
])
export type CardEffect = z.infer<typeof CardEffectSchema>
export type CardEffectKind = CardEffect['kind']

export const CardSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    apCost: z.number().int().min(0).max(3),
    range: RangeSchema,
    targetKind: CardTargetKindSchema,
    /** Manhattan radius around the chosen tile, centre included. Absent = single tile. */
    aoeRadius: z.number().int().min(1).max(2).optional(),
    /** null = innate (any weapon). */
    weaponType: WeaponTypeSchema.nullable(),
    /** Required iff the card has a Damage effect. */
    damageStat: DamageStatSchema.optional(),
    effects: z.array(CardEffectSchema).min(1),
    /** The spec mechanic this card APPROXIMATES (docs/research/gear-content-deviations.md), e.g. "lifesteal-on-hit".
     *  `lint:content` prints the list (never fails). Absent = the card is to spec. */
    todoMechanic: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((card, ctx) => {
    const allKind = card.targetKind === 'all_enemies' || card.targetKind === 'all_allies'
    const hasDamage = card.effects.some((e) => e.kind === 'Damage')
    if (hasDamage && card.damageStat === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['damageStat'], message: `card '${card.id}' deals damage but has no damageStat` })
    }
    if (!hasDamage && card.damageStat !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['damageStat'], message: `card '${card.id}' has a damageStat but no Damage effect` })
    }
    if (card.targetKind === 'self' && card.range.max !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['range'], message: `self card '${card.id}' must have range 0-0` })
    }
    if (card.targetKind === 'tile' && card.aoeRadius === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['aoeRadius'], message: `tile card '${card.id}' needs an aoeRadius` })
    }
    for (const [i, e] of card.effects.entries()) {
      if (e.kind === 'RemoveStatus' && (e.amount === undefined) === (e.all === undefined)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['effects', i], message: `card '${card.id}' RemoveStatus needs exactly one of amount / all: true` })
      }
      if ((e.target === 'area' || e.target === 'ally') && card.aoeRadius === undefined && card.targetKind !== 'tile' && !allKind) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['effects', i, 'target'], message: `card '${card.id}' uses an AOE target selector without aoeRadius` })
      }
      if (e.target === 'target' && (card.targetKind === 'tile' || allKind)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['effects', i, 'target'], message: `${card.targetKind} card '${card.id}' cannot use target: 'target' (use 'area' / 'ally')` })
      }
    }
  })
export type Card = z.infer<typeof CardSchema>
