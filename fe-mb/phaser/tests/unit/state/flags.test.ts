import { describe, it, expect } from 'vitest'
import { createFlagStore } from '../../../src/state/flags'
import { asFlagKey } from '../../../src/domain/ids'

describe('TypedFlagStore', () => {
  it('set/get/has roundtrip', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('a'), 1, 'run')
    expect(fs.get(asFlagKey('a'))).toBe(1)
    expect(fs.has(asFlagKey('a'))).toBe(true)
    expect(fs.has(asFlagKey('absent'))).toBe(false)
  })

  it('clearScope removes only matching scope', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('run.x'), 1, 'run')
    fs.set(asFlagKey('battle.x'), 2, 'battle')
    fs.set(asFlagKey('perm.x'), 3, 'permanent')
    fs.clearScope('battle')
    expect(fs.has(asFlagKey('run.x'))).toBe(true)
    expect(fs.has(asFlagKey('battle.x'))).toBe(false)
    expect(fs.has(asFlagKey('perm.x'))).toBe(true)
  })

  it('enumerate returns all entries with scope', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('a'), 1, 'run')
    fs.set(asFlagKey('b'), 2, 'quest')
    const entries = fs.enumerate()
    expect(entries.length).toBe(2)
    expect(entries.find(e => e.key === 'a')?.scope).toBe('run')
    expect(entries.find(e => e.key === 'b')?.scope).toBe('quest')
  })

  it('default scope is run', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('x'), 1)
    expect(fs.enumerate()[0]!.scope).toBe('run')
  })

  it('serialize/hydrate roundtrip', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('a'), { foo: 1 }, 'permanent')
    const dump = fs.serialize()
    const fs2 = createFlagStore()
    fs2.hydrate(dump)
    expect(fs2.get(asFlagKey('a'))).toEqual({ foo: 1 })
  })
})
