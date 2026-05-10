import React, { useState } from 'react'
import { Dialog, Button, Heading } from '../components'
import { listSlots, isSlotEmpty, type SaveSlotMeta } from '../../persistence/saveSlots'

export interface SaveGameModalProps {
  open: boolean
  onClose: () => void
  onSave: (slotId: string) => void
}

function formatDate(ts: number): string {
  if (ts === 0) return ''
  return new Date(ts).toLocaleString()
}

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
    <Dialog isOpen={open} onOpenChange={(o) => { if (!o) onClose() }} aria-label="Save Game">
      <div id="save-game-modal" className="flex flex-col gap-4 min-w-[440px]">
        <div className="flex justify-between items-center border-b border-stone-800 pb-3">
          <Heading level={2} className="text-xl tracking-widest m-0">Save Game</Heading>
          <Button id="save-game-close" variant="ghost" onPress={onClose} className="text-amber-400 px-3 py-1" aria-label="Close">
            ×
          </Button>
        </div>

        {confirmOverwrite !== null ? (
          <div className="flex flex-col gap-3 px-3 py-4">
            <p className="text-amber-300">
              Overwrite slot {Number(confirmOverwrite) + 1}?
            </p>
            <p className="text-stone-500 text-sm italic">
              This cannot be undone.
            </p>
            <div className="flex gap-2 mt-2">
              <Button variant="primary" onPress={() => confirm(confirmOverwrite)}>Overwrite</Button>
              <Button variant="ghost" onPress={() => setConfirmOverwrite(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {slots.map((slot) => {
              const empty = isSlotEmpty(slot)
              return (
                <button
                  key={slot.slotId}
                  data-testid={`save-slot-${slot.slotId}`}
                  data-empty={empty ? 'true' : 'false'}
                  onClick={() => handleSelect(slot.slotId)}
                  className="text-left px-4 py-3 rounded border border-stone-700 bg-stone-900/60 hover:bg-stone-900/90 hover:border-amber-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-200">Slot {Number(slot.slotId) + 1}</span>
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
