import { describe, expect, it } from 'vitest'
import { QUEST_EFFECT_KINDS, QuestEffectSchema } from '../../../../src/content/schemas'
import { applyQuestEffect, applyQuestEffects } from '../../../../src/engine/run/questEffects'
import { startQuest } from '../../../../src/engine/run/quests'
import type { QuestEffect } from '../../../../src/engine/types'
import { env, kinds, makeRun } from './narrativeFixture'

const BT = 'sq_blood_ties'
const WORLD = { mapKind: 'overworld', mapId: 'world' } as const

describe('quest effects — one it per kind (all 15, exhaustive)', () => {
  it('setFlag writes a scoped entry and emits flagSet', () => {
    const r = applyQuestEffect(makeRun(), { kind: 'setFlag', key: 'daren_captured', value: true, scope: 'run' }, env)
    expect(r.state.flags['daren_captured']).toEqual({ value: true, scope: 'run' })
    expect(r.effects).toEqual([{ kind: 'flagSet', key: 'daren_captured', value: true, scope: 'run' }])
  })

  it('recruitCharacter adds a unit whose id equals the characterId (via run/party)', () => {
    const r = applyQuestEffect(makeRun(), { kind: 'recruitCharacter', characterId: 'kael' }, env)
    const kael = r.state.party['kael']
    expect(kael).toBeDefined()
    expect(kael?.classId).toBe('bandit_archer')
    expect(kael?.team).toBe('party')
    expect(r.state.partyOrder).toContain('kael')
    expect(kinds(r.effects)).toContain('unitRecruited')
  })

  it('promptName sets pendingNamePrompt by target', () => {
    const r = applyQuestEffect(makeRun(), { kind: 'promptName', target: 'company' }, env)
    expect(r.state.pendingNamePrompt).toEqual({ target: 'company' })
    expect(applyQuestEffect(makeRun(), { kind: 'promptName', target: 'mc' }, env).state.pendingNamePrompt).toEqual({ target: 'mc' })
  })

  it('startQuest seeds the quest through the one engine path (initial onEnter fires)', () => {
    const r = applyQuestEffect(makeRun(), { kind: 'startQuest', questId: BT }, env)
    expect(r.state.questStates[BT]?.stage).toBe('find_daren')
    expect(r.state.spawnedNodes['darens_camp']).toBe(true)
    expect(kinds(r.effects)).toContain('questStarted')
  })

  it('advanceQuestStage moves the stage through the one engine path', () => {
    const started = startQuest(makeRun(), BT, env).state
    const r = applyQuestEffect(started, { kind: 'advanceQuestStage', questId: BT, toStage: 'daren_resolved' }, env)
    expect(r.state.questStates[BT]?.stage).toBe('daren_resolved')
    expect(kinds(r.effects)).toContain('questStageAdvanced')
  })

  it('completeQuest sets the sentinel and emits questCompleted', () => {
    const started = startQuest(makeRun(), BT, env).state
    const r = applyQuestEffect(started, { kind: 'completeQuest', questId: BT }, env)
    expect(r.state.questStates[BT]?.stage).toBe(env.rules.quests.completeSentinel)
    expect(kinds(r.effects)).toContain('questCompleted')
  })

  it('addGold accepts negatives and clamps at 0 (via run/economy); goldChanged reports the real delta', () => {
    const run = makeRun({ gold: 20 })
    const up = applyQuestEffect(run, { kind: 'addGold', amount: 15 }, env)
    expect(up.state.gold).toBe(35)
    expect(up.effects).toEqual([{ kind: 'goldChanged', delta: 15, reason: 'quest' }])
    const down = applyQuestEffect(run, { kind: 'addGold', amount: -50 }, env)
    expect(down.state.gold).toBe(0)
    expect(down.effects).toEqual([{ kind: 'goldChanged', delta: -20, reason: 'quest' }])
    const none = applyQuestEffect(makeRun({ gold: 0 }), { kind: 'addGold', amount: -5 }, env)
    expect(none.state.gold).toBe(0)
    expect(none.effects).toEqual([])
  })

  it('addFood accepts negatives and clamps at 0 (via run/bag)', () => {
    const run = makeRun() // one ration, 3 charges
    const charges = (bag: typeof run.bag) => bag.filter((b) => b.itemId === 'food_rations').reduce((n, b) => n + b.charges, 0)
    const minus = applyQuestEffect(run, { kind: 'addFood', amount: -2 }, env)
    expect(charges(minus.state.bag)).toBe(1)
    const gone = applyQuestEffect(run, { kind: 'addFood', amount: -10 }, env)
    expect(charges(gone.state.bag)).toBe(0)
    const plus = applyQuestEffect(run, { kind: 'addFood', amount: 4 }, env)
    expect(charges(plus.state.bag)).toBe(7)
    expect(kinds(plus.effects)).toContain('foodChanged')
  })

  it('addItem places the item in the bag or parks it in pendingLoot — never discarded (via run/loot)', () => {
    const r = applyQuestEffect(makeRun(), { kind: 'addItem', itemId: 'iron_bow' }, env)
    const inBag = r.state.bag.some((b) => b.itemId === 'iron_bow')
    const parked = r.state.pendingLoot.includes('iron_bow')
    expect(inBag || parked).toBe(true)
    expect(inBag && parked).toBe(false)
    expect(kinds(r.effects)).toContain(inBag ? 'itemAcquired' : 'lootOverflow')
  })

  it('spawnNode reveals a hidden overworld node (real, idempotent)', () => {
    const r = applyQuestEffect(makeRun(), { kind: 'spawnNode', ref: { ...WORLD, nodeId: 'darens_camp' } }, env)
    expect(r.state.spawnedNodes).toEqual({ darens_camp: true })
    expect(r.effects).toEqual([])
    const again = applyQuestEffect(r.state, { kind: 'spawnNode', ref: { ...WORLD, nodeId: 'darens_camp' } }, env)
    expect(again.state).toBe(r.state)
    const dungeonRef = applyQuestEffect(makeRun(), { kind: 'spawnNode', ref: { mapKind: 'dungeon', mapId: 'smugglers_cave', nodeId: 'r0c0' } }, env)
    expect(dungeonRef.state.spawnedNodes).toEqual({})
  })

  it('unlockNode opens a locked dungeon node (real, idempotent)', () => {
    const r = applyQuestEffect(makeRun(), { kind: 'unlockNode', ref: { ...WORLD, nodeId: 'smugglers_cave' } }, env)
    expect(r.state.unlockedNodes).toEqual({ smugglers_cave: true })
    expect(applyQuestEffect(r.state, { kind: 'unlockNode', ref: { ...WORLD, nodeId: 'smugglers_cave' } }, env).state).toBe(r.state)
  })

  it("startDialogue opens the tree with source 'quest'", () => {
    const r = applyQuestEffect(makeRun(), { kind: 'startDialogue', dialogueId: 'sq_blood_ties_accept' }, env)
    expect(r.state.pendingDialogue).toMatchObject({ dialogueId: 'sq_blood_ties_accept', nodeId: 'start', source: 'quest' })
    expect(kinds(r.effects)).toContain('dialogueOpened')
  })

  it('startCombat queues pendingCombat with a quest origin at the current node and a group spec at the area level', () => {
    const run = makeRun()
    const r = applyQuestEffect(run, { kind: 'startCombat', enemyGroupId: 'bandits_small' }, env)
    expect(r.state.pendingCombat).toEqual({
      origin: { kind: 'quest', nodeId: run.nodeId },
      enemies: { kind: 'group', enemyGroupId: 'bandits_small', level: expect.any(Number) },
      captureTargets: [],
    })
    const level = r.state.pendingCombat?.enemies.kind === 'group' ? r.state.pendingCombat.enemies.level : 0
    const [lo, hi] = env.rules.difficulty.levelBand[1]
    expect(level).toBeGreaterThanOrEqual(lo)
    expect(level).toBeLessThanOrEqual(hi)
    expect(() => applyQuestEffect(run, { kind: 'startCombat', enemyGroupId: 'ghost_group' }, env)).toThrow(/unknown enemy group/)
  })

  it('startCombat carries its authored captureTargets onto the pending battle (CONTRACT-CHANGES 0030)', () => {
    const targets = [{ unitId: 'daren', capturedDialogueId: 'sq_blood_ties_daren_captured', killedDialogueId: 'sq_blood_ties_daren_killed', capturedFlag: 'daren_captured', killedFlag: 'daren_killed' }] as const
    const r = applyQuestEffect(makeRun(), { kind: 'startCombat', enemyGroupId: 'darens_gang', captureTargets: [...targets] }, env)
    expect(r.state.pendingCombat?.captureTargets).toEqual([...targets])
  })

  it("startCombat from a travel encounter's check event keeps the travel origin", () => {
    const run = makeRun({
      pendingTravel: {
        path: ['south_road_ambush'],
        hopsTotal: 1,
        status: 'suspended',
        hop: { from: 'frontier_camp', to: 'south_road_ambush', pass: 1, encounter: { entryId: 'ambush_toll', outcome: { kind: 'checkEvent', checkEventId: 'ambush_toll' }, oneShot: false }, resolved: false },
      },
      pendingCheckEvent: { checkEventId: 'ambush_toll', source: 'travel', result: null },
    })
    const r = applyQuestEffect(run, { kind: 'startCombat', enemyGroupId: 'thornwood_ambush' }, env)
    expect(r.state.pendingCombat?.origin).toEqual({ kind: 'travel', from: 'frontier_camp', to: 'south_road_ambush', encounterId: 'ambush_toll' })
    expect(r.state.pendingCombat?.enemies).toMatchObject({ kind: 'group', enemyGroupId: 'thornwood_ambush' })
    // A hop that carried no encounter (walking between quiet nodes) is not a travel battle.
    const quiet = makeRun({ pendingTravel: { path: [], hopsTotal: 1, status: 'walking', hop: { from: 'a', to: 'b', pass: 1, encounter: null, resolved: true } } })
    expect(applyQuestEffect(quiet, { kind: 'startCombat', enemyGroupId: 'wolves' }, env).state.pendingCombat?.origin).toEqual({ kind: 'quest', nodeId: quiet.nodeId })
  })

  it('damageParty deals flat damage to every living unit (via run/party)', () => {
    const r = applyQuestEffect(makeRun(), { kind: 'damageParty', amount: 3 }, env)
    for (const id of ['mc', 'oak', 'lilina']) {
      expect(r.state.party[id]?.hp.current).toBe((makeRun().party[id]?.hp.max ?? 0) - 3)
    }
    expect(kinds(r.effects)).toContain('partyDamaged')
  })

  it('healParty{percent} heals a fraction of max (via run/party)', () => {
    const wounded = makeRun()
    const mc = wounded.party['mc']!
    const run = { ...wounded, party: { ...wounded.party, mc: { ...mc, hp: { current: 1, max: mc.hp.max } } } }
    const r = applyQuestEffect(run, { kind: 'healParty', percent: 0.5 }, env)
    expect(r.state.party['mc']?.hp.current).toBe(1 + Math.floor(mc.hp.max * 0.5))
    expect(kinds(r.effects)).toContain('partyHealed')
  })
})

describe('quest effects — shape', () => {
  it('no statCheck effect exists at the type or schema level (15 kinds, flat)', () => {
    expect(QUEST_EFFECT_KINDS).toHaveLength(15)
    expect(QUEST_EFFECT_KINDS as readonly string[]).not.toContain('statCheck')
    expect(QUEST_EFFECT_KINDS as readonly string[]).not.toContain('recruitUnit')
    expect(QuestEffectSchema.safeParse({ kind: 'statCheck', stat: 'str', threshold: 12, successEffects: [], failEffects: [] }).success).toBe(false)
  })

  it('applyQuestEffects folds in order and returns the same reference for an empty list', () => {
    const run = makeRun({ gold: 10 })
    expect(applyQuestEffects(run, [], env).state).toBe(run)
    const effects: QuestEffect[] = [{ kind: 'addGold', amount: -30 }, { kind: 'addGold', amount: 5 }, { kind: 'setFlag', key: 'x', value: 1, scope: 'battle' }]
    const r = applyQuestEffects(run, effects, env)
    expect(r.state.gold).toBe(5)
    expect(kinds(r.effects)).toEqual(['goldChanged', 'goldChanged', 'flagSet'])
  })
})
