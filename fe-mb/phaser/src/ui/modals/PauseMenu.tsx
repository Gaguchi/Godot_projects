import React, { useState } from 'react'
import { Dialog, Button, Heading } from '../components'
import { useMetaStore } from '../../state/metaStore'

export interface PauseMenuProps {
  open: boolean
  /** When true, Save Game is enabled (only meaningful inside an active run). */
  canSave: boolean
  onClose: () => void
  onResume: () => void
  onSaveGame: () => void
  onLoadGame: () => void
  onReturnToTitle: () => void
  onQuit: () => void
}

/**
 * Top-level pause menu. Triggered by Esc anywhere except title (combat,
 * overworld, town, camp, dungeon). The 5 menu items map to existing modals
 * — pause is just the dispatch hub.
 *
 * Return-to-Title is gated by an internal "Are you sure?" confirm step
 * because it discards the current run.
 */
export function PauseMenu({
  open, canSave, onClose, onResume, onSaveGame, onLoadGame, onReturnToTitle, onQuit,
}: PauseMenuProps): React.JSX.Element {
  const audioMuted = useMetaStore((st) => st.audioMuted)
  const dispatchMeta = useMetaStore((st) => st.dispatch)
  const [confirmTitle, setConfirmTitle] = useState(false)

  React.useEffect(() => {
    if (!open) setConfirmTitle(false)
  }, [open])

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      aria-label="Pause Menu"
    >
      <div id="pause-menu" className="flex flex-col gap-3 min-w-[320px]">
        <Heading level={2} className="text-xl tracking-widest m-0 text-center mb-2">
          Paused
        </Heading>

        {confirmTitle ? (
          <div className="flex flex-col gap-3 px-2 py-2">
            <p className="text-amber-300 text-center">
              Return to title? Unsaved progress will be lost.
            </p>
            <div className="flex gap-2 justify-center mt-2">
              <Button variant="danger" onPress={onReturnToTitle}>Return to Title</Button>
              <Button variant="ghost" onPress={() => setConfirmTitle(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button id="pause-resume" variant="primary" onPress={onResume} className="w-full">
              Resume
            </Button>
            <Button
              id="pause-sound"
              variant="secondary"
              onPress={() => dispatchMeta({ type: 'setAudioMuted', payload: { muted: !audioMuted } })}
              className="w-full"
            >
              {audioMuted ? 'Sound: Off' : 'Sound: On'}
            </Button>
            <Button
              id="pause-save"
              variant="secondary"
              isDisabled={!canSave}
              onPress={onSaveGame}
              className="w-full"
            >
              Save Game
            </Button>
            <Button id="pause-load" variant="secondary" onPress={onLoadGame} className="w-full">
              Load Game
            </Button>
            <Button
              id="pause-title"
              variant="secondary"
              onPress={() => setConfirmTitle(true)}
              className="w-full"
            >
              Return to Title
            </Button>
            <Button id="pause-quit" variant="ghost" onPress={onQuit} className="w-full">
              Quit
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  )
}
