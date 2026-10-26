/**
 * combat/cards.ts — play resolution and the exhaustive effect switch (brief §2.3, §7.21).
 *
 * Resolution order (§2.3): refuse if ap < apCost → move the card to discard FIRST → recipients per
 * selector (living unit per tile; AOE expansion; foe/ally split by `team`) → the card's effects in authored
 * order → `quiverEffects(play.mod)` appended and resolved with the same play (foes only) → consume empower
 * → ap −= cost (floor 0) → riposte → deaths → checkEnd.
 * Beneficial riders on enemy-target cards land on `self` (the selector says so explicitly).
 *
 * `Move { distance }` (CONTRACT-CHANGES 0006) — the ONLY effect that moves the source:
 *  - The card's authored `range` is the TARGETING range and already includes the approach; the strike range is
 *    `[range.min, max(1, range.max − Σ Move.distance)]` (Charge 1-3 with Move 2 strikes from 1).
 *  - Resolution: if the target on `play.tile` is already within strike range → no-op. Else the source steps along
 *    `grid.findPath(grid, position, dest, distance, obstacles ∪ occupied)` where `dest` is the nearest reachable
 *    tile (shortest path, then `tileKey` order) within strike range of `play.tile`; emits `unitMoved { from, path }`.
 *  - Does NOT consume the free move (`hasMovedThisTurn` untouched). Immobilized ⇒ no-op.
 *  - `validatePlay` refuses the play (`reasons.NO_WAY_THROUGH`) when the Move cannot bring the target into strike range;
 *    `legalTargets` filters the same way, so a legal play always lands.
 */
import type { Legality, SliceResult } from '../actions'
import type { Card, CardEffect, CardId, CardUid, CombatState, EngineEnv, PlayableCard, QuiverModifier, StatusId, TileKey, UnitId } from '../types'
import type { Effect, UnitHitCause } from '../effects'
import { attackPower, dealDamage, dealFlatDamage, grantArmor } from './damage'
import { drawCards, quiverEffects } from './deck'
import { inBounds, isLiving, isObstacle, manhattan, unitAt } from './grid'
import { unitOrThrow, withDeck, withUnit } from './state'
import { cleanse, consumeEmpower, isImmobilized, mergeStatus } from './statuses'
import {
  A_WALL_THERE, NOT_IN_HAND, NOT_ON_THE_FIELD, NO_FOE_THERE, NO_FRIEND_THERE, NO_TILE_CHOSEN, NO_WAY_THROUGH,
  OFF_THE_FIELD, OUT_OF_REACH, ROOTED, STRIKES_ON_ITS_OWN, USED_ON_ONESELF, needsAp,
} from './reasons'
import { moveDistance, planApproach, recipients } from './targeting'
import { activeUnit, settlePhase } from './turn'

/** The lint's truth table: every field the engine reads per effect kind. A param not listed here fails `lint:content`. */
export const CONSUMED_PARAMS: Readonly<Record<CardEffect['kind'], readonly string[]>> = {
  Damage: ['kind', 'target', 'base', 'damageType', 'armorPiercing'],
  Heal: ['kind', 'target', 'amount'],
  ApplyStatus: ['kind', 'target', 'effectId', 'value', 'turns'],
  RemoveStatus: ['kind', 'target', 'remove', 'amount', 'all'],
  Move: ['kind', 'target', 'distance'],
  GrantArmor: ['kind', 'target', 'amount'],
  DrawCards: ['kind', 'target', 'count', 'gainAp'],
  GainAp: ['kind', 'target', 'amount'],
}

export interface PlaySpec {
  readonly sourceId: UnitId
  readonly card: PlayableCard
  /** null for enemy actions and potions (no card to discard). */
  readonly cardId: CardId | null
  /** null for self / all_* cards and enemy buffs — selectors then centre on the source (`targeting.ts#recipients`). */
  readonly tile: TileKey | null
  /** The hand instance's baked quiver modifier (`CardInstance.mod`); null for enemies and potions. `forecast` takes the same. */
  readonly mod: QuiverModifier | null
  readonly cause: UnitHitCause
}

const OK: Legality = { ok: true }
const no = (reason: string): Legality => ({ ok: false, reason })

