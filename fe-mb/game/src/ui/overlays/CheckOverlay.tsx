/**
 * ui/overlays/CheckOverlay.tsx — a road event on a parchment card: title, the situation, the options as prose
 * buttons (a stat check prints `[STR 7 · Oak 9]` under a drawn tick from the best living candidate; the engine
 * auto-picks that unit when `attemptingUnitId` is null). After the choice the card shows it under a seal — PASSED,
 * FAILED, or CHOSEN when the option carried no check at all (`run/checks.ts#verdictOf`) — and one Continue.
 */
import React, { useCallback } from 'react'
import { overlayOf } from '../../engine/flow/pump'
import { foodCount } from '../../engine/run/bag'
import type { CheckVerdict } from '../../engine/run/checks'
import { autoPick, checkCandidates, evaluateCheck, verdictOf } from '../../engine/run/checks'
import { renderText } from '../../engine/run/dialogue'
import { displayName, livingUnits } from '../../engine/run/party'
import type { GameState, RunState, UnitId } from '../../engine/types'
import { Button } from '../components/Button'
import { CheckTag } from '../components/CheckTag'
import { InkRule } from '../components/LedgerPage'
import { className } from '../names'
import { dispatch, useEnv, useGame } from '../store'

interface View {
  readonly title: string
  readonly text: string
  readonly resolved: { readonly verdict: CheckVerdict; readonly narration: string; readonly attempting: string | null } | null
  readonly choices: readonly { readonly id: string; readonly text: string; readonly tag: string | null; readonly tagOk: boolean | null }[]
  readonly source: string
}

/** Whoever the engine credited, under the name the player knows them by (`run/party.ts#displayName`). */
function attemptingName(unitId: UnitId | null, run: RunState): string | null {
  if (unitId === null) return null
  const unit = run.party[unitId]
  return unit === undefined ? null : displayName(unit, run)
}

const STAT_LABEL: Readonly<Record<string, string>> = { str: 'STR', mag: 'MAG', skl: 'SKL', spd: 'SPD', lck: 'LCK', def: 'DEF', res: 'RES', mov: 'MOV' }
const SOURCE_LABEL: Readonly<Record<string, string>> = { travel: 'On the road', dungeon: 'In the dark', victory: 'After the fight', discovery: 'A discovery' }
/** One stamp per verdict. An option with no check was taken, not won: it gets the neutral ink, never the green
 *  one a roll earns (RE-GATE C 3.11, 0118). */
const SEAL: Readonly<Record<CheckVerdict, { readonly word: string; readonly mod: string }>> = {
  passed: { word: 'Passed', mod: 'pass' },
  failed: { word: 'Failed', mod: 'fail' },
  untested: { word: 'Chosen', mod: 'none' },
}

export function CheckOverlay(): React.JSX.Element | null {
  const env = useEnv()
  const select = useCallback((s: GameState): View | null => {
    const run = s.run
    const overlay = overlayOf(s)
    if (run === null || overlay?.kind !== 'checkEvent') return null
    const ev = env.content.checkEvents[overlay.event.checkEventId]
    if (ev === undefined) return null
    const result = overlay.event.result
    return {
      title: ev.title,
      text: renderText(ev.description, run, env),
      source: SOURCE_LABEL[overlay.event.source] ?? overlay.event.source,
      // The seal names the unit the PLAYER knows: a foundling the player christened must not be sealed under the
      // authored placeholder while the band one line above reads the chosen name (CONTRACT-CHANGES 0051's class).
      resolved: result === null ? null : { verdict: verdictOf(overlay.event, env) ?? 'untested', narration: renderText(result.narration, run, env), attempting: attemptingName(result.attemptingUnitId, run) },
      choices: ev.choices.map((c) => {
        const check = c.check
        let tag: string | null = null
        let tagOk: boolean | null = null
        if (check !== undefined) {
          // The verdict comes from the ENGINE's own reading on the unit it will auto-pick, so the badge and the roll can
          // never disagree — and EVERY kind gets one. `class` and `food` used to render a bare neutral pill, so the
          // player clicked a doomed choice with nothing to read.
          tagOk = evaluateCheck(check, autoPick(check, run, env), run, env)
          if (check.kind === 'stat') {
            const best = checkCandidates(check, run)[0]
            tag = `${STAT_LABEL[check.stat] ?? check.stat} ${check.threshold}${best !== undefined ? ` · ${best.name} ${best.statValue}` : ''}`
          } else if (check.kind === 'class') {
            const who = livingUnits(run).find((u) => u.classId === check.classId)
            tag = `needs a ${className(check.classId, env)}${who !== undefined ? ` · ${displayName(who, run)}` : ''}`
          } else if (check.kind === 'gold') tag = `${check.amount} gold · ${run.gold} held`
          else tag = `${check.amount} food · ${foodCount(run.bag, env)} held`
        }
        return { id: c.id, text: renderText(c.text, run, env), tag, tagOk }
      }),
    }
  }, [env])
  const view = useGame(select, (a, b) => JSON.stringify(a) === JSON.stringify(b))
  if (view === null) return null
  return (
    <div className="event" data-testid="check-event">
      <div className="event__scrim" />
      <section className="page-canvas event__card">
        <div className="event__eyebrow voice-display">{view.source}</div>
        <h2 className="event__title voice-display">{view.title}</h2>
        <InkRule />
        {view.resolved === null ? (
          <>
            <p className="event__text">{view.text}</p>
            <div className="event__choices">
              {view.choices.map((c, i) => (
                <Button key={c.id} variant={i === 0 ? 'primary' : 'secondary'} prose onPress={() => dispatch({ type: 'check/choose', choiceId: c.id, attemptingUnitId: null })} testId={`check-${c.id}`}>
                  {c.text}
                  {c.tag !== null && <CheckTag text={c.tag} ok={c.tagOk} />}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={`event__seal event__seal--${SEAL[view.resolved.verdict].mod}`} data-verdict={view.resolved.verdict} data-testid="check-result">
              {SEAL[view.resolved.verdict].word}{view.resolved.attempting !== null ? ` · ${view.resolved.attempting}` : ''}
            </div>
            <p className="event__text">{view.resolved.narration}</p>
            <div className="event__choices">
              <Button variant="primary" onPress={() => dispatch({ type: 'check/dismiss' })} testId="check-dismiss" autoFocus>Continue</Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
