import { z } from 'zod';
import { StatBlockSchema } from './unit';
import { RangeSchema } from './card';

export const AiBehaviorSchema = z.enum(['closest_target', 'support', 'flee_low_hp']);

export const EnemySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().positive(),
  stats: StatBlockSchema,
  attack: z.object({
    damage: z.number().int().nonnegative(),
    range: RangeSchema,
    type: z.enum(['physical', 'magical']),
  }),
  ai: AiBehaviorSchema,
});

export type Enemy = z.infer<typeof EnemySchema>;
export type AiBehavior = z.infer<typeof AiBehaviorSchema>;
