/**
 * ui/combat/CombatScreen.tsx — the battle surface: Board + tokens, hand, HUD, play panel, tutorial. Input has ONE
 * owner each: board clicks and the drag gesture here, Esc/right-click cancel here, Tab toggles the danger union here.
 * The click model is pin-then-confirm (brief §2.8): pick a card → red targets → click one to pin → the play panel →
 * Confirm (or click the pinned tile again). The panel appears for EVERY pinned play, forecast or not. The same cards
 * can be dragged onto a target (StS) and the active unit can be dragged to a blue tile (FE chess-drag). Move: the
 * Move button or clicking the active unit → blue range → click a tile. Capture: the Capture button → click an
 * adjacent foe the gate allows (the % is on the token). Effects become transient floats; the effect listener returns
 * a promise so the pump scheduler waits for them.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import '../../styles/combat.css'
import { captureChance, captureContext } from '../../engine/combat/capture'
import { forecast } from '../../engine/combat/damage'
import { manhattan, reachable, tilesInAoe } from '../../engine/combat/grid'
import { dangerUnion, legalTargets, recipients } from '../../engine/combat/targeting'
import { tutorialStep } from '../../engine/combat/tutorial'
import type { Effect } from '../../engine/effects'
import { overlayOf } from '../../engine/flow/pump'
import { displayName } from '../../engine/run/party'
import type { Card, CardEffect, CombatUnit, GameState, ItemId, TileKey } from '../../engine/types'
import { clientToStage } from '../StageView'
import { dispatch, getState, useEffects, useEnv, useGame } from '../store'
import { Board, type BoardOverlays, type FloatText } from './Board'
import { CardHand, cardIntentLines } from './CardHand'
import { boardView, tileAtStagePoint } from './geometry'
import { extend, type ChronicleLine } from './chronicle'
import { Chronicle, Commands, CompanyRail, FoeRoll, HeraldPlaque, InitiativeStrip, PlayPanel, TutorialHint, type PlayPreview, type VictimRow } from './Hud'
import type { TokenExtras } from './UnitToken'

/** How long a damage number DWELLS. Reduced motion drops the animation, never the number (the float is information,
 *  not decoration); only the explicit `?motion=0` dev/e2e flag zeroes the dwell so tests never wait on it. */
const FLOAT_MS = 700
const floatDwell = (): number => (typeof location !== 'undefined' && new URLSearchParams(location.search).get('motion') === '0' ? 0 : FLOAT_MS)
/** Pointer travel (client px) that turns a press into a drag; below it the gesture is an ordinary click. */
const DRAG_SLOP = 6

/**
 * Floats live OUTSIDE the component. A victory flips `screen` to `battleEnd` in the same dispatch that lands the
 * killing blow, and `App.tsx` swaps `<CombatScreen/>` for a fragment — which remounts this component. Component
 * state would drop the last hit's number before it ever painted, and CONTRACT §7 wants exactly that number playing
 * on the read-only field under the Field Report.
 */
let floatStore: readonly FloatText[] = []
let floatSeq = 0
const floatSubs = new Set<() => void>()
const readFloats = (): readonly FloatText[] => floatStore
function subscribeFloats(fn: () => void): () => void {
  floatSubs.add(fn)
  return () => { floatSubs.delete(fn) }
}
function publishFloats(next: readonly FloatText[]): void {
  floatStore = next
  for (const fn of [...floatSubs]) fn()
}

/** The chronicle lives beside the floats and for the same reason: it must outlive the remount a victory causes,
 *  so the last blow of the battle is still readable on the field under the Field Report. */
let logStore: readonly ChronicleLine[] = []
let logSeq = 0
let logBattle: string | null = null
const logSubs = new Set<() => void>()
const readLog = (): readonly ChronicleLine[] => logStore
function subscribeLog(fn: () => void): () => void {
  logSubs.add(fn)
  return () => { logSubs.delete(fn) }
}
function publishLog(next: readonly ChronicleLine[]): void {
  logStore = next
  for (const fn of [...logSubs]) fn()
}

