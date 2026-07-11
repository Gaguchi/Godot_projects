import { test, expect } from '@playwright/test'
import { fireMouse, bootCombat } from './helpers'
import { TILE, gridOriginX, gridOriginY } from '../../src/domain/boardGeometry'

test('B-01: clicking a party unit enters move mode and clicking a valid tile moves the unit', async ({ page }) => {
  await bootCombat(page)

  // Read the active party unit's position + the battle's grid dimensions
  const before = await page.evaluate(() => {
    const cs = window.__debug.combatStore.getState()
    const activeId = cs.state.turn.unitId as string
    const u = cs.state.units[activeId] as { position: string; hasMovedThisTurn?: boolean }
    return {
      activeId,
      pos: u.position,
      hasMoved: u.hasMovedThisTurn ?? false,
      gridW: cs.state.grid.width as number,
      gridH: cs.state.grid.height as number,
    }
  })

  // Canvas coords via the SAME shared geometry the game uses (boards center
  // per-battle since the wave-1 composition pass — never hardcode origins).
  const originX = gridOriginX(before.gridW)
  const originY = gridOriginY(before.gridH)
  const [bx, by] = before.pos.split(',').map(Number)
  const ux = originX + bx! * TILE + TILE / 2
  const uy = originY + by! * TILE + TILE / 2

  // Click on the active unit
  await fireMouse(page, ux, uy)
  await page.waitForTimeout(50)

  const afterUnitClick = await page.evaluate(() => {
    return window.__debug.combatStore.getState().state.subPhase
  })
  expect(afterUnitClick).toBe('SELECTING_MOVE')

  // Pick an empty in-range tile to move to. Walk away from the unit until we
  // find a tile not occupied by anything.
  const target = await page.evaluate(({ bx, by }) => {
    const cs = window.__debug.combatStore.getState()
    const occupied = new Set<string>()
    for (const u of Object.values(cs.state.units) as Array<{ position?: string; hp: { current: number } }>) {
      if (u.hp.current > 0 && u.position) occupied.add(u.position)
    }
    // Try a few candidates that should be empty in the seeded battle
    const candidates = [
      [bx, by - 1], [bx, by + 1], [bx + 1, by + 1], [bx + 1, by - 1],
      [bx, by - 2], [bx + 2, by - 1], [bx + 2, by + 1],
    ]
    for (const [x, y] of candidates) {
      if (x! < 0 || y! < 0 || x! >= cs.state.grid.width || y! >= cs.state.grid.height) continue
      const key = `${x},${y}`
      if (!occupied.has(key)) return { x: x!, y: y! }
    }
    return null
  }, { bx: bx!, by: by! })
  expect(target).not.toBeNull()
  const tx = originX + target!.x * TILE + TILE / 2
  const ty = originY + target!.y * TILE + TILE / 2
  await fireMouse(page, tx, ty)
  await page.waitForTimeout(400)

  const after = await page.evaluate(() => {
    const cs = window.__debug.combatStore.getState()
    const activeId = cs.state.turn.unitId as string
    const u = cs.state.units[activeId] as { position: string; hasMovedThisTurn?: boolean }
    return { activeId, pos: u.position, hasMoved: u.hasMovedThisTurn ?? false }
  })
  expect(after.activeId).toBe(before.activeId)
  expect(after.hasMoved).toBe(true)
  // Position should be different (one step right)
  expect(after.pos).not.toBe(before.pos)
})