/** Hand membership + AP + `validatePlay`. Returns the card def on success. */
export function canPlay(state: CombatState, cardUid: CardUid, tile: TileKey | null, env: EngineEnv): { readonly ok: true; readonly card: Card } | { readonly ok: false; readonly reason: string } {
  const active = activeUnit(state)
  const deck = state.decks[active.id]
  if (deck === undefined || !deck.hand.includes(cardUid)) return { ok: false, reason: NOT_IN_HAND }
  const inst = deck.cards[cardUid]
  if (inst === undefined) throw new Error(`combat/cards: hand holds unknown instance '${cardUid}'`)
  const card = env.content.cards[inst.cardId]
  if (card === undefined) throw new Error(`combat/cards: unknown card '${inst.cardId}'`)
  const legality = validatePlay(state, active.id, card, tile, env)
  return legality.ok ? { ok: true, card } : { ok: false, reason: legality.reason }
}

/** AP, range (manhattan, obstacles excluded), targetKind vs occupant team, Move reachability; all_* need `tile === null`. */
export function validatePlay(state: CombatState, unitId: UnitId, card: PlayableCard, tile: TileKey | null, env: EngineEnv): Legality {
  void env
  const u = state.units[unitId]
  if (u === undefined || u.position === null || !isLiving(u)) return no(NOT_ON_THE_FIELD)
  if (u.ap < card.apCost) return no(needsAp(card.apCost))
  const kind = card.targetKind
  if (kind === 'all_enemies' || kind === 'all_allies') return tile === null ? OK : no(STRIKES_ON_ITS_OWN)
  if (kind === 'self') return tile === null || tile === u.position ? OK : no(USED_ON_ONESELF)
  // A 0-0 range on any other kind (enemy `buff` actions) is "always in range, centred on the actor": tile may be null.
  if (tile === null) return card.range.max === 0 ? OK : no(NO_TILE_CHOSEN)
  if (!inBounds(state.grid, tile)) return no(OFF_THE_FIELD)
  if (isObstacle(state.grid, tile)) return no(A_WALL_THERE)
  const d = manhattan(u.position, tile)
  if (d < card.range.min || d > card.range.max) return no(OUT_OF_REACH)
  const occupant = unitAt(state, tile)
  if (kind === 'enemy' && (occupant === null || occupant.team === u.team)) return no(NO_FOE_THERE)
  if (kind === 'ally' && (occupant === null || occupant.team !== u.team)) return no(NO_FRIEND_THERE)
  if (moveDistance(card) > 0 && planApproach(state, unitId, card, tile) === null) return no(isImmobilized(u) ? ROOTED : NO_WAY_THROUGH)
  return OK
}

/** The player path: `canPlay` → discard → `resolvePlay` → AP. Emits `cardPlayed { cardUid, cardId }`. */
export function playCard(state: CombatState, cardUid: CardUid, tile: TileKey | null, env: EngineEnv): SliceResult<CombatState> {
  const check = canPlay(state, cardUid, tile, env)
  if (!check.ok) return { state, effects: [{ kind: 'refused', action: 'combat/playCard', reason: check.reason }] }
  const active = activeUnit(state)
  const deck = state.decks[active.id]
  const inst = deck?.cards[cardUid]
  if (deck === undefined || inst === undefined) throw new Error(`combat/cards: '${cardUid}' vanished between canPlay and playCard`)
  const card = check.card
  // Discard FIRST (§2.3): the instance leaves the hand before any effect resolves, so a DrawCards rider on the same
  // card can never draw the card being played.
  let st = withDeck(state, active.id, { ...deck, hand: deck.hand.filter((uid) => uid !== cardUid), discard: [...deck.discard, cardUid] })
  const playTile = card.targetKind === 'self' ? null : tile
  const effects: Effect[] = [
    { kind: 'cardPlayed', unitId: active.id, cardUid, cardId: card.id, tile: playTile, apCost: card.apCost },
    { kind: 'sound', cue: 'cardPlay' },
  ]
  const resolved = resolvePlay(st, { sourceId: active.id, card, cardId: card.id, tile: playTile, mod: inst.mod, cause: 'card' }, env)
  st = resolved.state
  effects.push(...resolved.effects)
  // AP −cost AFTER resolution (§2.3 order) — a GainAp rider on the same card lands before the cost, floor 0.
  const after = st.units[active.id]
  if (after !== undefined) {
    const ap = Math.max(0, after.ap - card.apCost)
    if (ap !== after.ap) {
      st = withUnit(st, { ...after, ap })
      effects.push({ kind: 'apChanged', unitId: active.id, ap, delta: ap - after.ap })
    }
  }
  const settled = settlePhase(st, env)
  return { state: settled.state, effects: [...effects, ...settled.effects] }
}

