export interface ErrorEntry {
  source: string
  error: Error
  context: Record<string, unknown>
  timestamp: number
}

export interface ErrorBus {
  emit(entry: { source: string; error: Error; context: Record<string, unknown> }): void
  subscribe(fn: (e: ErrorEntry) => void): () => void
  recent(): ErrorEntry[]
}

export function createErrorBus(ringSize = 50): ErrorBus {
  const ring: ErrorEntry[] = []
  const subs = new Set<(e: ErrorEntry) => void>()

  return {
    emit({ source, error, context }) {
      const entry: ErrorEntry = { source, error, context, timestamp: Date.now() }
      ring.push(entry)
      if (ring.length > ringSize) ring.shift()
      for (const fn of subs) {
        try { fn(entry) } catch { /* swallow — never let an error subscriber break */ }
      }
    },
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn) } },
    recent: () => [...ring],
  }
}
