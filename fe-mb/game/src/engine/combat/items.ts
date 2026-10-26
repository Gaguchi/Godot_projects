/**
 * combat/items.ts — consumables are 1-AP self-drinks from the shared bag (brief §2.3).
 * Refused if ap < itemUseAp, if the active unit is not a PARTY unit, or if `itemId ∉ consumables`.
 * Effect applies to the drinker only; the id moves consumables → consumedItems; enemies never use items.
 */
import type { SliceResult } from '../actions'
import type { CardEffect, CombatState, EngineEnv, Item, ItemId, PlayableCard } from '../types'
import type { Effect } from '../effects'
import { resolvePlay } from './cards'
import { NOT_IN_SATCHEL, NOT_OF_THE_COMPANY, needsAp } from './reasons'
import { withUnit } from './state'
import { activeUnit } from './turn'

/** A potion as a self-target play (`Item.effect` Heal|GainAp → CardEffect with target 'self', apCost = itemUseAp). */
export function itemAsPlay(item: Item, env: EngineEnv): PlayableCard {
  const effect = item.effect
  if (effect === undefined) throw new Error(`combat/items: '${item.id}' is not a consumable`)
  const effects: CardEffect[] = effect.kind === 'Heal'
    ? [{ kind: 'Heal', target: 'self', amount: effect.amount }]
    : [{ kind: 'GainAp', target: 'self', amount: effect.amount }]
  return { apCost: env.rules.combat.itemUseAp, range: { min: 0, max: 0 }, targetKind: 'self', effects }
}

export function useItem(state: CombatState, itemId: ItemId, env: EngineEnv): SliceResult<CombatState> {
  const refuse = (reason: string): SliceResult<CombatState> => ({ state, effects: [{ kind: 'refused', action: 'combat/useItem', reason }] })
  const active = activeUnit(state)
  if (active.team !== 'party') return refuse(NOT_OF_THE_COMPANY)
  const cost = env.rules.combat.itemUseAp
  if (active.ap < cost) return refuse(needsAp(cost))
  const idx = state.consumables.indexOf(itemId)
  if (idx < 0) return refuse(NOT_IN_SATCHEL)
  const item = env.content.items[itemId]
  if (item === undefined) throw new Error(`combat/items: consumable '${itemId}' is not in content`) // state carries an id content never minted
  const card = itemAsPlay(item, env)
  const ap = active.ap - cost
  const st: CombatState = {
    ...withUnit(state, { ...active, ap }),
    consumables: state.consumables.filter((_, i) => i !== idx),
    consumedItems: [...state.consumedItems, itemId],
  }
  const effects: Effect[] = [
    { kind: 'itemUsed', unitId: active.id, itemId },
    { kind: 'apChanged', unitId: active.id, ap, delta: -cost },
  ]
  const resolved = resolvePlay(st, { sourceId: active.id, card, cardId: null, tile: null, mod: null, cause: 'item' }, env)
  return { state: resolved.state, effects: [...effects, ...resolved.effects] }
}
