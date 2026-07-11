import React, { useMemo, useState } from 'react'
import { useRunStore } from '../../state/runStore'
import { Dialog, Button, Heading, Icon, Tooltip } from '../components'
import { CharacterPortrait } from '../components/CharacterPortrait'
import { getItemDef } from '../../data/itemRegistry'
import { planEquip, type HandSlot } from '../../systems/equipment'
import { buildDeckForUnit } from '../../systems/deckBuilder'
import { RARITY_TEXT } from '../rarity'
import { isHandSlotItem } from '../../domain/item'
import { asItemId, asUnitId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'
import type { CardSource } from '../../domain/card'
import type { Rarity } from '../../domain/item'
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

/** planEquip reasons are engine prose — translate to player fiction for tooltips. */
function reasonFiction(reason: string): string {
  if (reason === 'two-handed') return 'Needs both hands — it will take the left slot.'
  if (reason.startsWith('unknown item')) return 'This piece is beyond use.'
  if (reason.includes('off-hand is locked')) return 'Both hands grip the two-handed weapon.'
  if (reason.includes('bag is full')) return 'The bag is full — nothing can be swapped out.'
  if (reason.includes('not equippable')) return 'This cannot be wielded.'
  if (reason.includes('not in the bag')) return 'It is no longer in the bag.'
  if (reason.includes('no unit selected')) return 'Choose who will carry it first.'
  return reason
}

/** 6px rarity gem — rarity reads as a color mark next to the name, never a full outline. */
function GemDot({ rarity }: { rarity: Rarity }): React.JSX.Element {
  return (
    <span className={`inline-flex shrink-0 ${RARITY_TEXT[rarity]}`} aria-hidden>
      <svg width={6} height={6} viewBox="0 0 6 6">
        <circle cx={3} cy={3} r={3} fill="currentColor" />
      </svg>
    </span>
  )
}

/** Faint sword silhouette watermark for empty hand slots (no sword in the shared Icon set). */
function SwordGlyph({ size = 26, className }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M19 3 L9 13" />
      <path d="M19 3 L21 5 L11 15 L9 13 Z" />
      <path d="M7 12 L12 17" />
      <path d="M6.5 17.5 L5 19" />
      <path d="M4 16 L8 20" />
    </svg>
  )
}

