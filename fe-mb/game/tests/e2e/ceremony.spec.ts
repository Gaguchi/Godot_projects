/**
 * tests/e2e/ceremony.spec.ts — the moments that end a battle and a run.
 *
 * Four gate findings meet here, and every one of them was invisible to the 68 specs that came before:
 *   GATE2-15  Win and Game Over were the same sheet with one word changed, and DECISIONS' trophy was nowhere.
 *   GATE2-16  six screens carried large designed voids with the content pinned to the top.
 *   GATE3-12  the read-only field under the Field Report was completely covered by the report.
 *   GATE3-13  a lost battle never showed a report at all.
 */
import { expect, test, type Page } from '@playwright/test'
import { errorsOf, largestVoid } from './probes'

/** The biggest empty rectangle any of these surfaces is allowed to carry (stage px²): a ledger page's ruled left
 *  margin is ~64×550 and the stage's own top strip ~1280×32; the voids the gate measured were three to five times
 *  that (the combat stage alone came back 336×496). */
const VOID_CAP = 60_000

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game !== undefined)
  await page.evaluate(() => window.__game!.settled())
}

/** Cut the party down where it stands and hand the finished battle to the real settle. */
async function loseTheBattle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = window.__game!
    const s = g.getState()
    const c = s.combat!
    const units = { ...c.units }
    for (const u of Object.values(c.units)) {
      if (u.team === 'party' && u.position !== null) units[u.id] = { ...u, hp: { ...u.hp, current: 0 }, position: null, lastTile: u.position }
    }
    g.dispatch({ type: 'dev/seedState', state: { ...s, combat: { ...c, units, phase: 'defeat' } } })
  })
  await settled(page)
}

test('the two endings are not one page with a word changed: the throne is warm and carries its trophy, the final entry is cold and leads with the dead', async ({ page }) => {
  await page.goto('/?screen=win&seed=21&motion=0')
  await expect(page.getByTestId('win-screen')).toBeVisible()

  // DECISIONS: "the final boss drops a trophy legendary named on the win screen" — it is on the page, and the name
  // is the item's own out of content, never an id.
  const trophy = page.getByTestId('ledger-trophy')
  await expect(trophy).toBeVisible()
  const trophyName = ((await trophy.locator('.trophy__name').textContent()) ?? '').trim()
  expect(trophyName.length).toBeGreaterThan(2)
  expect(trophyName).not.toMatch(/_/)
  const namedItem = await page.evaluate(() => {
    const id = window.__game!.getState().ledger!.trophyItemId!
    return window.__game!.env.content.items[id]!.name
  })
  expect(trophyName).toBe(namedItem)

  const won = {
    ground: await page.locator('.ledger-screen').evaluate((el) => getComputedStyle(el).backgroundImage),
    mourning: await page.getByTestId('ledger-page').evaluate((el) => getComputedStyle(el, '::after').borderTopWidth),
    lamp: await page.locator('.ledger-screen__glow').count(),
    trophyY: (await trophy.boundingBox())!.y,
    rollY: (await page.getByTestId('roll-standing').boundingBox())!.y,
    statsY: (await page.getByTestId('ledger-stats').boundingBox())!.y,
    pageW: (await page.getByTestId('ledger-page').boundingBox())!.width,
  }
  // reading order on the won page: what the throne gave up, then the count, then who is standing
  expect(won.lamp).toBe(1)
  expect(won.trophyY).toBeLessThan(won.statsY)
  expect(won.statsY).toBeLessThan(won.rollY)

  await page.goto('/?screen=gameOver&seed=21&motion=0')
  await expect(page.getByTestId('gameover-screen')).toBeVisible()
  await expect(page.getByTestId('ledger-trophy')).toHaveCount(0)
  const lost = {
    ground: await page.locator('.ledger-screen').evaluate((el) => getComputedStyle(el).backgroundImage),
    mourning: await page.getByTestId('ledger-page').evaluate((el) => getComputedStyle(el, '::after').borderTopWidth),
    lamp: await page.locator('.ledger-screen__glow').count(),
    fallenY: (await page.getByTestId('roll-fallen').boundingBox())!.y,
    statsY: (await page.getByTestId('ledger-stats').boundingBox())!.y,
    pageW: (await page.getByTestId('ledger-page').boundingBox())!.width,
  }
  // no lamp on the table, a mourning rule round the page, and the dead read first — the count is its foot
  expect(lost.lamp).toBe(0)
  expect(parseFloat(lost.mourning)).toBeGreaterThanOrEqual(8)
  expect(parseFloat(won.mourning === '' ? '0' : won.mourning)).toBe(0)
  expect(lost.fallenY).toBeLessThan(lost.statsY)
  // ground, geometry and rhythm all differ — the assertion the gate's "same screen" finding needed
  expect(lost.ground).not.toBe(won.ground)
  expect(lost.pageW).not.toBe(won.pageW)

  // and the fallen are read as fallen: struck through, in the damage ink
  const fallenName = page.locator('.roll--fallen .roll__name').first()
  await expect(fallenName).toBeVisible()
  expect(await fallenName.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain('line-through')
})

test('a lost battle is read on its own field report before the ledger', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?screen=combat&seed=21&motion=0')
  await settled(page)
  await loseTheBattle(page)

  // the report — not the game-over page
  await expect(page.getByTestId('field-report')).toBeVisible()
  await expect(page.getByTestId('gameover-screen')).toHaveCount(0)
  await expect(page.getByTestId('report-verdict')).toHaveText(/the field was lost/i)
  await expect(page.locator('.report__row--fallen')).not.toHaveCount(0)
  await expect(page.getByTestId('report-foot')).toBeVisible()

  // turning the page is what ends the run
  await page.getByTestId('report-continue').click()
  await settled(page)
  await expect(page.getByTestId('gameover-screen')).toBeVisible()
  await expect(page.getByTestId('roll-fallen')).toBeVisible()
  expect(await page.evaluate(() => window.__game!.getState().run)).toBeNull()
  expect(errors).toEqual([])
})

