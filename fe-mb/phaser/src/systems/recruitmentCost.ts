/**
 * Recruitment cost formula (closes OQ-3, see docs/research/recruitment-cost.md).
 *
 *   cost = round( baseClassCost(classId) × (1 + (level - 1) × 0.5) × rarity )
 *
 * The base reflects how strong the class is at L1; the level multiplier
 * makes higher-level recruits substantially pricier (a L5 Knight is ~3× a
 * L1 Knight, matching Godot tavern feel). Towns may override with
 * `costOverride` for narrative-driven slots (e.g. quest-recruit-at-zero).
 */

// Per-class L1 baseline. Roughly: melee bruisers cheap, support/mage premium,
// rare classes (Lord) at the high end.
const BASE_COST: Record<string, number> = {
  lord: 220,
  knight: 140,
  mage: 180,
  bandit: 80,
  // Future classes default to 120.
}

export function baseClassCost(classId: string): number {
  return BASE_COST[classId] ?? 120
}

export function recruitmentCost(classId: string, level: number): number {
  const base = baseClassCost(classId)
  const levelMul = 1 + Math.max(0, level - 1) * 0.5
  return Math.round(base * levelMul)
}
