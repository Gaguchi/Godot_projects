/**
 * ui/combat/Hud.tsx — the windows round the field (boards Hyb64Combat, F64CombatEnemy; brief §2.8). Five windows,
 * each with one job, none of them on the field:
 *
 *   · WHO MOVES WHEN (left): the round, and everyone on the field in the order they will act — face, name, side
 *     (a square is ours, a lozenge is theirs: shape first, hue second), strength in figures and as a bar, ward, and
 *     every status with its turns left. It is the turn order, the company sheet and the foe roll in one list,
 *     because they were three readings of the same people.
 *   · THE PLAY (right, top): what the player is about to do. With a card pinned it is the forecast — the OUTCOME
 *     first and largest, the new state, the riders, then the reckoning in words — and the one brass Confirm. With
 *     nothing pinned it says what the next press is for. The commit affordance is never conditional on the maths:
 *     19 of the shipped cards produce no forecast, and they get the card in words and the same Confirm.
 *   · BLOW BY BLOW (right, under it): the last few things that happened, in words.
 *   · WHO IS ACTING (foot, left): their figure, AP as orbs and in figures, what the picked card spends, the bag.
 *   · THE COMMANDS (foot, right): Move, Capture, End turn, the danger zone, the menu.
 *
 * Disabled-with-reason has ONE source for every parameterless verb: `useLegal`. The flow gate carries the screen and
 * the team, and the arming rules as well ("already moved this turn", "needs 2 AP", "no foe within arm's reach"),
 * read from the predicates the reducer refuses with. A refused command stays where it is and prints its reason
 * under itself; that is also why the commands KEEP THEIR FRAME on the enemy's turn. Only a PARAMETERISED verb still
 * needs a local reason, because legality cannot answer one: `itemReason` per bag row.
 */
import React from 'react'
import type { Action } from '../../engine/actions'
import { isLiving } from '../../engine/combat/grid'
import { initiativeStrip } from '../../engine/combat/turn'
import { outcomeWords, reckoningWords, riderWords } from '../../engine/combat/words'
import { spriteIdFor } from '../../content/index'
import type { CombatState, CombatUnit, EngineEnv, Forecast, ItemId, RunState, TutorialStep } from '../../engine/types'
import { useTip } from '../components/Tooltip'
import { TYPE_ICON, type CardType } from '../filigree/cards'
import { KIcon } from '../filigree/items'
import { FBtn, Gauge, Key, Niche, Numeral, Win, faceArt, useKitState } from '../filigree/kit'
import { dispatch, useEnv, useLegal } from '../store'
import { STATUS_WORD } from './CardHand'
import type { ChronicleLine } from './chronicle'
import { fieldNames } from './names'
/** The play's WORDS live with the card's (`engine/combat/words.ts`): the headless game prints a forecast too
 *  (CONTRACT §10, FINAL GATE C 3.8) and `scripts/**` may not import `ui/**`. Re-exported for the suite. */
export { outcomeWords, reckoningWords } from '../../engine/combat/words'

const EDGE = 14
const PAD = 16
/** The two side columns, and where the foot row starts. */
export const SIDE_W = 276
export const FOOT_Y = 512
const LIST_H = FOOT_Y - EDGE - 14


/* ── who moves when ───────────────────────────────────────────────────────────────────────────────────────────── */

/** The statuses on a unit, each with its turns left: the one reading a float cannot keep on the glass. */
function Riders({ u, testId }: { readonly u: CombatUnit; readonly testId: string }): React.JSX.Element | null {
  if (u.statuses.length === 0) return null
  return (
    <span className="fturn__riders s13 nowrap" data-testid={testId}>
      {u.statuses.map((st, i) => (
        <span key={st.id} className={`rider rider--${st.id}`}>{i > 0 && <span className="faint">, </span>}{STATUS_WORD[st.id]}{st.stacks > 1 ? ` ${st.stacks}` : ''}<span className="dim"> · {st.turns} {st.turns === 1 ? 'turn' : 'turns'}</span></span>
      ))}
    </span>
  )
}

