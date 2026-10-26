/**
 * The two findings a screenshot is the only proof of: the authored BOARD (RE-GATE C 3.17) and the ONE-WAY DOOR
 * said before it rather than after (RE-GATE C 3.12).
 *
 * 3.17: `run/battle.ts` handed every non-tutorial fight `obstacles: []`, so the whole tactical layer was a bare
 * rectangle — no cover, no chokepoint, no reason to prefer one tile to another. 3.12: `leaveDungeon` refuses from
 * the first room on, and the only thing the screen said beforehand was about money.
 */
import { expect, test } from '@playwright/test'

test('a battlefield is a place, not a bare rectangle: the board carries the authored obstacles', async ({ page }) => {
  await page.goto('/?screen=combat&seed=21&motion=0')
  await page.evaluate(() => window.__game!.settled())
  const walls = page.locator('.board__cell--wall')
  await expect(walls.first()).toBeVisible()
  expect(await walls.count()).toBeGreaterThan(0)
  // the state and the DOM agree: every wall cell is a tile the engine calls an obstacle
  const obstacles = await page.evaluate(() => [...(window.__game!.getState().combat?.grid.obstacles ?? [])])
  expect(obstacles.length).toBe(await walls.count())
  for (const tile of obstacles) await expect(page.locator(`.board__cell--wall[data-tile="${tile}"]`)).toHaveCount(1)
  // and nothing stands on one
  const on = await page.evaluate((tiles: string[]) => Object.values(window.__game!.getState().combat!.units).filter((u) => u.position !== null && tiles.includes(u.position)).length, obstacles)
  expect(on).toBe(0)
})

test('the one-way door is announced BEFORE it: on the node card, at the mouth, and never once it has shut', async ({ page }) => {
  await page.goto('/?screen=dungeon&seed=21&motion=0')
  await page.evaluate(() => window.__game!.settled())
  const warning = page.getByTestId('dungeon-warning')
  await expect(warning).toBeVisible()
  const said = (await warning.textContent())?.trim() ?? ''
  expect(said.length).toBeGreaterThan(20)

  // back out to the map: the card that OFFERS the descent says the same thing, over a lit Enter
  await page.getByTestId('dungeon-leave').click()
  await page.evaluate(() => window.__game!.settled())
  await expect(page.getByTestId('node-card')).toBeVisible()
  await expect(page.getByTestId('dungeon-warning')).toHaveText(said)
  await expect(page.getByTestId('menu-dungeon')).not.toHaveAttribute('aria-disabled', 'true')

  // and the warning is not decoration: the first room the player can pick is a FIGHT, and taking it commits the
  // company — the descent's position is set and the way out is gone before the board is even drawn.
  await page.getByTestId('menu-dungeon').click()
  await page.evaluate(() => window.__game!.settled())
  await expect(page.getByTestId('dungeon-warning')).toBeVisible()
  expect(await page.evaluate(() => window.__game!.getState().run?.activeDungeon?.position ?? null)).toBeNull()
  await page.locator('.room--reach').first().click()
  await page.evaluate(() => window.__game!.settled())
  expect(await page.evaluate(() => window.__game!.getState().run?.activeDungeon?.position ?? null)).not.toBeNull()
  await expect(page.getByTestId('dungeon-warning')).toHaveCount(0)
})

/**
 * FINAL GATE B B.4 — the game's own reduced-motion switch deleted the dungeon's ONLY hover state instead of its
 * animation. `.room--reach:hover` declared exactly one thing, `transform: scale(1.1)`, and both the OS preference
 * and `?motion=0` set it back to `none`: for a player who asked for less motion, the only clickable objects on
 * this screen answered the pointer with nothing at all (crafting-game-ui signal D).
 */
test('a reachable room answers the pointer even with motion switched off', async ({ page }) => {
  await page.goto('/?screen=dungeon&seed=21&motion=0')
  await page.evaluate(() => window.__game!.settled())
  const room = page.locator('.room--reach').first()
  await expect(room).toBeVisible()

  const read = async (): Promise<Record<string, string>> => room.evaluate((el) => {
    const s = getComputedStyle(el)
    return { background: s.backgroundImage, border: s.borderColor, shadow: s.boxShadow, color: s.color, filter: s.filter, transform: s.transform }
  })
  const idle = await read()
  await room.hover()
  await page.evaluate(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
  })
  const hovered = await read()

  // the LIFT is what reduced motion switches off — and it is switched off here
  expect(hovered.transform, 'the lift should be off under motion=0').toBe(idle.transform)
  // …so something STILL must change, or the room has no hover state at all
  const changed = Object.keys(idle).filter((k) => idle[k] !== hovered[k])
  expect(changed, 'a reachable room with no still hover channel').not.toEqual([])
})

/**
 * FINAL GATE B B.7 — the screen printed the same six-row legend twice: the right rail's "Still below" gave glyph,
 * name and count, and a strip along the foot of the stage gave glyph and name for the same six in the same order
 * and the same hand. The tally already teaches the glyph.
 */
test('the descent has ONE legend, not two', async ({ page }) => {
  await page.goto('/?screen=dungeon&seed=21&motion=0')
  await page.evaluate(() => window.__game!.settled())
  await expect(page.getByTestId('dungeon-descent')).toBeVisible()
  // the tally is the legend: glyph + name + count, for what is actually still down there
  const rail = page.locator('.dungeon__ahead li')
  expect(await rail.count()).toBeGreaterThan(1)
  expect(await rail.first().locator('.room__glyph svg').count()).toBe(1)
  // and nothing else on the screen repeats it
  expect(await page.locator('.dungeon__legend').count()).toBe(0)
  const names = (await rail.allTextContents()).map((t) => t.replace(/[×\d\s]+$/, '').trim())
  const stage = (await page.locator('#game-stage').innerText()).toLowerCase()
  for (const n of names) {
    const hits = stage.split(n.toLowerCase()).length - 1
    expect(hits, `"${n}" is printed ${hits} times on the descent`).toBe(1)
  }
  await page.screenshot({ path: '../.playwright-mcp/fix4-B.7-descent.png' })
})
