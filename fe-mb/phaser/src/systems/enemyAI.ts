import type { CombatState, CombatEvent } from '../domain/combatState'
import type { RNG } from '../domain/rng'
import type { UnitId } from '../domain/ids'
import type { Unit } from '../domain/unit'
import type { EnemyAction, EnemyClassAI } from '../domain/enemyAI'
import { asCardId, asTileId } from '../domain/ids'
import { isEnemyUnit } from './team'
import banditAI from '../data/content/enemyAI/bandit.json'
import banditArcherAI from '../data/content/enemyAI/bandit_archer.json'
import banditPriestAI from '../data/content/enemyAI/bandit_priest.json'
import warlordAI from '../data/content/enemyAI/warlord.json'
import wolfAI from '../data/content/enemyAI/wolf.json'
import alphaWolfAI from '../data/content/enemyAI/alpha_wolf.json'
import shieldKnightAI from '../data/content/enemyAI/shield_knight.json'
import raiderMageAI from '../data/content/enemyAI/raider_mage.json'
import raiderClericAI from '../data/content/enemyAI/raider_cleric.json'
import thiefAI from '../data/content/enemyAI/thief.json'
import emberMageAI from '../data/content/enemyAI/ember_mage.json'

export const AI_BY_CLASS: Record<string, EnemyClassAI> = {
  bandit: banditAI as EnemyClassAI,
  bandit_archer: banditArcherAI as EnemyClassAI,
  bandit_priest: banditPriestAI as EnemyClassAI,
  warlord: warlordAI as EnemyClassAI,
  wolf: wolfAI as EnemyClassAI,
  alpha_wolf: alphaWolfAI as EnemyClassAI,
  shield_knight: shieldKnightAI as EnemyClassAI,
  raider_mage: raiderMageAI as EnemyClassAI,
  raider_cleric: raiderClericAI as EnemyClassAI,
  thief: thiefAI as EnemyClassAI,
  ember_mage: emberMageAI as EnemyClassAI,
}

const tileXY = (t: string): [number, number] => {
  const [xs, ys] = t.split(',')
  return [parseInt(xs!, 10), parseInt(ys!, 10)]
}

