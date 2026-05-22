import React from 'react'
import { Button } from './Button'
import { Icon } from './Icon'

export interface PauseButtonProps {
  onPress: () => void
}

/**
 * Compact pause button rendered in the top-right of every in-game scene's HUD.
 * Click opens the pause menu (same as pressing Esc).
 */
export function PauseButton({ onPress }: PauseButtonProps): React.JSX.Element {
  return (
    <Button
      id="pause-btn"
      variant="ghost"
      onPress={onPress}
      aria-label="Pause"
      className="!px-2 !py-2"
    >
      <Icon name="pause" size={18} />
    </Button>
  )
}
