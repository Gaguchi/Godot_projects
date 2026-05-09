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

// Phaser game mounts after React shell renders.
queueMicrotask(() => {
  const parent = document.getElementById('game-canvas-container')
  if (parent) createGame(parent)
})
