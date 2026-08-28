import { getQuestEngine } from '../../state/questEngine'
import React from 'react'
import { useRunStore } from '../../state/runStore'
import { Dialog, Button, Heading, Icon } from '../components'

export interface QuestLogProps {
  open: boolean
  onClose: () => void
}

/** Stage prose per quest, keyed by the REAL quest id (the `sq_` prefix is
 *  part of it — this table used to key Blood Ties as 'blood_ties' and so never
 *  matched, printing "Unmarked entry" for an accepted quest). Display NAMES now
 *  come from the quest registry so a missing entry here can only ever cost the
 *  stage line, never the quest's identity. */
const QUEST_DESCRIPTIONS: Record<string, { name: string; stages: Record<string, string> }> = {
  sq_blood_ties: {
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

/* ------------------------------------------------------------------------- */
/* Ledger page furniture (tokens only)                                        */
/* ------------------------------------------------------------------------- */

/** Flat ink rule. */
function Rule({ className, weight = 0.28 }: { className?: string; weight?: number }): React.JSX.Element {
  return (
    <div aria-hidden className={`h-px ${className ?? ''}`} style={{ background: `rgba(42,33,25,${weight})` }} />
  )
}

/**
 * The contracts page: linen ground, feint ruling, double margin rule, brass
 * pins. The gradient stops at `--canvas-mid` (never `--canvas-deep`) so the
 * stage prose at the foot of a long list still clears AA.
 */
function Sheet({ ruleGap = 30, gutter = 26 }: { ruleGap?: number; gutter?: number }): React.JSX.Element {
  const pins: React.CSSProperties[] = [
    { top: 8, left: 8 }, { top: 8, right: 8 }, { bottom: 8, left: 8 }, { bottom: 8, right: 8 },
  ]
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(168deg, #f3ecda 0%, var(--canvas-base) 42%, var(--canvas-mid) 100%)' }}
      />
      <div
        aria-hidden
        className="iron-grain pointer-events-none absolute inset-0"
        style={{ mixBlendMode: 'multiply', opacity: 0.4 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0 ${ruleGap - 1}px, rgba(42,33,25,0.09) ${ruleGap - 1}px ${ruleGap}px)`,
        }}
      />
      {[0, 4].map((dx) => (
        <div
          key={dx}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px"
          style={{ left: gutter + dx, background: dx === 0 ? 'rgba(42,33,25,0.34)' : 'rgba(42,33,25,0.16)' }}
        />
      ))}
      {pins.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute h-2 w-2 rounded-full"
          style={{
            ...pos,
            background: 'radial-gradient(circle at 36% 32%, #f0d79a 0%, var(--iron-edge) 52%, #6d5218 100%)',
            boxShadow: '0 1px 2px rgba(46,32,16,0.5)',
          }}
        />
      ))}
    </>
  )
}

/**
 * The entry's status mark, struck in the margin: an open contract carries a
 * brass seal-pin, a settled one an inked ring with a check. Shape AND fill
 * differ, so the state never rests on hue alone.
 */
function QuestMark({ complete }: { complete: boolean }): React.JSX.Element {
  return (
    <div
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={
        complete
          ? { boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.34)', background: 'rgba(42,33,25,0.05)' }
          : {
            boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.5), 0 1px 2px rgba(46,32,16,0.35)',
            background: 'radial-gradient(circle at 36% 30%, #f0d79a 0%, var(--iron-edge) 62%, #7a5a1e 100%)',
          }
      }
      aria-hidden
    >
      <Icon
        name={complete ? 'check' : 'quest'}
        size={14}
        className={complete ? 'text-[color:var(--color-text-muted)]' : 'text-[color:var(--color-ash)]'}
      />
    </div>
  )
}

export function QuestLog({ open, onClose }: QuestLogProps): React.JSX.Element {
  const questStates = useRunStore((s) => s.questStates)
  const activeQuests = Object.entries(questStates)
  const openCount = activeQuests.filter(([, s]) => s.currentStage !== '__complete__').length

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      aria-label="Quest Log"
      unpadded
      className="w-[540px]"
    >
      <div
        id="quest-log-panel"
        className="page-canvas relative max-h-[80vh] cursor-default select-none overflow-hidden rounded-[var(--radius-md)]"
        style={{ background: 'var(--canvas-base)' }}
      >
        <Sheet />

        <div className="relative flex max-h-[80vh] flex-col pb-5 pl-[42px] pr-6 pt-5">
          <div className="flex items-start justify-between pb-2.5 pt-1">
            <div>
              <Heading
                level={2}
                /* `!` beats Heading.tsx's baked-in `text-amber-100` — a same-rank
                   utility that would otherwise keep the title bone-white on linen. */
                className="voice-display m-0 text-lg uppercase !tracking-[0.26em] !text-[color:var(--color-parchment)]"
              >
                Quest Log
              </Heading>
              <p className="mb-0 mt-1 font-body text-xs italic text-[color:var(--color-parchment-dim)]">
                {openCount === 0 ? 'no contracts standing' : `${openCount} contract${openCount === 1 ? '' : 's'} standing`}
              </p>
            </div>
            <Button
              variant="ghost"
              onPress={onClose}
              className="!px-2 !py-1 text-[color:var(--color-parchment-dim)]"
              aria-label="Close"
            >
              <Icon name="cross" size={16} />
            </Button>
          </div>
          <Rule weight={0.46} />
          <div className="h-[3px]" />
          <Rule weight={0.22} />

          {activeQuests.length === 0 && (
            /* Designed empty state: a dimmed silhouette pressed into the page,
               in-voice copy, and a pointer to the action that fills it. */
            <div className="flex flex-col items-center gap-2 px-8 py-10 text-center">
              <Icon name="quest" size={44} className="text-[color:var(--color-parchment-dim)] opacity-25" />
              <div className="voice-display text-sm tracking-[0.1em] text-[color:var(--color-parchment)]">
                No work on the books.
              </div>
              <div className="font-body text-xs text-[color:var(--color-text-muted)]">
                Taverns post jobs on the notice board — ask around.
              </div>
            </div>
          )}

          {activeQuests.length > 0 && (
            <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto">
              {activeQuests.map(([questId, state]) => {
                const descr = QUEST_DESCRIPTIONS[questId]
                const registryName = getQuestEngine().quests[questId]?.name
                if (import.meta.env.DEV && !descr) {
                  console.warn(`[QuestLog] no display entry for quest id "${questId}"`)
                }
                const complete = state.currentStage === '__complete__'
                const stageText = descr?.stages[state.currentStage] ?? 'The trail is cold.'
                return (
                  <div key={questId}>
                    <div className="flex gap-3 py-3">
                      <QuestMark complete={complete} />
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={
                              'voice-display text-sm tracking-[0.08em] ' +
                              (complete
                                ? 'text-[color:var(--color-text-muted)] line-through decoration-[rgba(42,33,25,0.45)]'
                                : 'text-[color:var(--color-parchment)]')
                            }
                          >
                            {descr?.name ?? registryName ?? 'Unmarked entry'}
                          </span>
                          {complete && (
                            <span
                              className="voice-display shrink-0 px-1.5 py-px text-[0.55rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]"
                              style={{ boxShadow: 'inset 0 0 0 1px rgba(42,33,25,0.32)' }}
                            >
                              Settled
                            </span>
                          )}
                        </div>
                        <div className="font-body text-xs leading-relaxed text-[color:var(--color-parchment-dim)]">
                          {stageText}
                        </div>
                      </div>
                    </div>
                    <Rule weight={0.2} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
