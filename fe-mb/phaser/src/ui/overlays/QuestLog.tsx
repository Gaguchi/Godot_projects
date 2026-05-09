import React from 'react'
import { useRunStore } from '../../state/runStore'

export interface QuestLogProps {
  open: boolean
  onClose: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 800,
}

const panelStyle: React.CSSProperties = {
  width: 560,
  maxHeight: '80vh',
  overflowY: 'auto',
  background: '#0a0a0f',
  border: '1px solid #4a3a20',
  color: '#e0d0a0',
  fontFamily: 'monospace',
  padding: 24,
}

const QUEST_DESCRIPTIONS: Record<string, { name: string; stages: Record<string, string> }> = {
  blood_ties: {
    name: 'Blood Ties',
    stages: {
      find_daren: 'Find Daren and resolve the matter — capture or kill.',
      daren_resolved: 'Return to Pine Crossing to claim the reward.',
      __complete__: 'Quest complete.',
    },
  },
}

export function QuestLog({ open, onClose }: QuestLogProps): React.JSX.Element | null {
  const questStates = useRunStore((s) => s.questStates)
  if (!open) return null

  const activeQuests = Object.entries(questStates)

  return (
    <div id="quest-log-overlay" style={overlayStyle} onClick={onClose}>
      <div
        id="quest-log-panel"
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="quest-log-title"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #2a2010', paddingBottom: 8 }}>
          <h2 id="quest-log-title" style={{ margin: 0, fontSize: 18, letterSpacing: 2 }}>Quest Log</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #4a3a20', color: '#a07a40', fontFamily: 'monospace', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {activeQuests.length === 0 && (
          <div style={{ fontStyle: 'italic', color: '#8a7860', textAlign: 'center', padding: 32 }}>
            No active quests. Visit a tavern to find work.
          </div>
        )}

        {activeQuests.map(([questId, state]) => {
          const descr = QUEST_DESCRIPTIONS[questId]
          return (
            <div key={questId} style={{ padding: 16, border: '1px solid #2a2010', marginBottom: 12 }}>
              <div style={{ color: '#facc15', fontSize: 14, letterSpacing: 1 }}>
                {descr?.name ?? questId}
              </div>
              <div style={{ marginTop: 8, color: '#8a7860', fontSize: 12 }}>
                Stage: <span style={{ color: '#e0d0a0' }}>{state.currentStage}</span>
              </div>
              {descr?.stages[state.currentStage] && (
                <div style={{ marginTop: 8, color: '#a0a0c0', fontSize: 12, lineHeight: 1.5 }}>
                  {descr.stages[state.currentStage]}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
