import type { Unit } from '../domain/unit'

/**
 * Team resolution — single source of truth (closes the CONTEXT.md gotcha
 * about the classId.includes('bandit') heuristic).
 *
 * Explicit `unit.team` wins when present (all seeders set it going forward);
 * the classId-fragment fallback keeps legacy fixtures and old saves working.
 */
const ENEMY_CLASS_FRAGMENTS = ['bandit', 'brigand', 'wolf', 'warlord']

export function isEnemyUnit(u: Pick<Unit, 'team' | 'classId'>): boolean {
  if (u.team) return u.team === 'enemy'
  const cid = u.classId as unknown as string
  return ENEMY_CLASS_FRAGMENTS.some((f) => cid.includes(f))
}
