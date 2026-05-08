import type { RngState } from '../domain/rng'

export type StoreName = 'meta' | 'run' | 'combat'

export interface ActionLogEntry {
  store: StoreName
  action: { type: string; payload?: unknown }
  timestamp: number
  rngStateBeforeAction: RngState
}

export interface ActionLog {
  append(entry: ActionLogEntry): void
  snapshot(): ActionLogEntry[]
  serialize(): ActionLogEntry[]
  hydrate(entries: ActionLogEntry[]): void
}

export function createActionLog(capacity = 200): ActionLog {
  let buf: ActionLogEntry[] = []
  return {
    append(entry) {
      buf.push(entry)
      if (buf.length > capacity) buf = buf.slice(buf.length - capacity)
    },
    snapshot: () => [...buf],
    serialize: () => [...buf],
    hydrate(entries) { buf = entries.slice(-capacity) },
  }
}
