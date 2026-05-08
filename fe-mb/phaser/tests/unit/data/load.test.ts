import { describe, it, expect } from 'vitest'
import { validateContent } from '../../../src/data/load'

describe('validateContent', () => {
  it('returns ok when all content is valid', () => {
    const r = validateContent({
      cards: [], units: [], items: [], classes: [], quests: [], dialogues: [], battleMaps: [], worldMaps: [],
    })
    expect(r.ok).toBe(true)
  })

  it('aggregates errors across files', () => {
    const r = validateContent({
      cards: [{ id: 'bad' }],   // missing required fields
      units: [], items: [], classes: [], quests: [], dialogues: [], battleMaps: [], worldMaps: [],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0)
  })
})
