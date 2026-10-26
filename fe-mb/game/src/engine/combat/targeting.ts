/**
 * combat/targeting.ts — legal targets, AOE recipients, danger zones (brief §2.3, §2.5), and the Move approach
 * planner shared by `legalTargets` and `cards.ts` (CONTRACT-CHANGES 0006).
 */
import type { CombatState, CombatUnit, EffectTarget, EngineEnv, PlayableCard, TileKey, UnitId } from '../types'
import { findPath, isLiving, manhattan, neighbours4, occupiedTiles, reachable, tilesInAoe, tilesInRange, unitAt } from './grid'
import { isImmobilized } from './statuses'

/** Σ `Move.distance` on the card — 0 for every card without an approach. */
export function moveDistance(card: PlayableCard): number {
  let d = 0
  for (const e of card.effects) if (e.kind === 'Move') d += e.distance
  return d
}

/** The authored range is the TARGETING range and already includes the approach; the strike range is
 *  `[range.min, max(1, range.max − Σ Move.distance)]` (Charge 1-3 with Move 2 strikes from 1). */
export function strikeRange(card: PlayableCard): { readonly min: number; readonly max: number } {
  const d = moveDistance(card)
  if (d === 0) return card.range
  return { min: card.range.min, max: Math.max(1, card.range.max - d) }
}

/**
 * Where a Move card's source ends up to strike `tile`: `{ dest: own tile, path: [] }` when already within strike
 * range; else the nearest reachable free tile within strike range of `tile` (shortest path, then `tileKey` order)
 * walking ≤ Σ distance through obstacles ∪ occupied; null when immobilized or nothing reaches (`validatePlay`
 * refuses that play as `noPath`, `legalTargets` filters it, so a legal play always lands).
 */
export function planApproach(state: CombatState, unitId: UnitId, card: PlayableCard, tile: TileKey): { readonly dest: TileKey; readonly path: readonly TileKey[] } | null {
  const u = state.units[unitId]
  if (u === undefined || u.position === null) return null
  const strike = strikeRange(card)
  const d = manhattan(u.position, tile)
  if (d >= strike.min && d <= strike.max) return { dest: u.position, path: [] }
  const steps = moveDistance(card)
  if (steps === 0 || isImmobilized(u)) return null
  const blocked = occupiedTiles(state.units, unitId)
  let best: { readonly dest: TileKey; readonly path: readonly TileKey[] } | null = null
  for (const candidate of [...tilesInRange(state.grid, tile, strike.min, strike.max)].sort()) {
    if (blocked.has(candidate)) continue
    const path = findPath(state.grid, u.position, candidate, steps, blocked)
    if (path === null) continue
    if (best === null || path.length < best.path.length) best = { dest: candidate, path }
  }
  return best
}

/**
 * Tiles the active unit may aim `card` at: authored range ∩ targetKind
 * (enemy → living foe on tile; ally → living friend; self → `[own tile]`; tile → any in-bounds non-obstacle;
 * all_enemies / all_allies → `[]`, they take `tile: null`).
 * A card carrying `Move` uses its authored range UNCHANGED (it already includes the approach — `cards.ts`) but keeps
 * only the tiles the Move can bring into strike range (a path exists, or the target is already in strike range).
 */
export function legalTargets(state: CombatState, unitId: UnitId, card: PlayableCard, env: EngineEnv): readonly TileKey[] {
  void env
  const u = state.units[unitId]
  if (u === undefined || u.position === null || !isLiving(u)) return []
  const kind = card.targetKind
  if (kind === 'all_enemies' || kind === 'all_allies') return []
  if (kind === 'self') return [u.position]
  const inRange = tilesInRange(state.grid, u.position, card.range.min, card.range.max)
  const byKind = inRange.filter((t) => {
    if (kind === 'tile') return true
    const occupant = unitAt(state, t)
    if (occupant === null) return false
    return kind === 'enemy' ? occupant.team !== u.team : occupant.team === u.team
  })
  if (moveDistance(card) === 0) return byKind
  return byKind.filter((t) => planApproach(state, unitId, card, t) !== null)
}

/**
 * Units an effect selector lands on. `centre = tile ?? state.units[sourceId].position` — so a self card
 * (tile null by contract) centres every selector on the player (the self-centred AOE five approximated cards need),
 * and enemy `buff` actions (range 0-0) do the same.
 *  - `self`   → the source.
 *  - `target` → the living unit on `centre` (the source itself for self cards).
 *  - `area`   → every living FOE within `aoeRadius` of `centre`, centre included; when `card.targetKind` is
 *               `all_enemies` → every living foe on the board (radius ignored).
 *  - `ally`   → every living FRIEND within `aoeRadius` of `centre`, centre included (the source counts);
 *               `all_allies` → every living friend on the board.
 *  - `ring`   → every living FOE on `neighbours4(centre)`, centre EXCLUDED (quiver `explosive`; ring-only AOEs).
 * Tile-target cards never status allies (§2.3): foe/ally split is by `Unit.team`, never by position.
 */
export function recipients(state: CombatState, sourceId: UnitId, tile: TileKey | null, card: PlayableCard, selector: EffectTarget): readonly CombatUnit[] {
  const source = state.units[sourceId]
  if (source === undefined) return []
  if (selector === 'self') return isLiving(source) ? [source] : []
  const centre = tile ?? source.position
  if (centre === null) return []
  const living = Object.values(state.units).filter(isLiving)
  const foe = (u: CombatUnit): boolean => u.team !== source.team
  const friend = (u: CombatUnit): boolean => u.team === source.team
  const within = (radius: number): ReadonlySet<TileKey> => new Set(tilesInAoe(state.grid, centre, radius))
  switch (selector) {
    case 'target': {
      const u = unitAt(state, centre)
      return u === null ? [] : [u]
    }
    case 'area': {
      if (card.targetKind === 'all_enemies') return living.filter(foe)
      const tiles = within(card.aoeRadius ?? 0)
      return living.filter((u) => foe(u) && u.position !== null && tiles.has(u.position))
    }
    case 'ally': {
      if (card.targetKind === 'all_allies') return living.filter(friend)
      const tiles = within(card.aoeRadius ?? 0)
      return living.filter((u) => friend(u) && u.position !== null && tiles.has(u.position))
    }
    case 'ring': {
      const ring = new Set(neighbours4(centre))
      return living.filter((u) => foe(u) && u.position !== null && ring.has(u.position))
    }
  }
}

/**
 * Union of every living enemy's move + attack reach (Tab overlay): every tile it can stand on (own tile + `reachable`)
 * extended by each attack action's range, widened by its `aoeRadius` (the union of manhattan balls centred on an
 * annulus [min, max] is the annulus [max(0, min − r), max + r]). Sorted for a stable render.
 */
export function dangerUnion(state: CombatState, env: EngineEnv): readonly TileKey[] {
  const out = new Set<TileKey>()
  for (const u of Object.values(state.units)) {
    if (u.team !== 'enemy' || u.position === null || !isLiving(u)) continue
    const stand = [u.position, ...Object.keys(reachable(state, u.id))]
    const actions = env.content.enemyAI[u.classId]?.actions ?? []
    for (const t of stand) {
      out.add(t)
      for (const a of actions) {
        if (a.kind !== 'attack') continue
        const r = a.aoeRadius ?? 0
        for (const hit of tilesInRange(state.grid, t, Math.max(0, a.range.min - r), a.range.max + r)) out.add(hit)
      }
    }
  }
  return [...out].sort()
}
