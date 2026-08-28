/**
 * Headless combat engine for the CLI. Drives the REAL combatStore dispatch
 * chokepoint + pure systems (reducer, enemyAI, targeting) — no Phaser/React.
 * Produces a human-readable combat log by diffing unit state across commands.
 */
import { useCombatStore } from '../../src/state/combatStore'
import { createRng } from '../../src/systems/rng'
import { planTurn } from '../../src/systems/enemyAI'
import { tilesInRange, tilesReachable, manhattan } from '../../src/systems/targeting'
import { asTileId, asUnitId, asCardId } from '../../src/domain/ids'
import type { TileId } from '../../src/domain/ids'
import type { CombatState, CombatEvent } from '../../src/domain/combatState'
import type { Unit } from '../../src/domain/unit'
import cardsJson from '../../src/data/content/cards.json'
import classesJson from '../../src/data/content/classes.json'
import { isEnemyUnit } from './render'

const cardsById = new Map(cardsJson.map((c) => [c.id, c]))
const movByClass = new Map(classesJson.map((c) => [c.id, c.startingMov]))
function movRange(classId: string): number {
  return movByClass.get(classId) ?? 4
}

const store = (): ReturnType<typeof useCombatStore.getState> => useCombatStore.getState()
export function cstate(): CombatState {
  return store().state
}
function rng(): ReturnType<typeof createRng> {
  return createRng(cstate().rng)
}
function dispatch(event: CombatEvent): void {
  store().dispatch(event, rng())
}
function gridState(): { width: number; height: number; obstacles: Set<TileId> } {
  const g = cstate().grid
  return { width: g.width, height: g.height, obstacles: g.obstacles }
}
function unitAt(tile: string): Unit | undefined {
  return Object.values(cstate().units).find(
    (u) => u.hp.current > 0 && (u.position as unknown as string) === tile,
  )
}
function blockedTiles(exceptId?: string): Set<string> {
  const b = new Set<string>()
  for (const u of Object.values(cstate().units)) {
    if (u.hp.current <= 0 || !u.position) continue
    if ((u.id as unknown as string) === exceptId) continue
    b.add(u.position as unknown as string)
  }
  return b
}

type CardJson = typeof cardsJson[number]
function cardPayloadOf(card: CardJson): { apCost: number; damageStat?: 'str' | 'mag' | 'skl'; targetKind?: string; aoeRadius?: number; effects: CardJson['effects'] } {
  const c = card as CardJson & { aoeRadius?: number }
  return {
    apCost: card.apCost,
    effects: card.effects,
    targetKind: card.targetKind,
    ...(card.damageStat ? { damageStat: card.damageStat as 'str' | 'mag' | 'skl' } : {}),
    ...(c.aoeRadius ? { aoeRadius: c.aoeRadius } : {}),
  }
}

/** In-range tiles holding a valid target for the card's targetKind. */
export function cardTargetTiles(unit: Unit, card: CardJson): string[] {
  if (!unit.position) return []
  const inRange = tilesInRange(unit.position, card.range.min, card.range.max, gridState())
  return inRange
    .map((t) => t as unknown as string)
    .filter((t) => {
      const occ = unitAt(t)
      switch (card.targetKind) {
        case 'self': return t === (unit.position as unknown as string)
        case 'enemy':
        case 'all_enemies': return !!occ && isEnemyUnit(occ)
        case 'ally':
        case 'all_allies': return !!occ && !isEnemyUnit(occ)
        case 'tile': return true
        default: return true
      }
    })
}

/** Settle any RESOLVING sub-phase (headless: no animations to wait for). */
function settle(): void {
  let guard = 0
  while (cstate().subPhase === 'RESOLVING' && guard++ < 8) {
    dispatch({ type: 'animationsCompleted' })
  }
}

// ── combat log via state diff ───────────────────────────────────────
type Snap = Record<string, { hp: number; ap: number; armor: number; alive: boolean; pos: string | null }>
function snap(): Snap {
  const s: Snap = {}
  for (const u of Object.values(cstate().units)) {
    s[u.id as unknown as string] = {
      hp: u.hp.current, ap: u.ap, armor: u.armor,
      alive: u.hp.current > 0, pos: (u.position as unknown as string) ?? null,
    }
  }
  return s
}
function diffLog(before: Snap): string[] {
  const out: string[] = []
  for (const u of Object.values(cstate().units)) {
    const id = u.id as unknown as string
    const b = before[id]
    if (!b) continue
    const parts: string[] = []
    const posNow = (u.position as unknown as string) ?? null
    if (posNow !== b.pos) parts.push(`moved ${b.pos}→${posNow}`)
    if (u.hp.current !== b.hp) parts.push(`HP ${b.hp}→${u.hp.current}`)
    if (u.armor !== b.armor) parts.push(`armor ${b.armor}→${u.armor}`)
    if (u.ap !== b.ap) parts.push(`AP ${b.ap}→${u.ap}`)
    if (u.hp.current <= 0 && b.alive) parts.push('☠ FALLEN')
    if (parts.length) out.push(`    ${u.name}: ${parts.join(', ')}`)
  }
  return out
}

