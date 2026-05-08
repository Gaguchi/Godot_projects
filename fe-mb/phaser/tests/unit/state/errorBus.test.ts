import { describe, it, expect, vi } from 'vitest'
import { createErrorBus } from '../../../src/state/errorBus'

describe('ErrorBus', () => {
  it('emits errors to subscribers with context', () => {
    const bus = createErrorBus()
    const sub = vi.fn()
    bus.subscribe(sub)
    bus.emit({ source: 'combatStore', error: new Error('x'), context: { action: 'playCard' } })
    expect(sub).toHaveBeenCalled()
    expect(sub.mock.calls[0]![0].source).toBe('combatStore')
  })

  it('keeps a last-N ring buffer for diagnostic export', () => {
    const bus = createErrorBus(3)
    for (let i = 0; i < 5; i++) bus.emit({ source: 's', error: new Error(`e${i}`), context: {} })
    const recent = bus.recent()
    expect(recent.length).toBe(3)
    expect(recent[0]!.error.message).toBe('e2')
  })
})
