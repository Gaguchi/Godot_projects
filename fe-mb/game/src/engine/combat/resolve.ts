/**
 * combat/resolve.ts — the run-agnostic half of resolution (brief §2.8, §7.30).
 * gold = Σ killGold(level) over DEAD non-captured enemies; captured → Prisoner rows (name, bountyValue);
 * survivorHp for living party units; fallen; consumedItems; capturedIds; survivingEnemyIds; the board's own
 * `captureTargets` (resolved at payout — a quest/dungeon fight has them too, CONTRACT-CHANGES 0030).
 * NO loot here (it needs the run's bag) — `run/battle.ts#applyBattleResult` rolls it.
 */
import type { BattleField, BattleResult, CombatState, EngineEnv, UnitId } from '../types'
import { isLiving } from './grid'

/** base + perLevel·L (rules.economy.killGold). */
export function killGold(level: number, env: EngineEnv): number {
  const k = env.rules.economy.killGold
  return k.base + k.perLevel * level
}

/** Requires `state.phase !== 'combat'`. */
export function resolveBattle(state: CombatState, env: EngineEnv): BattleResult {
  if (state.phase === 'combat') throw new Error('combat/resolve: the battle has not ended')
  const units = Object.values(state.units)
  const enemies = units.filter((u) => u.team === 'enemy')
  const party = units.filter((u) => u.team === 'party')
  // Captives pay no kill gold (§2.6) and are never "defeated": the three enemy buckets are disjoint.
  const dead = enemies.filter((e) => !e.captured && e.hp.current <= 0)
  const captured = enemies.filter((e) => e.captured)
  const surviving = enemies.filter(isLiving)
  const survivors = party.filter(isLiving)
  const fallen = party.filter((p) => !isLiving(p))
  const survivorHp: Record<UnitId, number> = {}
  for (const p of survivors) survivorHp[p.id] = p.hp.current
  return {
    battleId: state.battleId,
    tag: state.tag,
    origin: state.origin,
    outcome: state.phase === 'victory' ? 'victory' : 'defeat',
    rounds: state.turn.round,
    goldEarned: dead.reduce((gold, e) => gold + killGold(e.level, env), 0),
    enemiesDefeated: dead.length,
    capturedEnemies: captured.map((e) => ({ unitId: e.id, name: e.name, classId: e.classId, level: e.level, bountyValue: e.bountyValue, capturedAtBattleId: state.battleId })),
    capturedIds: captured.map((e) => e.id),
    survivingEnemyIds: surviving.map((e) => e.id),
    consumedItems: [...state.consumedItems],
    survivorHp,
    fallen: fallen.map((p) => ({ unitId: p.id, name: p.name, classId: p.classId })),
    captureTargets: [...state.captureTargets],
    field: battleField(state),
  }
}

/** The frozen field for the Field Report: `grid` verbatim + one token per unit at `position ?? lastTile`
 *  (`fallen` = hp 0 and not captured). Built at the same moment as `resolveBattle`. */
export function battleField(state: CombatState): BattleField {
  return {
    grid: state.grid,
    tokens: Object.values(state.units).map((u) => {
      const tile = u.position ?? u.lastTile
      if (tile === null) throw new Error(`combat/resolve: unit '${u.id}' has neither a position nor a lastTile`)
      return { unitId: u.id, name: u.name, classId: u.classId, team: u.team, tile, hp: u.hp, armor: u.armor, fallen: u.hp.current <= 0 && !u.captured, captured: u.captured }
    }),
  }
}
