import React, { useMemo, useState } from 'react'
import { useRunStore } from '../../state/runStore'
import { Dialog, Button, Heading } from '../components'
import { CharacterPortrait } from '../components/CharacterPortrait'
import { getItemDef } from '../../data/itemRegistry'
import { planEquip, type HandSlot } from '../../systems/equipment'
import { buildDeckForUnit } from '../../systems/deckBuilder'
import { RARITY_TEXT, RARITY_BORDER } from '../rarity'
import { isHandSlotItem } from '../../domain/item'
import { asItemId, asUnitId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'
import type { CardSource } from '../../domain/card'
import classesJson from '../../data/content/classes.json'
import cardsJson from '../../data/content/cards.json'

const CLASS_BY_ID = new Map(classesJson.map((c) => [c.id, c]))
const CARD_NAME = new Map(cardsJson.map((c) => [c.id, c.name]))
const DAMAGE_CARD_IDS = new Set(
  cardsJson.filter((c) => c.effects.some((e) => e.kind === 'Damage')).map((c) => c.id),
)

const SOURCE_LABEL: Record<CardSource, string> = {
  innate: 'Class',
  hand_left: 'Left hand',
  hand_right: 'Right hand',
}

export interface PartyLoadoutModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Gear-as-deck loadout screen (stories 459/460). Left: party roster + the
 * selected unit's two hand slots + the resulting deck grouped by source.
 * Right: the bag — gear rows offer Equip L/R (with disabled reasons from the
 * pure planEquip dry-run). All mutations via runStore dispatch.
 */
export function PartyLoadoutModal({ open, onClose }: PartyLoadoutModalProps): React.JSX.Element {
  const party = useRunStore((s) => s.party)
  const bag = useRunStore((s) => s.inventory.items)
  const dispatchRun = useRunStore((s) => s.dispatch)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const unitId = selectedId ?? (party.partyOrder[0] as unknown as string | undefined) ?? null
  const unit: Unit | undefined = unitId ? party.units[unitId] : undefined

  const deck = useMemo(() => {
    if (!unit) return null
    const cls = CLASS_BY_ID.get(unit.classId as unknown as string)
    return buildDeckForUnit(unit, {
      itemById: getItemDef,
      innateCardIds: cls?.innateCardIds ?? [],
      cardDealsDamage: (id) => DAMAGE_CARD_IDS.has(id),
    })
  }, [unit])

  const deckBySource = useMemo(() => {
    const groups: Record<CardSource, string[]> = { innate: [], hand_left: [], hand_right: [] }
    if (deck) {
      for (const id of [...deck.hand, ...deck.draw]) {
        const src = deck.sources?.[id as unknown as string] ?? 'innate'
        groups[src].push(id as unknown as string)
      }
    }
    return groups
  }, [deck])

  const slotItem = (slot: HandSlot): ReturnType<typeof getItemDef> => {
    const id = slot === 'left' ? unit?.handLeft : unit?.handRight
    return id ? getItemDef(id) : undefined
  }
  const leftIs2H = slotItem('left')?.twoHanded === true

  const equipInto = (slot: HandSlot, itemIdStr: string): void => {
    if (!unit) return
    dispatchRun({
      type: 'equipItem',
      payload: { unitId: asUnitId(unit.id as unknown as string), itemId: asItemId(itemIdStr), slot },
    })
  }
  const unequip = (slot: HandSlot): void => {
    if (!unit) return
    dispatchRun({ type: 'unequipItem', payload: { unitId: asUnitId(unit.id as unknown as string), slot } })
  }

  /** Dry-run an equip so the button can carry a disabled reason. */
  const equipReason = (slot: HandSlot, itemIdStr: string): string | null => {
    if (!unit) return 'no unit selected'
    const plan = planEquip(unit, slot, asItemId(itemIdStr), bag, getItemDef)
    return plan.ok ? null : plan.reason
  }

  const renderSlot = (slot: HandSlot): React.JSX.Element => {
    const item = slotItem(slot)
    const locked = slot === 'right' && leftIs2H
    return (
      <div
        id={`hand-slot-${slot}`}
        className={
          'flex-1 border rounded p-3 min-h-[72px] flex flex-col justify-between ' +
          (item ? RARITY_BORDER[item.rarity] : 'border-stone-800 border-dashed')
        }
      >
        <div className="text-[0.6rem] uppercase tracking-[0.18em] text-parchment-dim">
          {slot === 'left' ? 'Left hand' : 'Right hand'}
        </div>
        {locked ? (
          <div className="text-stone-600 italic text-xs">Locked — two-handed weapon</div>
        ) : item ? (
          <>
            <div className={`text-sm ${RARITY_TEXT[item.rarity]}`}>{item.name}</div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-stone-500">
                {item.kind}{item.twoHanded ? ' · 2H' : ''} · {item.gearCardIds?.length ?? 0} cards
              </span>
              <Button
                variant="ghost"
                onPress={() => unequip(slot)}
                className="!px-2 !py-0.5 !text-[10px]"
              >
                Unequip
              </Button>
            </div>
          </>
        ) : (
          <div className="text-stone-600 italic text-xs">Empty</div>
        )}
      </div>
    )
  }

  const gearInBag = bag.filter((b) => {
    const def = getItemDef(b.itemId)
    return def && isHandSlotItem(def)
  })
  const consumablesCount = bag.length - gearInBag.length

  return (
    <Dialog isOpen={open} onOpenChange={(o) => { if (!o) onClose() }} aria-label="Party Loadout">
      <div id="party-loadout-panel" className="flex gap-5 min-w-[720px] max-w-[860px] max-h-[78vh]">
        {/* Left: roster + slots + deck */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex justify-between items-center border-b border-stone-800 pb-2">
            <Heading level={2} className="text-lg tracking-widest m-0">Party Loadout</Heading>
          </div>

          <div className="flex gap-2 flex-wrap">
            {party.partyOrder.map((uid) => {
              const u = party.units[uid as unknown as string]
              if (!u) return null
              const active = (uid as unknown as string) === unitId
              return (
                <Button
                  key={uid as unknown as string}
                  variant={active ? 'primary' : 'secondary'}
                  onPress={() => setSelectedId(uid as unknown as string)}
                  className="!px-2 !py-1 flex items-center gap-2"
                >
                  <CharacterPortrait speaker={u.name} size={22} active={active} />
                  <span className="text-xs">{u.name}</span>
                </Button>
              )
            })}
          </div>

          {unit && (
            <>
              <div className="flex gap-3">
                {renderSlot('left')}
                {renderSlot('right')}
              </div>

              <div className="border border-stone-800 rounded p-3">
                <div className="text-[0.6rem] uppercase tracking-[0.18em] text-parchment-dim mb-2">
                  Deck next battle · {(deck?.hand.length ?? 0) + (deck?.draw.length ?? 0)} cards
                </div>
                {(Object.keys(deckBySource) as CardSource[]).map((src) =>
                  deckBySource[src].length === 0 ? null : (
                    <div key={src} className="mb-1.5">
                      <span className="text-[10px] text-stone-500 mr-2">{SOURCE_LABEL[src]}:</span>
                      <span className="text-xs text-amber-100">
                        {deckBySource[src].map((id) => CARD_NAME.get(id) ?? id).join(', ')}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: bag */}
        <div className="w-[300px] flex flex-col gap-2 overflow-y-auto border-l border-stone-800 pl-4">
          <div className="flex justify-between items-center border-b border-stone-800 pb-2">
            <Heading level={3} className="text-sm tracking-widest m-0">Bag</Heading>
            <Button variant="ghost" onPress={onClose} className="text-amber-400 !px-2 !py-0.5" aria-label="Close">×</Button>
          </div>
          {gearInBag.length === 0 && (
            <div className="text-stone-600 italic text-xs py-4">No gear in the bag.</div>
          )}
          {gearInBag.map((b, i) => {
            const def = getItemDef(b.itemId)!
            const reasonL = equipReason('left', b.itemId as unknown as string)
            const reasonR = def.twoHanded ? 'two-handed — equips into the left hand' : equipReason('right', b.itemId as unknown as string)
            return (
              <div
                key={`${b.itemId as unknown as string}-${i}`}
                className={`border rounded p-2 ${RARITY_BORDER[def.rarity]}`}
              >
                <div className={`text-xs ${RARITY_TEXT[def.rarity]}`}>{def.name}</div>
                <div className="text-[10px] text-stone-500 mb-1.5">
                  {def.kind}{def.twoHanded ? ' · 2H' : ''} · {def.rarity}
                  {def.quiverModifier ? ` · ${def.quiverModifier.kind}` : ''}
                </div>
                <div className="flex gap-1.5">
                  <span title={reasonL ?? undefined} className="flex-1">
                    <Button
                      variant="secondary"
                      isDisabled={reasonL !== null}
                      onPress={() => equipInto('left', b.itemId as unknown as string)}
                      className="!px-2 !py-0.5 !text-[10px] w-full"
                    >
                      Equip L
                    </Button>
                  </span>
                  <span title={reasonR ?? undefined} className="flex-1">
                    <Button
                      variant="secondary"
                      isDisabled={reasonR !== null}
                      onPress={() => equipInto('right', b.itemId as unknown as string)}
                      className="!px-2 !py-0.5 !text-[10px] w-full"
                    >
                      Equip R
                    </Button>
                  </span>
                </div>
              </div>
            )
          })}
          {consumablesCount > 0 && (
            <div className="text-[10px] text-stone-600 pt-1">
              +{consumablesCount} consumable{consumablesCount === 1 ? '' : 's'} (food, potions)
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
