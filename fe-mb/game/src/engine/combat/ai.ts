/**
 * combat/ai.ts — authored role AI, planned one step at a time (brief §2.5, §7.4, §7.19, §7.21).
 *
 * Step derivation for the active ENEMY unit:
 *  A. not moved, a desired tile ≠ position, and the move does not FORFEIT an action it could take from here →
 *     move ≤ `profile.movement` via `distanceField` with a banned-revisit set (never axis-greedy); when the flood
 *     from the desired seat reaches no stand tile, re-flood from the primary target, then fall back to closing on
 *     the nearest foe by `manhattan` — a plugged corridor never freezes the unit in place (§7.4);
 *  B. budget left (`knobs.enemyActionBudget === 1 ? actionsTaken === 0 : ap ≥ max(1, rules.combat.enemyActionApCost)`)
 *     and an eligible action THAT HAS A TILE WORTH TAKING → weighted pick with `rng.nextInt` from `combat.rng`,
 *     WRITTEN BACK (`rngState`);
 *  C. else endTurn.
 * Targeting: rusher/tank → taunters else min(hp × 100 + distance); archer → taunters else nearest party
 * unit, desired tile at preferredRange; healer → lowest-HP-fraction wounded ally in range else the
 * furthest party unit. The SAME taunt rule gates step B: `bestTile` drops every centre that misses a taunting
 * foe whenever one is in reach, so movement and the blow answer the taunt together. `rules.combat.aiLowHpFraction` is the situation threshold and
 * `rules.combat.aiDefaultPreferredRange` the fallback band — no AI number is a module literal (§9.5).
 * Every damage number the planner scores goes through `expectedDamage` → `damage.forecast` with `mod: null`, so it
 * is cover-aware; a candidate tile is scored over the action's WHOLE recipient set (`targeting.recipients`), so an
 * `aoeRadius` action is centred where it hits the most party units.
 * Enemy actions carry statuses: attack → Damage (+ApplyStatus on every unit hit); heal → Heal;
 * buff (range 0-0, tile null ⇒ centred on the actor) → ApplyStatus `ally` on the actor and allies within aoeRadius.
 *
 * Every step is legal by construction — a move tile comes from `reachable`, an action tile from `legalTargets` —
 * because a refused pump halts the runtime (a planner/reducer disagreement is a contract bug, never a flow).
 */
import type { CombatAction } from '../actions'
import type { CardEffect, CombatState, CombatUnit, EffectTarget, EnemyAIProfile, EnemyAction, EngineEnv, PlayableCard, RngState, TileKey, UnitId } from '../types'
import { createRng } from '../rng'
import { rngState } from '../rngState'
import { resolveCoverTarget } from './cover'
import { forecast } from './damage'
import { distanceField, isLiving, manhattan, neighbours4, inBounds, isObstacle, occupiedTiles, reachable, unitAt } from './grid'
import { reduceCombat } from './reducer'
import { isImmobilized, isTaunting } from './statuses'
import { legalTargets, recipients } from './targeting'

export type AiStep =
  | { readonly kind: 'move'; readonly to: TileKey; readonly path: readonly TileKey[] }
  | { readonly kind: 'act'; readonly actionId: string; readonly tile: TileKey }
  | { readonly kind: 'endTurn' }

type PlacedUnit = CombatUnit & { readonly position: TileKey }

function profileFor(unit: CombatUnit, env: EngineEnv): EnemyAIProfile | null {
  return env.content.enemyAI[unit.classId] ?? null
}

function onBoard(state: CombatState): readonly PlacedUnit[] {
  return Object.values(state.units).filter((u): u is PlacedUnit => isLiving(u) && u.position !== null)
}

function foesOf(state: CombatState, self: CombatUnit): readonly PlacedUnit[] {
  return onBoard(state).filter((u) => u.team !== self.team)
}

function friendsOf(state: CombatState, self: CombatUnit): readonly PlacedUnit[] {
  return onBoard(state).filter((u) => u.team === self.team && u.id !== self.id)
}

/** Brief §2.5: `self_low_hp` / `target_low_hp` fire below `rules.combat.aiLowHpFraction` of max HP. */
function lowHp(u: CombatUnit, env: EngineEnv): boolean {
  return u.hp.current < u.hp.max * env.rules.combat.aiLowHpFraction
}

