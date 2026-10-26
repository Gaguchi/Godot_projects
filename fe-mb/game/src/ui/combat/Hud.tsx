/**
 * ui/combat/Hud.tsx — the chrome around the field (brief §2.8): herald plaque (turn, sigil, name, HP, AP pips),
 * initiative strip (top-left, as many faces as clear the plaque), the play panel (pin-then-confirm: the damage
 * forecast when there is one, otherwise the card's intent in words — the commit affordance is never conditional on
 * the math), the tutorial hint, the command column (item tray + Move / Capture / End turn, each disabled WITH its
 * reason) and the Tab danger chip. Everything reads selectors; nothing here owns state.
 *
 * Disabled-with-reason has ONE source for every parameterless verb: `useLegal`. The flow gate carries the screen and
 * the team, and — since CONTRACT-CHANGES 0089 — the two arming rules as well ("already moved this turn", "rooted in
 * place", "needs 2 AP", "no foe within arm's reach"), read from the predicates the reducer refuses with. Only a
 * PARAMETERISED verb still needs a local reason, because legality cannot answer one: `itemReason` per tray row.
 * A command button is never merely inert: it says why. That is also why the column KEEPS ITS FRAME on the enemy's turn: unmounting it
 * dropped the bottom 165px of the stage and made the whole surface jump every phase, and an inert verb that says
 * "the enemy is acting" is more honest than an absent one.
 *
 * The play panel leads with the OUTCOME — what changes, largest, first — and keeps the reckoning under it as a
 * secondary line in words. It used to open with `8 + mag 7 − DR 1 = 14`: a formula, in raw stat keys, above the only
 * line the player was actually reading.
 */
import React from 'react'
import type { Action } from '../../engine/actions'
import { isLiving } from '../../engine/combat/grid'
import { initiativeStrip } from '../../engine/combat/turn'
import type { CombatState, CombatUnit, EngineEnv, Forecast, ItemId, RunState, TutorialStep } from '../../engine/types'
import { outcomeWords, reckoningWords, riderWords } from '../../engine/combat/words'
import { spriteIdFor } from '../../content/index'
import { displayName } from '../../engine/run/party'
import { Button } from '../components/Button'
import { useTip } from '../components/Tooltip'
import { dispatch, useEnv, useLegal } from '../store'
import { STATUS_WORD } from './CardHand'
/** The play's WORDS live with the card's (`engine/combat/words.ts`): the headless game prints a forecast too
 *  (CONTRACT §10, FINAL GATE C 3.8) and `scripts/**` may not import `ui/**`. Re-exported for the suite. */
export { outcomeWords, reckoningWords } from '../../engine/combat/words'
import type { ChronicleLine } from './chronicle'
import { initiativeVisible } from './geometry'
import { initialsOf } from '../names'

function CommandButton({ action, label, variant = 'secondary', testId, reason = null }: { readonly action: Action; readonly label: string; readonly variant?: 'primary' | 'secondary' | 'ghost'; readonly testId: string; readonly reason?: string | null }): React.JSX.Element {
  const legal = useLegal(action)
  return (
    <Button variant={variant} disabledReason={legal.ok ? reason : legal.reason} onPress={() => dispatch(action)} testId={testId}>
      {label}
    </Button>
  )
}

