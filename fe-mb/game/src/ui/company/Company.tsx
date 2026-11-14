/**
 * ui/company/Company.tsx — The Company: a screen per person (BRIEF §2.7 gear-as-deck; boards UxPerson, UxPersonDeck,
 * UxEquip). It answers one question at a time, and each has its own state of the one screen:
 *
 *   · KIT: how is this person kitted? The two hands, what each holds, the cards that piece brings, and the verb
 *     that changes it (Put away, Change; an empty hand lists what in the satchel fits it and offers to try it).
 *     Under the hands: strength and stats, and the size of the deck those hands make.
 *   · DECK: what do those hands play? Every card as a face, grouped by where it comes from (the class, each hand).
 *   · HOLDING a piece: what would it do in this hand? The sheet narrows, the satchel opens beside it, the hand it
 *     would go to shows the cards it brings and what it puts back, the deck count shows before and after, and one
 *     brass verb does it. Nothing changes until that verb; Esc puts the piece back.
 *
 * The person's own art stands beside the sheet at the height the board gives it, by its feet, unmirrored and
 * unpainted (`figures.json` says where the figure is in the art; `tools/pxworld/src/px-popups/export_game.py`).
 *
 * Every refusal is the ENGINE's sentence (`run/equipment.ts#planEquip`, `planUnequip`): a hand that is not trained
 * to the piece says so in the hand and offers no verb, a face that cannot carry what is held is dimmed and marked.
 * The projected deck is the engine's too: `buildDeck` on the unit the plan returns, so the count on the glass is the
 * count the fight will deal. And a card's number is what it does in THIS person's hands (base + their stat + the
 * quiver on the instance, `combat/words.ts#cardFace` on `partyCombatUnit`), the number the hand shows in a fight,
 * never the authored base.
 *
 * Keys: Q / E the person before / after, D the deck, Enter puts the held piece in, Esc puts it back or closes.
 * It is opened as a modal (`ui.modal.kind === 'loadout'`) over the map, the town, the camp or a field report.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { spriteIdFor } from '../../content/index'
import { buildDeck } from '../../engine/combat/deck'
import { partyCombatUnit } from '../../engine/combat/seed'
import { cardFace, cardIntentLines } from '../../engine/combat/words'
import { isGear, itemDef } from '../../engine/run/bag'
import { planEquip, planUnequip } from '../../engine/run/equipment'
import { displayName, livingUnits } from '../../engine/run/party'
import type { Card, CardSource, CombatUnit, DeckState, EngineEnv, GameState, HandSlot, Item, QuiverModifier, RunState, Unit, UnitId } from '../../engine/types'
import { cardType, type CardType } from '../combat/CardHand'
import { useTip } from '../components/Tooltip'
import figuresRaw from '../filigree/figures.json'
import { KIcon, iconOf, kindWords } from '../filigree/items'
import { FBtn, FChoice, FIcon, Gauge, Key, Niche, Numeral, SectionHead, Win, faceArt, useKitState } from '../filigree/kit'
import { className, placeName } from '../names'
import { canDispatch, dispatch, useEnv, useGame } from '../store'

const FIGURES = figuresRaw as unknown as Readonly<Record<string, readonly [number, number, number, number] | undefined>>

const EDGE = 14
const PAD = 20
const SX = 346
const WIDE = 920
const NARROW = 516
const SH = 692
const CELL = 44
const STATS: readonly { readonly key: 'str' | 'mag' | 'skl' | 'spd' | 'def' | 'res' | 'lck'; readonly label: string }[] = [
  { key: 'str', label: 'STR' }, { key: 'mag', label: 'MAG' }, { key: 'skl', label: 'SKL' }, { key: 'spd', label: 'SPD' }, { key: 'def', label: 'DEF' }, { key: 'res', label: 'RES' }, { key: 'lck', label: 'LCK' },
]
const BACK: Readonly<Record<string, string>> = { overworld: 'Back to the map', town: 'Back to town', camp: 'Back to the fire', dungeon: 'Back to the dungeon', battleEnd: 'Back to the report' }
const HAND_WORD: Readonly<Record<HandSlot, string>> = { left: 'left', right: 'right' }
const CARD_TALL = 170
const CARD_SHORT = 112
const TYPE_ICON: Readonly<Record<CardType, string>> = { attack: 'attack', ward: 'ward', arcane: 'arcane', focus: 'focus' }

interface CardLine {
  readonly key: string
  readonly ap: number
  readonly name: string
  /** The one number the card is about, what it is a number OF, and who it lands on (`combat/words.ts#cardFace`). */
  readonly num: string
  readonly what: string
  readonly rest: string
  readonly type: CardType
  /** Everything the card does, in words: the face's own tooltip. */
  readonly words: string
  readonly more: string | null
}
interface Piece { readonly id: string; readonly name: string; readonly words: string; readonly rarity: string; readonly icon: string; readonly twoHanded: boolean }
interface Fit extends Piece { readonly key: string; readonly cards: number }
type HeldPlan = { readonly ok: true; readonly cards: readonly CardLine[]; readonly back: readonly string[] } | { readonly ok: false; readonly reason: string }
interface HandView {
  readonly slot: HandSlot
  readonly item: Piece | null
  /** The two-handed piece in the other hand that keeps this one shut. */
  readonly lockedBy: string | null
  readonly cards: readonly CardLine[]
  readonly unequipReason: string | null
  /** What in the satchel this hand may take (nothing held). */
  readonly fits: readonly Fit[]
  /** What putting the held piece in THIS hand would do. */
  readonly plan: HeldPlan | null
}
interface BagItem { readonly key: string; readonly itemId: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly name: string; readonly icon: string; readonly charges: number | null; readonly gear: boolean }
interface View {
  readonly place: string
  readonly back: string
  readonly handSize: number
  readonly faces: readonly { readonly id: UnitId; readonly name: string; readonly sprite: string | null; readonly cannot: string | null }[]
  readonly unit: {
    readonly id: UnitId
    readonly name: string
    readonly sprite: string | null
    readonly sub: string
    readonly hp: number
    readonly max: number
    readonly stats: readonly { readonly label: string; readonly value: number }[]
    readonly hands: readonly HandView[]
    readonly groups: readonly { readonly source: CardSource; readonly label: string; readonly cards: readonly CardLine[] }[]
    readonly deckSize: number
  } | null
  readonly held: (Piece & { readonly key: string }) | null
  readonly project: { readonly before: number; readonly after: number; readonly parts: string } | null
  readonly bag: { readonly w: number; readonly h: number; readonly free: number; readonly items: readonly BagItem[] }
}