export function TurnList({ combat, run }: { readonly combat: CombatState; readonly run: RunState | null }): React.JSX.Element {
  const called = fieldNames(combat, run)
  const order = initiativeStrip(combat, 99).ids
  const queued = new Set(order)
  // everyone still standing, in the order they will act; then whoever is down or taken, ours first
  const rest = Object.values(combat.units).filter((u) => !queued.has(u.id) && !(u.team === 'enemy' && u.captured)).sort((a, b) => (a.team === b.team ? a.id.localeCompare(b.id) : a.team === 'party' ? -1 : 1))
  const units = [...order.flatMap((id) => { const u = combat.units[id]; return u === undefined ? [] : [u] }), ...rest]
  const top = 62
  const foot = 30
  const room = LIST_H - top - foot
  const riders = units.filter((u) => u.statuses.length > 0 && isLiving(u)).length
  // full rows while they fit; a larger field closes them up; past that the tail is counted, never clipped
  const tight = units.length * 56 + riders * 16 > room
  const rowH = tight ? 38 : 56
  let shown = units
  while (shown.length > 1 && shown.length * rowH + shown.filter((u) => u.statuses.length > 0 && isLiving(u)).length * 16 + (shown.length < units.length ? 18 : 0) > room) shown = shown.slice(0, -1)
  const face = tight ? 28 : 44
  const tx = PAD + face + 12
  let y = top
  return (
    <Win x={EDGE} y={EDGE} w={SIDE_W} h={LIST_H} testId="initiative" label="Turn order">
      <div className="tt" style={{ left: PAD + 4, top: 8 }}>Round</div>
      <div className="nowrap" style={{ left: PAD + 108, top: 18 }} data-testid="round"><Numeral text={String(combat.turn.round)} label={`round ${combat.turn.round}`} /></div>
      <div className="s13 dim nowrap" style={{ right: PAD, top: 30 }}>who moves when</div>
      <div className="fgroove" style={{ left: PAD, top: 56, width: SIDE_W - 2 * PAD }} />
      {shown.map((u) => {
        const ty = y
        const down = !isLiving(u)
        const acting = u.id === combat.turn.unitId
        const ours = u.team === 'party'
        const hasRiders = u.statuses.length > 0 && !down
        y += rowH + (hasRiders ? 16 : 0)
        const sprite = spriteIdFor(u.id, u.classId)
        return (
          <div key={u.id} className={`fturn${acting ? ' fturn--acting' : ''}${down ? ' fturn--down' : ''}`} style={{ left: 0, top: ty, width: SIDE_W, height: rowH + (hasRiders ? 16 : 0) }} data-testid={`${ours ? 'rail' : 'foe'}-${u.id}`} data-acting={acting ? 'true' : undefined}>
            <Niche x={PAD} y={tight ? 5 : 6} size={face} {...faceArt(sprite, face)} />
            <span className={`abs ${tight ? 's14' : 's16'} nowrap fcard__clip ${acting ? 'straw' : down ? 'faint' : 'bone'}`} style={{ left: tx, top: tight ? 1 : 4, maxWidth: SIDE_W - tx - PAD - (acting ? 76 : down || u.armor > 0 ? 56 : 0) }}>{called[u.id]?.name ?? u.name}</span>
            <span className="abs s13 nowrap" style={{ right: PAD, top: tight ? 2 : 6 }}>
              {acting ? <span className="straw">acting now</span>
                : u.captured ? <span className="faint">taken</span>
                  : down ? <span className="faint">down</span>
                    : u.armor > 0 ? <span className="rill" data-testid={`rail-armor-${u.id}`}>{u.armor} ward</span> : null}
            </span>
            {acting && u.armor > 0 && <span className="abs s13 rill nowrap" style={{ right: PAD + 76, top: tight ? 2 : 6 }} data-testid={`rail-armor-${u.id}`}>{u.armor} ward</span>}
            <i className={`fturn__side fturn__side--${ours ? 'ours' : 'theirs'}`} style={{ left: tx + 1, top: tight ? 23 : 32 }} aria-hidden />
            <span className={down ? 'fturn__bar fturn__bar--down' : ours ? 'fturn__bar' : 'fturn__bar fturn__bar--theirs'}>
              <Gauge x={tx + 14} y={tight ? 23 : 32} w={SIDE_W - tx - 14 - PAD - 56} value={Math.max(0, u.hp.current)} max={u.hp.max} />
            </span>
            <span className={`abs s13 nowrap ${down ? 'faint' : 'bone'}`} style={{ right: PAD, top: tight ? 18 : 27 }}>{Math.max(0, u.hp.current)}/{u.hp.max}</span>
            {hasRiders && <span className="abs" style={{ left: tx, top: rowH - 6 }}><Riders u={u} testId={`${ours ? 'rail' : 'foe'}-riders-${u.id}`} /></span>}
          </div>
        )
      })}
      {shown.length < units.length && <div className="s13 dim nowrap" style={{ left: PAD, top: y + 1 }} data-testid="initiative-more">and {units.length - shown.length} more on the field</div>}
      <div className="fgroove" style={{ left: PAD, top: LIST_H - foot - 2, width: SIDE_W - 2 * PAD }} />
      <div className="s13 dim nowrap" style={{ left: PAD, top: LIST_H - 24 }}>
        <i className="fturn__side fturn__side--ours fturn__side--inline" aria-hidden />square: ours
        <i className="fturn__side fturn__side--theirs fturn__side--inline" style={{ marginLeft: 14 }} aria-hidden />lozenge: theirs
      </div>
    </Win>
  )
}

