/**
 * ui/screens/Prologue.tsx — the opening beat, and the first image the game shows: the borderlands at dusk, framed
 * so the sun sits on the left third and the horizon on the upper one, letterboxed as a scene. The dialogue
 * overlay carries the words; there is nothing to click here but the talk box.
 */
import React from 'react'

export function PrologueScreen(): React.JSX.Element {
  return (
    <div className="vista" data-testid="prologue-screen">
      <img className="vista__art" src="/art/backdrops/borderlands.png" alt="" draggable={false} />
      <div className="vista__dusk" />
      <div className="iron-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5 }} />
      <div className="vista__bars" />
    </div>
  )
}
