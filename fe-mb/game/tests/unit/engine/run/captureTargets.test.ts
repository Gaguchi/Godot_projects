/**
 * The narrative half of a named capture target (brief §2.12, §2.6): `run/battle.ts#resolveCaptureTargets`
 * (WP-FLOW) turns the battle outcome into `setFlag` + `startDialogue` effects keyed by UNIT id; everything from
 * there on is this package — the flag advances Blood Ties with no dialogue involved, the dialogue is queued by
 * the payout and opened by settle, and the resolution tree recruits Kael / pays out and completes the quest once.
 * Fixture inputs stand in for the resolver's output (CONTRACT §7: exercise your module).
 */
import { describe, expect, it } from 'vitest'
import { content } from '../../../../src/content/index'
import { resolveBattle } from '../../../../src/engine/combat/resolve'
import { seedBattle } from '../../../../src/engine/combat/seed'
import { applyBattleResult, battleSpecFor } from '../../../../src/engine/run/battle'
import { chooseCheck, dismissCheck, openCheckEvent } from '../../../../src/engine/run/checks'
import { choose, openDialogue } from '../../../../src/engine/run/dialogue'
import { applyQuestEffects } from '../../../../src/engine/run/questEffects'
import { questStatus, settleQuests, startQuest } from '../../../../src/engine/run/quests'
import type { CaptureTarget, CombatState, QuestEffect, RunState } from '../../../../src/engine/types'
import { env, kinds, makeRun } from './narrativeFixture'

const BT = 'sq_blood_ties'

/** The one shipped capture target (borderlands_road / sq_blood_ties_encounter). */
const daren = (): CaptureTarget => {
  for (const t of Object.values(content.encounterTables)) {
    for (const e of t.entries) if (e.outcome.kind === 'battle' && e.outcome.captureTargets) return e.outcome.captureTargets[0]!
  }
  throw new Error('fixture: no capture target in content')
}

/** What `resolveCaptureTargets` produces for one fate: the flag now, the dialogue by unit id. */
const fateEffects = (fate: 'captured' | 'killed'): readonly QuestEffect[] => {
  const t = daren()
  return fate === 'captured'
    ? [{ kind: 'setFlag', key: t.capturedFlag, value: true, scope: 'run' }, { kind: 'startDialogue', dialogueId: t.capturedDialogueId }]
    : [{ kind: 'setFlag', key: t.killedFlag, value: true, scope: 'run' }, { kind: 'startDialogue', dialogueId: t.killedDialogueId }]
}

/** Walk a linear tree to its end by taking the first choice each time. */
const walkToEnd = (run: RunState): RunState => {
  let s = run
  for (let i = 0; i < 20 && s.pendingDialogue !== null; i++) {
    const node = env.content.dialogues[s.pendingDialogue.dialogueId]!.nodes[s.pendingDialogue.nodeId]!
    s = choose(s, node.choices[0]!.id, null, env).state
  }
  return s
}

/** Every enemy down, the party untouched: the shape `resolveBattle` needs to pay out a victory. */
const wipeEnemies = (board: CombatState): CombatState => ({
  ...board,
  phase: 'victory',
  units: Object.fromEntries(Object.entries(board.units).map(([id, u]) => [id, u.team === 'enemy' ? { ...u, hp: { ...u.hp, current: 0 } } : u])),
})

describe('capture targets → narrative', () => {
  it('the shipped target keys on the unit id and the Blood Ties flags', () => {
    expect(daren()).toEqual({ unitId: 'daren', capturedDialogueId: 'sq_blood_ties_daren_captured', killedDialogueId: 'sq_blood_ties_daren_killed', capturedFlag: 'daren_captured', killedFlag: 'daren_killed' })
    expect(content.characters['daren']?.kind).toBe('unit')
  })

  it('a captured named target sets the flag, advances Blood Ties without the dialogue, and the dialogue recruits Kael and completes the quest once', () => {
    const active = startQuest(makeRun(), BT, env).state
    // Payout: the flag lands now; the dialogue is queued and opened by settle later — so settle the flag alone first.
    const flagged = applyQuestEffects(active, fateEffects('captured').filter((e) => e.kind === 'setFlag'), env).state
    const settled = settleQuests(flagged, env).state
    expect(settled.questStates[BT]?.stage).toBe('daren_resolved')
    expect(settled.pendingDialogue).toBeNull()

    const opened = openDialogue(settled, daren().capturedDialogueId, 'captureTarget', env)
    expect(opened.state.pendingDialogue?.source).toBe('captureTarget')
    const done = walkToEnd(opened.state)
    expect(done.pendingDialogue).toBeNull()
    expect(done.party['daren']).toBeUndefined()
    expect(done.party['kael']?.classId).toBe('bandit_archer')
    expect(questStatus(done, BT)).toBe('complete')
    // Settling again after completion changes nothing; a second walk of the reward beat cannot re-complete.
    expect(settleQuests(done, env).state).toBe(done)
    const again = walkToEnd(openDialogue(done, daren().capturedDialogueId, 'captureTarget', env).state)
    expect(questStatus(again, BT)).toBe('complete')
  })

  it('a killed named target sets the killed flag and its dialogue pays 80 gold and completes the quest', () => {
    const active = startQuest(makeRun({ gold: 0 }), BT, env).state
    const r = applyQuestEffects(active, fateEffects('killed'), env)
    expect(r.state.flags['daren_killed']).toEqual({ value: true, scope: 'run' })
    expect(r.state.pendingDialogue?.dialogueId).toBe('sq_blood_ties_daren_killed')
    expect(kinds(r.effects)).toEqual(['flagSet', 'dialogueOpened'])
    const settled = settleQuests(r.state, env).state
    expect(settled.questStates[BT]?.stage).toBe('daren_resolved')
    const done = walkToEnd(settled)
    expect(done.gold).toBe(80)
    expect(done.party['kael']).toBeUndefined()
    expect(questStatus(done, BT)).toBe('complete')
  })

  it('the captured and killed flags are distinct keys read by the same transition', () => {
    const stage = content.quests[BT]?.stages['find_daren']
    const when = stage?.transitions[0]?.when
    expect(when?.kind).toBe('anyOf')
    const keys = when?.kind === 'anyOf' ? when.preds.map((p) => (p.kind === 'flag' ? p.key : '')) : []
    expect(keys).toEqual([daren().capturedFlag, daren().killedFlag])
  })
})

