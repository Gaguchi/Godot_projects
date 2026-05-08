import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../../../src/state/eventBus'
import type { DomainEvent } from '../../../src/contracts'

describe('EventBus', () => {
  it('emits to subscribers', () => {
    const bus = createEventBus()
    const sub = vi.fn()
    bus.subscribe(sub)
    const evt: DomainEvent = { type: 'BattleVictory', payload: { battleId: 'b1', survivors: [], capturedIds: [] } }
    bus.emit(evt)
    expect(sub).toHaveBeenCalledWith(evt)
  })

  it('unsubscribe stops further events', () => {
    const bus = createEventBus()
    const sub = vi.fn()
    const off = bus.subscribe(sub)
    bus.emit({ type: 'BattleDefeat', payload: { battleId: 'b' } })
    off()
    bus.emit({ type: 'BattleDefeat', payload: { battleId: 'b' } })
    expect(sub).toHaveBeenCalledTimes(1)
  })

  it('multiple subscribers all receive events', () => {
    const bus = createEventBus()
    const a = vi.fn(), b = vi.fn()
    bus.subscribe(a); bus.subscribe(b)
    bus.emit({ type: 'BattleDefeat', payload: { battleId: 'x' } })
    expect(a).toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
  })

  it('subscriber error does not break other subscribers', () => {
    const bus = createEventBus()
    bus.subscribe(() => { throw new Error('boom') })
    const ok = vi.fn()
    bus.subscribe(ok)
    expect(() => bus.emit({ type: 'BattleDefeat', payload: { battleId: 'x' } })).not.toThrow()
    expect(ok).toHaveBeenCalled()
  })

  it('replay events in order via replayAll', () => {
    const bus = createEventBus()
    const log: string[] = []
    bus.subscribe(e => log.push(e.type))
    bus.replayAll([
      { type: 'BattleStarted', payload: { battleId: 'a', enemies: [] } },
      { type: 'BattleVictory', payload: { battleId: 'a', survivors: [], capturedIds: [] } },
    ])
    expect(log).toEqual(['BattleStarted', 'BattleVictory'])
  })
})