function activeUnit(): Unit | null {
  const id = cstate().turn.unitId
  return id ? cstate().units[id as unknown as string] ?? null : null
}

/** Run all consecutive enemy turns until it's a party turn or combat ends. */
export function runEnemyTurns(): string[] {
  const log: string[] = []
  let guard = 0
  while (cstate().phase === 'COMBAT' && cstate().turn.team === 'enemy' && guard++ < 60) {
    const s = cstate()
    const eid = s.turn.unitId as unknown as string | null
    if (!eid) break
    const name = s.units[eid]?.name ?? eid
    const before = snap()
    const events = planTurn(s, rng(), asUnitId(eid))
    for (const ev of events) { dispatch(ev); settle() }
    log.push(`  ⚔ ${name} (enemy) acts:`)
    log.push(...diffLog(before))
  }
  return log
}

/** Greedy one party-unit turn: attack an in-range foe, else close distance, else end. */
/**
 * Greedy-plus party turn (story 474): heal the wounded, empower before big
 * hits, focus the weakest reachable foe with the HIGHEST-damage card, armor
 * up when engaged, cycle with draw effects, then advance. Still far below
 * human play, but strong enough that sim outcomes track balance rather than
 * AI helplessness.
 */
function autoPartyTurn(): string[] {
  const log: string[] = []
  let guard = 0
  // Draw/cycle cards per turn, capped. Focus is AP-NEUTRAL now that the
  // reducer honours its gainAp (cost 1, refund 1), so an uncapped greedy AI
  // plays it forever — the hand refills from the reshuffled discard and the
  // turn literally never ends (150-round "stalemate" at full HP).
  let drawPlays = 0
  while (guard++ < 14) {
    const s = cstate()
    if (s.phase !== 'COMBAT' || s.turn.team !== 'party') break
    const unit = activeUnit()
    if (!unit || !unit.position) { log.push(...applyCommand('end')); break }
    const deck = s.decks[unit.id as unknown as string]
    if (!deck) { log.push(...applyCommand('end')); break }

    type Play = { idx: number; tile: string; score: number }
    const plays: Play[] = []
    const hand = deck.hand.map((id) => cardsById.get(id as unknown as string))

    const dmgOf = (card: CardJson): number => {
      const eff = card.effects.find((e) => e.kind === 'Damage')
      if (!eff) return 0
      const base = (eff.params as { base?: number }).base ?? 0
      const stat = card.damageStat === 'mag' ? unit.stats.mag : card.damageStat === 'skl' ? unit.stats.skl : unit.stats.str
      return base + stat
    }
    const engaged = Object.values(s.units).some((u) =>
      isEnemyUnit(u) && u.hp.current > 0 && u.position && manhattan(unit.position!, u.position) === 1)
    const woundedAllies = Object.values(s.units).filter((u) =>
      !isEnemyUnit(u) && u.hp.current > 0 && u.hp.current / u.hp.max < 0.6)
    const hasEmpower = unit.statuses.some((st) => (st.effectId as unknown as string) === 'empower')

    for (let i = 0; i < hand.length; i++) {
      const card = hand[i]
      if (!card || card.apCost > unit.ap) continue
      const tiles = cardTargetTiles(unit, card)
      if (tiles.length === 0) continue

      const isHeal = card.effects.some((e) => e.kind === 'Heal')
      const isDamage = card.effects.some((e) => e.kind === 'Damage')
      const isArmor = card.effects.some((e) => e.kind === 'GrantArmor')
      const isDraw = card.effects.some((e) => e.kind === 'DrawCards')
      const isEmpower = card.effects.some((e) =>
        e.kind === 'ApplyStatus' && (e.params as { effectId?: string }).effectId === 'empower')

      if (isHeal && woundedAllies.length > 0) {
        // Heal the MOST wounded reachable ally.
        const best = tiles
          .map((t) => ({ t, u: unitAt(t) }))
          .filter((x) => x.u && !isEnemyUnit(x.u))
          .sort((a, b) => (a.u!.hp.current / a.u!.hp.max) - (b.u!.hp.current / b.u!.hp.max))[0]
        if (best && best.u!.hp.current / best.u!.hp.max < 0.75) {
          plays.push({ idx: i, tile: best.t, score: 90 + (1 - best.u!.hp.current / best.u!.hp.max) * 30 })
        }
        continue
      }
      if (isDamage) {
        // Kill-priority: lowest-HP foe in range; lethal hits jump the queue.
        const foes = tiles.map((t) => ({ t, u: unitAt(t) })).filter((x) => x.u && isEnemyUnit(x.u))
        if (foes.length === 0) continue
        const dmg = dmgOf(card) + (hasEmpower ? 4 : 0)
        const target = foes.sort((a, b) => a.u!.hp.current - b.u!.hp.current)[0]!
        const lethal = dmg >= target.u!.hp.current + target.u!.armor
        plays.push({ idx: i, tile: target.t, score: (lethal ? 80 : 50) + dmg - card.apCost * 2 })
        continue
      }
      if (isEmpower && unit.ap >= card.apCost + 1 && !hasEmpower) {
        plays.push({ idx: i, tile: unit.position as unknown as string, score: 60 })
        continue
      }
      if (isArmor && engaged && unit.armor < 4) {
        plays.push({ idx: i, tile: tiles[0]!, score: 40 })
        continue
      }
      // Anchor stances: taunt draws focus-fire onto the tank; riposte
      // punishes the melee swarm. Play them when engaged.
      const isStance = card.effects.some((e) =>
        e.kind === 'ApplyStatus' && ['taunt', 'riposte'].includes(String((e.params as { effectId?: string }).effectId)))
      if (isStance && engaged) {
        plays.push({ idx: i, tile: unit.position as unknown as string, score: 45 })
        continue
      }
      if (isDraw && unit.ap >= card.apCost && drawPlays < 2) {
        plays.push({ idx: i, tile: unit.position as unknown as string, score: 15 })
        continue
      }
    }

    if (plays.length > 0) {
      const best = plays.sort((a, b) => b.score - a.score)[0]!
      const bestCard = hand[best.idx]
      if (bestCard?.effects.some((e) => e.kind === 'DrawCards')) drawPlays++
      log.push(...applyCommand(`play ${best.idx} ${best.tile}`))
      continue
    }

    // No useful play → step toward the nearest foe (once per turn)
    const enemies = Object.values(s.units).filter((u) => isEnemyUnit(u) && u.hp.current > 0 && u.position)
    if (enemies.length > 0 && !unit.hasMovedThisTurn) {
      const reach = tilesReachable(unit.position, movRange(unit.classId as unknown as string), gridState(), blockedTiles(unit.id as unknown as string))
      if (reach.length > 0) {
        const dist = (t: TileId): number => Math.min(...enemies.map((e) => manhattan(t, e.position!)))
        const best = reach.slice().sort((a, b) => dist(a) - dist(b))[0]!
        log.push(...applyCommand(`move ${best as unknown as string}`))
        continue
      }
    }

    log.push(...applyCommand('end'))
    break
  }
  return log
}

