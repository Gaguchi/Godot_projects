/**
 * run/overworld.ts — the open sheet as a graph (brief §2.9, §6).
 * Hidden nodes join the graph only once `spawnedNodes[id]` is set (content note (a)). Every helper is a pure
 * read over content + `RunState`; nothing here rolls or mutates.
 */
import type { DungeonDef, EdgeKey, EdgePassKey, EngineEnv, NodeId, OverworldEdge, OverworldNode, RefKey, RegionDef, RunState, TownDef } from '../types'
import { foodCount } from './bag'

/** Throws on an unknown id (programmer error). */
export function nodeOf(id: NodeId, env: EngineEnv): OverworldNode {
  const node = env.content.overworld.nodes.find((n) => n.id === id)
  if (node === undefined) throw new Error(`run/overworld: unknown node '${id}'`)
  return node
}

/**
 * What a mark on the sheet IS, in the player's word. `OverworldNode['type']` is a schema enum — `TOWN`, `BOSS`,
 * `DISCOVERY` — and the headless game printed it raw beside the place it already named ("Frontier Camp
 * (frontier_camp, CAMP, tier 1)", FINAL GATE A 1.2). The browser's map has always drawn a sigil and captioned it
 * with these six words (`ui/overworld/NodeMark.tsx`, which re-exports `typeLabel` from here now); the terminal
 * reads the same six, because `scripts/**` may not import `ui/**` (CONTRACT §6).
 */
const NODE_TYPE_LABEL: Readonly<Record<OverworldNode['type'], string>> = {
  TOWN: 'town',
  CAMP: 'camp',
  DUNGEON: 'dungeon',
  BOSS: 'stronghold',
  TRAIL: 'waypoint',
  DISCOVERY: 'landmark',
}

export function typeLabel(type: OverworldNode['type']): string {
  return NODE_TYPE_LABEL[type]
}

/** The undirected road between two nodes, whichever way the content authored it. */
export function edgeOf(a: NodeId, b: NodeId, env: EngineEnv): OverworldEdge | null {
  return env.content.overworld.edges.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)) ?? null
}

export function regionOf(nodeId: NodeId, env: EngineEnv): RegionDef {
  const node = nodeOf(nodeId, env)
  const region = env.content.regions[node.regionId]
  if (region === undefined) throw new Error(`run/overworld: node '${nodeId}' names unknown region '${node.regionId}'`)
  return region
}

/** Sorted ids joined with '|'. */
export function edgeKey(a: NodeId, b: NodeId): EdgeKey {
  // undirected: one road, one key, whichever way it is walked (traversal passes are per ROAD, not per direction)
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** DIRECTED pre-roll key `from->to#pass` (CONTRACT-CHANGES 0028). A Scout result belongs to the crossing it was
 *  rolled FOR: `rollHopWith` applies `noRollInto` and the `hop:<from>-><to>#<pass>` labels to one orientation only,
 *  so the same road walked the other way must roll fresh instead of consuming the wrong record. */
export function edgeDirPassKey(from: NodeId, to: NodeId, pass: number): EdgePassKey {
  return `${from}->${to}#${pass}`
}

/** `${kind}:${mapId}:${nodeId}` — visitedNodes / `visited` predicate key. */
export function refKey(kind: 'overworld' | 'dungeon', mapId: string, nodeId: string): RefKey {
  // matches `seedNewRun`'s first visitedNodes entry and the predicate fixtures: `overworld:world:frontier_camp`
  return `${kind}:${mapId}:${nodeId}`
}

/** Every node that is not hidden, or hidden-and-spawned. */
export function visibleNodes(run: RunState, env: EngineEnv): readonly OverworldNode[] {
  return env.content.overworld.nodes.filter((n) => n.hidden !== true || run.spawnedNodes[n.id] === true)
}

/** Undirected adjacency over visible nodes, neighbours in content (authored) order so BFS ties are stable. */
export function adjacency(run: RunState, env: EngineEnv): Readonly<Record<NodeId, readonly NodeId[]>> {
  const visible = new Set(visibleNodes(run, env).map((n) => n.id))
  const adj: Record<NodeId, NodeId[]> = {}
  for (const id of visible) adj[id] = []
  for (const e of env.content.overworld.edges) {
    if (!visible.has(e.from) || !visible.has(e.to)) continue
    adj[e.from]!.push(e.to)
    adj[e.to]!.push(e.from)
  }
  return adj
}

/** BFS from `run.nodeId`; excludes the origin, includes `to`; `[]` when `to === run.nodeId`; null when unreachable. */
export function findPath(run: RunState, to: NodeId, env: EngineEnv): readonly NodeId[] | null {
  if (to === run.nodeId) return []
  const adj = adjacency(run, env)
  if (adj[run.nodeId] === undefined || adj[to] === undefined) return null
  const parent: Record<NodeId, NodeId> = {}
  const seen = new Set<NodeId>([run.nodeId])
  const queue: NodeId[] = [run.nodeId]
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!
    for (const next of adj[cur] ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      parent[next] = cur
      if (next === to) {
        const path: NodeId[] = []
        for (let n: NodeId | undefined = to; n !== undefined && n !== run.nodeId; n = parent[n]) path.push(n)
        return path.reverse()
      }
      queue.push(next)
    }
  }
  return null
}

/** Hover: `N hops · cost N food`, `starvation: X HP/unit` when food < hops (each unfed hop deals `starvationDamage`). */
export function previewPath(run: RunState, to: NodeId, env: EngineEnv): { readonly hops: number; readonly food: number; readonly starvationHp: number } | null {
  const path = findPath(run, to, env)
  if (path === null) return null
  const hops = path.length
  const food = hops * env.rules.travel.foodPerHop
  const unfed = Math.max(0, food - foodCount(run.bag, env))
  return { hops, food, starvationHp: unfed * env.rules.travel.starvationDamage }
}

/** `rules.travel.decisionNodeTypes`, or unvisited, or the destination. */
export function isDecisionNode(node: OverworldNode, run: RunState, isDestination: boolean, env: EngineEnv): boolean {
  const pauses: readonly string[] = env.rules.travel.decisionNodeTypes
  if (isDestination || pauses.includes(node.type)) return true
  return run.visitedNodes[refKey('overworld', env.content.overworld.id, node.id)] !== true
}

/** `node.locked === true && !run.unlockedNodes[node.id]` — traversable and visible (the map draws a padlock), but
 *  `dungeon/enter` is refused (`run/dungeon.ts#canEnterDungeon`) until a quest `unlockNode` effect opens it. */
export function isNodeLocked(run: RunState, node: OverworldNode): boolean {
  return node.locked === true && run.unlockedNodes[node.id] !== true
}

/** The town def whose id equals the current node id (every TOWN node has one — lint). */
export function townOf(run: RunState, env: EngineEnv): TownDef | null {
  const node = nodeOf(run.nodeId, env)
  if (node.type !== 'TOWN') return null
  return env.content.towns[node.id] ?? null
}

export function dungeonOf(run: RunState, env: EngineEnv): DungeonDef | null {
  const node = nodeOf(run.nodeId, env)
  if (node.type !== 'DUNGEON') return null
  return env.content.dungeons[node.id] ?? null
}