/** Equip button that carries its disabled reason as a styled tooltip (never title=). */
function EquipButton({
  label,
  reason,
  onPress,
}: {
  label: string
  reason: string | null
  onPress: () => void
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const disabled = reason !== null
  const btn = (
    <Button
      variant="primary"
      isDisabled={disabled}
      onPress={onPress}
      className="!px-2 !py-0.5 !text-[10px] w-full data-[disabled]:pointer-events-none"
    >
      {label}
    </Button>
  )
  if (!disabled) return <span className="flex-1">{btn}</span>
  return (
    <span
      className="flex-1"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Tooltip trigger={btn} content={reasonFiction(reason)} isOpen={hovered} placement="top" />
    </span>
  )
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
    const cardCount = item?.gearCardIds?.length ?? 0
    return (
      <div
        id={`hand-slot-${slot}`}
        className={
          'flex-1 min-h-[76px] flex flex-col gap-1 p-3 rounded-[var(--radius-md)] ' +
          (item
            ? 'surface-iron'
            : 'border border-dashed border-[rgba(120,98,60,0.35)]')
        }
      >
        <div className="text-[0.6rem] uppercase tracking-[0.18em] text-parchment-dim">
          {slot === 'left' ? 'Left hand' : 'Right hand'}
        </div>
        {locked ? (
          <div className="flex flex-1 items-center gap-2">
            <SwordGlyph size={18} className="shrink-0 opacity-30 text-[color:var(--color-parchment-dim)]" />
            <span className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
              Locked — two-handed weapon
            </span>
          </div>
        ) : item ? (
          <>
            <div className="flex items-center gap-1.5">
              <GemDot rarity={item.rarity} />
              <span className={`font-body text-sm ${RARITY_TEXT[item.rarity]}`}>{item.name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="numeral text-sm text-[color:var(--color-parchment)]">
                  {cardCount > 0 ? `+${cardCount} cards` : '—'}
                </span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                  {item.kind}{item.twoHanded ? ' · 2H' : ''}
                </span>
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
          <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
            <SwordGlyph size={22} className="opacity-20 text-[color:var(--color-parchment-dim)]" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
              Empty
            </span>
          </div>
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
      <div id="party-loadout-panel" className="flex flex-col gap-4 min-w-[720px] max-w-[860px] max-h-[78vh] select-none">
        <div className="hud-panel-header flex items-center justify-between pb-2">
          <Heading level={2} className="voice-display m-0 text-lg tracking-widest text-[color:var(--color-parchment)]">
            Party Loadout
          </Heading>
          <Button variant="ghost" onPress={onClose} className="!px-2 !py-1" aria-label="Close">
            <Icon name="cross" size={14} />
          </Button>
        </div>

        <div className="flex min-h-0 gap-5">
          {/* Left: roster + slots + deck */}
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
            <div className="flex gap-2 flex-wrap">
              {party.partyOrder.map((uid) => {
                const u = party.units[uid as unknown as string]
                if (!u) return null
                const active = (uid as unknown as string) === unitId
                return (
                  <Button
                    key={uid as unknown as string}
                    variant="ghost"
                    onPress={() => setSelectedId(uid as unknown as string)}
                    className="!px-2.5 !py-1.5 flex items-center gap-2"
                    {...(active
                      ? {
                          style: {
                            background: 'linear-gradient(158deg, var(--iron-700), var(--iron-900))',
                            boxShadow: 'var(--bevel-iron), inset 2px 0 0 var(--color-hearth)',
                            color: 'var(--color-parchment)',
                          },
                        }
                      : {})}
                  >
                    <span className={active ? '' : 'opacity-60'}>
                      <CharacterPortrait speaker={u.name} size={22} active={active} />
                    </span>
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

                <div id="deck-preview" className="surface-parchment rounded-[var(--radius-md)] p-3">
                  <div className="mb-2 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)] opacity-70">
                    Deck next battle · {(deck?.hand.length ?? 0) + (deck?.draw.length ?? 0)} cards
                  </div>
                  {(Object.keys(deckBySource) as CardSource[]).map((src) =>
                    deckBySource[src].length === 0 ? null : (
                      <div key={src} className="mb-2 last:mb-0">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-ink)] opacity-55">
                          {SOURCE_LABEL[src]}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {deckBySource[src].map((id, i) => (
                            <span
                              key={`${id}-${i}`}
                              className="surface-iron inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 font-body text-xs text-[color:var(--color-parchment)]"
                            >
                              {CARD_NAME.get(id) ?? 'Unnamed card'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </>
            )}
          </div>

          <div className="hud-divider" />

          {/* Right: bag */}
          <div className="w-[300px] flex flex-col gap-2 overflow-y-auto">
            <div className="hud-panel-header pb-2">
              <Heading level={3} className="voice-display m-0 text-sm tracking-widest text-[color:var(--color-parchment)]">
                Bag
              </Heading>
            </div>
            {gearInBag.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <Icon name="treasure" size={40} className="opacity-25 text-[color:var(--color-parchment-dim)]" />
                <div className="font-body text-xs text-[color:var(--color-parchment-dim)]">
                  No gear in the bag.
                </div>
                <div className="font-body text-[10px] text-[color:var(--color-text-muted)]">
                  Shops and battlefields will fill it.
                </div>
              </div>
            )}
            {gearInBag.map((b, i) => {
              const def = getItemDef(b.itemId)!
              const reasonL = equipReason('left', b.itemId as unknown as string)
              const reasonR = def.twoHanded
                ? 'two-handed'
                : equipReason('right', b.itemId as unknown as string)
              const cardCount = def.gearCardIds?.length ?? 0
              return (
                <div
                  key={`${b.itemId as unknown as string}-${i}`}
                  className="surface-iron rounded-[var(--radius-md)] p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <GemDot rarity={def.rarity} />
                      <span className={`font-body text-xs ${RARITY_TEXT[def.rarity]}`}>{def.name}</span>
                    </span>
                    <span className="numeral shrink-0 text-sm text-[color:var(--color-parchment)]">
                      {cardCount > 0 ? `+${cardCount} cards` : '—'}
                    </span>
                  </div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                    {def.kind}{def.twoHanded ? ' · 2H' : ''}
                    {def.quiverModifier ? ` · ${def.quiverModifier.kind}` : ''}
                  </div>
                  <div className="flex gap-1.5">
                    <EquipButton
                      label="Equip L"
                      reason={reasonL}
                      onPress={() => equipInto('left', b.itemId as unknown as string)}
                    />
                    <EquipButton
                      label="Equip R"
                      reason={reasonR}
                      onPress={() => equipInto('right', b.itemId as unknown as string)}
                    />
                  </div>
                </div>
              )
            })}
            {consumablesCount > 0 && (
              <div className="pt-1 text-[10px] text-[color:var(--color-text-muted)]">
                +{consumablesCount} consumable{consumablesCount === 1 ? '' : 's'} (food, potions)
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
