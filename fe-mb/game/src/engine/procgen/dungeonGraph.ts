/**
 * procgen/dungeonGraph.ts — StS row graph, compact variant (brief §2.11; DECISIONS; research/sts-procgen.md).
 *
 * Every number comes from `env.rules.dungeon`: 6 rows × 4 cols, 4 path traces (the first two start in distinct
 * columns), edges advance exactly one row and never cross, unvisited cells are pruned; row 0 is forced Combat, the
 * last data row forced Rest, no Elite/Rest before `noSpecialBeforeRow` and no Elite at all before
 * `noEliteBeforeRow`; the mid-row palette is weighted (no Shop — DECISIONS); a single boss `r<rows>c0` is reachable
 * from every last-row room; Event rooms draw their `checkEventId` from `def.roomEvents` WITHOUT replacement.
 *
 * Between the traces and the typing there is a WEAVE (phase 2b, `rules.dungeon.branchChance`). Four traces over a
 * 4-column board overlap heavily, so the traced graph is mostly a corridor: measured over 2 000 graphs, only 21%
 * of rooms offered more than one way on, and a blind playthrough walked fifteen rooms in a row with exactly one
 * exit under a screen that promises a branching chart (RE-GATE C 3.18). The weave offers every single-exit room
 * one extra edge to an adjacent-column room of the next row, taken on a draw, and refuses any edge that would
 * cross one already drawn — so the "advances one row / never crosses" invariants hold by construction and the
 * typing pass, which runs AFTER, still sees every fork it has to keep distinct.
 *
 * Determinism: the whole graph is a pure function of the `RngState` handed in (the caller derives it with
 * `deriveState(run.rng, rngLabels.dungeon(id))`, so it depends on (runSeed, dungeonId) only — brief §2.14) and every
 * draw goes through ONE generator in a fixed order. Iteration orders are explicit (`PALETTE`, row-major room order,
 * column-sorted successors) so a rules-object reorder or an engine upgrade cannot change a saved run's dungeon.
 *
 * Typing is constraint-aware instead of StS's "assign, then re-roll violators" loop: forced rows are typed first,
 * then the middle rows top-down, left-to-right, each room drawing only from the types that keep the validators
 * true given its already-typed parents, siblings and children. With every palette weight > 0 the candidate list can
 * never empty (≤ 2 typed siblings, ≤ 2 same-special parents, ≤ 1 forced child against ≥ 4 non-forced types), so no
 * attempt counter exists; a degenerate weight table (a 0 weight) falls back to StS's own escape hatch — accept a
 * sibling duplicate — and `validateDungeon` reports it.
 */
import type { DungeonDef, DungeonGraph, DungeonRoom, EngineEnv, RngState, RoomId, RoomType } from '../types'
import { createRng, type RNG } from '../rng'
import { rngState } from '../rngState'

type DataRoomType = Exclude<RoomType, 'boss'>

/** Fixed pick order for weighted draws — never `Object.keys(weights)`: the rules object's key order is not a game rule. */
const PALETTE: readonly DataRoomType[] = ['combat', 'event', 'treasure', 'rest', 'elite']

/**
 * StS "special" rooms (Elite / Rest / Merchant; no Merchant here). The path rule is SAME-TYPE consecutive:
 * no Elite→Elite, no Rest→Rest. Different specials may follow each other — the pre-boss Elite → forced Rest is
 * the canonical StS floor 14→15 — and Treasure/Event are not special (StS forces a whole Treasure row).
 */
const SPECIAL: ReadonlySet<RoomType> = new Set<RoomType>(['elite', 'rest'])

/** `r<row>c<col>` — the RoomId format (types.ts). The boss sits at `r<rows>c0`. */
export function roomIdOf(row: number, col: number): RoomId {
  return `r${row}c${col}`
}

/** Shared by the generator and the validator: (row, from) → (row+1, to) crosses an existing edge that swaps the
 *  adjacent columns (StS "no crossing" reduces to "no two edges between consecutive rows swap column order"). */
function crosses(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return (aFrom < bFrom && aTo > bTo) || (aFrom > bFrom && aTo < bTo)
}

interface Draft {
  readonly rooms: Map<RoomId, { readonly row: number; readonly col: number }>
  readonly succ: Map<RoomId, Set<RoomId>>
  readonly pred: Map<RoomId, Set<RoomId>>
}

