/**
 * ui/camp/Camp.tsx — one night, one thing (BRIEF §2.10; board PxCamp): Rest (food, and every wound mends by a share
 * of the unit's strength) or Scout (food, and every road within reach is walked ahead: what the scouts saw is what
 * the hop will find). After the one thing the window reports it and the only verb left is to break camp.
 *
 * THE SCREEN HAS A SUBJECT, and it is the camp: a clearing drawn at 1:1 (`tools/pxworld/src/px-camp/export_game.py`
 * writes it with nobody in it), and the company the run actually has standing in it, each as their own board sprite
 * on a spot the clearing keeps clear. Three windows sit round it, each with one job:
 *
 *   · where and when (top left): the place, the day, the purse and the satchel's food, because both verbs eat food;
 *   · the night's one thing (top right): Rest, Scout, Break camp. One of them wears the brass: the first the company
 *     can do, and Break camp once the night is spent. A verb the engine refuses stays on the glass with its reason
 *     printed beside it (`camp-rest-why`), so the sentence is there before the pointer is;
 *   · the company (under it): everyone's strength, and what Rest would mend laid on their gauges BEFORE it is
 *     bought (the dithered run and `+5 → 84`), so the choice between the two verbs is made on figures.
 *
 * The scout report reads the roads out of THIS camp in full and counts the rest: the sweep reaches three hops, which
 * in the big country is up to 44 roads, and every one of them is marked on the map, where the choice is made.
 */
import React, { useCallback } from 'react'
import { spriteIdFor } from '../../content/index'
import { foodCount } from '../../engine/run/bag'
import { nodeOf } from '../../engine/run/overworld'
import { displayName, livingUnits } from '../../engine/run/party'
import { scoutableEdges, scoutedRoads } from '../../engine/run/scout'
import type { GameState } from '../../engine/types'
import { FBtn, FIcon, Gauge, Niche, Pips, SectionHead, Stand, Win, faceArt } from '../filigree/kit'
import { potionLine, roleLine } from '../names'
import { dispatch, useEnv, useGame, useLegal } from '../store'
import { BOARD_FOOT, listNames, usePlaceKeys, word } from '../town/shared'
import raw from './campArt.json'

interface CampArt {
  readonly spots: readonly (readonly [number, number])[]
  readonly feet: Readonly<Record<string, readonly [number, number] | undefined>>
}
const art = raw as unknown as CampArt

interface Member {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly sprite: string | null
  readonly hp: number
  readonly max: number
  /** What Rest would mend tonight (`run/camp.ts`: floor(max × restHealFraction), never past whole). */
  readonly gain: number
}

interface Sight {
  readonly to: string
  readonly report: string
  readonly quiet: boolean
  readonly near: boolean
}

interface View {
  readonly name: string
  readonly region: string
  readonly day: number
  readonly gold: number
  readonly food: number
  readonly potion: string | null
  readonly actionTaken: boolean
  readonly restCost: number
  readonly scoutCost: number
  readonly healPct: number
  readonly roads: number
  readonly depth: number
  readonly party: readonly Member[]
  readonly scouted: readonly Sight[]
}

const EDGE = 14
const PAD = 20
const GAP = 6
const HW = 470
const CX = 846
const CW = 420
const IW = CW - 2 * PAD
/** The report lists this many roads out of the camp; any more are counted with the rest. */
const NEAR_ROWS = 6

const foodWord = (n: number): string => `${n} food`

/** One camp verb: its button, its price under it, what it buys (or why it is refused) to the right. */
function Verb({ y, label, primary, legal, cost, line, onPress, testId }: {
  readonly y: number
  readonly label: string
  readonly primary: boolean
  readonly legal: { readonly ok: true } | { readonly ok: false; readonly reason: string }
  readonly cost: number
  readonly line: string
  readonly onPress: () => void
  readonly testId: string
}): React.JSX.Element {
  return (
    <>
      <FBtn variant={primary ? 'primary' : 'secondary'} w={116} disabledReason={legal.ok ? null : legal.reason} onPress={onPress} testId={testId} style={{ position: 'absolute', left: PAD, top: y + 8 }}>{label}</FBtn>
      <div className={`s14 nowrap ${legal.ok && primary ? 'straw' : 'dim'}`} style={{ left: PAD + 2, top: y + 50 }}><FIcon name="ration" style={{ margin: '-4px 5px 0 0' }} />costs {foodWord(cost)}</div>
      {legal.ok
        ? <div className="s15 lt bone" style={{ left: PAD + 136, top: y + 8, width: IW - 136, whiteSpace: 'normal', lineHeight: '21px' }}>{line}</div>
        : <div className="why" style={{ left: PAD + 136, top: y + 11, width: IW - 136, whiteSpace: 'normal' }} data-testid={`${testId}-why`}>{legal.reason}</div>}
    </>
  )
}

