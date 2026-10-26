/**
 * run/equipment.ts — atomic dry-run equip plans (brief §2.7). A plan is computed against copies and either
 * returns a complete new (unit, bag) pair or a refusal; inputs are never touched, so the reducer can apply
 * `ok` plans verbatim and refuse the rest with the same state reference.
 *
 * Rules: the item leaves the bag FIRST (its cells may be exactly the hole a displaced item needs); every
 * displaced item must fit the spatial bag or the whole plan is refused; a two-handed item sits in the LEFT
 * hand and locks the right (the right hand is emptied into the bag in the same plan); a 1H into a locked
 * right slot, a non-gear item, an item not in the bag and an item the holder's CHASSIS is not trained to
 * (`canHold`) are refused. Quivers are ordinary 1H gear for the spatial half of the plan — their bow pairing
 * is a DECK-BUILD rule (`combat/deck.ts`), so two quivers or a quiver beside a crossbow are legal and merely
 * do nothing; a quiver beside a 2H bow is impossible by the lock. The TRAINING half does read the pairing:
 * a quiver is an archer's kit, so the hand that takes one must be a hand that could draw the bow.
 */
import type { BagEntry, ClassDef, EngineEnv, HandSlot, Item, ItemId, Unit, WeaponClass } from '../types'
import type { Legality } from '../actions'
import { isGear, itemDef, placeInBag, removeFirst } from './bag'

export type EquipPlan =
  | { readonly ok: true; readonly unit: Unit; readonly bag: readonly BagEntry[] }
  | { readonly ok: false; readonly reason: string }

const BAG_FULL = 'the bag has no room for the gear this would displace'

/**
 * The plural a refusal says out loud, one word per `WeaponClass`. Authored rather than derived because English
 * does not derive it (axe → axes, staff → staves), and because this string is READ by the player: it is the
 * whole of what the Loadout's unlit slot and the headless `equip` say for themselves.
 */
const WEAPON_WORDS: Readonly<Record<WeaponClass, string>> = {
  sword: 'swords', lance: 'lances', axe: 'axes', bow: 'bows', crossbow: 'crossbows',
  dagger: 'daggers', greatsword: 'greatswords', tome: 'tomes', staff: 'staves', shield: 'shields',
}
/** A quiver carries no `weaponClass` (the item schema forbids one on non-card-bearing gear), so its training
 *  rides the bow it exists for — `rules.gear.quiverPairsWith`. */
const QUIVER_WORD = 'quivers'

/**
 * Is this chassis trained to the item's arm? `classes.json#weaponClasses` is the data home of the rule, and this
 * is its ONE reader: `planEquip` refuses on it, `ui/modals/Loadout.tsx` shows the refusal under the slot it
 * belongs to, and `content/lint.ts` holds every shipped hand to it. DECISIONS removed the weapon TRIANGLE — the
 * +15 hit / +1 damage rock-paper-scissors — which is not the same as letting a Mage hold a tower shield and a
 * Lord a tome while the loadout screen says nothing (RE-GATE C 3.13).
 *
 * The reason is a lowercase fragment completing an implied "because …" (ARCHITECTURE §5.1) and names the class by
 * its own display name, never its id. `TrainingEnv` is narrower than `EngineEnv` on purpose: `content/lint.ts`
 * holds a raw registry (no `version`, no `nodeDistance`) and this rule needs neither.
 */
export interface TrainingEnv {
  readonly content: { readonly classes: Readonly<Record<string, ClassDef>> }
  readonly rules: { readonly gear: { readonly quiverPairsWith: WeaponClass } }
}

export function canHold(classId: string, item: Item, env: TrainingEnv): Legality {
  const cls = env.content.classes[classId]
  if (cls === undefined) return { ok: true } // an unknown chassis is a content fault the lint owns, not a refusal
  const trained: readonly WeaponClass[] = cls.weaponClasses
  const needs: WeaponClass | null = item.kind === 'quiver' ? env.rules.gear.quiverPairsWith : item.weaponClass ?? null
  if (needs === null || trained.includes(needs)) return { ok: true }
  const word = item.kind === 'quiver' ? QUIVER_WORD : WEAPON_WORDS[needs]
  return { ok: false, reason: `${cls.name}s do not carry ${word}` }
}

function withHand(unit: Unit, slot: HandSlot, itemId: ItemId | null): Unit {
  return slot === 'left' ? { ...unit, handLeft: itemId } : { ...unit, handRight: itemId }
}

export function planEquip(unit: Unit, slot: HandSlot, itemId: ItemId, bag: readonly BagEntry[], env: EngineEnv): EquipPlan {
  const item = env.content.items[itemId]
  if (item === undefined) return { ok: false, reason: `unknown item '${itemId}'` }
  if (!isGear(item)) return { ok: false, reason: `${item.name} cannot be held` }
  if (!bag.some((e) => e.itemId === itemId)) return { ok: false, reason: `${item.name} is not in the bag` }
  // Training before space: a hand that may not hold this at all should say so, not complain about the bag.
  const trained = canHold(unit.classId, item, env)
  if (!trained.ok) return { ok: false, reason: trained.reason }

  // The equipped item vacates its cells before anything is put back — that hole is part of the plan.
  const without = removeFirst(bag, itemId)
  const leftItem = unit.handLeft === null ? null : itemDef(unit.handLeft, env)

  if (item.twoHanded === true) {
    // 2H always takes LEFT and empties BOTH hands into the bag (brief §2.7 "occupies LEFT, locking RIGHT").
    const displaced = [unit.handLeft, unit.handRight].filter((id): id is ItemId => id !== null)
    const next = placeInBag(without, displaced, env)
    if (next === null) return { ok: false, reason: BAG_FULL }
    return { ok: true, unit: { ...unit, handLeft: itemId, handRight: null }, bag: next }
  }

  if (slot === 'right' && leftItem?.twoHanded === true) {
    return { ok: false, reason: `the off-hand is locked by ${leftItem.name}` }
  }

  const displaced = slot === 'left' ? unit.handLeft : unit.handRight
  const next = placeInBag(without, displaced === null ? [] : [displaced], env)
  if (next === null) return { ok: false, reason: BAG_FULL }
  return { ok: true, unit: withHand(unit, slot, itemId), bag: next }
}

export function planUnequip(unit: Unit, slot: HandSlot, bag: readonly BagEntry[], env: EngineEnv): EquipPlan {
  const current = slot === 'left' ? unit.handLeft : unit.handRight
  if (current === null) return { ok: false, reason: 'that hand is already empty' }
  const next = placeInBag(bag, [current], env)
  if (next === null) return { ok: false, reason: `the bag has no room for ${itemDef(current, env).name}` }
  // Taking a 2H out of the left hand leaves the right hand empty by invariant (it was locked), so no unlock step.
  return { ok: true, unit: withHand(unit, slot, null), bag: next }
}
