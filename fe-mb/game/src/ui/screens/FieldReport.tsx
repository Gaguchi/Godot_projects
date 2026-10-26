/**
 * ui/screens/FieldReport.tsx — the page written after a battle (BRIEF §2.13). The screen is a TABLE: the field as
 * it stood on the left (the read-only board, `geometry.ts#PLATE` — the last hit and the death play on it, which is
 * what CONTRACT §2 always promised and what the old centred sheet covered completely, GATE3-12), and the page
 * written about it on the right — the verdict, the count (rounds · defeated · gold), the survivors and their
 * wounds, the fallen in oxblood, the loot by rarity, and a foot saying where and when it was entered and what the
 * fight cost out of the bag.
 *
 * The title is "Field Report" for EITHER outcome; the verdict line under the rule is what differs. "Final Entry"
 * belongs to the run's last page (`screens/Ledger.tsx`) and to nothing else — one name per thing (ARCHITECTURE
 * §5.1) — and a lost battle now shows this report BEFORE that page (CONTRACT-CHANGES 0082).
 *
 * A guaranteed drop that did not fit the bag waits with BOTH verbs — Take it (disabled-with-reason while the
 * satchel is full) and leave it — plus a way into the company sheet, so the player can put a spare blade in a hand
 * and take the legendary after all. Continue is refused while any drop is still waiting (the button carries the
 * reason). The pause menu is reachable from here too (Esc or the chip): a battle that just ended is still a place a
 * player may want to save and quit.
 */
import React, { useCallback } from 'react'
import { SCREEN_NAME } from '../../engine/narration'
import { itemDef, placeInBag } from '../../engine/run/bag'
import type { GameState } from '../../engine/types'
import { PLATE } from '../combat/geometry'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { InkRule, LedgerPage } from '../components/LedgerPage'
import { className, placeName } from '../names'
import { dispatch, useEnv, useGame, useLegal } from '../store'

interface View {
  readonly outcome: 'victory' | 'defeat'
  readonly rounds: number
  readonly defeated: number
  readonly gold: number
  readonly survivors: readonly { readonly id: string; readonly name: string; readonly hp: number; readonly max: number }[]
  readonly fallen: readonly { readonly id: string; readonly name: string; readonly classId: string }[]
  readonly loot: readonly { readonly itemId: string; readonly name: string; readonly rarity: string; readonly waiting: boolean; readonly fits: boolean }[]
  readonly prisoners: readonly { readonly id: string; readonly name: string }[]
  /** The foot of the page: where the company is, what day it is, and what the fight cost out of the satchel. */
  readonly place: string | null
  readonly day: number
  readonly spent: readonly { readonly name: string; readonly count: number }[]
}

const RARITY_COLOR: Readonly<Record<string, string>> = { common: 'var(--color-parchment-dim)', uncommon: 'var(--id-moss)', rare: 'var(--id-steel)', epic: 'var(--id-arcane)', legendary: 'var(--id-gold)' }

