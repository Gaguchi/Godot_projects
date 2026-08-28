import React, { useEffect, useState } from 'react'
import { useCombatStore } from '../../state/combatStore'
import { isEnemyUnit } from '../../systems/team'
import { useRunStore } from '../../state/runStore'
import { Dialog, Button, Heading } from '../components'
import { CheckEventModal, type CheckEvent } from './CheckEventModal'
import type { QuestEffect } from '../../domain/quest'
import interrogateSurvivor from '../../data/content/checkEvents/interrogate_survivor.json'

const CHECK_EVENTS: Record<string, CheckEvent> = {
  interrogate_survivor: interrogateSurvivor as CheckEvent,
}

/**
 * "Field Ledger" grounding: the battle-end ceremony is the quartermaster
 * WRITING THE ENGAGEMENT UP — a linen report page inside the leather folder,
 * walnut ink, the tally set as a ruled ledger column with dotted leaders and
 * tabular numerals. Victory and defeat differ by copy first, then by ink
 * (walnut vs oxblood) and by the colour of the rules; defeat's page is the
 * greyer, weathered sheet. Nothing glows: the hearth pool, the ember motes
 * and the ash vignette are gone.
 *
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

/** The report sheet. Victory is fresh linen; defeat is the same page gone
 *  grey and weathered — a colder sheet, not a darker room. Both gradients run
 *  base → mid and never reach --canvas-deep, and the defeat mix is capped at
 *  14% neutral so every muted pair on it still clears AA (measured: the
 *  weakest, --color-text-muted on the bottom band, is 4.8:1). */
const WEATHER_GREY = '#a8a49a'
function sheetBackground(isVictory: boolean): string {
  return isVictory
    ? 'linear-gradient(180deg, var(--canvas-base) 0%, var(--canvas-mid) 100%)'
    : `linear-gradient(180deg, color-mix(in oklab, var(--canvas-base) 86%, ${WEATHER_GREY}) 0%, `
      + `color-mix(in oklab, var(--canvas-mid) 86%, ${WEATHER_GREY}) 100%)`
}

/** The one rule colour on the page: struck brass for a win, oxblood for a
 *  loss. Rules and edges only — brass never carries small text on canvas. */
