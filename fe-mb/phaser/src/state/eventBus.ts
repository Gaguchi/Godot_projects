import type { DomainEvent } from '../contracts'

export interface EventBus {
  emit(event: DomainEvent): void
  subscribe(listener: (e: DomainEvent) => void): () => void
  replayAll(events: DomainEvent[]): void
}

export function createEventBus(): EventBus {
  const listeners = new Set<(e: DomainEvent) => void>()
  const bus: EventBus = {
    emit(event) {
      for (const fn of listeners) {
        try { fn(event) }
        catch (err) {
          // eslint-disable-next-line no-console
          console.error('eventBus listener threw', err)
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    replayAll(events) {
      for (const e of events) bus.emit(e)
    },
  }
  return bus
}
