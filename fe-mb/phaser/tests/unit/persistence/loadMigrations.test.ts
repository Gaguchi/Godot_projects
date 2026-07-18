import { describe, it, expect } from 'vitest'
import { loadFromString } from '../../../src/persistence/load'

const minimalRun = {
  runId: 'r1',
  runSeed: 1,
  partyUnits: [
    { id: 'roy', name: 'Roy', classId: 'lord', level: 1, hp: { current: 20, max: 22 } },
    { id: 'daren', name: 'Daren (captured)', classId: 'bandit', level: 2, hp: { current: 0, max: 18 } },
  ],
  partyOrder: ['roy'],
  inventoryItems: [],
  gold: 0,
  worldPosition: { mapId: 'borderlands', nodeId: 'start' },
  visitedNodes: {},
  clearedEncounters: {},
  pendingTravelPath: null,
  flags: [],
  questStates: {},
  activeDungeon: null,
  rngState: { seed: 1, counter: 0 },
  deathLog: [],
}

const minimalSave = {
  saveVersion: '0.7.0-gear',
  createdAt: 0,
  meta: { gameStarted: true, totalRuns: 1 },
  run: minimalRun,
  combat: null,
  actionLog: [],
  contentAliasesApplied: 'none',
}

describe('load migrations — legacy capture name-suffix', () => {
  it("strips ' (captured)' and sets the captured flag", () => {
    const r = loadFromString(JSON.stringify(minimalSave))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const daren = r.save.run!.partyUnits[1] as { name: string; captured?: boolean }
    expect(daren.name).toBe('Daren')
    expect(daren.captured).toBe(true)
    const roy = r.save.run!.partyUnits[0] as { name: string; captured?: boolean }
    expect(roy.name).toBe('Roy')
    expect(roy.captured).toBeUndefined()
  })

  it('migrates mid-combat units too', () => {
    const save = {
      ...minimalSave,
      combat: {
        units: {
          e1: { id: 'e1', name: 'Bandit (captured)', hp: { current: 0, max: 18 } },
        },
      },
    }
    const r = loadFromString(JSON.stringify(save))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const e1 = (r.save.combat as { units: Record<string, { name: string; captured?: boolean }> }).units['e1']!
    expect(e1.name).toBe('Bandit')
    expect(e1.captured).toBe(true)
  })
})