function captureLabel(combat: NonNullable<GameState['combat']>, attackerId: string, targetId: string, env: ReturnType<typeof useEnv>): string {
  const ctx = captureContext(combat, attackerId, targetId, env)
  const target = combat.units[targetId]
  return target === undefined ? '' : `${Math.round(captureChance(target, ctx.supportingAllies, ctx.bountyHunter, env) * 100)}%`
}
const EMPTY: ReadonlySet<TileKey> = new Set()

/** The effect the play panel is "about": damage first, then healing, then whatever the card leads with. */
function primaryEffect(card: Card): CardEffect | undefined {
  return card.effects.find((e) => e.kind === 'Damage') ?? card.effects.find((e) => e.kind === 'Heal') ?? card.effects[0]
}

const selectCombat = (s: GameState) => ({ combat: s.combat, run: s.run, view: boardView(s), showDanger: s.ui.showDanger, screen: s.screen.kind, overlay: overlayOf(s)?.kind ?? null })
const eq = (a: ReturnType<typeof selectCombat>, b: ReturnType<typeof selectCombat>): boolean =>
  a.combat === b.combat && a.run === b.run && a.showDanger === b.showDanger && a.screen === b.screen && a.view?.source === b.view?.source && a.overlay === b.overlay

interface DragState {
  readonly kind: 'card' | 'move'
  readonly cardUid: string | null
  readonly label: string
  readonly at: { readonly x: number; readonly y: number }
  readonly over: TileKey | null
}

