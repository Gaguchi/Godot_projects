import React from 'react'
import { ModalOverlay, Modal, Dialog as RACDialog } from 'react-aria-components'
import { stagePortalContainer } from '../stage'

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
  /** 'veil' keeps the world readable behind the modal (lighter dim + blur) —
   *  pause/interrupt surfaces where the game holds its breath rather than
   *  disappears. Default 'heavy' is the standard center-modal dim. */
  backdrop?: 'heavy' | 'veil'
  /** Panel owns its own interior padding (full-bleed headers/dividers). */
  unpadded?: boolean
}

export function Dialog({
  isOpen, onOpenChange, children, className,
  'aria-label': ariaLabel,
  isDismissable = true,
  position = 'center',
  backdrop = 'heavy',
  unpadded = false,
}: DialogProps): React.JSX.Element {
  // Backdrop fades in/out via RAC data-entering/exiting (motion-safe only).
  const overlayBase =
    'fixed inset-0 z-[800] flex justify-center motion-safe:transition-opacity motion-safe:duration-200 ' +
    'motion-safe:data-[entering]:opacity-0 motion-safe:data-[exiting]:opacity-0 '
  const overlayClass = position === 'bottom'
    ? overlayBase + 'items-end bg-black/55 backdrop-blur-[1px]'
    : overlayBase + (backdrop === 'veil'
      ? 'items-center bg-black/55 backdrop-blur-[2px]'
      : 'items-center bg-black/70')

  // Panel rises (bottom) / scales (center) on enter; iron-framed for the dark
  // candlelit identity. Numbers/prose inside use the body serif.
  const motionCommon =
    'motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-[var(--ease-out-quart)] '
  const dialogClass = position === 'bottom'
    ? 'relative bg-stone-950/95 text-[color:var(--color-parchment)] ' +
      'font-body w-full outline-none shadow-[0_-12px_40px_rgba(0,0,0,0.8)] ' +
      // stacked top fillet: amber seam + catchlight (a forged edge, not a border)
      '[box-shadow:0_-12px_40px_rgba(0,0,0,0.8),inset_0_2px_0_rgba(146,64,14,0.6),inset_0_3px_0_rgba(255,235,190,0.08)] ' +
      motionCommon +
      'motion-safe:data-[entering]:translate-y-5 motion-safe:data-[entering]:opacity-0 ' +
      'motion-safe:data-[exiting]:translate-y-5 motion-safe:data-[exiting]:opacity-0 ' +
      (className ?? '')
    : 'surface-iron text-[color:var(--color-parchment)] ' +
      `font-body ${unpadded ? '' : 'p-6 '}min-w-[400px] max-w-[80vw] outline-none rounded-md ` +
      motionCommon +
      'motion-safe:data-[entering]:translate-y-3 motion-safe:data-[entering]:scale-95 motion-safe:data-[entering]:opacity-0 ' +
      'motion-safe:data-[exiting]:scale-95 motion-safe:data-[exiting]:opacity-0 ' +
      (className ?? '')

  const modalClass = position === 'bottom' ? 'outline-none w-full' : 'outline-none'

  // Portal into the scaled stage (not document.body) so the overlay scales and
  // is bounded by the 1280×720 game area instead of the raw viewport.
  const container = stagePortalContainer()

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className={overlayClass}
      {...(container ? { UNSTABLE_portalContainer: container } : {})}
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
