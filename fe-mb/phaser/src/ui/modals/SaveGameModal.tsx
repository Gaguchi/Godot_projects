import React, { useState } from 'react'
import { Dialog, Button, Heading, Icon } from '../components'
import { listSlots, isSlotEmpty, type SaveSlotMeta } from '../../persistence/saveSlots'
import { formatLocationName, formatSaveDate } from '../strings'

export interface SaveGameModalProps {
  open: boolean
  onClose: () => void
  onSave: (slotId: string) => void
}

/* ------------------------------------------------------------------------- */
/* Shared ledger-page treatment (Load imports all of this from here)          */
/* ------------------------------------------------------------------------- */

/** Flat ink rule. A page is ruled in ink, never with a glowing seam. */
export function ModalRule({ className, weight = 0.28 }: { className?: string; weight?: number }): React.JSX.Element {
  return (
    <div aria-hidden className={`h-px ${className ?? ''}`} style={{ background: `rgba(42,33,25,${weight})` }} />
  )
}

/**
 * The ledger page a modal is cut from: linen ground, feint ruling, the double
 * margin rule, brass pins. Decorative only.
 *
 * The gradient stops at `--canvas-mid` rather than running on to
 * `--canvas-deep` — the bake-off audit measured muted text at 4.16:1 over the
 * deep band, and a short page would place its whole body there. Capping at mid
 * keeps every small-text pair on the page clear of AA.
 */
export function PageSheet({ ruleGap = 30, gutter = 26 }: { ruleGap?: number; gutter?: number }): React.JSX.Element {
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
      <PagePins />
    </>
  )
}

