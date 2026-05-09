import { describe, it, expect } from 'vitest'
import { TownDefSchema } from '../../../src/data/schemas/town'
import pineCrossing from '../../../src/data/content/towns/pine_crossing.json'
import riverside from '../../../src/data/content/towns/riverside_market.json'
import southJunction from '../../../src/data/content/towns/south_junction.json'
import borderkeep from '../../../src/data/content/towns/borderkeep_castle.json'
import northernBridge from '../../../src/data/content/towns/northern_bridge.json'

const ALL = [pineCrossing, riverside, southJunction, borderkeep, northernBridge]

describe('ported towns (GP-E2)', () => {
  it('5 towns', () => {
    expect(ALL.length).toBe(5)
  })

  it('every town parses TownDefSchema', () => {
    for (const t of ALL) {
      const r = TownDefSchema.safeParse(t)
      if (!r.success) console.error(t.id, JSON.stringify(r.error.format(), null, 2))
      expect(r.success).toBe(true)
    }
  })

  it('Pine Crossing has Blood Ties tavern quest', () => {
    expect(pineCrossing.tavernQuests.length).toBe(1)
    const quest = pineCrossing.tavernQuests[0]!
    expect(quest.questId).toBe('sq_blood_ties')
    expect(quest.dialogueId).toBe('sq_blood_ties_accept')
  })

  it('inn heal costs increase with region tier', () => {
    expect(pineCrossing.innHealCostPerUnit).toBeLessThanOrEqual(borderkeep.innHealCostPerUnit)
  })

  it('every town has at least 3 rumors', () => {
    for (const t of ALL) {
      expect(t.rumors.length).toBeGreaterThanOrEqual(3)
    }
  })
})
