import { describe, it, expect } from 'vitest'
import { EncounterTableSchema, EnemyGroupSchema } from '../../../src/data/schemas/encounter'

import borderlands from '../../../src/data/content/encounters/borderlands_road.json'
import thornwood from '../../../src/data/content/encounters/thornwood_path.json'
import ashfall from '../../../src/data/content/encounters/ashfall_track.json'

import bandits from '../../../src/data/content/enemyGroups/bandits.json'
import wolves from '../../../src/data/content/enemyGroups/wolves.json'
import brigands from '../../../src/data/content/enemyGroups/brigands.json'
import darens from '../../../src/data/content/enemyGroups/darens_gang.json'
import shieldWall from '../../../src/data/content/enemyGroups/shield_wall.json'
import mageCircle from '../../../src/data/content/enemyGroups/mage_circle.json'
import wolfAlphaPack from '../../../src/data/content/enemyGroups/wolf_alpha_pack.json'
import thornwoodAmbush from '../../../src/data/content/enemyGroups/thornwood_ambush.json'
import ashfallRaiders from '../../../src/data/content/enemyGroups/ashfall_raiders.json'

describe('encounter content (GP-C4)', () => {
  it('all 3 encounter tables parse', () => {
    for (const table of [borderlands, thornwood, ashfall]) {
      const r = EncounterTableSchema.safeParse(table)
      if (!r.success) console.error(`${table.id} errors:`, JSON.stringify(r.error.format(), null, 2))
      expect(r.success).toBe(true)
    }
  })

  it('all 9 enemy groups parse', () => {
    for (const group of [bandits, wolves, brigands, darens, shieldWall, mageCircle, wolfAlphaPack, thornwoodAmbush, ashfallRaiders]) {
      const r = EnemyGroupSchema.safeParse(group)
      if (!r.success) console.error(`${group.id} errors:`, JSON.stringify(r.error.format(), null, 2))
      expect(r.success).toBe(true)
    }
  })

  it('borderlands table references valid enemy group ids', () => {
    const groupIds = new Set([
      bandits.id, wolves.id, brigands.id, darens.id,
      shieldWall.id, mageCircle.id, wolfAlphaPack.id, thornwoodAmbush.id, ashfallRaiders.id,
    ])
    for (const entry of borderlands.entries) {
      const outcome = entry.outcome as { kind: string; enemyGroupId?: string }
      if (outcome.kind === 'battle' && outcome.enemyGroupId) {
        expect(groupIds.has(outcome.enemyGroupId)).toBe(true)
      }
    }
  })
})