/** Stable pick: the lowest score wins, ties by id so a plan never depends on object order. */
function argmin<T extends { readonly id: string }>(items: readonly T[], score: (t: T) => number): T | null {
  let best: T | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const item of items) {
    const s = score(item)
    if (best === null || s < bestScore || (s === bestScore && item.id < best.id)) {
      best = item
      bestScore = s
    }
  }
  return best
}

/** Tiles the unit may stand on after its move (its own tile included), capped by the profile's movement. */
function standTiles(state: CombatState, self: PlacedUnit, movement: number): Readonly<Record<TileKey, readonly TileKey[]>> {
  const out: Record<TileKey, readonly TileKey[]> = { [self.position]: [] }
  if (isImmobilized(self)) return out
  for (const [tile, path] of Object.entries(reachable(state, self.id))) if (path.length <= movement) out[tile] = path
  return out
}

export function pickTarget(state: CombatState, self: CombatUnit, profile: EnemyAIProfile, env: EngineEnv): { readonly primary: UnitId | null; readonly desiredTile: TileKey | null } {
  if (self.position === null) return { primary: null, desiredTile: null }
  const here = self.position
  const foes = foesOf(state, self)
  if (foes.length === 0) return { primary: null, desiredTile: null }
  const taunters = foes.filter(isTaunting)
  const pool = taunters.length > 0 ? taunters : foes
  const stand = standTiles(state, { ...self, position: here }, profile.movement)
  const tiles = Object.keys(stand)

  switch (profile.role) {
    case 'rusher':
    case 'tank': {
      const target = argmin(pool, (f) => f.hp.current * 100 + manhattan(here, f.position))
      if (target === null) return { primary: null, desiredTile: null }
      if (manhattan(here, target.position) === 1) return { primary: target.id, desiredTile: here }
      // a free orthogonal neighbour of the target, nearest to us; else the reachable tile nearest the target
      const seats = neighbours4(target.position).filter((t) => inBounds(state.grid, t) && !isObstacle(state.grid, t) && (t === here || unitAt(state, t) === null))
      const seat = seats.length > 0 ? seats.reduce((a, b) => (manhattan(here, b) < manhattan(here, a) ? b : a)) : null
      if (seat !== null) return { primary: target.id, desiredTile: seat }
      const nearest = tiles.reduce((a, b) => (manhattan(b, target.position) < manhattan(a, target.position) ? b : a))
      return { primary: target.id, desiredTile: nearest }
    }
    case 'archer': {
      const target = argmin(pool, (f) => manhattan(here, f.position))
      if (target === null) return { primary: null, desiredTile: null }
      const [defMin, defMax] = env.rules.combat.aiDefaultPreferredRange.archer
      const pref = profile.preferredRange ?? { min: defMin, max: defMax }
      const inBand = (t: TileKey): boolean => {
        const d = manhattan(t, target.position)
        return d >= pref.min && d <= pref.max
      }
      if (inBand(here)) return { primary: target.id, desiredTile: here }
      const candidates = tiles.filter(inBand)
      if (candidates.length > 0) {
        const cheapest = candidates.reduce((a, b) => ((stand[b]?.length ?? 0) < (stand[a]?.length ?? 0) ? b : a))
        return { primary: target.id, desiredTile: cheapest }
      }
      // nothing in the band: close the distance (or open it) toward the nearest band tile
      const toward = tiles.reduce((a, b) => (Math.abs(manhattan(b, target.position) - pref.max) < Math.abs(manhattan(a, target.position) - pref.max) ? b : a))
      return { primary: target.id, desiredTile: toward }
    }
    case 'healer': {
      const heals = profile.actions.filter((a) => a.kind === 'heal')
      const [, defReach] = env.rules.combat.aiDefaultPreferredRange.healer
      const reach = heals.length > 0 ? heals.reduce((m, a) => Math.max(m, a.range.max), 0) : (profile.preferredRange?.max ?? defReach)
      const wounded = friendsOf(state, self).filter((u) => u.hp.current < u.hp.max)
      const patient = argmin(wounded, (u) => u.hp.current / u.hp.max)
      if (patient !== null && reach > 0) {
        if (manhattan(here, patient.position) <= reach) return { primary: patient.id, desiredTile: here }
        const near = tiles.filter((t) => manhattan(t, patient.position) <= reach)
        const seat = near.length > 0
          ? near.reduce((a, b) => ((stand[b]?.length ?? 0) < (stand[a]?.length ?? 0) ? b : a))
          : tiles.reduce((a, b) => (manhattan(b, patient.position) < manhattan(a, patient.position) ? b : a))
        return { primary: patient.id, desiredTile: seat }
      }
      // nobody to mend: keep away from the nearest foe, watching the furthest one
      const furthest = foes.reduce((a, b) => (manhattan(here, b.position) > manhattan(here, a.position) ? b : a))
      const safest = tiles.reduce((a, b) => (nearestFoeDistance(b, foes) > nearestFoeDistance(a, foes) ? b : a))
      return { primary: furthest.id, desiredTile: safest }
    }
  }
}