function lineOf(card: Card, key: string, who: CombatUnit, mod: QuiverModifier | null): CardLine {
  const f = cardFace(card, who, mod)
  const [what = '', ...rest] = f.foot.split(' · ')
  const lines = cardIntentLines(card, who, mod)
  // the face is about ONE effect (a blow first, else the first thing the card does); `more` is the next thing it does
  const blow = card.effects.findIndex((e) => e.kind === 'Damage')
  const faceAt = blow >= 0 ? blow : 0
  return { key, ap: card.apCost, name: card.name, num: f.number, what, rest: rest.join(' · '), type: cardType(card), words: lines.join('; '), more: lines.find((_, i) => i !== faceAt) ?? null }
}
const pieceOf = (i: Item): Piece => ({ id: i.id, name: i.name, words: kindWords(i), rarity: i.rarity, icon: iconOf(i), twoHanded: i.twoHanded === true })

function linesOf(deck: DeckState, source: CardSource, who: Unit, env: EngineEnv): CardLine[] {
  const fighter = partyCombatUnit(who)
  return Object.values(deck.cards).filter((c) => c.source === source).flatMap((c) => {
    const def = env.content.cards[c.cardId]
    return def === undefined ? [] : [lineOf(def, c.uid, fighter, c.mod)]
  })
}

function sourceLabel(source: CardSource, unit: Unit, env: EngineEnv): string {
  const held = (id: string | null): string => (id === null ? 'empty' : itemDef(id, env).name)
  switch (source) {
    case 'innate': return `From the class · ${className(unit.classId, env)}`
    case 'hand_left': return `Left hand · ${held(unit.handLeft)}`
    case 'hand_right': return `Right hand · ${held(unit.handRight)}`
    default: return 'Their own'
  }
}