export function CampScreen(): React.JSX.Element | null {
  const env = useEnv()
  const view = useGame(useCallback((s: GameState): View | null => {
    const run = s.run
    if (run === null || run.camp === null) return null
    const node = nodeOf(run.nodeId, env)
    const depth = env.rules.camp.scoutDepth
    const frac = env.rules.camp.restHealFraction
    // The words are the ENGINE's (`run/scout.ts#sightingOf`), so the report, the marks on the map's roads and the
    // headless roads line cannot drift into three vocabularies for one road (0109).
    const scouted = scoutedRoads(run, env).map((r) => {
      const near = r.from === run.nodeId || r.to === run.nodeId
      return {
        // a road out of this camp is named by where it goes; the rest are only counted
        to: near ? nodeOf(r.from === run.nodeId ? r.to : r.from, env).name : `${nodeOf(r.from, env).name} → ${nodeOf(r.to, env).name}`,
        report: r.sighting.report,
        quiet: r.sighting.quiet,
        near,
      }
    })
    return {
      name: node.name,
      region: env.content.regions[node.regionId]?.name ?? node.regionId,
      day: run.daysElapsed,
      gold: run.gold,
      food: foodCount(run.bag, env),
      potion: potionLine(run, env),
      actionTaken: run.camp.actionTaken,
      restCost: env.rules.camp.restFoodCost,
      scoutCost: env.rules.camp.scoutFoodCost,
      healPct: Math.round(frac * 100),
      roads: scoutableEdges(run, depth, env).length,
      depth,
      party: livingUnits(run).map((u) => ({
        id: u.id,
        name: displayName(u, run),
        role: roleLine(u, env),
        sprite: spriteIdFor(u.id, u.classId),
        hp: u.hp.current,
        max: u.hp.max,
        gain: Math.min(u.hp.max - u.hp.current, Math.floor(u.hp.max * frac)),
      })),
      scouted,
    }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const rest = useLegal({ type: 'camp/rest' })
  const scout = useLegal({ type: 'camp/scout' })
  const leave = useLegal({ type: 'camp/leave' })
  const spent = view?.actionTaken ?? false
  usePlaceKeys({
    Enter: spent && leave.ok ? () => dispatch({ type: 'camp/leave' }) : undefined,
  })
  if (view === null) return null

  const hurt = view.party.filter((u) => u.hp < u.max)
  // the brass is on the first thing the company can do tonight; once the night is spent, on the road
  const brass: 'rest' | 'scout' | 'leave' = spent ? 'leave' : rest.ok ? 'rest' : scout.ok ? 'scout' : 'leave'

  // ---- the night's window, laid out top to bottom: its height is what it holds
  const night: React.ReactNode[] = []
  let y = 44
  if (!spent) {
    night.push(
      <div key="lead" className="s15 lt bone nowrap" style={{ left: PAD, top: y }}>
        {view.restCost === view.scoutCost ? `Either way the fire eats ${foodWord(view.restCost)}. ` : ''}{foodWord(view.food)} in the satchel.
      </div>,
      <div key="g0" className="fgroove" style={{ left: PAD, top: y + 28, width: IW }} />,
      <Verb key="rest" y={y + 36} label="Rest" primary={brass === 'rest'} legal={rest} cost={view.restCost} onPress={() => dispatch({ type: 'camp/rest' })} testId="camp-rest"
        line={`${word(hurt.length)} wounded ${hurt.length === 1 ? 'heals' : 'heal'} ${view.healPct}% of their strength.`} />,
      <div key="g1" className="fgroove" style={{ left: PAD, top: y + 114, width: IW }} />,
      <Verb key="scout" y={y + 122} label="Scout" primary={brass === 'scout'} legal={scout} cost={view.scoutCost} onPress={() => dispatch({ type: 'camp/scout' })} testId="camp-scout"
        line={`${word(view.roads)} ${view.roads === 1 ? 'road' : 'roads'} within ${view.depth} hops: see what waits before you walk it.`} />,
      <div key="g2" className="fgroove" style={{ left: PAD, top: y + 200, width: IW }} />,
    )
    y += 214
  } else {
    night.push(
      <div key="lead" className="s15 lt bone" style={{ left: PAD, top: y, width: IW, whiteSpace: 'normal', lineHeight: '21px' }}>
        The company has done its one thing for tonight. At first light, the road.
      </div>,
    )
    y += 54
  }
  const near = view.scouted.filter((r) => r.near)
  const shown = near.slice(0, NEAR_ROWS)
  const beyond = view.scouted.filter((r) => !shown.includes(r))
  const report: React.ReactNode[] = []
  let ry = 0
  if (view.scouted.length > 0) {
    // the count is part of the report: the player paid food for it and has to know they are seeing all of it
    report.push(<SectionHead key="h" x={PAD} y={ry} w={IW} heading="What the scouts saw" note={`${view.scouted.length} ${view.scouted.length === 1 ? 'road' : 'roads'} walked`} />)
    ry += 32
    for (const r of shown) {
      report.push(
        <div key={r.to} className="fcamp__sight" style={{ left: PAD, top: ry, width: IW }} data-testid="scout-row">
          <span className="s14 bone nowrap" data-testid="scout-road">to {r.to}</span>
          <span className={`s14 lt nowrap ${r.quiet ? 'dim' : 'rust'}`}>{r.report}</span>
        </div>,
      )
      ry += 24
    }
    if (beyond.length > 0) {
      const watched = beyond.filter((r) => !r.quiet).length
      report.push(
        <div key="beyond" className="s13 dim" style={{ left: PAD, top: ry + 4, width: IW, whiteSpace: 'normal', lineHeight: '17px' }} data-testid="scout-beyond">
          Beyond them, {beyond.length} more {beyond.length === 1 ? 'road' : 'roads'} walked: {beyond.length - watched} quiet, {watched} watched. Each is marked on the map.
        </div>,
      )
      ry += 42
    }
    ry += 8
  }
  // before the night is spent the verbs come first and an older report sits under Break camp; after, the report is
  // the page and Break camp closes it. A button row is 34 tall with 16 under it.
  const reportY = spent ? y : y + 50
  const leaveY = spent ? y + ry : y
  const NH = spent ? leaveY + 50 : y + 50 + (ry > 0 ? ry + 4 : 0)

  // ---- the company's window takes what is left of the column, and its rows close up to fit a larger company
  const KY = EDGE + NH + GAP
  const room = 720 - EDGE - KY - 44 - 40
  const rowH = Math.max(40, Math.min(70, Math.floor(room / Math.max(1, view.party.length))))
  const tight = rowH < 62
  const KH = 44 + view.party.length * rowH + 40
  const face = tight ? 32 : 48
  const tx = PAD + face + 14

  const standing = view.party.slice(0, art.spots.length).map((u, i) => ({ u, at: art.spots[i]! })).filter((s) => s.u.sprite !== null).sort((a, b) => a.at[1] - b.at[1])

  return (
    <div className="f64 fplace" data-testid="camp-screen" data-spent={spent ? 'yes' : 'no'}>
      <img className="fplace__world" src="/art/camp/clearing.png" width={1280} height={720} alt="" draggable={false} />
      {/* the company in the clearing, each on a spot it keeps clear, as their own sprites at 1:1 (nearer ones painted last) */}
      <div data-testid="camp-company" aria-hidden>
        {standing.map(({ u, at }) => <Stand key={u.id} sprite={u.sprite!} x={at[0]} y={at[1]} foot={art.feet[u.sprite!] ?? BOARD_FOOT} />)}
      </div>

      <Win x={EDGE} y={EDGE} w={HW} h={134} testId="camp-place">
        <div className="tt" style={{ left: PAD, top: 9 }} data-testid="camp-name">{view.name}</div>
        <div className="s15 dim nowrap" style={{ left: PAD, top: 60 }}>Camp · {view.region}</div>
        <div className="s16 bone nowrap" style={{ right: PAD, top: 58 }}><FIcon name="sun" style={{ margin: '-5px 6px 0 0' }} />Day {view.day}</div>
        <div className="frule" style={{ left: PAD, top: 92, width: HW - 2 * PAD }} />
        <div className="s15 bone nowrap" style={{ left: PAD, top: 102 }}><FIcon name="coin" style={{ margin: '-4px 6px 0 0' }} /><span className="straw">{view.gold}</span> gold</div>
        <div className={`s15 nowrap ${view.food === 0 ? 'rust' : 'bone'}`} style={{ left: 130, top: 102 }}><FIcon name="ration" style={{ margin: '-4px 6px 0 0' }} /><span className={view.food === 0 ? '' : 'straw'} data-testid="camp-food">{view.food}</span> food</div>
        {view.food === 0
          ? <div className="why" style={{ left: 222, top: 104 }}>none left</div>
          : <div className="nowrap" style={{ left: 222, top: 106, height: 11 }} aria-hidden><Pips on={view.food} /></div>}
        {view.potion !== null && <div className="s15 bone nowrap" style={{ right: PAD, top: 102 }}><FIcon name="potion" style={{ margin: '-4px 6px 0 0' }} />{view.potion}</div>}
      </Win>

      <Win x={CX} y={EDGE} w={CW} h={NH} testId="camp-night">
        <SectionHead x={PAD} y={13} w={IW} heading={spent ? 'The fire burns low' : 'One night'} note={spent ? 'the night is spent' : 'one thing tonight'} />
        {night}
        {report.length > 0 && <div className="fcamp__report" style={{ left: 0, top: reportY, width: CW, height: ry }} data-testid="scout-report">{report}</div>}
        <FBtn variant={brass === 'leave' ? 'primary' : 'secondary'} w={116} disabledReason={leave.ok ? null : leave.reason} onPress={() => dispatch({ type: 'camp/leave' })} testId="camp-leave" style={{ position: 'absolute', left: PAD, top: leaveY }}>Break camp</FBtn>
        <div className="s15 lt dim nowrap" style={{ left: PAD + 136, top: leaveY + 6 }}>{spent ? 'back on the road' : 'back on the road, nothing spent'}</div>
      </Win>

      <Win x={CX} y={KY} w={CW} h={KH} testId="camp-roster">
        <SectionHead x={PAD} y={13} w={IW} heading="The Company" note={!spent && rest.ok ? 'if they rest tonight' : `${word(view.party.length).toLowerCase()} of us`} />
        {view.party.map((u, i) => {
          const ty = 44 + i * rowH
          const gain = !spent && rest.ok ? u.gain : 0
          const low = u.hp * 2 < u.max
          return (
            <React.Fragment key={u.id}>
              <Niche x={PAD} y={ty + (tight ? 3 : 4)} size={face} {...faceArt(u.sprite, face)} />
              <div className={`${tight ? 's15' : 's16'} bone nowrap`} style={{ left: tx, top: ty + (tight ? 1 : 3) }}>{u.name}</div>
              {!tight && <div className="s13 dim nowrap fcamp__role" style={{ left: tx, top: ty + 24, maxWidth: IW - face - 14 - 66 }}>{u.role}</div>}
              <div className="s15 bone nowrap" style={{ right: PAD, top: ty + (tight ? 1 : 3) }} data-testid={`camp-hp-${u.id}`}>
                {tight && gain > 0 && <span className="s13 meadow" style={{ marginRight: 10 }}>+{gain} → {u.hp + gain}</span>}
                <span className={low ? 'rust' : ''}>{u.hp}</span>/{u.max}
              </div>
              {!tight && <div className={`s13 nowrap ${gain > 0 ? 'meadow' : 'faint'}`} style={{ right: PAD, top: ty + 24 }}>{gain > 0 ? `+${gain} → ${u.hp + gain}` : u.hp >= u.max ? 'whole' : ''}</div>}
              <Gauge x={tx} y={ty + (tight ? 22 : 45)} w={CW - PAD - tx} h={9} value={u.hp} max={u.max} gain={gain} />
              {i < view.party.length - 1 && <div className="fgroove" style={{ left: PAD, top: ty + rowH - 6, width: IW }} />}
            </React.Fragment>
          )
        })}
        <div className="s13 it dim nowrap" style={{ left: PAD, top: KH - 30 }} data-testid="camp-state">
          {hurt.length === 0 ? 'Nobody is hurt tonight. The fire is for the warmth.' : `${listNames(hurt.map((u) => u.name))} ${hurt.length === 1 ? 'carries a wound' : 'carry wounds'} to the fire.`}
        </div>
      </Win>

      <div className="fmap-foot s14 bone ol1d" style={{ left: EDGE + 6, top: 692 }} data-testid="camp-foot">
        {spent ? 'The night is spent. At first light, the road.' : 'One thing tonight: rest or scout. Then the road.'}
      </div>
    </div>
  )
}
