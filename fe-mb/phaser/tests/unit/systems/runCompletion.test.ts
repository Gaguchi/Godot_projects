import { describe, it, expect, beforeEach } from 'vitest'
import { seedBossBattle } from '../../../src/game/scenes/seedBossBattle'
import { isEnemyUnit } from '../../../src/systems/team'
import { useRunStore } from '../../../src/state/runStore'
import { buildStarterParty } from '../../../src/systems/starterParty'
import { asUnitId, asItemId } from '../../../src/domain/ids'
import type { BattleResult } from '../../../src/contracts'

describe('seedBossBattle (The Iron Throne)', () => {
  const event = seedBossBattle({ seed: 7, counter: 0 }, buildStarterParty())

  it('tags the battle finalBoss and fields the Warlord + 2 guards', () => {
    expect(event.payload.battleTag).toBe('finalBoss')
    const enemies = event.payload.units.filter(u => u.team === 'enemy')
    expect(enemies).toHaveLength(3)
    expect(enemies.some(u => (u.classId as unknown as string) === 'warlord')).toBe(true)
  })

  it('sets explicit teams on every unit', () => {
    for (const u of event.payload.units) expect(u.team === 'party' || u.team === 'enemy').toBe(true)
  })

  it('builds decks for all units (boss uses greatsword innates)', () => {
    const bossDeck = event.payload.decks?.['warlord_boss']
    expect(bossDeck?.draw.length).toBeGreaterThanOrEqual(4)
  })

  it('boss is an authored juggernaut: heavy HP + armor, slow enough to act last', () => {
    const boss = event.payload.units.find(u => (u.id as unknown as string) === 'warlord_boss')!
    expect(boss.level).toBe(7)
    expect(boss.hp.max).toBeGreaterThanOrEqual(50)
    expect(boss.armor).toBeGreaterThanOrEqual(4)
    expect(boss.stats.spd).toBeLessThanOrEqual(4) // party gets the alpha strike
  })
})

describe('systems/team', () => {
  it('explicit team beats the classId heuristic', () => {
    expect(isEnemyUnit({ team: 'enemy', classId: 'lord' as never })).toBe(true)
    expect(isEnemyUnit({ team: 'party', classId: 'bandit' as never })).toBe(false)
  })
  it('falls back to classId fragments when team is absent', () => {
    expect(isEnemyUnit({ classId: 'warlord' as never })).toBe(true)
    expect(isEnemyUnit({ classId: 'mage' as never })).toBe(false)
  })
})

describe('runStats counters', () => {
  beforeEach(() => useRunStore.getState().__resetForTest())

  const result = (over: Partial<BattleResult> = {}): BattleResult => ({
    outcome: 'victory',
    battleId: 'b1',
    survivors: [asUnitId('roy')],
    fallen: [],
    xpAwards: {},
    capturedEnemies: [],
    goldEarned: 25,
    enemiesDefeated: 3,
    loot: [asItemId('iron_sword')],
    consumedTravelHop: null,
    emittedEvents: [],
    ...over,
  })

  it('applyBattleResult updates the run summary', () => {
    useRunStore.getState().dispatch({ type: 'applyBattleResult', payload: { result: result() } })
    const s = useRunStore.getState().runStats
    expect(s.battlesWon).toBe(1)
    expect(s.enemiesDefeated).toBe(3)
    expect(s.goldEarned).toBe(25)
    expect(s.gearFound).toBe(1)
  })

  it('defeats do not count as battles won but do count losses', () => {
    useRunStore.getState().dispatch({
      type: 'applyBattleResult',
      payload: { result: result({ outcome: 'defeat', fallen: [asUnitId('roy')], goldEarned: 0, loot: [] }) },
    })
    const s = useRunStore.getState().runStats
    expect(s.battlesWon).toBe(0)
    expect(s.unitsLost).toBe(1)
  })

  it('resetRun wipes stats and party for a fresh run', () => {
    useRunStore.getState().dispatch({ type: 'applyBattleResult', payload: { result: result() } })
    useRunStore.getState().dispatch({ type: 'resetRun' })
    const s = useRunStore.getState()
    expect(s.runStats.battlesWon).toBe(0)
    expect(s.party.partyOrder).toHaveLength(0)
    expect(s.gold).toBe(0)
  })
})
