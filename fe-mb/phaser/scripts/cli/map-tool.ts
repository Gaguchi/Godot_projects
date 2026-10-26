#!/usr/bin/env tsx
/**
 * map-tool — the deterministic half of the map-drawing pipeline
 * (`.claude/skills/drawing-maps`). The model writes a PLAN — an ASCII grid,
 * or a map-builder JSON with terrain painted straight onto the Ground layer —
 * and this tool does the tile work and the design checks. Never place blob
 * pieces by hand.
 *
 *   npm run map-tool -- ascii    <builder.json>
 *   npm run map-tool -- autotile <in.json> <out.json> [--terrain dirt|sand] [--ground px_grass]
 *   npm run map-tool -- lint     <grid.txt>
 *
 * ascii     prints the Ground layer one char per cell ('.' ground, '#' painted
 *           terrain, ' ' empty) so a pasted map can be read at a glance.
 * autotile  moves every Ground cell painted with the terrain onto the
 *           Transition layer as its 47-piece blob tile and makes Ground solid
 *           ground. Other layers pass through untouched. Terrain and ground
 *           keys are auto-detected from the Ground layer when not given.
 * lint      battle-grid design lint. Chars: `#` wall, `.` open, `~` dirt
 *           (open, cosmetic), `P` party spawn, `E` enemy spawn. Reports
 *           unreachable cells, one-tile passages, dead space off the
 *           critical path, and the enemy:party ratio. Exit 1 on a FAIL.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { autotileKey, cellKey, type TerrainKey } from '../../src/systems/autotile'

interface BuilderCell { k: string; s: number }
interface BuilderLayer { name: string; visible: boolean; halfOffset: boolean; cells: Record<string, BuilderCell> }
interface BuilderMap { version: number; cols: number; rows: number; cell: number; layers: BuilderLayer[] }

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function readMap(path: string): BuilderMap {
  return JSON.parse(readFileSync(path, 'utf8')) as BuilderMap
}

function layer(map: BuilderMap, name: string): BuilderLayer {
  const l = map.layers.find((x) => x.name === name)
  if (!l) throw new Error(`map has no "${name}" layer`)
  return l
}

/** Most common key on a layer among those matching `pred`. */
function dominantKey(l: BuilderLayer, pred: (k: string) => boolean): string | undefined {
  const counts = new Map<string, number>()
  for (const c of Object.values(l.cells)) if (pred(c.k)) counts.set(c.k, (counts.get(c.k) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

// ---------------------------------------------------------------- ascii ----

function cmdAscii(path: string): void {
  const map = readMap(path)
  const ground = layer(map, 'Ground')
  const groundKey = dominantKey(ground, (k) => k === 'px_grass') ?? dominantKey(ground, () => true)
  const lines: string[] = []
  for (let r = 0; r < map.rows; r++) {
    let row = ''
    for (let c = 0; c < map.cols; c++) {
      const cell = ground.cells[cellKey(c, r)]
      row += cell === undefined ? ' ' : cell.k === groundKey ? '.' : '#'
    }
    lines.push(`${String(r).padStart(2)} ${row}`)
  }
  console.log(`${map.cols}×${map.rows}  ground=${groundKey ?? '?'}  ('.' ground  '#' painted  ' ' empty)`)
  console.log(lines.join('\n'))
}

// ------------------------------------------------------------- autotile ----

function cmdAutotile(inPath: string, outPath: string): void {
  const map = readMap(inPath)
  const ground = layer(map, 'Ground')
  const terrainKey = arg('--terrain')
    ?? dominantKey(ground, (k) => k === 'px_dirt' || k === 'px_sand')?.replace('px_', '')
  if (terrainKey !== 'dirt' && terrainKey !== 'sand') {
    throw new Error(`could not detect a painted terrain on Ground (want px_dirt or px_sand); pass --terrain`)
  }
  const terrain: TerrainKey = terrainKey
  const groundKey = arg('--ground') ?? dominantKey(ground, (k) => k !== `px_${terrain}`) ?? 'px_grass'

  const painted = new Set<string>()
  for (const [id, c] of Object.entries(ground.cells)) if (c.k === `px_${terrain}`) painted.add(id)

  const newGround: Record<string, BuilderCell> = {}
  for (const [id, c] of Object.entries(ground.cells)) {
    newGround[id] = painted.has(id) ? { k: groundKey, s: 100 } : c
  }
  const transition: Record<string, BuilderCell> = {}
  for (const id of painted) {
    const [x, y] = id.split(',').map(Number) as [number, number]
    transition[id] = { k: autotileKey(painted, x, y, terrain), s: 100 }
  }

  const out: BuilderMap = {
    ...map,
    layers: map.layers.map((l) => {
      if (l.name === 'Ground') return { ...l, cells: newGround }
      if (l.name === 'Transition') return { ...l, cells: transition }
      return l
    }),
  }
  if (!out.layers.some((l) => l.name === 'Transition')) {
    out.layers.splice(1, 0, { name: 'Transition', visible: true, halfOffset: false, cells: transition })
  }
  writeFileSync(outPath, JSON.stringify(out, null, 1))
  const distinct = new Set(Object.values(transition).map((c) => c.k)).size
  console.log(`autotiled ${painted.size} ${terrain} cells over ${groundKey} → ${distinct} distinct pieces → ${outPath}`)
}

// ----------------------------------------------------------------- lint ----

type Cell = { x: number; y: number }

function cmdLint(path: string): void {
  const rows = readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.trim().length > 0)
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const at = (x: number, y: number): string => (x < 0 || y < 0 || x >= w || y >= h ? '#' : (rows[y]![x] ?? '#'))
  const open = (x: number, y: number): boolean => at(x, y) !== '#'
  const party: Cell[] = [], enemy: Cell[] = [], openCells: Cell[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = at(x, y)
    if (ch === 'P') party.push({ x, y })
    if (ch === 'E') enemy.push({ x, y })
    if (ch !== '#') openCells.push({ x, y })
  }
  const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const
  const bfs = (from: Cell[]): Map<string, { d: number; parent: string | null }> => {
    const seen = new Map<string, { d: number; parent: string | null }>()
    const q: Cell[] = []
    for (const c of from) { seen.set(cellKey(c.x, c.y), { d: 0, parent: null }); q.push(c) }
    while (q.length > 0) {
      const c = q.shift()!
      const here = seen.get(cellKey(c.x, c.y))!
      for (const [dx, dy] of N4) {
        const nx = c.x + dx, ny = c.y + dy
        if (!open(nx, ny) || seen.has(cellKey(nx, ny))) continue
        seen.set(cellKey(nx, ny), { d: here.d + 1, parent: cellKey(c.x, c.y) })
        q.push({ x: nx, y: ny })
      }
    }
    return seen
  }

  const report: string[] = []
  let failed = false
  const fail = (m: string): void => { failed = true; report.push(`FAIL  ${m}`) }
  const warn = (m: string): void => { report.push(`WARN  ${m}`) }
  const pass = (m: string): void => { report.push(`ok    ${m}`) }

  report.push(`${w}×${h}  open ${openCells.length}  party ${party.length}  enemy ${enemy.length}`)
  if (party.length === 0) fail('no party spawn (P)')
  if (enemy.length === 0) fail('no enemy spawn (E)')

  // Reachability from the party.
  const fromParty = bfs(party)
  const unreachable = openCells.filter((c) => !fromParty.has(cellKey(c.x, c.y)))
  const unreachableEnemies = enemy.filter((c) => !fromParty.has(cellKey(c.x, c.y)))
  if (unreachableEnemies.length > 0) fail(`${unreachableEnemies.length} enemy spawn(s) unreachable from the party`)
  if (unreachable.length > 0) warn(`${unreachable.length} open cell(s) unreachable from the party: ${unreachable.slice(0, 6).map((c) => cellKey(c.x, c.y)).join(' ')}${unreachable.length > 6 ? ' …' : ''}`)
  else pass('every open cell is reachable from the party')

  // One-tile passages (FEUniverse: units queue single-file and stall).
  const choke = openCells.filter((c) =>
    (!open(c.x, c.y - 1) && !open(c.x, c.y + 1) && open(c.x - 1, c.y) && open(c.x + 1, c.y)) ||
    (!open(c.x - 1, c.y) && !open(c.x + 1, c.y) && open(c.x, c.y - 1) && open(c.x, c.y + 1)))
  if (choke.length > 0) warn(`${choke.length} one-tile passage cell(s): ${choke.map((c) => cellKey(c.x, c.y)).join(' ')} — widen to 2 or make it a deliberate chokepoint`)
  else pass('no one-tile passages')

  // Dead space: open cells more than 3 steps from the union of shortest
  // party→nearest-enemy paths ("draw the path first; delete what it never touches").
  if (party.length > 0 && enemy.length > 0) {
    const pathCells: Cell[] = []
    for (const p of party) {
      const tree = bfs([p])
      const nearest = enemy
        .map((e) => ({ e, d: tree.get(cellKey(e.x, e.y))?.d ?? Infinity }))
        .sort((a, b) => a.d - b.d)[0]
      if (!nearest || nearest.d === Infinity) continue
      let cur: string | null = cellKey(nearest.e.x, nearest.e.y)
      while (cur) {
        const [x, y] = cur.split(',').map(Number) as [number, number]
        pathCells.push({ x, y })
        cur = tree.get(cur)?.parent ?? null
      }
    }
    const fromPath = bfs(pathCells)
    const dead = openCells.filter((c) => (fromPath.get(cellKey(c.x, c.y))?.d ?? Infinity) > 3)
    const ratio = openCells.length === 0 ? 0 : dead.length / openCells.length
    const pct = Math.round(ratio * 100)
    if (ratio > 0.35) warn(`${pct}% of open cells are >3 steps off every critical path — dead space; shrink the map or give it a side objective`)
    else pass(`dead space ${pct}% (≤35%)`)
  }

  // Enemy density (RandomWizard: 2–3× the party at the start).
  if (party.length > 0 && enemy.length > 0) {
    const r = enemy.length / party.length
    if (r < 2) warn(`enemy:party ${r.toFixed(1)}× — likely too empty (aim 2–3×)`)
    else if (r > 3) warn(`enemy:party ${r.toFixed(1)}× — likely too dense (aim 2–3×)`)
    else pass(`enemy:party ${r.toFixed(1)}×`)
  }

  console.log(report.join('\n'))
  if (failed) process.exit(1)
}

// ----------------------------------------------------------------- main ----

const [cmd, a, b] = process.argv.slice(2)
switch (cmd) {
  case 'ascii': if (!a) throw new Error('usage: ascii <builder.json>'); cmdAscii(a); break
  case 'autotile': if (!a || !b) throw new Error('usage: autotile <in.json> <out.json>'); cmdAutotile(a, b); break
  case 'lint': if (!a) throw new Error('usage: lint <grid.txt>'); cmdLint(a); break
  default:
    console.error('usage: map-tool ascii <builder.json> | autotile <in.json> <out.json> | lint <grid.txt>')
    process.exit(2)
}