/* ── the play ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** One further recipient of an AoE / all_* play — the pinned centre keeps the full math row. */
export interface VictimRow {
  readonly unitId: string
  readonly name: string
  readonly hpBefore: number
  readonly hpAfter: number
  readonly hpMax: number
  readonly lethal: boolean
}

export interface PlayPreview {
  readonly cardName: string
  readonly cardType: CardType
  readonly cardCost: number
  readonly attackerName: string
  readonly attackerAp: number
  /** The damage/heal math — null when the pinned tile holds nobody the maths can be run against. */
  readonly forecast: Forecast | null
  readonly targetName: string | null
  readonly targetSprite: string | null
  readonly targetOurs: boolean
  readonly targetHp: { readonly current: number; readonly max: number } | null
  readonly targetArmor: number
  /** Every OTHER unit the play lands on (AoE, all_enemies, all_allies, ring). */
  readonly victims: readonly VictimRow[]
  /** The card in words — always rendered when there is no forecast, so a status-only play still explains itself. */
  readonly intent: readonly string[]
  /** Empty-blast note: an AoE pinned on ground with nobody in it. */
  readonly emptyBlast: boolean
}

/** Which way the outcome runs — harm reads oxblood, mending reads moss, a no-op stays bone. */
function outcomeTone(f: Forecast, armorBefore: number): 'rust' | 'meadow' | 'bone' {
  if (f.hpLost > 0 || f.armorLost > 0) return 'rust'
  return f.heal > 0 || f.predictedArmor > armorBefore ? 'meadow' : 'bone'
}

/**
 * The one commit affordance. It renders whenever a card is pinned (or is a self / all_* play) — NOT only when a
 * `Forecast` exists. Reading order is outcome → new state → riders → reckoning. Confirm is the view's ONE brass
 * primary while it is up, which is why `Commands` drops End turn to a plain button for as long as this is open.
 */
