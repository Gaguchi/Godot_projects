import { describe, it, expect } from 'vitest'
import { buildGraph, findPath, pathFoodCost } from '../../../src/systems/overworldPath'
import borderlands from '../../../src/data/content/overworld/borderlands.json'

describe('overworldPath (GP-D2)', () => {
  const map = borderlands as { edges: { from: string; to: string }[] }
  const graph = buildGraph(map)

  it('finds direct edge in 1 hop', () => {
    // Frontier Camp ↔ Riverside Market are adjacent in the borderlands map.
    const path = findPath(graph, 'frontier_camp', 'riverside_market')
    expect(path).toEqual(['riverside_market'])
  })

  it('returns empty array when from == to', () => {
    expect(findPath(graph, 'frontier_camp', 'frontier_camp')).toEqual([])
  })

  it('finds multi-hop path through 3+ nodes', () => {
    // Frontier Camp → Pine Crossing requires multiple hops via Riverside or via South Junction
    const path = findPath(graph, 'frontier_camp', 'pine_crossing')
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(1)
    expect(path![path!.length - 1]).toBe('pine_crossing')
  })

  it('returns null when nodes are in disconnected graphs', () => {
    const tinyGraph = buildGraph({ edges: [{ from: 'a', to: 'b' }, { from: 'c', to: 'd' }] })
    expect(findPath(tinyGraph, 'a', 'd')).toBeNull()
  })

  it('pathFoodCost returns hop count (1 food/hop)', () => {
    expect(pathFoodCost(['x'])).toBe(1)
    expect(pathFoodCost(['x', 'y', 'z'])).toBe(3)
  })
})
