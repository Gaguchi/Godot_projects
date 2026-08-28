import React, { useEffect, useState } from 'react'
import { Dialog } from '../components'
import { listSlots, isSlotEmpty, type SaveSlotMeta } from '../../persistence/saveSlots'
import { SlotCard, PageSheet, PageHead } from './SaveGameModal'

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
      unpadded
      className="w-[476px]"
    >
      <div
        id="load-game-modal"
        className="page-canvas relative max-h-[70vh] cursor-default select-none overflow-hidden rounded-[var(--radius-md)]"
        style={{ background: 'var(--canvas-base)' }}
      >
        <PageSheet />
        <div className="relative flex flex-col pb-5 pl-[42px] pr-6 pt-5">
          <PageHead title="Load Game" closeId="load-game-close" onClose={onClose}>
            <p className="mb-0 mt-1 font-body text-xs italic text-[color:var(--color-parchment-dim)]">
              {allEmpty ? 'nothing written here yet' : 'pick up a march already begun'}
            </p>
          </PageHead>

          {allEmpty ? (
            // Designed empty state: dimmed silhouette pressed into the page +
            // in-voice copy + a pointer to the action that fills it. (Copy keeps
            // the "No saved games" phrase — e2e boot contract.)
            <div id="load-game-empty" className="flex flex-col items-center gap-2 px-6 py-9 text-center">
              <span className="text-[color:var(--color-parchment-dim)] opacity-30">
                <UnwrittenChronicleGlyph />
              </span>
              <p className="voice-display m-0 text-sm tracking-[0.08em] text-[color:var(--color-parchment)]">
                No saved games yet — the chronicle is unwritten.
              </p>
              <p className="m-0 font-body text-xs text-[color:var(--color-text-muted)]">
                Save from the pause menu, out on the road.
              </p>
            </div>
          ) : (
            <div className="mt-3 flex flex-col overflow-y-auto">
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
      </div>
    </Dialog>
  )
}
