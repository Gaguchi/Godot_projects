import { describe, it, expect } from 'vitest'
import { captureChance } from '../../../src/systems/capture'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mk = (cur: number, max: number): Unit => ({
  id: asUnitId('e'), name: 'e', classId: asClassId('bandit'), level: 1,
  hp: { current: cur, max }, stats: { str: 0, mag: 0, skl: 0, spd: 0, def: 0, res: 0 },
  hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
})

describe('captureChance', () => {
  it('full HP, no surround, no bounty = 0', () => {
    expect(captureChance({ target: mk(20, 20), adjacentAttackers: 0, bountyHunterBonus: false })).toBe(0)
  })

  it('low HP increases chance', () => {
    const a = captureChance({ target: mk(2, 20), adjacentAttackers: 0, bountyHunterBonus: false })
    expect(a).toBeGreaterThan(0.5)
  })

  it('surround adds 25% per adjacent attacker', () => {
    const a = captureChance({ target: mk(20, 20), adjacentAttackers: 2, bountyHunterBonus: false })
    expect(a).toBeCloseTo(0.5)
  })

  it('bounty hunter adds 15%', () => {
    const a = captureChance({ target: mk(20, 20), adjacentAttackers: 0, bountyHunterBonus: true })
    expect(a).toBeCloseTo(0.15)
  })

  it('clamps to [0,1]', () => {
    const a = captureChance({ target: mk(0, 20), adjacentAttackers: 4, bountyHunterBonus: true })
    expect(a).toBe(1)
  })
})
