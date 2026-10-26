import { describe, expect, it } from 'vitest'
import { adjacency, dungeonOf, edgeKey, edgeOf, findPath, isDecisionNode, isNodeLocked, nodeOf, previewPath, refKey, townOf, visibleNodes } from '../../../../src/engine/run/overworld'
import { env, newRun, withBag } from '../../../helpers/runs'
import { at, firstNodeOfType, neighbourOf } from '../../../helpers/overworld'

describe('run/overworld — graph helpers', () => {
  it('edgeKey is undirected and refKey matches the seeded visitedNodes entry', () => {
    expect(edgeKey('b', 'a')).toBe(edgeKey('a', 'b'))
    expect(edgeKey('a', 'b')).toBe('a|b')
    const run = newRun(1)
    expect(run.visitedNodes[refKey('overworld', env.content.overworld.id, run.nodeId)]).toBe(true)
  })

  it('nodeOf throws on an unknown id; edgeOf finds a road either way round', () => {
    expect(() => nodeOf('nowhere', env)).toThrow(/unknown node/)
    const run = newRun(1)
    const next = neighbourOf(run, env, false)
    expect(edgeOf(run.nodeId, next, env)).not.toBeNull()
    expect(edgeOf(next, run.nodeId, env)).toBe(edgeOf(run.nodeId, next, env))
    expect(edgeOf(run.nodeId, run.nodeId, env)).toBeNull()
  })

  it('hidden nodes join the graph only once spawned', () => {
    const run = newRun(1)
    const hidden = env.content.overworld.nodes.find((n) => n.hidden === true)
    expect(hidden).toBeDefined()
    const id = hidden!.id
    expect(visibleNodes(run, env).some((n) => n.id === id)).toBe(false)
    expect(adjacency(run, env)[id]).toBeUndefined()
    expect(findPath(run, id, env)).toBeNull()
    const spawned = { ...run, spawnedNodes: { [id]: true as const } }
    expect(visibleNodes(spawned, env).some((n) => n.id === id)).toBe(true)
    expect(findPath(spawned, id, env)).not.toBeNull()
  })

  it('findPath: [] for the current node, a road-by-road BFS path otherwise, and previewPath prices it', () => {
    const run = newRun(1)
    expect(findPath(run, run.nodeId, env)).toEqual([])
    const town = firstNodeOfType('TOWN')
    const path = findPath(run, town.id, env)
    expect(path).not.toBeNull()
    expect(path![path!.length - 1]).toBe(town.id)
    let prev = run.nodeId
    for (const step of path!) {
      expect(edgeOf(prev, step, env)).not.toBeNull()
      prev = step
    }
    const preview = previewPath(run, town.id, env)!
    expect(preview.hops).toBe(path!.length)
    expect(preview.food).toBe(path!.length * env.rules.travel.foodPerHop)
    expect(preview.starvationHp).toBe(0) // the kit holds 6 hops of food
    const starving = previewPath(withBag(run, []), town.id, env)!
    expect(starving.starvationHp).toBe(path!.length * env.rules.travel.starvationDamage)
    expect(previewPath(run, run.nodeId, env)).toEqual({ hops: 0, food: 0, starvationHp: 0 })
  })

  it('decision nodes: typed pauses, unvisited nodes, and the destination', () => {
    const run = newRun(1)
    const town = firstNodeOfType('TOWN')
    expect(isDecisionNode(town, run, false, env)).toBe(true)
    const trail = env.content.overworld.nodes.find((n) => n.type === 'TRAIL')!
    expect(isDecisionNode(trail, run, false, env)).toBe(true) // unvisited
    const visited = { ...run, visitedNodes: { ...run.visitedNodes, [refKey('overworld', env.content.overworld.id, trail.id)]: true as const } }
    expect(isDecisionNode(trail, visited, false, env)).toBe(false)
    expect(isDecisionNode(trail, visited, true, env)).toBe(true) // destination always pauses
  })

  it('locked dungeons stay locked until unlockNode lists them; townOf/dungeonOf key on the current node', () => {
    const run = newRun(1)
    const locked = env.content.overworld.nodes.find((n) => n.locked === true)
    expect(locked).toBeDefined()
    expect(isNodeLocked(run, locked!)).toBe(true)
    expect(isNodeLocked({ ...run, unlockedNodes: { [locked!.id]: true } }, locked!)).toBe(false)
    const town = firstNodeOfType('TOWN')
    expect(townOf(run, env)).toBeNull()
    expect(townOf(at(run, town.id), env)?.id).toBe(town.id)
    const dungeon = firstNodeOfType('DUNGEON')
    expect(dungeonOf(at(run, dungeon.id), env)?.id).toBe(dungeon.id)
    expect(dungeonOf(at(run, town.id), env)).toBeNull()
  })
})
