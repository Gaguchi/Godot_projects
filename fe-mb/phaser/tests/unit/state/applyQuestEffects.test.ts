import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStore } from '../../../src/state/runStore'
import { asUnitId, asClassId, asDialogueId, asQuestId, asFlagKey } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

const mkUnit = (id: string, hp = 20, hpMax = 20, str = 5, spd = 5): Unit => ({
  id: asUnitId(id),
  name: id,
  classId: asClassId('lord'),
  level: 1,
  hp: { current: hp, max: hpMax },
  stats: { str, mag: 0, skl: 4, spd, def: 3, res: 1 },
  position: null,
  ap: 3,
  armor: 0,
  statuses: [],
})

describe('applyQuestEffects (GP-B2)', () => {
  beforeEach(() => {
    useRunStore.getState().__resetForTest()
  })

  it('addGold +50 increases gold', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'applyQuestEffects', payload: { effects: [{ kind: 'addGold', amount: 50 }] } })
    expect(useRunStore.getState().gold).toBe(50)
  })

  it('addFood appends food_rations items', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'applyQuestEffects', payload: { effects: [{ kind: 'addFood', amount: 3 }] } })
    expect(useRunStore.getState().inventory.items.length).toBe(3)
    for (const it of useRunStore.getState().inventory.items) {
      expect(it.itemId).toBe('food_rations')
    }
  })

  it('damageParty reduces every unit hp', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('a', 10, 20) } })
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('b', 8, 20) } })
    dispatch({ type: 'applyQuestEffects', payload: { effects: [{ kind: 'damageParty', amount: 4 }] } })
    expect(useRunStore.getState().party.units['a']!.hp.current).toBe(6)
    expect(useRunStore.getState().party.units['b']!.hp.current).toBe(4)
  })

  it('healParty heals each unit by floor(maxHp * percent), capped', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('a', 10, 20) } })
    dispatch({ type: 'applyQuestEffects', payload: { effects: [{ kind: 'healParty', percent: 0.5 }] } })
    // heal = floor(20 * 0.5) = 10; new hp = 10 + 10 = 20 (capped at 20)
    expect(useRunStore.getState().party.units['a']!.hp.current).toBe(20)
  })

  it('setFlag stores the flag', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'applyQuestEffects', payload: { effects: [{ kind: 'setFlag', key: asFlagKey('prologue_seen'), value: true, scope: 'permanent' }] } })
    expect(useRunStore.getState().flags.has(asFlagKey('prologue_seen'))).toBe(true)
  })

  it('completeQuest sets quest stage to __complete__', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'advanceQuestStage', payload: { questId: asQuestId('blood_ties'), toStage: 'find_daren' as never } })
    dispatch({ type: 'applyQuestEffects', payload: { effects: [{ kind: 'completeQuest', questId: asQuestId('blood_ties') }] } })
    expect(useRunStore.getState().questStates['blood_ties']!.currentStage).toBe('__complete__')
  })

  it('startDialogue sets pendingDialogue', () => {
    const { dispatch } = useRunStore.getState()
    dispatch({ type: 'applyQuestEffects', payload: { effects: [{ kind: 'startDialogue', treeId: asDialogueId('road_merchant') }] } })
    expect(useRunStore.getState().pendingDialogue?.dialogueId).toBe('road_merchant')
  })

  it('statCheck branches by total party stat', () => {
    const { dispatch } = useRunStore.getState()
    // Two units with str=5+8=13. Threshold 10 → success branch fires.
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('a', 20, 20, 5) } })
    dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('b', 20, 20, 8) } })
    dispatch({ type: 'applyQuestEffects', payload: { effects: [{
      kind: 'statCheck',
      stat: 'str',
      threshold: 10,
      successEffects: [{ kind: 'addGold', amount: 99 }],
      failEffects: [{ kind: 'addGold', amount: 1 }],
    }] } })
    expect(useRunStore.getState().gold).toBe(99)
  })
})
