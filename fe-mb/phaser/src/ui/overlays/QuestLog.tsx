import React from 'react'
import { useRunStore } from '../../state/runStore'
import { Dialog, Button, Heading, Icon } from '../components'

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
  sq_missing_caravan: {
    name: 'The Missing Caravan',
    stages: {
      find_supplies: 'Search the south roads for the lost guild caravan.',
      return_reward: 'Return to Riverside Market with the manifest.',
      __complete__: 'Quest complete.',
    },
  },
}

/** Recessed circular socket for the entry's status glyph. */
function QuestSocket({ complete }: { complete: boolean }): React.JSX.Element {
  return (
    <div
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--iron-900)] [box-shadow:inset_0_2px_6px_rgba(0,0,0,0.7),inset_0_-1px_0_rgba(255,255,255,0.05)]"
      aria-hidden
    >
      <Icon
        name={complete ? 'check' : 'quest'}
        size={15}
        className={complete ? 'text-[color:var(--color-hearth-soft)]' : 'text-[color:var(--color-parchment-dim)]'}
      />
    </div>
  )
}

export function QuestLog({ open, onClose }: QuestLogProps): React.JSX.Element {
  const questStates = useRunStore((s) => s.questStates)
  const activeQuests = Object.entries(questStates)

  return (
    <Dialog isOpen={open} onOpenChange={(o) => { if (!o) onClose() }} aria-label="Quest Log">
      <div id="quest-log-panel" className="flex flex-col min-w-[480px] max-w-[560px] max-h-[80vh] overflow-y-auto select-none">
        <div className="hud-panel-header flex items-center justify-between pb-2">
          <Heading level={2} className="voice-display m-0 text-lg tracking-widest text-[color:var(--color-parchment)]">
            Quest Log
          </Heading>
          <Button variant="ghost" onPress={onClose} className="!px-2 !py-1" aria-label="Close">
            <Icon name="cross" size={14} />
          </Button>
        </div>

        {activeQuests.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-8 py-8 text-center">
            <Icon name="quest" size={48} className="opacity-25 text-[color:var(--color-parchment-dim)]" />
            <div className="font-body text-sm text-[color:var(--color-parchment-dim)]">
              No work on the books.
            </div>
            <div className="font-body text-xs text-[color:var(--color-text-muted)]">
              Taverns post jobs on the notice board — ask around.
            </div>
          </div>
        )}

        {activeQuests.length > 0 && (
          <div className="flex flex-col divide-y divide-[rgba(120,98,60,0.22)]">
            {activeQuests.map(([questId, state]) => {
              const descr = QUEST_DESCRIPTIONS[questId]
              if (import.meta.env.DEV && !descr) {
                console.warn(`[QuestLog] no display entry for quest id "${questId}"`)
              }
              const complete = state.currentStage === '__complete__'
              const stageText = descr?.stages[state.currentStage] ?? 'The trail is cold.'
              return (
                <div key={questId} className="flex gap-3 py-3">
                  <QuestSocket complete={complete} />
                  <div className="flex flex-1 flex-col gap-1">
                    <div
                      className={
                        'voice-display text-sm tracking-[0.08em] ' +
                        (complete ? 'text-[color:var(--color-text-muted)]' : 'text-[color:var(--color-parchment)]')
                      }
                    >
                      {descr?.name ?? 'Unmarked entry'}
                    </div>
                    <div className="font-body text-xs leading-relaxed text-[color:var(--color-parchment-dim)]">
                      {stageText}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Dialog>
  )
}
