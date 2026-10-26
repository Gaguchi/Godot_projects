/**
 * ui/screens/Camp.tsx — one night, one thing (BRIEF §2.10): Rest (a ration, a fifth of everyone's wounds) or
 * Scout (a ration, every road within three hops pre-rolled — what the scouts saw is what the hop will find).
 * After the one action the card reports what happened and the only verb left is to break camp.
 *
 * The two choice cards carry their refusal as a LINE ON THE CARD (`.camp__choice-why`), which is why they are the
 * one place in the game with no reason tip: the sentence is already on the glass, permanently, next to the verb.
 *
 * THE SCREEN HAS A SUBJECT. GATE2-22 named two frames with nothing in them; the prologue vista was re-composed
 * (0081) and the camp was not, so this stayed a card floating in a near-featureless dusk with a faint horizon
 * behind it and no fire, tent or figure anywhere (RE-GATE B 2.7 — crafting-game-ui signal E). The foreground is
 * now the camp itself: a fire drawn in the game's own hand, the COMPANY sitting around it (their board bakes, the
 * same figures the map walks), and the tent they will sleep in — all seated below the card, out of its way, and
 * all of it the party the player actually has, so the night is theirs and not a stock illustration.
 */
import React, { useCallback } from 'react'
import '../../styles/places.css'
import { spriteIdFor } from '../../content/index'
import { foodCount } from '../../engine/run/bag'
import { nodeOf } from '../../engine/run/overworld'
import { livingUnits } from '../../engine/run/party'
import { scoutableEdges, scoutedRoads } from '../../engine/run/scout'
import type { GameState } from '../../engine/types'
import { Button } from '../components/Button'
import { dispatch, useEnv, useGame, useLegal } from '../store'

interface View {
  readonly name: string
  readonly regionId: string
  readonly food: number
  readonly actionTaken: boolean
  readonly restCost: number
  readonly scoutCost: number
  readonly healPct: number
  readonly wounded: number
  readonly roads: number
  readonly scouted: readonly { readonly to: string; readonly report: string; readonly quiet: boolean }[]
  /** The company, for the foreground: whoever is still standing gets a seat at the fire. */
  readonly figures: readonly { readonly id: string; readonly sprite: string | null }[]
}

/**
 * The fire, drawn in the game's own hand.
 *
 * FINAL GATE B B.6: it was the one object in the build that was not. Three nested flat teardrops in fully
 * saturated red/orange/yellow, sitting on five plain grey ellipses, in a frame whose every other figure is
 * dithered pixel art under a painted dusk — the most saturated thing in the game, and the subject the eye lands
 * on first. Now it is pixels: a 26x32 map at 4 stage-px a cell (the company's bakes read at ~2.7, so this is the
 * same hand one size up), eight inks all mixed down into the dusk's own ash, and a DITHERED outer rim rather than
 * a drawn outline. Still nothing emits (BRIEF §5) and still nothing flickers, so the frame is identical under
 * reduced motion — the light it throws is the `.camp__pool` wash on the ground, as before.
 *
 * The map is the art: ` ` nothing · `k` ember shadow · `e` ember · `h` hearth · `s` the core · `w`/`W` log and
 * its lit edge · `r`/`R` stone and its lit edge.
 */
const FIRE_PX: readonly string[] = [
  '                          ',
  '           k              ',
  '          kek             ',
  '          keek            ',
  '         keeek            ',
  '         keeeek           ',
  '         keeeek           ',
  '        keehhek           ',
  '        keehheek          ',
  '        eehhhhek          ',
  '        kehhhhee  ke      ',
  '        eehhhheeekek      ',
  '       eeehhhhheeeee      ',
  '       keehhhhheeeek      ',
  '       eehhhhhheeehe      ',
  '       kehhhhhhheehk      ',
  '       eehhhshhheehek     ',
  '       kehhhsshhehhee     ',
  '       eehhhsshhehhek     ',
  '      eeehhssshhhhhee     ',
  '      keehhsssshhhhek     ',
  '      eeehhsssshhhhee     ',
  '      keehhsssshhhhek     ',
  '      eeehhsssshhhhee     ',
  '   wWWWWWWWWwwwwwwwwwww   ',
  '  kkwwwwwwwwwwWWWWWWWWkk  ',
  ' RRRwwwWWWwwwwwwwWWWwwRRR ',
  'rrrrr                rrrrr',
  ' rrr                  rrr ',
  '     RRRR   RRR   RRRR    ',
  '    rrrrrr rrrrr rrrrrr   ',
  '     rrrr   rrr   rrrr    ',
]