export function HeraldPlaque({ combat, run }: { readonly combat: CombatState; readonly run: RunState | null }): React.JSX.Element | null {
  const active = combat.units[combat.turn.unitId]
  if (active === undefined) return null
  const name = run === null ? active.name : displayName(active, run)
  const ap = combat.units[combat.turn.unitId]?.ap ?? 0
  const pips = Array.from({ length: Math.max(3, ap) }, (_, i) => i < ap)
  const ratio = active.hp.max <= 0 ? 0 : active.hp.current / active.hp.max
  return (
    <div className="hud-panel plaque" data-testid="plaque">
      <div>
        <div className="plaque__label">Turn</div>
        <div className="numeral" style={{ fontSize: 22 }}>{combat.turn.round}</div>
      </div>
      <div className="hud-divider" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ width: 14, height: 14, borderRadius: active.team === 'party' ? 9999 : 0, background: active.team === 'party' ? 'var(--color-ally)' : 'var(--color-enemy)', clipPath: active.team === 'enemy' ? 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)' : undefined }} />
        <div>
          <div className="plaque__name">{name}</div>
          <div className="plaque__label">{active.team === 'party' ? 'Your turn' : 'Enemy turn'}</div>
        </div>
      </div>
      <div className="hud-divider" />
      <div style={{ minWidth: 150 }}>
        <div className="plaque__label">Health</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="hp-bar" style={{ width: 90 }}><i className="hp-bar__fill" style={{ width: `${Math.round(ratio * 100)}%`, background: ratio <= 0.25 ? 'var(--hp-crit)' : ratio <= 0.5 ? 'var(--hp-warn)' : 'var(--hp-ok)', display: 'block' }} /></span>
          <span className="numeral">{active.hp.current}<span style={{ color: 'var(--color-text-muted)' }}>/{active.hp.max}</span></span>
        </div>
      </div>
      <div className="hud-divider" />
      <div>
        <div className="plaque__label">Actions</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }} aria-label={`${ap} action points`}>
          {pips.map((full, i) => <span key={i} className={`ap-pip ${full ? 'ap-pip--full' : 'ap-pip--empty'}`} />)}
        </div>
      </div>
      {active.armor > 0 && (
        <>
          <div className="hud-divider" />
          <div><div className="plaque__label">Armor</div><div className="numeral" style={{ fontSize: 18 }}>{active.armor}</div></div>
        </>
      )}
    </div>
  )
}

/**
 * The company rail — the left column of the field, which was 340×440 of empty brown below the initiative strip
 * (GATE2-16). It carries the one reading nothing else on this screen has: STATUSES. A taunt, a burn, an empower or
 * a root lives only as a float on the frame it is applied and is invisible for the rest of the battle — which is a
 * large part of why GATE3-02's Cover felt like it did nothing. The rail names each one, on whom, for how long,
 * beside that unit's health and ward, for the whole party at once and for the whole battle.
 *
 * It is deliberately the PARTY only: the initiative strip above it is the turn ORDER (party and foes, truncated to
 * what clears the plaque); this is the company sheet.
 */
