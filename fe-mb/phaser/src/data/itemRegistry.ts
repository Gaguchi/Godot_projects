import itemsJson from './content/items.json'
import type { Item } from '../domain/item'
import type { ItemId } from '../domain/ids'

/**
 * In-memory item-definition lookup. Content is Zod-validated at boot by
 * data/load.ts; this registry is the cheap read path for stores/systems that
 * need a definition at dispatch time (equip rules, deck building, shops).
 */
const byId = new Map<string, Item>(
  (itemsJson as unknown as Item[]).map(i => [i.id as unknown as string, i]),
)

export function getItemDef(id: ItemId | string): Item | undefined {
  return byId.get(id as unknown as string)
}

export function allItemDefs(): Item[] {
  return [...byId.values()]
}
