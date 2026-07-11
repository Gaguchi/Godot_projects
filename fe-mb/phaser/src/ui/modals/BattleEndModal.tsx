import React, { useEffect, useState } from 'react'
import { useCombatStore } from '../../state/combatStore'
import { useRunStore } from '../../state/runStore'
import { Dialog, Button, Heading } from '../components'
import { CheckEventModal, type CheckEvent } from './CheckEventModal'
import type { QuestEffect } from '../../domain/quest'
import interrogateSurvivor from '../../data/content/checkEvents/interrogate_survivor.json'

const CHECK_EVENTS: Record<string, CheckEvent> = {
  interrogate_survivor: interrogateSurvivor as CheckEvent,
}

/**
 * Ceremony motion (scoped to this modal): the heading lands with a back-out
 * settle, then children rise in staggered. Pure CSS entrance — skippable by
 * nature, and fully collapsed under prefers-reduced-motion.
 */
const CEREMONY_CSS = `
@keyframes battleEndHeadingIn {
  from { opacity: 0; transform: scale(1.15); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes battleEndRiseIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.battle-end-heading { animation: battleEndHeadingIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.battle-end-rise { animation: battleEndRiseIn var(--dur-move) var(--ease-out-quart) both; }
@media (prefers-reduced-motion: reduce) {
  .battle-end-heading, .battle-end-rise { animation: none; }
}
`

/** Staggered-child entrance delay — 60ms steps after the heading lands. */
function riseDelay(step: number): string {
  return `${240 + step * 60}ms`
}

/** Small-caps muted label under a tally numeral / above a chip row. */
const LABEL_CLASS = 'text-[0.65rem] uppercase tracking-[0.18em]'
const LABEL_STYLE: React.CSSProperties = { color: 'var(--color-text-muted)' }

