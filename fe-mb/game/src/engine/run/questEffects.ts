/**
 * run/questEffects.ts — the 15 quest effects, flat, ALL implemented (brief §2.12; no statCheck, no recruitUnit).
 * setFlag → flags; recruitCharacter → party; promptName → pendingNamePrompt; startQuest/advanceQuestStage/
 * completeQuest → run/quests; addGold (clamp ≥ 0); addFood (signed, clamp); addItem → bag or pendingLoot;
 * spawnNode/unlockNode → spawnedNodes/unlockedNodes; startDialogue → pendingDialogue{source 'quest'};
 * startCombat → pendingCombat (with its authored `captureTargets`); damageParty (a wipe / MC death ends the run in settle step 1b); healParty{percent}.
 * Exhaustive switch — never a default branch.
 *
 * `startCombat` origin: when `run.pendingTravel?.hop?.encounter` is non-null (the effect fired from a check event
 * or dialogue that a TRAVEL encounter opened — ambush_toll → thornwood_ambush) the battle is
 * `{ kind: 'travel', from, to, encounterId: hop.encounter.entryId }` (tag 'travel', day-salted label, and the hop's
 * entry lands in `clearedEncounters` on victory); otherwise `{ kind: 'quest', nodeId }`.
 * `enemies = { kind: 'group', enemyGroupId, level: enemyLevelFor(areaTier(nodeId), nodeId) }`.
 *
 * Every case delegates to the module that OWNS the rule (party, bag, economy, loot, quests, dialogue) so a number
 * or a clamp lives in exactly one place; this file only routes.
 */
import type { SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { BattleOrigin, EngineEnv, MapNodeRef, QuestEffect, RunState } from '../types'
import { addFood } from './bag'
import { openDialogue } from './dialogue'
import { areaTier, enemyLevelFor } from './difficulty'
import { addGold } from './economy'
import { setFlag } from './flags'
import { grantLoot } from './loot'
import { damageParty, healParty, recruitCharacter } from './party'
import { advanceQuest, completeQuest, startQuest } from './quests'

const NONE: readonly Effect[] = []

/** `spawnedNodes` / `unlockedNodes` are keyed by OVERWORLD node id (brief §2.11 "Smuggler's Cave via Blood Ties";
 *  `run/overworld.ts#visibleNodes`, `run/dungeon.ts#canEnterDungeon`). A dungeon-room ref has no reader, so it is a
 *  no-op rather than a poisoned key. Idempotent: an id already present returns the same reference. */
function reveal(run: RunState, field: 'spawnedNodes' | 'unlockedNodes', ref: MapNodeRef): RunState {
  if (ref.mapKind !== 'overworld') return run
  if (run[field][ref.nodeId] === true) return run
  return { ...run, [field]: { ...run[field], [ref.nodeId]: true } }
}

function combatOrigin(run: RunState): BattleOrigin {
  const hop = run.pendingTravel?.hop ?? null
  // A battle started by the SUSPENDER of a travel encounter belongs to that hop (CONTRACT-CHANGES 0020): the day-salted
  // travel label, the travel loot row, and `clearedEncounters[entryId]` on victory all key off the origin.
  if (hop !== null && hop.encounter !== null) return { kind: 'travel', from: hop.from, to: hop.to, encounterId: hop.encounter.entryId }
  return { kind: 'quest', nodeId: run.nodeId }
}

export function applyQuestEffect(run: RunState, effect: QuestEffect, env: EngineEnv): SliceResult<RunState> {
  switch (effect.kind) {
    case 'setFlag':
      return setFlag(run, effect.key, effect.value, effect.scope)
    case 'recruitCharacter':
      return recruitCharacter(run, effect.characterId, env)
    case 'promptName':
      // The prompt sits ON TOP of an open dialogue (the one sanctioned overlay pair, CONTRACT §3); `name/submit` answers it.
      return { state: { ...run, pendingNamePrompt: { target: effect.target } }, effects: NONE }
    case 'startQuest':
      return startQuest(run, effect.questId, env)
    case 'advanceQuestStage':
      return advanceQuest(run, effect.questId, effect.toStage, env)
    case 'completeQuest':
      return completeQuest(run, effect.questId, env)
    case 'addGold': {
      // Signed and clamped by the economy module (§7.22 "gold went negative"); the effect reports what actually moved.
      const state = addGold(run, effect.amount)
      const delta = state.gold - run.gold
      return { state, effects: delta === 0 ? NONE : [{ kind: 'goldChanged', delta, reason: 'quest' }] }
    }
    case 'addFood':
      return addFood(run, effect.amount, 'quest', env)
    case 'addItem':
      // A quest reward is never discarded: what does not fit waits in `pendingLoot` (§2.13).
      return grantLoot(run, [effect.itemId], 'quest', env)
    case 'spawnNode':
      return { state: reveal(run, 'spawnedNodes', effect.ref), effects: NONE }
    case 'unlockNode':
      return { state: reveal(run, 'unlockedNodes', effect.ref), effects: NONE }
    case 'startDialogue': {
      // A suspender is already on screen (a check event's narration, another dialogue, a name prompt): queue the
      // dialogue for flow/settle instead of losing it — a quest's reaction fired by a check must survive (§2.12).
      if (run.pendingCheckEvent !== null || run.pendingDialogue !== null || run.pendingNamePrompt !== null) {
        const followUp = { kind: 'dialogue' as const, dialogueId: effect.dialogueId, source: 'quest' as const }
        return { state: { ...run, pendingFollowUps: [...run.pendingFollowUps, followUp] }, effects: NONE }
      }
      return openDialogue(run, effect.dialogueId, 'quest', env)
    }
    case 'startCombat': {
      // Unknown group = content error (§7.20): fail here, loudly, not as a stub battle in the seeder.
      if (env.content.enemyGroups[effect.enemyGroupId] === undefined) throw new Error(`startCombat: unknown enemy group '${effect.enemyGroupId}'`)
      const level = enemyLevelFor(areaTier(run.nodeId, env), run.nodeId, env)
      const pendingCombat = {
        origin: combatOrigin(run),
        enemies: { kind: 'group' as const, enemyGroupId: effect.enemyGroupId, level },
        // The named enemies travel through the SPEC and come back on the BattleResult (CONTRACT-CHANGES 0030) —
        // the payout no longer re-derives them from the travel table, which left this fight with none.
        captureTargets: effect.captureTargets ?? [],
      }
      // Nothing is seeded here: `flow/settle.ts` step 4 seeds once no overlay is open (the dialogue/check that fired
      // this effect is still on screen and must close first).
      return { state: { ...run, pendingCombat }, effects: NONE }
    }
    case 'damageParty':
      return damageParty(run, effect.amount, 'event', env)
    case 'healParty':
      return healParty(run, effect.percent, false, 'quest', env)
  }
}

/** Sequential fold; the same run reference comes back for an empty list. */
export function applyQuestEffects(run: RunState, effects: readonly QuestEffect[], env: EngineEnv): SliceResult<RunState> {
  let state = run
  const out: Effect[] = []
  for (const e of effects) {
    const r = applyQuestEffect(state, e, env)
    state = r.state
    out.push(...r.effects)
  }
  return { state, effects: out }
}