test('the field the fight was fought on is visible under the report, not behind it', async ({ page }) => {
  await page.goto('/?screen=battleEnd&seed=21&motion=0')
  await expect(page.getByTestId('field-report-page')).toBeVisible()
  const board = page.getByTestId('board')
  await expect(board).toBeVisible()
  await expect(board).toHaveAttribute('data-source', 'report')

  const b = (await board.boundingBox())!
  const sheet = (await page.getByTestId('field-report-page').boundingBox())!
  const stage = (await page.locator('#game-stage').boundingBox())!
  // ZERO overlap — the defect was that the sheet covered the board completely
  const overlap = Math.max(0, Math.min(b.x + b.width, sheet.x + sheet.width) - Math.max(b.x, sheet.x)) *
    Math.max(0, Math.min(b.y + b.height, sheet.y + sheet.height) - Math.max(b.y, sheet.y))
  expect(overlap).toBe(0)
  // and it is on the stage, whole
  expect(b.x).toBeGreaterThanOrEqual(stage.x - 0.5)
  expect(b.x + b.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5)
  // with the units where they stood, the fallen among them
  expect(await page.locator('[data-testid=board] .token').count()).toBeGreaterThan(2)
  expect(await page.locator('[data-testid=board] .token--fallen').count()).toBeGreaterThan(0)
  await expect(page.getByTestId('report-plate-cap')).toBeVisible()
})

