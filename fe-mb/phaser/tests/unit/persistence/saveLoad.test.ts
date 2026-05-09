import { describe, it, expect } from 'vitest'
import { buildSaveFile, saveToString } from '../../../src/persistence/save'
import { loadFromString } from '../../../src/persistence/load'

describe('save/load', () => {
  it('roundtrip preserves meta and empty run', () => {
    const save = buildSaveFile({
      meta: { gameStarted: false, totalRuns: 0 },
      run: null, combat: null, actionLog: [],
    })
    const r = loadFromString(saveToString(save))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.save.meta.gameStarted).toBe(false)
      expect(r.save.run).toBeNull()
    }
  })

  it('rejects malformed JSON with ok:false', () => {
    const r = loadFromString('not json')
    expect(r.ok).toBe(false)
  })

  it('rejects schema-invalid payload', () => {
    const r = loadFromString(JSON.stringify({ saveVersion: 'x' }))
    expect(r.ok).toBe(false)
  })

  it('warns on version mismatch but does not reject', () => {
    const save = buildSaveFile({ meta: { gameStarted: false, totalRuns: 0 }, run: null, combat: null, actionLog: [] })
    save.saveVersion = '0.4.0' as never
    const r = loadFromString(saveToString(save))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings.some(w => w.includes('version'))).toBe(true)
  })
})