/**
 * The named enemies used to be re-derived from the TRAVEL encounter table by `origin.encounterId`, so the same gang
 * fought at Daren's camp (a quest origin) or as the Smuggler's Cave boss resolved to nobody and Blood Ties stuck at
 * `find_daren`. They now ride the spec → the board → the `BattleResult` (CONTRACT-CHANGES 0030).
 */
describe('a quest-origin battle resolves its OWN capture targets', () => {
  it('Daren killed at his camp sets the killed flag, queues his scene and advances Blood Ties', () => {
    const active = startQuest(makeRun({ nodeId: 'darens_camp' }), BT, env).state
    const opened = openCheckEvent(active, 'darens_camp', 'discovery', env).state
    const chosen = chooseCheck(opened, 'storm', null, env).state
    expect(chosen.pendingCombat?.origin).toEqual({ kind: 'quest', nodeId: 'darens_camp' })
    expect(chosen.pendingCombat?.captureTargets).toEqual([daren()])

    const ready = dismissCheck(chosen, env).state
    const spec = battleSpecFor(ready, ready.pendingCombat!, env)
    expect(spec.captureTargets).toEqual([daren()])
    const board = seedBattle(spec, env)
    expect(board.captureTargets).toEqual([daren()])
    expect(board.units['daren']?.team).toBe('enemy')

    const result = resolveBattle(wipeEnemies(board), env)
    expect(result.outcome).toBe('victory')
    expect(result.captureTargets).toEqual([daren()])

    const paid = applyBattleResult({ ...ready, pendingCombat: null }, result, env)
    expect(paid.state.flags['daren_killed']).toEqual({ value: true, scope: 'run' })
    expect(paid.state.pendingFollowUps).toContainEqual({ kind: 'dialogue', dialogueId: daren().killedDialogueId, source: 'captureTarget' })
    expect(settleQuests(paid.state, env).state.questStates[BT]?.stage).toBe('daren_resolved')
  })

  it('Daren has exactly one unconditioned home, so no route can field him twice', () => {
    // He used to stand in three places at once (the road one-shot, his camp, and the Smuggler's Cave boss room), so
    // he could die in one and walk out of another and his two flags could fire twice. His camp is now the one
    // authored home; the cave fields its own crew, and the road entry only re-arms if you withdrew from the camp.
    expect(content.dungeons['smugglers_cave']?.bossCaptureTargets).toBeUndefined()
    expect(content.dungeons['smugglers_cave']?.bossEnemyGroupId).toBe('smuggler_crew')
    const camp = content.checkEvents['darens_camp']!
    const fromCamp = camp.choices.flatMap((ch) => [...ch.onPass.effects, ...(ch.onFail?.effects ?? [])]).filter((e) => e.kind === 'startCombat')
    expect(fromCamp.length).toBeGreaterThan(0)
    for (const e of fromCamp) expect(e.kind === 'startCombat' && e.captureTargets).toEqual([daren()])
    const road = Object.values(content.encounterTables).flatMap((t) => t.entries).filter((e) => e.outcome.kind === 'battle' && (e.outcome.captureTargets?.length ?? 0) > 0)
    expect(road).toHaveLength(1)
    expect(road[0]!.oneShot).toBe(false)
    expect(road[0]!.conditions.map((p) => p.kind)).toEqual(['questStage', 'flag'])
  })
})
