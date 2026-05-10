import React, { useEffect, useState } from 'react'
import { Dialog, Button, Heading } from '../components'
import { listSlots, isSlotEmpty, type SaveSlotMeta } from '../../persistence/saveSlots'

export interface LoadGameModalProps {
  open: boolean
  onClose: () => void
  onSelect: (slotId: string) => void
}

function formatDate(ts: number): string {
  if (ts === 0) return ''
  return new Date(ts).toLocaleString()
}

export function LoadGameModal({ open, onClose, onSelect }: LoadGameModalProps): React.JSX.Element {
  const [slots, setSlots] = useState<SaveSlotMeta[]>(() => listSlots())
  useEffect(() => {
    if (open) setSlots(listSlots())
  }, [open])

  const allEmpty = slots.every(isSlotEmpty)

  return (
    <Dialog isOpen={open} onOpenChange={(o) => { if (!o) onClose() }} aria-label="Load Game">
      <div id="load-game-modal" className="flex flex-col gap-4 min-w-[440px] max-h-[70vh]">
        <div className="flex justify-between items-center border-b border-stone-800 pb-3">
          <Heading level={2} className="text-xl tracking-widest m-0">Load Game</Heading>
          <Button id="load-game-close" variant="ghost" onPress={onClose} className="text-amber-400 px-3 py-1" aria-label="Close">
            ×
          </Button>
        </div>
        {allEmpty ? (
          <div id="load-game-empty" className="text-center py-8 text-stone-500 italic">
            No saved games yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {slots.map((slot) => {
              const empty = isSlotEmpty(slot)
              return (
                <button
                  key={slot.slotId}
                  data-testid={`load-slot-${slot.slotId}`}
                  data-empty={empty ? 'true' : 'false'}
                  disabled={empty}
                  onClick={() => onSelect(slot.slotId)}
                  className={
                    'text-left px-4 py-3 rounded border transition-colors '
                    + (empty
                      ? 'border-stone-800 bg-stone-900/30 opacity-50 cursor-not-allowed'
                      : 'border-stone-700 bg-stone-900/60 hover:bg-stone-900/90 hover:border-amber-700 cursor-pointer')
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className={empty ? 'text-stone-500' : 'font-bold text-amber-200'}>
                      Slot {Number(slot.slotId) + 1}
                    </span>
                    {empty
                      ? <span className="text-stone-500 italic text-xs">empty</span>
                      : <span className="text-stone-400 text-xs">{formatDate(slot.savedAt)}</span>}
                  </div>
                  {!empty && slot.summary && (
                    <div className="mt-1 text-xs text-stone-400 flex gap-3">
                      <span>{slot.summary.partyCount} party</span>
                      <span>·</span>
                      <span>{slot.summary.gold}g</span>
                      <span>·</span>
                      <span>{slot.summary.foodCount} food</span>
                      <span>·</span>
                      <span className="truncate flex-1">{slot.summary.location}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Dialog>
  )
}
