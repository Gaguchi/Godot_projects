/**
 * ui/screens/Ledger.tsx — the last page of a run (BRIEF §2.15). ONE ledger kit, TWO ceremonies: a run does not end
 * the same way twice, and until now Win and Game Over were the same sheet with one word swapped (GATE2-15).
 *
 * The Iron Throne (won) is a WARM page on a lit table. It leads with the thing the run was for — the trophy the
 * throne gave up, on a struck-brass plate, the largest object on the sheet (DECISIONS: "the final boss drops a
 * trophy legendary named on the win screen") — then the count, then the company standing in daylight with their
 * faces on the page. It enters rising, with the plate landing last on the reward easing.
 *
 * Final Entry (lost) is a COLD page on stone, inside a mourning rule — the black border a 19th-century death
 * notice carried. It leads with the ROLL OF THE FALLEN, faces first, each with what took them and the day; the
 * count is demoted to a muted foot, because a lost run's numbers are not the point. It does not rise and nothing
 * overshoots: it settles.
 *
 * Two verbs on both: the same road again (`meta/newRun` with the run's seed — the roguelite reading) or back to
 * the title.
 */
import React, { useCallback } from 'react'
import { SCREEN_NAME } from '../../engine/narration'
import { spriteIdFor } from '../../content/index'
import type { GameState, Item } from '../../engine/types'
import { ITEM_ICON, RARITY_TINT } from '../components/BagGrid'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { InkRule, LedgerPage } from '../components/LedgerPage'
import { className, companyName, initialsOf, mcName } from '../names'
import { dispatch, useEnv, useGame } from '../store'

interface Roster {
  readonly id: string
  readonly name: string
  readonly classId: string
}

interface Fallen extends Roster {
  readonly cause: string
  readonly day: number
}

interface View {
  readonly won: boolean
  readonly seed: number
  readonly mc: string
  readonly company: string
  readonly days: number
  readonly stats: readonly { readonly label: string; readonly value: number }[]
  readonly survivors: readonly Roster[]
  readonly fallen: readonly Fallen[]
  readonly trophy: { readonly name: string; readonly kind: Item['kind']; readonly rarity: Item['rarity'] } | null
}

/** What took them, in the ledger's own words — never the stored key. */
const CAUSE: Readonly<Record<string, string>> = { battle: 'fell in battle', starvation: 'starved on the road', event: 'lost on the road' }

