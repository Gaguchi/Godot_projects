import React from 'react'
import { useRunStore } from '../../../state/runStore'
import itemsJson from '../../../data/content/items.json'
import { asItemId } from '../../../domain/ids'
import type { TownDef } from '../../../domain/town'
import { Button, Heading } from '../../components'

export interface ShopPanelProps {
  town: TownDef
}

export function ShopPanel({ town }: ShopPanelProps): React.JSX.Element {
  const dispatchRun = useRunStore((s) => s.dispatch)
  const gold = useRunStore((s) => s.gold)
  const inventoryItems = useRunStore((s) => s.inventory.items)

  const shopStock = itemsJson.filter((i) =>
    town.shopStockIds.includes(i.id)
    || (i.region === town.regionId && (i.rarity === 'common' || i.rarity === 'uncommon')),
  )

  const onBuy = (itemId: string, price: number): void => {
    dispatchRun({ type: 'buyItem', payload: { itemId: asItemId(itemId), price } })
  }

  const onSell = (itemId: string, sellPrice: number): void => {
    dispatchRun({ type: 'sellItem', payload: { itemId: asItemId(itemId), sellPrice } })
  }

  return (
    <div id="shop-panel">
      <Heading level={1} className="text-2xl tracking-widest m-0">The Shop</Heading>
      <p className="text-stone-500 mt-2">Borderlands gear and supplies.</p>

      <h3 className="mt-6 text-sm tracking-widest text-amber-200">STOCK</h3>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {shopStock.map((item) => (
          <div
            key={item.id}
            className="p-3 border border-stone-800 flex justify-between items-center"
          >
            <div>
              <div className={item.rarity === 'uncommon' ? 'text-emerald-400' : 'text-amber-100'}>
                {item.name}
              </div>
              <div className="text-[10px] text-stone-500">{item.kind} · {item.rarity}</div>
            </div>
            <Button
              variant="secondary"
              isDisabled={gold < item.buyPrice}
              onPress={() => onBuy(item.id, item.buyPrice)}
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
          const item = itemsJson.find((i) => i.id === (bagItem.itemId as unknown as string))
          if (!item) return null
          return (
            <div
              key={`${item.id}-${idx}`}
              className="p-3 border border-stone-800 flex justify-between items-center"
            >
              <div>
                <div>{item.name}</div>
                <div className="text-[10px] text-stone-500">{item.kind}</div>
              </div>
              <Button
                variant="secondary"
                onPress={() => onSell(item.id, item.sellPrice)}
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
