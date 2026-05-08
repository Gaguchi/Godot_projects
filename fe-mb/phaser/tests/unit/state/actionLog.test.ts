import { describe, it, expect } from 'vitest'
import { createActionLog } from '../../../src/state/actionLog'

describe('ActionLog', () => {
  it('appends and ring-buffers at capacity', () => {
    const log = createActionLog(3)
    for (let i = 0; i < 5; i++) {
      log.append({ store: 'run', action: { type: 'addGold' as const, payload: { amount: i } }, timestamp: i, rngStateBeforeAction: { seed: 0, counter: 0 } })
    }
    const all = log.snapshot()
    expect(all.length).toBe(3)
    expect((all[0]!.action.payload as { amount: number }).amount).toBe(2)
  })

  it('serialize/hydrate roundtrip', () => {
    const log = createActionLog(10)
    log.append({ store: 'run', action: { type: 'addGold', payload: { amount: 5 } }, timestamp: 1, rngStateBeforeAction: { seed: 0, counter: 0 } })
    const dump = log.serialize()
    const log2 = createActionLog(10)
    log2.hydrate(dump)
    expect(log2.snapshot()).toEqual(dump)
  })
})