function PlayPanel({ preview, onConfirm, onCancel, confirmLabel }: { readonly preview: PlayPreview; readonly onConfirm: () => void; readonly onCancel: () => void; readonly confirmLabel: string }): React.JSX.Element {
  const f = preview.forecast
  const dmg = f === null ? 0 : f.afterDr + f.quiverTerm
  return (
    <Win x={0} y={0} w={SIDE_W} kind="lit" className="fcol__win" testId="play-panel">
      <div className="s13 dim nowrap">{preview.attackerName} plays</div>
      <div className="fhud__line">
        <KIcon name={TYPE_ICON[preview.cardType]} style={{ margin: '-2px 8px 0 0' }} />
        <span className="s16 straw nowrap fcard__clip" style={{ flex: 1 }}>{preview.cardName}</span>
        <span className="s13 dim nowrap"><span className="bone">{preview.cardCost}</span> of <span className="bone">{preview.attackerAp}</span> AP</span>
      </div>
      <div className="frule fhud__rule" />
      {preview.targetName !== null && (
        <div className="nowrap fcard__clip">
          <span className="s13 dim">{f?.heal !== undefined && f.heal > 0 ? 'on ' : 'at '}</span>
          <span className={`s18 ${preview.targetOurs ? 'rill' : 'rust'}`}>{preview.targetName}</span>
          {f?.redirectedTo != null && <span className="s13 straw"> (covered)</span>}
        </div>
      )}
      {f !== null && preview.targetHp !== null && (
        <div data-testid="forecast">
          <div className="fhud__out">
            <span className="fhud__face"><Niche x={0} y={0} size={72} {...faceArt(preview.targetSprite, 72)} /></span>
            <div>
              <div className={`s20 nowrap ${outcomeTone(f, preview.targetArmor)}`} data-testid="forecast-outcome">{outcomeWords(f, preview.targetArmor)}</div>
              {f.lethal && <div className="s14 rust nowrap" data-testid="forecast-lethal">slain</div>}
              {f.riders.length > 0 && <div className="s13 bone fhud__wrap">{riderWords(f.riders)}</div>}
            </div>
          </div>
          <div className="s14 bone nowrap">
            <span className="dim">HP </span>{preview.targetHp.current} → <span className={f.lethal ? 'rust' : 'straw'}>{f.predictedHp}</span><span className="dim"> of {preview.targetHp.max}</span>
            {(preview.targetArmor > 0 || f.predictedArmor > 0) && <span className="dim"> · armor {preview.targetArmor} → {f.predictedArmor}</span>}
          </div>
          <span className={`fhud__gauge${preview.targetOurs ? '' : ' fhud__gauge--theirs'}`}>
            <Gauge x={0} y={0} w={SIDE_W - 2 * 20} h={9} value={Math.min(preview.targetHp.current, f.predictedHp)} max={preview.targetHp.max} gain={Math.abs(preview.targetHp.current - f.predictedHp)} />
          </span>
          {dmg > 0 && <div className="s13 dim fhud__wrap" data-testid="forecast-reckoning">{reckoningWords(f)}</div>}
        </div>
      )}
      {f === null && preview.intent.map((line) => <div key={line} className="s14 bone fhud__wrap">{line}</div>)}
      {preview.victims.length > 0 && (
        <div className="fhud__victims" data-testid="forecast-victims">
          <div className="s13 ochre nowrap">{f === null ? 'Caught in it' : 'Also caught'}</div>
          {preview.victims.map((v) => (
            <div key={v.unitId} className="s13 bone nowrap fcard__clip" data-testid={`victim-${v.unitId}`}>
              {v.name}<span className="dim"> · {v.hpBefore} → </span><span className={v.lethal ? 'rust' : 'straw'}>{v.hpAfter}</span><span className="dim"> of {v.hpMax}</span>{v.lethal && <span className="rust"> · slain</span>}
            </div>
          ))}
        </div>
      )}
      {preview.emptyBlast && <div className="s14 dim fhud__wrap" data-testid="empty-blast">nobody is standing in it</div>}
      <div className="fhud__verbs">
        <FBtn variant="primary" onPress={onConfirm} testId="confirm-play">{confirmLabel}</FBtn>
        <FBtn onPress={onCancel} testId="cancel-play">Cancel</FBtn>
      </div>
    </Win>
  )
}

const HINT: Readonly<Record<TutorialStep, string>> = {
  enemyTurn: 'The bandit takes his turn. Watch where he stands.',
  move: 'Every unit gets one free move a turn. Click your foundling, then a tile edged in steel, to close the distance.',
  pickCard: 'Pick a card from your hand. The number is what it does; what it costs is at its top.',
  target: 'Now aim it: click a tile edged in red, read the forecast, then confirm.',
  endTurn: 'Out of actions. End the turn and let steel remember.',
  victory: 'The lesson is over. The road begins.',
}

/** What the right-hand seat says when no play is pinned: the next press, in one or two lines. */
export type Guide =
  | { readonly kind: 'tutorial'; readonly step: TutorialStep }
  | { readonly kind: 'card'; readonly name: string; readonly type: CardType; readonly lines: readonly string[]; readonly refusal: string | null }
  | { readonly kind: 'capture'; readonly refusal: string | null }
  | { readonly kind: 'move' }
  | { readonly kind: 'idle'; readonly name: string; readonly canMove: boolean }
  | { readonly kind: 'enemy'; readonly name: string }

