import React from 'react'
import { Button, Heading } from '../components'

/**
 * Title screen — first thing the player sees on boot.
 *
 * Layout: full-viewport, centered title with three buttons stacked below.
 * Each button is a <Button> from src/ui/components — the centralized wrapper
 * over react-aria-components. That gives us reliable hover/press/focus state
 * machines, keyboard activation, and 4-state styling for free.
 */
export interface TitleScreenProps {
  onNewGame: () => void
  onLoadGame: () => void
  onQuit: () => void
}

export function TitleScreen({ onNewGame, onLoadGame, onQuit }: TitleScreenProps): React.JSX.Element {
  return (
    <div
      id="title-screen"
      className="flex flex-col items-center justify-center h-screen w-screen bg-stone-950 text-amber-100 gap-8 font-mono"
    >
      <Heading level={1} className="text-6xl tracking-[0.25em] mb-2 drop-shadow-[0_2px_12px_rgba(255,180,80,0.25)]">
        FE_MB
      </Heading>
      <div className="text-sm text-stone-500 -mt-4 mb-8 tracking-widest">tactical roguelite</div>
      <Button id="title-new-game" variant="secondary" onPress={onNewGame} className="w-72 py-4 text-lg tracking-widest">
        New Game
      </Button>
      <Button id="title-load-game" variant="secondary" onPress={onLoadGame} className="w-72 py-4 text-lg tracking-widest">
        Load Game
      </Button>
      <Button id="title-quit" variant="secondary" onPress={onQuit} className="w-72 py-4 text-lg tracking-widest">
        Quit
      </Button>
    </div>
  )
}