/** Ink order = paint order; the class carries the colour so no ink is named in TypeScript (ARCHITECTURE §5). */
const FIRE_INKS: readonly (readonly [string, string])[] = [
  ['r', 'px-r'], ['R', 'px-rl'], ['w', 'px-w'], ['W', 'px-wl'],
  ['k', 'px-k'], ['e', 'px-e'], ['h', 'px-h'], ['s', 'px-s'],
]

/** One `d` per ink: every run of equal cells in a row becomes one unit-square-tall rect. Pure, computed once. */
function pixelPaths(map: readonly string[]): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}
  map.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]!
      if (ch === ' ') { x++; continue }
      let n = 1
      while (x + n < row.length && row[x + n] === ch) n++
      out[ch] = `${out[ch] ?? ''}M${x} ${y}h${n}v1h-${n}z`
      x += n
    }
  })
  return out
}

const FIRE_PATHS = pixelPaths(FIRE_PX)
const FIRE_CELL = 4

function Fire(): React.JSX.Element {
  const w = (FIRE_PX[0]?.length ?? 0) * FIRE_CELL
  const h = FIRE_PX.length * FIRE_CELL
  return (
    <svg className="camp__flame" viewBox={`0 0 ${FIRE_PX[0]?.length ?? 0} ${FIRE_PX.length}`} width={w} height={h} aria-hidden>
      {FIRE_INKS.map(([ch, cls]) => {
        const d = FIRE_PATHS[ch]
        return d === undefined ? null : <path key={ch} className={cls} d={d} />
      })}
    </svg>
  )
}

/** Where they sleep. A silhouette with one warm edge — the side the fire is on. */
function Tent(): React.JSX.Element {
  return (
    <svg className="camp__tent" viewBox="0 0 220 150" width={220} height={150} aria-hidden>
      <path d="M110 12 L206 132 L14 132 Z" fill="var(--iron-900)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M110 12 L206 132 L166 132 Z" fill="var(--iron-700)" opacity="0.55" />
      <path d="M110 12 L110 132" stroke="var(--color-ink)" strokeWidth="2" />
      <path d="M110 40 L86 132 L134 132 Z" fill="var(--color-ash)" opacity="0.9" />
      <path d="M110 8 L110 -2 M110 6 L152 22 M110 6 L68 22" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M206 132 L206 122" stroke="var(--color-hearth-soft)" strokeWidth="2.5" opacity="0.4" />
      <ellipse cx="110" cy="134" rx="104" ry="8" fill="var(--color-ash)" opacity="0.55" />
    </svg>
  )
}

/**
 * The foreground: two of the company at the fire, the rest by the tent — seated in the GUTTERS either side of the
 * card, never in its column.
 *
 * The card is a fixed 702px column (x 289-991) whose HEIGHT is what the night's choices change: open the scout
 * report and it grows from ~300px to 542px, and the seats that cleared it at rest were cut off at the knees by it
 * — 5 183px² of one figure and 6 035px² of another, with a pair of red-cloaked legs sticking out under the bottom
 * rule (FINAL GATE B B.2). The card cannot be made shorter (the player paid a ration for that page) and it cannot
 * be moved up (542 + the scene's 190 does not fit in 720), so the only separation left is horizontal — and it is
 * the stable one: the same picture at every card height, with nothing that jumps when the night is spent.
 */
function CampScene({ figures }: { readonly figures: View['figures'] }): React.JSX.Element {
  // Two flanking the fire, two by the tent, on a ground line that steps forward and back so they read as standing
  // in a place rather than along a rule. Every x span here clears the card's column (289-991) — a figure is 71px.
  const seats = [
    { left: 20, bottom: 66, flip: false },
    { left: 200, bottom: 42, flip: true },
    { left: 1004, bottom: 68, flip: true },
    { left: 1152, bottom: 44, flip: false },
  ]
  return (
    <div className="camp__scene" aria-hidden>
      <div className="camp__hearth"><span className="camp__pool" /><Fire /></div>
      <div className="camp__shelter"><Tent /></div>
      {figures.slice(0, seats.length).map((f, i) => {
        const seat = seats[i]!
        return (
          <span key={f.id} className={`camp__figure${seat.flip ? ' camp__figure--flip' : ''}`} style={{ left: seat.left, bottom: seat.bottom }}>
            {f.sprite !== null && <img className="pixel" src={`/sprites/units/board/${f.sprite}.png`} alt="" draggable={false} />}
          </span>
        )
      })}
    </div>
  )
}

