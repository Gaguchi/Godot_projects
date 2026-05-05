import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { createGame } from './game/createGame';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

const phaserParent = document.createElement('div');
phaserParent.id = 'phaser-parent';
phaserParent.className = 'absolute inset-0';
rootEl.appendChild(phaserParent);

const reactParent = document.createElement('div');
reactParent.id = 'react-parent';
reactParent.className = 'absolute inset-0 pointer-events-none';
rootEl.appendChild(reactParent);

createGame(phaserParent);

createRoot(reactParent).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