const manhattan = (a: string, b: string): number => {
  const [ax, ay] = tileXY(a)
  const [bx, by] = tileXY(b)
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

const partyAlive = (state: CombatState): Unit[] =>
  Object.values(state.units).filter(
    (u) => u.hp.current > 0 && u.position && !isEnemyUnit(u),
  )

const enemiesAlive = (state: CombatState, exceptId?: UnitId): Unit[] =>
  Object.values(state.units).filter(
    (u) =>
      u.hp.current > 0
      && u.position
      && isEnemyUnit(u)
      && (!exceptId || (u.id as unknown as string) !== (exceptId as unknown as string)),
  )

const tileOccupied = (state: CombatState, tile: string): boolean =>
  Object.values(state.units).some(
    (u) => u.hp.current > 0 && u.position && (u.position as unknown as string) === tile,
  )

const inBounds = (state: CombatState, tile: string): boolean => {
  const [x, y] = tileXY(tile)
  if (x < 0 || y < 0 || x >= state.grid.width || y >= state.grid.height) return false
  return !state.grid.obstacles.has(asTileId(tile))
}

interface RoleTargets {
  /** Whom we want to act on (attack target / heal target). */
  primary: Unit | null
  /** Where we want to stand by end of move phase. */
  desiredPosition: string | null
}

/** Party units holding an active taunt — they MUST be attacked first. */
function tauntersOf(units: Unit[]): Unit[] {
  return units.filter(u => u.statuses.some(
    st => (st.effectId as unknown as string) === 'taunt' && st.turnsRemaining > 0,
  ))
}

function pickRoleTargets(state: CombatState, ai: EnemyClassAI, self: Unit): RoleTargets {
  const myPos = self.position as unknown as string
  switch (ai.role) {
    case 'rusher':
    case 'tank': {
      let enemies = partyAlive(state)
      if (enemies.length === 0) return { primary: null, desiredPosition: null }
      // Taunt (Knight anchor role): taunting units draw ALL melee attention.
      const taunters = tauntersOf(enemies)
      if (taunters.length > 0) enemies = taunters
      // Lowest-HP first, then closest
      let best = enemies[0]!
      let bestScore = best.hp.current * 100 + manhattan(myPos, best.position as unknown as string)
      for (const u of enemies.slice(1)) {
        const score = u.hp.current * 100 + manhattan(myPos, u.position as unknown as string)
        if (score < bestScore) { best = u; bestScore = score }
      }
      // Desired position: any tile orthogonally adjacent to the target
      const targetPos = best.position as unknown as string
      const [tx, ty] = tileXY(targetPos)
      const neighbours = [
        `${tx - 1},${ty}`,
        `${tx + 1},${ty}`,
        `${tx},${ty - 1}`,
        `${tx},${ty + 1}`,
      ].filter((t) => inBounds(state, t) && (!tileOccupied(state, t) || t === myPos))
      // Prefer the one closest to current position
      neighbours.sort((a, b) => manhattan(myPos, a) - manhattan(myPos, b))
      return { primary: best, desiredPosition: neighbours[0] ?? null }
    }
    case 'archer': {
      let enemies = partyAlive(state)
      if (enemies.length === 0) return { primary: null, desiredPosition: null }
      const taunters = tauntersOf(enemies)
      if (taunters.length > 0) enemies = taunters
      let best = enemies[0]!
      let bestDist = manhattan(myPos, best.position as unknown as string)
      for (const u of enemies.slice(1)) {
        const d = manhattan(myPos, u.position as unknown as string)
        if (d < bestDist) { best = u; bestDist = d }
      }
      // Desired position: at preferredRange from target
      const targetPos = best.position as unknown as string
      const [tx, ty] = tileXY(targetPos)
      const pref = ai.preferredRange ?? { min: 2, max: 3 }
      // Search nearby tiles for one whose distance to target is in pref range,
      // and that's reachable in fewer steps than other candidates.
      const candidates: { tile: string; cost: number }[] = []
      for (let dx = -ai.movement; dx <= ai.movement; dx++) {
        for (let dy = -ai.movement; dy <= ai.movement; dy++) {
          const cand = `${tx + dx},${ty + dy}`
          const dToTarget = Math.abs(dx) + Math.abs(dy)
          if (dToTarget < pref.min || dToTarget > pref.max) continue
          if (!inBounds(state, cand)) continue
          if (tileOccupied(state, cand) && cand !== myPos) continue
          const moveCost = manhattan(myPos, cand)
          candidates.push({ tile: cand, cost: moveCost })
        }
      }
      candidates.sort((a, b) => a.cost - b.cost)
      return {
        primary: best,
        desiredPosition: candidates[0]?.tile ?? null,
      }
    }
    case 'healer': {
      // Heal lowest-HP wounded ally (other enemy unit) within preferredRange.
      const allies = enemiesAlive(state, self.id).filter((u) => u.hp.current < u.hp.max)
      const woundedAlly = allies.length > 0
        ? allies.reduce((best, u) => (u.hp.current / u.hp.max < best.hp.current / best.hp.max ? u : best), allies[0]!)
        : null
      if (woundedAlly) {
        const targetPos = woundedAlly.position as unknown as string
        const pref = ai.preferredRange ?? { min: 1, max: 2 }
        const [tx, ty] = tileXY(targetPos)
        const candidates: { tile: string; cost: number }[] = []
        for (let dx = -ai.movement; dx <= ai.movement; dx++) {
          for (let dy = -ai.movement; dy <= ai.movement; dy++) {
            const cand = `${tx + dx},${ty + dy}`
            const dToAlly = Math.abs(dx) + Math.abs(dy)
            if (dToAlly < pref.min || dToAlly > pref.max) continue
            if (!inBounds(state, cand)) continue
            if (tileOccupied(state, cand) && cand !== myPos) continue
            candidates.push({ tile: cand, cost: manhattan(myPos, cand) })
          }
        }
        candidates.sort((a, b) => a.cost - b.cost)
        return { primary: woundedAlly, desiredPosition: candidates[0]?.tile ?? null }
      }
      // No wounded ally — keep distance from party and curse them
      const party = partyAlive(state)
      if (party.length === 0) return { primary: null, desiredPosition: null }
      let furthest = party[0]!
      let furthestDist = manhattan(myPos, furthest.position as unknown as string)
      for (const u of party.slice(1)) {
        const d = manhattan(myPos, u.position as unknown as string)
        if (d > furthestDist) { furthest = u; furthestDist = d }
      }
      return { primary: furthest, desiredPosition: null }   // curse from current position
    }
  }
}

const orthNeighbours = (tile: string): string[] => {
  const [x, y] = tileXY(tile)
  return [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`]
}

/**
 * Step `self.position` one tile toward `dest`, routing AROUND blockers.
 *
 * Distance is a BFS field flooded from `dest` over unoccupied tiles (living
 * units are walls; corpses are not; `dest` itself is allowed occupied — it is
 * usually the target's own tile). The step taken is the free neighbour with
 * the strictly smallest field value, so movement always makes real progress
 * and terminates.
 *
 * Why not Manhattan: the old axis-only version froze the moment one party
 * unit stood on the single approach tile (the "melee AI permanently stalls"
 * playtest P1 — enemies passed every turn for 12+ rounds), and even a
 * Manhattan-based sidestep cannot escape geometries where every legal detour
 * momentarily INCREASES straight-line distance. Board is 14×10; the flood is
 * ~140 cells, dispatched a handful of times per enemy turn — cheap.
 */
function stepToward(
  state: CombatState,
  fromTile: string,
  dest: string,
  banned?: ReadonlySet<string>,
): string | null {
  const dist = new Map<string, number>()
  dist.set(dest, 0)
  const queue = [dest]
  while (queue.length > 0) {
    const t = queue.shift()!
    const d = dist.get(t)!
    for (const n of orthNeighbours(t)) {
      if (dist.has(n) || !inBounds(state, n)) continue
      // fromTile is the mover itself — it must receive a field value even
      // though it is "occupied", or the mover could never read its own cell.
      if (n !== fromTile && tileOccupied(state, n)) continue
      dist.set(n, d + 1)
      queue.push(n)
    }
  }
  const here = dist.get(fromTile)
  if (here === undefined) return null // fully walled off — genuinely stuck
  const best = orthNeighbours(fromTile)
    .filter(c => inBounds(state, c) && !tileOccupied(state, c) && !banned?.has(c) && dist.has(c))
    .map(c => ({ tile: c, d: dist.get(c)! }))
    .sort((a, b) => a.d - b.d)[0]
  return best && best.d < here ? best.tile : null
}

interface ActionContext {
  self: Unit
  primary: Unit | null
  selfPosAfterMove: string
}

function isSituationMatch(action: EnemyAction, ctx: ActionContext): boolean {
  if (!action.situation || action.situation === 'always') return true
  if (action.situation === 'self_low_hp') {
    return ctx.self.hp.current / ctx.self.hp.max < 0.4
  }
  if (action.situation === 'target_low_hp' && ctx.primary) {
    return ctx.primary.hp.current / ctx.primary.hp.max < 0.4
  }
  if (action.situation === 'ally_wounded' && ctx.primary) {
    return ctx.primary.hp.current < ctx.primary.hp.max
  }
  return false
}

function pickAction(actions: EnemyAction[], ctx: ActionContext, distToTarget: number, rng: RNG): EnemyAction | null {
  const eligible = actions.filter(
    (a) =>
      isSituationMatch(a, ctx)
      && distToTarget >= a.range.min
      && distToTarget <= a.range.max,
  )
  if (eligible.length === 0) return null
  const total = eligible.reduce((s, a) => s + a.weight, 0)
  if (total <= 0) return eligible[0] ?? null
  let roll = rng.nextInt(0, total - 1)
  for (const a of eligible) {
    if (roll < a.weight) return a
    roll -= a.weight
  }
  return eligible[0] ?? null
}

/**
 * Plans an enemy unit's full turn worth of CombatEvents.
 *
 * Strategy is role-driven:
 *   - rusher / tank: rush nearest party unit, attack adjacent
 *   - archer: stay at preferredRange, kite if pressed
 *   - healer: heal lowest-HP ally; otherwise curse from distance
 *
 * Movement is multi-step (up to ai.movement tiles per turn). After moving,
 * the planner picks an action whose range matches current distance to
 * target; weight is filtered by `situation` (self_low_hp, target_low_hp,
 * ally_wounded). Falls back to endTurn if no eligible action.
 */
export function planTurn(state: CombatState, rng: RNG, enemyId: UnitId): CombatEvent[] {
  const events: CombatEvent[] = []
  const enemyKey = enemyId as unknown as string
  const self = state.units[enemyKey]
  if (!self || !self.position || self.hp.current <= 0) {
    return [{ type: 'endTurn' as const }]
  }

  const ai = AI_BY_CLASS[self.classId as unknown as string] ?? AI_BY_CLASS['bandit']!
  const targets = pickRoleTargets(state, ai, self)
  if (!targets.primary) return [{ type: 'endTurn' as const }]

  // Walk toward desiredPosition; use a single moveUnit with the final tile
  // so the BoardScene plays one continuous walk animation (path computed
  // visually). The reducer just teleports — the animation is cosmetic.
  let pos = self.position as unknown as string
  const dest = targets.desiredPosition ?? (targets.primary.position as unknown as string)
  const walked = new Set<string>([pos])
  for (let step = 0; step < ai.movement; step++) {
    if (pos === dest) break
    const next = stepToward(state, pos, dest, walked)
    if (!next) break
    pos = next
    walked.add(next)
  }
  if (pos !== (self.position as unknown as string)) {
    events.push({
      type: 'moveUnit',
      payload: { unitId: enemyId, tileId: asTileId(pos) },
    })
  }

  // Pick action. Distance is to PRIMARY target (the unit we want to affect).
  const targetPos = targets.primary.position as unknown as string
  const distToTarget = manhattan(pos, targetPos)
  const ctx: ActionContext = { self, primary: targets.primary, selfPosAfterMove: pos }
  const action = pickAction(ai.actions, ctx, distToTarget, rng)

  if (action) {
    const cardId = asCardId(`${ai.classId}_${action.id}` as unknown as string)
    const damageStatField = action.damageStat ? { damageStat: action.damageStat } : {}
    const effectKind = action.kind === 'heal' ? 'Heal' : 'Damage'
    const effectParams = action.kind === 'heal'
      ? { amount: action.amount }
      : { base: action.amount }
    events.push({
      type: 'playCard',
      payload: {
        cardId,
        srcId: enemyId,
        targets: [asTileId(targetPos)],
        card: {
          apCost: 1,
          ...damageStatField,
          // AI attacks target foes-of-the-enemy (the party); heals target kin.
          targetKind: action.kind === 'heal' ? 'ally' : 'enemy',
          ...(action.aoeRadius ? { aoeRadius: action.aoeRadius } : {}),
          effects: [{ kind: effectKind, params: effectParams }],
        },
      },
    })
  }

  events.push({ type: 'endTurn' as const })
  return events
}
