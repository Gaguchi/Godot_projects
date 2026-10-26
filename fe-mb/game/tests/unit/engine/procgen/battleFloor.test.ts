import { describe, expect, it } from 'vitest'
import { battleGrid } from '../../../../src/engine/procgen/battleFloor'
import { generateDirtRegion } from '../../../../src/engine/boardFloor'
import { cellKey } from '../../../../src/engine/autotile'
import { createEnv } from '../../../../src/engine/content'
import { createRng } from '../../../../src/engine/rng'
import { deriveState } from '../../../../src/engine/rngState'
import { rngLabels } from '../../../../src/engine/rules'
import type { BattleSpec, RngState, TerrainKind, TileKey } from '../../../../src/engine/types'

const env = createEnv()
const RNG: RngState = { seed: 9001, counter: 0 }

function spec(battleId: string, rng: RngState = RNG, grid: Partial<BattleSpec['grid']> = {}): Pick<BattleSpec, 'grid' | 'battleId' | 'rng'> {
  return { battleId, rng, grid: { width: env.rules.combat.grid.width, height: env.rules.combat.grid.height, obstacles: [], terrain: null, ...grid } }
}

describe('battleGrid', () => {
  it('is deterministic per battleId: the same spec yields a deep-equal grid', () => {
    const id = rngLabels.battleDungeon('smugglers_cave', 'r0c1')
    expect(battleGrid(spec(id), env)).toEqual(battleGrid(spec(id), env))
  })

  it('derives the floor from rngLabels.floor(battleId) off the seed, so the combat stream counter does not matter', () => {
    const id = rngLabels.battleTravel('bandits_small', 'old_mill', 3)
    const fresh = battleGrid(spec(id, { seed: 77, counter: 0 }), env)
    const advanced = battleGrid(spec(id, { seed: 77, counter: 17 }), env)
    expect(advanced.floor).toEqual(fresh.floor)
    const expected = [...generateDirtRegion(fresh.width, fresh.height, createRng(deriveState({ seed: 77, counter: 0 }, rngLabels.floor(id))))].sort()
    expect(fresh.floor).toEqual(expected)
  })

  it('two battle ids yield different floors for the same seed', () => {
    const a = battleGrid(spec(rngLabels.battleDungeon('iron_mine', 'r1c0')), env)
    const b = battleGrid(spec(rngLabels.battleDungeon('iron_mine', 'r2c0')), env)
    expect(a.floor).not.toEqual(b.floor)
  })

  it('copies obstacles deduped and sorted, and grid.terrain verbatim (null stays null)', () => {
    const terrain: Record<TileKey, TerrainKind> = { '2,2': 'forest', '5,1': 'fort' }
    const grid = battleGrid(spec('battle:sim', RNG, { obstacles: ['3,2', '1,1', '3,2'], terrain }), env)
    expect(grid.obstacles).toEqual(['1,1', '3,2'])
    expect(grid.terrain).toEqual(terrain)
    expect(grid.terrain).not.toBe(terrain)
    expect(battleGrid(spec('battle:sim'), env).terrain).toBeNull()
    expect(battleGrid(spec('battle:sim'), env).obstacles).toEqual([])
  })

  it('keeps every floor cell inside the board for the tutorial 5×5 and the 14×10 field', () => {
    for (const { width, height } of [env.rules.combat.tutorialGrid, env.rules.combat.grid]) {
      for (const seed of [1, 2, 3, 11, 42]) {
        const grid = battleGrid(spec(rngLabels.battleTutorial, { seed, counter: 0 }, { width, height }), env)
        expect(grid.width).toBe(width)
        expect(grid.height).toBe(height)
        const onBoard = new Set<string>()
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) onBoard.add(cellKey(x, y))
        for (const key of grid.floor) expect(onBoard.has(key), key).toBe(true)
        expect([...grid.floor].sort()).toEqual(grid.floor)
      }
    }
  })

  it('fails loudly on an obstacle or terrain tile outside the board and on an empty board', () => {
    expect(() => battleGrid(spec('battle:sim', RNG, { obstacles: ['14,0'] }), env)).toThrow(/outside the 14×10 board/)
    expect(() => battleGrid(spec('battle:sim', RNG, { terrain: { '0,10': 'fort' } }), env)).toThrow(/terrain tile '0,10'/)
    expect(() => battleGrid(spec('battle:sim', RNG, { width: 0 }), env)).toThrow(/invalid board/)
  })
})
