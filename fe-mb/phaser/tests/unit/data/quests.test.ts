import { describe, it, expect } from 'vitest'
import { QuestSchema } from '../../../src/data/schemas/quest'
import bloodTies from '../../../src/data/content/quests/blood_ties.json'

describe('ported quests (GP-B5)', () => {
  it('blood_ties.json passes QuestSchema', () => {
    const r = QuestSchema.safeParse(bloodTies)
    if (!r.success) {
      console.error('blood_ties errors:', JSON.stringify(r.error.format(), null, 2))
    }
    expect(r.success).toBe(true)
  })

  it('blood_ties has stages: find_daren, daren_resolved, __complete__', () => {
    const stages = (bloodTies as { stages: Record<string, unknown> }).stages
    expect(stages.find_daren).toBeDefined()
    expect(stages.daren_resolved).toBeDefined()
    expect(stages.__complete__).toBeDefined()
  })
})
