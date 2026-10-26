/**
 * tests/unit/ui/names.test.ts — the display-name layer (ARCHITECTURE §5.1). Seven screens shipped
 * `classId.replace(/_/g, ' ')`, so the roster read `shield knight` and the Title screen read `darens camp`,
 * while `classes.json` and the overworld sheet had carried the authored names all along. `materials.test.ts`
 * bans the `replace` shape; this pins the layer that replaced it — including the last-resort humanisation,
 * which must never hand back the id verbatim.
 */
import { describe, expect, it } from 'vitest'
import { createEnv } from '../../../src/engine/content'
import { displayName } from '../../../src/engine/run/party'
import type { RunState, Unit } from '../../../src/engine/types'
import { className, companyName, mcName, placeName, questName, stageLabel } from '../../../src/ui/names'

const env = createEnv()

describe('ui/names — no id ever reaches the player', () => {
  it('className returns the authored name, not the id', () => {
    expect(className('lord', env)).toBe('Lord')
    expect(className('knight', env)).toBe('Knight')
    // the id that made the gate report: `shield_knight` rendered as "shield knight"
    for (const id of Object.keys(env.content.classes)) {
      const shown = className(id, env)
      expect(shown, id).toBe(env.content.classes[id]?.name)
      expect(shown, id).not.toContain('_')
      expect(shown, id).toMatch(/^[A-Z]/)
    }
  })

  it('placeName returns the sheet name, and null for no run', () => {
    const start = env.content.overworld.startNodeId
    const authored = env.content.overworld.nodes.find((n) => n.id === start)?.name
    expect(placeName(start, env)).toBe(authored)
    expect(placeName(start, env)).not.toBe(start)
    expect(placeName(null, env)).toBeNull()
    for (const node of env.content.overworld.nodes) {
      expect(placeName(node.id, env), node.id).not.toContain('_')
    }
  })

  it('questName returns the authored quest name', () => {
    for (const [id, q] of Object.entries(env.content.quests)) expect(questName(id, env), id).toBe(q.name)
  })

  it('an unknown id is humanised into Title Case, never echoed raw', () => {
    expect(className('shield_knight_of_nowhere', env)).toBe('Shield Knight Of Nowhere')
    expect(placeName('darens_camp_unbuilt', env)).toBe('Darens Camp Unbuilt')
    expect(questName('no_such_quest', env)).toBe('No Such Quest')
  })

  /**
   * FINAL GATE C 3.4. The stage line was `stage.replace(/_/g, ' ')` relocated into the engine, so Contracts read
   * "Blood Ties — Find daren": a character's name lower-cased on the page whose whole job is naming things. The
   * label is authored content now. This is the ratchet — a new stage with no label, or one that is just its own
   * id spelled out, reddens here as well as in `content/lint.ts`.
   */
  it('a quest stage prints its AUTHORED label, never a humanisation of its id', () => {
    expect(stageLabel('sq_blood_ties', 'find_daren', env)).toBe("Find Daren's gang on the Frontier Camp road")
    expect(stageLabel('sq_missing_caravan', 'find_supplies', env)).toBe('Search the Thornwood road for the caravan')
    for (const [questId, q] of Object.entries(env.content.quests)) {
      for (const [stageId, stage] of Object.entries(q.stages)) {
        const shown = stageLabel(questId, stageId, env)
        const at = `${questId}/${stageId}`
        expect(shown, at).toBe(stage.label)
        expect(shown, at).not.toContain('_')
        expect(shown.toLowerCase(), at).not.toBe(stageId.replace(/_/g, ' '))
        expect(shown, at).toMatch(/^[A-Z]/)
      }
    }
    // …and a name a character owns keeps its capital: the bug was "Find daren", one letter wide
    expect(stageLabel('sq_blood_ties', 'find_daren', env)).toContain('Daren')
  })

  it('a stage no content claims is described, never echoed', () => {
    const shown = stageLabel('sq_blood_ties', 'a_stage_that_was_cut', env)
    expect(shown).not.toContain('_')
    expect(shown).toBe('Underway')
  })

  /**
   * RE-GATE B 2.2. `Ledger.tsx` fell back to its own lowercase prose while the roll of the fallen ONE LINE BELOW
   * it read the authored Title Case name, so the win page said "Under the foundling, the company took the throne"
   * directly above a portrait captioned "The Foundling". One name per thing (§5.1) — and the fallback the ledger
   * shows must be the very string the roster shows, not a second copy of it in another case.
   */
  it('an unnamed foundling is called the same thing on the prose line and in the roll', () => {
    const authored = env.content.characters['mc']?.displayName
    expect(authored).toBe('The Foundling')
    expect(mcName(null, env)).toBe(authored)
    // the roster's own answer, for a run where the player never reached the naming beat
    const unit = { id: 'mc', name: authored } as unknown as Unit
    expect(mcName(null, env)).toBe(displayName(unit, { mcName: null } as unknown as RunState))
    // …and the chosen name always wins
    expect(mcName('Verity Locke', env)).toBe('Verity Locke')
  })

  it('the company is a Named thing before it is named, too', () => {
    expect(companyName(null)).toBe('The Company')
    expect(companyName(null)).toMatch(/^[A-Z]/)
    expect(companyName('The Ninth Lantern')).toBe('The Ninth Lantern')
  })
})
