import { registerDialogue } from './dialogueRegistry'
import type { DialogueTree } from '../domain/dialogue'

import prologue from '../data/content/dialogue/prologue.json'
import roadMerchant from '../data/content/dialogue/road_merchant.json'
import woundedTraveler from '../data/content/dialogue/wounded_traveler.json'
import banditThreat from '../data/content/dialogue/bandit_threat.json'
import bloodTiesAccept from '../data/content/dialogue/sq_blood_ties_accept.json'
import bloodTiesDarenCaptured from '../data/content/dialogue/sq_blood_ties_daren_captured.json'
import bloodTiesDarenKilled from '../data/content/dialogue/sq_blood_ties_daren_killed.json'
import testCrossroads from '../data/content/dialogue/test_event_crossroads.json'
import caravanAccept from '../data/content/dialogue/sq_caravan_accept.json'
import caravanFound from '../data/content/dialogue/sq_caravan_found.json'
import caravanReward from '../data/content/dialogue/sq_caravan_reward.json'
import deserterPlea from '../data/content/dialogue/deserter_plea.json'
import deserterRepays from '../data/content/dialogue/deserter_repays.json'
import desertersBrothers from '../data/content/dialogue/deserters_brothers.json'

/**
 * Loads the 8 ported Godot dialogue trees into the in-memory registry.
 * Call once at App startup; subsequent calls are no-ops (registerDialogue
 * just overwrites with identical content).
 */
export function bootstrapDialogues(): void {
  const trees: unknown[] = [
    prologue, roadMerchant, woundedTraveler, banditThreat,
    bloodTiesAccept, bloodTiesDarenCaptured, bloodTiesDarenKilled,
    testCrossroads,
    caravanAccept, caravanFound, caravanReward,
    deserterPlea, deserterRepays, desertersBrothers,
  ]
  for (const t of trees) {
    registerDialogue(t as DialogueTree)
  }
}
