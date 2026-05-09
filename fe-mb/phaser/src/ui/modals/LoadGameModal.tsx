import React from 'react'
import { Dialog, Button, Heading, ListBox, ListBoxItem } from '../components'

/**
 * Load Game modal — shows a list of saved games from localStorage.
 *
 * Foundation milestone has no save slots populated yet (save UX lands later);
 * this modal renders the empty-state for now.
 */
export interface SaveSlot {
  slotId: string
  label: string
  savedAt: number
}

export interface LoadGameModalProps {
  open: boolean
  slots: SaveSlot[]
  onClose: () => void
  onSelect: (slotId: string) => void
}

export function LoadGameModal({
  open, slots, onClose, onSelect,
}: LoadGameModalProps): React.JSX.Element {
  return (
    <Dialog isOpen={open} onOpenChange={(o) => { if (!o) onClose() }} aria-label="Load Game">
      <div id="load-game-modal" className="flex flex-col gap-4 min-w-[440px] max-h-[70vh]">
        <div className="flex justify-between items-center border-b border-stone-800 pb-3">
          <Heading level={2} className="text-xl tracking-widest m-0">
            Load Game
          </Heading>
          <Button
            id="load-game-close"
            variant="ghost"
            onPress={onClose}
            className="text-amber-400 px-3 py-1"
            aria-label="Close"
          >
            ×
          </Button>
        </div>
        {slots.length === 0 ? (
          <div id="load-game-empty" className="text-center py-8 text-stone-500 italic">
            No saved games yet.
          </div>
        ) : (
          <ListBox
            aria-label="Save slots"
            selectionMode="single"
            onAction={(key) => onSelect(String(key))}
          >
            {slots.map((s) => (
              <ListBoxItem
                key={s.slotId}
                id={s.slotId}
                textValue={s.label}
                className="flex justify-between"
              >
                <span>{s.label}</span>
                <span className="text-stone-500">{new Date(s.savedAt).toLocaleString()}</span>
              </ListBoxItem>
            ))}
          </ListBox>
        )}
      </div>
    </Dialog>
  )
}
