import React from 'react'

/**
 * Title screen — first thing the player sees on boot.
 *
 * Layout: full-viewport, centered game title with three buttons stacked below.
 * Buttons emit onClick events here; wiring (New Game → start run; Load Game →
 * save list; Quit → window close) lands in P1-03, P1-04, P1-05 respectively.
 *
 * Styling is intentionally inline for now — P1-06 refactors to Tailwind dark-fantasy.
 */
export interface TitleScreenProps {
  onNewGame: () => void
  onLoadGame: () => void
  onQuit: () => void
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  width: '100vw',
  background: '#0a0a0f',
  color: '#e0d0a0',
  fontFamily: 'monospace',
  gap: 32,
}

const titleStyle: React.CSSProperties = {
  fontSize: 64,
  letterSpacing: 4,
  marginBottom: 24,
  textShadow: '0 2px 12px rgba(255, 180, 80, 0.25)',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#8a7860',
  marginTop: -16,
  marginBottom: 32,
  letterSpacing: 1,
}

const buttonStyle: React.CSSProperties = {
  width: 280,
  padding: '14px 24px',
  fontFamily: 'monospace',
  fontSize: 18,
  background: 'transparent',
  color: '#e0d0a0',
  border: '1px solid #4a3a20',
  cursor: 'pointer',
  letterSpacing: 2,
  textAlign: 'center',
  transition: 'background 120ms, border-color 120ms',
}

export function TitleScreen({ onNewGame, onLoadGame, onQuit }: TitleScreenProps): React.JSX.Element {
  return (
    <div id="title-screen" style={containerStyle}>
      <h1 style={titleStyle}>FE_MB</h1>
      <div style={subtitleStyle}>tactical roguelite</div>
      <button
        id="title-new-game"
        type="button"
        style={buttonStyle}
        onClick={onNewGame}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1410'; e.currentTarget.style.borderColor = '#a07a40' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#4a3a20' }}
      >
        New Game
      </button>
      <button
        id="title-load-game"
        type="button"
        style={buttonStyle}
        onClick={onLoadGame}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1410'; e.currentTarget.style.borderColor = '#a07a40' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#4a3a20' }}
      >
        Load Game
      </button>
      <button
        id="title-quit"
        type="button"
        style={buttonStyle}
        onClick={onQuit}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1410'; e.currentTarget.style.borderColor = '#a07a40' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#4a3a20' }}
      >
        Quit
      </button>
    </div>
  )
}