function GuidePanel({ guide }: { readonly guide: Guide }): React.JSX.Element {
  const skip = useLegal({ type: 'tutorial/skip' })
  switch (guide.kind) {
    case 'tutorial':
      return (
        <Win x={0} y={0} w={SIDE_W} kind="lit" className="fcol__win" testId="tutorial-hint">
          <div className="s16 ochre nowrap">First steps</div>
          <div className="frule fhud__rule" />
          <div className="s15 lt bone fhud__wrap">{HINT[guide.step]}</div>
          <div className="fhud__verbs"><FBtn disabledReason={skip.ok ? null : skip.reason} onPress={() => dispatch({ type: 'tutorial/skip' })} testId="tutorial-skip">Skip</FBtn></div>
        </Win>
      )
    case 'card':
      return (
        <Win x={0} y={0} w={SIDE_W} className="fcol__win" testId="guide">
          <div className="fhud__line">
            <KIcon name={TYPE_ICON[guide.type]} style={{ margin: '-2px 8px 0 0' }} />
            <span className="s16 straw nowrap fcard__clip" style={{ flex: 1 }}>{guide.name}</span>
          </div>
          <div className="frule fhud__rule" />
          {guide.lines.map((line) => <div key={line} className="s14 bone fhud__wrap">{line}</div>)}
          {guide.refusal !== null
            ? <div className="why fhud__why" data-testid="hand-hint">{guide.refusal}</div>
            : <div className="s13 dim fhud__wrap fhud__gap">Click a marked tile to aim it. <Key>Esc</Key> puts it back.</div>}
        </Win>
      )
    case 'capture':
      return (
        <Win x={0} y={0} w={SIDE_W} className="fcol__win" testId="guide">
          <div className="s16 straw nowrap">Capture</div>
          <div className="frule fhud__rule" />
          {guide.refusal !== null
            ? <div className="why fhud__why" data-testid="capture-hint">{guide.refusal}</div>
            : <div className="s14 bone fhud__wrap">Click a marked foe to take them alive. The chance is over their head.</div>}
          <div className="s13 dim fhud__wrap fhud__gap"><Key>Esc</Key> stands down.</div>
        </Win>
      )
    case 'move':
      return (
        <Win x={0} y={0} w={SIDE_W} className="fcol__win" testId="guide">
          <div className="s16 straw nowrap">Move</div>
          <div className="frule fhud__rule" />
          <div className="s14 bone fhud__wrap">Click a tile edged in steel to go there.</div>
          <div className="s13 dim fhud__wrap fhud__gap"><Key>Esc</Key> stands down.</div>
        </Win>
      )
    case 'enemy':
      return (
        <Win x={0} y={0} w={SIDE_W} className="fcol__win" testId="guide">
          <div className="s16 rust nowrap fcard__clip">{guide.name}</div>
          <div className="frule fhud__rule" />
          <div className="s14 bone fhud__wrap">The enemy is acting. Watch where they stand.</div>
        </Win>
      )
    default:
      return (
        <Win x={0} y={0} w={SIDE_W} className="fcol__win" testId="guide">
          <div className="s16 straw nowrap fcard__clip">{guide.name} to act</div>
          <div className="frule fhud__rule" />
          <div className="s14 bone fhud__wrap">Pick a card from the hand{guide.canMove ? `, or click ${guide.name} to move` : ''}.</div>
        </Win>
      )
  }
}

/**
 * Blow by blow — the last few things that happened, in words. A float lives 700ms over a tile and is then gone; an
 * enemy phase pumps four of them while the player is reading something else. This is the only surface in the
 * battle that answers "what just hit me". Lines are built by `./chronicle.ts` from the reducer's own effects, so
 * the log cannot say anything the engine did not do.
 */
function Chronicle({ lines }: { readonly lines: readonly ChronicleLine[] }): React.JSX.Element {
  return (
    <Win x={0} y={0} w={SIDE_W} className="fcol__win fcol__win--fill" testId="chronicle">
      <div className="s16 ochre nowrap">Blow by blow</div>
      <div className="fgroove fhud__groove" />
      <div className="chronicle__lines">
        {lines.length === 0
          ? <div className="chronicle__line chronicle__line--idle s14 dim">Nothing has come of it yet</div>
          : lines.map((l, i) => (
            <div key={l.id} className={`chronicle__line chronicle__line--${l.tone} s14 ${i === lines.length - 1 ? 'bone' : 'dim'}`}>
              {l.parts.map((part, j) => (typeof part === 'number' ? <span key={j} className={l.tone === 'harm' ? 'rust' : l.tone === 'mend' ? 'meadow' : 'straw'}>{part}</span> : <span key={j}>{part}</span>))}
            </div>
          ))}
      </div>
    </Win>
  )
}

