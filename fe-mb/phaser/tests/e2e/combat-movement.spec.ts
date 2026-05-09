import { test, expect, type Page } from '@playwright/test'

interface CombatStateShape {
  phase: string
  subPhase: string
  turn: { unitId: string | null; team: string }
  units: Record<string, { id: string; name: string; position?: string; hp: { current: number; max: number }; hasMovedThisTurn?: boolean }>
}

declare global {
  interface Window {
    __debug: {
      combatStore: { getState: () => { state: CombatStateShape; dispatch: (e: unknown, r: unknown) => void } }
      runStore: unknown
      metaStore: unknown
    }
  }
}

const fireMouse = async (page: Page, x: number, y: number): Promise<void> => {
  await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('canvas')
    if (!canvas) throw new Error('no canvas')
    const fire = (type: string): void => {
      canvas.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window, button: 0, buttons: 1,
        clientX: x, clientY: y, screenX: x, screenY: y, relatedTarget: null,
      }))
    }
    fire('mousemove'); fire('mousedown'); fire('mouseup'); fire('click')
  }, { x, y })
}

test('B-01: clicking a party unit enters move mode and clicking a valid tile moves the unit', async ({ page }) => {
  // Use the dev-only ?view=combat fast path so the test boots the stub battle
  // directly without depending on overworld encounter randomness.
  await page.goto('http://localhost:5173?view=combat')

  // Wait for the combat scene to seed a battle
  await page.waitForFunction(() => {
    return window.__debug?.combatStore?.getState().state.phase === 'COMBAT'
  })

  // Wait for canvas to render
  await page.waitForFunction(() => {
    return document.querySelector('canvas') !== null
  })

  // Read the active party unit's position
  const before = await page.evaluate(() => {
    const cs = window.__debug.combatStore.getState()
    const activeId = cs.state.turn.unitId as string
    const u = cs.state.units[activeId] as { position: string; hasMovedThisTurn?: boolean }
    return { activeId, pos: u.position, hasMoved: u.hasMovedThisTurn ?? false }
  })

  // Compute canvas-coords of the active unit (TILE=48, GRID_OFFSET_X=240, GRID_OFFSET_Y=120)
  const [bx, by] = before.pos.split(',').map(Number)
  const ux = 240 + bx! * 48 + 24
  const uy = 120 + by! * 48 + 24

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
      if (x! < 0 || y! < 0 || x! >= 14 || y! >= 10) continue
      const key = `${x},${y}`
      if (!occupied.has(key)) return { x: x!, y: y! }
    }
    return null
  }, { bx: bx!, by: by! })
  expect(target).not.toBeNull()
  const tx = 240 + target!.x * 48 + 24
  const ty = 120 + target!.y * 48 + 24
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
