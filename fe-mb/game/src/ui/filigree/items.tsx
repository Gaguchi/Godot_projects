/**
 * ui/filigree/items.tsx — how a thing in the satchel is drawn and worded, for every screen that shows one (the
 * market's counter and satchel, the company's hands). One icon per kind of thing, one phrase for what it is: never
 * the raw `kind` or `weaponClass` id.
 */
import React from 'react'
import type { Item } from '../../engine/types'
import { townArt } from '../town/shared'

/** The kit icon a thing wears (`tools/pxworld` kit_icons ITEM_ICON, exported with the kit). */
export const iconOf = (i: Pick<Item, 'kind' | 'weaponClass'>): string => townArt.kit.itemIcon[i.weaponClass ?? i.kind] ?? townArt.kit.itemIcon[i.kind] ?? 'sword'

/** A kit icon at 1:1 (24 px). */
export function KIcon({ name, style }: { readonly name: string; readonly style?: React.CSSProperties }): React.JSX.Element {
  return <img className="ficon" src={`/art/ui/kicon_${name}.png`} width={24} height={24} alt="" draggable={false} style={style} />
}

/** What a thing IS, in plain words. */
export function kindWords(i: Item): string {
  if (i.kind === 'food') return `${i.charges ?? 1} rations, a hop each`
  if (i.kind === 'potion') return i.effect?.kind === 'Heal' ? `a draught, heals ${i.effect.amount}` : `a draught, +${i.effect?.amount ?? 0} AP`
  if (i.kind === 'quiver') return 'a quiver for the off hand'
  if (i.kind === 'shield') return 'off-hand shield'
  return `${i.twoHanded === true ? 'two-handed' : 'one-handed'} ${i.weaponClass ?? i.kind}`
}
