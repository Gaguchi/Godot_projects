import React from 'react'
import { Button } from './Button'

export interface PauseButtonProps {
  onPress: () => void
}

/**
 * Compact ⋮ button rendered in the top-right of every in-game scene's HUD.
 * Click → opens the pause menu (same as pressing Esc).
 */
export function PauseButton({ onPress }: PauseButtonProps): React.JSX.Element {
  return (
    <Button
      id="pause-btn"
      variant="ghost"
      onPress={onPress}
      aria-label="Pause"
      className="!px-3 !py-2 !text-lg"
    >
      ⋮
    </Button>
  )
}
