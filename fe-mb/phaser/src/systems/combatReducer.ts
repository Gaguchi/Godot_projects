import type { CombatState, CombatEvent, CombatEffect, DeckState } from '../domain/combatState'
import type { Unit } from '../domain/unit'
import type { UnitId, TileId, CardId } from '../domain/ids'
import { asStatusEffectId } from '../domain/ids'
import type { RNG } from '../domain/rng'
import { buildInitiativeQueue } from './turnOrder'
import { getStatusEffect, mergeStatus, isImmobilized, empowerBonus, consumeEmpower } from './statusEffects'
import { isEnemyUnit as isEnemyTeam } from './team'
import { applyDamage } from './damage'
import { createRng } from './rng'

interface UnitTeam { partyIds: UnitId[]; enemyIds: UnitId[] }

export interface ReduceResult {
  state: CombatState
  effects: CombatEffect[]
}

export function initialCombatState(): CombatState {
  return {
    phase: 'BOOT',
    subPhase: 'IDLE',
    turn: { number: 0, unitId: null, team: 'party' },
    units: {},
    decks: {},
    grid: { width: 14, height: 10, obstacles: new Set() },
    rng: { seed: 0, counter: 0 },
    selectedCardId: null,
    pinnedTargetTile: null,
    effectQueue: [],
    battleTag: null,
  }
}

function teamsOf(units: Record<string, Unit>): UnitTeam {
  // Explicit unit.team wins; systems/team.ts keeps the classId fallback for
  // legacy fixtures. (The old inline 'bandit' heuristic missed wolves,
  // brigand chiefs, and the warlord boss.)
  const partyIds: UnitId[] = []
  const enemyIds: UnitId[] = []
  for (const u of Object.values(units)) {
    if (isEnemyTeam(u)) enemyIds.push(u.id)
    else partyIds.push(u.id)
  }
  return { partyIds, enemyIds }
}

function isAlive(u: Unit): boolean { return u.hp.current > 0 }

/** Cards a unit holds at the start of its turn (refill target). */
export const HAND_SIZE = 5

/** Action points restored at the start of every unit's turn. */
export const AP_PER_TURN = 3

/**
 * Draw up to `count` cards from draw→hand, reshuffling the discard pile into
 * the draw pile (deterministically, via rngState) when it runs dry. Returns
 * the new deck + advanced rng state. Pure.
 */
function drawCards(
  deck: DeckState,
  count: number,
  rngState: CombatState['rng'],
): { deck: DeckState; rngState: CombatState['rng'] } {
  let draw = deck.draw.slice()
  let discard = deck.discard.slice()
  const hand = deck.hand.slice()
  let rng = rngState
  for (let i = 0; i < count; i++) {
    if (draw.length === 0 && discard.length > 0) {
      const shuffler = createRng(rng)
      draw = shuffler.shuffle(discard)
      discard = []
      rng = shuffler.state()
    }
    const drawn = draw.shift()
    if (drawn === undefined) break
    hand.push(drawn)
  }
  return { deck: { ...deck, draw, hand, discard }, rngState: rng }
}

function parseTile(t: TileId): { x: number; y: number } {
  const [x, y] = (t as unknown as string).split(',').map(Number)
  return { x: x ?? 0, y: y ?? 0 }
}

/** 4-directional adjacency ("adjacent" in card text = orthogonal neighbors). */
function isAdjacentTile(a: TileId, b: TileId): boolean {
  const pa = parseTile(a)
  const pb = parseTile(b)
  return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y) === 1
}

/** Alive units (other than `exclude`) standing orthogonally adjacent to `tile`. */
function unitsAdjacentTo(
  units: Record<string, Unit>,
  tile: TileId,
  excludeId: UnitId,
): Unit[] {
  return Object.values(units).filter(
    u => u.id !== excludeId && isAlive(u) && u.position !== null && isAdjacentTile(u.position, tile),
  )
}

