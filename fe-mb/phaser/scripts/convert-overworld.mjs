#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PHASER_ROOT = dirname(__dirname)
const REPO_ROOT = dirname(PHASER_ROOT)

const SRC = join(REPO_ROOT, 'data', 'maps', 'overworld.json')
const DST_DIR = join(PHASER_ROOT, 'src', 'data', 'content', 'overworld')

function nameToId(name) {
  return name.toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function godotTypeToPhaser(t) {
  switch (t) {
    case 'TOWN': return 'town'
    case 'CAMP': return 'camp'
    case 'DUNGEON': return 'dungeon'
    case 'EXIT': return 'exit'
    default: return 'camp'
  }
}

const godot = JSON.parse(readFileSync(SRC, 'utf8'))
const idById = new Map() // numeric Godot id → string phaser id
const nodeByGId = new Map() // numeric → node ref

for (const n of godot.nodes) {
  const sid = nameToId(n.name)
  idById.set(n.id, sid)
  nodeByGId.set(n.id, n)
}

const groups = { borderlands: [], thornwood: [], ashfall: [] }
const edgesByRegion = { borderlands: [], thornwood: [], ashfall: [] }
const crossRegion = []

for (const n of godot.nodes) {
  const sid = idById.get(n.id)
  groups[n.region].push({
    id: sid,
    name: n.name,
    type: godotTypeToPhaser(n.type),
    position: { x: n.x, y: n.y },
    spawnPoint: n.spawn_point ?? false,
    encounterTableId: `${n.region}_road`,
  })
  for (const targetId of n.connections) {
    const target = nodeByGId.get(targetId)
    if (!target) continue
    // Avoid duplicate edges (only emit when this id < target.id)
    if (n.id >= target.id) continue
    const tid = idById.get(target.id)
    if (n.region !== target.region) {
      crossRegion.push({
        fromMapId: n.region,
        fromNodeId: sid,
        toMapId: target.region,
        toNodeId: tid,
        rollChance: 0.4,
      })
    } else {
      edgesByRegion[n.region].push({
        from: sid,
        to: tid,
        rollChance: 0.35,
        encounterTableId: `${n.region}_road`,
      })
    }
  }
}

mkdirSync(DST_DIR, { recursive: true })
for (const region of ['borderlands', 'thornwood', 'ashfall']) {
  const map = {
    id: region,
    regionId: region,
    name: { borderlands: 'The Borderlands', thornwood: 'Thornwood Wilds', ashfall: 'Ashfall Peaks' }[region],
    width: 2120,
    height: 700,
    nodes: groups[region],
    edges: edgesByRegion[region],
    regionEdges: crossRegion.filter((e) => e.fromMapId === region || e.toMapId === region),
  }
  writeFileSync(join(DST_DIR, `${region}.json`), JSON.stringify(map, null, 2) + '\n')
  console.log(`✓ ${region}.json: ${groups[region].length} nodes, ${edgesByRegion[region].length} intra edges`)
}
console.log(`Cross-region edges: ${crossRegion.length}`)
