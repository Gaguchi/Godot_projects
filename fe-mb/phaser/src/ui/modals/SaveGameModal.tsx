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
/* Shared slot-card treatment (Save + Load import from here)                  */
/* ------------------------------------------------------------------------- */

/** Fading horizontal hairline (materials §2.3) — header rule for both modals. */
export function ModalRule({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={`h-px ${className ?? ''}`}
      style={{
        background:
          'linear-gradient(90deg, color-mix(in oklab, var(--iron-edge) 85%, transparent), transparent)',
      }}
    />
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
 * One save slot as a forged object, not a CRUD row: location name leads in
 * the display voice (player fiction, not "Slot 1"), the run summary reads as
 * icon+numeral groups, the wall-clock date recedes into a muted numeral, and
 * the slot number lives in a small recessed well.
 */
export function SlotCard({ slot, testId, onPress, isDisabled, dimmed }: SlotCardProps): React.JSX.Element {
  const empty = isSlotEmpty(slot)
  return (
    <Button
      variant="secondary"
      prose
      data-testid={testId}
      data-empty={empty ? 'true' : 'false'}
      onPress={onPress}
      isDisabled={isDisabled ?? false}
      className={`w-full transition-opacity duration-[var(--dur-quick)] ${dimmed ? 'opacity-40' : ''}`}
      style={{ padding: 0 }}
    >
      <span className="flex w-full items-center gap-3 px-4 py-3 text-left">
        {/* slot number in a recessed well */}
        <span
          className="numeral flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-xs text-[color:var(--color-parchment-dim)]"
          style={{
            background: 'rgba(0, 0, 0, 0.35)',
            boxShadow:
              'inset 0 2px 6px rgba(0, 0, 0, 0.6), inset 0 -1px 0 color-mix(in oklab, var(--iron-edge) 50%, transparent)',
          }}
        >
          {Number(slot.slotId) + 1}
        </span>

        {empty || !slot.summary ? (
          <span className="flex-1 text-[0.72rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
            — Blank page —
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
                <span className="numeral flex items-center gap-1 text-xs text-[color:var(--color-hearth-soft)]">
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
    >
      <div id="save-game-modal" className="flex min-w-[440px] cursor-default select-none flex-col gap-4">
        <div>
          <div className="flex items-center justify-between pb-2">
            <Heading
              level={2}
              className="voice-display m-0 text-lg uppercase tracking-[0.24em] text-[color:var(--color-parchment)]"
            >
              Save Game
            </Heading>
            <Button
              id="save-game-close"
              variant="ghost"
              onPress={onClose}
              className="px-2 py-1"
              aria-label="Close"
            >
              <Icon name="cross" size={16} />
            </Button>
          </div>
          <ModalRule />
        </div>

        <div className="flex flex-col gap-2">
          {slots.map((slot) => {
            const confirming = confirmOverwrite === slot.slotId
            if (confirming) {
              // Inline confirm ON the card — context stays, decision is local.
              return (
                <div
                  key={slot.slotId}
                  className="surface-iron flex items-center gap-3 rounded-[3px] px-4 py-3"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="voice-display text-[0.95rem] leading-tight text-[color:var(--color-parchment)]">
                      Overwrite this chronicle?
                    </span>
                    <span className="font-body text-xs text-[color:var(--color-text-muted)]">
                      {slot.summary ? formatLocationName(slot.summary.location) : ''} — the old page burns.
                    </span>
                  </span>
                  <Button variant="ghost" autoFocus onPress={() => setConfirmOverwrite(null)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onPress={() => confirm(slot.slotId)}>
                    Overwrite
                  </Button>
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
    </Dialog>
  )
}
