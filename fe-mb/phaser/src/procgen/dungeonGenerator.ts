import type { DungeonGraph, DungeonRoom } from '../domain/map'
import type { RNG } from '../domain/rng'
import { asDungeonId, asNodeId, type NodeId } from '../domain/ids'

export interface DungeonGenerateParams {
  dungeonId: string
  fogOfWar?: DungeonGraph['fogOfWar']
}

const ROOM_WEIGHTS: { type: DungeonRoom['type']; weight: number }[] = [
  { type: 'combat', weight: 60 },
  { type: 'event', weight: 25 },
  { type: 'rest', weight: 10 },
  { type: 'elite', weight: 5 },
]

const NUM_ROWS = 6        // Compressed StS-style (15+boss is too much for foundation)
const COLS_PER_ROW = 4
const NUM_PATHS = 4

interface PathStep { col: number }

/**
 * Generates a Slay the Spire-style dungeon graph.
 *
 * Compressed for foundation: 6 rows + boss instead of StS canonical 15+boss.
 * Implements the core algorithm: path tracing, forced placements, weighted typing,
 * convergence to a single boss room.
 *
 * Per `docs/research/sts-procgen.md`:
 *   - Forced: row 0 = Combat, last data row = Rest, boss row = single Boss
 *   - Constraints: no Elite/Rest in early rows, no Rest right before boss
 *   - All paths converge on the boss
 */
export function generateDungeon(rng: RNG, params: DungeonGenerateParams): DungeonGraph {
  const seed = rng.state().seed
  const fogOfWar = params.fogOfWar ?? 'full'

  // Phase 1: trace NUM_PATHS paths from row 0 to row NUM_ROWS-1
  const pathSteps: PathStep[][] = []
  const usedFirstCols = new Set<number>()
  for (let p = 0; p < NUM_PATHS; p++) {
    const steps: PathStep[] = []
    let col: number
    if (p === 0) {
      col = rng.nextInt(0, COLS_PER_ROW - 1)
    } else if (p === 1) {
      // Path 1 must start at a different column from path 0
      do { col = rng.nextInt(0, COLS_PER_ROW - 1) } while (usedFirstCols.has(col))
    } else {
      col = rng.nextInt(0, COLS_PER_ROW - 1)
    }
    usedFirstCols.add(col)
    steps.push({ col })
    for (let r = 1; r < NUM_ROWS; r++) {
      const prev = col
      // Move ±0/1 column, clamped
      const candidates: number[] = []
      if (prev - 1 >= 0) candidates.push(prev - 1)
      candidates.push(prev)
      if (prev + 1 < COLS_PER_ROW) candidates.push(prev + 1)
      col = candidates[rng.nextInt(0, candidates.length - 1)]!
      steps.push({ col })
    }
    pathSteps.push(steps)
  }

  // Phase 2: collect unique nodes
  const nodeMap = new Map<string, DungeonRoom>()
  const nodeIdAt = (row: number, col: number): string => `r${row}c${col}`
  const edgeSet = new Set<string>()

  for (const path of pathSteps) {
    let prevId: string | null = null
    for (let r = 0; r < path.length; r++) {
      const col = path[r]!.col
      const id = nodeIdAt(r, col)
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id: asNodeId(id), type: 'combat', encounterRef: null })
      }
      if (prevId !== null) {
        const edgeKey = `${prevId}->${id}`
        edgeSet.add(edgeKey)
      }
      prevId = id
    }
  }

  // Phase 3: forced typing
  const lastDataRow = NUM_ROWS - 1
  for (const [id, room] of nodeMap.entries()) {
    const rowIdx = parseInt(id.slice(1, id.indexOf('c')), 10)
    if (rowIdx === 0) {
      room.type = 'combat'
    } else if (rowIdx === lastDataRow) {
      room.type = 'rest'
    } else {
      // Weighted random
      const totalWeight = ROOM_WEIGHTS.reduce((s, w) => s + w.weight, 0)
      let roll = rng.nextInt(0, totalWeight - 1)
      let chosen: DungeonRoom['type'] = 'combat'
      for (const w of ROOM_WEIGHTS) {
        if (roll < w.weight) { chosen = w.type; break }
        roll -= w.weight
      }
      // Constraint: no Elite/Rest in row 1
      if (rowIdx <= 1 && (chosen === 'elite' || chosen === 'rest')) chosen = 'combat'
      room.type = chosen
    }
  }

  // Phase 4: add boss row
  const bossRow = NUM_ROWS
  const bossId = `r${bossRow}c0`
  const bossRoom: DungeonRoom = { id: asNodeId(bossId), type: 'boss', encounterRef: null }
  nodeMap.set(bossId, bossRoom)

  // Connect every last-data-row node to boss
  for (const id of nodeMap.keys()) {
    const rowIdx = parseInt(id.slice(1, id.indexOf('c')), 10)
    if (rowIdx === lastDataRow) {
      edgeSet.add(`${id}->${bossId}`)
    }
  }

  // Build rows[][]
  const rows: DungeonRoom[][] = []
  for (let r = 0; r <= bossRow; r++) {
    const row: DungeonRoom[] = []
    for (let c = 0; c < COLS_PER_ROW; c++) {
      const id = nodeIdAt(r, c)
      const room = nodeMap.get(id)
      if (room) row.push(room)
    }
    if (r === bossRow) {
      row.push(bossRoom)
    }
    rows.push(row)
  }

  // Build edges array
  const edges: Array<[NodeId, NodeId]> = []
  for (const key of edgeSet) {
    const [from, to] = key.split('->')
    edges.push([asNodeId(from!), asNodeId(to!)])
  }

  return {
    id: asDungeonId(params.dungeonId),
    rows,
    edges,
    entryRow: 0,
    bossRow,
    genSeed: seed,
    fogOfWar,
  }
}