function totalHp(): number {
  return Object.values(cstate().units).reduce((n, u) => n + Math.max(0, u.hp.current), 0)
}

/**
 * Run the entire battle with both sides on AI (balance sims). Detects
 * stalemates (no HP change for `stalemateRounds` consecutive rounds — e.g. a
 * lone survivor with no offense) so sims don't spin to the round cap.
 */
export function autoBattle(maxRounds = 150, stalemateRounds = 12): string[] {
  const log: string[] = []
  let guard = 0
  let lastHp = totalHp()
  let stale = 0
  let firstBlood = false // don't count "stalemate" during the bloodless approach phase
  while (cstate().phase === 'COMBAT' && guard++ < maxRounds) {
    if (cstate().turn.team === 'party') log.push(...autoPartyTurn())
    else log.push(...runEnemyTurns())
    const hp = totalHp()
    if (hp !== lastHp) { firstBlood = true; stale = 0 }
    else if (firstBlood) { stale++ }
    lastHp = hp
    if (stale >= stalemateRounds) { log.push('  ⚖ STALEMATE — combat engaged then stalled (no damage for several rounds)'); break }
  }
  return log
}

/** Did the last autoBattle end decisively, stalemate, or hit the round cap? */
export function battleOutcome(): 'VICTORY' | 'DEFEAT' | 'STALEMATE' {
  const p = cstate().phase
  return p === 'VICTORY' || p === 'DEFEAT' ? p : 'STALEMATE'
}