function nearestFoeDistance(tile: TileKey, foes: readonly PlacedUnit[]): number {
  return foes.reduce((m, f) => Math.min(m, manhattan(tile, f.position)), Number.POSITIVE_INFINITY)
}

/** An `EnemyAction` as a `PlayableCard` so `resolvePlay` serves enemies too (§7.21). */
export function actionAsPlay(action: EnemyAction, actor: CombatUnit): PlayableCard {
  void actor
  const aoe = action.aoeRadius ?? 0
  switch (action.kind) {
    case 'attack': {
      const target = aoe > 0 ? 'area' : 'target'
      const effects: CardEffect[] = [{ kind: 'Damage', target, base: action.amount, damageType: action.damageStat === 'mag' ? 'magic' : 'physical' }]
      if (action.applyStatus !== undefined) effects.push({ kind: 'ApplyStatus', target, effectId: action.applyStatus.effectId, value: action.applyStatus.value, turns: action.applyStatus.turns })
      // `PlayableCard.damageStat` is optional, the profile's is nullable: only carry a real stat
      return { apCost: 0, range: action.range, targetKind: 'enemy', aoeRadius: aoe, ...(action.damageStat === null ? {} : { damageStat: action.damageStat }), effects }
    }
    case 'heal':
      return { apCost: 0, range: action.range, targetKind: 'ally', aoeRadius: 0, effects: [{ kind: 'Heal', target: 'target', amount: action.amount }] }
    case 'buff': {
      const rider = action.applyStatus
      const effects: CardEffect[] = rider === undefined ? [] : [{ kind: 'ApplyStatus', target: 'ally', effectId: rider.effectId, value: rider.value, turns: rider.turns }]
      return { apCost: 0, range: { min: 0, max: 0 }, targetKind: 'self', aoeRadius: aoe, effects }
    }
  }
}

/** Via `damage.forecast(state, attackerId, { card: actionAsPlay(action, actor), mod: null }, targetId, env)` — cover-aware, so Oak changes the AI's pick.
 *  `bestTile` folds it over `targeting.recipients`, so this is the ONE path from a planner score to a damage number. */
export function expectedDamage(state: CombatState, attackerId: UnitId, action: EnemyAction, targetId: UnitId, env: EngineEnv): number {
  const actor = state.units[attackerId]
  if (actor === undefined) return 0
  const f = forecast(state, attackerId, { card: actionAsPlay(action, actor), mod: null }, targetId, env)
  return f === null ? 0 : f.hpLost
}

/** The HP a `heal` action would actually restore on `targetId` — 0 on a unit already at full. */
function expectedHeal(state: CombatState, healerId: UnitId, action: EnemyAction, targetId: UnitId, env: EngineEnv): number {
  const actor = state.units[healerId]
  if (actor === undefined) return 0
  const f = forecast(state, healerId, { card: actionAsPlay(action, actor), mod: null }, targetId, env)
  return f === null ? 0 : f.heal
}

function targetTilesFor(state: CombatState, self: CombatUnit, action: EnemyAction, env: EngineEnv): readonly TileKey[] {
  if (action.kind === 'buff') return self.position === null ? [] : [self.position]
  return legalTargets(state, self.id, actionAsPlay(action, self), env)
}