/** Brass pins holding the page to the table — daylight contact shadow, no bloom. */
export function PagePins(): React.JSX.Element {
  const spots: React.CSSProperties[] = [
    { top: 8, left: 8 }, { top: 8, right: 8 }, { bottom: 8, left: 8 }, { bottom: 8, right: 8 },
  ]
  return (
    <>
      {spots.map((pos, i) => (
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

/** Page head: title stamped over the ledger's double head-rule, close at right. */
export function PageHead({
  title, closeId, onClose, children,
}: {
  title: string
  closeId: string
  onClose: () => void
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <div className="flex items-start justify-between pb-2.5 pt-1">
        <div>
          <Heading
            level={2}
            /* `!` beats Heading.tsx's baked-in `text-amber-100` — a same-rank
               utility that would otherwise keep the title bone-white on linen. */
            className="voice-display m-0 text-lg uppercase !tracking-[0.26em] !text-[color:var(--color-parchment)]"
          >
            {title}
          </Heading>
          {children}
        </div>
        <Button
          id={closeId}
          variant="ghost"
          onPress={onClose}
          className="!px-2 !py-1 text-[color:var(--color-parchment-dim)]"
          aria-label="Close"
        >
          <Icon name="cross" size={16} />
        </Button>
      </div>
      <ModalRule weight={0.46} />
      <div className="h-[3px]" />
      <ModalRule weight={0.22} />
    </>
  )
}

/* Icon.tsx has no coin/party/rations glyphs — tiny local inline SVGs in the
   same stroke family (1.8, round caps, currentColor). */
function Glyph({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}
/** Helm — party members. */
function PartyGlyph(): React.JSX.Element {
  return (
    <Glyph>
      <path d="M6 18 v-5 a6 6 0 0 1 12 0 v5 Z" />
      <path d="M12 8 v6" />
    </Glyph>
  )
}
/** Coin — gold. */
function GoldGlyph(): React.JSX.Element {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="7" />
      <path d="M9 10.5 a4 4 0 0 1 4 -2" />
    </Glyph>
  )
}
/** Provision sack — rations. */
function FoodGlyph(): React.JSX.Element {
  return (
    <Glyph>
      <path d="M9 8 h6 l3 11 H6 Z" />
      <path d="M10 8 c0 -2 4 -2 4 0" />
    </Glyph>
  )
}

export interface SlotCardProps {
  slot: SaveSlotMeta
  testId: string
  onPress: () => void
  isDisabled?: boolean
  /** Fade back when another slot holds an inline confirm. */
  dimmed?: boolean
}

/**
 * One save slot written as a LEDGER ENTRY, not a CRUD row: an inked folio
 * number in the margin, the place-name in the display hand, the run's tally in
 * icon+numeral groups, and the wall-clock date receding into a muted numeral
 * at the right. The line under it is the ledger's rule.
 *
 * An empty slot is a BLANK RULED LINE — not a dark void: the folio number is
 * outlined rather than inked, and the line carries only its in-voice label.
 *
 * The row stays a `Button` (RAC hover/press/focus + keyboard activation) and a
 * GHOST — canvas is for reading. Pointing at a line slides a brass edge into
 * the margin and warms the linen under it; nothing on this page turns to
 * leather until a decision is pending, and then only the Overwrite strap does.
 * The `!` overrides are load-bearing: `.btn-forged` is unlayered CSS and
 * outranks every Tailwind utility without them.
 */
export function SlotCard({ slot, testId, onPress, isDisabled, dimmed }: SlotCardProps): React.JSX.Element {
  const empty = isSlotEmpty(slot)
  const disabled = isDisabled ?? false
  return (
    <div className="group relative">
      <Button
        variant="ghost"
        prose
        data-testid={testId}
        data-empty={empty ? 'true' : 'false'}
        onPress={onPress}
        isDisabled={disabled}
        className={
          'w-full !justify-start !px-0 !py-0 transition-opacity duration-[var(--dur-quick)] ' +
          'data-[hovered]:!border-transparent data-[hovered]:![box-shadow:inset_4px_0_0_var(--iron-edge)] ' +
          (dimmed ? 'opacity-40 ' : '')
        }
        {...(disabled ? { style: { opacity: dimmed ? 0.4 : 1, filter: 'none' } } : {})}
      >
        <span className="flex w-full items-center gap-3 py-2.5 pl-[16px] pr-3 text-left">
          {/* folio number — inked for a written page, outlined for a blank one */}
          <span
            className="numeral flex h-6 w-6 shrink-0 items-center justify-center text-[0.7rem]"
            style={
              empty
                ? { color: 'var(--color-text-muted)', boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.3)' }
                : { color: 'var(--color-parchment)', boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.55)' }
            }
          >
            {Number(slot.slotId) + 1}
          </span>

          {empty || !slot.summary ? (
            <span className="flex-1 font-body text-[0.78rem] italic text-[color:var(--color-text-muted)]">
              blank page
            </span>
          ) : (
            <>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="voice-display text-[0.95rem] leading-tight text-[color:var(--color-parchment)]">
                  {formatLocationName(slot.summary.location)}
                </span>
                <span className="flex items-center gap-3">
                  <span className="numeral flex items-center gap-1 text-xs text-[color:var(--color-parchment-dim)]">
                    <PartyGlyph />
                    {slot.summary.partyCount}
                  </span>
                  <span className="numeral flex items-center gap-1 text-xs text-[color:var(--color-hearth)]">
                    <GoldGlyph />
                    {slot.summary.gold}
                  </span>
                  <span className="numeral flex items-center gap-1 text-xs text-[color:var(--color-parchment-dim)]">
                    <FoodGlyph />
                    {slot.summary.foodCount}
                  </span>
                </span>
              </span>
              <span className="numeral shrink-0 self-start pt-0.5 text-[0.68rem] text-[color:var(--color-text-muted)]">
                {formatSaveDate(slot.savedAt)}
              </span>
            </>
          )}
        </span>
      </Button>
      <ModalRule weight={0.2} />
    </div>
  )
}

/* ------------------------------------------------------------------------- */

export function SaveGameModal({ open, onClose, onSave }: SaveGameModalProps): React.JSX.Element {
  // Re-read slots whenever the modal opens.
  const [slots, setSlots] = useState<SaveSlotMeta[]>(() => listSlots())
  const [confirmOverwrite, setConfirmOverwrite] = useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setSlots(listSlots())
      setConfirmOverwrite(null)
    }
  }, [open])

  const handleSelect = (slotId: string): void => {
    const slot = slots.find((s) => s.slotId === slotId)
    if (!slot || isSlotEmpty(slot)) {
      onSave(slotId)
      return
    }
    setConfirmOverwrite(slotId)
  }

  const confirm = (slotId: string): void => {
    setConfirmOverwrite(null)
    onSave(slotId)
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      aria-label="Save Game"
      backdrop="veil"
      unpadded
      className="w-[476px]"
    >
      <div
        id="save-game-modal"
        className="page-canvas relative cursor-default select-none overflow-hidden rounded-[var(--radius-md)]"
        style={{ background: 'var(--canvas-base)' }}
      >
        <PageSheet />
        <div className="relative flex flex-col pb-5 pl-[42px] pr-6 pt-5">
          <PageHead title="Save Game" closeId="save-game-close" onClose={onClose}>
            <p className="mb-0 mt-1 font-body text-xs italic text-[color:var(--color-parchment-dim)]">
              three folios — choose the line to write on
            </p>
          </PageHead>

          <div className="mt-3 flex flex-col">
            {slots.map((slot) => {
              const confirming = confirmOverwrite === slot.slotId
              if (confirming) {
                // Inline confirm ON the line — context stays, decision is local.
                return (
                  <div key={slot.slotId} className="relative">
                    <div
                      className="flex items-center gap-3 py-2.5 pl-4 pr-3"
                      style={{
                        background: 'rgba(154,44,34,0.10)',
                        boxShadow: 'inset 3px 0 0 var(--color-ember)',
                      }}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="voice-display text-[0.95rem] leading-tight text-[color:var(--color-damage-text)]">
                          Overwrite this chronicle?
                        </span>
                        <span className="font-body text-xs text-[color:var(--color-parchment-dim)]">
                          {slot.summary ? formatLocationName(slot.summary.location) : ''} — the old line is struck out.
                        </span>
                      </span>
                      <Button variant="danger" onPress={() => confirm(slot.slotId)}>
                        Overwrite
                      </Button>
                      <Button
                        variant="ghost"
                        autoFocus
                        onPress={() => setConfirmOverwrite(null)}
                        className="text-[color:var(--color-parchment-dim)]"
                      >
                        Cancel
                      </Button>
                    </div>
                    <ModalRule weight={0.2} />
                  </div>
                )
              }
              return (
                <SlotCard
                  key={slot.slotId}
                  slot={slot}
                  testId={`save-slot-${slot.slotId}`}
                  onPress={() => handleSelect(slot.slotId)}
                  dimmed={confirmOverwrite !== null}
                />
              )
            })}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