function ruleColor(isVictory: boolean): string {
  return isVictory
    ? 'color-mix(in oklab, var(--color-hearth-soft) 62%, transparent)'
    : 'color-mix(in oklab, var(--color-ember) 46%, transparent)'
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

  // systems/team.ts, not a bandit substring: against any non-bandit group the
  // old checks printed "0 enemies defeated" and listed surviving ENEMIES as
  // your party. (The victory-event check above stays bandit-specific — the
  // interrogate_survivor event is authored for the bandits group only.)
  const partyAlive = Object.values(units).filter(
    (u) => u.hp.current > 0 && !isEnemyUnit(u),
  )
  const partyFallen = Object.values(units).filter(
    (u) => u.hp.current <= 0 && !isEnemyUnit(u) && !u.captured,
  )
  const enemiesDefeated = Object.values(units).filter(
    (u) => u.hp.current <= 0 && isEnemyUnit(u) && !u.captured,
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
        className="page-canvas relative min-w-[460px] max-w-[560px] overflow-hidden px-10 pb-8 pt-8 text-center"
      >
        <style>{CEREMONY_CSS}</style>

        {/* The report sheet: linen ground, faint ruling, linen weave. Flat —
            no pool, no motes, no vignette. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: sheetBackground(isVictory) }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0 34px, rgba(42,33,25,0.07) 34px 35px)',
          }}
        />
        <div
          aria-hidden
          className="iron-grain pointer-events-none absolute inset-0"
          style={{ mixBlendMode: 'multiply', opacity: 0.4 }}
        />
        {/* brass (or oxblood) corner brackets pinning the sheet in the folder */}
        {[
          'left-2 top-2 border-l-2 border-t-2',
          'right-2 top-2 border-r-2 border-t-2',
          'left-2 bottom-2 border-b-2 border-l-2',
          'right-2 bottom-2 border-b-2 border-r-2',
        ].map((pos) => (
          <span
            key={pos}
            aria-hidden
            className={`pointer-events-none absolute ${pos} h-3.5 w-3.5`}
            style={{ borderColor: ruleColor(isVictory) }}
          />
        ))}

        <div className="relative flex flex-col gap-5">
          {/* The ledger entry's header: what this page IS, then the verdict
              stamped between two flat ink rules. */}
          <div className="flex flex-col items-center gap-2">
            <span className={LABEL_CLASS} style={LABEL_STYLE}>
              {runEnded ? 'Final Entry' : 'Field Report'}
            </span>
            <div
              aria-hidden
              className="h-px w-full"
              style={{ background: 'rgba(42,33,25,0.42)' }}
            />
            <Heading
              level={1}
              className={
                'battle-end-heading m-0 ' +
                (isRunComplete ? 'text-3xl tracking-[0.3em] pl-[0.3em]' : 'text-4xl tracking-[0.4em] pl-[0.4em]')
              }
            >
              <span
                style={{
                  color: isVictory ? 'var(--color-ink)' : 'var(--color-damage-text)',
                  textShadow: '0 1px 0 rgba(255,252,244,0.6)',
                }}
              >
                {isRunComplete ? 'THE THRONE IS YOURS' : isGameOver ? 'GAME OVER' : 'VICTORY'}
              </span>
            </Heading>
            <div
              aria-hidden
              className="h-px w-full"
              style={{ background: 'rgba(42,33,25,0.42)' }}
            />
          </div>

          <div
            className="battle-end-rise font-body text-sm italic"
            style={{ animationDelay: riseDelay(0), color: 'var(--color-parchment-dim)' }}
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
                  background: ruleColor(isVictory),
                }}
              />
              {/* Ledger rows — dotted leaders carry the eye from the entry to
                  its figure, the way a written tally does. Zero rows fade to a
                  dash so the real story keeps the weight. */}
              <div className="flex flex-col gap-1.5 text-sm">
                {stats.map(([label, value], i) => {
                  const zero = value === 0
                  return (
                    <div
                      key={label}
                      className="battle-end-rise flex items-baseline gap-2"
                      style={{ animationDelay: `${rowBaseDelay + i * 40}ms`, opacity: zero ? 0.55 : undefined }}
                    >
                      <span style={{ color: 'var(--color-parchment-dim)' }}>{label}</span>
                      <span
                        aria-hidden
                        className="min-w-4 flex-1 self-end border-b border-dotted"
                        style={{ borderColor: 'var(--canvas-rule)', marginBottom: '0.28em' }}
                      />
                      <span
                        className="numeral text-base"
                        style={{ color: zero ? 'var(--color-parchment-dim)' : 'var(--color-parchment)' }}
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
                        className="voice-display inline-flex items-center gap-1.5 rounded-[2px] px-2.5 py-1 text-sm"
                        style={{
                          background: 'rgba(255, 252, 244, 0.5)',
                          border: '1px solid var(--canvas-rule)',
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
                    <span className="text-sm" style={{ color: 'var(--color-parchment-dim)' }}>—</span>
                  )}
                </div>
              </div>
              {/* The fallen, named. Permadeath is the game's hardest rule and
                  used to happen with NO acknowledgement anywhere — a unit just
                  vanished from the board and the survivors list. */}
              {partyFallen.length > 0 && (
                <div className="battle-end-rise flex flex-col items-center gap-2" style={{ animationDelay: riseDelay(3) }}>
                  <span className={LABEL_CLASS} style={{ ...LABEL_STYLE, color: 'var(--color-damage-text)' }}>Fallen</span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {partyFallen.map((u) => (
                      <span
                        key={u.id as unknown as string}
                        className="voice-display inline-flex items-center gap-1.5 rounded-[2px] px-2.5 py-1 text-sm line-through"
                        style={{
                          // Same linen wash as the survivors: an oxblood TINT
                          // under oxblood text dropped the name to 4.45:1 on
                          // the mid band. The rule, the strike and the diamond
                          // carry the distinction instead — measured 6.5:1.
                          background: 'rgba(255, 252, 244, 0.5)',
                          border: '1px solid color-mix(in oklab, var(--color-ember) 55%, transparent)',
                          color: 'var(--color-damage-text)',
                        }}
                      >
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rotate-45"
                          style={{ background: 'var(--color-damage-text)' }}
                        />
                        {u.name}
                      </span>
                    ))}
                  </div>
                  <span className="font-body text-xs italic" style={{ color: 'var(--color-parchment-dim)' }}>
                    Lost for good. The company marches lighter.
                  </span>
                </div>
              )}
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