/**
 * Apply one CLI command. Returns log lines. Commands:
 *   play <handIdx> <x,y> | move <x,y> | select <handIdx> | targets <handIdx>
 *   | auto | end
 */
export function applyCommand(line: string): string[] {
  const parts = line.trim().split(/\s+/)
  const cmd = parts[0] ?? ''
  const s = cstate()
  if (s.phase !== 'COMBAT' && cmd !== '') return [`(combat is ${s.phase} — no actions)`]

  const unit = activeUnit()
  const aid = unit ? (unit.id as unknown as string) : null

  switch (cmd) {
    case 'end': {
      const before = snap()
      dispatch({ type: 'endTurn' })
      settle()
      const out = [`— end turn —`, ...diffLog(before)]
      out.push(...runEnemyTurns())
      return out
    }
    case 'auto':
      return autoPartyTurn()
    case 'select': {
      if (!unit || s.turn.team !== 'party' || !aid) return ['no active party unit']
      const idx = Number(parts[1])
      const deck = s.decks[aid]
      const cid = deck?.hand[idx]
      if (!cid) return [`no card at hand index ${parts[1]}`]
      dispatch({ type: 'selectCard', payload: { cardId: asCardId(cid as unknown as string) } })
      const card = cardsById.get(cid as unknown as string)
      const tiles = card ? cardTargetTiles(unit, card) : []
      return [`selected ${card?.name ?? cid}; valid targets: ${tiles.join(' ') || '(none in range)'}`]
    }
    case 'targets': {
      if (!unit || !aid) return ['no active unit']
      const idx = Number(parts[1])
      const cid = s.decks[aid]?.hand[idx]
      const card = cid ? cardsById.get(cid as unknown as string) : undefined
      if (!card) return [`no card at hand index ${parts[1]}`]
      const tiles = cardTargetTiles(unit, card)
      return [`${card.name} valid targets: ${tiles.join(' ') || '(none in range)'}`]
    }
    case 'move': {
      if (!unit || s.turn.team !== 'party' || !unit.position || !aid) return ['no movable active unit']
      const tile = parts[1]
      if (!tile) return ['usage: move <x,y>']
      const reach = tilesReachable(unit.position, movRange(unit.classId as unknown as string), gridState(), blockedTiles(aid))
      if (!reach.map((t) => t as unknown as string).includes(tile)) return [`cannot reach ${tile} (move range ${movRange(unit.classId as unknown as string)})`]
      const before = snap()
      dispatch({ type: 'enterMoveMode', payload: { unitId: asUnitId(aid) } })
      dispatch({ type: 'moveUnit', payload: { unitId: asUnitId(aid), tileId: asTileId(tile) } })
      settle()
      return [`${unit.name} moves → ${tile}`, ...diffLog(before)]
    }
    case 'play': {
      if (!unit || s.turn.team !== 'party' || !unit.position || !aid) return ['no active party unit']
      const idx = Number(parts[1])
      const tile = parts[2]
      if (!tile) return ['usage: play <handIdx> <x,y>']
      const cid = s.decks[aid]?.hand[idx]
      const card = cid ? cardsById.get(cid as unknown as string) : undefined
      if (!card) return [`no card at hand index ${parts[1]}`]
      if (card.apCost > unit.ap) return [`not enough AP for ${card.name} (need ${card.apCost}, have ${unit.ap})`]
      const valid = cardTargetTiles(unit, card).includes(tile)
      if (!valid) return [`${tile} is not a valid target for ${card.name} (kind=${card.targetKind}, range ${card.range.min}-${card.range.max})`]
      const before = snap()
      dispatch({ type: 'selectCard', payload: { cardId: asCardId(cid as unknown as string) } })
      dispatch({
        type: 'playCard',
        payload: {
          cardId: asCardId(cid as unknown as string),
          srcId: asUnitId(aid),
          targets: [asTileId(tile)],
          card: cardPayloadOf(card),
        },
      })
      settle()
      return [`${unit.name} plays ${card.name} → ${tile}`, ...diffLog(before)]
    }
    case '':
      return []
    default:
      return [`unknown command: "${cmd}" (try: play, move, select, targets, auto, end)`]
  }
}