export function FieldReport(): React.JSX.Element | null {
  const env = useEnv()
  const select = useCallback((s: GameState): View | null => {
    const run = s.run
    const r = run?.lastBattle ?? null
    if (r === null) return null
    return {
      outcome: r.outcome,
      rounds: r.rounds,
      defeated: r.enemiesDefeated,
      gold: r.goldEarned,
      // `run/battle.ts` writes the report through `displayName`, so the names here are already the ones the player
      // chose — the screen reads them straight rather than keeping a second copy of that rule.
      survivors: r.survivors.map((u) => ({ id: u.unitId, name: u.name, hp: u.hp.current, max: u.hp.max })),
      fallen: r.fallen.map((f) => ({ id: f.unitId, name: f.name, classId: f.classId })),
      loot: r.loot.map((l) => ({
        itemId: l.itemId,
        name: env.content.items[l.itemId]?.name ?? l.itemId,
        rarity: l.rarity,
        // The verbs follow the LIVE queue, not the frozen report: once it is taken or forfeited it stops offering.
        waiting: !l.placed && (run?.pendingLoot.includes(l.itemId) ?? false),
        // The bag as it stands right now — the player may have freed a cell from the company sheet since the battle.
        fits: run !== null && placeInBag(run.bag, [l.itemId], env) !== null,
      })),
      prisoners: r.prisoners.map((p) => ({ id: p.unitId, name: p.name })),
      place: run === null ? null : placeName(run.nodeId, env),
      day: run?.daysElapsed ?? 0,
      spent: [...r.consumedItems.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map<string, number>())]
        .map(([itemId, count]) => ({ name: itemDef(itemId, env).name, count })),
    }
  }, [env])
  const view = useGame(select, (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const dismiss = useLegal({ type: 'battleEnd/dismiss' })
  if (view === null) return null
  const victory = view.outcome === 'victory'
  // A drop still waiting is the only reason to open the company sheet from here: it is where a cell gets freed.
  const waiting = view.loot.some((l) => l.waiting)
  return (
    <div className="report" data-testid="field-report">
      <div className="report__scrim" />
      {/* The field's own caption. It sits over the plate the board is scaled into, so the read-only board reads as
          a thing the page is ABOUT rather than as leftover scenery behind it. */}
      <div className="report__plate-cap voice-display" style={{ left: PLATE.x, top: PLATE.y - 26, width: PLATE.w }} data-testid="report-plate-cap">
        the field as it stood
      </div>
      <LedgerPage className="report-page" width={604} minHeight={424} testId="field-report-page">
        <div className="report__sheet">
        <div className="report__eyebrow voice-display">the company ledger</div>
        <h2 className="report__title voice-display">{SCREEN_NAME.battleEnd}</h2>
        <InkRule brackets />
        <p className={`report__verdict${victory ? '' : ' report__verdict--lost'}`} data-testid="report-verdict">{victory ? 'The field was held.' : 'The field was lost.'}</p>
        <div className="report__count numeral">
          <span><b>{view.rounds}</b> {view.rounds === 1 ? 'round' : 'rounds'}</span>
          <span><b>{view.defeated}</b> {view.defeated === 1 ? 'foe' : 'foes'} down</span>
          <span><b>+{view.gold}</b> gold</span>
        </div>
        <div className="report__columns">
          <div>
            <div className="report__label voice-display">Standing</div>
            {view.survivors.length === 0 && <div className="report__row report__row--muted">No one</div>}
            {view.survivors.map((u) => {
              const ratio = u.max <= 0 ? 0 : u.hp / u.max
              return (
                <div key={u.id} className="report__row">
                  <span className="report__name">{u.name}</span>
                  <span className="report__bar"><i style={{ width: `${Math.round(ratio * 100)}%`, background: ratio <= 0.25 ? 'var(--hp-crit)' : ratio <= 0.5 ? 'var(--hp-warn)' : 'var(--hp-ok)' }} /></span>
                  <span className="numeral report__hp">{u.hp}/{u.max}</span>
                </div>
              )
            })}
            {view.fallen.length > 0 && (
              <>
                <div className="report__label report__label--fallen voice-display">Fallen</div>
                {view.fallen.map((f) => <div key={f.id} className="report__row report__row--fallen"><span className="report__name">{f.name}</span><span className="report__class">{className(f.classId, env)}</span></div>)}
              </>
            )}
          </div>
          <div>
            <div className="report__label voice-display">Taken from the field</div>
            {view.loot.length === 0 && view.prisoners.length === 0 && <div className="report__row report__row--muted">Nothing worth carrying</div>}
            {view.loot.map((l, i) => (
              // Keyed by index as well as id: two rows can carry the same item (a trophy plus a drop), and a
              // duplicate React key is a console error, which the boot gate treats as a failure.
              <div key={`${l.itemId}#${i}`} className={`report__row report__row--loot${l.waiting ? ' report__row--claim' : ''}`}>
                <span className="report__name" style={{ color: RARITY_COLOR[l.rarity] ?? undefined }}><Icon name="bullet" size={11} filled /> {l.name}</span>
                {l.waiting && (
                  <span className="report__claim">
                    <Button
                      variant="secondary"
                      disabledReason={l.fits ? null : 'no room in the bag — discard something first'}
                      onPress={() => dispatch({ type: 'run/takeLoot', itemId: l.itemId })}
                      testId={`take-${l.itemId}`}
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.68rem' }}
                    >
                      Take it
                    </Button>
                    <Button variant="ghost" onPress={() => dispatch({ type: 'run/forfeitLoot', itemId: l.itemId })} testId={`forfeit-${l.itemId}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.68rem' }}>leave it</Button>
                  </span>
                )}
              </div>
            ))}
            {view.prisoners.map((p) => <div key={p.id} className="report__row"><span className="report__name"><Icon name="shackles" size={14} /> {p.name}</span><span className="report__class">prisoner</span></div>)}
          </div>
        </div>
        <div className="report__foot" data-testid="report-foot">
          <span>{view.place === null ? <>The <b className="numeral">{view.day}{ordinal(view.day)}</b> day</> : <>{view.place} · the <b className="numeral">{view.day}{ordinal(view.day)}</b> day</>}</span>
          <span className="report__spent">{view.spent.length === 0 ? 'Nothing spent from the satchel' : `Spent: ${view.spent.map((x) => (x.count === 1 ? x.name : `${x.name} ×${x.count}`)).join(', ')}`}</span>
        </div>
        <div className="report__verbs">
          <Button variant="ghost" onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'pause' } })} testId="report-menu" style={{ fontSize: '0.72rem', padding: '0.4rem 0.9rem' }}><span className="keycap">Esc</span> Menu</Button>
          {waiting && <Button variant="secondary" onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'loadout', unitId: null } })} testId="report-company">The company</Button>}
          <Button variant="primary" disabledReason={dismiss.ok ? null : dismiss.reason} onPress={() => dispatch({ type: 'battleEnd/dismiss' })} testId="report-continue" autoFocus>{victory ? 'Close the ledger' : 'Turn the page'}</Button>
        </div>
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