/** The right column: the play (or what the next press is for), and the account of the battle under it. */
export function RightColumn({ preview, guide, lines, onConfirm, onCancel, confirmLabel }: { readonly preview: PlayPreview | null; readonly guide: Guide; readonly lines: readonly ChronicleLine[]; readonly onConfirm: () => void; readonly onCancel: () => void; readonly confirmLabel: string }): React.JSX.Element {
  return (
    <div className="fcol" style={{ left: 1280 - EDGE - SIDE_W, top: EDGE, width: SIDE_W, height: LIST_H }}>
      {preview !== null ? <PlayPanel preview={preview} onConfirm={onConfirm} onCancel={onCancel} confirmLabel={confirmLabel} /> : <GuidePanel guide={guide} />}
      <Chronicle lines={lines} />
    </div>
  )
}

/* ── who is acting ────────────────────────────────────────────────────────────────────────────────────────────── */

export function itemReason(itemId: ItemId, combat: CombatState, active: CombatUnit | undefined, env: EngineEnv): string | null {
  if (active === undefined || active.team !== 'party') return 'not your unit'
  if (active.ap < env.rules.combat.itemUseAp) return 'no AP left'
  if (!combat.consumables.includes(itemId)) return 'none left'
  const item = env.content.items[itemId]
  if (item?.effect?.kind === 'Heal' && active.hp.current >= active.hp.max) return 'already at full health'
  return null
}

/** One thing in the bag: what it is, how many, what it does. Refused, it stays and says why (the reason bubble). */
function ItemRow({ itemId, name, count, what, reason, y, w, tight, onItem }: { readonly itemId: ItemId; readonly name: string; readonly count: number; readonly what: string; readonly reason: string | null; readonly y: number; readonly w: number; readonly tight: boolean; readonly onItem: (itemId: ItemId) => void }): React.JSX.Element {
  const legal = useLegal({ type: 'combat/useItem', itemId })
  const why = legal.ok ? reason : legal.reason
  const off = why !== null
  const k = useKitState(off)
  const { tipRef, tipProps, tip } = useTip(why)
  return (
    <>
      <button
        ref={tipRef}
        type="button"
        className={`row fchoice fitem${!off && k.hovered ? ' hov' : ''}${k.cls.includes('foc') ? ' foc-ring' : ''}`}
        style={{ left: 0, top: y, width: w, height: tight ? 22 : 34, cursor: off ? 'default' : 'pointer' }}
        aria-disabled={off || undefined}
        data-testid={`use-item-${itemId}`}
        onClick={() => { if (!off) onItem(itemId) }}
        {...k.handlers}
        {...tipProps}
        onPointerEnter={() => { k.handlers.onPointerEnter(); tipProps.onPointerEnter() }}
        onPointerLeave={() => { k.handlers.onPointerLeave(); tipProps.onPointerLeave() }}
        onFocus={(e) => { k.handlers.onFocus(e); tipProps.onFocus() }}
        onBlur={() => { k.handlers.onBlur(); tipProps.onBlur() }}
      >
        <KIcon name="potion" style={{ position: 'absolute', left: 2, top: tight ? -1 : 4, ...(off ? { filter: 'grayscale(0.6) brightness(0.7)' } : {}) }} />
        <span className={`abs s14 nowrap fcard__clip ${off ? 'faint' : 'bone'}`} style={{ left: 30, top: tight ? 2 : 0, width: tight ? w - 34 - 50 : w - 34 }}>{name} ×{count}</span>
        {/* closed up, the row keeps what the thing does and drops what it costs to use (every one costs the same) */}
        {tight
          ? <span className={`abs s13 nowrap ${off ? 'faint' : 'dim'}`} style={{ right: 4, top: 3 }}>{what.split(' for ')[0]}</span>
          : <span className={`abs s13 nowrap fcard__clip ${off ? 'faint' : 'dim'}`} style={{ left: 30, top: 17, width: w - 34 }}>{what}</span>}
      </button>
      {tip}
    </>
  )
}

/**
 * Who is acting, at the foot of the stage: their figure, and what they have to act with. For one of ours that is
 * AP (orbs, and in figures), what the picked card would spend, and the bag; for a foe, their strength.
 */