/** Situation filter + post-move range filter. Every situation is judged on the units the action can actually REACH. */
export function eligibleActions(state: CombatState, unitId: UnitId, env: EngineEnv): readonly EnemyAction[] {
  const self = state.units[unitId]
  if (self === undefined || self.position === null || !isLiving(self)) return []
  const profile = profileFor(self, env)
  if (profile === null) return []
  return profile.actions.filter((a) => {
    const tiles = targetTilesFor(state, self, a, env)
    if (tiles.length === 0) return false
    switch (a.situation) {
      case 'always': return true
      case 'self_low_hp': return lowHp(self, env)
      // a wounded friend two rooms away is not a reason to cast: only the ones this action can land on count
      case 'ally_wounded': return tiles.some((t) => {
        const u = unitAt(state, t)
        return u !== null && u.hp.current < u.hp.max
      })
      case 'target_low_hp': return tiles.some((t) => {
        const u = unitAt(state, t)
        return u !== null && lowHp(u, env)
      })
    }
  })
}

/**
 * The best CENTRE for a chosen action, scored over its whole recipient set: kills first, then the total HP the blow
 * takes off (or restores), then the frailest unit on the centre tile, then tile order. An `aoeRadius` attack is
 * therefore centred where it catches the most party units, not on whoever happens to stand on the tile.
 * Returns null when a heal would restore nothing, so `planEnemyStep` spends the turn on something else.
 *
 * TAUNT is a HARD filter applied before the score, not a bonus: if any reachable centre lands the blow on a
 * taunting foe, only those centres stay in the running, and the score then picks among THEM. Movement already
 * honoured it (`pickTarget`); targeting ignoring it made Cover buy nothing — the enemy walked to the tank and
 * shot past it at the frailest unit behind (the module header has always promised "→ taunters else …").
 */
function bestTile(state: CombatState, self: CombatUnit, action: EnemyAction, env: EngineEnv): TileKey | null {
  const tiles = targetTilesFor(state, self, action, env)
  if (tiles.length === 0) return null
  if (action.kind === 'buff') return tiles[0] ?? null
  const card = actionAsPlay(action, self)
  const selector: EffectTarget = action.kind === 'attack' && (card.aoeRadius ?? 0) > 0 ? 'area' : 'target'
  const scored = tiles.map((tile) => {
    let value = 0
    let kills = 0
    let taunted = false
    for (const r of recipients(state, self.id, tile, card, selector)) {
      if (action.kind === 'heal') {
        value += expectedHeal(state, self.id, action, r.id, env)
        continue
      }
      const dmg = expectedDamage(state, self.id, action, r.id, env)
      value += dmg
      // `forecast` caps hpLost at the (possibly redirected) target's HP, so equality IS the kill
      const struck = state.units[resolveCoverTarget(state, self.id, r.id, env).targetId]
      if (struck !== undefined && dmg >= struck.hp.current) kills += 1
      // aimed at a taunter, or redirected onto one by Genatsvale — either way the taunt got its blow
      if (r.team !== self.team && (isTaunting(r) || (struck !== undefined && struck.team !== self.team && isTaunting(struck)))) taunted = true
    }
    const centre = unitAt(state, tile)
    return { tile, kills, value, frailty: centre === null ? 0 : -centre.hp.current, taunted }
  })
  const viable = action.kind === 'heal' ? scored.filter((s) => s.value > 0) : scored
  if (viable.length === 0) return null
  const taunting = viable.filter((s) => s.taunted)
  const pool = taunting.length > 0 ? taunting : viable
  const sorted = [...pool].sort((a, b) => b.kills - a.kills || b.value - a.value || b.frailty - a.frailty || (a.tile < b.tile ? -1 : 1))
  return sorted[0]?.tile ?? null
}

/**
 * `knobs.enemyActionBudget`: DECISIONS' one action per turn, or AP-priced. The AP branch prices an action at
 * `max(1, enemyActionApCost)` and caps the turn at the actions that price buys, so an `enemyActionApCost: 0` knob
 * — which the reducer would deduct nothing for — cannot pump `combat/enemyStep` forever.
 */
