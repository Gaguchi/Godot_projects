import React from 'react'
import { Dialog, Button, Heading } from '../components'

/**
 * Quit "modal" — shown after Quit click when window.close() can't fire
 * (modern browsers only allow it for windows opened via window.open()).
 *
 * In production builds wrapped by Electron/Steam, the Quit button can fire
 * the host's exit; in browser dev, this overlay is the practical fallback.
 */
export interface QuitModalProps {
  open: boolean
  onClose: () => void
}

export function QuitModal({ open, onClose }: QuitModalProps): React.JSX.Element {
  return (
    <Dialog isOpen={open} onOpenChange={(o) => { if (!o) onClose() }} aria-label="Quit">
      <div id="quit-modal" className="flex flex-col gap-5 text-center min-w-[360px]">
        <Heading level={2} className="text-2xl tracking-widest m-0">
          Thanks for playing
        </Heading>
        <p className="m-0 text-sm text-stone-500 leading-relaxed">
          You can close this tab now.
        </p>
        <Button id="quit-close" variant="secondary" onPress={onClose} className="w-full text-base tracking-wider">
          Back to title
        </Button>
      </div>
    </Dialog>
  )
}