export function ActingWindow({ combat, run, spend, onItem }: { readonly combat: CombatState; readonly run: RunState | null; readonly spend: { readonly name: string; readonly cost: number } | null; readonly onItem: (itemId: ItemId) => void }): React.JSX.Element | null {
  const env = useEnv()
  const active = combat.units[combat.turn.unitId]
  if (active === undefined) return null
  const ours = active.team === 'party'
  const sprite = spriteIdFor(active.id, active.classId)
  const called = fieldNames(combat, run)[active.id]?.name ?? active.name
  const deck = combat.decks[active.id]
  const counts = new Map<ItemId, number>()
  for (const id of combat.consumables) counts.set(id, (counts.get(id) ?? 0) + 1)
  const orbs = Math.max(env.rules.combat.apPerTurn ?? 3, active.ap)
  const W = 300
  const inner = W - 126 - PAD
  return (
    <Win x={EDGE} y={FOOT_Y} w={W} h={720 - EDGE - FOOT_Y} testId="plaque">
      <div className="fact__well" style={{ left: 10, top: 10 }}>
        {sprite !== null && <img className="fact__fig" src={`/sprites/units/board/${sprite}.png`} width={104} height={152} alt="" draggable={false} />}
      </div>
      <div className={`s18 nowrap fcard__clip ${ours ? 'straw' : 'rust'}`} style={{ left: 126, top: 10, width: inner }} data-testid="plaque-name">{called}</div>
      {ours ? (
        <>
          <div className="nowrap" style={{ left: 124, top: 34 }} aria-hidden>
            {Array.from({ length: orbs }, (_, i) => <KIcon key={i} name="ap" style={{ marginRight: 3, ...(i < active.ap ? {} : { filter: 'grayscale(1) brightness(0.45)' }) }} />)}
          </div>
          <div className="s14 nowrap" style={{ right: PAD, top: 38 }} aria-label={`${active.ap} action points`} data-testid="plaque-ap"><span className="bone">{active.ap}</span><span className="dim"> of {orbs} AP</span></div>
          <div className="s13 nowrap fcard__clip" style={{ left: 126, top: 62, width: inner }}>
            {spend !== null ? <><span className="bone">{spend.name}</span><span className="dim"> spends </span><span className="straw">{spend.cost} of {active.ap}</span></> : active.armor > 0 ? <span className="rill">{active.armor} ward</span> : <span className="dim">{active.hp.current}/{active.hp.max} hp</span>}
          </div>
          <div className="fgroove" style={{ left: 126, top: 84, width: inner }} />
          <div className="s13 ochre nowrap" style={{ left: 126, top: 90 }}>Bag</div>
          {deck !== undefined && <div className="s13 dim nowrap" style={{ right: PAD, top: 90 }}>draw {deck.draw.length} · discard {deck.discard.length}</div>}
          {counts.size === 0
            ? <div className="s13 faint nowrap" style={{ left: 126, top: 112 }}>nothing to drink</div>
            : (
              <div className="fitems" style={{ left: 126, top: 108, width: inner + 4, height: counts.size > 2 ? Math.min(3, counts.size) * 24 : counts.size * 36 }} data-testid="item-tray">
                {/* two kinds get two lines each; a third closes the rows up to one line, so all three are listed */}
                {[...counts].slice(0, 3).map(([itemId, count], i) => {
                  const item = env.content.items[itemId]
                  const effect = item?.effect
                  const what = `${effect === undefined ? '' : effect.kind === 'Heal' ? `+${effect.amount} HP` : `+${effect.amount} AP`} for ${env.rules.combat.itemUseAp} AP`
                  return <ItemRow key={itemId} itemId={itemId} name={item?.name ?? itemId} count={count} what={what} reason={itemReason(itemId, combat, active, env)} y={i * (counts.size > 2 ? 24 : 36)} w={inner + 4} tight={counts.size > 2} onItem={onItem} />
                })}
              </div>
            )}
        </>
      ) : (
        <>
          <div className="s13 rust nowrap" style={{ left: 126, top: 36 }}><i className="fturn__side fturn__side--theirs fturn__side--inline" aria-hidden />enemy turn</div>
          <span className="fhud__gauge--theirs"><Gauge x={126} y={62} w={inner - 66} h={9} value={active.hp.current} max={active.hp.max} /></span>
          <div className="s14 nowrap" style={{ right: PAD, top: 56 }}><span className="bone">{active.hp.current}</span><span className="dim">/{active.hp.max}</span></div>
          {active.armor > 0 && <div className="s13 rill nowrap" style={{ left: 126, top: 78 }}>{active.armor} ward</div>}
          <div className="fgroove" style={{ left: 126, top: 104, width: inner }} />
          <div className="s13 dim" style={{ left: 126, top: 112, width: inner, whiteSpace: 'normal' }}>Their turn plays out on the field. The list says who moves next.</div>
        </>
      )}
    </Win>
  )
}

