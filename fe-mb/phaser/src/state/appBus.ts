import { createErrorBus } from './errorBus'
import { createEventBus } from './eventBus'
import { createActionLog } from './actionLog'
import type { DomainEvent } from '../contracts'

/**
 * The app-wide bus singletons.
 *
 * These used to be created at module scope inside `App.tsx`, which meant any
 * non-React module that wanted to publish a domain event would have had to
 * import the React root — a cycle. Nothing did, which is a large part of why
 * `eventBus.emit` had zero call sites in the whole codebase and the quest
 * engine never ran. They live here so scenes, systems wiring and the store can
 * reach them without touching the component tree.
 *
 * The bus carries events only. Subscribers dispatch back into the stores; the
 * bus itself is never a mutation channel (CONTEXT.md §1.9).
 */
export const errorBus = createErrorBus()
export const eventBus = createEventBus()
export const actionLog = createActionLog()

export const busRefs = { errorBus, eventBus, actionLog }

/** Publish a domain event. Thin wrapper so call sites read as intent. */
export function emitDomainEvent(event: DomainEvent): void {
  eventBus.emit(event)
}