export function CampScreen(): React.JSX.Element | null {
  const env = useEnv()
  const view = useGame(useCallback((s: GameState): View | null => {
    const run = s.run
    if (run === null || run.camp === null) return null
    const node = nodeOf(run.nodeId, env)
    const depth = env.rules.camp.scoutDepth
    const edges = scoutableEdges(run, depth, env)
    // The words are the ENGINE's (`run/scout.ts#sightingOf`), so the report, the marks on the map's roads and the
    // headless roads line cannot drift into three vocabularies for one road (0109).
    const scouted = scoutedRoads(run, env).map((r) => ({
      to: `${nodeOf(r.from, env).name} → ${nodeOf(r.to, env).name}`,
      report: r.sighting.report,
      quiet: r.sighting.quiet,
    }))
    return {
      name: node.name,
      regionId: node.regionId,
      food: foodCount(run.bag, env),
      actionTaken: run.camp.actionTaken,
      restCost: env.rules.camp.restFoodCost,
      scoutCost: env.rules.camp.scoutFoodCost,
      healPct: Math.round(env.rules.camp.restHealFraction * 100),
      wounded: livingUnits(run).filter((u) => u.hp.current < u.hp.max).length,
      roads: edges.length,
      scouted,
      figures: livingUnits(run).map((u) => ({ id: u.id, sprite: spriteIdFor(u.id, u.classId) })),
    }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const rest = useLegal({ type: 'camp/rest' })
  const scout = useLegal({ type: 'camp/scout' })
  const leave = useLegal({ type: 'camp/leave' })
  if (view === null) return null
  return (
    <div className="place" data-testid="camp-screen">
      <img className="place__vista place__vista--night" src={`/art/backdrops/${view.regionId}.png`} alt="" draggable={false} />
      <div className="place__dusk place__dusk--night" />
      <div className="camp__fire" aria-hidden />
      <CampScene figures={view.figures} />
      <div className="camp__card hud-panel">
        <div className="place__eyebrow voice-display">Camp · {view.name}</div>
        <h1 className="place__title voice-display" style={{ color: 'var(--color-parchment)' }}>{view.actionTaken ? 'The fire burns low' : 'One night'}</h1>
        <p className="place__lead" style={{ color: 'var(--color-parchment-dim)' }}>
          {view.actionTaken ? 'The company has done its one thing for tonight. At first light, the road.' : `A ration feeds the fire either way. ${view.food} ${view.food === 1 ? 'ration' : 'rations'} in the satchel.`}
        </p>
        {view.scouted.length > 0 && (
          <div className="camp__report" data-testid="scout-report">
            {/* the count is part of the report: the player paid a ration for it and has to know they are seeing all of it */}
            <div className="place__label voice-display" style={{ color: 'var(--color-text-muted)' }}>What the scouts saw · {view.scouted.length} {view.scouted.length === 1 ? 'road' : 'roads'}</div>
            <ul className="camp__report-list scroll-rail">
              {view.scouted.map((r) => (
                <li key={r.to} className="camp__report-row">
                  <span className="camp__report-road">{r.to}</span>
                  <span className={`camp__sight${r.quiet ? ' camp__sight--quiet' : ''}`}>{r.report}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!view.actionTaken && <div className="camp__choices">
          <button type="button" className="camp__choice" disabled={!rest.ok} onClick={() => dispatch({ type: 'camp/rest' })} data-testid="camp-rest">
            <span className="camp__choice-title voice-display">Rest</span>
            <span className="camp__choice-cost numeral">−{view.restCost} ration</span>
            {/* with nobody wounded the card carries its REASON instead of a blurb — one line under the title, never both saying the same thing */}
            {view.wounded > 0 && <span className="camp__choice-blurb">{view.wounded} wounded heal {view.healPct}% of their strength.</span>}
            {!rest.ok && <span className="camp__choice-why">{rest.reason}</span>}
          </button>
          <button type="button" className="camp__choice" disabled={!scout.ok} onClick={() => dispatch({ type: 'camp/scout' })} data-testid="camp-scout">
            <span className="camp__choice-title voice-display">Scout</span>
            <span className="camp__choice-cost numeral">−{view.scoutCost} ration</span>
            <span className="camp__choice-blurb">{view.roads} {view.roads === 1 ? 'road' : 'roads'} within {env.rules.camp.scoutDepth} hops — see what waits before you walk it.</span>
            {!scout.ok && <span className="camp__choice-why">{scout.reason}</span>}
          </button>
        </div>}
        <div className="place__verbs">
          {/* the ONE way off this screen: it wears real chrome at rest, and takes the brass once the night is spent */}
          <Button variant={view.actionTaken ? 'primary' : 'secondary'} disabledReason={leave.ok ? null : leave.reason} onPress={() => dispatch({ type: 'camp/leave' })} testId="camp-leave">Break camp</Button>
        </div>
      </div>
    </div>
  )
}