function hasBudget(self: CombatUnit, env: EngineEnv): boolean {
  if (env.rules.knobs.enemyActionBudget === 1) return self.actionsTaken === 0
  const cost = Math.max(1, env.rules.combat.enemyActionApCost)
  return self.ap >= cost && self.actionsTaken < Math.ceil(env.rules.combat.apPerTurn / cost)
}

interface ActionOption {
  readonly action: EnemyAction
  readonly tile: TileKey
}

/** Does the blow this option lands actually fall on a taunting foe (aimed at one, or redirected onto one by
 *  Genatsvale)? The same reading `bestTile` scores with — factored out so the filter below and the tile choice
 *  can never drift apart. */
function landsOnTaunter(state: CombatState, self: CombatUnit, option: ActionOption, env: EngineEnv): boolean {
  const card = actionAsPlay(option.action, self)
  const selector: EffectTarget = (card.aoeRadius ?? 0) > 0 ? 'area' : 'target'
  for (const r of recipients(state, self.id, option.tile, card, selector)) {
    if (r.team === self.team) continue
    if (isTaunting(r)) return true
    const struck = state.units[resolveCoverTarget(state, self.id, r.id, env).targetId]
    if (struck !== undefined && struck.team !== self.team && isTaunting(struck)) return true
  }
  return false
}

/**
 * The eligible actions that have a centre worth taking — the draw pool for step B.
 *
 * A TAUNT claims the enemy's whole attack, not merely its preference. `bestTile` already refuses to aim past a
 * taunter it can reach; this is the other half of the same rule — an enemy that cannot land a blow on ANY taunting
 * foe does not land one on somebody else, it closes instead (`pickTarget` already walks it at the taunter). The
 * contract's "a taunt never invents reach" (0050) still holds: nothing here extends a range or a movement, and a
 * taunter the pack can reach is struck exactly as before. What changes is the turn a taunter cannot be reached on,
 * which used to be spent on the frailest unit behind him from a tile the walk had gained nothing on — the tank's
 * one defensive verb reading as a no-op from the chair (RE-GATE C 3.19).
 *
 * Only ATTACKS are claimed. A taunt is a provocation, not a stun: an enemy healer still mends its wounded and a
 * buffer still buffs, so a pack cannot be shut down entire by one card.
 */
function actionOptions(state: CombatState, self: CombatUnit, env: EngineEnv): readonly ActionOption[] {
  const options = eligibleActions(state, self.id, env)
    .map((action) => ({ action, tile: bestTile(state, self, action, env) }))
    .filter((o): o is ActionOption => o.tile !== null)
  if (!foesOf(state, self).some(isTaunting)) return options
  return options.filter((o) => o.action.kind !== 'attack' || landsOnTaunter(state, self, o, env))
}

/** The same pool as if `self` were standing on `tile` — what a candidate move would leave it able to do. */
function actionOptionsAt(state: CombatState, self: PlacedUnit, tile: TileKey, env: EngineEnv): readonly ActionOption[] {
  if (tile === self.position) return actionOptions(state, self, env)
  const moved: CombatState = { ...state, units: { ...state.units, [self.id]: { ...self, position: tile } } }
  return actionOptions(moved, moved.units[self.id] ?? self, env)
}

/** The stand tile closest to `goal` by WALKING distance (§7.4 distance field, living units are walls); null when the flood never improves on standing still. */
function stepAlong(state: CombatState, self: PlacedUnit, stand: Readonly<Record<TileKey, readonly TileKey[]>>, goal: TileKey): TileKey | null {
  const field = distanceField(state.grid, goal, occupiedTiles(state.units, self.id), self.position)
  let best: TileKey | null = null
  let bestD = field[self.position] ?? Number.POSITIVE_INFINITY
  for (const tile of Object.keys(stand)) {
    if (tile === self.position) continue
    const d = field[tile]
    if (d === undefined) continue
    if (d < bestD || (d === bestD && best !== null && (stand[tile]?.length ?? 0) < (stand[best]?.length ?? 0))) {
      best = tile
      bestD = d
    }
  }
  return best
}