/** The shared resolver for cards, potions and enemy actions (no validation, no AP). */
export function resolvePlay(state: CombatState, play: PlaySpec, env: EngineEnv): SliceResult<CombatState> {
  let st = state
  const effects: Effect[] = []
  for (const effect of play.card.effects) {
    const r = applyEffect(st, play, effect, env)
    st = r.state
    effects.push(...r.effects)
  }
  if (play.mod !== null) {
    const r = applyQuiverRiders(st, play, play.mod, effects, env)
    st = r.state
    effects.push(...r.effects)
  }
  // Empower is spent by the next DAMAGE card (§2.4): every hit above read it through `attackPower`; drop it now.
  if (play.card.effects.some((e) => e.kind === 'Damage')) {
    const source = st.units[play.sourceId]
    if (source !== undefined) {
      const consumed = consumeEmpower(source)
      if (consumed.effects.length > 0) {
        st = withUnit(st, consumed.unit)
        effects.push(...consumed.effects)
      }
    }
  }
  const settled = settlePhase(st, env)
  return { state: settled.state, effects: [...effects, ...settled.effects] }
}

type StatusRider = { readonly effectId: StatusId; readonly value: number; readonly turns: number }

function applyStatusTo(state: CombatState, play: PlaySpec, unitId: UnitId, rider: StatusRider, env: EngineEnv): SliceResult<CombatState> {
  const u = state.units[unitId]
  if (u === undefined || !isLiving(u)) return { state, effects: [] }
  const rule = env.rules.combat.statuses[rider.effectId]
  const statuses = mergeStatus(u.statuses, { id: rider.effectId, stacks: rider.value, turns: rider.turns, expiresAt: rule.expiresAt, sourceId: play.sourceId }, env)
  return {
    state: withUnit(state, { ...u, statuses }),
    effects: [{ kind: 'statusApplied', unitId, status: rider.effectId, stacks: rider.value, turns: rider.turns }],
  }
}

/**
 * Quiver riders (§2.7) resolve after the card's own effects, foes only, FLAT (no stat, no DR — `deck.ts#quiverEffects`).
 * A `target` rider follows the BLOW: it lands on whoever actually took the card's hit on the centre — the protector
 * when Genatsvale redirected it (read off the `unitHit.redirectedFrom` already emitted) — so `forecast`'s number is
 * the number that lands (§2.2). A `ring` rider expands around the centre like any ring selector.
 */
function applyQuiverRiders(state: CombatState, play: PlaySpec, mod: QuiverModifier, prior: readonly Effect[], env: EngineEnv): SliceResult<CombatState> {
  const source = state.units[play.sourceId]
  if (source === undefined) return { state, effects: [] }
  const centre = play.tile ?? source.position
  if (centre === null) return { state, effects: [] }
  const landedOn = new Map<UnitId, UnitId>()
  for (const e of prior) if (e.kind === 'unitHit' && e.redirectedFrom !== null) landedOn.set(e.redirectedFrom, e.unitId)
  let st = state
  const effects: Effect[] = []
  for (const q of quiverEffects(mod)) {
    if (q.target === 'target') {
      const centreUnit = unitAt(st, centre)
      if (centreUnit === null || centreUnit.team === source.team) continue
      const finalId = landedOn.get(centreUnit.id) ?? centreUnit.id
      if (q.kind === 'Damage') {
        const r = dealFlatDamage(st, play.sourceId, finalId, q.base, q.damageType, { armorPiercing: q.armorPiercing === true, cause: 'quiver' }, env)
        st = r.state
        effects.push(...r.effects)
      } else if (q.kind === 'ApplyStatus') {
        const r = applyStatusTo(st, play, finalId, q, env)
        st = r.state
        effects.push(...r.effects)
      }
    } else if (q.target === 'ring' && q.kind === 'Damage') {
      for (const foe of recipients(st, play.sourceId, play.tile, play.card, 'ring')) {
        const r = dealFlatDamage(st, play.sourceId, foe.id, q.base, q.damageType, { armorPiercing: q.armorPiercing === true, cause: 'quiver' }, env)
        st = r.state
        effects.push(...r.effects)
      }
    }
  }
  return { state: st, effects }
}

function healCause(cause: UnitHitCause): 'card' | 'item' | 'enemyAction' {
  if (cause === 'item' || cause === 'enemyAction') return cause
  return 'card'
}

/** One effect, exhaustive `switch (effect.kind)` with the explicit target selector; never a default branch
 *  (TypeScript proves exhaustiveness — a new kind without a case fails to compile). */
