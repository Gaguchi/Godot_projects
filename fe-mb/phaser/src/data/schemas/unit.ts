import { z } from 'zod';

export const StatBlockSchema = z.object({
  hp: z.number().int().positive(),
  str: z.number().int().nonnegative(),
  mag: z.number().int().nonnegative(),
  skl: z.number().int().nonnegative(),
  spd: z.number().int().nonnegative(),
  lck: z.number().int().nonnegative(),
  def: z.number().int().nonnegative(),
  res: z.number().int().nonnegative(),
  mov: z.number().int().positive(),
});

export const ClassSchema = z.enum(['LORD', 'KNIGHT', 'MAGE', 'CLERIC', 'ARCHER', 'BOUNTY_HUNTER']);

export const UnitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  class: ClassSchema,
  level: z.number().int().positive(),
  stats: StatBlockSchema,
  deck: z.array(z.string()).min(1),
});

export type StatBlock = z.infer<typeof StatBlockSchema>;
export type UnitClass = z.infer<typeof ClassSchema>;
export type Unit = z.infer<typeof UnitSchema>;