/**
 * End-of-turn status tick for ONE unit (ship plan §9: DOT fires at the end of
 * the afflicted unit's turn). Applies onTurnEnd damage, decrements durations,
 * drops expired statuses. Pure — returns the updated unit + render effects.
 */
function tickUnitStatuses(unit: Unit): { unit: Unit; effects: CombatEffect[] } {
  if (unit.statuses.length === 0) return { unit, effects: [] }
  const effects: CombatEffect[] = []
  let hp = unit.hp.current
  let armor = unit.armor
  for (const s of unit.statuses) {
    if (s.fresh) continue // bought this turn — exempt from this tick entirely
    const def = getStatusEffect(s.effectId)
    if (!def?.onTurnEnd) continue
    for (const e of def.onTurnEnd({ selfUnitId: unit.id, selfStacks: s.stacks, selfTurnsRemaining: s.turnsRemaining })) {
      if (e.kind !== 'Damage') continue
      if (e.armorPiercing) {
        hp = Math.max(0, hp - e.amount)
      } else {
        const split = applyDamage({ hp: { current: hp, max: unit.hp.max }, armor }, e.amount, e.damageType)
        hp = split.newHp
        armor = split.newArmor
      }
      if (unit.position) {
        effects.push({ kind: 'FloatDamage', tile: unit.position, amount: e.amount, damageKind: e.damageType })
      }
    }
  }
  // A fresh status (self-buff applied during this very turn) spends its
  // exemption instead of a duration point: the flag clears, the counter
  // holds, and normal decrement starts at the NEXT end of turn — after the
  // enemy phase it was meant to cover.
  const remaining = unit.statuses
    .map(s => {
      if (!s.fresh) return { ...s, turnsRemaining: s.turnsRemaining - 1 }
      const { fresh: _spent, ...rest } = s
      return rest
    })
    .filter(s => s.turnsRemaining > 0)
  return {
    unit: { ...unit, hp: { ...unit.hp, current: hp }, armor, statuses: remaining },
    effects,
  }
}

function checkEnd(state: CombatState): CombatState['phase'] {
  const { partyIds, enemyIds } = teamsOf(state.units)
  const partyAlive = partyIds.some(id => {
    const u = state.units[id as unknown as string]
    return u !== undefined && isAlive(u)
  })
  const enemiesAlive = enemyIds.some(id => {
    const u = state.units[id as unknown as string]
    return u !== undefined && isAlive(u)
  })
  if (!partyAlive) return 'DEFEAT'
  if (!enemiesAlive) return 'VICTORY'
  return 'COMBAT'
}

