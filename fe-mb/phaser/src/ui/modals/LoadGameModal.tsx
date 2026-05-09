import React from 'react'

/**
 * Load Game modal — shows a list of saved games from localStorage.
 *
 * Foundation milestone has no save slots populated yet (save UX lands later);
 * this modal renders the empty-state for now. The save format and atomic
 * hydration logic are already in `phaser/src/persistence/{save,load}.ts`,
 * so wiring real save slots is a small follow-up task.
 */
export interface SaveSlot {
  slotId: string
  label: string
  savedAt: number
}

export interface LoadGameModalProps {
  open: boolean
  slots: SaveSlot[]
  onClose: () => void
  onSelect: (slotId: string) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  width: 480,
  maxHeight: '70vh',
  background: '#0a0a0f',
  border: '1px solid #4a3a20',
  color: '#e0d0a0',
  fontFamily: 'monospace',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #2a2010',
  paddingBottom: 12,
}

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#a07a40',
  border: '1px solid #4a3a20',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 14,
  padding: '4px 12px',
}

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 32,
  color: '#8a7860',
  fontStyle: 'italic',
}

const slotStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #2a2010',
  color: '#e0d0a0',
  fontFamily: 'monospace',
  fontSize: 14,
  padding: 12,
  cursor: 'pointer',
  textAlign: 'left',
  display: 'flex',
  justifyContent: 'space-between',
}

export function LoadGameModal({ open, slots, onClose, onSelect }: LoadGameModalProps): React.JSX.Element | null {
  if (!open) return null

  return (
    <div id="load-game-overlay" style={overlayStyle} onClick={onClose}>
      <div
        id="load-game-modal"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="load-game-title"
      >
        <div style={headerStyle}>
          <h2 id="load-game-title" style={{ margin: 0, fontSize: 20, letterSpacing: 2 }}>Load Game</h2>
          <button id="load-game-close" type="button" style={closeBtnStyle} onClick={onClose}>×</button>
        </div>
        {slots.length === 0 ? (
          <div id="load-game-empty" style={emptyStyle}>No saved games yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.map((s) => (
              <button
                key={s.slotId}
                type="button"
                style={slotStyle}
                onClick={() => onSelect(s.slotId)}
              >
                <span>{s.label}</span>
                <span style={{ color: '#8a7860' }}>{new Date(s.savedAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
