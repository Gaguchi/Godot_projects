/**
 * Brief §2.14 rule 6 / §7.31: defeat is terminal — the autosave is overwritten with `run: null` and `meta.runsLost++`
 * BEFORE the game-over screen renders, so "Return to Title → Continue" can never be a retreat. Asserted on the
 * PERSISTED FILE (what the host was handed), not on the screen. The runtime's commit order (persist → listeners)
 * is what makes this true; the real reducer path runs once WP-FLOW has landed, and `endRun.ordering.test.ts`
 * pins the same ordering today with a fake reducer.
 */
import { describe, expect, it } from 'vitest'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { createRuntime } from '../../../../src/engine/flow/runtime'
import { fromSaveFile, parseSave, serialize, toSaveFile } from '../../../../src/engine/save/codec'
import type { SaveFile } from '../../../../src/engine/types'
import { LEDGER, blankState, landed, testEnv } from '../../../helpers/saves'

const env = testEnv()

describe('save/endRun', () => {
  it('a terminal state persists as run: null — the ledger is a transient summary, never written', () => {
    const over = { ...blankState(), ledger: LEDGER, screen: { kind: 'gameOver' as const } }
    const file = toSaveFile(over, env)
    expect(file.run).toBeNull()
    expect(file.combat).toBeNull()
    expect('ledger' in file).toBe(false)
    expect('screen' in file).toBe(false)
    const back = fromSaveFile(file)
    expect(back.run).toBeNull()
    expect(back.ledger).toBeNull()
    expect(back.screen.kind).toBe('title')
  })

  it('defeat null-save precedes the gameOver frame: persisted run null + runsLost++ before any listener sees the screen', (ctx) => {
    if (!landed(() => fixtureFor('overworld', 7, env))) return ctx.skip()
    const initial = fixtureFor('overworld', 7, env)
    expect(initial.run).not.toBeNull()

    const timeline: string[] = []
    const persisted: { readonly file: SaveFile; readonly urgent: boolean }[] = []
    const rt = createRuntime({
      env,
      initial,
      log: true,
      persist: (file, urgent) => {
        persisted.push({ file, urgent })
        timeline.push(`persist:${file.run === null ? 'null' : 'run'}`)
      },
    })
    rt.subscribe((state) => timeline.push(`frame:${state.screen.kind}`))

    // A quest-damage wipe: settle step 1b ends the run in the SAME dispatch (CONTRACT-CHANGES 0013).
    rt.dispatch({ type: 'quest/applyEffects', effects: [{ kind: 'damageParty', amount: 999 }] })
    rt.drain()

    const state = rt.getState()
    expect(state.screen.kind).toBe('gameOver')
    expect(state.run).toBeNull()
    expect(state.ledger?.outcome).toBe('lost')

    const nullSaveAt = timeline.indexOf('persist:null')
    const gameOverAt = timeline.indexOf('frame:gameOver')
    expect(nullSaveAt).toBeGreaterThanOrEqual(0)
    expect(gameOverAt).toBeGreaterThanOrEqual(0)
    expect(nullSaveAt).toBeLessThan(gameOverAt)

    const nullSave = persisted.find((p) => p.file.run === null)!
    expect(nullSave.urgent).toBe(true)
    expect(nullSave.file.meta.runsLost).toBe(initial.meta.runsLost + 1)
    expect(nullSave.file.combat).toBeNull()

    // The file the host wrote is a valid save that reloads to Title with nothing to Continue.
    const parsed = parseSave(serialize(nullSave.file), env)
    expect(parsed.ok, parsed.ok ? '' : parsed.detail).toBe(true)
    if (!parsed.ok) return
    const reloaded = fromSaveFile(parsed.value)
    expect(reloaded.run).toBeNull()
    expect(reloaded.screen.kind).toBe('title')
    expect(reloaded.meta.runsLost).toBe(initial.meta.runsLost + 1)
  })
})
