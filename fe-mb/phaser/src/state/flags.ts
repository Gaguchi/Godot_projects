import type { FlagKey } from '../domain/ids'
import type { FlagScope } from '../domain/quest'

export interface SerializedFlag {
  key: string
  value: unknown
  scope: FlagScope
}

export interface TypedFlagStore {
  set(key: FlagKey, value: unknown, scope?: FlagScope): void
  get<T = unknown>(key: FlagKey): T | undefined
  has(key: FlagKey): boolean
  clearScope(scope: FlagScope): void
  enumerate(): SerializedFlag[]
  serialize(): SerializedFlag[]
  hydrate(data: SerializedFlag[]): void
  asPredicateMap(): Map<string, { value: unknown; scope: FlagScope }>
}

export function createFlagStore(): TypedFlagStore {
  const data = new Map<string, { value: unknown; scope: FlagScope }>()

  return {
    set(key, value, scope = 'run') {
      data.set(key as unknown as string, { value, scope })
    },
    get<T = unknown>(key: FlagKey): T | undefined {
      return data.get(key as unknown as string)?.value as T | undefined
    },
    has(key) {
      return data.has(key as unknown as string)
    },
    clearScope(scope) {
      for (const [k, v] of data.entries()) {
        if (v.scope === scope) data.delete(k)
      }
    },
    enumerate() {
      return Array.from(data.entries()).map(([key, { value, scope }]) => ({ key, value, scope }))
    },
    serialize() {
      return this.enumerate()
    },
    hydrate(entries) {
      data.clear()
      for (const { key, value, scope } of entries) data.set(key, { value, scope })
    },
    asPredicateMap() {
      return new Map(data)
    },
  }
}