export function LedgerScreen(): React.JSX.Element | null {
  const env = useEnv()
  const view = useGame(useCallback((s: GameState): View | null => {
    const l = s.ledger
    if (l === null) return null
    return {
      won: l.outcome === 'won',
      seed: l.runSeed,
      // Both go through the display-name layer, so the sentence and the roll beneath it call one person one name.
      mc: mcName(l.mcName, env),
      company: companyName(l.companyName),
      days: l.daysElapsed,
      stats: [
        { label: 'battles won', value: l.stats.battlesWon },
        { label: 'foes down', value: l.stats.enemiesDefeated },
        { label: 'captured', value: l.stats.enemiesCaptured },
        { label: 'gold earned', value: l.stats.goldEarned },
        { label: 'gear found', value: l.stats.gearFound },
        { label: 'hops walked', value: l.stats.hops },
      ],
      // `runLedger` / `removeFallen` already resolved the MC's chosen name (`run/party.ts#displayName`); the page
      // does not special-case an id a second time.
      survivors: l.survivors.map((u) => ({ id: u.unitId, name: u.name, classId: u.classId })),
      fallen: l.fallen.map((f, i) => ({ id: `${f.unitId}#${i}`, name: f.name, classId: f.classId, cause: CAUSE[f.cause] ?? f.cause, day: f.day })),
      trophy: (() => {
        if (l.trophyItemId === null) return null
        const item = env.content.items[l.trophyItemId]
        return item === undefined ? null : { name: item.name, kind: item.kind, rarity: item.rarity }
      })(),
    }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  if (view === null) return null
  return view.won ? <ThronePage view={view} /> : <FinalEntryPage view={view} />
}

/* ── the won ending: warm, brass, the trophy first ─────────────────────────────────────────────────────────── */

function ThronePage({ view }: { readonly view: View }): React.JSX.Element {
  return (
    <div className="ledger-screen ledger-screen--won" data-testid="win-screen">
      <div className="iron-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div className="ledger-screen__glow" aria-hidden />
      <LedgerPage className="ledger-page--won" width={800} height={624} testId="ledger-page">
        <div className="ledger__sheet">
          <div className="report__eyebrow voice-display">the company ledger · last page</div>
          <h2 className="report__title voice-display ledger__title">The Iron Throne</h2>
          <InkRule brackets />
          <p className="ledger__line">
            Under {view.mc}, {view.company} took the throne on the <b className="numeral">{view.days}{ordinal(view.days)}</b> day.
          </p>
          {view.trophy !== null && (
            <div className="trophy surface-iron" data-testid="ledger-trophy" style={{ ['--rarity' as string]: RARITY_TINT[view.trophy.rarity] }}>
              <span className="trophy__mark" aria-hidden><Icon name={ITEM_ICON[view.trophy.kind]} size={28} /></span>
              <span className="trophy__stack">
                <span className="trophy__eyebrow voice-display">taken from the throne</span>
                <span className="trophy__name voice-display">{view.trophy.name}</span>
              </span>
            </div>
          )}
          <StatRow stats={view.stats} />
          <div className="ledger__roll">
            <div className="report__label voice-display">Still standing</div>
            {view.survivors.length === 0
              ? <div className="report__row report__row--muted">No one — the throne was taken at the last</div>
              : <Faces roster={view.survivors} tone="standing" />}
            {view.fallen.length > 0 && (
              <>
                <div className="report__label report__label--fallen voice-display">Bought with</div>
                <ul className="ledger__names">
                  {view.fallen.map((f) => (
                    <li key={f.id} className="ledger__name-row"><span className="report__name">{f.name}</span><span className="report__class">{f.cause} · day {f.day}</span></li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <Verbs view={view} again="Walk it again" />
        </div>
      </LedgerPage>
    </div>
  )
}

/* ── the lost ending: cold, mourning-ruled, the fallen first ───────────────────────────────────────────────── */

function FinalEntryPage({ view }: { readonly view: View }): React.JSX.Element {
  return (
    <div className="ledger-screen ledger-screen--lost" data-testid="gameover-screen">
      <div className="iron-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <LedgerPage className="ledger-page--lost" width={700} height={596} testId="ledger-page">
        <div className="ledger__sheet">
          <div className="report__eyebrow voice-display">the company ledger · final entry</div>
          <h2 className="report__title voice-display ledger__title ledger__title--lost">{SCREEN_NAME.gameOver}</h2>
          <InkRule />
          <p className="ledger__line ledger__line--lost">
            Under {view.mc}, {view.company} ended on the road on the <b className="numeral">{view.days}{ordinal(view.days)}</b> day.
          </p>
          <div className="ledger__roll">
            <div className="report__label report__label--fallen voice-display">The roll of the fallen</div>
            {view.fallen.length === 0
              ? <div className="report__row report__row--muted">No name was written here — the road simply ended</div>
              : <Faces roster={view.fallen} tone="fallen" />}
            {view.survivors.length > 0 && (
              <>
                <div className="report__label voice-display">Left standing</div>
                <ul className="ledger__names">
                  {view.survivors.map((u) => <li key={u.id} className="ledger__name-row"><span className="report__name">{u.name}</span><ClassWord classId={u.classId} /></li>)}
                </ul>
              </>
            )}
          </div>
          <div className="ledger__foot">
            <StatRow stats={view.stats} muted />
          </div>
          <Verbs view={view} again="The same road again" />
        </div>
      </LedgerPage>
    </div>
  )
}

/* ── shared furniture ──────────────────────────────────────────────────────────────────────────────────────── */

function ClassWord({ classId }: { readonly classId: string }): React.JSX.Element {
  const env = useEnv()
  return <span className="report__class">{className(classId, env)}</span>
}

/**
 * The company as FACES. A run's ending is about the people in it, and a list of six words was the only thing the
 * two endings had to show for a whole run — the portraits are already in `public/sprites/units/` and are what the
 * player has been looking at for an hour. `tone` is the whole difference between the two pages: standing faces are
 * lit and ringed in brass; fallen faces are drained of colour and struck through.
 */
function Faces({ roster, tone }: { readonly roster: readonly (Roster & { readonly cause?: string; readonly day?: number })[]; readonly tone: 'standing' | 'fallen' }): React.JSX.Element {
  const env = useEnv()
  return (
    <ul className={`roll roll--${tone}`} data-testid={`roll-${tone}`}>
      {roster.map((u, i) => {
        const sprite = spriteIdFor(u.id.split('#')[0], u.classId)
        const day = u.day ?? 0
        return (
          <li key={u.id} className="roll__entry" style={{ ['--stagger' as string]: `${i * 60}ms` }}>
            <span className="roll__face">
              {sprite !== null ? <img src={`/sprites/units/${sprite}.png`} alt="" draggable={false} /> : <span className="roll__initials voice-display">{initialsOf(u.name)}</span>}
            </span>
            <span className="roll__name">{u.name}</span>
            {/* The day is a CHANGING NUMBER and wears the numeral face with its ordinal inside the same span, exactly
                as the sentence above this roll does. Baked into the authored string it inherited `.roll__sub`'s
                Cinzel + uppercase, and "day 1" printed as a Roman "DAY I" on the roll of the fallen (GATE B B.3). */}
            <span className="roll__sub">
              {u.cause === undefined ? className(u.classId, env) : <>{u.cause} · <b className="numeral">{day}{ordinal(day)}</b> day</>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function StatRow({ stats, muted = false }: { readonly stats: View['stats']; readonly muted?: boolean }): React.JSX.Element {
  return (
    <div className={`ledger__stats${muted ? ' ledger__stats--muted' : ''}`} data-testid="ledger-stats">
      {stats.map((s) => (
        <div key={s.label} className="ledger__stat">
          <span className="numeral ledger__stat-value">{s.value}</span>
          <span className="ledger__stat-label voice-display">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

function Verbs({ view, again }: { readonly view: View; readonly again: string }): React.JSX.Element {
  return (
    <div className="report__verbs" style={{ gap: 12 }}>
      <Button variant="primary" onPress={() => dispatch({ type: 'meta/newRun', seed: view.seed })} testId="ledger-again" autoFocus>{again}</Button>
      <Button variant="ghost" onPress={() => dispatch({ type: 'meta/dismissLedger' })} testId="ledger-title">Close the ledger</Button>
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
