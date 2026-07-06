import React from 'react'
import { useRunStore } from '../../../state/runStore'
import itemsJson from '../../../data/content/items.json'
import { asItemId } from '../../../domain/ids'
import type { TownDef } from '../../../domain/town'
import type { Item } from '../../../domain/item'
import { Button, Heading } from '../../components'
import { shopStockFor } from '../../../systems/shopStock'
import { RARITY_TEXT, RARITY_BORDER } from '../../rarity'

export interface ShopPanelProps {
  town: TownDef
}

const ALL_ITEMS = itemsJson as unknown as Item[]

export function ShopPanel({ town }: ShopPanelProps): React.JSX.Element {
  const dispatchRun = useRunStore((s) => s.dispatch)
  const gold = useRunStore((s) => s.gold)
  const inventoryItems = useRunStore((s) => s.inventory.items)

  // Regional rarity gates (ship plan §5): borderlands C+U; thornwood/ashfall U+R.
  const shopStock = shopStockFor(town, ALL_ITEMS)

  const onBuy = (itemId: string, price: number): void => {
    dispatchRun({ type: 'buyItem', payload: { itemId: asItemId(itemId), price } })
  }

  const onSell = (itemId: string, sellPrice: number): void => {
    dispatchRun({ type: 'sellItem', payload: { itemId: asItemId(itemId), sellPrice } })
  }

  const gearMeta = (item: Item): string => {
    let meta = `${item.kind} · ${item.rarity}`
    if (item.gearCardIds) meta += ` · ${item.gearCardIds.length} cards`
    if (item.twoHanded) meta += ' · 2H'
    if (item.quiverModifier) meta += ` · ${item.quiverModifier.kind}`
    return meta
  }

  return (
    <div id="shop-panel">
      <Heading level={1} className="text-2xl tracking-widest m-0">The Shop</Heading>
      <p className="text-stone-500 mt-2">Gear and supplies. Press I to manage loadouts.</p>

      <h3 className="mt-6 text-sm tracking-widest text-amber-200">STOCK</h3>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {shopStock.map((item) => (
          <div
            key={item.id as unknown as string}
            className={`p-3 border flex justify-between items-center ${RARITY_BORDER[item.rarity]}`}
          >
            <div>
              <div className={RARITY_TEXT[item.rarity]}>{item.name}</div>
              <div className="text-[10px] text-stone-500">{gearMeta(item)}</div>
            </div>
            <Button
              variant="secondary"
              isDisabled={gold < item.buyPrice}
              onPress={() => onBuy(item.id as unknown as string, item.buyPrice)}
              className="!px-3 !py-1.5 !text-xs"
            >
              Buy {item.buyPrice}g
            </Button>
          </div>
        ))}
      </div>

      <h3 className="mt-8 text-sm tracking-widest text-amber-200">YOUR BAG ({inventoryItems.length} items)</h3>
      {inventoryItems.length === 0 && (
        <div className="text-stone-500 italic mt-2">Empty.</div>
      )}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {inventoryItems.map((bagItem, idx) => {
          const item = ALL_ITEMS.find((i) => (i.id as unknown as string) === (bagItem.itemId as unknown as string))
          if (!item) return null
          return (
            <div
              key={`${item.id as unknown as string}-${idx}`}
              className={`p-3 border flex justify-between items-center ${RARITY_BORDER[item.rarity]}`}
            >
              <div>
                <div className={RARITY_TEXT[item.rarity]}>{item.name}</div>
                <div className="text-[10px] text-stone-500">{gearMeta(item)}</div>
              </div>
              <Button
                variant="secondary"
                onPress={() => onSell(item.id as unknown as string, item.sellPrice)}
                className="!px-3 !py-1.5 !text-xs"
              >
                Sell {item.sellPrice}g
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