export function reduce(state: CombatState, event: CombatEvent, _rng: RNG): ReduceResult {
  switch (event.type) {
    case 'startBattle': {
      const units: Record<string, Unit> = {}
      for (const u of event.payload.units) units[u.id as unknown as string] = u
      const order = buildInitiativeQueue(event.payload.units)
      const first = order[0]!
      const team: 'party' | 'enemy' = teamsOf(units).partyIds.includes(first) ? 'party' : 'enemy'

      // Deal opening hands: decks arriving with an EMPTY hand (deckBuilder
      // convention) get their draw pile shuffled and HAND_SIZE cards dealt.
      // Decks with pre-set hands (test fixtures, replays) pass through as-is.
      let rngState = event.payload.rngSeed
      const rawDecks = event.payload.decks ?? state.decks
      const decks: Record<string, DeckState> = {}
      for (const [uid, deck] of Object.entries(rawDecks)) {
        if (deck.hand.length === 0 && deck.draw.length > 0) {
          const shuffler = createRng(rngState)
          const shuffled = { ...deck, draw: shuffler.shuffle(deck.draw) }
          rngState = shuffler.state()
          const dealt = drawCards(shuffled, HAND_SIZE, rngState)
          decks[uid] = dealt.deck
          rngState = dealt.rngState
        } else {
          decks[uid] = deck
        }
      }

      const newState: CombatState = {
        ...state,
        phase: 'COMBAT',
        subPhase: 'IDLE',
        turn: { number: 1, unitId: first, team },
        units,
        decks,
        grid: event.payload.grid,
        rng: rngState,
        battleTag: event.payload.battleTag ?? null,
      }
      return { state: newState, effects: [] }
    }

    case 'startTurn': {
      const u = state.units[event.payload.unitId as unknown as string]
      if (!u) return { state, effects: [] }
      const team: 'party' | 'enemy' = teamsOf(state.units).partyIds.includes(u.id) ? 'party' : 'enemy'
      return {
        state: { ...state, turn: { ...state.turn, unitId: u.id, team } },
        effects: [],
      }
    }

    case 'endTurn': {
      // End-of-turn status tick for the unit whose turn is ending (ship plan
      // §9: poison/burn fire at the end of the afflicted unit's turn).
      const tickEffects: CombatEffect[] = []
      let tickedUnits = state.units
      const endingKey = state.turn.unitId as unknown as string | null
      const endingUnit = endingKey ? state.units[endingKey] : undefined
      if (endingUnit && isAlive(endingUnit)) {
        const ticked = tickUnitStatuses(endingUnit)
        if (ticked.unit !== endingUnit) {
          tickedUnits = { ...state.units, [endingKey!]: ticked.unit }
          tickEffects.push(...ticked.effects)
        }
      }
      const tickedState: CombatState = tickedUnits === state.units ? state : { ...state, units: tickedUnits }

      const aliveUnits = Object.values(tickedState.units).filter(isAlive)
      if (aliveUnits.length === 0) {
        // Edge: nobody alive — just check end condition and exit.
        const phase = checkEnd(tickedState)
        return { state: { ...tickedState, phase }, effects: tickEffects }
      }
      const order = buildInitiativeQueue(aliveUnits)
      const currentIdx = order.findIndex(id => id === tickedState.turn.unitId)
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % order.length
      const wrapped = currentIdx !== -1 && nextIdx === 0
      const nextId = order[nextIdx]!
      const team: 'party' | 'enemy' = teamsOf(tickedState.units).partyIds.includes(nextId) ? 'party' : 'enemy'

      const phase = checkEnd(tickedState)
      if (phase !== 'COMBAT') return { state: { ...tickedState, phase }, effects: tickEffects }

      // Turn-start restoration for the unit whose turn begins: free move
      // back, and AP restored to full — without this every unit bled to
      // 0 AP by round 2-3 and combat died (the playtest bug).
      const nextKey = nextId as unknown as string
      const newUnits = { ...tickedState.units }
      const nextUnit = newUnits[nextKey]
      if (nextUnit) newUnits[nextKey] = { ...nextUnit, hasMovedThisTurn: false, ap: AP_PER_TURN }

      // Deck cycling (StS model): the ENDING unit discards its whole hand —
      // no hand clogging, every turn starts fresh — then the unit whose turn
      // begins draws HAND_SIZE, reshuffling its discard when the pile is dry.
      let newDecks = tickedState.decks
      let rngState = tickedState.rng
      if (endingKey) {
        const endingDeck = newDecks[endingKey]
        if (endingDeck && endingDeck.hand.length > 0) {
          newDecks = {
            ...newDecks,
            [endingKey]: { ...endingDeck, hand: [], discard: [...endingDeck.discard, ...endingDeck.hand] },
          }
        }
      }
      const nextDeck = newDecks[nextKey]
      if (nextDeck && nextDeck.hand.length < HAND_SIZE) {
        const refilled = drawCards(nextDeck, HAND_SIZE - nextDeck.hand.length, rngState)
        newDecks = { ...newDecks, [nextKey]: refilled.deck }
        rngState = refilled.rngState
      }

      return {
        state: {
          ...tickedState,
          phase: 'COMBAT',
          subPhase: 'IDLE',
          selectedCardId: null,
          pinnedTargetTile: null,
          turn: {
            number: wrapped ? tickedState.turn.number + 1 : tickedState.turn.number,
            unitId: nextId,
            team,
          },
          units: newUnits,
          decks: newDecks,
          rng: rngState,
        },
        effects: tickEffects,
      }
    }

    case 'tickStatus': {
      const effects: CombatEffect[] = []
      for (const u of Object.values(state.units)) {
        for (const s of u.statuses) {
          const def = getStatusEffect(s.effectId)
          if (!def?.onTurnEnd) continue
          const cardEffects = def.onTurnEnd({
            selfUnitId: u.id, selfStacks: s.stacks, selfTurnsRemaining: s.turnsRemaining,
          })
          for (const e of cardEffects) effects.push({ kind: 'ApplyCardEffect', effect: e })
        }
      }
      return { state, effects }
    }

    case 'selectCard':
      return {
        state: { ...state, selectedCardId: event.payload.cardId, subPhase: 'SELECTING_TARGET' },
        effects: [],
      }

    case 'cancelSelection':
      return {
        state: { ...state, selectedCardId: null, pinnedTargetTile: null, subPhase: 'IDLE' },
        effects: [],
      }

    case 'pinTarget':
      return {
        state: { ...state, pinnedTargetTile: event.payload.tileId },
        effects: [],
      }

    case 'unpinTarget':
      return {
        state: { ...state, pinnedTargetTile: null },
        effects: [],
      }

    case 'enterMoveMode':
      return {
        state: { ...state, subPhase: 'SELECTING_MOVE', selectedCardId: null, pinnedTargetTile: null },
        effects: [],
      }

    case 'playCard': {
      const { srcId, targets, card, cardId } = event.payload
      const src = state.units[srcId as unknown as string]
      if (!src || !card) {
        // Legacy path or invalid src — no-op stub for backwards compatibility.
        return { state, effects: [{ kind: 'WaitForAnimations' }] }
      }
      // Insufficient AP — refuse to play
      if (src.ap < card.apCost) {
        return { state, effects: [] }
      }

      const newUnits: Record<string, Unit> = { ...state.units }
      const effects: CombatEffect[] = []
      let rngState = state.rng

      // Discard the played card up front so draw effects can never draw the
      // card that is still being resolved (unless a reshuffle recycles it).
      const srcStr0 = srcId as unknown as string
      const newDecks = { ...state.decks }
      const srcDeck = newDecks[srcStr0]
      if (srcDeck) {
        const handIdx = srcDeck.hand.findIndex((c) => (c as unknown as string) === (cardId as unknown as string))
        if (handIdx !== -1) {
          const newHand = srcDeck.hand.slice()
          const removed = newHand.splice(handIdx, 1)
          newDecks[srcStr0] = {
            ...srcDeck,
            hand: newHand,
            discard: [...srcDeck.discard, ...removed],
          }
        }
      }

      // Find a LIVING target unit at each target tile (if any). Corpses keep
      // their position, so without the alive filter the first dead unit found
      // at a tile shadowed the living one standing on it — the living enemy
      // became immune to every single-target card (Jab "expected 11, dealt 0"
      // in the playtest; the majority of late-fight whiffs in the sim).
      const targetUnits: Unit[] = []
      for (const tile of targets) {
        const tileStr = tile as unknown as string
        const u = Object.values(newUnits).find(
          (cand) => isAlive(cand) && cand.position && (cand.position as unknown as string) === tileStr,
        )
        if (u) targetUnits.push(u)
      }

      // AOE: expand the target set to every living unit within aoeRadius of
      // each target tile (manhattan, matching targeting.tilesInAoe). Which of
      // the expanded units an effect touches is decided per effect kind below.
      const aoeRadius = card.aoeRadius ?? 0
      if (aoeRadius > 0) {
        for (const t of targets) {
          const pt = parseTile(t)
          for (const u of Object.values(newUnits)) {
            if (!u.position || !isAlive(u)) continue
            if (targetUnits.some(x => x.id === u.id)) continue
            const pu = parseTile(u.position)
            if (Math.abs(pu.x - pt.x) + Math.abs(pu.y - pt.y) <= aoeRadius) targetUnits.push(u)
          }
        }
      }

      const { partyIds: srcPartyIds } = teamsOf(newUnits)
      const srcIsParty = srcPartyIds.includes(srcId)
      const isFoeOfSrc = (u: Unit): boolean =>
        srcPartyIds.includes(u.id) !== srcIsParty
      const foeTargets = targetUnits.filter(isFoeOfSrc)
      const allyTargets = targetUnits.filter(u => !isFoeOfSrc(u))
      const enemyTargetCard = card.targetKind === 'enemy'

      const applyStatusTo = (target: Unit, effectId: string, stacks: number, turns: number): void => {
        const tStr = target.id as unknown as string
        const cur = newUnits[tStr] ?? target
        let statuses = mergeStatus(cur.statuses, asStatusEffectId(effectId), stacks, turns, srcId)
        // Landing on the unit whose turn it IS (taunt, riposte, covers played
        // on yourself) ⇒ fresh: the end-of-turn tick will spend the flag, not
        // a duration point, so the buff survives the coming enemy phase.
        // Statuses inflicted outside the victim's own turn (enemy poison on
        // you, your slow on them) tick normally.
        if (tStr === (state.turn.unitId as unknown as string)) {
          statuses = statuses.map(s =>
            (s.effectId as unknown as string) === effectId ? { ...s, fresh: true } : s,
          )
        }
        newUnits[tStr] = { ...cur, statuses }
      }

      // Resolve each effect against each target
      for (const eff of card.effects) {
        const params = eff.params
        if (eff.kind === 'Damage') {
          const base = (params.base as number | undefined) ?? 0
          const damageType = (params.damageType as string | undefined) ?? 'physical'
          const stat = card.damageStat
          let statBonus = 0
          if (stat === 'str') statBonus = src.stats.str
          else if (stat === 'mag') statBonus = src.stats.mag
          else if (stat === 'skl') statBonus = src.stats.skl
          // Empower ("next attack +X"): consume the buff on this damage card.
          const liveSrc = newUnits[srcId as unknown as string] ?? src
          const empBonus = empowerBonus(liveSrc)
          if (empBonus > 0) {
            statBonus += empBonus
            newUnits[srcId as unknown as string] = { ...liveSrc, statuses: consumeEmpower(liveSrc.statuses) }
          }
          // Damage never friendly-fires: only foes among the (possibly
          // AOE-expanded) target set take hits.
          for (const target of foeTargets) {
            const dr = damageType === 'magic'
              ? Math.floor(target.stats.res / 2)
              : Math.floor(target.stats.def / 2)
            const afterDr = Math.max(0, base + statBonus - dr)
            const split = applyDamage(target, afterDr, damageType === 'magic' ? 'magic' : 'physical')
            const tStr = target.id as unknown as string
            const updated: Unit = {
              ...target,
              hp: { ...target.hp, current: split.newHp },
              armor: split.newArmor,
            }
            newUnits[tStr] = updated
            effects.push({
              kind: 'FloatDamage',
              tile: target.position!,
              amount: afterDr,
              damageKind: damageType === 'magic' ? 'magic' : 'physical',
            })
            effects.push({
              kind: 'HitFlash',
              sprite: { id: tStr },
              durationMs: 80,
            })
            // Riposte: melee (adjacent) physical attackers take the stance's
            // stacks back as straight damage — the sword's answer.
            const riposte = updated.statuses.find(
              st => (st.effectId as unknown as string) === 'riposte' && st.turnsRemaining > 0,
            )
            if (
              riposte && damageType !== 'magic' && afterDr > 0 &&
              updated.position && src.position && isAdjacentTile(updated.position, src.position)
            ) {
              const sKey = srcId as unknown as string
              const liveAtk = newUnits[sKey] ?? src
              newUnits[sKey] = {
                ...liveAtk,
                hp: { ...liveAtk.hp, current: Math.max(0, liveAtk.hp.current - riposte.stacks) },
              }
              if (liveAtk.position) {
                effects.push({ kind: 'FloatDamage', tile: liveAtk.position, amount: riposte.stacks, damageKind: 'physical' })
              }
            }
          }
        } else if (eff.kind === 'Heal') {
          const amount = (params.amount as number | undefined) ?? 0
          // Heal riders on enemy-target cards are lifesteal → heal the source.
          const liveSelf = newUnits[srcId as unknown as string] ?? src
          const healRecipients = enemyTargetCard || allyTargets.length === 0 ? [liveSelf] : allyTargets
          for (const target of healRecipients) {
            const newCurrent = Math.min(target.hp.max, target.hp.current + amount)
            const tStr = target.id as unknown as string
            const updated: Unit = { ...target, hp: { ...target.hp, current: newCurrent } }
            newUnits[tStr] = updated
            effects.push({
              kind: 'FloatDamage',
              tile: target.position!,
              amount,
              damageKind: 'heal',
            })
          }
        } else if (eff.kind === 'GrantArmor') {
          const amount = (params.amount as number | undefined) ?? 0
          // Armor riders on enemy-target cards (Brace family) armor the
          // SOURCE; ally-target cards armor the ally; self cards the source.
          const recipients = enemyTargetCard || allyTargets.length === 0 ? [src] : allyTargets
          for (const target of recipients) {
            const tStr = target.id as unknown as string
            const live = newUnits[tStr] ?? target
            newUnits[tStr] = { ...live, armor: live.armor + amount }
          }
        } else if (eff.kind === 'RemoveStatus') {
          const removeKind = String(params.kind ?? '')
          if (removeKind === 'armor') {
            // Armor shred (Guard Break / Shatter / Rend family).
            const amount = (params.amount as number | undefined) ?? 0
            for (const target of foeTargets) {
              const tStr = target.id as unknown as string
              const live = newUnits[tStr] ?? target
              newUnits[tStr] = { ...live, armor: Math.max(0, live.armor - amount) }
            }
          } else if (removeKind === 'debuff') {
            // Cleanse (Purify family): strip harmful statuses from allies/self.
            const HARMFUL = new Set(['poison', 'burn', 'slow', 'immobilize'])
            const recipients = allyTargets.length > 0 ? allyTargets : [src]
            for (const target of recipients) {
              const tStr = target.id as unknown as string
              const live = newUnits[tStr] ?? target
              newUnits[tStr] = {
                ...live,
                statuses: live.statuses.filter(st => !HARMFUL.has(st.effectId as unknown as string)),
              }
            }
          }
        } else if (eff.kind === 'GainAp') {
          const amount = (params.amount as number | undefined) ?? 0
          const tStr = (src.id as unknown as string)
          const updatedSrc = newUnits[tStr] ?? src
          newUnits[tStr] = { ...updatedSrc, ap: updatedSrc.ap + amount }
        } else if (eff.kind === 'ApplyStatus') {
          const effectId = String(params.effectId ?? '')
          const stacks = (params.value as number | undefined) ?? 1
          const turns = (params.turns as number | undefined) ?? 1
          if (effectId) {
            // Enemy-target cards afflict foes only (AOE never debuffs allies);
            // other cards hit whatever was targeted, defaulting to self.
            const primary = enemyTargetCard
              ? foeTargets
              : targetUnits.length > 0 ? targetUnits : [src]
            for (const t of primary) applyStatusTo(t, effectId, stacks, turns)
            if (params.splash === 'adjacent') {
              for (const t of targetUnits) {
                if (!t.position) continue
                for (const adj of unitsAdjacentTo(newUnits, t.position, t.id)) {
                  if (isFoeOfSrc(adj)) applyStatusTo(adj, effectId, stacks, turns)
                }
              }
            }
          }
        } else if (eff.kind === 'DrawCards') {
          const count = (params.count as number | undefined) ?? 1
          // Some draw cards (mage Focus) also grant AP; the HUD prints
          // "Draw 1 · +1 AP" from this same param, and until now the reducer
          // never read it — the card charged 1 AP and refunded nothing.
          const gainAp = (params.gainAp as number | undefined) ?? 0
          if (gainAp > 0) {
            const cur = newUnits[srcStr0] ?? src
            newUnits[srcStr0] = { ...cur, ap: cur.ap + gainAp }
          }
          const deck = newDecks[srcStr0]
          if (deck && count > 0) {
            let draw = deck.draw.slice()
            let discard = deck.discard.slice()
            const hand = deck.hand.slice()
            for (let i = 0; i < count; i++) {
              if (draw.length === 0 && discard.length > 0) {
                const shuffleRng = createRng(rngState)
                draw = shuffleRng.shuffle(discard) as CardId[]
                discard = []
                rngState = shuffleRng.state()
              }
              const drawn = draw.shift()
              if (drawn === undefined) break
              hand.push(drawn)
            }
            newDecks[srcStr0] = { ...deck, draw, hand, discard }
          }
        }
      }

      // Quiver modifier baked onto this card at deck-build time (ship plan §8).
      const cardMod = state.decks[srcStr0]?.cardMods?.[cardId as unknown as string]
      if (cardMod) {
        for (const target of foeTargets) {
          const tStr = target.id as unknown as string
          const live = newUnits[tStr] ?? target
          switch (cardMod.kind) {
            case 'poison':
              applyStatusTo(live, 'poison', cardMod.value, cardMod.turns)
              break
            case 'slow':
              applyStatusTo(live, 'slow', cardMod.value, cardMod.turns)
              break
            case 'thunder': {
              // Bonus magic damage that ignores armor entirely.
              newUnits[tStr] = {
                ...live,
                hp: { ...live.hp, current: Math.max(0, live.hp.current - cardMod.value) },
              }
              if (live.position) {
                effects.push({ kind: 'FloatDamage', tile: live.position, amount: cardMod.value, damageKind: 'magic' })
              }
              break
            }
            case 'explosive': {
              if (!live.position) break
              for (const adj of unitsAdjacentTo(newUnits, live.position, live.id)) {
                if (!isFoeOfSrc(adj)) continue
                const aStr = adj.id as unknown as string
                const cur = newUnits[aStr] ?? adj
                const split = applyDamage(cur, cardMod.value, 'physical')
                newUnits[aStr] = { ...cur, hp: { ...cur.hp, current: split.newHp }, armor: split.newArmor }
                if (cur.position) {
                  effects.push({ kind: 'FloatDamage', tile: cur.position, amount: cardMod.value, damageKind: 'physical' })
                }
              }
              break
            }
          }
        }
      }

      // Decrement source AP (card already moved to discard above)
      const srcStr = srcId as unknown as string
      const updatedSrc = newUnits[srcStr] ?? src
      newUnits[srcStr] = { ...updatedSrc, ap: Math.max(0, updatedSrc.ap - card.apCost) }

      // Tween source toward first target tile, if any
      if (targets.length > 0) {
        effects.push({
          kind: 'PlayTween',
          sprite: { id: srcStr },
          props: { targetTile: targets[0] as unknown as string },
          durationMs: 250,
        })
      }
      // Camera shake on big hits
      const totalDmg = effects
        .filter((e) => e.kind === 'FloatDamage' && e.damageKind !== 'heal')
        .reduce((sum, e) => sum + (e.kind === 'FloatDamage' ? e.amount : 0), 0)
      if (totalDmg >= 10) {
        effects.push({ kind: 'ShakeCamera', intensity: 0.005, durationMs: 200 })
      }
      effects.push({ kind: 'WaitForAnimations' })

      // Check end conditions after damage applied
      const stateAfter: CombatState = {
        ...state,
        units: newUnits,
        decks: newDecks,
        rng: rngState,
        subPhase: 'RESOLVING',
        selectedCardId: null,
        pinnedTargetTile: null,
      }
      const phase = checkEnd(stateAfter)
      const finalState: CombatState = phase !== 'COMBAT' ? { ...stateAfter, phase } : stateAfter

      return { state: finalState, effects }
    }

    case 'animationsCompleted':
      // Resolution finished; back to IDLE so player can pick another card
      return {
        state: { ...state, subPhase: 'IDLE' },
        effects: [],
      }

    case 'moveUnit': {
      const { unitId, tileId } = event.payload
      const u = state.units[unitId as unknown as string]
      if (!u) return { state, effects: [] }
      // Free move per turn: refuse if already used.
      if (u.hasMovedThisTurn) return { state, effects: [] }
      // Immobilize (ship plan §9): MOV = 0 while the status is active.
      if (isImmobilized(u)) return { state, effects: [] }
      // Board legality lives HERE, not only in the view (pure systems are the
      // authority — a scripted/AI/replayed moveUnit must obey the same board
      // a click does). Range stays with the caller: MOV isn't a unit stat yet.
      const destStr = tileId as unknown as string
      const parts = destStr.split(',').map(Number)
      const mx = parts[0] ?? NaN
      const my = parts[1] ?? NaN
      if (!Number.isInteger(mx) || !Number.isInteger(my)
        || mx < 0 || my < 0 || mx >= state.grid.width || my >= state.grid.height) {
        return { state, effects: [] }
      }
      if (state.grid.obstacles.has(tileId)) return { state, effects: [] }
      const occupied = Object.values(state.units).some(
        o => o.id !== u.id && isAlive(o) && (o.position as unknown as string) === destStr,
      )
      if (occupied) return { state, effects: [] }
      const newUnits: Record<string, Unit> = {
        ...state.units,
        [unitId as unknown as string]: { ...u, position: tileId, hasMovedThisTurn: true },
      }
      return {
        state: { ...state, units: newUnits, subPhase: 'RESOLVING' },
        effects: [
          { kind: 'PlayTween', sprite: { id: unitId as unknown as string }, props: { targetTile: tileId as unknown as string }, durationMs: 200 },
          { kind: 'WaitForAnimations' },
        ],
      }
    }

    case 'capture': {
      const { targetId, attackerIds } = event.payload
      const target = state.units[targetId as unknown as string]
      if (!target) return { state, effects: [] }

      // Compute capture chance via the existing captureChance helper
      const adjacentAttackers = attackerIds.length
      const ctx = { target, adjacentAttackers, bountyHunterBonus: false }
      // Inline the formula to avoid a system dep cycle
      const hpFraction = target.hp.current / Math.max(1, target.hp.max)
      const chance = Math.max(0, Math.min(1,
        (1 - hpFraction) * 0.6 + ctx.adjacentAttackers * 0.25 + (ctx.bountyHunterBonus ? 0.15 : 0),
      ))

      // Roll vs chance using the persistent rng
      const roll = _rng.next()
      const success = roll < chance

      const newUnits: Record<string, Unit> = { ...state.units }
      if (success) {
        // Taken alive: off the grid like death, but flagged. battleResolver
        // reports flagged units as capturedIds (BattleVictory) — never mark
        // state through the display name.
        newUnits[targetId as unknown as string] = {
          ...target,
          hp: { ...target.hp, current: 0 },
          captured: true,
        }
      }

      const newState: CombatState = {
        ...state,
        units: newUnits,
      }
      const phase = checkEnd(newState)
      const finalState = phase !== 'COMBAT' ? { ...newState, phase } : newState
      return {
        state: finalState,
        effects: [
          {
            kind: 'FloatDamage',
            tile: target.position!,
            amount: success ? 1 : 0,
            damageKind: 'heal',
          },
          { kind: 'WaitForAnimations' },
        ],
      }
    }
  }
}