export function CombatScreen(): React.JSX.Element | null {
  const env = useEnv()
  const { combat, run, view, showDanger, screen, overlay } = useGame(selectCombat, eq)
  const [hover, setHover] = useState<TileKey | null>(null)
  const floats = useSyncExternalStore(subscribeFloats, readFloats, readFloats)
  const log = useSyncExternalStore(subscribeLog, readLog, readLog)
  const [drag, setDrag] = useState<DragState | null>(null)

  // ── effects → floats (the listener's promise holds the next pump until the float has played) ──
  const onEffects = useCallback((effects: readonly Effect[]): Promise<void> | void => {
    const next: FloatText[] = []
    const push = (tile: TileKey | null, text: string, tone: FloatText['tone'], dy = 0): void => {
      if (tile !== null) next.push({ id: ++floatSeq, tile, text, tone, dy })
    }
    const tileOf = (unitId: string): TileKey | null => {
      const c = getState().combat
      const u = c?.units[unitId]
      return u?.position ?? u?.lastTile ?? null
    }
    // the chronicle reads the same batch: one account of the battle, built from the reducer's own effects
    const s = getState()
    const nameOf = (unitId: string): string => {
      const u = s.combat?.units[unitId]
      if (u === undefined) return 'someone'
      return s.run === null ? u.name : displayName(u, s.run)
    }
    if (s.combat !== null && s.combat.battleId !== logBattle) { logBattle = s.combat.battleId; logStore = [] }
    const grown = extend(logStore, effects, {
      unit: nameOf,
      card: (cardId) => env.content.cards[cardId]?.name ?? 'a card',
      item: (itemId) => env.content.items[itemId]?.name ?? 'a thing',
    }, logSeq)
    logSeq = grown.seq
    if (grown.log !== logStore) publishLog(grown.log)
    for (const e of effects) {
      if (e.kind === 'unitHit') {
        push(e.tile ?? tileOf(e.unitId), e.hpLost > 0 ? `−${e.hpLost}` : e.armorLost > 0 ? `−${e.armorLost} armor` : '0', e.hpLost > 0 ? 'hit' : 'armor')
      } else if (e.kind === 'unitHealed') {
        push(tileOf(e.unitId), `+${e.amount}`, 'heal')
      } else if (e.kind === 'statusApplied') {
        push(tileOf(e.unitId), e.status, 'status')
      } else if (e.kind === 'armorGranted' && e.amount > 0) {
        push(tileOf(e.unitId), `+${e.amount} armor`, 'armor')
      } else if (e.kind === 'captureRolled' && !e.success) {
        // A failed capture spent 2 AP and a roll: the AP pips must not be the only channel that says so.
        push(tileOf(e.targetId), 'ESCAPED', 'miss')
        // the captor's cost sits BELOW his feet: the target's 'ESCAPED' owns the line above
        push(tileOf(e.attackerId), `−${env.rules.combat.capture.apCost} AP`, 'armor', 0.9)
      } else if (e.kind === 'unitCaptured') {
        push(e.tile, 'TAKEN', 'status')
      } else if (e.kind === 'unitDied') {
        push(e.tile, 'SLAIN', 'hit')
      }
    }
    if (next.length === 0) return
    publishFloats([...floatStore, ...next])
    const ms = floatDwell()
    return new Promise((resolve) => {
      window.setTimeout(() => {
        publishFloats(floatStore.filter((x) => !next.some((n) => n.id === x.id)))
        resolve()
      }, ms)
    })
  }, [env])
  useEffects(onEffects)

  const cards = env.content.cards as Readonly<Record<string, Card>>
  const live = combat !== null && screen === 'combat' && combat.phase === 'combat'
  const activeId = live ? combat.turn.unitId : null
  const active = activeId === null || combat === null ? null : combat.units[activeId] ?? null
  const partyTurn = active !== null && active.team === 'party'
  const selection = live && combat !== null ? combat.selection : { kind: 'idle' as const }
  const selectedUid = selection.kind === 'card' ? selection.cardUid : null

  // ── keys: Esc backs out ONE level, Tab toggles the danger union ──
  // Escape is the same shortcut everywhere in the game: it undoes the last thing you opened, and when there is
  // nothing to undo it opens the menu. On the board that means a pinned play / an armed verb first and the pause
  // card second — so the battle is no longer the one screen a run cannot be saved from, and the HUD's Menu chip
  // wears the same `ESC` keycap as the band's and the Field Report's (RE-GATE C 3.13). The decision lives HERE
  // and not in `ui/modals`, because two window listeners racing for one key is how a key gets two owners: the
  // modal layer's `PAUSABLE` deliberately does not name `combat`.
  // Both are gated on a LIVE battle: `CombatScreen` also renders under the Field Report (App.tsx), where a global
  // Tab/Esc grab stole focus movement and blocked the modal layer's own Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const s = getState()
      if (!(s.screen.kind === 'combat' && s.combat !== null && s.combat.phase === 'combat')) return
      if (s.ui.modal !== null) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (s.combat.selection.kind === 'idle') dispatch({ type: 'ui/openModal', modal: { kind: 'pause' } })
        else dispatch({ type: 'combat/cancel' })
      }
      // Tab is the danger key only in the NEUTRAL state — nothing focused (brief §2.8). The moment focus is on a
      // control, Tab is the browser's again, so the hand, the commands and Confirm are all keyboard-reachable
      // (brief §5 rule 5); Shift+Tab is never taken, so it is the way IN to the chrome from a bare board.
      if (e.key === 'Tab' && !e.shiftKey && (document.activeElement === null || document.activeElement === document.body)) {
        e.preventDefault()
        dispatch({ type: 'ui/toggleDanger' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selectedCard = useMemo(() => {
    if (combat === null || activeId === null || selection.kind !== 'card') return null
    const inst = combat.decks[activeId]?.cards[selection.cardUid]
    return inst === undefined ? null : { card: cards[inst.cardId] ?? null, mod: inst.mod }
  }, [combat, activeId, selection, cards])

  const card = selectedCard?.card ?? null
  const selfPlayable = card !== null && (card.targetKind === 'self' || card.targetKind === 'all_enemies' || card.targetKind === 'all_allies')
  const pinnedTile = selection.kind === 'card' ? selection.pinnedTile : null

  // Capture: only foes the UX gate lists are offered (`rules.combat.capture.uiHpGate`); the rest get a muted note
  // rather than a red target, so 2 AP never goes on a 25 % roll by accident.
  const captureSets = useMemo(() => {
    if (combat === null || !live || active === null || active.position === null || selection.kind !== 'capture') return { offered: EMPTY, tooStrong: EMPTY }
    const gate = env.rules.combat.capture.uiHpGate
    const offered = new Set<TileKey>()
    const tooStrong = new Set<TileKey>()
    for (const u of Object.values(combat.units)) {
      if (u.team === 'enemy' && u.position !== null && u.hp.current > 0 && !u.captured && manhattan(u.position, active.position) === 1) {
        if (u.hp.current / Math.max(1, u.hp.max) <= gate) offered.add(u.position)
        else tooStrong.add(u.position)
      }
    }
    return { offered, tooStrong }
  }, [combat, live, active, selection, env])

  const overlays = useMemo((): BoardOverlays => {
    if (combat === null || !live || activeId === null) return { reach: EMPTY, reachMode: false, targets: EMPTY, targetTone: 'foe', aoe: EMPTY, danger: EMPTY, pinned: null, hover: null, dragOver: null }
    const reach = partyTurn && (selection.kind === 'idle' || selection.kind === 'move') && active !== null && !active.hasMovedThisTurn ? new Set(Object.keys(reachable(combat, activeId))) : EMPTY
    const targets = selection.kind === 'card' && card !== null ? new Set(legalTargets(combat, activeId, card, env))
      : selection.kind === 'capture' ? captureSets.offered
        : EMPTY
    const aim = drag?.over ?? hover
    const aoeCentre = pinnedTile ?? (selection.kind === 'card' && aim !== null && targets.has(aim) ? aim : null)
    const aoe = aoeCentre !== null && card !== null && (card.aoeRadius ?? 0) > 0 ? new Set(tilesInAoe(combat.grid, aoeCentre, card.aoeRadius ?? 0)) : EMPTY
    const danger = showDanger ? new Set(dangerUnion(combat, env)) : EMPTY
    // threat-red is the game's danger hue; a heal or a ward offers its tiles in the mending hue instead
    const targetTone: BoardOverlays['targetTone'] =
      selection.kind === 'card' && card !== null && (card.targetKind === 'ally' || card.targetKind === 'all_allies' || card.targetKind === 'self') ? 'ally' : 'foe'
    return { reach, reachMode: selection.kind === 'move', targets, targetTone, aoe, danger, pinned: pinnedTile, hover, dragOver: drag?.over ?? null }
  }, [combat, live, activeId, partyTurn, selection, card, pinnedTile, hover, drag, showDanger, env, active, captureSets])

  const pinnedUnit = combat !== null && pinnedTile !== null ? Object.values(combat.units).find((u) => u.position === pinnedTile && u.hp.current > 0) ?? null : null
  const pinnedForecast = combat !== null && activeId !== null && pinnedUnit !== null && card !== null ? forecast(combat, activeId, { card, mod: selectedCard?.mod ?? null }, pinnedUnit.id, env) : null

  /** Everyone the play lands on — an AoE forecast that describes ONE victim understates the play (and hides that
   *  different targets take different damage, because DR differs). */
  const struck = useMemo((): readonly CombatUnit[] => {
    if (combat === null || activeId === null || card === null) return []
    if (!(pinnedTile !== null || selfPlayable)) return []
    const eff = primaryEffect(card)
    return eff === undefined ? [] : recipients(combat, activeId, pinnedTile, card, eff.target)
  }, [combat, activeId, card, pinnedTile, selfPlayable])

  const preview = useMemo((): PlayPreview | null => {
    if (combat === null || activeId === null || active === null || card === null) return null
    if (!(pinnedTile !== null || selfPlayable)) return null
    const nameOf = (u: CombatUnit): string => (run === null ? u.name : displayName(u, run))
    const centreId = pinnedForecast?.redirectedTo ?? pinnedUnit?.id ?? null
    const centre = centreId === null ? null : combat.units[centreId] ?? pinnedUnit
    const victims: VictimRow[] = []
    for (const u of struck) {
      if (u.id === centreId) continue
      const f = forecast(combat, activeId, { card, mod: selectedCard?.mod ?? null }, u.id, env)
      if (f === null) continue
      victims.push({ unitId: u.id, name: nameOf(u), hpBefore: u.hp.current, hpAfter: f.predictedHp, hpMax: u.hp.max, lethal: f.lethal })
    }
    const spread = (card.aoeRadius ?? 0) > 0 || card.targetKind === 'all_enemies' || card.targetKind === 'all_allies'
    return {
      cardName: card.name,
      attackerName: nameOf(active),
      forecast: pinnedForecast,
      targetName: centre === null ? null : nameOf(centre),
      targetHp: centre?.hp ?? null,
      targetArmor: centre?.armor ?? 0,
      victims,
      // the intent lines quote the same POWER the card face does — the base alone was the number nobody plays with
      intent: cardIntentLines(card, active, selectedCard?.mod ?? null),
      emptyBlast: spread && struck.length === 0,
    }
  }, [combat, activeId, active, card, pinnedTile, selfPlayable, pinnedUnit, pinnedForecast, struck, run, env, selectedCard])

  const extras = useMemo((): Readonly<Record<string, TokenExtras>> => {
    const out: Record<string, TokenExtras> = {}
    if (combat === null) return out
    const aimed = new Set<string>(struck.map((u) => u.id))
    if (pinnedUnit !== null) aimed.add(pinnedUnit.id)
    if (pinnedForecast?.redirectedTo != null) aimed.add(pinnedForecast.redirectedTo)
    for (const u of Object.values(combat.units)) {
      const capture = selection.kind === 'capture' && activeId !== null && u.team === 'enemy' && u.position !== null && captureSets.offered.has(u.position) ? captureLabel(combat, activeId, u.id, env) : undefined
      const tooStrong = selection.kind === 'capture' && u.position !== null && captureSets.tooStrong.has(u.position)
      out[u.id] = {
        displayName: run === null ? u.name : displayName(u, run),
        pinnedTarget: aimed.has(u.id),
        ...(capture === undefined ? {} : { badge: capture }),
        ...(tooStrong ? { mutedBadge: 'too strong' } : {}),
      }
    }
    return out
  }, [combat, run, pinnedUnit, pinnedForecast, struck, selection, activeId, captureSets, env])

  const confirmPlay = useCallback(() => {
    if (selection.kind !== 'card') return
    dispatch({ type: 'combat/playCard', cardUid: selection.cardUid, tile: selection.pinnedTile })
  }, [selection])

  const onTile = useCallback((tile: TileKey) => {
    if (combat === null || !live || !partyTurn || activeId === null) return
    const occupant = Object.values(combat.units).find((u) => u.position === tile && u.hp.current > 0 && !u.captured) ?? null
    switch (selection.kind) {
      case 'idle':
        if (occupant?.id === activeId) { dispatch({ type: 'combat/enterMove' }); return }
        if (overlays.reach.has(tile)) { dispatch({ type: 'combat/moveUnit', tile }); return }
        return
      case 'move':
        if (overlays.reach.has(tile)) dispatch({ type: 'combat/moveUnit', tile })
        else dispatch({ type: 'combat/cancel' })
        return
      case 'card': {
        if (!overlays.targets.has(tile)) { dispatch({ type: 'combat/cancel' }); return }
        if (selection.pinnedTile === tile) { confirmPlay(); return }
        dispatch({ type: 'combat/pinTarget', tile })
        return
      }
      case 'capture':
        if (occupant !== null && overlays.targets.has(tile)) dispatch({ type: 'combat/capture', targetId: occupant.id })
        else dispatch({ type: 'combat/cancel' })
        return
    }
  }, [combat, live, partyTurn, activeId, selection, overlays, confirmPlay])

  // ── the drag gesture (brief §2.8): one owner, the permitted component-local state (CONTRACT §3) ──
  const gesture = useRef<{ kind: 'card' | 'move'; cardUid: string | null; label: string; x: number; y: number; moved: boolean } | null>(null)
  const dropRef = useRef<(over: TileKey | null, kind: 'card' | 'move', cardUid: string | null) => void>(() => {})
  const pointRef = useRef<(e: { clientX: number; clientY: number }) => TileKey | null>(() => null)
  useEffect(() => {
    pointRef.current = (e) => {
      if (view === null) return null
      const p = clientToStage(e.clientX, e.clientY)
      return p === null ? null : tileAtStagePoint(p.x, p.y, view.grid.width, view.grid.height)
    }
    dropRef.current = (over, kind, cardUid) => {
      if (kind === 'move') {
        if (over !== null && overlays.reach.has(over)) dispatch({ type: 'combat/moveUnit', tile: over })
        else dispatch({ type: 'combat/cancel' })
        return
      }
      if (cardUid === null) return
      if (over !== null && overlays.targets.has(over)) {
        dispatch({ type: 'combat/pinTarget', tile: over })
        dispatch({ type: 'combat/playCard', cardUid, tile: over })
        return
      }
      dispatch({ type: 'combat/cancel' })
    }
  })

  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      const g = gesture.current
      if (g === null) return
      if (!g.moved && Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y) < DRAG_SLOP) return
      if (!g.moved) {
        g.moved = true
        if (g.kind === 'card' && g.cardUid !== null) dispatch({ type: 'combat/selectCard', cardUid: g.cardUid })
        if (g.kind === 'move') dispatch({ type: 'combat/enterMove' })
      }
      const p = clientToStage(e.clientX, e.clientY)
      setDrag({ kind: g.kind, cardUid: g.cardUid, label: g.label, at: p ?? { x: 0, y: 0 }, over: pointRef.current(e) })
    }
    const onUp = (e: PointerEvent): void => {
      const g = gesture.current
      gesture.current = null
      setDrag(null)
      if (g === null || !g.moved) return
      dropRef.current(pointRef.current(e), g.kind, g.cardUid)
      // The click that follows this pointerup would re-enter `onTile` on whatever we dropped on: swallow exactly one.
      window.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault() }, { capture: true, once: true })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const onCardPointerDown = useCallback((uid: string, e: React.PointerEvent) => {
    if (combat === null || !live || !partyTurn || activeId === null) return
    const inst = combat.decks[activeId]?.cards[uid]
    const c = inst === undefined ? undefined : cards[inst.cardId]
    gesture.current = { kind: 'card', cardUid: uid, label: c?.name ?? 'card', x: e.clientX, y: e.clientY, moved: false }
  }, [combat, live, partyTurn, activeId, cards])

  const onTilePointerDown = useCallback((tile: TileKey, e: React.PointerEvent) => {
    if (combat === null || !live || !partyTurn || active === null || activeId === null) return
    if (selection.kind !== 'idle' && selection.kind !== 'move') return
    if (active.position !== tile || active.hasMovedThisTurn) return
    gesture.current = { kind: 'move', cardUid: null, label: run === null ? active.name : displayName(active, run), x: e.clientX, y: e.clientY, moved: false }
  }, [combat, live, partyTurn, active, activeId, selection, run])

  const onSelectCard = useCallback((uid: string) => {
    if (selection.kind === 'card' && selection.cardUid === uid) { dispatch({ type: 'combat/cancel' }); return }
    dispatch({ type: 'combat/selectCard', cardUid: uid })
  }, [selection])

  const playSelfCard = useCallback(() => {
    if (selection.kind !== 'card') return
    dispatch({ type: 'combat/playCard', cardUid: selection.cardUid, tile: selection.pinnedTile })
  }, [selection])

  if (view === null) return null
  const step = combat !== null && live ? tutorialStep(combat) : null
  const showPanel = preview !== null
  const noTargets = selection.kind === 'card' && !selfPlayable && pinnedTile === null && overlays.targets.size === 0 && card !== null
  // Capture with nobody the gate allows: the muted token badge gets a sentence, so the verb is never just inert.
  const noCaptives = selection.kind === 'capture' && captureSets.offered.size === 0

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--iron-800) 0%, var(--iron-900) 70%, var(--color-ash) 100%)' }} data-testid="combat-screen">
      <div className="iron-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <Board view={view} overlays={overlays} extras={extras} floats={floats} onTile={onTile} onHover={setHover} onCancel={() => dispatch({ type: 'combat/cancel' })} onTilePointerDown={onTilePointerDown} />
      {combat !== null && live && (
        <>
          {/* The same chip the band and the Field Report carry, with the same keycap: on an idle board Esc opens
              this card, and with a play pinned or a verb armed Esc cancels that first and opens it on the next
              press. It sits where the map band keeps its menu, and FIRST in the DOM so the Shift+Tab ring into
              the hand and the commands is unchanged. */}
          <button
            type="button"
            className="btn-forged btn-forged--ghost"
            style={{ position: 'absolute', right: 14, top: 14, padding: '0.35rem 0.8rem', fontSize: '0.7rem', zIndex: 12 }}
            onClick={() => dispatch({ type: 'ui/openModal', modal: { kind: 'pause' } })}
            data-testid="combat-menu"
          >
            <span className="keycap">Esc</span>Menu
          </button>
          <InitiativeStrip combat={combat} run={run} />
          <HeraldPlaque combat={combat} run={run} />
          {/* the two columns beside the board: the company on the left, the field on the right. Both carry the
              statuses nothing else on this screen shows; the right one dims (never unmounts) under the play panel. */}
          <CompanyRail combat={combat} run={run} />
          <Chronicle lines={log} />
          <FoeRoll combat={combat} muted={showPanel || (step !== null && overlay === 'tutorial')} />
          <CardHand combat={combat} run={run} cards={cards} selectedUid={selectedUid} onSelect={onSelectCard} onCardPointerDown={onCardPointerDown} />
          {/* The command column is mounted for the whole battle — on the enemy's turn every verb carries "the enemy
              is acting" instead of the column vanishing and taking 165px of stage with it. */}
          <Commands combat={combat} pending={showPanel} armed={selection.kind === 'move' ? 'move' : selection.kind === 'capture' ? 'capture' : null} onMove={() => dispatch({ type: 'combat/enterMove' })} onCapture={() => dispatch({ type: 'combat/enterCapture' })} onItem={(itemId: ItemId) => dispatch({ type: 'combat/useItem', itemId })} />
          {showPanel && preview !== null && (
            <PlayPanel preview={preview} onConfirm={pinnedTile === null ? playSelfCard : confirmPlay} onCancel={() => dispatch({ type: 'combat/cancel' })} confirmLabel={pinnedTile === null ? 'Play' : 'Confirm'} />
          )}
          {step !== null && overlay === 'tutorial' && !showPanel && <TutorialHint step={step} />}
          {noTargets && card !== null && (
            <div className="hand-hint" data-testid="hand-hint">
              {nothingInReach(card.targetKind, card.name, active?.hasMovedThisTurn === true)}
            </div>
          )}
          {noCaptives && (
            <div className="hand-hint" data-testid="capture-hint">
              {captureSets.tooStrong.size > 0 ? 'Still too strong to take alive — wound them first' : 'No foe within arm’s reach to take alive'}
            </div>
          )}
          <div className="danger-chip">
            <button type="button" className="btn-forged btn-forged--ghost" style={{ padding: '0.35rem 0.8rem', fontSize: '0.7rem' }} onClick={() => dispatch({ type: 'ui/toggleDanger' })} aria-pressed={showDanger} data-testid="danger-toggle">
              <span className="keycap">Tab</span>Danger zone {showDanger ? '●' : '○'}
            </button>
          </div>
        </>
      )}
      {drag !== null && (
        <div className="drag-ghost" data-testid="drag-ghost" style={{ left: drag.at.x, top: drag.at.y }} aria-hidden>{drag.label}</div>
      )}
    </div>
  )
}

/** The reason a selected card has nothing to aim at — in the card's OWN terms (a healer with no ally in range must
 *  never be told to close on a foe). */
function nothingInReach(targetKind: Card['targetKind'], name: string, hasMoved: boolean): string {
  const head = targetKind === 'ally' || targetKind === 'all_allies' ? `No ally within reach of ${name}`
    : targetKind === 'tile' ? `Nowhere to place ${name}`
      : `No foe within reach of ${name}`
  return hasMoved ? `${head} — choose another card` : `${head} — move closer first, or choose another card`
}
