// StatusEffectDef contains function hooks; can't be Zod-validated directly.
// JSON content for status effects is registered in a code-side registry, not loaded as data.
// This file exists for future status-effect-data shape if we ever externalize them.
import { z } from 'zod'

export const StatusEffectDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  stackable: z.boolean(),
})