test('no screen leaves a designed void: the six the gate measured are composed', async ({ page }) => {
  const check = async (name: string, selector: string): Promise<void> => {
    const v = await largestVoid(page, selector)
    expect(v.area, `${name} carries a ${v.w}x${v.h} void at (${v.x}, ${v.y})`).toBeLessThan(VOID_CAP)
  }

  await page.goto('/?screen=win&seed=21&motion=0')
  await check('win', '[data-testid=ledger-page]')
  await page.goto('/?screen=gameOver&seed=21&motion=0')
  await check('gameOver', '[data-testid=ledger-page]')
  await page.goto('/?screen=battleEnd&seed=21&motion=0')
  await check('the field report', '[data-testid=field-report-page]')
  await page.goto('/?screen=town&seed=21&motion=0')
  await check('the inn', '[data-testid=inn]')
  await page.getByTestId('tab-tavern').click()
  await check('the tavern', '[data-testid=tavern]')
  await page.goto('/?screen=overworld&seed=21&motion=0')
  await page.evaluate(() => window.__game!.dispatch({ type: 'ui/openModal', modal: { kind: 'questLog' } }))
  await expect(page.getByTestId('quest-log-page')).toBeVisible()
  await check('the quest log', '[data-testid=quest-log-page]')
  await page.goto('/?screen=dungeon&seed=21&motion=0')
  await expect(page.getByTestId('dungeon-company')).toBeVisible()
  await expect(page.getByTestId('dungeon-descent')).toBeVisible()
  await check('the dungeon', '#game-stage')
  await page.goto('/?screen=combat&seed=21&motion=0')
  await settled(page)
  await check('the battle', '#game-stage')
})

test('a status is on the glass for the whole battle, on both sides of the field', async ({ page }) => {
  await page.goto('/?screen=combat&seed=21&motion=0')
  await settled(page)
  const ids = await page.evaluate(() => {
    const g = window.__game!
    const s = g.getState()
    const c = s.combat!
    const ally = Object.values(c.units).find((u) => u.team === 'party')!
    const foe = Object.values(c.units).find((u) => u.team === 'enemy')!
    const units = {
      ...c.units,
      [ally.id]: { ...ally, armor: 16, statuses: [{ id: 'taunt' as const, stacks: 1, turns: 2, expiresAt: 'ownerTurnStart' as const, sourceId: null }] },
      [foe.id]: { ...foe, statuses: [{ id: 'burn' as const, stacks: 3, turns: 2, expiresAt: 'ownerTurnEnd' as const, sourceId: null }] },
    }
    g.dispatch({ type: 'dev/seedState', state: { ...s, combat: { ...c, units } } })
    return { ally: ally.id, foe: foe.id }
  })
  // the taunt Cover applies is readable for as long as it lasts, not only on the frame it lands (GATE3-02)
  await expect(page.getByTestId(`rail-riders-${ids.ally}`)).toHaveText(/taunt/i)
  await expect(page.getByTestId(`rail-riders-${ids.ally}`)).toHaveText(/2/)
  await expect(page.getByTestId(`rail-armor-${ids.ally}`)).toHaveText(/16/)
  await expect(page.getByTestId(`foe-riders-${ids.foe}`)).toHaveText(/burn/i)

  // the field roll is DIMMED under the play panel, never unmounted: the column keeps its box and nothing jumps
  const before = (await page.getByTestId('foe-roll').boundingBox())!
  const cards = page.getByTestId('hand').locator('button')
  const targets = page.locator('.board__cell--target')
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    await cards.nth(i).click()
    if (await targets.count() > 0) break
    await cards.nth(i).click() // put it back and try the next one
  }
  await expect(targets.first()).toBeVisible()
  // pin through the reducer: the cell's tile is its index in the board's row-major grid (`ui/combat/Board.tsx`)
  await page.evaluate(() => {
    const g = window.__game!
    const cells = Array.from(document.querySelectorAll('[data-testid=board] .board__cell'))
    const i = cells.findIndex((c) => c.classList.contains('board__cell--target'))
    const w = g.getState().combat!.grid.width
    g.dispatch({ type: 'combat/pinTarget', tile: `${i % w},${Math.floor(i / w)}` })
  })
  await expect(page.getByTestId('play-panel')).toBeVisible()
  await expect(page.getByTestId('foe-roll')).toHaveCount(1)
  expect(Number(await page.getByTestId('foe-roll').evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.3)
  const after = (await page.getByTestId('foe-roll').boundingBox())!
  expect(after.width).toBeCloseTo(before.width, 1)
  expect(after.y).toBeCloseTo(before.y, 1)
})
