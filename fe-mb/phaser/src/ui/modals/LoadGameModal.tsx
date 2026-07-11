import React, { useEffect, useState } from 'react'
import { Dialog, Button, Heading, Icon } from '../components'
import { listSlots, isSlotEmpty, type SaveSlotMeta } from '../../persistence/saveSlots'
import { SlotCard, ModalRule } from './SaveGameModal'

/** Open book, blank pages — Icon.tsx has no chronicle glyph, so a local
 *  inline SVG in the set's stroke family carries the empty-state silhouette. */
function UnwrittenChronicleGlyph(): React.JSX.Element {
  return (
    <svg
      width={48}
      height={48}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 6.2 C10.2 4.8 7.2 4.6 4.8 5.6 V17.6 C7.2 16.6 10.2 16.8 12 18.2 C13.8 16.8 16.8 16.6 19.2 17.6 V5.6 C16.8 4.6 13.8 4.8 12 6.2 Z" />
      <path d="M12 6.2 V18.2" />
      <path d="M7 9 c1.2 -0.3 2.4 -0.3 3.4 0.1" opacity={0.55} />
      <path d="M7 11.5 c1.2 -0.3 2.4 -0.3 3.4 0.1" opacity={0.35} />
    </svg>
  )
}

export interface LoadGameModalProps {
  open: boolean
  onClose: () => void
  onSelect: (slotId: string) => void
}

export function LoadGameModal({ open, onClose, onSelect }: LoadGameModalProps): React.JSX.Element {
  const [slots, setSlots] = useState<SaveSlotMeta[]>(() => listSlots())
  useEffect(() => {
    if (open) setSlots(listSlots())
  }, [open])

  const allEmpty = slots.every(isSlotEmpty)

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      aria-label="Load Game"
      backdrop="veil"
    >
      <div id="load-game-modal" className="flex max-h-[70vh] min-w-[440px] cursor-default select-none flex-col gap-4">
        <div>
          <div className="flex items-center justify-between pb-2">
            <Heading
              level={2}
              className="voice-display m-0 text-lg uppercase tracking-[0.24em] text-[color:var(--color-parchment)]"
            >
              Load Game
            </Heading>
            <Button
              id="load-game-close"
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

        {allEmpty ? (
          // Designed empty state: dimmed silhouette + in-voice copy + a
          // pointer to the action that fills it. (Copy keeps the
          // "No saved games" phrase — e2e boot contract.)
          <div id="load-game-empty" className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <span className="opacity-30 text-[color:var(--color-parchment-dim)]">
              <UnwrittenChronicleGlyph />
            </span>
            <p className="m-0 font-body text-sm text-[color:var(--color-text-muted)]">
              No saved games yet — the chronicle is unwritten.
            </p>
            <p className="m-0 font-body text-xs text-[color:var(--color-text-muted)] opacity-75">
              Save from the pause menu, out on the road.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {slots.map((slot) => {
              const empty = isSlotEmpty(slot)
              return (
                <SlotCard
                  key={slot.slotId}
                  slot={slot}
                  testId={`load-slot-${slot.slotId}`}
                  isDisabled={empty}
                  onPress={() => onSelect(slot.slotId)}
                />
              )
            })}
          </div>
        )}
      </div>
    </Dialog>
  )
}
