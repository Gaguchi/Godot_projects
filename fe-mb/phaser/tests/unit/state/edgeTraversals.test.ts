import { describe, it, expect } from 'vitest'
import { useRunStore, edgeTraversalKey } from '../../../src/state/runStore'
import { serializeRun, buildSaveFile, saveToString } from '../../../src/persistence/save'
import { loadFromString } from '../../../src/persistence/load'
import { createRng, deriveRng } from '../../../src/systems/rng'

describe('edge traversal counter', () => {
  it('keys a road the same in both directions', () => {
    expect(edgeTraversalKey('borderlands', 'a', 'b'))
      .toBe(edgeTraversalKey('borderlands', 'b', 'a'))
    // ...but a road in another region is a different road.
    expect(edgeTraversalKey('borderlands', 'a', 'b'))
      .not.toBe(edgeTraversalKey('thornwood', 'a', 'b'))
  })

  it('counts crossings and remembers the day of the last one', () => {
    const store = useRunStore.getState()
    store.__resetForTest()
    const k = edgeTraversalKey('borderlands', 'frontier_camp', 'pine_crossing')

    expect(useRunStore.getState().edgeTraversals[k]).toBeUndefined()

    store.dispatch({ type: 'recordEdgeTraversal', payload: { mapId: 'borderlands', from: 'frontier_camp', to: 'pine_crossing' } })
    expect(useRunStore.getState().edgeTraversals[k]).toEqual({ count: 1, lastDay: 1 })

    // A day passes, then we walk back the other way — same road, count 2.
    store.dispatch({ type: 'consumeFoodPerHop' })
    store.dispatch({ type: 'recordEdgeTraversal', payload: { mapId: 'borderlands', from: 'pine_crossing', to: 'frontier_camp' } })
    expect(useRunStore.getState().edgeTraversals[k]).toEqual({ count: 2, lastDay: 2 })
  })

  it('gives a different encounter roll on the second crossing', () => {
    // This is the whole point of the counter. `rngState` never advances during
    // play, so without the pass number in the label both crossings derive the
    // SAME sub-RNG and a road ambushes you identically for the entire run.
    const rngState = { seed: 12345, counter: 0 }
    const label = (pass: number) => `hop:borderlands:frontier_camp->pine_crossing#${pass}`

    const first = deriveRng(createRng(rngState), label(0)).next()
    const second = deriveRng(createRng(rngState), label(1)).next()
    expect(first).not.toBe(second)

    // Determinism still holds: the same pass over the same edge replays.
    expect(deriveRng(createRng(rngState), label(0)).next()).toBe(first)
  })

  it('survives the real save → load path', () => {
    const store = useRunStore.getState()
    store.__resetForTest()
    store.dispatch({ type: 'recordEdgeTraversal', payload: { mapId: 'borderlands', from: 'frontier_camp', to: 'pine_crossing' } })

    const json = saveToString(buildSaveFile({
      meta: { gameStarted: true, totalRuns: 0 },
      run: useRunStore.getState(),
      combat: null,
      actionLog: [],
    }))
    const loaded = loadFromString(json)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const k = edgeTraversalKey('borderlands', 'frontier_camp', 'pine_crossing')
    expect(loaded.save.run?.edgeTraversals?.[k]).toEqual({ count: 1, lastDay: 1 })

    // And hydrating puts it back on the store, so a loaded game does not
    // re-roll roads it had already walked.
    store.dispatch({ type: 'resetRun' })
    expect(useRunStore.getState().edgeTraversals[k]).toBeUndefined()
    const run = loaded.save.run!
    useRunStore.getState().dispatch({
      type: 'hydrateFromSave',
      payload: {
        gold: run.gold,
        worldPosition: run.worldPosition,
        partyUnits: run.partyUnits as { id: string }[],
        partyOrder: run.partyOrder,
        inventoryItems: run.inventoryItems,
        edgeTraversals: run.edgeTraversals,
      },
    })
    expect(useRunStore.getState().edgeTraversals[k]).toEqual({ count: 1, lastDay: 1 })
  })

  it('serializes as a plain object (no Set/Map leaking into JSON)', () => {
    const store = useRunStore.getState()
    store.__resetForTest()
    store.dispatch({ type: 'recordEdgeTraversal', payload: { mapId: 'ashfall', from: 'x', to: 'y' } })
    const s = serializeRun(useRunStore.getState())!
    expect(JSON.parse(JSON.stringify(s.edgeTraversals))).toEqual(s.edgeTraversals)
  })
})
