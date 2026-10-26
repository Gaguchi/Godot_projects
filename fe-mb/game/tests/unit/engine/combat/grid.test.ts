import { describe, expect, it } from 'vitest'
import {
  distanceField, findPath, inBounds, isLiving, isObstacle, manhattan, neighbours4, occupiedTiles, parseTile, reachable,
  tileKey, tilesInAoe, tilesInRange, unitAt,
} from '../../../../src/engine/combat/grid'
import type { CombatGrid } from '../../../../src/engine/types'
import { at, authored, duel, mc, patchUnit, placeAt, seed, unit } from '../../../helpers/battles'

const grid = (w: number, h: number, obstacles: readonly string[] = []): CombatGrid =>
  ({ width: w, height: h, obstacles: [...obstacles].sort(), floor: [], terrain: null })

describe('combat/grid', () => {
  it('tileKey/parseTile round-trip and reject malformed keys', () => {
    expect(tileKey(3, 7)).toBe('3,7')
    expect(parseTile('13,9')).toEqual({ x: 13, y: 9 })
    expect(() => parseTile('nope')).toThrow(/malformed/)
    expect(() => parseTile('1.5,2')).toThrow(/malformed/)
  })

  it('manhattan is the 4-dir distance', () => {
    expect(manhattan('0,0', '3,4')).toBe(7)
    expect(manhattan('5,5', '5,5')).toBe(0)
  })

  it('neighbours4 is N/E/S/W in a fixed order, unfiltered', () => {
    expect(neighbours4('0,0')).toEqual(['0,-1', '1,0', '0,1', '-1,0'])
  })

  it('inBounds respects width/height', () => {
    const g = grid(5, 5)
    expect(inBounds(g, '0,0')).toBe(true)
    expect(inBounds(g, '4,4')).toBe(true)
    expect(inBounds(g, '5,0')).toBe(false)
    expect(inBounds(g, '0,-1')).toBe(false)
  })

  it('isObstacle binary-searches the sorted obstacle list (string order, so "10,3" < "2,3")', () => {
    const g = grid(14, 10, ['2,3', '10,3', '7,7', '0,0'])
    expect(g.obstacles).toEqual(['0,0', '10,3', '2,3', '7,7'])
    for (const o of g.obstacles) expect(isObstacle(g, o)).toBe(true)
    expect(isObstacle(g, '1,1')).toBe(false)
    expect(isObstacle(grid(3, 3), '1,1')).toBe(false)
  })

  it('occupiedTiles lists living, uncaptured, on-board units only, honouring `except`', () => {
    let st = duel()
    expect([...occupiedTiles(st.units)].sort()).toEqual(['2,4', '4,4'])
    expect([...occupiedTiles(st.units, 'mc')]).toEqual(['4,4'])
    st = patchUnit(st, 'bandit', { hp: { current: 0, max: 18 }, position: null, lastTile: '4,4' })
    expect([...occupiedTiles(st.units)]).toEqual(['2,4'])
    st = patchUnit(st, 'mc', { captured: true })
    expect(occupiedTiles(st.units).size).toBe(0)
  })

  it('unitAt returns the living unit on a tile and null otherwise', () => {
    const st = duel()
    expect(unitAt(st, '4,4')?.id).toBe('bandit')
    expect(unitAt(st, '3,4')).toBeNull()
    expect(isLiving(unit(st, 'bandit'))).toBe(true)
  })

  it('reachable is a 4-dir BFS ≤ mov through free tiles; value = path excluding the origin', () => {
    const st = duel({ banditAt: [3, 4] })
    const paths = reachable(st, 'mc') // lord mov 5 from (2,4); bandit blocks (3,4)
    expect(paths['2,4']).toBeUndefined()
    expect(paths['3,4']).toBeUndefined()
    expect(paths['2,3']).toEqual(['2,3'])
    expect(paths['4,4']).toHaveLength(4) // around the bandit: (2,3)(3,3)(4,3)(4,4)
    expect(paths['7,4']).toBeUndefined() // 5 steps straight are blocked by the bandit; the detour is 7
    expect(paths['2,9']).toEqual(['2,5', '2,6', '2,7', '2,8', '2,9'])
    expect(Object.values(paths).every((p) => p.length <= 5)).toBe(true)
  })

  it('reachable is empty for an immobilized, dead or off-board unit', () => {
    let st = duel()
    st = patchUnit(st, 'mc', { statuses: [{ id: 'immobilize', stacks: 1, turns: 1, expiresAt: 'ownerTurnEnd', sourceId: null }] })
    expect(reachable(st, 'mc')).toEqual({})
    st = patchUnit(st, 'bandit', { hp: { current: 0, max: 18 }, position: null, lastTile: '4,4' })
    expect(reachable(st, 'bandit')).toEqual({})
    expect(reachable(st, 'ghost')).toEqual({})
  })

  it('findPath finds the shortest path within the budget, [] for origin == dest, null when blocked', () => {
    const g = grid(6, 3, ['1,1'])
    const blocked = new Set<string>(['2,0'])
    expect(findPath(g, '0,1', '0,1', 3, blocked)).toEqual([])
    expect(findPath(g, '0,1', '2,1', 4, blocked)).toEqual(['0,2', '1,2', '2,2', '2,1'])
    expect(findPath(g, '0,1', '2,1', 3, blocked)).toBeNull()
    expect(findPath(g, '0,1', '2,0', 5, blocked)).toBeNull() // a blocked destination is unreachable
    expect(findPath(g, '0,1', '1,1', 5, blocked)).toBeNull() // an obstacle is never a destination
  })

  it('distanceField floods from the destination with units as walls except `allow`', () => {
    const g = grid(5, 1)
    const field = distanceField(g, '4,0', new Set(['2,0', '0,0']), '0,0')
    expect(field['4,0']).toBe(0)
    expect(field['3,0']).toBe(1)
    expect(field['2,0']).toBeUndefined() // a wall
    expect(field['1,0']).toBeUndefined() // behind the wall
    expect(field['0,0']).toBeUndefined() // allowed but unreachable behind the wall
    const open = distanceField(g, '4,0', new Set(['0,0']), '0,0')
    expect(open['0,0']).toBe(4) // the mover's own tile is passable
  })

  it('tilesInRange is the manhattan annulus in bounds with obstacles excluded (row-major)', () => {
    const g = grid(5, 5, ['2,1'])
    const ring = tilesInRange(g, '2,2', 1, 1)
    expect(ring).toEqual(['1,2', '3,2', '2,3']) // (2,1) is an obstacle
    expect(tilesInRange(g, '0,0', 0, 1)).toEqual(['0,0', '1,0', '0,1'])
    expect(tilesInRange(g, '2,2', 3, 3)).not.toContain('2,2')
  })

  it('tilesInAoe includes the centre and clips to the board', () => {
    const g = grid(3, 3)
    expect(tilesInAoe(g, '0,0', 1)).toEqual(['0,0', '1,0', '0,1'])
    expect(tilesInAoe(g, '1,1', 1)).toHaveLength(5)
    expect(tilesInAoe(g, '1,1', 2)).toHaveLength(9)
  })

  it('a seeded 14×10 board is fully walkable around authored obstacles', () => {
    // wall at (3,3)-(3,4): the lord (MOV 5) at (2,4) reaches (4,4) around the south end in 4 steps; a 3-tall wall
    // would need 6 and correctly be out of reach
    const st = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', 6, 4)] }, grid: { obstacles: [at(3, 4), at(3, 3)] } })
    const paths = reachable(st, 'mc')
    expect(paths['4,4']).toBeDefined()
    expect(paths['4,4']!.length).toBeGreaterThan(2)
    const moved = placeAt(st, 'mc', 0, 0)
    expect(Object.keys(reachable(moved, 'mc')).length).toBeGreaterThan(10)
  })
})
