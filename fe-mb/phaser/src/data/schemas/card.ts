import { z } from 'zod';

export const StatSchema = z.enum(['STR', 'MAG', 'SKL', 'SPD', 'LCK', 'DEF', 'RES']);
export const TargetSchema = z.enum(['SELF', 'ALLY', 'ENEMY', 'GROUND', 'ALL_ENEMIES', 'ALL_ALLIES']);
export const AoeShapeSchema = z.enum(['single', 'circle', 'cross', 'line']);

export const RangeSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});

export const AoeSchema = z.object({
  shape: AoeShapeSchema,
  radius: z.number().int().nonnegative(),
});

export const CardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cost: z.number().int().nonnegative(),
  damage_base: z.number().int(),
  stat: StatSchema,
  target: TargetSchema,
  range: RangeSchema,
  aoe: AoeSchema,
  description: z.string(),
});

export type Card = z.infer<typeof CardSchema>;
export type Stat = z.infer<typeof StatSchema>;
export type Target = z.infer<typeof TargetSchema>;