export function CompanyRail({ combat, run }: { readonly combat: CombatState; readonly run: RunState | null }): React.JSX.Element {
  const env = useEnv()
  const party = Object.values(combat.units).filter((u) => u.team === 'party').sort((a, b) => a.id.localeCompare(b.id))
  /** What they are fighting WITH — in a gear-as-deck game the hands are the deck, and nothing else in the battle
   *  says whose is whose once the cards are face down. */
  const hands = (u: CombatUnit): string => {
    const names = [u.handLeft, u.handRight].flatMap((id) => (id === null ? [] : [env.content.items[id]?.name ?? null])).filter((n): n is string => n !== null)
    return names.length === 0 ? 'bare-handed' : [...new Set(names)].join(' · ')
  }
  return (
    <div className="company-rail" data-testid="company-rail">
      <div className="plaque__label">The company</div>
      {party.map((u) => {
        const down = !isLiving(u)
        const ratio = u.hp.max <= 0 ? 0 : Math.max(0, u.hp.current) / u.hp.max
        const sprite = spriteIdFor(u.id, u.classId)
        const acting = u.id === combat.turn.unitId
        return (
          <div key={u.id} className={`rail-card${acting ? ' rail-card--acting' : ''}${down ? ' rail-card--down' : ''}`} data-testid={`rail-${u.id}`} data-acting={acting ? 'true' : undefined}>
            <span className="rail-card__face">
              {sprite !== null ? <img src={`/sprites/units/${sprite}.png`} alt="" draggable={false} /> : <span className="voice-display">{initialsOf(u.name)}</span>}
            </span>
            <span className="rail-card__body">
              <span className="rail-card__head">
                <span className="rail-card__name">{run === null ? u.name : displayName(u, run)}</span>
                {u.armor > 0 && <span className="rail-card__armor numeral" data-testid={`rail-armor-${u.id}`}>{u.armor} ward</span>}
              </span>
              <span className="rail-card__hands">{hands(u)}</span>
              <span className="rail-card__hp">
                <span className="hp-bar"><i className="hp-bar__fill" style={{ width: `${Math.round(ratio * 100)}%`, background: ratio <= 0.25 ? 'var(--hp-crit)' : ratio <= 0.5 ? 'var(--hp-warn)' : 'var(--hp-ok)', display: 'block' }} /></span>
                <span className="numeral rail-card__num">{down ? 'down' : `${u.hp.current}/${u.hp.max}`}</span>
              </span>
              {u.statuses.length > 0 && (
                <span className="rail-card__riders" data-testid={`rail-riders-${u.id}`}>
                  {u.statuses.map((st) => (
                    <span key={st.id} className={`rider rider--${st.id}`}>{STATUS_WORD[st.id]}{st.stacks > 1 ? ` ${st.stacks}` : ''} · <b className="numeral">{st.turns}</b></span>
                  ))}
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The field — the right column's resting content, and the mirror of the company rail. The play panel and the
 * tutorial hint own this seat when they are up, so the roll is DIMMED under them rather than unmounted (the
 * column never changes size, and nothing in the layout moves — the lesson of 0073).
 *
 * It answers "what am I fighting", which the board can only answer by hovering six tokens, and it is the only
 * surface anywhere that shows an ENEMY's statuses: a poison the party spent a card on was invisible the moment
 * its float faded.
 */
export function FoeRoll({ combat, muted }: { readonly combat: CombatState; readonly muted: boolean }): React.JSX.Element {
  const foes = Object.values(combat.units).filter((u) => u.team === 'enemy' && !u.captured).sort((a, b) => a.id.localeCompare(b.id))
  const standing = foes.filter(isLiving).length
  return (
    <div className={`foe-roll${muted ? ' foe-roll--muted' : ''}`} data-testid="foe-roll" aria-hidden={muted || undefined}>
      <div className="plaque__label">The field · <b className="numeral">{standing}</b> standing</div>
      <div className="foe-roll__list">
        {foes.map((u) => {
          const down = !isLiving(u)
          const ratio = u.hp.max <= 0 ? 0 : Math.max(0, u.hp.current) / u.hp.max
          const sprite = spriteIdFor(u.id, u.classId)
          const acting = u.id === combat.turn.unitId
          return (
            <div key={u.id} className={`foe-row${acting ? ' foe-row--acting' : ''}${down ? ' foe-row--down' : ''}`} data-testid={`foe-${u.id}`}>
              <span className="foe-row__face">
                {sprite !== null ? <img src={`/sprites/units/${sprite}.png`} alt="" draggable={false} /> : <span className="voice-display">{initialsOf(u.name)}</span>}
              </span>
              <span className="foe-row__body">
                <span className="foe-row__name">{u.name}</span>
                <span className="rail-card__hp">
                  <span className="hp-bar"><i className="hp-bar__fill" style={{ width: `${Math.round(ratio * 100)}%`, background: ratio <= 0.25 ? 'var(--hp-crit)' : ratio <= 0.5 ? 'var(--hp-warn)' : 'var(--hp-ok)', display: 'block' }} /></span>
                  <span className="numeral rail-card__num">{down ? 'down' : `${u.hp.current}/${u.hp.max}`}</span>
                </span>
                {u.statuses.length > 0 && (
                  <span className="rail-card__riders" data-testid={`foe-riders-${u.id}`}>
                    {u.statuses.map((st) => <span key={st.id} className={`rider rider--${st.id}`}>{STATUS_WORD[st.id]}{st.stacks > 1 ? ` ${st.stacks}` : ''} · <b className="numeral">{st.turns}</b></span>)}
                  </span>
                )}
              </span>
              {u.armor > 0 && <span className="rail-card__armor numeral">{u.armor}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Blow by blow — the last few things that happened, in words, under the company rail.
 *
 * A float lives 700ms over a tile and is then gone; an enemy phase pumps four of them while the player is reading
 * something else. This is the only surface in the battle that answers "what just hit me", and it fills the one
 * void the composition pass left on this screen (RE-GATE B 2.9: 256×144 at the bottom-left). Lines are built by
 * `./chronicle.ts` from the reducer's own effects, so the log cannot say anything the engine did not do.
 */
export function Chronicle({ lines }: { readonly lines: readonly ChronicleLine[] }): React.JSX.Element {
  return (
    <div className="chronicle" data-testid="chronicle">
      <div className="plaque__label">Blow by blow</div>
      <div className="chronicle__lines">
        {lines.length === 0
          ? <div className="chronicle__line chronicle__line--idle">Nothing has come of it yet</div>
          : lines.map((l) => (
            <div key={l.id} className={`chronicle__line chronicle__line--${l.tone}`}>
              {l.parts.map((part, i) => (typeof part === 'number' ? <b key={i} className="numeral">{part}</b> : <span key={i}>{part}</span>))}
            </div>
          ))}
      </div>
    </div>
  )
}

/**
 * One face in the turn order. The strip has room for a portrait and a number, not a name, so the name lives in the
 * tip — on the glass, in the game's own ink, not in the browser's.
 */
function StripEntry({ name, team, active, sprite, hp, max }: {
  readonly name: string
  readonly team: string
  readonly active: boolean
  readonly sprite: string | null
  readonly hp: number
  readonly max: number
}): React.JSX.Element {
  const { tipRef, tipProps, tip } = useTip(`${name} · ${hp}/${max}`, false)
  return (
    <>
      <div ref={tipRef} className={`strip__entry strip__entry--${team}${active ? ' strip__entry--active' : ''}`} {...tipProps}>
        {/* `draggable={false}` like every other sprite in the tree: this is the one screen with real drag-and-drop
            (a card onto a target, the active unit onto a tile), and a native image ghost competes with the game's
            own `drag-ghost` (FINAL GATE B B.5). */}
        <div className="strip__face">{sprite !== null ? <img src={`/sprites/units/${sprite}.png`} alt="" draggable={false} /> : initialsOf(name)}</div>
        {hp}/{max}
      </div>
      {tip}
    </>
  )
}

export function InitiativeStrip({ combat, run }: { readonly combat: CombatState; readonly run: RunState | null }): React.JSX.Element {
  // How many faces fit LEFT of the centred plaque; the "+N" chip takes a slot of its own, so ask for one fewer when
  // the queue overflows. Hard-coding 8 ran the last portrait under the plaque at 8+ units.
  const slots = initiativeVisible()
  const first = initiativeStrip(combat, slots)
  const strip = first.more > 0 ? initiativeStrip(combat, Math.max(1, slots - 1)) : first
  return (
    <div className="hud-panel strip" aria-label="Turn order" data-testid="initiative">
      {strip.ids.map((id) => {
        const u = combat.units[id]
        if (u === undefined) return null
        const sprite = spriteIdFor(u.id, u.classId)
        return (
          <StripEntry
            key={id}
            name={run === null ? u.name : displayName(u, run)}
            team={u.team}
            active={id === combat.turn.unitId}
            sprite={sprite}
            hp={u.hp.current}
            max={u.hp.max}
          />
        )
      })}
      {strip.more > 0 && <div className="strip__entry"><div className="strip__face">+{strip.more}</div></div>}
    </div>
  )
}

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
  readonly attackerName: string
  /** The damage/heal math — null when the pinned tile holds nobody the maths can be run against. */
  readonly forecast: Forecast | null
  readonly targetName: string | null
  readonly targetHp: { readonly current: number; readonly max: number } | null
  readonly targetArmor: number
  /** Every OTHER unit the play lands on (AoE, all_enemies, all_allies, ring). */
  readonly victims: readonly VictimRow[]
  /** The card in words — always rendered when there is no forecast, so a status-only play still explains itself. */
  readonly intent: readonly string[]
  /** Empty-blast note: an AoE pinned on ground with nobody in it. */
  readonly emptyBlast: boolean
}

/** Which way the outcome runs — harm reads oxblood, mending reads green, a no-op stays ink. */
function outcomeTone(f: Forecast, armorBefore: number): 'harm' | 'mend' | 'none' {
  if (f.hpLost > 0 || f.armorLost > 0) return 'harm'
  return f.heal > 0 || f.predictedArmor > armorBefore ? 'mend' : 'none'
}

/**
 * The one commit affordance. It renders whenever a card is pinned (or is a self / all_* play) — NOT only when a
 * `Forecast` exists. 19 of the shipped cards produce no forecast (every tile AoE, plus the status/AP-only plays);
 * before this they offered no Confirm at all and only a second click on the same tile fired them.
 *
 * Reading order is outcome → new state → riders → reckoning. Confirm is the view's ONE brass primary while it is
 * up, which is why `Commands` drops End turn to a plain strap for as long as this panel is open.
 */
export function PlayPanel({ preview, onConfirm, onCancel, confirmLabel = 'Confirm' }: { readonly preview: PlayPreview; readonly onConfirm: () => void; readonly onCancel: () => void; readonly confirmLabel?: string }): React.JSX.Element {
  const f = preview.forecast
  const dmg = f === null ? 0 : f.afterDr + f.quiverTerm
  return (
    <div className="hud-panel forecast" data-testid="play-panel">
      <div className="plaque__label">{f === null ? 'Play' : 'Forecast'}</div>
      <div className="voice-display" style={{ fontSize: 16, margin: '2px 0 6px' }}>
        {preview.targetName === null ? preview.cardName : <>{preview.attackerName} → {preview.targetName}</>}
        {f?.redirectedTo != null && <span style={{ color: 'var(--color-hearth)' }}> (covered)</span>}
      </div>
      {/* the maths would have named the card by its numbers; with no maths, name it in words */}
      {f === null && preview.targetName !== null && <div className="forecast__math" style={{ color: 'var(--color-parchment)' }}>{preview.cardName}</div>}
      {f !== null && preview.targetHp !== null && (
        <div data-testid="forecast">
          <div className={`forecast__outcome forecast__outcome--${outcomeTone(f, preview.targetArmor)}`} data-testid="forecast-outcome">
            <span className="numeral">{outcomeWords(f, preview.targetArmor)}</span>
            {f.lethal && <span className="forecast__lethal">SLAIN</span>}
          </div>
          <div className="numeral forecast__state">
            HP {preview.targetHp.current} → <b style={{ color: f.lethal ? 'var(--color-damage-text)' : 'var(--color-parchment)' }}>{f.predictedHp}</b> / {preview.targetHp.max}
            {(preview.targetArmor > 0 || f.predictedArmor > 0) && ` · armor ${preview.targetArmor} → ${f.predictedArmor}`}
          </div>
          {f.riders.length > 0 && <div className="forecast__math">{riderWords(f.riders)}</div>}
          {dmg > 0 && <div className="forecast__reckon" data-testid="forecast-reckoning">{reckoningWords(f)}</div>}
        </div>
      )}
      {f === null && preview.intent.map((line) => <div key={line} className="forecast__math">{line}</div>)}
      {preview.victims.length > 0 && (
        <div className="forecast__victims" data-testid="forecast-victims">
          <div className="plaque__label" style={{ marginBottom: 2 }}>{f === null ? 'Caught in it' : 'Also caught'}</div>
          {preview.victims.map((v) => (
            <div key={v.unitId} className="forecast__math" data-testid={`victim-${v.unitId}`}>
              {v.name} · {v.hpBefore} → <b style={{ color: v.lethal ? 'var(--color-damage-text)' : 'var(--color-parchment)' }}>{v.hpAfter}</b> / {v.hpMax}
              {v.lethal && <span className="forecast__lethal"> SLAIN</span>}
            </div>
          ))}
        </div>
      )}
      {preview.emptyBlast && <div className="forecast__math" data-testid="empty-blast">nobody is standing in it</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button variant="primary" onPress={onConfirm} testId="confirm-play">{confirmLabel}</Button>
        <Button variant="ghost" onPress={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

const HINT: Readonly<Record<TutorialStep, string>> = {
  enemyTurn: 'The bandit takes his turn. Watch where he stands.',
  move: 'Every unit gets one free MOVE per turn. Click your foundling, then a blue tile, to close the distance.',
  pickCard: 'Pick a card from your hand. The number is what it does; the cost is in the brass badge.',
  target: 'Now aim it: click a red tile, read the forecast, then confirm.',
  endTurn: 'Out of actions — end the turn and let steel remember.',
  victory: 'The lesson is over. The road begins.',
}

export function TutorialHint({ step }: { readonly step: TutorialStep }): React.JSX.Element {
  return (
    <div className="hud-panel tutorial-hint" data-testid="tutorial-hint">
      <div className="tutorial-hint__step">First steps</div>
      {HINT[step]}
      <div style={{ marginTop: 8 }}><CommandButton action={{ type: 'tutorial/skip' }} label="Skip" variant="ghost" testId="tutorial-skip" /></div>
    </div>
  )
}

/* ── the rule-level reasons (the flow gate is `useLegal`; these mirror the reducer's own refusals) ──────────────
   MOVE and CAPTURE used to be answered HERE, in English, beside a reducer that refused the same two rules in
   machine codes and a legality gate that said "ok" to both — three homes for one sentence, and the gate was the
   one the disabled control read. The rules moved into `combat/turn.ts#canEnterMove` and
   `combat/capture.ts#canEnterCapture`, which `useLegal` now answers with (CONTRACT-CHANGES 0089), so the two
   helpers that lived here are gone rather than duplicated. `itemReason` stays: an item is chosen per ROW, and
   legality cannot answer a parameterised verb. */

export function itemReason(itemId: ItemId, combat: CombatState, active: CombatUnit | undefined, env: EngineEnv): string | null {
  if (active === undefined || active.team !== 'party') return 'not your unit'
  if (active.ap < env.rules.combat.itemUseAp) return 'no AP left'
  if (!combat.consumables.includes(itemId)) return 'none left'
  const item = env.content.items[itemId]
  if (item?.effect?.kind === 'Heal' && active.hp.current >= active.hp.max) return 'already at full health'
  return null
}

/** The item tray: one row per distinct consumable, so a Power Elixir behind a Healing Potion is reachable. */
function ItemTray({ combat, onItem }: { readonly combat: CombatState; readonly onItem: (itemId: ItemId) => void }): React.JSX.Element | null {
  const env = useEnv()
  const active = combat.units[combat.turn.unitId]
  const counts = new Map<ItemId, number>()
  for (const id of combat.consumables) counts.set(id, (counts.get(id) ?? 0) + 1)
  if (counts.size === 0) return null
  return (
    <div className="item-tray" data-testid="item-tray">
      <div className="plaque__label">Bag</div>
      {[...counts].map(([itemId, count]) => {
        const item = env.content.items[itemId]
        const effect = item?.effect
        // The changing number wears the numeral face, and the unit rides INSIDE the same span (ARCHITECTURE §5.1).
        // `.item-row__what` is Cinzel + uppercase, which re-cuts a digit as an inscription (FINAL GATE B B.3).
        const what: React.ReactNode = effect === undefined ? null
          : effect.kind === 'Heal' ? <>restores <b className="numeral">{effect.amount} HP</b></>
            : <b className="numeral">+{effect.amount} AP</b>
        return (
          <ItemRow key={itemId} itemId={itemId} name={item?.name ?? itemId} count={count} what={what} reason={itemReason(itemId, combat, active, env)} onItem={onItem} />
        )
      })}
    </div>
  )
}

function ItemRow({ itemId, name, count, what, reason, onItem }: { readonly itemId: ItemId; readonly name: string; readonly count: number; readonly what: React.ReactNode; readonly reason: string | null; readonly onItem: (itemId: ItemId) => void }): React.JSX.Element {
  const legal = useLegal({ type: 'combat/useItem', itemId })
  return (
    <Button className="item-row" variant="secondary" disabledReason={legal.ok ? reason : legal.reason} onPress={() => onItem(itemId)} testId={`use-item-${itemId}`} style={{ padding: '0.4rem 0.7rem' }}>
      <span className="item-row__name">{name}</span>
      <span className="item-row__count">×{count}</span>
      <span className="item-row__what">{what}</span>
    </Button>
  )
}

/**
 * The command column. It is mounted for the WHOLE battle, party turn or not: `useLegal` already answers every
 * `combat/*` action with "the enemy is acting" on the enemy's turn, so the verbs stay where they are and say so.
 *
 * `pending` is true while the play panel is up. End turn then drops to a plain strap, because Confirm is the
 * primary of that view and two brass straps in one cluster is two leads (crafting-game-ui signal C).
 *
 * `armed` is the mode the board is in. Move and Capture do not FIRE, they ARM: pressing Move turns the board into
 * a movement chooser and the verb stays held until a tile is picked or the mode is cancelled. Both used to render
 * byte-identically armed and idle, so the only evidence was the board's reach wash deepening by ~13/255 in one
 * channel (RE-GATE B 2.3). They carry `aria-pressed` and the pushed-in strap now, and the verb that is armed is
 * the one the player pressed.
 */
export function Commands({ combat, pending, armed, onMove, onCapture, onItem }: { readonly combat: CombatState; readonly pending: boolean; readonly armed: 'move' | 'capture' | null; readonly onMove: () => void; readonly onCapture: () => void; readonly onItem: (itemId: ItemId) => void }): React.JSX.Element {
  const moveLegal = useLegal({ type: 'combat/enterMove' })
  const captureLegal = useLegal({ type: 'combat/enterCapture' })
  return (
    <div className="commands" data-testid="commands">
      <ItemTray combat={combat} onItem={onItem} />
      <div className="commands__grid">
        <Button variant="secondary" pressed={armed === 'capture'} disabledReason={captureLegal.ok ? null : captureLegal.reason} onPress={onCapture} testId="capture">Capture</Button>
        <Button variant="secondary" pressed={armed === 'move'} disabledReason={moveLegal.ok ? null : moveLegal.reason} onPress={onMove} testId="move">Move</Button>
        <CommandButton action={{ type: 'combat/endTurn' }} label="End turn" variant={pending ? 'secondary' : 'primary'} testId="end-turn" />
      </div>
    </div>
  )
}
