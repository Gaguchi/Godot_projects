import React, { useMemo, useState } from 'react'
import { useRunStore } from '../../state/runStore'
import { Dialog, Button, Heading, Icon, Tooltip } from '../components'
import { CharacterPortrait } from '../components/CharacterPortrait'
import { getItemDef } from '../../data/itemRegistry'
import { planEquip, type HandSlot } from '../../systems/equipment'
import { buildDeckForUnit } from '../../systems/deckBuilder'
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

/* ------------------------------------------------------------------------- */
/* Ledger page furniture (tokens only)                                        */
/* ------------------------------------------------------------------------- */

/** Flat ink rule — a page is ruled in ink, never with a glowing seam. */
function Rule({ className, weight = 0.28 }: { className?: string; weight?: number }): React.JSX.Element {
  return (
    <div aria-hidden className={`h-px ${className ?? ''}`} style={{ background: `rgba(42,33,25,${weight})` }} />
  )
}

/**
 * The quartermaster's ledger page: linen ground, feint ruling, the double
 * margin rule, brass pins at the corners. Decorative only.
 *
 * The gradient stops at `--canvas-mid` instead of running down to
 * `--canvas-deep` — the bake-off audit measured muted text at 4.16:1 over the
 * deep band, and this page carries small text (bag kind lines, ×N badges)
 * right down to its foot. Capping at mid keeps every pair above AA.
 */
