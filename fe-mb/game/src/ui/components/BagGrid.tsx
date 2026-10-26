/**
 * ui/components/BagGrid.tsx — the company's 8×4 satchel (BRIEF §2.13 spatial bag): every entry drawn at its cell
 * spanning its `gridSize`, tinted by rarity, glyphed by kind; food shows its charges. One shared grid for the
 * shop (sell), the loadout and the field report so the bag never looks like two different objects.
 *
 * Test ids are keyed by CELL (`bag-<item>-<x>-<y>`), never by item id alone: the starting kit ships two ration
 * stacks, and a locator that matches twice is a locator no test can use. `data-item` stays for filtering.
 */
import React from 'react'
import { itemDef } from '../../engine/run/bag'
import type { BagEntry, EngineEnv, Item } from '../../engine/types'
import { Icon, type IconName } from './Icon'
import { useTip } from './Tooltip'

/** Item kind → the drawn glyph (BRIEF §5: no pictograph unicode; Chrome renders half of them as colour emoji). */
export const ITEM_ICON: Readonly<Record<Item['kind'], IconName>> = { food: 'food', potion: 'potion', weapon: 'weapon', shield: 'shield', quiver: 'quiver', tome: 'tome', staff: 'staff' }
export const RARITY_TINT: Readonly<Record<Item['rarity'], string>> = {
  common: 'var(--color-parchment-dim)',
  uncommon: 'var(--id-moss)',
  rare: 'var(--id-steel)',
  epic: 'var(--id-arcane)',
  legendary: 'var(--id-gold)',
}

export function BagGrid({ bag, env, cell = 46, selected, onSelect, disabledReason }: {
  readonly bag: readonly BagEntry[]
  readonly env: EngineEnv
  readonly cell?: number
  readonly selected?: { readonly x: number; readonly y: number } | null
  readonly onSelect?: (entry: BagEntry) => void
  readonly disabledReason?: (entry: BagEntry) => string | null
}): React.JSX.Element {
  const { width, height } = env.rules.bag
  return (
    <div className="bag" style={{ width: width * cell, height: height * cell, gridTemplateColumns: `repeat(${width}, ${cell}px)`, gridTemplateRows: `repeat(${height}, ${cell}px)` }} data-testid="bag">
      {Array.from({ length: width * height }, (_, i) => <span key={i} className="bag__cell" />)}
      {bag.map((e) => (
        <BagItem
          key={`${e.x},${e.y}`}
          entry={e}
          env={env}
          cell={cell}
          selected={selected !== null && selected !== undefined && selected.x === e.x && selected.y === e.y}
          reason={disabledReason?.(e) ?? null}
          {...(onSelect !== undefined ? { onSelect } : {})}
        />
      ))}
    </div>
  )
}

/**
 * One packed entry. A square with no room for its name (every 1×1) is the reason this carries a tip at all: the
 * name and, when it is refused, the reason both live on the glass — never in a `title=` the browser draws.
 */
function BagItem({ entry, env, cell, selected, reason, onSelect }: {
  readonly entry: BagEntry
  readonly env: EngineEnv
  readonly cell: number
  readonly selected: boolean
  readonly reason: string | null
  readonly onSelect?: (entry: BagEntry) => void
}): React.JSX.Element {
  const item = itemDef(entry.itemId, env)
  const { tipRef, tipProps, tip } = useTip(reason ?? item.name, reason !== null)
  return (
    <>
      <button
        ref={tipRef}
        type="button"
        className={`bag__item${selected ? ' bag__item--selected' : ''}`}
        style={{ left: entry.x * cell, top: entry.y * cell, width: item.gridSize.width * cell, height: item.gridSize.height * cell, '--rarity': RARITY_TINT[item.rarity], cursor: reason === null ? 'pointer' : 'default' } as React.CSSProperties}
        aria-label={item.name}
        aria-disabled={reason !== null || undefined}
        data-testid={`bag-${entry.itemId}-${entry.x}-${entry.y}`}
        data-item={entry.itemId}
        onClick={() => { if (reason === null) onSelect?.(entry) }}
        {...tipProps}
      >
        <span className="bag__glyph"><Icon name={ITEM_ICON[item.kind]} size={item.gridSize.width >= 2 ? 22 : 18} /></span>
        {item.gridSize.width >= 2 && <span className="bag__name">{item.name}</span>}
        {item.kind === 'food' && <span className="bag__charges numeral">×{entry.charges}</span>}
      </button>
      {tip}
    </>
  )
}