function addRoom(d: Draft, row: number, col: number): RoomId {
  const id = roomIdOf(row, col)
  if (!d.rooms.has(id)) {
    d.rooms.set(id, { row, col })
    d.succ.set(id, new Set())
    d.pred.set(id, new Set())
  }
  return id
}

function addEdge(d: Draft, from: RoomId, to: RoomId): void {
  d.succ.get(from)!.add(to)
  d.pred.get(to)!.add(from)
}

/** Phase 1 + 2: trace `paths` walks from row 0 to the last data row; the union of their cells IS the room set. */
function tracePaths(r: RNG, d: Draft, cfg: EngineEnv['rules']['dungeon']): void {
  const allCols = Array.from({ length: cfg.cols }, (_, c) => c)
  let firstStart: number | null = null
  for (let p = 0; p < cfg.paths; p++) {
    let col: number
    if (p === 1 && cfg.firstTwoPathsDistinctStart && firstStart !== null && cfg.cols > 1) {
      // One draw over the remaining columns instead of a rejection loop: deterministic draw count per path.
      col = r.pick(allCols.filter((c) => c !== firstStart))
    } else {
      col = r.nextInt(0, cfg.cols - 1)
    }
    if (p === 0) firstStart = col
    let prev = addRoom(d, 0, col)
    for (let row = 1; row < cfg.rows; row++) {
      const candidates = [col - 1, col, col + 1].filter((c) => {
        if (c < 0 || c >= cfg.cols) return false
        // Reject a diagonal step that would cross an edge already drawn between these two rows.
        for (const [fromId, tos] of d.succ) {
          const from = d.rooms.get(fromId)!
          if (from.row !== row - 1) continue
          for (const toId of tos) {
            if (crosses(col, c, from.col, d.rooms.get(toId)!.col)) return false
          }
        }
        return true
      })
      // The straight step never crosses a ±1 edge, so `candidates` is never empty.
      const next = r.pick(candidates)
      const id = addRoom(d, row, next)
      addEdge(d, prev, id)
      prev = id
      col = next
    }
  }
}

/** Would `from → to` cross any edge already drawn between these two rows? */
function wouldCross(d: Draft, from: { row: number; col: number }, toCol: number): boolean {
  for (const [fromId, tos] of d.succ) {
    const a = d.rooms.get(fromId)!
    if (a.row !== from.row) continue
    for (const toId of tos) {
      if (crosses(from.col, toCol, a.col, d.rooms.get(toId)!.col)) return true
    }
  }
  return false
}

/**
 * Phase 2b: the WEAVE. Every room with exactly one way on is offered a second, drawn at `cfg.branchChance` over the
 * rooms the traces already put in the next row within one column of it. No new CELLS are created — the room set is
 * still the union of the traces — and no edge is added that crosses one already there, so the graph stays planar
 * and every later validator holds. Iteration is row-major over a snapshot of the row's rooms, and the draw happens
 * for every eligible room whether or not it is taken, so the number of draws is a function of the traced shape
 * alone: adding the weave cannot make an already-generated dungeon deal a different graph for a different reason.
 */
function weaveBranches(r: RNG, d: Draft, rows: readonly (readonly RoomId[])[], cfg: EngineEnv['rules']['dungeon']): void {
  for (let row = 0; row < cfg.rows - 1; row++) {
    for (const id of rows[row]!) {
      const from = d.rooms.get(id)!
      const taken = d.succ.get(id)!
      const candidates = rows[row + 1]!.filter((next) => {
        const to = d.rooms.get(next)!
        return Math.abs(to.col - from.col) <= 1 && !taken.has(next) && !wouldCross(d, from, to.col)
      })
      // One draw per eligible room, always — never inside the `if`, or the stream would depend on the outcome.
      const roll = r.nextInt(1, 100)
      if (taken.size !== 1 || candidates.length === 0) continue
      if (roll > Math.round(cfg.branchChance * 100)) continue
      addEdge(d, id, r.pick(candidates))
    }
  }
}

/** Rooms in row-major order (row asc, col asc) — the ONE room order every later phase iterates. */
function rowMajor(d: Draft, rows: number): readonly (readonly RoomId[])[] {
  const out: RoomId[][] = Array.from({ length: rows }, () => [])
  for (const [id, { row }] of d.rooms) out[row]!.push(id)
  for (const row of out) row.sort((a, b) => d.rooms.get(a)!.col - d.rooms.get(b)!.col)
  return out
}

