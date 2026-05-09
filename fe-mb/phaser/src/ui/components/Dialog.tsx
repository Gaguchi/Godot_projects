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
}

export function Dialog({
  isOpen, onOpenChange, children, className,
  'aria-label': ariaLabel,
  isDismissable = true,
}: DialogProps): React.JSX.Element {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className="fixed inset-0 z-[800] flex items-center justify-center bg-black/70"
    >
      <Modal className="outline-none">
        <RACDialog
          {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
          className={
            'bg-stone-950 border border-amber-900/40 text-amber-100 ' +
            'font-mono p-6 min-w-[400px] max-w-[80vw] outline-none rounded ' +
            'shadow-[0_0_30px_rgba(0,0,0,0.6)] ' +
            (className ?? '')
          }
        >
          {children}
        </RACDialog>
      </Modal>
    </ModalOverlay>
  )
}
