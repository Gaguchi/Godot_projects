import type { Unit } from '../domain/unit'
import type { Item } from '../domain/item'
import type { ClassDef } from '../domain/class'
import type { CardId, ItemId } from '../domain/ids'

export interface BuiltDeckEntry {
  cardId: CardId
  source: 'innate' | 'hand_left' | 'hand_right'
}

export function buildDeck(
  unit: Unit,
  classDef: ClassDef,
  itemsById: Map<ItemId, Item>,
): BuiltDeckEntry[] {
  const out: BuiltDeckEntry[] = []

  for (const cardId of classDef.innateCardIds) {
    out.push({ cardId, source: 'innate' })
  }

  if (unit.hand.left) {
    const left = itemsById.get(unit.hand.left)
    if (!left) throw new Error(`deckBuilder: unknown item in hand_left: ${unit.hand.left as unknown as string}`)
    for (const cardId of left.gearCards) out.push({ cardId, source: 'hand_left' })
  }

  if (unit.hand.right) {
    const right = itemsById.get(unit.hand.right)
    if (!right) throw new Error(`deckBuilder: unknown item in hand_right: ${unit.hand.right as unknown as string}`)
    for (const cardId of right.gearCards) out.push({ cardId, source: 'hand_right' })
  }

  return out
}