function weightedPick(r: RNG, candidates: readonly DataRoomType[], weights: Readonly<Record<DataRoomType, number>>): DataRoomType {
  const total = candidates.reduce((sum, t) => sum + weights[t], 0)
  let roll = r.nextInt(0, total - 1)
  for (const t of candidates) {
    if (roll < weights[t]) return t
    roll -= weights[t]
  }
  return candidates[candidates.length - 1]!
}

/** Phase 3: forced rows first, then constraint-aware weighted typing of the middle rows. */
function assignTypes(r: RNG, d: Draft, rows: readonly (readonly RoomId[])[], cfg: EngineEnv['rules']['dungeon']): Map<RoomId, RoomType> {
  const types = new Map<RoomId, RoomType>()
  const lastRow = cfg.rows - 1
  for (const id of rows[0]!) types.set(id, cfg.forcedFirstRow)
  for (const id of rows[lastRow]!) types.set(id, cfg.forcedLastRow)
  const positive = PALETTE.filter((t) => cfg.weights[t] > 0)

  for (let row = 1; row < lastRow; row++) {
    for (const id of rows[row]!) {
      const parents = [...d.pred.get(id)!]
      const children = [...d.succ.get(id)!]
      const siblingTypes = new Set<RoomType>()
      for (const p of parents) {
        for (const s of d.succ.get(p)!) {
          const st = s === id ? undefined : types.get(s)
          if (st !== undefined) siblingTypes.add(st)
        }
      }
      const base = positive.filter((t) => {
        // No Elite/Rest before `noSpecialBeforeRow` (StS: none below floor 6).
        if (SPECIAL.has(t) && row < cfg.noSpecialBeforeRow) return false
        // And no ELITE at all before `noEliteBeforeRow`: row 0 is a forced fight, so an elite in row 1 means the
        // company meets the dungeon's hardest pack as its SECOND room, on whatever the first one left it —
        // two of the three entrances of the blind run's graph did exactly that (RE-GATE C 3.18).
        if (t === 'elite' && row < cfg.noEliteBeforeRow) return false
        // No same-type special on consecutive rooms of a path — checked against parents AND the already-typed
        // forced children (the row before the forced Rest row can never be Rest: StS "no Rest on floor 14").
        if (SPECIAL.has(t) && (parents.some((p) => types.get(p) === t) || children.some((c) => types.get(c) === t))) return false
        return true
      })
      // A fork's destinations must differ in type; a room shares each parent's other children as siblings.
      const strict = base.filter((t) => !siblingTypes.has(t))
      const candidates = strict.length > 0 ? strict : base
      types.set(id, candidates.length > 0 ? weightedPick(r, candidates, cfg.weights) : cfg.forcedFirstRow)
    }
  }
  return types
}

export function generateDungeon(rng: RngState, def: DungeonDef, env: EngineEnv): { readonly graph: DungeonGraph; readonly rng: RngState } {
  const cfg = env.rules.dungeon
  const r = createRng(rng)
  const d: Draft = { rooms: new Map(), succ: new Map(), pred: new Map() }

  tracePaths(r, d, cfg)
  const dataRows = rowMajor(d, cfg.rows)
  weaveBranches(r, d, dataRows, cfg)
  const types = assignTypes(r, d, dataRows, cfg)

  // Phase 4: the single boss sink. Every last-row room converges on it (StS floor 15 → 16).
  const bossId = addRoom(d, cfg.rows, 0)
  types.set(bossId, 'boss')
  for (const id of dataRows[cfg.rows - 1]!) addEdge(d, id, bossId)
  const rows: (readonly RoomId[])[] = [...dataRows, [bossId]]

  // Phase 5: Event rooms draw from `def.roomEvents` without replacement, in row-major order; once the deck is
  // exhausted a room carries null and pays `rules.dungeon.eventGoldFallback` on entry (run/dungeon.ts).
  const deck = r.shuffle(def.roomEvents)
  let drawn = 0
  const rooms: Record<RoomId, DungeonRoom> = {}
  const edges: Record<RoomId, readonly RoomId[]> = {}
  for (const rowIds of rows) {
    for (const id of rowIds) {
      const { row, col } = d.rooms.get(id)!
      const type = types.get(id)!
      const checkEventId = type === 'event' ? (deck[drawn++] ?? null) : null
      rooms[id] = { id, row, col, type, checkEventId }
      edges[id] = [...d.succ.get(id)!].sort((a, b) => d.rooms.get(a)!.col - d.rooms.get(b)!.col)
    }
  }

  return { graph: { dungeonId: def.id, rooms, rows, edges, bossId }, rng: rngState(r) }
}

