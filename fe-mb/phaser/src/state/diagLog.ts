/**
 * Diagnostic log — a ring buffer of structured events I (Claude) can query
 * via Playwright `browser_evaluate(() => window.__debug.diag.recent(50))`.
 *
 * Design goals:
 *   - Bounded memory (last 500 entries)
 *   - Categorized so I can filter (store/dialog/encounter/path/route/error)
 *   - Mirrors to devtools console.debug/warn/error so a human can also see it
 *   - Subscribe API for live tailing in tests / dev HUD
 *
 * Convention: callers use `diag('cat', 'msg', data?, level?)` at choke points
 * (store dispatch, dialogue lifecycle, encounter rolls). Don't log every
 * render or polling loop — only state transitions and decisions.
 */

export type DiagLevel = 'info' | 'warn' | 'error'

/**
 * Open category set — narrowed via convention. Keep these names short and
 * stable so my queries (e.g. byCategory('encounter')) don't break.
 */
export type DiagCategory =
  | 'store.run'
  | 'store.combat'
  | 'store.meta'
  | 'dialog'
  | 'encounter'
  | 'path'
  | 'route'
  | 'lifecycle'
  | 'error'
  | string

export interface DiagEntry {
  id: number
  ts: number
  cat: DiagCategory
  level: DiagLevel
  msg: string
  data?: unknown
}

const MAX = 500
const ring: DiagEntry[] = []
let nextId = 1
const listeners = new Set<(e: DiagEntry) => void>()

/** Append one entry. Auto-mirrors to devtools console at appropriate level. */
export function diag(
  cat: DiagCategory,
  msg: string,
  data?: unknown,
  level: DiagLevel = 'info',
): void {
  const entry: DiagEntry = { id: nextId++, ts: performance.now(), cat, level, msg }
  if (data !== undefined) entry.data = data
  ring.push(entry)
  if (ring.length > MAX) ring.shift()

  for (const fn of listeners) {
    try { fn(entry) } catch (err) {
      // Avoid feedback loops if a listener throws — log nothing here.
      void err
    }
  }

  // Mirror to devtools console (a human + Claude both see this in browser logs).
  // eslint-disable-next-line no-console
  const out = console
  if (level === 'error') out.error(`[${cat}] ${msg}`, data ?? '')
  else if (level === 'warn') out.warn(`[${cat}] ${msg}`, data ?? '')
  else out.debug(`[${cat}] ${msg}`, data ?? '')
}

export const diagLog = {
  log: diag,

  /** Last `n` entries (default 50). */
  recent(n = 50): DiagEntry[] {
    return ring.slice(-n)
  },

  /** Filter by category (exact match). */
  byCategory(cat: DiagCategory, n = 50): DiagEntry[] {
    return ring.filter((e) => e.cat === cat).slice(-n)
  },

  /** Filter by level. */
  byLevel(level: DiagLevel, n = 50): DiagEntry[] {
    return ring.filter((e) => e.level === level).slice(-n)
  },

  /** Entries newer than `ts` (performance.now-style timestamp). */
  since(ts: number): DiagEntry[] {
    return ring.filter((e) => e.ts >= ts)
  },

  /** Substring or regex search across msg + JSON.stringify(data). */
  search(query: RegExp | string, n = 50): DiagEntry[] {
    const re = typeof query === 'string' ? new RegExp(query, 'i') : query
    return ring
      .filter((e) => re.test(e.msg) || (e.data !== undefined && re.test(JSON.stringify(e.data))))
      .slice(-n)
  },

  /**
   * Pretty-print the last `n` entries as a single string. Convenient for
   * `browser_evaluate(() => window.__debug.diag.dump(20))` because the
   * caller gets readable text instead of a serialized array.
   */
  dump(n = 50): string {
    return ring
      .slice(-n)
      .map((e) => {
        const t = e.ts.toFixed(1).padStart(8, ' ')
        const lvl = e.level.toUpperCase().padEnd(5, ' ')
        const cat = e.cat.padEnd(14, ' ')
        const data = e.data !== undefined ? '  ' + JSON.stringify(e.data).slice(0, 200) : ''
        return `${t}ms ${lvl} ${cat} ${e.msg}${data}`
      })
      .join('\n')
  },

  /** Wipe the buffer. Useful at scenario start in tests. */
  clear(): void {
    ring.length = 0
    nextId = 1
  },

  /** Subscribe to every new entry. Returns an unsubscribe fn. */
  subscribe(fn: (e: DiagEntry) => void): () => void {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },

  /** Current buffer size. */
  size(): number {
    return ring.length
  },

  /** All categories that have appeared so far (for discovery). */
  categories(): string[] {
    return Array.from(new Set(ring.map((e) => e.cat)))
  },
}
