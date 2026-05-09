/**
 * GP-D2: BFS over overworld nodes within a single map. Returns the
 * shortest hop sequence from `fromId` (exclusive) to `toId` (inclusive),
 * or `null` if unreachable.
 */
export interface OverworldGraph {
  /** Adjacency list — `edges[nodeId]` = neighbor node ids. */
  edges: Record<string, string[]>
}

export function buildGraph(map: { edges: { from: string; to: string }[] }): OverworldGraph {
  const adj: Record<string, string[]> = {}
  for (const e of map.edges) {
    const fromList = adj[e.from] ?? (adj[e.from] = [])
    const toList = adj[e.to] ?? (adj[e.to] = [])
    fromList.push(e.to)
    toList.push(e.from)
  }
  return { edges: adj }
}

export function findPath(
  graph: OverworldGraph,
  fromId: string,
  toId: string,
): string[] | null {
  if (fromId === toId) return []
  const visited = new Set<string>([fromId])
  const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [] }]
  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    const neighbors = graph.edges[id] ?? []
    for (const n of neighbors) {
      if (visited.has(n)) continue
      const newPath = [...path, n]
      if (n === toId) return newPath
      visited.add(n)
      queue.push({ id: n, path: newPath })
    }
  }
  return null
}

export function pathFoodCost(path: string[]): number {
  // 1 food per hop (matches Godot consume_food(1) in world_map.gd)
  return path.length
}