function select(s: GameState, env: EngineEnv, unitId: UnitId | null, heldKey: string | null, slot: HandSlot): View | null {
  const run: RunState | null = s.run
  if (run === null) return null
  const living = livingUnits(run)
  const unit = living.find((u) => u.id === unitId) ?? living[0] ?? null
  const heldEntry = heldKey === null ? null : run.bag.find((b) => `${b.x},${b.y}` === heldKey) ?? null
  const heldItem = heldEntry === null ? null : itemDef(heldEntry.itemId, env)
  const held = heldItem === null || heldEntry === null || !isGear(heldItem) ? null : { ...pieceOf(heldItem), key: `${heldEntry.x},${heldEntry.y}` }
  const gear = run.bag.filter((e) => isGear(itemDef(e.itemId, env)))
  const cells = new Set<string>()
  const items = run.bag.map((e): BagItem => {
    const i = itemDef(e.itemId, env)
    for (let dx = 0; dx < i.gridSize.width; dx++) for (let dy = 0; dy < i.gridSize.height; dy++) cells.add(`${e.x + dx},${e.y + dy}`)
    return { key: `${e.x},${e.y}`, itemId: e.itemId, x: e.x, y: e.y, w: i.gridSize.width, h: i.gridSize.height, name: i.name, icon: iconOf(i), charges: i.kind === 'food' ? e.charges : null, gear: isGear(i) }
  })
  let project: View['project'] = null
  const deck = unit === null ? null : buildDeck(unit, env)
  const count = (d: DeckState): number => Object.keys(d.cards).length
  const hands = unit === null || deck === null ? [] : (['left', 'right'] as const).map((hs): HandView => {
    const id = hs === 'left' ? unit.handLeft : unit.handRight
    const item = id === null ? null : itemDef(id, env)
    const leftItem = unit.handLeft === null ? null : itemDef(unit.handLeft, env)
    const lockedBy = hs === 'right' && leftItem?.twoHanded === true ? leftItem.name : null
    const un = id === null ? null : planUnequip(unit, hs, run.bag, env)
    let plan: HeldPlan | null = null
    if (held !== null) {
      // a two-handed piece is always taken in the left hand (`planEquip`), so the right hand never offers it
      const p = held.twoHanded && hs === 'right' ? { ok: false as const, reason: `${held.name} takes both hands: it goes in the left` } : planEquip(unit, hs, held.id, run.bag, env)
      if (!p.ok) plan = { ok: false, reason: p.reason }
      else {
        const next = buildDeck(p.unit, env)
        const out = [unit.handLeft, unit.handRight].filter((x): x is string => x !== null && x !== p.unit.handLeft && x !== p.unit.handRight).map((x) => itemDef(x, env).name)
        plan = { ok: true, cards: linesOf(next, hs === 'left' ? 'hand_left' : 'hand_right', p.unit, env), back: out }
        if (hs === slot) {
          const part = (src: CardSource, label: string): string | null => {
            const was = Object.values(deck.cards).filter((c) => c.source === src).length
            const now = Object.values(next.cards).filter((c) => c.source === src).length
            if (was === 0 && now === 0) return null
            return now === was ? `${label} ${now}` : `${label} ${now > was ? '+' : '−'}${Math.abs(now - was)}`
          }
          const nameIn = (u: Unit, h: HandSlot): string => { const x = h === 'left' ? u.handLeft : u.handRight; return x === null ? `${HAND_WORD[h]} hand` : itemDef(x, env).name }
          project = {
            before: count(deck),
            after: count(next),
            parts: [part('innate', className(unit.classId, env)), part('hand_left', nameIn(p.unit.handLeft === null ? unit : p.unit, 'left')), part('hand_right', nameIn(p.unit.handRight === null ? unit : p.unit, 'right')), part('signature', 'their own')].filter((x): x is string => x !== null).join(' · '),
          }
        }
      }
    }
    return {
      slot: hs,
      item: item === null ? null : pieceOf(item),
      lockedBy,
      cards: linesOf(deck, hs === 'left' ? 'hand_left' : 'hand_right', unit, env),
      unequipReason: un === null ? null : un.ok ? null : un.reason,
      fits: held !== null || lockedBy !== null ? [] : gear.flatMap((e): Fit[] => {
        const g = itemDef(e.itemId, env)
        if (g.twoHanded === true && hs === 'right') return []
        return planEquip(unit, hs, g.id, run.bag, env).ok ? [{ ...pieceOf(g), key: `${e.x},${e.y}`, cards: (g.gearCardIds ?? []).length }] : []
      }),
      plan,
    }
  })
  return {
    place: `${placeName(run.nodeId, env) ?? ''} · day ${run.daysElapsed}`,
    back: BACK[s.screen.kind] ?? 'Back',
    handSize: env.rules.combat.handSize,
    faces: living.map((u) => {
      let cannot: string | null = null
      if (held !== null) {
        const ok = (['left', 'right'] as const).some((h) => !(held.twoHanded && h === 'right') && planEquip(u, h, held.id, run.bag, env).ok)
        if (!ok) { const p = planEquip(u, 'left', held.id, run.bag, env); cannot = p.ok ? null : p.reason }
      }
      // the roster reads the name the player CHOSE (`displayName`), as the band, the HUD and the ledger do
      return { id: u.id, name: displayName(u, run), sprite: spriteIdFor(u.id, u.classId), cannot }
    }),
    unit: unit === null || deck === null ? null : {
      id: unit.id,
      name: displayName(unit, run),
      sprite: spriteIdFor(unit.id, unit.classId),
      sub: `${className(unit.classId, env)} · level ${unit.level} · mov ${unit.mov}`,
      hp: unit.hp.current,
      max: unit.hp.max,
      stats: STATS.map((st) => ({ label: st.label, value: unit.stats[st.key] })),
      hands,
      groups: (['innate', 'hand_left', 'hand_right', 'signature'] as const).flatMap((src) => {
        const cards = linesOf(deck, src, unit, env)
        return cards.length === 0 && (src === 'signature' || src === 'innate') ? [] : [{ source: src, label: sourceLabel(src, unit, env), cards }]
      }),
      deckSize: count(deck),
    },
    held,
    project,
    bag: { w: env.rules.bag.width, h: env.rules.bag.height, free: env.rules.bag.width * env.rules.bag.height - cells.size, items },
  }
}

/** A card's line in a hand: its cost, its name, the number it is about. */
function CardRow({ c, x, y, w }: { readonly c: CardLine; readonly x: number; readonly y: number; readonly w: number }): React.JSX.Element {
  return (
    <div className="fco__row" style={{ left: x, top: y, width: w }}>
      <span className="s13 dim nowrap fco__ap">{c.ap} AP</span>
      <span className="s15 bone nowrap fco__cardname">{c.name}</span>
      <span className="s14 nowrap"><span className="bone">{`${c.num} ${c.what}`.trim()}</span>{c.rest !== '' && <span className="dim"> · {c.rest}</span>}</span>
    </div>
  )
}

