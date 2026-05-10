import { describe, it, expect, beforeEach } from 'vitest'
import { listSlots, readSlot, writeSlot, deleteSlot, isSlotEmpty, NUM_SLOTS } from '../../../src/persistence/saveSlots'
import { buildSaveFile } from '../../../src/persistence/save'
import type { RunState } from '../../../src/state/runStore'
import { createFlagStore } from '../../../src/state/flags'

const buildSaveWithRun = () => {
  const flags = createFlagStore()
  const fakeRun: RunState = {
    runId: 'test-run',
    runSeed: 0,
    party: { units: {}, partyOrder: [] },
    inventory: { items: [] },
    gold: 80,
    worldPosition: { mapId: 'borderlands' as never, nodeId: 'frontier_camp' as never },
    visitedNodes: {},
    clearedEncounters: {},
    pendingTravelPath: null,
    flags,
    questStates: {},
    activeDungeon: null,
    rngState: { seed: 0, counter: 0 },
    deathLog: [],
    starvationDamagePerHop: 3,
    oneShotsFired: new Set(),
    pendingDialogue: null,
    dispatch: () => undefined,
  } as never
  return buildSaveFile({
    meta: { gameStarted: true, totalRuns: 1 },
    run: fakeRun,
    combat: null,
    actionLog: [],
  })
}

const buildEmptyish = () =>
  buildSaveFile({
    meta: { gameStarted: true, totalRuns: 1 },
    run: null,
    combat: null,
    actionLog: [],
  })

describe('saveSlots (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('listSlots returns NUM_SLOTS empty rows by default', () => {
    const slots = listSlots()
    expect(slots).toHaveLength(NUM_SLOTS)
    expect(slots.every(isSlotEmpty)).toBe(true)
  })

  it('writeSlot persists and listSlots reflects metadata', () => {
    const ok = writeSlot('1', buildSaveWithRun(), 'Test Slot 2')
    expect(ok).toBe(true)
    const slots = listSlots()
    const slot1 = slots.find((s) => s.slotId === '1')!
    expect(isSlotEmpty(slot1)).toBe(false)
    expect(slot1.label).toBe('Test Slot 2')
    expect(slot1.savedAt).toBeGreaterThan(0)
    expect(slot1.summary?.gold).toBe(80)
  })

  it('readSlot returns the saved data', () => {
    const save = buildEmptyish()
    writeSlot('0', save)
    const result = readSlot('0')
    expect(result).not.toBeNull()
    expect(result!.ok).toBe(true)
    if (result!.ok) {
      expect(result!.save.saveVersion).toBe(save.saveVersion)
    }
  })

  it('readSlot returns null for unwritten slot', () => {
    expect(readSlot('2')).toBeNull()
  })

  it('deleteSlot wipes data and metadata', () => {
    writeSlot('0', buildSaveWithRun())
    deleteSlot('0')
    expect(readSlot('0')).toBeNull()
    expect(isSlotEmpty(listSlots()[0]!)).toBe(true)
  })

  it('writing different slots doesn\'t overwrite siblings', () => {
    writeSlot('0', buildSaveWithRun(), 'A')
    writeSlot('1', buildSaveWithRun(), 'B')
    const slots = listSlots()
    expect(slots[0]!.label).toBe('A')
    expect(slots[1]!.label).toBe('B')
  })

  it('buildEmptyish (no run) is treated as empty in listSlots', () => {
    writeSlot('0', buildEmptyish(), 'no-run')
    expect(isSlotEmpty(listSlots()[0]!)).toBe(true)
  })
})
