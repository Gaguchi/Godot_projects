import React from 'react'
import { useRunStore } from '../../state/runStore'
import { Dialog, Button, Heading } from '../components'

export interface QuestLogProps {
  open: boolean
  onClose: () => void
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

export function QuestLog({ open, onClose }: QuestLogProps): React.JSX.Element {
  const questStates = useRunStore((s) => s.questStates)
  const activeQuests = Object.entries(questStates)

  return (
    <Dialog isOpen={open} onOpenChange={(o) => { if (!o) onClose() }} aria-label="Quest Log">
      <div id="quest-log-panel" className="flex flex-col gap-4 min-w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-stone-800 pb-2">
          <Heading level={2} className="text-lg tracking-widest m-0">
            Quest Log
          </Heading>
          <Button variant="ghost" onPress={onClose} className="text-amber-400 px-3 py-1" aria-label="Close">
            ×
          </Button>
        </div>

        {activeQuests.length === 0 && (
          <div className="italic text-stone-500 text-center py-8">
            No active quests. Visit a tavern to find work.
          </div>
        )}

        {activeQuests.map(([questId, state]) => {
          const descr = QUEST_DESCRIPTIONS[questId]
          return (
            <div key={questId} className="p-4 border border-stone-800 rounded">
              <div className="text-amber-400 text-sm tracking-wider">{descr?.name ?? questId}</div>
              <div className="mt-2 text-stone-500 text-xs">
                Stage: <span className="text-amber-100">{state.currentStage}</span>
              </div>
              {descr?.stages[state.currentStage] && (
                <div className="mt-2 text-stone-300 text-xs leading-relaxed">
                  {descr.stages[state.currentStage]}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Dialog>
  )
}
