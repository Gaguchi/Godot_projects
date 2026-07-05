import React from 'react'
import { Button } from './Button'
import { Icon } from './Icon'

export interface PauseButtonProps {
  onPress: () => void
}

/**
 * Compact pause button rendered in the top-right of every in-game scene's HUD.
 * Click opens the pause menu (same as pressing Esc).
 *
 * Backed by a small dark plaque (not a bare ghost icon): on the overworld it
 * floats over the bright travel-band sky, where an unbacked grey glyph read as a
 * stuck video-player indicator. The plaque is dark enough to also sit cleanly on
 * combat's dark HUD, so one treatment works everywhere.
 */
export function PauseButton({ onPress }: PauseButtonProps): React.JSX.Element {
  return (
    <Button
      id="pause-btn"
      variant="ghost"
      onPress={onPress}
      aria-label="Pause"
      className="!grid !h-8 !w-8 !place-items-center !rounded-full !p-0"
      style={{
        background: 'rgba(16,10,5,0.72)',
        border: '1px solid rgba(201,152,92,0.4)',
        color: '#c9985c',
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}
    >
      <Icon name="pause" size={16} />
    </Button>
  )
}
