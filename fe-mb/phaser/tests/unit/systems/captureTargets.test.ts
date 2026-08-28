import { describe, it, expect } from 'vitest'
import { resolveCaptureTargets } from '../../../src/systems/captureTargets'
import type { CaptureTarget } from '../../../src/domain/encounter'

const daren: CaptureTarget = {
  unitId: 'daren',
  capturedDialogueId: 'sq_blood_ties_daren_captured',
  killedDialogueId: 'sq_blood_ties_daren_killed',
  capturedFlag: 'daren_captured',
  killedFlag: 'daren_killed',
}

describe('resolveCaptureTargets', () => {
  it('sets the captured flag and opens the captured dialogue when taken alive', () => {
    const effects = resolveCaptureTargets([daren], { capturedIds: ['daren'], survivingEnemyIds: [] })
    expect(effects).toEqual([
      { kind: 'setFlag', key: 'daren_captured', value: true },
      { kind: 'startDialogue', treeId: 'sq_blood_ties_daren_captured' },
    ])
  })

  it('sets the killed flag when the target is neither captured nor still standing', () => {
    const effects = resolveCaptureTargets([daren], { capturedIds: [], survivingEnemyIds: ['bandit_1'] })
    expect(effects).toEqual([
      { kind: 'setFlag', key: 'daren_killed', value: true },
      { kind: 'startDialogue', treeId: 'sq_blood_ties_daren_killed' },
    ])
  })

  it('resolves to nothing when the target is still alive', () => {
    // Neither outcome happened, so the quest must not be told a story that
    // did not occur.
    const effects = resolveCaptureTargets([daren], { capturedIds: [], survivingEnemyIds: ['daren'] })
    expect(effects).toEqual([])
  })

  it('matches on unit id, not display name', () => {
    // The whole point of the identity refactor: 'Daren' the label must never
    // be what decides this.
    const effects = resolveCaptureTargets([daren], { capturedIds: ['Daren'], survivingEnemyIds: [] })
    expect(effects.some(e => e.kind === 'setFlag' && e.key === 'daren_captured')).toBe(false)
  })

  it('keeps every flag but only one dialogue when several targets resolve', () => {
    // runStore.pendingDialogue is a single slot; a second startDialogue would
    // silently clobber the first.
    const other: CaptureTarget = { ...daren, unitId: 'wolf', capturedFlag: 'wolf_captured', killedFlag: 'wolf_killed' }
    const effects = resolveCaptureTargets([daren, other], { capturedIds: ['daren', 'wolf'], survivingEnemyIds: [] })
    expect(effects.filter(e => e.kind === 'setFlag')).toHaveLength(2)
    expect(effects.filter(e => e.kind === 'startDialogue')).toHaveLength(1)
  })

  it('is a no-op for an encounter with no targets', () => {
    expect(resolveCaptureTargets([], { capturedIds: ['daren'] })).toEqual([])
  })
})
