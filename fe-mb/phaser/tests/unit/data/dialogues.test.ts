import { describe, it, expect } from 'vitest'
import { DialogueTreeSchema } from '../../../src/data/schemas/dialogue'
import prologue from '../../../src/data/content/dialogue/prologue.json'
import roadMerchant from '../../../src/data/content/dialogue/road_merchant.json'
import woundedTraveler from '../../../src/data/content/dialogue/wounded_traveler.json'
import banditThreat from '../../../src/data/content/dialogue/bandit_threat.json'
import bloodTiesAccept from '../../../src/data/content/dialogue/sq_blood_ties_accept.json'
import bloodTiesDarenCaptured from '../../../src/data/content/dialogue/sq_blood_ties_daren_captured.json'
import bloodTiesDarenKilled from '../../../src/data/content/dialogue/sq_blood_ties_daren_killed.json'
import testCrossroads from '../../../src/data/content/dialogue/test_event_crossroads.json'

const ALL = [
  ['prologue', prologue],
  ['road_merchant', roadMerchant],
  ['wounded_traveler', woundedTraveler],
  ['bandit_threat', banditThreat],
  ['sq_blood_ties_accept', bloodTiesAccept],
  ['sq_blood_ties_daren_captured', bloodTiesDarenCaptured],
  ['sq_blood_ties_daren_killed', bloodTiesDarenKilled],
  ['test_event_crossroads', testCrossroads],
] as const

describe('ported Godot dialogues (GP-B5)', () => {
  for (const [name, tree] of ALL) {
    it(`${name}.json passes DialogueTreeSchema`, () => {
      const r = DialogueTreeSchema.safeParse(tree)
      if (!r.success) {
        // Log details for debugging
        console.error(`${name} schema errors:`, JSON.stringify(r.error.format(), null, 2))
      }
      expect(r.success).toBe(true)
    })
  }

  it('every dialogue has at least one terminating choice path', () => {
    for (const [name, tree] of ALL) {
      const nodes = (tree as { nodes: Record<string, { choices: { next: unknown }[] }> }).nodes
      let foundEnd = false
      for (const node of Object.values(nodes)) {
        for (const choice of node.choices) {
          if (choice.next === 'end') foundEnd = true
        }
      }
      expect(foundEnd, `${name} has no end-terminating choice`).toBe(true)
    }
  })
})
