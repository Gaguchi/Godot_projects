import { describe, it, expect } from 'vitest'
import { useRunStore } from '../../../src/state/runStore'
import { serializeRun } from '../../../src/persistence/save'
import { asUnitId, asItemId, asQuestId, asStageId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

const roy = (): Unit => ({
  id: asUnitId('roy'), name: 'Roy', classId: 'lord' as never, level: 1,
  hp: { current: 20, max: 22 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 4 },
  position: null, ap: 3, armor: 0, statuses: [],
  handLeft: asItemId('iron_sword'), handRight: null,
})

describe('full save hydration round-trip (story 477)', () => {
  it('flags, quests, RNG, stats, one-shots, hand slots survive serialize → hydrate', () => {
    const store = useRunStore.getState()
    store.__resetForTest()
    store.dispatch({ type: 'recruitUnit', payload: { unit: roy() } })
    store.dispatch({ type: 'addGold', payload: { amount: 137 } })
    store.dispatch({ type: 'setFlag', payload: { key: 'deserter_helped' as never, value: true, scope: 'permanent' } })
    store.dispatch({ type: 'advanceQuestStage', payload: { questId: asQuestId('sq_missing_caravan'), toStage: asStageId('find_supplies') } })
    store.dispatch({ type: 'markEncounterFired', payload: { encounterId: 'injured_knight' } })
    store.dispatch({ type: 'consumeFoodPerHop' })  // daysElapsed 2, hops 1
    store.dispatch({
      type: 'applyBattleResult',
      payload: {
        result: {
          outcome: 'victory', battleId: 'b', survivors: [asUnitId('roy')], fallen: [],
          xpAwards: {}, capturedEnemies: [], goldEarned: 30, enemiesDefeated: 2,
          loot: [], consumedTravelHop: null, emittedEvents: [],
        },
      },
    })

    const serialized = serializeRun(useRunStore.getState())!

    // wipe, then hydrate from the serialized snapshot
    store.dispatch({ type: 'resetRun' })
    expect(useRunStore.getState().gold).toBe(0)
    useRunStore.getState().dispatch({
      type: 'hydrateFromSave',
      payload: {
        gold: serialized.gold,
        worldPosition: serialized.worldPosition,
        partyUnits: serialized.partyUnits as { id: string }[],
        partyOrder: serialized.partyOrder,
        inventoryItems: serialized.inventoryItems,
        flags: serialized.flags,
        questStates: serialized.questStates,
        rngState: serialized.rngState,
        daysElapsed: serialized.daysElapsed,
        runStats: serialized.runStats,
        oneShotsFired: serialized.oneShotsFired,
        visitedNodes: serialized.visitedNodes,
        clearedEncounters: serialized.clearedEncounters,
        deathLog: serialized.deathLog,
      },
    })

    const s = useRunStore.getState()
    expect(s.gold).toBe(167)
    expect(s.party.units['roy']?.handLeft).toBe('iron_sword')
    expect(s.flags.has('deserter_helped' as never)).toBe(true)
    expect(s.questStates['sq_missing_caravan']?.currentStage).toBe('find_supplies')
    expect(s.oneShotsFired.has('injured_knight')).toBe(true)
    expect(s.daysElapsed).toBe(2)
    expect(s.runStats.battlesWon).toBe(1)
    expect(s.runStats.hops).toBe(1)
  })
})