/** A card as a face: cost, name, its type's icon beside the number it is about, and who it lands on. */
function CardFace({ c, x, y, tall }: { readonly c: CardLine; readonly x: number; readonly y: number; readonly tall: boolean }): React.JSX.Element {
  // a deck of three rows keeps its faces short: the number, and what it is a number of and who it lands on, on one line
  const k = useKitState()
  const { tipRef, tipProps, tip } = useTip(c.words, false)
  const cast = /^[0-9+\-/]+$/.test(c.num)
  return (
    <>
      <div
        ref={tipRef}
        className={`fw${k.hovered || k.cls.includes('foc') ? ' fw--lit' : ''} fco__card`}
        style={{ left: x, top: y, width: 148, height: tall ? CARD_TALL : CARD_SHORT }}
        tabIndex={0}
        role="img"
        aria-label={`${c.name}, ${c.ap} AP: ${c.words}`}
        data-testid="deck-card"
        {...k.handlers}
        {...tipProps}
        onPointerEnter={() => { k.handlers.onPointerEnter(); tipProps.onPointerEnter() }}
        onPointerLeave={() => { k.handlers.onPointerLeave(); tipProps.onPointerLeave() }}
        onFocus={(e) => { k.handlers.onFocus(e); tipProps.onFocus() }}
        onBlur={() => { k.handlers.onBlur(); tipProps.onBlur() }}
      >
        <div className="s13 dim nowrap" style={{ right: 14, top: 11 }}>{c.ap} AP</div>
        <div className="s15 bone nowrap fco__cardtitle" style={{ left: 12, top: 30, width: 124 }}>{c.name}</div>
        <KIcon name={TYPE_ICON[c.type]} style={{ position: 'absolute', left: 14, top: 58 }} />
        <div className="nowrap" style={{ left: 50, top: 55 }}>{cast ? <Numeral text={c.num} label={`${c.num} ${c.what}`} /> : <span className="s20 ochre">{c.num}</span>}</div>
        {tall ? (
          <>
            <div className="s13 dim nowrap" style={{ left: 50, top: 82 }}>{c.what}</div>
            <div className="fgroove" style={{ left: 12, top: 104, width: 124 }} />
            {/* who it lands on; a card with no target (a draw) says the next thing it does there instead */}
            <div className={`s13 nowrap fco__cardtitle ${c.rest === '' ? 'dim' : 'bone'}`} style={{ left: 12, top: 111, width: 124 }}>{c.rest === '' ? c.more ?? '' : c.rest}</div>
            {c.rest !== '' && c.more !== null && <div className="s13 dim nowrap fco__cardtitle" style={{ left: 12, top: 130, width: 124 }}>{c.more}</div>}
          </>
        ) : (
          <div className="s13 dim nowrap fco__cardtitle" style={{ left: 12, top: 82, width: 124 }}>{c.what}{c.rest !== '' && <span className="bone"> · {c.rest}</span>}</div>
        )}
      </div>
      {tip}
    </>
  )
}

/** A face in the strip: press it to read that person. One that cannot carry what is held is dimmed, marked, and says why. */
function Face({ f, size, on, onPress }: { readonly f: View['faces'][number]; readonly size: number; readonly on: boolean; readonly onPress: () => void }): React.JSX.Element {
  const k = useKitState()
  const { tipRef, tipProps, tip } = useTip(f.cannot === null ? null : `${f.name}: ${f.cannot}`)
  return (
    <>
      <button
        type="button"
        ref={tipRef}
        className={`fco__face${on ? ' sel' : ''}${f.cannot !== null ? ' no' : ''}${k.cls.includes('foc') ? ' foc-ring' : ''}`}
        style={{ width: size, height: size }}
        onClick={onPress}
        aria-pressed={on}
        aria-label={f.name}
        data-testid={`roster-${f.id}`}
        {...k.handlers}
        {...tipProps}
        onPointerEnter={() => { k.handlers.onPointerEnter(); tipProps.onPointerEnter() }}
        onPointerLeave={() => { k.handlers.onPointerLeave(); tipProps.onPointerLeave() }}
        onFocus={(e) => { k.handlers.onFocus(e); tipProps.onFocus() }}
        onBlur={() => { k.handlers.onBlur(); tipProps.onBlur() }}
      >
        <Niche x={0} y={0} size={size} {...faceArt(f.sprite, size)} />
        {f.cannot !== null && <FIcon name="padlock" w={16} h={16} style={{ position: 'absolute', right: 1, bottom: 1 }} />}
      </button>
      {tip}
    </>
  )
}

