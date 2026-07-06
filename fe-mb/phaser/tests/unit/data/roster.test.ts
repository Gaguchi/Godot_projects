import { describe, it, expect } from 'vitest'
import { EncounterTableSchema, EnemyGroupSchema } from '../../../src/data/schemas/encounter'
import { CheckEventSchema } from '../../../src/data/schemas/checkEvent'
import { AI_BY_CLASS } from '../../../src/systems/enemyAI'
import { ENEMY_GROUPS, seedGroupBattle } from '../../../src/game/scenes/seedGroupBattle'
import { buildStarterParty } from '../../../src/systems/starterParty'

import classesJson from '../../../src/data/content/classes.json'

import borderlands from '../../../src/data/content/encounters/borderlands_road.json'
import thornwood from '../../../src/data/content/encounters/thornwood_path.json'
import ashfall from '../../../src/data/content/encounters/ashfall_track.json'

import shieldWall from '../../../src/data/content/enemyGroups/shield_wall.json'
import mageCircle from '../../../src/data/content/enemyGroups/mage_circle.json'
import wolfAlphaPack from '../../../src/data/content/enemyGroups/wolf_alpha_pack.json'
import thornwoodAmbush from '../../../src/data/content/enemyGroups/thornwood_ambush.json'
import ashfallRaiders from '../../../src/data/content/enemyGroups/ashfall_raiders.json'

const NEW_GROUPS = [shieldWall, mageCircle, wolfAlphaPack, thornwoodAmbush, ashfallRaiders]
const TABLES = [borderlands, thornwood, ashfall]

const classIds = new Set(classesJson.map((c) => c.id))

interface OutcomeShape {
  kind: string
  enemyGroupId?: string
  event?: unknown
}

/** Collect every enemyGroupId referenced by a table: battle outcomes plus
 *  startCombat effects nested inside checkEvent choice outcomes. */
function groupRefsOf(table: { entries: { outcome: OutcomeShape }[] }): string[] {
  const refs: string[] = []
  for (const entry of table.entries) {
    if (entry.outcome.kind === 'battle' && entry.outcome.enemyGroupId) {
      refs.push(entry.outcome.enemyGroupId)
    }
    if (entry.outcome.kind === 'checkEvent' && entry.outcome.event) {
      const raw = JSON.stringify(entry.outcome.event)
      for (const m of raw.matchAll(/"kind":"startCombat","enemyGroupId":"([^"]+)"/g)) {
        refs.push(m[1]!)
      }
    }
  }
  return refs
}

describe('enemy roster expansion (ship plan §13, stories 465/466)', () => {
  it('all 5 new enemy groups parse via EnemyGroupSchema', () => {
    for (const group of NEW_GROUPS) {
      const r = EnemyGroupSchema.safeParse(group)
      if (!r.success) console.error(`${group.id} errors:`, JSON.stringify(r.error.format(), null, 2))
      expect(r.success).toBe(true)
    }
  })

  it('every group member classId resolves to a class in classes.json', () => {
    for (const group of Object.values(ENEMY_GROUPS)) {
      for (const member of group.members) {
        expect(classIds.has(member.classId as unknown as string),
          `group '${group.id}': class '${member.classId}' missing from classes.json`).toBe(true)
      }
    }
  })

  it('every enemy class used by a group has an AI registered in AI_BY_CLASS', () => {
    for (const group of Object.values(ENEMY_GROUPS)) {
      for (const member of group.members) {
        expect(AI_BY_CLASS[member.classId as unknown as string],
          `group '${group.id}': class '${member.classId}' has no enemyAI registration`).toBeDefined()
      }
    }
  })

  it('new groups are registered in ENEMY_GROUPS under their own ids', () => {
    for (const group of NEW_GROUPS) {
      expect(ENEMY_GROUPS[group.id]?.id).toBe(group.id)
    }
  })

  it('all 3 encounter tables still parse after roster expansion', () => {
    for (const table of TABLES) {
      const r = EncounterTableSchema.safeParse(table)
      if (!r.success) console.error(`${table.id} errors:`, JSON.stringify(r.error.format(), null, 2))
      expect(r.success).toBe(true)
    }
  })

  it('every table battle/startCombat reference points at a known enemy group', () => {
    for (const table of TABLES) {
      for (const ref of groupRefsOf(table)) {
        expect(ENEMY_GROUPS[ref], `table '${table.id}': unknown enemy group '${ref}'`).toBeDefined()
      }
    }
  })

  it('each new group appears in exactly one region table', () => {
    const placements: Record<string, string[]> = {}
    for (const table of TABLES) {
      for (const ref of groupRefsOf(table)) {
        placements[ref] = [...(placements[ref] ?? []), table.id]
      }
    }
    expect(placements['shield_wall']).toEqual(['borderlands_road'])
    expect(placements['wolf_alpha_pack']).toEqual(['borderlands_road'])
    expect(placements['mage_circle']).toEqual(['thornwood_path'])
    expect(placements['ashfall_raiders']).toEqual(['ashfall_track'])
    // thornwood_ambush: battle entry + two startCombat refs in ambush_toll
    expect(new Set(placements['thornwood_ambush'])).toEqual(new Set(['thornwood_path']))
  })
})

describe('travel event expansion (ship plan §13, story 469)', () => {
  const NEW_EVENT_IDS = [
    'wandering_blacksmith', 'injured_knight',       // borderlands
    'ambush_toll', 'thieves_crossroads',            // thornwood
    'ancient_shrine',                               // ashfall
  ]

  it('all 5 new travel events exist in tables and parse via CheckEventSchema', () => {
    const found = new Map<string, unknown>()
    for (const table of TABLES) {
      for (const entry of table.entries) {
        const outcome = entry.outcome as OutcomeShape
        if (outcome.kind === 'checkEvent' && outcome.event) {
          const ev = outcome.event as { id: string }
          found.set(ev.id, outcome.event)
        }
      }
    }
    for (const id of NEW_EVENT_IDS) {
      expect(found.has(id), `travel event '${id}' not wired into any table`).toBe(true)
      const r = CheckEventSchema.safeParse(found.get(id))
      if (!r.success) console.error(`${id} errors:`, JSON.stringify(r.error.format(), null, 2))
      expect(r.success).toBe(true)
    }
  })
})

describe('seedGroupBattle sanity for new groups', () => {
  it.each([
    ['shield_wall', 2],
    ['mage_circle', 3],
    ['wolf_alpha_pack', 2],
    ['thornwood_ambush', 3],
    ['ashfall_raiders', 5],
  ])('%s seeds units with decks at node level %i', (groupId, nodeLevel) => {
    const evt = seedGroupBattle(groupId, nodeLevel, { seed: 42, counter: 0 }, buildStarterParty())
    const enemies = evt.payload.units.filter((u) => u.team === 'enemy')
    const expectedCount = ENEMY_GROUPS[groupId]!.members.reduce((s, m) => s + m.count, 0)
    expect(enemies.length).toBe(expectedCount)
    for (const u of evt.payload.units) {
      expect(u.hp.max).toBeGreaterThan(0)
      const deck = evt.payload.decks?.[u.id as unknown as string]
      expect(deck, `unit '${u.name}' has no deck`).toBeDefined()
      expect(deck!.draw.length + deck!.hand.length).toBeGreaterThan(0)
    }
  })
})
