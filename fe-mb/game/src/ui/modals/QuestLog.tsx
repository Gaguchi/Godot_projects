/**
 * ui/modals/QuestLog.tsx — Contracts: every quest the company has taken, its current stage in plain words, the
 * day it was taken and how long it has been open; settled ones struck through below. Read-only — quests advance
 * through the world (dialogue, battles, arrivals), never from here.
 *
 * The sheet is as tall as what is written on it (`LedgerPage minHeight`). A fixed 640×520 page holding three lines
 * was 45% ruled emptiness with a one-line italic "no contracts" in the middle of it — the worst of the six voids
 * the gate measured (GATE2-16), and the empty state was the amateur read besides (signal C).
 */
import React, { useCallback } from 'react'
import { questStatus } from '../../engine/run/quests'
import type { GameState } from '../../engine/types'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { InkRule, LedgerPage } from '../components/LedgerPage'
import { questName, stageLabel } from '../names'
import { dispatch, useEnv, useGame } from '../store'

interface Row {
  readonly id: string
  readonly name: string
  readonly stage: string
  readonly day: number
  readonly openFor: number
  readonly done: boolean
}

interface View {
  readonly rows: readonly Row[]
  readonly today: number
}

export function QuestLogModal(): React.JSX.Element | null {
  const env = useEnv()
  const view = useGame(useCallback((s: GameState): View | null => {
    const run = s.run
    if (run === null) return null
    return {
      today: run.daysElapsed,
      rows: Object.entries(run.questStates).map(([id, st]) => ({
        id,
        name: questName(id, env),
        stage: stageLabel(id, st.stage, env),
        day: st.startedDay,
        openFor: Math.max(0, run.daysElapsed - st.startedDay),
        done: questStatus(run, id) === 'complete',
      })),
    }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  if (view === null) return null
  const open = view.rows.filter((r) => !r.done)
  const done = view.rows.filter((r) => r.done)
  return (
    <div className="event" data-testid="quest-log">
      <div className="event__scrim" onClick={() => dispatch({ type: 'ui/closeModal' })} />
      <LedgerPage width={620} minHeight={300} testId="quest-log-page">
        <div className="report__eyebrow voice-display">the company ledger</div>
        <h2 className="report__title voice-display">Contracts</h2>
        <InkRule brackets />
        <div className="quest__tally voice-display" data-testid="quest-tally">
          <span><b className="numeral">{open.length}</b> open</span>
          <span><b className="numeral">{done.length}</b> settled</span>
          <span>the <b className="numeral">{view.today}{ordinal(view.today)}</b> day</span>
        </div>
        {open.length === 0 && done.length === 0
          ? (
            <div className="ledger-empty" data-testid="quest-empty">
              <span className="ledger-empty__mark" aria-hidden><Icon name="event" size={26} /></span>
              <span className="ledger-empty__stack">
                <span className="ledger-empty__line">Nothing written on this page yet.</span>
                <span className="ledger-empty__hint">Work is offered in taverns — reach a town and ask at the board.</span>
              </span>
            </div>
          )
          : (
            <>
              {open.length > 0 && (
                <>
                  <div className="report__label voice-display">Open</div>
                  {open.map((r) => (
                    <div key={r.id} className="report__row quest__row">
                      <span className="report__name"><Icon name="bullet" size={11} filled /> {r.name}</span>
                      <span className="quest__stage">{r.stage}</span>
                      <span className="report__class">{r.openFor === 0 ? 'taken today' : <>day <b className="numeral">{r.day}</b> · <b className="numeral">{r.openFor}</b> {r.openFor === 1 ? 'day' : 'days'} open</>}</span>
                    </div>
                  ))}
                </>
              )}
              {done.length > 0 && (
                <>
                  <div className="report__label voice-display" style={{ marginTop: 14 }}>Settled</div>
                  {done.map((r) => (
                    <div key={r.id} className="report__row quest__row quest__row--done">
                      <span className="report__name">{r.name}</span>
                      <span className="report__class">taken on day <b className="numeral">{r.day}</b></span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        <div className="report__verbs">
          <Button variant="primary" onPress={() => dispatch({ type: 'ui/closeModal' })} testId="quest-log-close" autoFocus>Close</Button>
        </div>
      </LedgerPage>
    </div>
  )
}

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}
