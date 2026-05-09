import React from 'react'

/**
 * Quit "modal" — shown after Quit click when window.close() can't fire
 * (modern browsers only allow it for windows opened via window.open()).
 *
 * In production builds wrapped by Electron/Steam, the Quit button can fire
 * the host's exit; in browser dev, this overlay is the practical fallback.
 */
export interface QuitModalProps {
  open: boolean
  onClose: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  width: 420,
  background: '#0a0a0f',
  border: '1px solid #4a3a20',
  color: '#e0d0a0',
  fontFamily: 'monospace',
  padding: 32,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 24px',
  background: 'transparent',
  color: '#e0d0a0',
  border: '1px solid #4a3a20',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 16,
  letterSpacing: 1,
}

export function QuitModal({ open, onClose }: QuitModalProps): React.JSX.Element | null {
  if (!open) return null

  return (
    <div id="quit-overlay" style={overlayStyle} onClick={onClose}>
      <div
        id="quit-modal"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="quit-title"
      >
        <h2 id="quit-title" style={{ margin: 0, fontSize: 22, letterSpacing: 2 }}>Thanks for playing</h2>
        <p style={{ margin: 0, color: '#8a7860', fontSize: 14, lineHeight: 1.6 }}>
          You can close this tab now.
        </p>
        <button id="quit-close" type="button" style={buttonStyle} onClick={onClose}>Back to title</button>
      </div>
    </div>
  )
}
