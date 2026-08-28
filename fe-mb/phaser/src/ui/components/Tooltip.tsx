import React from 'react'
import {
  TooltipTrigger,
  Tooltip as RACTooltip,
  OverlayArrow,
} from 'react-aria-components'
import { stagePortalContainer } from '../stage'

/** Re-exported through the components boundary so screens can wrap a
 *  non-interactive trigger (e.g. a disabled button) without importing
 *  react-aria-components directly — src/ui/** outside components/ is barred
 *  from that import by an ESLint layer rule. */
export { Focusable } from 'react-aria-components'

export interface TooltipProps {
  trigger: React.ReactElement
  content: React.ReactNode
  /** Delay in ms before showing on hover. RAC keyboard focus is always immediate. */
  delay?: number
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Force open state (mostly for testing or always-on tooltips). */
  isOpen?: boolean
}

export function Tooltip({
  trigger,
  content,
  delay = 500,
  placement = 'top',
  isOpen,
}: TooltipProps): React.JSX.Element {
  const container = stagePortalContainer()
  return (
    <TooltipTrigger
      delay={delay}
      {...(isOpen !== undefined ? { isOpen } : {})}
    >
      {trigger}
      <RACTooltip
        placement={placement}
        {...(container ? { UNSTABLE_portalContainer: container } : {})}
        className={
          'hud-panel text-[color:var(--color-parchment)] ' +
          'font-body text-xs px-2 py-1 max-w-xs'
        }
      >
        <OverlayArrow>
          <svg width={8} height={8} viewBox="0 0 8 8">
            <path
              d="M0 0 L4 4 L8 0 Z"
              style={{ fill: 'var(--color-ink)', stroke: 'var(--iron-edge)' }}
            />
          </svg>
        </OverlayArrow>
        {content}
      </RACTooltip>
    </TooltipTrigger>
  )
}