/* ── the commands ─────────────────────────────────────────────────────────────────────────────────────────────── */

/** A verb that ARMS (Move, Capture): pressed, the board becomes its chooser and the verb stays held until a tile is
 *  picked or the mode is cancelled. Refused, it stays and prints its reason under itself. */
function ArmCommand({ label, y, armed, legal, onPress, testId }: { readonly label: string; readonly y: number; readonly armed: boolean; readonly legal: { readonly ok: true } | { readonly ok: false; readonly reason: string }; readonly onPress: () => void; readonly testId: string }): React.JSX.Element {
  const off = !legal.ok
  const k = useKitState(off)
  const state = off ? 'dis' : armed ? 'arm' : k.cls
  return (
    <>
      <button type="button" className={`fcmd${armed && !off ? ' arm' : ''}`} style={{ left: PAD, top: y, width: 200, height: 24, cursor: off ? 'default' : 'pointer' }} aria-pressed={armed && !off} aria-disabled={off || undefined} data-reason={off ? legal.reason : undefined} data-testid={testId} onClick={() => { if (!off) onPress() }} {...k.handlers}>
        <span className={`cmd abs${state === '' ? '' : ` ${state}`}`} style={{ left: -4, top: 1 }}>{label}</span>
      </button>
      {off && <div className="why fcard__clip" style={{ left: PAD, top: y + 23, width: 200 }}>{legal.reason}</div>}
    </>
  )
}

/**
 * The commands. Mounted for the WHOLE battle, party turn or not: `useLegal` answers every `combat/*` action with
 * "the enemy is acting" on the enemy's turn, so the verbs stay where they are and say so.
 *
 * `pending` is true while a play is pinned. End turn then drops to a plain button, because Confirm is the primary
 * of that view and two brass buttons on one stage is two leads (crafting-game-ui signal C).
 */
export function Commands({ pending, armed, showDanger, onMove, onCapture }: { readonly pending: boolean; readonly armed: 'move' | 'capture' | null; readonly showDanger: boolean; readonly onMove: () => void; readonly onCapture: () => void }): React.JSX.Element {
  const moveLegal = useLegal({ type: 'combat/enterMove' })
  const captureLegal = useLegal({ type: 'combat/enterCapture' })
  const end: Action = { type: 'combat/endTurn' }
  const endLegal = useLegal(end)
  const W = 232
  return (
    <Win x={1280 - EDGE - W} y={FOOT_Y} w={W} h={720 - EDGE - FOOT_Y} testId="commands">
      <ArmCommand label="Move" y={8} armed={armed === 'move'} legal={moveLegal} onPress={onMove} testId="move" />
      <ArmCommand label="Capture" y={50} armed={armed === 'capture'} legal={captureLegal} onPress={onCapture} testId="capture" />
      <FBtn variant={pending ? 'secondary' : 'primary'} w={W - 2 * PAD} disabledReason={endLegal.ok ? null : endLegal.reason} onPress={() => dispatch(end)} testId="end-turn" style={{ position: 'absolute', left: PAD, top: 94 }}>End turn</FBtn>
      <button type="button" className="fcmd fcmd--small" style={{ left: PAD, top: 138, width: W - 2 * PAD, height: 20 }} onClick={() => dispatch({ type: 'ui/toggleDanger' })} aria-pressed={showDanger} data-testid="danger-toggle">
        <span className="abs s13 bone nowrap" style={{ left: 0, top: 2 }}>Danger zone</span>
        <span className="abs nowrap" style={{ left: 84, top: 1 }}><Key>Tab</Key></span>
        <span className={`abs s13 nowrap ${showDanger ? 'rust' : 'dim'}`} style={{ left: 126, top: 2 }}>{showDanger ? 'shown' : 'off'}</span>
      </button>
      <button type="button" className="fcmd fcmd--small" style={{ left: PAD, top: 160, width: W - 2 * PAD, height: 20 }} onClick={() => dispatch({ type: 'ui/openModal', modal: { kind: 'pause' } })} data-testid="combat-menu">
        <span className="abs s13 bone nowrap" style={{ left: 0, top: 2 }}>Menu</span>
        <span className="abs nowrap" style={{ left: 42, top: 1 }}><Key>Esc</Key></span>
      </button>
    </Win>
  )
}