/** 2–3 ember motes drifting up from the hearth pool (victory mood only). */
function VictoryEmbers(): React.JSX.Element {
  const embers = [
    { left: '38%', delay: '0.4s', drift: '12px', size: 3, dur: '6.5s' },
    { left: '52%', delay: '2.2s', drift: '-10px', size: 2, dur: '7.5s' },
    { left: '64%', delay: '1.1s', drift: '8px', size: 2, dur: '6s' },
  ]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {embers.map((e, i) => (
        <span
          key={i}
          className="absolute bottom-8 rounded-full"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            background: 'radial-gradient(circle, var(--color-hearth) 0%, transparent 70%)',
            boxShadow: '0 0 6px color-mix(in oklab, var(--color-hearth) 80%, transparent)',
            // @ts-expect-error custom property consumed by the emberRise keyframe
            '--ember-drift': e.drift,
            animation: `emberRise ${e.dur} linear infinite`,
            animationDelay: e.delay,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Victory / Defeat overlay shown when combatStore.state.phase becomes
 * VICTORY or DEFEAT. Subscribes to the store directly; mounted at App
 * root so it renders regardless of the active view.
 */
export interface BattleEndModalProps {
  onRestart: () => void
  onReturnToTitle: () => void
  onContinueToOverworld?: () => void
  /** Wipe run + start a fresh one (win screen / game-over). */
  onNewRun?: () => void
}

export function BattleEndModal({
  onRestart, onReturnToTitle, onContinueToOverworld, onNewRun,
}: BattleEndModalProps): React.JSX.Element {
  const phase = useCombatStore((s) => s.state.phase)
  const units = useCombatStore((s) => s.state.units)
  const battleTag = useCombatStore((s) => s.state.battleTag)
  const dispatchRun = useRunStore((s) => s.dispatch)
  const runStats = useRunStore((s) => s.runStats)
  const daysElapsed = useRunStore((s) => s.daysElapsed)
  const [victoryEventResolved, setVictoryEventResolved] = useState(false)
  const [activeVictoryEvent, setActiveVictoryEvent] = useState<CheckEvent | null>(null)

  const open = phase === 'VICTORY' || phase === 'DEFEAT'
  const isVictory = phase === 'VICTORY'

  // Trigger victory check-event on first VICTORY frame. Uses the active
  // battle's source enemy group (when set on the runtime store) to look up
  // its `victoryEvent` reference.
  useEffect(() => {
    if (!isVictory || victoryEventResolved) return
    // Tutorial and final-boss victories go straight to their end screens —
    // no post-battle interrogation event.
    if (battleTag === 'tutorial' || battleTag === 'finalBoss') {
      setVictoryEventResolved(true)
      return
    }
    const pendingBattle = useRunStore.getState().pendingTravelPath
    void pendingBattle
    // Inspect units to find the bandit group; pull victoryEvent ref from
    // the first known group with a non-zero count of defeated members.
    // For SC-10's smoke implementation, hard-bind the bandits_small group
    // (the only authored victoryEvent). Future tasks can plumb the actual
    // active enemyGroupId through combat state.
    const anyBanditDefeated = Object.values(units).some(
      (u) => u.hp.current === 0 && (u.classId as unknown as string).includes('bandit'),
    )
    if (anyBanditDefeated) {
      const ref = 'interrogate_survivor'
      const evt = CHECK_EVENTS[ref]
      if (evt) setActiveVictoryEvent(evt)
    } else {
      setVictoryEventResolved(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Reset on phase leaving VICTORY/DEFEAT (e.g. after Continue/Restart).
  useEffect(() => {
    if (phase !== 'VICTORY' && phase !== 'DEFEAT') {
      setVictoryEventResolved(false)
      setActiveVictoryEvent(null)
    }
  }, [phase])

  const partyAlive = Object.values(units).filter(
    (u) => u.hp.current > 0 && !(u.classId as unknown as string).includes('bandit'),
  )
  const enemiesDefeated = Object.values(units).filter(
    (u) => u.hp.current <= 0 && (u.classId as unknown as string).includes('bandit'),
  ).length

  // While a victory event is active and unresolved, render only the
  // CheckEventModal. The standard BattleEnd dialog is suppressed until the
  // event resolves.
  if (isVictory && activeVictoryEvent) {
    return (
      <CheckEventModal
        event={activeVictoryEvent}
        party={Object.values(useRunStore.getState().party.units)}
        gold={useRunStore.getState().gold}
        foodCount={
          useRunStore
            .getState()
            .inventory.items.filter((i) => (i.itemId as unknown as string) === 'food_rations').length
        }
        onResolve={({ outcome }) => {
          if (outcome.effects.length > 0) {
            dispatchRun({
              type: 'applyQuestEffects',
              payload: { effects: outcome.effects as QuestEffect[] },
            })
          }
          setActiveVictoryEvent(null)
          setVictoryEventResolved(true)
        }}
        onClose={() => {
          setActiveVictoryEvent(null)
          setVictoryEventResolved(true)
        }}
      />
    )
  }

  // Run-terminal states (ship plan §12): boss victory → win screen; party
  // wipe → game-over screen. Both summarize the run and offer New Run.
  const isRunComplete = isVictory && battleTag === 'finalBoss'
  const isGameOver = phase === 'DEFEAT'
  const runEnded = isRunComplete || isGameOver

  // Run tally: days is the headline; the rest read as the ledger beneath.
  const stats: Array<[string, number]> = [
    ['Hops traveled', runStats.hops],
    ['Battles won', runStats.battlesWon],
    ['Enemies defeated', runStats.enemiesDefeated],
    ['Enemies captured', runStats.enemiesCaptured],
    ['Companions lost', runStats.unitsLost],
    ['Gold earned', runStats.goldEarned],
    ['Gear found', runStats.gearFound],
  ]
  const rowBaseDelay = 240 + 2 * 60
  const buttonDelay = runEnded ? rowBaseDelay + stats.length * 40 + 60 : 240 + 3 * 60

  return (
    <Dialog
      isOpen={open}
      onOpenChange={() => undefined}
      isDismissable={false}
      aria-label={isRunComplete ? 'Run Complete' : isVictory ? 'Victory' : 'Game Over'}
      className="relative overflow-hidden"
      unpadded
    >
      <div
        id={isRunComplete ? 'run-complete-modal' : isVictory ? 'victory-modal' : 'defeat-modal'}
        className="relative min-w-[460px] max-w-[560px] overflow-hidden px-10 pb-8 pt-9 text-center"
      >
        <style>{CEREMONY_CSS}</style>

        {/* Outcome mood layer: victory = hearth pool + ember motes rising;
            defeat = cold rust bleed from above + ash vignette. Tinted inner
            seam replaces the old stock-color border. */}
        {isVictory ? (
          <>
            <div
              aria-hidden
              className="hearth-glow-strong pointer-events-none absolute inset-0"
              style={{
                boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--color-hearth) 32%, transparent)',
              }}
            />
            <VictoryEmbers />
          </>
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 100% 65% at 50% -8%, color-mix(in oklab, var(--color-enemy) 13%, transparent) 0%, transparent 62%), ' +
                'radial-gradient(ellipse 130% 100% at 50% 45%, transparent 52%, color-mix(in oklab, var(--color-ash) 78%, transparent) 100%)',
              boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--color-enemy) 26%, transparent)',
            }}
          />
        )}

        <div className="relative flex flex-col gap-5">
          <Heading
            level={1}
            className={
              'battle-end-heading m-0 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] ' +
              (isRunComplete ? 'text-3xl tracking-[0.3em] pl-[0.3em]' : 'text-4xl tracking-[0.4em] pl-[0.4em]')
            }
          >
            <span style={{ color: isVictory ? 'var(--color-hearth)' : 'var(--hp-crit-text)' }}>
              {isRunComplete ? 'THE THRONE IS YOURS' : isGameOver ? 'GAME OVER' : 'VICTORY'}
            </span>
          </Heading>

          <div
            className="battle-end-rise font-body text-sm italic"
            style={{ animationDelay: riseDelay(0), color: 'var(--color-text-muted)' }}
          >
            {isRunComplete
              ? 'The Warlord is defeated. The frontier is crossed.'
              : isGameOver
                ? 'Your party has fallen. The road claims another company.'
                : 'The field is yours. The road goes on.'}
          </div>

          {runEnded ? (
            <div className="mx-auto flex w-[300px] flex-col items-stretch gap-3">
              {/* Headline: the run's length is the story number. */}
              <div className="battle-end-rise flex flex-col items-center gap-1" style={{ animationDelay: riseDelay(1) }}>
                <span className="numeral text-3xl leading-none" style={{ color: 'var(--color-parchment)' }}>
                  {daysElapsed}
                </span>
                <span className={LABEL_CLASS} style={LABEL_STYLE}>Days on the Road</span>
              </div>
              <div
                aria-hidden
                className="battle-end-rise h-px"
                style={{
                  animationDelay: `${rowBaseDelay - 20}ms`,
                  background: isVictory
                    ? 'linear-gradient(to right, transparent, color-mix(in oklab, var(--color-hearth-soft) 40%, transparent), transparent)'
                    : 'linear-gradient(to right, transparent, color-mix(in oklab, var(--color-text-muted) 35%, transparent), transparent)',
                }}
              />
              {/* Ledger rows — zero rows dim to a dash so the real story carries the eye. */}
              <div className="flex flex-col gap-1.5 text-sm">
                {stats.map(([label, value], i) => {
                  const zero = value === 0
                  return (
                    <div
                      key={label}
                      className="battle-end-rise flex items-baseline justify-between gap-8"
                      style={{ animationDelay: `${rowBaseDelay + i * 40}ms`, opacity: zero ? 0.45 : undefined }}
                    >
                      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                      <span
                        className="numeral text-base"
                        style={{ color: zero ? 'var(--color-text-muted)' : 'var(--color-parchment)' }}
                      >
                        {zero ? '—' : value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Designed tally: the payoff number is the largest text on the panel. */}
              <div className="battle-end-rise flex flex-col items-center gap-1" style={{ animationDelay: riseDelay(1) }}>
                <span className="numeral text-3xl leading-none" style={{ color: 'var(--color-parchment)' }}>
                  {enemiesDefeated}
                </span>
                <span className={LABEL_CLASS} style={LABEL_STYLE}>
                  {enemiesDefeated === 1 ? 'Enemy Defeated' : 'Enemies Defeated'}
                </span>
              </div>
              {/* Survivors as unit chips with ally diamond markers. */}
              <div className="battle-end-rise flex flex-col items-center gap-2" style={{ animationDelay: riseDelay(2) }}>
                <span className={LABEL_CLASS} style={LABEL_STYLE}>Survivors</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {partyAlive.length > 0 ? (
                    partyAlive.map((u) => (
                      <span
                        key={u.id as unknown as string}
                        className="voice-display inline-flex items-center gap-1.5 rounded-[3px] px-2.5 py-1 text-sm"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid color-mix(in oklab, var(--color-hearth-soft) 28%, transparent)',
                          color: 'var(--color-parchment)',
                        }}
                      >
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rotate-45"
                          style={{ background: 'var(--color-ally)' }}
                        />
                        {u.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>—</span>
                  )}
                </div>
              </div>
            </>
          )}

          <div
            className="battle-end-rise mt-2 flex flex-wrap justify-center gap-3"
            style={{ animationDelay: `${buttonDelay}ms` }}
          >
            {runEnded ? (
              <>
                {onNewRun && (
                  <Button id="battle-end-new-run" variant="primary" onPress={onNewRun}>
                    New Run
                  </Button>
                )}
                <Button id="battle-end-title-btn" variant="ghost" onPress={onReturnToTitle}>
                  Return to Title
                </Button>
              </>
            ) : (
              <>
                {isVictory && onContinueToOverworld && (
                  <Button id="battle-end-continue" variant="primary" onPress={onContinueToOverworld}>
                    Continue
                  </Button>
                )}
                <Button id="battle-end-restart" variant="secondary" onPress={onRestart}>
                  Restart
                </Button>
                <Button id="battle-end-title-btn" variant="ghost" onPress={onReturnToTitle}>
                  Return to Title
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