function Sheet({ ruleGap = 30, gutter = 26 }: { ruleGap?: number; gutter?: number }): React.JSX.Element {
  const pins: React.CSSProperties[] = [
    { top: 8, left: 8 }, { top: 8, right: 8 }, { bottom: 8, left: 8 }, { bottom: 8, right: 8 },
  ]
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(168deg, #f3ecda 0%, var(--canvas-base) 42%, var(--canvas-mid) 100%)' }}
      />
      <div
        aria-hidden
        className="iron-grain pointer-events-none absolute inset-0"
        style={{ mixBlendMode: 'multiply', opacity: 0.4 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0 ${ruleGap - 1}px, rgba(42,33,25,0.09) ${ruleGap - 1}px ${ruleGap}px)`,
        }}
      />
      {[0, 4].map((dx) => (
        <div
          key={dx}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px"
          style={{ left: gutter + dx, background: dx === 0 ? 'rgba(42,33,25,0.34)' : 'rgba(42,33,25,0.16)' }}
        />
      ))}
      {pins.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute h-2 w-2 rounded-full"
          style={{
            ...pos,
            background: 'radial-gradient(circle at 36% 32%, #f0d79a 0%, var(--iron-edge) 52%, #6d5218 100%)',
            boxShadow: '0 1px 2px rgba(46,32,16,0.5)',
          }}
        />
      ))}
    </>
  )
}

/** Column heading in the ledger's small hand. */
function ColumnHead({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="voice-display pb-1.5 text-[0.6rem] uppercase tracking-[0.24em] text-[color:var(--color-text-muted)]">
      {children}
    </div>
  )
}

/**
 * Rarity ink for a LINEN page.
 *
 * `ui/rarity.ts` mixes each hue toward `--color-parchment`, which the page
 * scope redefines as walnut — so four of the five re-resolve to page-safe ink
 * on their own. LEGENDARY does not: at its 72% brass mix it measured 3.30:1 on
 * `--canvas-base` / 2.94:1 on `--canvas-mid`, well under the AA contract. This
 * table is the page-side ramp, identical to `RARITY_TEXT`'s mixes except that
 * legendary is pulled to 45% (5.52:1 / 4.92:1) — still unmistakably dark gold.
 * `ui/rarity.ts` is owned elsewhere this wave; it should absorb this table.
 */
const RARITY_INK: Record<Rarity, string> = {
  common: 'var(--color-parchment)',
  uncommon: 'color-mix(in oklab, var(--color-gem-ward) 55%, var(--color-parchment))',
  rare: 'color-mix(in oklab, var(--color-ally) 65%, var(--color-parchment))',
  epic: 'color-mix(in oklab, var(--color-gem-arcane) 60%, var(--color-parchment))',
  legendary: 'color-mix(in oklab, var(--color-gem-focus) 45%, var(--color-parchment))',
}

/** Per-rarity gem SHAPE, drawn in an 8×8 box. Shape is the primary channel so
 *  rarity survives a colour-blind read; the ink is the secondary one. */
const RARITY_GEM: Record<Rarity, React.JSX.Element> = {
  common: <circle cx={4} cy={4} r={2.6} fill="currentColor" />,
  uncommon: <rect x={1.4} y={1.4} width={5.2} height={5.2} fill="currentColor" />,
  rare: <path d="M4 0.7 L7.3 4 L4 7.3 L0.7 4 Z" fill="currentColor" />,
  epic: <path d="M4 0.6 L7.4 6.9 H0.6 Z" fill="currentColor" />,
  legendary: <path d="M4 0 L5.1 2.9 L8 4 L5.1 5.1 L4 8 L2.9 5.1 L0 4 L2.9 2.9 Z" fill="currentColor" />,
}

/** Rarity mark beside a name: shape carries the rank, ink repeats it. */
function GemDot({ rarity }: { rarity: Rarity }): React.JSX.Element {
  return (
    <span className="inline-flex shrink-0" style={{ color: RARITY_INK[rarity] }} aria-hidden>
      <svg width={8} height={8} viewBox="0 0 8 8">
        {RARITY_GEM[rarity]}
      </svg>
    </span>
  )
}

/** Rarity as a 3px inked edge down the left of a well — the same ink the name
 *  carries, so the two can never drift. */
function RarityEdge({ rarity }: { rarity: Rarity }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
      style={{ background: RARITY_INK[rarity] }}
    />
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

/**
 * The equip control — the ONE material that acts on this page.
 *
 * Only the bag line currently under the pointer/keyboard is "on the table", and
 * only its controls turn to saddle leather (its Equip L is the page's single
 * primary; Equip R the plain strap beside it). Every other line's controls stay
 * flat ink chips, so the page never shows a row of competing lit buttons — the
 * exact drift the prior audit flagged.
 *
 * Disabled does NOT mean faded here: `.btn-forged[data-disabled]` drops to 0.52
 * opacity, which on linen sinks the label below AA. The inline override keeps
 * it fully opaque and states the refusal in walnut ink, with the reason carried
 * by the styled Tooltip (never a `title=`).
 */
function EquipButton({
  label,
  reason,
  onPress,
  lit,
  primary,
}: {
  label: string
  reason: string | null
  onPress: () => void
  /** This line is the one under the pointer/keyboard. */
  lit: boolean
  /** Left hand — the page's single primary action when lit. */
  primary: boolean
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const disabled = reason !== null
  const variant = disabled || !lit ? 'ghost' : primary ? 'primary' : 'secondary'
  const btn = (
    <Button
      variant={variant}
      isDisabled={disabled}
      onPress={onPress}
      className={
        '!py-1 !text-[0.6rem] !tracking-[0.14em] data-[disabled]:pointer-events-none ' +
        (disabled
          // Struck out, the way a ledger closes a line — a SHAPE cue, so the
          // refusal never depends on the ink going paler.
          ? '!px-1.5 !text-[color:var(--color-text-muted)] line-through decoration-[rgba(42,33,25,0.5)] '
          : !lit
            ? '!px-1.5 !text-[color:var(--color-parchment-dim)] data-[hovered]:!border-transparent '
            : '!px-3 ')
      }
      {...(disabled
        ? { style: { opacity: 1, filter: 'none' } }
        : {})}
    >
      {label}
    </Button>
  )
  if (!disabled) return btn
  return (
    <span
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
 * Gear-as-deck loadout screen (stories 459/460), re-grounded as the FIELD
 * LEDGER's centre spread: the quartermaster's own page. Left column is the
 * muster — who is on the books, what is in their two hands, and the deck those
 * hands will deal next battle. Right column is the bag manifest, one line per
 * piece of gear with a ×N tally for duplicates.
 *
 * Everything is walnut ink on linen; the only saddle leather on the page is the
 * equip control of the line you are actually on. All mutations still go through
 * runStore dispatch and the pure `planEquip` dry-run supplies every refusal.
 */
export function PartyLoadoutModal({ open, onClose }: PartyLoadoutModalProps): React.JSX.Element {
  const party = useRunStore((s) => s.party)
  const bag = useRunStore((s) => s.inventory.items)
  const dispatchRun = useRunStore((s) => s.dispatch)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Which bag line is "on the table" — follows pointer and keyboard focus. */
  const [litItemId, setLitItemId] = useState<string | null>(null)

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

  /**
   * A hand slot as a ruled WELL on the page: a shallow linen recess with an
   * inked edge, and — when something is in it — that piece's rarity struck down
   * the left edge in the same ink the name carries. An empty slot is a blank
   * ruled well with a watermark, never a dark void.
   */
  const renderSlot = (slot: HandSlot): React.JSX.Element => {
    const item = slotItem(slot)
    const locked = slot === 'right' && leftIs2H
    const cardCount = item?.gearCardIds?.length ?? 0
    return (
      <div
        id={`hand-slot-${slot}`}
        className="relative flex min-h-[82px] flex-1 flex-col gap-1 overflow-hidden rounded-[var(--radius-sm)] py-2 pl-3 pr-2.5"
        style={
          item
            ? { background: 'rgba(42,33,25,0.055)', boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.26)' }
            : { boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.18)' }
        }
      >
        {item && <RarityEdge rarity={item.rarity} />}
        {/* slot header — the label hangs left, the release control right, so a
            long item name below can never crowd it off the well (it clipped to
            "UNEQUI" when both shared the value line). */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.58rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
            {slot === 'left' ? 'Left hand' : 'Right hand'}
          </span>
          {/* the ink chip is drawn with BORDER-colour, not an inline box-shadow:
              an inline shadow would outrank `--focus-ring` and leave keyboard
              users with no visible focus. */}
          {item && !locked && (
            <Button
              variant="ghost"
              onPress={() => unequip(slot)}
              className="!px-1.5 !py-0 !text-[0.58rem] !tracking-[0.14em] !text-[color:var(--color-parchment-dim)] !border-[color:rgba(42,33,25,0.3)]"
            >
              Unequip
            </Button>
          )}
        </div>
        {locked ? (
          <div className="flex flex-1 items-center gap-2">
            <SwordGlyph size={18} className="shrink-0 text-[color:var(--color-parchment-dim)] opacity-40" />
            <span className="font-body text-[0.72rem] italic text-[color:var(--color-text-muted)]">
              Locked — two-handed weapon
            </span>
          </div>
        ) : item ? (
          <>
            <div className="flex items-center gap-1.5">
              <GemDot rarity={item.rarity} />
              <span
                className="voice-display text-[0.9rem] tracking-[0.03em]"
                style={{ color: RARITY_INK[item.rarity] }}
              >
                {item.name}
              </span>
            </div>
            <span className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="numeral text-base text-[color:var(--color-parchment)]">
                {cardCount > 0 ? `+${cardCount} cards` : '—'}
              </span>
              <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
                {item.kind}{item.twoHanded ? ' · 2H' : ''}
              </span>
            </span>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
            <SwordGlyph size={22} className="text-[color:var(--color-parchment-dim)] opacity-25" />
            <span className="font-body text-[0.72rem] italic text-[color:var(--color-text-muted)]">
              empty
            </span>
          </div>
        )}
      </div>
    )
  }

  /**
   * Display stacking: the bag stores one entry per item COPY (def ids, no
   * instance ids), so duplicates would render as identical lines. Group by
   * definition id — one line per def with a ×N tally. Equip dispatches carry
   * the def id and planEquip removes the FIRST matching bag entry, so
   * equipping from a stacked line consumes exactly one copy.
   */
  const gearStacks = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of bag) {
      const def = getItemDef(b.itemId)
      if (!def || !isHandSlotItem(def)) continue
      const id = b.itemId as unknown as string
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, def: getItemDef(id)!, count }))
      .sort((a, b) => a.def.name.localeCompare(b.def.name))
  }, [bag])
  const gearCount = gearStacks.reduce((sum, s) => sum + s.count, 0)
  const consumablesCount = bag.length - gearCount

  // The lit line survives the stack it pointed at being consumed by an equip.
  const litId = gearStacks.some((s) => s.id === litItemId) ? litItemId : null

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      aria-label="Party Loadout"
      unpadded
      className="w-[860px]"
    >
      <div
        id="party-loadout-panel"
        className="page-canvas relative max-h-[80vh] cursor-default select-none overflow-hidden rounded-[var(--radius-md)]"
        style={{ background: 'var(--canvas-base)' }}
      >
        <Sheet />

        <div className="relative flex max-h-[80vh] flex-col pb-5 pl-[42px] pr-6 pt-5">
          {/* Page head */}
          <div className="flex items-start justify-between pb-2.5 pt-1">
            <div>
              <Heading
                level={2}
                /* `!` beats Heading.tsx's baked-in `text-amber-100` — a same-rank
                   utility that would otherwise keep the title bone-white on linen. */
                className="voice-display m-0 text-lg uppercase !tracking-[0.26em] !text-[color:var(--color-parchment)]"
              >
                Party Loadout
              </Heading>
              <p className="mb-0 mt-1 font-body text-xs italic text-[color:var(--color-parchment-dim)]">
                hands and bag, as issued
              </p>
            </div>
            <Button
              variant="ghost"
              onPress={onClose}
              className="!px-2 !py-1 text-[color:var(--color-parchment-dim)]"
              aria-label="Close"
            >
              <Icon name="cross" size={16} />
            </Button>
          </div>
          <Rule weight={0.46} />
          <div className="h-[3px]" />
          <Rule weight={0.22} />

          {/* flex-1 + min-h-0 on the spread AND on each column is what lets the
              two halves scroll inside the page instead of running off its foot */}
          <div className="mt-3 flex min-h-0 flex-1 gap-6">
            {/* ---- Left: the muster, the two hands, the resulting deck ---- */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              <div>
                <ColumnHead>Muster</ColumnHead>
                <div className="flex flex-wrap gap-1.5">
                  {party.partyOrder.map((uid) => {
                    const u = party.units[uid as unknown as string]
                    if (!u) return null
                    const active = (uid as unknown as string) === unitId
                    return (
                      <Button
                        key={uid as unknown as string}
                        variant="ghost"
                        onPress={() => setSelectedId(uid as unknown as string)}
                        className={
                          'relative !px-2 !py-1.5 flex items-center gap-2 data-[hovered]:!border-transparent ' +
                          (active
                            ? '!text-[color:var(--color-parchment)]'
                            : '!text-[color:var(--color-parchment-dim)]')
                        }
                      >
                        {/* the tab's ink edge + brass margin-pin live on a
                            decorative layer, NOT the button's own box-shadow —
                            an inline shadow would outrank `--focus-ring`. */}
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0"
                          style={
                            active
                              ? {
                                background: 'rgba(42,33,25,0.07)',
                                boxShadow: 'inset 3px 0 0 var(--iron-edge), inset 0 0 0 1px rgba(42,33,25,0.26)',
                              }
                              : { boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.14)' }
                          }
                        />
                        <span className={`relative flex ${active ? '' : 'opacity-70'}`}>
                          <CharacterPortrait
                            speaker={u.name}
                            unitId={u.id as unknown as string}
                            classId={u.classId as unknown as string}
                            size={22}
                            active={active}
                          />
                        </span>
                        <span className="voice-display relative text-[0.78rem] tracking-[0.04em]">{u.name}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>

              {unit && (
                <>
                  <div>
                    <ColumnHead>In hand</ColumnHead>
                    <div className="flex gap-3">
                      {renderSlot('left')}
                      {renderSlot('right')}
                    </div>
                  </div>

                  <div
                    id="deck-preview"
                    className="rounded-[var(--radius-sm)] px-3 py-2.5"
                    style={{ background: 'rgba(42,33,25,0.05)', boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.2)' }}
                  >
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="voice-display text-[0.6rem] uppercase tracking-[0.24em] text-[color:var(--color-text-muted)]">
                        Deck next battle · {(deck?.hand.length ?? 0) + (deck?.draw.length ?? 0)} cards
                      </span>
                    </div>
                    {(Object.keys(deckBySource) as CardSource[]).map((src) =>
                      deckBySource[src].length === 0 ? null : (
                        <div key={src} className="mb-2 last:mb-0">
                          <div className="mb-1 text-[0.58rem] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
                            {SOURCE_LABEL[src]}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {deckBySource[src].map((id, i) => (
                              <span
                                key={`${id}-${i}`}
                                className="inline-flex items-center rounded-[var(--radius-sm)] bg-[rgba(255,252,244,0.5)] px-2 py-0.5 font-body text-xs text-[color:var(--color-parchment)]"
                                style={{ boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.28)' }}
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

            {/* the fold between the two halves of the spread */}
            <div
              aria-hidden
              className="w-px shrink-0 self-stretch"
              style={{ background: 'rgba(42,33,25,0.3)' }}
            />

            {/* ---- Right: the bag manifest ---- */}
            <div className="flex min-h-0 w-[310px] shrink-0 flex-col overflow-y-auto">
              <div className="flex items-baseline justify-between">
                <ColumnHead>Bag</ColumnHead>
                <span className="numeral text-[0.65rem] text-[color:var(--color-text-muted)]">
                  {gearCount}
                </span>
              </div>
              <Rule weight={0.34} />

              {gearStacks.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Icon name="treasure" size={40} className="text-[color:var(--color-parchment-dim)] opacity-25" />
                  <div className="voice-display text-[0.8rem] tracking-[0.08em] text-[color:var(--color-parchment)]">
                    No gear on the manifest.
                  </div>
                  <div className="font-body text-[0.72rem] text-[color:var(--color-text-muted)]">
                    Shops and battlefields will fill it.
                  </div>
                </div>
              )}

              {gearStacks.map(({ id, def, count }) => {
                const reasonL = equipReason('left', id)
                const reasonR = def.twoHanded ? 'two-handed' : equipReason('right', id)
                const cardCount = def.gearCardIds?.length ?? 0
                const lit = litId === id
                return (
                  <div
                    key={id}
                    onPointerEnter={() => setLitItemId(id)}
                    onFocusCapture={() => setLitItemId(id)}
                  >
                    <div
                      className="relative overflow-hidden px-2.5 py-2 transition-colors duration-[var(--dur-quick)]"
                      style={
                        lit
                          ? { background: 'rgba(42,33,25,0.07)', boxShadow: 'inset 4px 0 0 var(--iron-edge)' }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <GemDot rarity={def.rarity} />
                          <span
                            className="voice-display text-[0.82rem] tracking-[0.03em]"
                            style={{ color: RARITY_INK[def.rarity] }}
                          >
                            {def.name}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-baseline gap-1.5">
                          <span className="numeral text-sm text-[color:var(--color-parchment)]">
                            {cardCount > 0 ? `+${cardCount} cards` : '—'}
                          </span>
                          {count > 1 && (
                            <span
                              className="numeral px-1 text-[0.65rem] text-[color:var(--color-parchment-dim)]"
                              style={{ boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.3)' }}
                              aria-label={`${count} in bag`}
                            >
                              ×{count}
                            </span>
                          )}
                        </span>
                      </div>
                      {/* the kind hangs left on the line, the two assignments
                          hang right — a manifest line, not a form row */}
                      <div className="flex min-h-[26px] items-center justify-between gap-2">
                        <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
                          {def.kind}{def.twoHanded ? ' · 2H' : ''}
                          {def.quiverModifier ? ` · ${def.quiverModifier.kind}` : ''}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <EquipButton
                            label="Equip L"
                            reason={reasonL}
                            lit={lit}
                            primary
                            onPress={() => equipInto('left', id)}
                          />
                          <EquipButton
                            label="Equip R"
                            reason={reasonR}
                            lit={lit}
                            primary={false}
                            onPress={() => equipInto('right', id)}
                          />
                        </span>
                      </div>
                    </div>
                    <Rule weight={0.18} />
                  </div>
                )
              })}

              {consumablesCount > 0 && (
                <div className="pt-2 font-body text-[0.72rem] italic text-[color:var(--color-text-muted)]">
                  +{consumablesCount} consumable{consumablesCount === 1 ? '' : 's'} (food, potions)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
