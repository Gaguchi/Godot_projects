/**
 * ui/screens/FieldReport.tsx — the page written after a battle (BRIEF §2.13; board F64Report). The screen is a
 * TABLE: the field as it stood on the left, at the size it was fought on (the read-only board, seated by
 * `geometry.ts#PLATE`: the last hit and the death play on it, which is what CONTRACT §2 always promised), and the
 * report about it on the right, in one window read top to bottom:
 *
 *   · the verdict, and one line on what it cost;
 *   · what it paid: the gold (the one cast number on the page), the rounds, the foes down, the purse now;
 *   · who is standing, each with face, class, condition IN WORDS and strength as a bar and in figures; the fallen
 *     under them, named, in oxblood;
 *   · what was taken from the field: loot and prisoners;
 *   · a foot saying where and when, and what the fight spent from the satchel.
 *
 * The title is "Field Report" for EITHER outcome; the verdict line is what differs. "Final Entry" belongs to the
 * run's last page (`screens/Ledger.tsx`) and to nothing else — one name per thing (ARCHITECTURE §5.1) — and a lost
 * battle shows this report BEFORE that page (CONTRACT-CHANGES 0082).
 *
 * A guaranteed drop that did not fit the satchel waits with BOTH verbs — Take it (refused with its reason while the
 * satchel is full) and Leave it — plus a way into The Company, where a hand can be filled and a square freed.
 * Closing is refused while any drop is still waiting (the button says why). The menu is reachable from here too
 * (Esc or its row): a battle that just ended is still a place a player may want to save and quit.
 */
import React, { useCallback } from 'react'
import { spriteIdFor } from '../../content/index'
import { SCREEN_NAME } from '../../engine/narration'
import { itemDef, placeInBag } from '../../engine/run/bag'
import type { GameState } from '../../engine/types'
import { PLATE } from '../combat/geometry'
import { KIcon, iconOf } from '../filigree/items'
import { FBtn, FIcon, Gauge, Key, Niche, Numeral, SectionHead, Win, faceArt } from '../filigree/kit'
import { className, placeName } from '../names'
import { dispatch, useEnv, useGame, useLegal } from '../store'
import { listNames, word } from '../town/shared'

interface Person { readonly id: string; readonly name: string; readonly role: string; readonly sprite: string | null; readonly hp: number; readonly max: number; readonly fell: boolean }
interface View {
  readonly outcome: 'victory' | 'defeat'
  readonly rounds: number
  readonly defeated: number
  readonly gold: number
  readonly purse: number
  readonly people: readonly Person[]
  readonly loot: readonly { readonly itemId: string; readonly name: string; readonly icon: string; readonly rarity: string; readonly waiting: boolean; readonly fits: boolean }[]
  readonly prisoners: readonly { readonly id: string; readonly name: string }[]
  /** The foot of the page: where the company is, what day it is, and what the fight cost out of the satchel. */
  readonly place: string | null
  readonly day: number
  readonly spent: readonly { readonly name: string; readonly count: number }[]
}

const W = 550
const X = 1280 - 14 - W
/** The lowest the foot may sit: the window never outgrows the stage (14 px margins, 90 px of foot). */
const FOOT_MAX = 602
const PAD = 20
const IW = W - 2 * PAD

