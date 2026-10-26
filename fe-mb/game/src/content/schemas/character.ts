import { z } from 'zod'
import { IdSchema, UnitStatsSchema } from './common'

export const TeamSchema = z.enum(['party', 'enemy'])
export type Team = z.infer<typeof TeamSchema>

/** Identity ramp token (`--id-<accent>` in styles/index.css). Says WHO, never what to do. */
export const PortraitAccentSchema = z.enum(['gold', 'steel', 'rose', 'moss', 'arcane', 'ember', 'slate', 'wine'])
export const PortraitFactionSchema = z.enum(['party', 'enemy', 'neutral', 'narrator', 'noble', 'mystic'])
export const PortraitShapeSchema = z.enum(['circle', 'square', 'hex', 'diamond', 'triangle'])
export const PortraitSchema = z
  .object({ accent: PortraitAccentSchema, faction: PortraitFactionSchema, shape: PortraitShapeSchema })
  .strict()
export type Portrait = z.infer<typeof PortraitSchema>

/** Passive traits (brief §2.16). `genatsvale`: each of Oak's turns, the first
 *  blow aimed at an adjacent ally lands on him instead (per ally, per turn). */
export const PassiveIdSchema = z.enum(['genatsvale'])
export type PassiveId = z.infer<typeof PassiveIdSchema>

/** A character who can stand on the board: starters, companions, named enemies. */
export const UnitCharacterSchema = z
  .object({
    kind: z.literal('unit'),
    /** Also the UnitId and portraitId. */
    id: IdSchema,
    /** Placeholder for `mc` — RunState.mcName overrides at render. */
    displayName: z.string().min(1),
    classId: IdSchema,
    level: z.number().int().min(1),
    team: TeamSchema,
    /** File stem under public/sprites/units/ (portrait) and /board/ (bake). Absent = initials token. */
    spriteId: IdSchema.optional(),
    startingGear: z.object({ left: IdSchema.nullable(), right: IdSchema.nullable() }).strict(),
    /** Extra items that enter the party bag when this character joins. */
    bag: z.array(IdSchema).optional(),
    /** Closes OQ-9: overrides the class-baseline stat lift for authored units. */
    statOverrides: UnitStatsSchema.partial().optional(),
    /** Appended to the deck with CardSource 'signature'. */
    signatureCardIds: z.array(IdSchema),
    passiveIds: z.array(PassiveIdSchema),
    portrait: PortraitSchema,
    /** The scene that recruits this character (its effects carry `recruitCharacter`). */
    joinDialogueId: IdSchema.optional(),
    /** In the party at run start (seedNewRun reads this). */
    starter: z.boolean(),
    /** `recruitCharacter` may add this character (false for enemies and dormant sketches). */
    recruitable: z.boolean(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.starter && c.team !== 'party') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['starter'], message: `starter '${c.id}' must be on the party team` })
    if (c.recruitable && c.team !== 'party') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['recruitable'], message: `recruitable '${c.id}' must be on the party team` })
    if (c.passiveIds.length > 0 && c.team !== 'party') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['passiveIds'], message: `passives are party-only today ('${c.id}')` })
  })
export type UnitCharacter = z.infer<typeof UnitCharacterSchema>

/** A face and a name only — dialogue speakers who never fight. */
export const NpcCharacterSchema = z
  .object({
    kind: z.literal('npc'),
    id: IdSchema,
    displayName: z.string().min(1),
    spriteId: IdSchema.optional(),
    portrait: PortraitSchema,
  })
  .strict()
export type NpcCharacter = z.infer<typeof NpcCharacterSchema>

export const CharacterSchema = z.discriminatedUnion('kind', [UnitCharacterSchema.innerType(), NpcCharacterSchema]).superRefine((c, ctx) => {
  if (c.kind === 'unit') {
    const r = UnitCharacterSchema.safeParse(c)
    if (!r.success) for (const i of r.error.issues) ctx.addIssue(i)
  }
})
export type Character = z.infer<typeof CharacterSchema>
