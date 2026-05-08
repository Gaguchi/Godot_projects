import type { Unit } from '../domain/unit'

export interface CaptureContext {
  target: Unit
  adjacentAttackers: number
  bountyHunterBonus: boolean
}

/** Returns chance ∈ [0, 1] of successful capture. */
export function captureChance(ctx: CaptureContext): number {
  const hpFraction = ctx.target.hp.current / Math.max(1, ctx.target.hp.max)
  const base = (1 - hpFraction) * 0.6
  const surround = ctx.adjacentAttackers * 0.25
  const bounty = ctx.bountyHunterBonus ? 0.15 : 0
  return Math.max(0, Math.min(1, base + surround + bounty))
}