export function CompanyModal({ initialUnitId }: { readonly initialUnitId: UnitId | null }): React.JSX.Element | null {
  const env = useEnv()
  const [unitId, setUnitId] = useState<UnitId | null>(initialUnitId)
  const [tab, setTab] = useState<'kit' | 'deck'>('kit')
  const [held, setHeld] = useState<{ readonly key: string; readonly slot: HandSlot } | null>(null)
  const view = useGame(useCallback((s: GameState) => select(s, env, unitId, held?.key ?? null, held?.slot ?? 'right'), [env, unitId, held]), (a, b) => JSON.stringify(a) === JSON.stringify(b))

  const u = view?.unit ?? null
  const holding = view?.held ?? null
  const slot = held?.slot ?? 'right'
  const target = u === null || holding === null ? null : u.hands.find((h) => h.slot === slot) ?? null
  const close = useCallback((): void => { dispatch({ type: 'ui/closeModal' }) }, [])
  const equip = useCallback((): void => {
    if (u === null || holding === null || target === null || target.plan === null || !target.plan.ok) return
    const action = { type: 'run/equip', unitId: u.id, itemId: holding.id, slot } as const
    if (!canDispatch(action).ok) return
    dispatch(action)
    setHeld(null)
  }, [u, holding, target, slot])
  const step = useCallback((by: number): void => {
    if (view === null || u === null || view.faces.length < 2) return
    const i = view.faces.findIndex((f) => f.id === u.id)
    setUnitId(view.faces[(i + by + view.faces.length) % view.faces.length]!.id)
  }, [view, u])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === 'Escape') { e.preventDefault(); if (holding !== null) setHeld(null); else close() }
      else if (key === 'q') { e.preventDefault(); step(-1) }
      else if (key === 'e') { e.preventDefault(); step(1) }
      else if (key === 'd' && holding === null) { e.preventDefault(); setTab((t) => (t === 'deck' ? 'kit' : 'deck')) }
      // a focused button answers its own Enter; this is for the bare key
      else if (key === 'Enter' && holding !== null && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); equip() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [holding, close, step, equip])

  if (view === null) return null
  const SW = holding !== null ? NARROW : WIDE
  const IW = SW - 2 * PAD
  const fsize = view.faces.length <= 4 ? 44 : 34
  const fig = u?.sprite === null || u === null ? undefined : FIGURES[u.sprite]
  const scale = fig === undefined ? 0 : Math.min(540 / (fig[3] - fig[1]), 324 / (fig[2] - fig[0]))
  const cannot = view.faces.filter((f) => f.cannot !== null)

  // ---- one hand's band
  const band = (h: HandView, top: number): React.JSX.Element => {
    const isTarget = holding !== null && h.slot === slot
    const take = isTarget && h.plan !== null && h.plan.ok
    const cardsX = holding !== null ? PAD + 82 : PAD + 440
    const cardsW = holding !== null ? IW - 82 : IW - 440
    const first = h.fits[0]
    return (
      <div key={h.slot} className="fco__band" style={{ left: 0, top, width: SW, height: 170 }} data-testid={`hand-${h.slot}`} data-take={take ? 'yes' : 'no'}>
        <div className="s13 bone nowrap" style={{ left: PAD, top: 2 }}>{h.slot === 'left' ? 'Left hand' : 'Right hand'}</div>
        <div className="s13 dim nowrap" style={{ left: PAD, top: 18 }}>{h.slot === 'left' ? 'weapon' : 'off-hand'}</div>
        <div className={`fco__well${take ? ' take' : ''}`} style={{ left: PAD, top: 40 }}>
          {take && holding !== null ? <KIcon name={holding.icon} /> : h.item !== null ? <KIcon name={h.item.icon} /> : <i className="fco__none" />}
        </div>
        {holding === null ? (
          <>
            {h.lockedBy !== null ? (
              <>
                <div className="s18 faint nowrap" style={{ left: PAD + 82, top: 38 }}>held shut</div>
                <div className="s13 dim nowrap" style={{ left: PAD + 82, top: 62 }}>the {h.lockedBy} takes both hands</div>
              </>
            ) : h.item === null ? (
              <>
                <div className="s18 faint nowrap" style={{ left: PAD + 82, top: 38 }}>empty</div>
                <div className="s13 dim nowrap" style={{ left: PAD + 82, top: 62 }}>{first === undefined ? 'nothing in the satchel fits this hand' : 'the satchel has something for it'}</div>
                {first !== undefined && <FBtn onPress={() => setHeld({ key: first.key, slot: h.slot })} testId={`try-${h.slot}`} style={{ position: 'absolute', left: PAD + 82, top: 114 }}>Try the {first.name}</FBtn>}
              </>
            ) : (
              <>
                <div className="s18 bone nowrap" style={{ left: PAD + 82, top: 38 }}>{h.item.name}</div>
                <div className="s13 dim nowrap" style={{ left: PAD + 82, top: 62 }}>{h.item.words} · {h.item.rarity}</div>
                <div className="nowrap" style={{ left: PAD + 82, top: 114 }}>
                  <FBtn disabledReason={h.unequipReason} onPress={() => dispatch({ type: 'run/unequip', unitId: u!.id, slot: h.slot })} testId={`unequip-${h.slot}`}>Put away</FBtn>
                  <FBtn disabledReason={first === undefined ? 'nothing in the satchel fits this hand' : null} onPress={() => { if (first !== undefined) setHeld({ key: first.key, slot: h.slot }) }} testId={`change-${h.slot}`} style={{ marginLeft: 10 }}>Change</FBtn>
                </div>
              </>
            )}
            {h.item !== null && h.cards.length > 0 && (
              <>
                <div className="s13 ochre nowrap" style={{ left: cardsX, top: 36 }}>brings {h.cards.length} {h.cards.length === 1 ? 'card' : 'cards'}</div>
                {h.cards.slice(0, h.cards.length > 5 ? 4 : 5).map((c, i) => <CardRow key={c.key} c={c} x={cardsX} y={58 + i * 22} w={cardsW} />)}
                {h.cards.length > 5 && <div className="s13 dim nowrap" style={{ left: cardsX + 42, top: 58 + 4 * 22 + 2 }}>and {h.cards.length - 4} more, on the deck's page</div>}
              </>
            )}
            {h.item === null && h.fits.length > 0 && (
              <>
                <div className="s13 ochre nowrap" style={{ left: cardsX, top: 36 }}>in the satchel, for this hand</div>
                {h.fits.slice(0, 2).map((f, i) => (
                  <button key={f.key} type="button" className="row fchoice fco__fit" style={{ left: cardsX - 8, top: 56 + i * 46, width: cardsW + 8, height: 44 }} onClick={() => setHeld({ key: f.key, slot: h.slot })} data-item={f.id} data-testid={`fit-${h.slot}-${f.id}`}>
                    <KIcon name={f.icon} style={{ position: 'absolute', left: 8, top: 4 }} />
                    <span className="abs s15 bone nowrap" style={{ left: 40, top: 3 }}>{f.name}</span>
                    <span className="abs s13 dim nowrap" style={{ left: 40, top: 22 }}>{f.words} · {f.rarity}</span>
                    <span className="abs s14 bone nowrap" style={{ right: 8, top: 4 }}>brings {f.cards} {f.cards === 1 ? 'card' : 'cards'}</span>
                  </button>
                ))}
                {h.fits.length > 2 && <div className="s13 dim nowrap" style={{ left: cardsX, top: 150 }}>and {h.fits.length - 2} more: Try one, then pick another in the satchel</div>}
              </>
            )}
          </>
        ) : h.plan !== null && h.plan.ok && isTarget ? (
          <>
            <div className="s18 straw nowrap" style={{ left: PAD + 82, top: 38 }}>the {holding.name} goes here</div>
            <div className="s13 ochre nowrap" style={{ left: PAD + 82, top: 62 }}>
              {h.plan.cards.length === 0 ? 'brings no cards of its own' : `brings ${h.plan.cards.length} ${h.plan.cards.length === 1 ? 'card' : 'cards'}`}
              {h.plan.back.length > 0 && <span className="dim"> · the {h.plan.back.join(' and the ')} {h.plan.back.length === 1 ? 'goes' : 'go'} back to the satchel</span>}
            </div>
            {h.plan.cards.slice(0, h.plan.cards.length > 4 ? 3 : 4).map((c, i) => <CardRow key={c.key} c={c} x={cardsX} y={82 + i * 20} w={cardsW} />)}
            {h.plan.cards.length > 4 && <div className="s13 dim nowrap" style={{ left: cardsX + 42, top: 82 + 3 * 20 + 2 }}>and {h.plan.cards.length - 3} more</div>}
          </>
        ) : (
          <>
            <div className={`s18 nowrap ${h.item === null ? 'faint' : 'bone'}`} style={{ left: PAD + 82, top: 38 }}>{h.lockedBy !== null ? 'held shut' : h.item === null ? 'empty' : h.item.name}</div>
            {h.plan !== null && !h.plan.ok
              ? <div className="why" style={{ left: PAD + 82, top: 64, width: IW - 82, whiteSpace: 'normal' }} data-testid={`hand-why-${h.slot}`}>{h.plan.reason}</div>
              : (
                <>
                  <div className="s13 dim nowrap" style={{ left: PAD + 82, top: 62 }}>
                    {target?.plan?.ok === true && h.item !== null && target.plan.back.includes(h.item.name) ? 'goes back to the satchel' : h.item === null ? 'stays empty' : 'stays where it is'}
                  </div>
                  {h.plan !== null && h.plan.ok && <FBtn onPress={() => setHeld({ key: holding.key, slot: h.slot })} testId={`aim-${h.slot}`} style={{ position: 'absolute', left: PAD + 82, top: 114 }}>Here instead</FBtn>}
                </>
              )}
          </>
        )}
      </div>
    )
  }

  // ---- the deck's faces, grouped by where the cards come from
  const deckBody: React.ReactNode[] = []
  if (u !== null && tab === 'deck' && holding === null) {
    const per = Math.max(1, Math.floor((IW + 12) / 160))
    const rows = u.groups.reduce((n, g) => n + Math.ceil(g.cards.length / per), 0)
    // faces while they fit the sheet: tall for two rows, short for three; a deck of more is read as lines
    const mode: 'tall' | 'short' | 'lines' = rows <= 2 ? 'tall' : rows === 3 ? 'short' : 'lines'
    const ch = mode === 'tall' ? CARD_TALL : CARD_SHORT
    let y = mode === 'lines' ? 140 : 148
    for (const g of u.groups) {
      deckBody.push(<SectionHead key={`h-${g.source}`} x={PAD} y={y} w={IW} heading={g.label} note={`${g.cards.length} ${g.cards.length === 1 ? 'card' : 'cards'}`} />)
      y += mode === 'lines' ? 30 : 36
      if (mode === 'lines') {
        g.cards.forEach((c, i) => deckBody.push(<CardRow key={c.key} c={c} x={PAD} y={y + i * 21} w={IW} />))
        y += g.cards.length * 21 + 8
      } else {
        g.cards.forEach((c, i) => deckBody.push(<CardFace key={c.key} c={c} x={PAD + (i % per) * 160} y={y + Math.floor(i / per) * (ch + 10)} tall={mode === 'tall'} />))
        y += Math.ceil(g.cards.length / per) * (ch + 10) + (g.cards.length === 0 ? 4 : 6)
      }
    }
    deckBody.push(<div key="sum" className="s14 bone nowrap" style={{ left: PAD, top: Math.min(y + 4, SH - 38) }} data-testid="deck-sum">{u.deckSize} cards. Up to {view.handSize} are drawn each turn.</div>)
  }

  return (
    <div className="f64 fmodal fco" data-testid="loadout" data-tab={tab} data-holding={holding !== null ? 'yes' : 'no'}>
      <div className="fmodal__scrim" onClick={() => { if (holding !== null) setHeld(null); else close() }} />
      <div className="fco__deep" aria-hidden />

      <Win x={EDGE} y={EDGE} w={318} h={134}>
        <div className="s13 dim nowrap" style={{ left: PAD, top: 14 }}>{view.place}</div>
        <div className="tt" style={{ left: PAD, top: 32 }}>The Company</div>
        <div className="frule" style={{ left: PAD, top: 86, width: 278 }} />
        <FChoice x={PAD - 8} y={94} w={286} label={holding !== null ? 'Put it back' : view.back} keyHint="Esc" onPress={() => { if (holding !== null) setHeld(null); else close() }} testId="loadout-close" />
      </Win>

      {u !== null && u.sprite !== null && fig !== undefined && (
        <img className="fco__art" src={`/sprites/units/${u.sprite}.png`} alt="" draggable={false} width={Math.round(832 * scale)} height={Math.round(1216 * scale)} style={{ left: Math.round(173 - (scale * (fig[0] + fig[2])) / 2), top: Math.round(706 - scale * fig[3]) }} data-testid="person-art" />
      )}

      {u !== null && (
        <Win x={SX} y={EDGE} w={SW} h={SH} testId="person-sheet">
          <div className="s20 straw nowrap" style={{ left: PAD, top: 16 }} data-testid="person-name">{u.name}</div>
          <div className="s14 dim nowrap" style={{ left: PAD, top: 44 }} data-testid="person-sub">{u.sub}</div>
          <div className="fco__strip" style={{ right: PAD, top: 12 }}>
            {view.faces.length > 1 && <Key>Q</Key>}
            {view.faces.map((f) => <Face key={f.id} f={f} size={fsize} on={f.id === u.id} onPress={() => setUnitId(f.id)} />)}
            {view.faces.length > 1 && <Key>E</Key>}
          </div>

          <div className="tabs" style={{ left: PAD, top: 80, width: IW }} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'kit' || holding !== null} className={`tab${holding !== null ? ' dis' : tab === 'kit' ? ' sel' : ''}`} onClick={() => { if (holding === null) setTab('kit') }} data-testid="tab-kit">Kit</button>
            <button type="button" role="tab" aria-selected={tab === 'deck' && holding === null} aria-disabled={holding !== null || undefined} className={`tab${holding !== null ? ' dis' : tab === 'deck' ? ' sel' : ''}`} onClick={() => { if (holding === null) setTab('deck') }} data-testid="tab-deck">Deck<span className={`key${holding !== null ? ' off' : ''}`} style={{ marginLeft: 9 }}>D</span></button>
          </div>
          {holding !== null && cannot.length > 0 && (
            <div className="why fco__cardtitle" style={{ right: PAD, top: 92, maxWidth: IW - 190 }} data-testid="held-cannot">
              {cannot.length === 1 ? `${cannot[0]!.name}: ${cannot[0]!.cannot}` : `${cannot.length} of ${view.faces.length} cannot carry it`}
            </div>
          )}

          {(tab === 'kit' || holding !== null) && (
            <>
              {u.hands.map((h, i) => band(h, 134 + i * 182))}
              <div className="fgroove" style={{ left: PAD, top: 304, width: IW }} />
              <div className="fgroove" style={{ left: PAD, top: 486, width: IW }} />
              {holding === null ? (
                <>
                  <SectionHead x={PAD} y={500} w={420} heading="Health and stats" />
                  <div className="s18 bone nowrap" style={{ left: PAD, top: 534 }}>{u.hp}/{u.max}</div>
                  <div className="s13 dim nowrap" style={{ left: PAD + 74, top: 538 }}>hp</div>
                  <Gauge x={PAD + 104} y={541} w={316} h={9} value={u.hp} max={u.max} />
                  {u.stats.map((st, i) => (
                    <React.Fragment key={st.label}>
                      <div className="s13 dim nowrap" style={{ left: PAD + i * 60, top: 568, width: 60, textAlign: 'center' }}>{st.label}</div>
                      <div className="s18 bone nowrap" style={{ left: PAD + i * 60, top: 584, width: 60, textAlign: 'center' }}>{st.value}</div>
                    </React.Fragment>
                  ))}
                  <SectionHead x={PAD + 460} y={500} w={IW - 460} heading="The deck" note={`${u.deckSize} cards`} />
                  <div className="s15 bone nowrap" style={{ left: PAD + 460, top: 536 }}>Up to {view.handSize} of them are drawn each turn.</div>
                  <FChoice x={PAD + 452} y={566} w={IW - 452} label={`See the ${u.deckSize} cards`} keyHint="D" onPress={() => setTab('deck')} testId="deck" />
                </>
              ) : (
                <>
                  <div className="s16 ochre nowrap" style={{ left: PAD, top: 510 }}>The deck</div>
                  {view.project !== null
                    ? (
                      <>
                        <div className="nowrap" style={{ left: PAD + 86, top: 506 }} data-testid="deck-project"><Numeral text={view.project.before === view.project.after ? String(view.project.after) : `${view.project.before} → ${view.project.after}`} label={`${view.project.before} cards now, ${view.project.after} after`} /><span className="s13 dim" style={{ marginLeft: 8 }}>cards</span></div>
                        <div className="s13 dim nowrap fco__cardtitle" style={{ left: PAD, top: 542, width: IW }}>{view.project.parts}</div>
                      </>
                    )
                    : <div className="s14 dim nowrap" style={{ left: PAD + 86, top: 512 }}>{u.deckSize} cards, as it stands</div>}
                  <div className="nowrap" style={{ right: PAD, top: 574 }}>
                    {target !== null && target.plan !== null && target.plan.ok
                      ? <><span style={{ marginRight: 12 }}><Key>Enter</Key></span><FBtn variant="primary" onPress={equip} testId={`equip-${slot}`}>Put it in the {HAND_WORD[slot]} hand</FBtn></>
                      : <span className="s14 dim">{u.name} cannot take the {holding.name}. <Key>Q</Key> <Key>E</Key> to ask the others.</span>}
                  </div>
                </>
              )}
            </>
          )}
          {deckBody}
        </Win>
      )}

      {holding !== null && (
        <Win x={SX + NARROW + 14} y={EDGE} w={390} h={332} testId="satchel">
          <SectionHead x={PAD} y={13} w={350} heading="The satchel" note={`${view.bag.free} squares free`} />
          <div className="fbag" style={{ left: Math.round((390 - view.bag.w * CELL) / 2), top: 46, width: view.bag.w * CELL, height: view.bag.h * CELL }}>
            {Array.from({ length: view.bag.w * view.bag.h }, (_, i) => <i key={i} className="fbag__cell" style={{ left: (i % view.bag.w) * CELL, top: Math.floor(i / view.bag.w) * CELL }} />)}
            {view.bag.items.map((o) => (
              <button key={o.key} type="button" className={`fbag__item${holding.key === o.key ? ' sel' : ''}${o.gear ? '' : ' fco__notgear'}`} style={{ left: o.x * CELL + 2, top: o.y * CELL + 2, width: o.w * CELL - 4, height: o.h * CELL - 4 }} aria-label={o.name} aria-pressed={holding.key === o.key} aria-disabled={!o.gear || undefined} onClick={() => { if (o.gear) setHeld({ key: o.key, slot }) }} data-item={o.itemId} data-testid={`bag-${o.key.replace(',', '-')}`}>
                <KIcon name={o.icon} />
                {o.charges !== null && <span className="fbag__n s13 bone">×{o.charges}</span>}
              </button>
            ))}
          </div>
          <div className="fgroove" style={{ left: PAD, top: 46 + view.bag.h * CELL + 12, width: 350 }} />
          <div className="s13 dim nowrap" style={{ left: PAD, top: 46 + view.bag.h * CELL + 22 }}>Holding</div>
          <KIcon name={holding.icon} style={{ position: 'absolute', left: PAD, top: 46 + view.bag.h * CELL + 44 }} />
          <div className="s16 straw nowrap" style={{ left: PAD + 32, top: 46 + view.bag.h * CELL + 42 }} data-testid="held-name">{holding.name}</div>
          <div className="s13 dim nowrap" style={{ left: PAD + 32, top: 46 + view.bag.h * CELL + 62 }}>{holding.words} · {holding.rarity}</div>
        </Win>
      )}
    </div>
  )
}
