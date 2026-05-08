import { z, ZodError } from 'zod'
import { CardSchema, UnitSchema, ItemSchema, ClassSchema, QuestSchema, DialogueTreeSchema, BattleMapSchema, WorldMapSchema } from './schemas'

export interface ContentBundle {
  cards: z.infer<typeof CardSchema>[]
  units: z.infer<typeof UnitSchema>[]
  items: z.infer<typeof ItemSchema>[]
  classes: z.infer<typeof ClassSchema>[]
  quests: z.infer<typeof QuestSchema>[]
  dialogues: z.infer<typeof DialogueTreeSchema>[]
  battleMaps: z.infer<typeof BattleMapSchema>[]
  worldMaps: z.infer<typeof WorldMapSchema>[]
}

export type LoadResult =
  | { ok: true; bundle: ContentBundle }
  | { ok: false; errors: { file: string; error: ZodError | string }[] }

export interface RawContent {
  cards: unknown[]
  units: unknown[]
  items: unknown[]
  classes: unknown[]
  quests: unknown[]
  dialogues: unknown[]
  battleMaps: unknown[]
  worldMaps: unknown[]
}

export function validateContent(raw: RawContent): LoadResult {
  const errors: { file: string; error: ZodError | string }[] = []
  // Use a record-shaped accumulator so exactOptionalPropertyTypes doesn't
  // reject the partial-build: each slot is assigned a (possibly undefined)
  // array; we only commit to the bundle shape after the error check.
  const out: { [K in keyof ContentBundle]?: ContentBundle[K] } = {}

  function arr<T>(name: keyof RawContent, schema: z.ZodType<T>): T[] | undefined {
    const list: T[] = []
    for (let i = 0; i < raw[name].length; i++) {
      const r = schema.safeParse(raw[name][i])
      if (r.success) list.push(r.data)
      else errors.push({ file: `${name}[${i}]`, error: r.error })
    }
    return errors.length === 0 ? list : undefined
  }

  const cards = arr('cards', CardSchema)
  if (cards) out.cards = cards
  const units = arr('units', UnitSchema)
  if (units) out.units = units
  const items = arr('items', ItemSchema)
  if (items) out.items = items
  const classes = arr('classes', ClassSchema)
  if (classes) out.classes = classes
  const quests = arr('quests', QuestSchema)
  if (quests) out.quests = quests
  const dialogues = arr('dialogues', DialogueTreeSchema)
  if (dialogues) out.dialogues = dialogues
  const battleMaps = arr('battleMaps', BattleMapSchema)
  if (battleMaps) out.battleMaps = battleMaps
  const worldMaps = arr('worldMaps', WorldMapSchema)
  if (worldMaps) out.worldMaps = worldMaps

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, bundle: out as ContentBundle }
}