export function FieldReport(): React.JSX.Element | null {
  const env = useEnv()
  const select = useCallback((s: GameState): View | null => {
    const run = s.run
    const r = run?.lastBattle ?? null
    if (r === null) return null
    const roleOf = (unitId: string, classId: string | null): { readonly role: string; readonly sprite: string | null } => {
      const cid = classId ?? run?.party[unitId]?.classId ?? null
      return { role: cid === null ? '' : className(cid, env), sprite: cid === null ? null : spriteIdFor(unitId, cid) }
    }
    return {
      outcome: r.outcome,
      rounds: r.rounds,
      defeated: r.enemiesDefeated,
      gold: r.goldEarned,
      purse: run?.gold ?? 0,
      // `run/battle.ts` writes the report through `displayName`, so the names here are already the ones the player
      // chose — the screen reads them straight rather than keeping a second copy of that rule.
      people: [
        ...r.survivors.map((u): Person => ({ id: u.unitId, name: u.name, ...roleOf(u.unitId, null), hp: u.hp.current, max: u.hp.max, fell: false })),
        ...r.fallen.map((f): Person => ({ id: f.unitId, name: f.name, ...roleOf(f.unitId, f.classId), hp: 0, max: 0, fell: true })),
      ],
      loot: r.loot.map((l) => {
        const item = env.content.items[l.itemId]
        return {
          itemId: l.itemId,
          name: item?.name ?? l.itemId,
          icon: item === undefined ? 'treasure' : iconOf(item),
          rarity: l.rarity,
          // The verbs follow the LIVE queue, not the frozen report: once it is taken or forfeited it stops offering.
          waiting: !l.placed && (run?.pendingLoot.includes(l.itemId) ?? false),
          // The satchel as it stands right now — the player may have freed a square in The Company since the battle.
          fits: run !== null && placeInBag(run.bag, [l.itemId], env) !== null,
        }
      }),
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
  // A drop still waiting is the only reason to open The Company from here: it is where a square gets freed.
  const waiting = view.loot.some((l) => l.waiting)
  const fallen = view.people.filter((p) => p.fell)
  const standing = view.people.filter((p) => !p.fell)
  const worst = [...standing].sort((a, b) => a.hp / Math.max(1, a.max) - b.hp / Math.max(1, b.max))[0]
  const cost = fallen.length > 0 ? `${listNames(fallen.map((p) => p.name))} fell on it.`
    : view.prisoners.length > 0 ? `${listNames(view.prisoners.map((p) => p.name))} ${view.prisoners.length === 1 ? 'was' : 'were'} taken alive.`
      : worst !== undefined && worst.hp * 2 < worst.max ? `${worst.name} came off it badly hurt.`
        : standing.length > 0 ? 'Nobody is the worse for it.' : 'No one is left standing.'

  // ---- laid out top to bottom. The window is as tall as what it holds: a quiet win is a short page, not a page
  // with a hole above its foot. A crowded one stops at the stage and closes the people's rows up instead.
  const takenRows = Math.max(1, view.loot.length + view.prisoners.length)
  const peopleTop = 254
  const takenH = 34 + takenRows * 32 + 6
  const count = Math.max(1, view.people.length)
  const natural = peopleTop + count * 56 + 6 + takenH + 8
  const footTop = Math.min(FOOT_MAX, natural)
  const rowH = natural <= FOOT_MAX ? 56 : Math.max(32, Math.floor((FOOT_MAX - peopleTop - takenH - 14) / count))
  const tight = rowH < 52
  const face = tight ? 28 : 44
  const tx = PAD + face + 16
  const takenTop = peopleTop + Math.max(1, view.people.length) * rowH + 6
  return (
    <div className="f64 freport" data-testid="field-report">
      {/* The field's own caption: the read-only board is the thing this page is ABOUT, not leftover scenery. */}
      <div className="freport__cap" style={{ left: PLATE.x, top: PLATE.y + PLATE.h + 14 }} data-testid="report-plate-cap"><span className="plate">The field as it stood</span></div>
      <Win x={X} y={14} w={W} h={footTop + 90} testId="field-report-page">
        <div className="tt" style={{ left: PAD, top: 12 }} data-testid="report-title">{SCREEN_NAME.battleEnd}</div>
        <div className="s13 dim nowrap" style={{ right: PAD, top: 26 }}>the company ledger</div>
        <div className={`s18 nowrap ${victory ? 'bone' : 'rust'}`} style={{ left: PAD, top: 66 }} data-testid="report-verdict">{victory ? 'The field was held.' : 'The field was lost.'}</div>
        <div className="s14 it dim nowrap fcard__clip" style={{ left: PAD, top: 92, width: IW }} data-testid="report-cost">{cost}</div>
        <div className="nowrap" style={{ left: PAD, top: 134 }} data-testid="report-gold">
          <FIcon name="coin" style={{ margin: '-9px 6px 0 0' }} /><Numeral text={`+${view.gold}`} label={`${view.gold} gold earned`} /><span className="s15 bone" style={{ marginLeft: 10 }}>gold</span>
        </div>
        <div className="s15 bone nowrap" style={{ right: PAD, top: 136 }} data-testid="report-count">{view.rounds} {view.rounds === 1 ? 'round' : 'rounds'} · {view.defeated} {view.defeated === 1 ? 'foe' : 'foes'} down</div>
        <div className="s13 dim nowrap" style={{ right: PAD, top: 158 }}>the purse now holds {view.purse}</div>
        <div className="frule" style={{ left: PAD, top: 192, width: IW }} />

        <SectionHead x={PAD} y={218} w={IW} heading="Standing" note={fallen.length === 0 ? (standing.length === 0 ? 'no one' : 'no one fell') : `${word(fallen.length).toLowerCase()} fell`} />
        {view.people.length === 0 && <div className="s15 it dim nowrap" style={{ left: PAD, top: peopleTop + 8 }}>No one</div>}
        {view.people.map((p, i) => {
          const y = peopleTop + i * rowH
          const low = p.hp * 2 < p.max
          const state = p.fell ? 'fell' : p.hp >= p.max ? 'unhurt' : low ? 'badly hurt' : 'wounded'
          return (
            <div key={p.id} className={`freport__row${p.fell ? ' freport__row--fallen' : ''}`} style={{ left: 0, top: y, width: W, height: rowH }} data-testid={`report-${p.fell ? 'fallen' : 'standing'}-${p.id}`}>
              <Niche x={PAD} y={tight ? 2 : 4} size={face} {...faceArt(p.sprite, face)} />
              <span className={`${tight ? 's15' : 's16'} nowrap fcard__clip ${p.fell ? 'rust' : 'bone'}`} style={{ left: tx, top: tight ? 5 : 6, maxWidth: tight ? 150 : 236 }}>{p.name}</span>
              <span className="s13 nowrap" style={tight ? { left: tx + 160, top: 7 } : { left: tx, top: 28 }}>
                <span className="dim">{p.role}{p.role !== '' ? ' · ' : ''}</span><span className={p.fell || low ? 'rust' : state === 'unhurt' ? 'meadow' : 'dim'}>{state}</span>
              </span>
              {!p.fell && <Gauge x={W - PAD - 208} y={tight ? 11 : 22} w={120} value={p.hp} max={p.max} />}
              {!p.fell && <span className={`s15 nowrap ${low ? 'rust' : 'bone'}`} style={{ right: PAD + 6, top: tight ? 5 : 15 }}>{p.hp}/{p.max}</span>}
            </div>
          )
        })}

        <SectionHead x={PAD} y={takenTop} w={IW} heading="Taken from the field" note={view.loot.length + view.prisoners.length === 0 ? '' : `${view.loot.length + view.prisoners.length} ${view.loot.length + view.prisoners.length === 1 ? 'thing' : 'things'}`} />
        {view.loot.length === 0 && view.prisoners.length === 0 && <div className="s15 it dim nowrap" style={{ left: PAD, top: takenTop + 36 }} data-testid="report-nothing">Nothing worth carrying</div>}
        {view.loot.map((l, i) => (
          // Keyed by index as well as id: two rows can carry the same item (a trophy plus a drop), and a
          // duplicate React key is a console error, which the boot gate treats as a failure.
          <div key={`${l.itemId}#${i}`} className="freport__row freport__row--loot" style={{ left: 0, top: takenTop + 32 + i * 32, width: W, height: 30 }} data-claim={l.waiting ? 'yes' : undefined}>
            <KIcon name={l.icon} style={{ position: 'absolute', left: PAD, top: 3 }} />
            <span className="s15 bone nowrap fcard__clip" style={{ left: PAD + 34, top: 5, maxWidth: l.waiting ? 200 : 330 }}>{l.name}</span>
            {!l.waiting && <span className="s13 dim nowrap" style={{ right: PAD, top: 7 }}>{l.rarity} · in the satchel</span>}
            {l.waiting && (
              <span className="nowrap" style={{ right: PAD, top: -2 }}>
                <FBtn disabledReason={l.fits ? null : 'no room in the bag: free a square in The Company first'} onPress={() => dispatch({ type: 'run/takeLoot', itemId: l.itemId })} testId={`take-${l.itemId}`}>Take it</FBtn>
                <FBtn onPress={() => dispatch({ type: 'run/forfeitLoot', itemId: l.itemId })} testId={`forfeit-${l.itemId}`} style={{ marginLeft: 8 }}>Leave it</FBtn>
              </span>
            )}
          </div>
        ))}
        {view.prisoners.map((p, i) => (
          <div key={p.id} className="freport__row" style={{ left: 0, top: takenTop + 32 + (view.loot.length + i) * 32, width: W, height: 30 }}>
            <KIcon name="capture" style={{ position: 'absolute', left: PAD, top: 3 }} />
            <span className="s15 bone nowrap fcard__clip" style={{ left: PAD + 34, top: 5, maxWidth: 330 }}>{p.name}</span>
            <span className="s13 dim nowrap" style={{ right: PAD, top: 7 }}>prisoner</span>
          </div>
        ))}

        <div className="fgroove" style={{ left: PAD, top: footTop, width: IW }} />
        <div className="s14 dim nowrap" style={{ left: PAD, top: footTop + 14 }} data-testid="report-foot">{view.place === null ? `The ${view.day}${ordinal(view.day)} day` : `${view.place} · the ${view.day}${ordinal(view.day)} day`}</div>
        <div className="s14 nowrap fcard__clip" style={{ right: PAD, top: footTop + 14, maxWidth: 300 }} data-testid="report-spent">
          {view.spent.length === 0 ? <span className="dim">Nothing spent from the satchel</span> : <><span className="dim">Spent: </span><span className="bone">{view.spent.map((x) => (x.count === 1 ? x.name : `${x.name} ×${x.count}`)).join(', ')}</span></>}
        </div>
        <button type="button" className="fcmd fcmd--small" style={{ left: PAD, top: footTop + 50, width: 96, height: 24 }} onClick={() => dispatch({ type: 'ui/openModal', modal: { kind: 'pause' } })} data-testid="report-menu">
          <span className="abs s16 bone nowrap" style={{ left: 0, top: 2 }}>Menu</span>
          <span className="abs nowrap" style={{ left: 54, top: 3 }}><Key>Esc</Key></span>
        </button>
        <div className="nowrap" style={{ right: PAD, top: footTop + 44 }}>
          {waiting && <FBtn onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'loadout', unitId: null } })} testId="report-company" style={{ marginRight: 10 }}>The Company</FBtn>}
          <FBtn variant="primary" disabledReason={dismiss.ok ? null : dismiss.reason} onPress={() => dispatch({ type: 'battleEnd/dismiss' })} testId="report-continue" autoFocus>{victory ? 'Close the ledger' : 'Turn the page'}</FBtn>
        </div>
      </Win>
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