export function applyEffect(state: CombatState, play: PlaySpec, effect: CardEffect, env: EngineEnv): SliceResult<CombatState> {
  const targets = recipients(state, play.sourceId, play.tile, play.card, effect.target)
  let st = state
  const effects: Effect[] = []
  switch (effect.kind) {
    case 'Damage': {
      const source = st.units[play.sourceId]
      if (source === undefined) return { state: st, effects }
      // Power is read once, before any hit: a riposte cannot change the attacker's stats mid-swing.
      const power = attackPower(effect.base, play.card.damageStat ?? null, source).total
      for (const t of targets) {
        const r = dealDamage(st, play.sourceId, t.id, power, effect.damageType, { armorPiercing: effect.armorPiercing === true, cause: play.cause, cover: true }, env)
        st = r.state
        effects.push(...r.effects)
      }
      return { state: st, effects }
    }
    case 'Heal': {
      for (const t of targets) {
        const live = st.units[t.id]
        if (live === undefined || !isLiving(live)) continue
        const gained = Math.min(live.hp.max - live.hp.current, effect.amount)
        if (gained <= 0) continue
        st = withUnit(st, { ...live, hp: { ...live.hp, current: live.hp.current + gained } })
        effects.push({ kind: 'unitHealed', unitId: live.id, amount: gained, cause: healCause(play.cause) }, { kind: 'sound', cue: 'heal' })
      }
      return { state: st, effects }
    }
    case 'ApplyStatus': {
      for (const t of targets) {
        const r = applyStatusTo(st, play, t.id, effect, env)
        st = r.state
        effects.push(...r.effects)
      }
      return { state: st, effects }
    }
    case 'RemoveStatus': {
      const amount: number | 'all' = effect.all === true ? 'all' : effect.amount ?? 'all'
      for (const t of targets) {
        const live = st.units[t.id]
        if (live === undefined) continue
        const r = cleanse(live, effect.remove, amount, env)
        if (r.unit !== live) st = withUnit(st, r.unit)
        effects.push(...r.effects)
      }
      return { state: st, effects }
    }
    case 'Move': {
      const source = st.units[play.sourceId]
      if (source === undefined || source.position === null || play.tile === null || !isLiving(source)) return { state: st, effects }
      const plan = planApproach(st, play.sourceId, play.card, play.tile)
      // Already in strike range, immobilized, or nothing reaches ⇒ no-op (`validatePlay` refused the unreachable case).
      if (plan === null || plan.path.length === 0) return { state: st, effects }
      const from = source.position
      // The free move is NOT consumed (`hasMovedThisTurn` untouched) — the approach is part of the card (0006).
      st = withUnit(st, { ...source, position: plan.dest })
      effects.push({ kind: 'unitMoved', unitId: source.id, from, path: plan.path }, { kind: 'sound', cue: 'footsteps' })
      return { state: st, effects }
    }
    case 'GrantArmor': {
      for (const t of targets) {
        const live = st.units[t.id]
        if (live === undefined || !isLiving(live)) continue
        const r = grantArmor(live, effect.amount, env)
        if (r.unit !== live) st = withUnit(st, r.unit)
        effects.push({ kind: 'armorGranted', unitId: live.id, amount: r.unit.armor - live.armor, capped: r.capped })
      }
      return { state: st, effects }
    }
    case 'DrawCards': {
      const source = st.units[play.sourceId]
      if (source === undefined || !isLiving(source)) return { state: st, effects }
      const deck = st.decks[source.id]
      if (deck !== undefined) {
        const drawn = drawCards(deck, effect.count, st.rng)
        const uids = drawn.deck.hand.slice(deck.hand.length)
        st = withDeck({ ...st, rng: drawn.rng }, source.id, drawn.deck)
        if (uids.length > 0) effects.push({ kind: 'cardsDrawn', unitId: source.id, uids, reshuffled: drawn.reshuffled })
      }
      if (effect.gainAp !== undefined && effect.gainAp > 0) {
        const live = unitOrThrow(st, source.id)
        const ap = live.ap + effect.gainAp
        st = withUnit(st, { ...live, ap })
        effects.push({ kind: 'apChanged', unitId: live.id, ap, delta: effect.gainAp })
      }
      return { state: st, effects }
    }
    case 'GainAp': {
      for (const t of targets) {
        const live = st.units[t.id]
        if (live === undefined || !isLiving(live)) continue
        const ap = live.ap + effect.amount
        st = withUnit(st, { ...live, ap })
        effects.push({ kind: 'apChanged', unitId: live.id, ap, delta: effect.amount })
      }
      return { state: st, effects }
    }
  }
}
