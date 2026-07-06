import type { Unit } from '../domain/unit'
import type { Item } from '../domain/item'
import type { CardSource } from '../domain/card'
import type { DeckState } from '../domain/combatState'
import type { ItemId, CardId } from '../domain/ids'
import { asCardId } from '../domain/ids'

/**
 * Gear-as-deck builder (ship plan 2026-03-29 §2-4, §8).
 *
 *   Deck = innate class cards + handLeft gear cards + handRight gear cards
 *
 * - Every card is tagged with its source slot (innate / hand_left / hand_right).
 * - A quiver contributes no cards; instead it modifies every DAMAGE card
 *   sourced from a bow (`weaponClass === 'bow'`) in the OTHER hand slot. The
 *   modifier map is baked into DeckState at build time so combat resolution
 *   stays a pure lookup.
 * - Two-handed weapons occupy handLeft (handRight empty by invariant), so a
 *   2H bow can never pair with a quiver.
 *
 * Pure: no I/O, no framework. Callers supply lookups.
 */

export interface DeckBuildDeps {
  itemById: (id: ItemId) => Item | undefined
  /** Card ids the unit's class contributes regardless of gear. */
  innateCardIds: readonly string[]
  /** True when the card deals damage (quiver mods only attach to these). */
  cardDealsDamage: (cardId: string) => boolean
}

export function buildDeckForUnit(unit: Unit, deps: DeckBuildDeps): DeckState {
  const sources: Record<string, CardSource> = {}
  const cardIds: CardId[] = []

  for (const id of deps.innateCardIds) {
    cardIds.push(asCardId(id))
    sources[id] = 'innate'
  }

  const left = unit.handLeft ? deps.itemById(unit.handLeft) : undefined
  const right = unit.handRight ? deps.itemById(unit.handRight) : undefined

  const addGear = (item: Item | undefined, source: CardSource): void => {
    for (const id of item?.gearCardIds ?? []) {
      cardIds.push(asCardId(id))
      sources[id] = source
    }
  }
  addGear(left, 'hand_left')
  addGear(right, 'hand_right')

  // Quiver pairing: quiver in one hand modifies bow damage cards in the other.
  const cardMods: DeckState['cardMods'] = {}
  const pairs: Array<[Item | undefined, Item | undefined]> = [
    [left, right],
    [right, left],
  ]
  for (const [quiver, other] of pairs) {
    if (quiver?.kind !== 'quiver' || !quiver.quiverModifier) continue
    if (other?.weaponClass !== 'bow') continue
    for (const id of other.gearCardIds ?? []) {
      if (deps.cardDealsDamage(id)) cardMods[id] = quiver.quiverModifier
    }
  }

  const deck: DeckState = {
    // All cards start in the DRAW pile; the combat reducer's startBattle
    // shuffles it with the battle RNG and deals the opening hand (empty hand
    // = "not yet dealt" sentinel). Played cards discard; the discard pile
    // reshuffles into draw when it runs dry — the deck CYCLES.
    draw: [...cardIds],
    hand: [],
    discard: [],
    sources,
  }
  if (Object.keys(cardMods).length > 0) deck.cardMods = cardMods
  return deck
}
