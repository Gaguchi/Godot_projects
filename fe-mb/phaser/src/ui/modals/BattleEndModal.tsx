import React from 'react'
import { useCombatStore } from '../../state/combatStore'

/**
 * Victory / Defeat overlay shown when combatStore.state.phase becomes
 * VICTORY or DEFEAT. Subscribes to the store directly; mounted at App
 * root so it renders regardless of the active view.
 */
export interface BattleEndModalProps {
  onRestart: () => void
  onReturnToTitle: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999,
}

const modalStyle = (variant: 'VICTORY' | 'DEFEAT'): React.CSSProperties => ({
  width: 480,
  background: '#0a0a0f',
  border: `2px solid ${variant === 'VICTORY' ? '#a07a40' : '#7a2010'}`,
  color: '#e0d0a0',
  fontFamily: 'monospace',
  padding: 32,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
})

const titleStyle = (variant: 'VICTORY' | 'DEFEAT'): React.CSSProperties => ({
  margin: 0,
  fontSize: 36,
  letterSpacing: 6,
  color: variant === 'VICTORY' ? '#facc15' : '#dc2626',
  textShadow: '0 2px 12px rgba(0,0,0,0.6)',
})

const buttonStyle: React.CSSProperties = {
  padding: '12px 24px',
  background: 'transparent',
  color: '#e0d0a0',
  border: '1px solid #4a3a20',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 14,
  letterSpacing: 2,
}

export function BattleEndModal({ onRestart, onReturnToTitle }: BattleEndModalProps): React.JSX.Element | null {
  const phase = useCombatStore((s) => s.state.phase)
  const units = useCombatStore((s) => s.state.units)

  if (phase !== 'VICTORY' && phase !== 'DEFEAT') return null

  const partyAlive = Object.values(units).filter(
    (u) => u.hp.current > 0 && !(u.classId as unknown as string).includes('bandit'),
  )
  const enemiesDefeated = Object.values(units).filter(
    (u) => u.hp.current <= 0 && (u.classId as unknown as string).includes('bandit'),
  ).length

  return (
    <div id="battle-end-overlay" style={overlayStyle}>
      <div
        id={phase === 'VICTORY' ? 'victory-modal' : 'defeat-modal'}
        style={modalStyle(phase)}
        role="dialog"
        aria-labelledby="battle-end-title"
      >
        <h1 id="battle-end-title" style={titleStyle(phase)}>{phase}</h1>
        <div style={{ color: '#8a7860', fontSize: 14 }}>
          {phase === 'VICTORY'
            ? `Enemies defeated: ${enemiesDefeated}`
            : `Your party has fallen.`}
        </div>
        <div style={{ color: '#8a7860', fontSize: 13, marginTop: 8 }}>
          Survivors: {partyAlive.map((u) => u.name).join(', ') || 'None'}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'center' }}>
          <button id="battle-end-restart" type="button" style={buttonStyle} onClick={onRestart}>Restart</button>
          <button id="battle-end-title-btn" type="button" style={buttonStyle} onClick={onReturnToTitle}>Return to Title</button>
        </div>
      </div>
    </div>
  )
}