/**
 * The StS validators + the structural invariants of `DungeonGraph` (types.ts). `[]` = ok. Read by the generator's
 * tests (100 seeds × every dungeon) and available to `flow/invariants.ts` for a hydrated `activeDungeon`.
 * Rules: unique ids that encode row/col; `rows` is a partition of `rooms`; every edge advances exactly one row
 * and never crosses; forced first/last rows; no Elite/Rest before `noSpecialBeforeRow`; no same-type special on
 * consecutive rooms; fork destinations distinct (except into the forced last row, homogeneous by rule); a single
 * boss reachable from every last-row room; every room reachable from row 0 with no dead end; event ids drawn
 * without replacement from the def's `roomEvents`.
 */
export function validateDungeon(graph: DungeonGraph, env: EngineEnv): readonly string[] {
  const cfg = env.rules.dungeon
  const out: string[] = []
  const bossRow = cfg.rows
  const lastDataRow = cfg.rows - 1

  if (graph.rows.length !== bossRow + 1) out.push(`rows: expected ${bossRow + 1} rows (data + boss), got ${graph.rows.length}`)

  // Ids and the rooms ⇄ rows partition.
  for (const [key, room] of Object.entries(graph.rooms)) {
    if (room.id !== key) out.push(`room '${key}': id field is '${room.id}'`)
    if (roomIdOf(room.row, room.col) !== room.id) out.push(`room '${room.id}': id does not encode row ${room.row} col ${room.col}`)
    if (room.row < 0 || room.row > bossRow) out.push(`room '${room.id}': row ${room.row} outside 0..${bossRow}`)
    if (room.col < 0 || room.col >= cfg.cols) out.push(`room '${room.id}': col ${room.col} outside 0..${cfg.cols - 1}`)
    if (room.type !== 'event' && room.checkEventId !== null) out.push(`room '${room.id}': a ${room.type} room carries checkEventId '${room.checkEventId}'`)
  }
  const seen = new Set<RoomId>()
  graph.rows.forEach((rowIds, rowIdx) => {
    let lastCol = -1
    for (const id of rowIds) {
      const room = graph.rooms[id]
      if (room === undefined) { out.push(`rows[${rowIdx}]: unknown room '${id}'`); continue }
      if (seen.has(id)) out.push(`rows: duplicate room id '${id}'`)
      seen.add(id)
      if (room.row !== rowIdx) out.push(`rows[${rowIdx}]: room '${id}' says row ${room.row}`)
      if (room.col <= lastCol) out.push(`rows[${rowIdx}]: columns not strictly increasing at '${id}'`)
      lastCol = room.col
    }
  })
  for (const id of Object.keys(graph.rooms)) if (!seen.has(id)) out.push(`room '${id}' is missing from rows`)

  // The single boss sink.
  const boss = graph.rooms[graph.bossId]
  if (boss === undefined) out.push(`bossId '${graph.bossId}' is not a room`)
  else if (boss.type !== 'boss') out.push(`boss room '${graph.bossId}' has type ${boss.type}`)
  const bosses = Object.values(graph.rooms).filter((r) => r.type === 'boss')
  if (bosses.length !== 1) out.push(`expected exactly one boss room, found ${bosses.length}`)
  const last = graph.rows[graph.rows.length - 1]
  if (last === undefined || last.length !== 1 || last[0] !== graph.bossId) out.push(`the last row must be [${graph.bossId}]`)

  // Edges: known endpoints, one row down, no duplicates, no dead ends, boss is a sink.
  const byFromRow = new Map<number, { readonly from: DungeonRoom; readonly to: DungeonRoom }[]>()
  for (const [from, tos] of Object.entries(graph.edges)) {
    const a = graph.rooms[from]
    if (a === undefined) { out.push(`edges: unknown source '${from}'`); continue }
    if (new Set(tos).size !== tos.length) out.push(`edges['${from}']: duplicate destination`)
    for (const to of tos) {
      const b = graph.rooms[to]
      if (b === undefined) { out.push(`edges['${from}']: unknown destination '${to}'`); continue }
      if (b.row !== a.row + 1) out.push(`edge ${from}→${to} does not advance exactly one row`)
      const list = byFromRow.get(a.row) ?? []
      list.push({ from: a, to: b })
      byFromRow.set(a.row, list)
    }
  }
  for (const room of Object.values(graph.rooms)) {
    const tos = graph.edges[room.id] ?? []
    if (room.type === 'boss' && tos.length > 0) out.push(`boss '${room.id}' has successors`)
    if (room.type !== 'boss' && tos.length === 0) out.push(`room '${room.id}' is a dead end`)
  }
  for (const list of byFromRow.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!, b = list[j]!
        if (crosses(a.from.col, a.to.col, b.from.col, b.to.col)) out.push(`edges ${a.from.id}→${a.to.id} and ${b.from.id}→${b.to.id} cross`)
      }
    }
  }

  // Forced rows and the early-row ban.
  for (const room of Object.values(graph.rooms)) {
    if (room.row === 0 && room.type !== cfg.forcedFirstRow) out.push(`row 0 room '${room.id}' is ${room.type}, expected ${cfg.forcedFirstRow}`)
    if (room.row === lastDataRow && room.type !== cfg.forcedLastRow) out.push(`last data row room '${room.id}' is ${room.type}, expected ${cfg.forcedLastRow}`)
    if (room.row < cfg.noSpecialBeforeRow && SPECIAL.has(room.type)) out.push(`room '${room.id}' is ${room.type} before row ${cfg.noSpecialBeforeRow}`)
    if (room.row < cfg.noEliteBeforeRow && room.type === 'elite') out.push(`room '${room.id}' is an elite before row ${cfg.noEliteBeforeRow}`)
  }

  // Path rules: no same-type special twice in a row; fork destinations distinct (the forced last row is exempt —
  // every room there is Rest by rule, and so is the boss row, a single room).
  for (const [from, tos] of Object.entries(graph.edges)) {
    const a = graph.rooms[from]
    if (a === undefined) continue
    for (const to of tos) {
      const b = graph.rooms[to]
      if (b !== undefined && SPECIAL.has(a.type) && a.type === b.type) out.push(`consecutive ${a.type}: ${from}→${to}`)
    }
    const dests = tos.map((t) => graph.rooms[t]).filter((r): r is DungeonRoom => r !== undefined)
    if (dests.length >= 2 && dests[0]!.row !== lastDataRow) {
      const typesSeen = new Set(dests.map((r) => r.type))
      if (typesSeen.size !== dests.length) out.push(`fork at '${from}' has destinations of the same type`)
    }
  }

  // Reachability: every room hangs off row 0; every last-row room reaches the boss.
  const pred = new Map<RoomId, number>()
  for (const tos of Object.values(graph.edges)) for (const to of tos) pred.set(to, (pred.get(to) ?? 0) + 1)
  for (const room of Object.values(graph.rooms)) {
    if (room.row > 0 && (pred.get(room.id) ?? 0) === 0) out.push(`room '${room.id}' has no predecessor`)
  }
  const reached = new Set<RoomId>(graph.rows[0] ?? [])
  const queue = [...reached]
  for (let i = 0; i < queue.length; i++) {
    for (const to of graph.edges[queue[i]!] ?? []) if (!reached.has(to)) { reached.add(to); queue.push(to) }
  }
  for (const id of Object.keys(graph.rooms)) if (!reached.has(id)) out.push(`room '${id}' is unreachable from row 0`)
  for (const id of graph.rows[lastDataRow] ?? []) {
    if (!(graph.edges[id] ?? []).includes(graph.bossId)) out.push(`last-row room '${id}' does not lead to the boss`)
  }

  // Event deck: without replacement, and from this dungeon's authored list when the def is known.
  const def = env.content.dungeons[graph.dungeonId]
  const eventIds = Object.values(graph.rooms).flatMap((r) => (r.type === 'event' && r.checkEventId !== null ? [r.checkEventId] : []))
  if (new Set(eventIds).size !== eventIds.length) out.push('an event id was drawn twice')
  if (def !== undefined) {
    for (const id of eventIds) {
      if (!def.roomEvents.includes(id)) out.push(`event '${id}' is not in ${def.id}.roomEvents`)
      if (env.content.checkEvents[id] === undefined) out.push(`event '${id}' is not a check event`)
    }
  }
  return out
}

/** null ⇒ row 0 (the entrance). Unknown ids and the boss yield `[]`. */
export function successors(graph: DungeonGraph, roomId: RoomId | null): readonly RoomId[] {
  if (roomId === null) return graph.rows[0] ?? []
  return graph.edges[roomId] ?? []
}
