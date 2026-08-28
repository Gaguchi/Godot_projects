import React from 'react'
import { useRunStore } from '../../../state/runStore'
import itemsJson from '../../../data/content/items.json'
import { asItemId } from '../../../domain/ids'
import type { TownDef } from '../../../domain/town'
import type { Item, ItemKind, QuiverModifierKind } from '../../../domain/item'
import { Button } from '../../components'
import { shopStockFor } from '../../../systems/shopStock'
import { RARITY_TEXT, RARITY_EDGE } from '../../rarity'
import {
  CardsGlyph, ColumnHeader, EmptyState, EntryHeading, INK_RULE, KindSocket, SatchelGlyph, SectionLabel,
  type ColumnSpec,
} from './townUi'

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

/**
 * The stock column. Every row hangs off these same stops, so the prices line
 * up as a real money column instead of a per-card readout.
 */
const COLS: React.CSSProperties = {
  gridTemplateColumns: '1.75rem minmax(0,1fr) 3.25rem 5rem 5.75rem',
}
const STOCK_COLS: readonly ColumnSpec[] = [
  { label: '' },
  { label: 'Goods' },
  { label: 'Cards', align: 'right' },
  { label: 'Price', align: 'right' },
  { label: '' },
]
const BAG_COLS: readonly ColumnSpec[] = [
  { label: '' },
  { label: 'Carried' },
  { label: 'Cards', align: 'right' },
  { label: 'Sells for', align: 'right' },
  { label: '' },
]

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
  /** Spoken label — the visible tab is two words; the reason belongs in both. */
  actionAria: string
  actionDisabled: boolean
  onAction: () => void
  probe?: string | undefined
}

/**
 * A shop row as a LEDGER ENTRY: a stamped kind glyph, the goods written in the
 * page hand, the price in the money column, and one leather tab to act on it.
 * Rarity is a marginal tick on the left rule plus the name's ink hue — never a
 * card well, never a saturated border.
 */
function StockRow({ item, price, affordable, actionLabel, actionAria, actionDisabled, onAction, probe }: StockRowProps): React.JSX.Element {
  const cardCount = item.gearCardIds?.length ?? 0
  return (
    <div
      className={`grid items-center gap-3 border-l-2 py-1.5 pl-2.5 ${RARITY_EDGE[item.rarity]}`}
      style={{ ...COLS, borderBottom: `1px solid ${INK_RULE}` }}
    >
      <KindSocket kind={item.kind} />
      <div className="min-w-0">
        <div
          data-probe={probe}
          className={`voice-display truncate text-[0.98rem] leading-tight ${RARITY_TEXT[item.rarity]}`}
        >
          {item.name}
        </div>
        <div
          data-probe="item-traits"
          className="mt-0.5 text-[0.58rem] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]"
        >
          {itemTraits(item)}
        </div>
      </div>
      {cardCount > 0 ? (
        <span
          className="flex items-center justify-end gap-1 text-[color:var(--color-parchment-dim)]"
          aria-label={`grants ${cardCount} cards`}
        >
          <CardsGlyph size={12} />
          <span className="numeral text-[0.72rem]">{cardCount}</span>
        </span>
      ) : (
        <span aria-hidden />
      )}
      <span
        data-probe={affordable ? 'price-affordable' : 'price-unaffordable'}
        className={`numeral text-right text-[1.05rem] leading-none ${
          affordable ? 'text-[color:var(--color-hearth-soft)]' : 'text-[color:var(--color-damage-text)]'
        }`}
      >
        {price}
        <span className="text-[0.68rem]">g</span>
      </span>
      {/* Leather ONLY where the row can actually be acted on. A row you cannot
          afford keeps its control (and its reason) but loses the material, so
          a page of stock reads as "these four are yours to take" at a glance
          instead of a column of identical slabs. */}
      <Button
        variant={actionDisabled ? 'ghost' : 'secondary'}
        isDisabled={actionDisabled}
        onPress={onAction}
        aria-label={actionAria}
        className={
          '!w-full !px-2 !py-1 !text-[0.6rem] !tracking-[0.12em] '
          + (actionDisabled
            ? '!justify-end !opacity-100 !text-[color:var(--color-text-muted)]'
            : '')
        }
      >
        {actionLabel}
      </Button>
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

  // Probe hooks for the contrast audit: first row of each rarity band.
  const firstCommon = shopStock.find((i) => i.rarity === 'common')?.id
  const firstUncommon = shopStock.find((i) => i.rarity === 'uncommon')?.id

  return (
    <div id="shop-panel" className="max-w-[44rem]">
      <EntryHeading title="The Shop" blurb="Steel, salves, and traveling rations — priced as the ledger finds them." />

      <SectionLabel className="mt-7">Stock</SectionLabel>
      <div>
        <ColumnHeader cols={STOCK_COLS} style={COLS} className="border-l-2 border-transparent pl-2.5" />
        {shopStock.map((item) => {
          const affordable = gold >= item.buyPrice
          const id = item.id as unknown as string
          return (
            <StockRow
              key={id}
              item={item}
              price={item.buyPrice}
              affordable={affordable}
              actionLabel={affordable ? 'Buy' : `Short ${item.buyPrice - gold}g`}
              actionAria={
                affordable
                  ? `Buy ${item.name} for ${item.buyPrice} gold`
                  : `Cannot buy ${item.name} — ${item.buyPrice - gold} gold short of ${item.buyPrice}`
              }
              actionDisabled={!affordable}
              onAction={() => onBuy(id, item.buyPrice)}
              probe={
                item.id === firstCommon ? 'item-name-common'
                  : item.id === firstUncommon ? 'item-name-uncommon'
                    : undefined
              }
            />
          )
        })}
      </div>

      <SectionLabel className="mt-9">
        Your Bag{inventoryItems.length > 0 ? ` · ${inventoryItems.length}` : ''}
      </SectionLabel>
      {inventoryItems.length === 0 ? (
        <EmptyState
          glyph={<SatchelGlyph />}
          line="Your satchel is empty."
          hint="Spoils of the road and market buys gather here."
        />
      ) : (
        <div>
          <ColumnHeader cols={BAG_COLS} style={COLS} className="border-l-2 border-transparent pl-2.5" />
          {inventoryItems.map((bagItem, idx) => {
            const item = ALL_ITEMS.find((i) => (i.id as unknown as string) === (bagItem.itemId as unknown as string))
            if (!item) return null
            const id = item.id as unknown as string
            return (
              <StockRow
                key={`${id}-${idx}`}
                item={item}
                price={item.sellPrice}
                affordable
                actionLabel="Sell"
                actionAria={`Sell ${item.name} for ${item.sellPrice} gold`}
                actionDisabled={false}
                onAction={() => onSell(id, item.sellPrice)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
