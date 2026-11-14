/**
 * ui/overlays/CheckOverlay.tsx — a road event (board F64Check), a window over the dimmed world: where it happens,
 * its title, the situation, and the answers as a numbered list. An answer that tests the company prints what it asks
 * and who would answer it (`STR 6 · Oak 6`), in moss when they meet it and rust when they fall short: the verdict is
 * the ENGINE's own reading on the unit it will auto-pick, so the tag and the roll cannot disagree. After the choice
 * the window shows it under a seal — Passed, Failed, or Chosen when the answer carried no check at all
 * (`run/checks.ts#verdictOf`) — with what happened and one Continue. Keys 1-9 answer; Enter continues.
 *
 * Under the answers, one line says in words what the tag says in figures, for the answer pointed at: who would
 * answer it and how they compare. A tag is a reading; the line is the sentence a new player needs once.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { overlayOf } from '../../engine/flow/pump'
import type { CheckVerdict } from '../../engine/run/checks'
import { verdictOf } from '../../engine/run/checks'
import { renderText } from '../../engine/run/dialogue'
import { displayName } from '../../engine/run/party'
import type { GameState, RunState, UnitId } from '../../engine/types'
import { FBtn, FChoice, Key, Modal } from '../filigree/kit'
import { dispatch, useEnv, useGame } from '../store'
import { UNTESTED, readCheck } from './checkReading'

interface View {
  readonly title: string
  readonly text: string
  readonly resolved: { readonly verdict: CheckVerdict; readonly narration: string; readonly attempting: string | null } | null
  readonly choices: readonly { readonly id: string; readonly text: string; readonly tag: string | null; readonly tagOk: boolean | null; readonly why: string }[]
  readonly source: string
}

/** Whoever the engine credited, under the name the player knows them by (`run/party.ts#displayName`). */
function attemptingName(unitId: UnitId | null, run: RunState): string | null {
  if (unitId === null) return null
  const unit = run.party[unitId]
  return unit === undefined ? null : displayName(unit, run)
}

const SOURCE_LABEL: Readonly<Record<string, string>> = { travel: 'On the road', dungeon: 'In the dark', victory: 'After the fight', discovery: 'A discovery' }
/** One stamp per verdict. An option with no check was taken, not won: it gets the neutral ink, never the green
 *  one a roll earns (RE-GATE C 3.11, 0118). */
const MW = 604
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
      // one reading per answer (`checkReading.ts`): the tag, its verdict and the sentence under the list agree by
      // construction, and EVERY kind gets a verdict (`class` and `food` used to render a bare neutral pill)
      choices: ev.choices.map((c) => {
        const r = c.check === undefined ? null : readCheck(c.check, run, env)
        return { id: c.id, text: renderText(c.text, run, env), tag: r?.tag ?? null, tagOk: r?.ok ?? null, why: r?.why ?? UNTESTED }
      }),
    }
  }, [env])
  const view = useGame(select, (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const [pointed, setPointed] = useState<string | null>(null)
  useEffect(() => {
    if (view === null) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return
      if (view.resolved !== null) { if (e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'check/dismiss' }) } return }
      const c = view.choices[Number(e.key) - 1]
      if (c !== undefined) { e.preventDefault(); dispatch({ type: 'check/choose', choiceId: c.id, attemptingUnitId: null }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])
  if (view === null) return null
  const IW = MW - 40
  const at = view.choices.find((c) => c.id === pointed) ?? null
  const last = view.choices.length
  return (
    <Modal w={MW} eyebrow={view.source} heading={view.title} testId="check-event">
      <div className="frule" style={{ position: 'relative', height: 7, margin: '10px 0 8px' }} />
      {view.resolved === null ? (
        <>
          <p className="s16 lt bone" style={{ whiteSpace: 'normal', lineHeight: '23px' }} data-testid="check-text">{view.text}</p>
          <div style={{ position: 'relative', height: view.choices.length * 34 + 4, marginTop: 12 }}>
            {view.choices.map((c, i) => (
              <FChoice key={c.id} x={4} y={i * 34} w={IW - 4} n={i + 1} label={c.text} onPress={() => { setPointed(null); dispatch({ type: 'check/choose', choiceId: c.id, attemptingUnitId: null }) }} onHover={(on) => setPointed((p) => (on ? c.id : p === c.id ? null : p))} testId={`check-${c.id}`} {...(c.tag !== null ? { tag: c.tag, tagOk: c.tagOk } : {})} />
            ))}
          </div>
          <div className="fgroove" style={{ position: 'relative', margin: '10px 0 0' }} />
          <div className="s14 dim nowrap" style={{ marginTop: 8, height: 18 }} data-testid="check-why">
            {at !== null ? at.why : <><Key>1</Key>{last > 1 && <> to <Key>{String(last)}</Key></>}<span style={{ marginLeft: 6 }}>answers</span></>}
          </div>
        </>
      ) : (
        <>
          <div className={`s16 nowrap ${view.resolved.verdict === 'passed' ? 'meadow' : view.resolved.verdict === 'failed' ? 'rust' : 'straw'}`} data-verdict={view.resolved.verdict} data-testid="check-result">
            {SEAL[view.resolved.verdict].word}{view.resolved.attempting !== null ? ` · ${view.resolved.attempting}` : ''}
            {view.resolved.verdict !== 'untested' && <img src={`/art/ui/mark_${view.resolved.verdict === 'passed' ? 'ok' : 'no'}.png`} alt="" draggable={false} style={{ marginLeft: 7, verticalAlign: -1 }} />}
          </div>
          <p className="s16 lt bone" style={{ whiteSpace: 'normal', lineHeight: '23px', marginTop: 8 }} data-testid="check-text">{view.resolved.narration}</p>
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <span style={{ marginRight: 12 }}><Key>Enter</Key></span>
            <FBtn variant="primary" onPress={() => dispatch({ type: 'check/dismiss' })} testId="check-dismiss" autoFocus>Continue</FBtn>
          </div>
        </>
      )}
    </Modal>
  )
}
