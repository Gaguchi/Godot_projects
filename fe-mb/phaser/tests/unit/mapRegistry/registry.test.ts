import { describe, it, expect } from 'vitest'
import { createMapRegistry } from '../../../src/mapRegistry/registry'
import { generateDungeon } from '../../../src/procgen/dungeonGenerator'
import type { WorldMap } from '../../../src/domain/map'
import { asMapId, asNodeId, asEncounterTableId } from '../../../src/domain/ids'

const stubWorld: WorldMap = {
  id: asMapId('test'), width: 10, height: 10, tileSize: 64,
  terrainGrid: [],
  nodes: [
    { id: asNodeId('pine'), type: 'town', position: { x: 1, y: 1 }, visiblePredicate: { kind: 'always' } },
    { id: asNodeId('exit'), type: 'exit', position: { x: 9, y: 9 }, visiblePredicate: { kind: 'always' } },
  ],
  edges: [{ from: asNodeId('pine'), to: asNodeId('exit'), encounterTableId: asEncounterTableId('road'), rollChance: 0.35 }],
}

describe('MapRegistry', () => {
  it('resolveRef returns node when valid', () => {
    const reg = createMapRegistry({ overworld: { test: stubWorld } })
    const r = reg.resolveRef({ mapKind: 'overworld', mapId: asMapId('test'), nodeId: asNodeId('pine') })
    expect(r).not.toBeNull()
  })

  it('resolveRef returns null for unknown node', () => {
    const reg = createMapRegistry({ overworld: { test: stubWorld } })
    const r = reg.resolveRef({ mapKind: 'overworld', mapId: asMapId('test'), nodeId: asNodeId('phantom') })
    expect(r).toBeNull()
  })

  it('validate catches dangling edge nodes', () => {
    const broken: WorldMap = {
      ...stubWorld,
      edges: [{ from: asNodeId('pine'), to: asNodeId('phantom'), encounterTableId: asEncounterTableId('e'), rollChance: 0 }],
    }
    const reg = createMapRegistry({ overworld: { test: broken } })
    const v = reg.validate()
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.issues.length).toBeGreaterThan(0)
  })

  it('exposes dungeon generators', () => {
    const reg = createMapRegistry({ dungeonGenerators: { 'smugglers_cave': generateDungeon as never } })
    expect(reg.dungeonGenerators['smugglers_cave']).toBeDefined()
  })
})
