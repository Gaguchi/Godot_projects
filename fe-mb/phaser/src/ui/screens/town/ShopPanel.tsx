import React from 'react'
import { useRunStore } from '../../../state/runStore'
import itemsJson from '../../../data/content/items.json'
import { asItemId } from '../../../domain/ids'
import type { TownDef } from '../../../domain/town'
import type { Item, ItemKind, QuiverModifierKind } from '../../../domain/item'
import { Button, Heading } from '../../components'
import { shopStockFor } from '../../../systems/shopStock'
import { RARITY_TEXT, RARITY_EDGE } from '../../rarity'
import { CardsGlyph, EmptyState, KindSocket, SatchelGlyph, SectionLabel } from './townUi'

export interface ShopPanelProps {
  town: TownDef
}

const ALL_ITEMS = itemsJson as unknown as Item[]

const KIND_LABEL: Record<ItemKind, string> = {
  food: 'Rations',
  potion: 'Potion',
  weapon: 'Weapon',
  shield: 'Shield',
  quiver: 'Quiver',
  tome: 'Tome',
  staff: 'Staff',
}

const QUIVER_LABEL: Record<QuiverModifierKind, string> = {
  poison: 'Poisoned',
  slow: 'Slowing',
  thunder: 'Thunder',
  explosive: 'Explosive',
}

/** Small-caps trait line under the item name — rarity lives in color, not words. */
function itemTraits(item: Item): string {
  const parts: string[] = [KIND_LABEL[item.kind]]
  if (item.twoHanded) parts.push('Two-handed')
  if (item.quiverModifier) parts.push(QUIVER_LABEL[item.quiverModifier.kind])
  return parts.join(' · ')
}

interface StockRowProps {
  item: Item
  price: number
  /** Buy rows: gold >= price. Sell rows: always true. */
  affordable: boolean
  actionLabel: string
  actionDisabled: boolean
  onAction: () => void
}

/** A shop row as a physical object: socketed glyph, named gear, carved price. */
function StockRow({ item, price, affordable, actionLabel, actionDisabled, onAction }: StockRowProps): React.JSX.Element {
  const cardCount = item.gearCardIds?.length ?? 0
  return (
    <div
      className={`surface-iron flex items-center gap-3 rounded-[var(--radius-md)] border-l-2 p-3 ${RARITY_EDGE[item.rarity]}`}
    >
      <KindSocket kind={item.kind} />
      <div className="min-w-0 flex-1">
        <div className={`font-body text-[0.95rem] leading-tight ${RARITY_TEXT[item.rarity]}`}>{item.name}</div>
        <div className="mt-1 text-[0.62rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
          {itemTraits(item)}
        </div>
      </div>
      {cardCount > 0 && (
        <span
          className="flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] bg-black/30 px-1.5 py-1 text-parchment-dim"
          aria-label={`grants ${cardCount} cards`}
        >
          <CardsGlyph size={13} />
          <span className="numeral text-[0.7rem]">{cardCount}</span>
        </span>
      )}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className={`numeral text-lg leading-none ${
            affordable ? 'text-[color:var(--color-hearth-soft)]' : 'text-[color:var(--color-damage-text)]'
          }`}
        >
          {price}
          <span className="text-[0.7rem] opacity-80">g</span>
        </span>
        <Button
          variant="secondary"
          isDisabled={actionDisabled}
          onPress={onAction}
          className="!px-3 !py-1 !text-[0.65rem]"
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}

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

  return (
    <div id="shop-panel">
      <Heading level={1} className="text-2xl tracking-widest m-0">The Shop</Heading>
      <p className="mt-2 text-[color:var(--color-text-muted)]">Steel, salves, and traveling rations.</p>

      <SectionLabel className="mt-6">Stock</SectionLabel>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {shopStock.map((item) => {
          const affordable = gold >= item.buyPrice
          return (
            <StockRow
              key={item.id as unknown as string}
              item={item}
              price={item.buyPrice}
              affordable={affordable}
              actionLabel={affordable ? 'Buy' : `Need ${item.buyPrice}g`}
              actionDisabled={!affordable}
              onAction={() => onBuy(item.id as unknown as string, item.buyPrice)}
            />
          )
        })}
      </div>

      <SectionLabel>
        Your Bag{inventoryItems.length > 0 ? ` · ${inventoryItems.length}` : ''}
      </SectionLabel>
      {inventoryItems.length === 0 && (
        <EmptyState
          glyph={<SatchelGlyph />}
          line="Your satchel is empty."
          hint="Spoils of the road and market buys gather here."
        />
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {inventoryItems.map((bagItem, idx) => {
          const item = ALL_ITEMS.find((i) => (i.id as unknown as string) === (bagItem.itemId as unknown as string))
          if (!item) return null
          return (
            <StockRow
              key={`${item.id as unknown as string}-${idx}`}
              item={item}
              price={item.sellPrice}
              affordable
              actionLabel="Sell"
              actionDisabled={false}
              onAction={() => onSell(item.id as unknown as string, item.sellPrice)}
            />
          )
        })}
      </div>
    </div>
  )
}