/** Last resort when every flood is walled off: close on the nearest foe by `manhattan` so a plugged corridor still
 *  gets the unit onto the blocker (§7.4 — freezing in place is the bug this AI exists to avoid). */
function stepTowardNearestFoe(state: CombatState, self: PlacedUnit, stand: Readonly<Record<TileKey, readonly TileKey[]>>): TileKey | null {
  const here = self.position
  const target = argmin(foesOf(state, self), (f) => manhattan(here, f.position))
  if (target === null) return null
  let best: TileKey | null = null
  let bestD = manhattan(here, target.position)
  for (const tile of [...Object.keys(stand)].sort()) {
    if (tile === self.position) continue
    const d = manhattan(tile, target.position)
    if (d < bestD) {
      best = tile
      bestD = d
    }
  }
  return best
}

/** Pure over (state, combat.rng). The reducer writes `rng` back BEFORE applying the step. */
export function planEnemyStep(state: CombatState, env: EngineEnv): { readonly step: AiStep; readonly rng: RngState } {
  const self = state.units[state.turn.unitId]
  const end = { step: { kind: 'endTurn' } as const, rng: state.rng }
  if (self === undefined || self.position === null || !isLiving(self) || self.team !== 'enemy') return end
  const profile = profileFor(self, env)
  if (profile === null) return end
  const placed: PlacedUnit = { ...self, position: self.position }
  const optionsHere = hasBudget(self, env) ? actionOptions(state, self, env) : []

  // A. the free move, toward the role's desired tile, along the distance field (a banned-revisit BFS, §7.4)
  if (!self.hasMovedThisTurn && !isImmobilized(self)) {
    const { primary, desiredTile } = pickTarget(state, self, profile, env)
    if (desiredTile !== null && desiredTile !== placed.position) {
      const stand = standTiles(state, placed, profile.movement)
      const direct = stand[desiredTile]
      const primaryTile = primary === null ? null : state.units[primary]?.position ?? null
      const to = direct !== undefined && direct.length > 0
        ? desiredTile
        : stepAlong(state, placed, stand, desiredTile)
          ?? (primaryTile === null ? null : stepAlong(state, placed, stand, primaryTile))
          ?? stepTowardNearestFoe(state, placed, stand)
      const path = to === null ? undefined : stand[to]
      if (to !== null && path !== undefined && path.length > 0) {
        // never walk out of a blow: a move that costs the turn's only action is not worth the ground
        const keepsAction = optionsHere.length === 0 || actionOptionsAt(state, placed, to, env).length > 0
        if (keepsAction) return { step: { kind: 'move', to, path }, rng: state.rng }
      }
    }
  }

  // B. one action within budget, weighted by the profile — only actions with a tile worth taking are in the draw
  if (optionsHere.length > 0) {
    const r = createRng(state.rng)
    const total = optionsHere.reduce((sum, o) => sum + o.action.weight, 0)
    let cursor = r.nextInt(1, total)
    let picked = optionsHere[optionsHere.length - 1]!
    for (const o of optionsHere) {
      if (cursor <= o.action.weight) {
        picked = o
        break
      }
      cursor -= o.action.weight
    }
    return { step: { kind: 'act', actionId: picked.action.id, tile: picked.tile }, rng: rngState(r) }
  }

  // C. nothing left to do
  return end
}

/** CLI/tests: loop `planEnemyStep` + `reduceCombat` until the enemy's turn ends. */
export function planEnemyTurn(state: CombatState, env: EngineEnv): { readonly actions: readonly CombatAction[]; readonly state: CombatState } {
  const actions: CombatAction[] = []
  let st = state
  const unitId = st.turn.unitId
  for (let guard = 0; guard < 16; guard++) {
    const active = st.units[st.turn.unitId]
    if (st.phase !== 'combat' || active === undefined || active.team !== 'enemy' || st.turn.unitId !== unitId) break
    const step: CombatAction = { type: 'combat/enemyStep' }
    const r = reduceCombat(st, step, env)
    if (r.effects.some((e) => e.kind === 'refused')) throw new Error(`combat/ai: enemyStep refused for ${unitId} — planner and reducer disagree`)
    actions.push(step)
    st = r.state
  }
  return { actions, state: st }
}
