import React from 'react'
import { ModalOverlay, Modal, Dialog as RACDialog } from 'react-aria-components'

export interface DialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  'aria-label'?: string
  className?: string
  /** When true (default), pressing ESC or clicking the backdrop dismisses. */
  isDismissable?: boolean
  /**
   * Anchor position. 'center' (default) is the standard centered modal.
   * 'bottom' pins the panel to the bottom edge full-width — used by the
   * in-game DialogueModal so the world stays visible above. The backdrop
   * dim is lighter for 'bottom' to preserve the place-sense.
   */
  position?: 'center' | 'bottom'
}

export function Dialog({
  isOpen, onOpenChange, children, className,
  'aria-label': ariaLabel,
  isDismissable = true,
  position = 'center',
}: DialogProps): React.JSX.Element {
  const overlayClass = position === 'bottom'
    ? 'fixed inset-0 z-[800] flex items-end justify-center bg-black/55 backdrop-blur-[1px]'
    : 'fixed inset-0 z-[800] flex items-center justify-center bg-black/70'

  const dialogClass = position === 'bottom'
    ? 'bg-stone-950/95 border-t-2 border-amber-900/60 text-amber-100 ' +
      'font-mono w-full outline-none ' +
      'shadow-[0_-12px_40px_rgba(0,0,0,0.8)] ' +
      (className ?? '')
    : 'bg-stone-950 border border-amber-900/40 text-amber-100 ' +
      'font-mono p-6 min-w-[400px] max-w-[80vw] outline-none rounded ' +
      'shadow-[0_0_30px_rgba(0,0,0,0.6)] ' +
      (className ?? '')

  const modalClass = position === 'bottom' ? 'outline-none w-full' : 'outline-none'

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className={overlayClass}
    >
      <Modal className={modalClass}>
        <RACDialog
          {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
          className={dialogClass}
        >
          {children}
        </RACDialog>
      </Modal>
    </ModalOverlay>
  )
}
