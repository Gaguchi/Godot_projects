import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { createGame } from './game/createGame'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Phaser game mounts after React shell commits its DOM. React 19's concurrent
// renderer doesn't synchronously commit on render(), so we wait until the
// canvas container actually exists in the document before creating the game.
function mountPhaserWhenReady(): void {
  const parent = document.getElementById('game-canvas-container')
  if (parent) {
    const game = createGame(parent)
    // Expose for debugging — lets devtools / Playwright inspect scene state.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __game?: unknown }).__game = game
    }
    return
  }
  requestAnimationFrame(mountPhaserWhenReady)
}
requestAnimationFrame(mountPhaserWhenReady)
