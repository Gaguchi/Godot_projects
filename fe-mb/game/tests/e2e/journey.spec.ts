import { test, expect, type Page } from '@playwright/test'

/** The run's spine through the real screens: Title → New Run → tutorial board → (skip) → prologue talk box →
 *  the sheet → hover quotes the cost → click travels → the node card → Enter town → the counter → back to the
 *  road. Every step reads the DOM the player reads; `?motion=0` collapses the hop and enemy pacing. */

async function errorsOf(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test('title → tutorial → prologue → map → town → road, no console errors', async ({ page }) => {
  const errors = await errorsOf(page)
  await page.goto('/?motion=0')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await page.getByTestId('title-new').click()

  // the tutorial board opens; skip it from the hint card
  await expect(page.getByTestId('combat-screen')).toBeVisible()
  await page.getByTestId('tutorial-skip').click()

  // whatever the skip lands on (report or prologue), reach the prologue talk box and read through it
  const report = page.getByTestId('report-continue')
  if (await report.isVisible().catch(() => false)) await report.click()
  await expect(page.getByTestId('dialogue')).toBeVisible()
  for (let i = 0; i < 12; i++) {
    const choice = page.locator('.talk__choices button').first()
    if (!(await choice.isVisible().catch(() => false))) break
    await choice.click()
    if (await page.getByTestId('name-prompt').isVisible().catch(() => false)) {
      await page.getByTestId('name-input').fill('Ash')
      await page.getByTestId('name-submit').click()
    }
    if (await page.getByTestId('overworld-screen').isVisible().catch(() => false)) break
  }

  // the sheet: hover quotes hops · food, click travels, the node card opens on arrival
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await expect(page.getByTestId('ledger-band')).toContainText(/day/i)
  await page.getByTestId('node-riverside_market').hover()
  await expect(page.getByTestId('path-preview')).toContainText(/1 hop · 1 food/)
  await page.getByTestId('node-riverside_market').click()
  await expect(page.getByTestId('node-card')).toContainText(/Riverside Market/)

  // town: the counter, the satchel, back to the road
  await page.getByTestId('menu-town').click()
  await expect(page.getByTestId('town-screen')).toBeVisible()
  await expect(page.getByTestId('bag')).toBeVisible()
  await page.getByTestId('tab-shop').click()
  await expect(page.getByTestId('shop')).toBeVisible()
  await page.getByTestId('town-leave').click()
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  expect(errors).toEqual([])
})

interface SeedHandle {
  getState: () => Record<string, unknown>
  dispatch: (a: unknown) => void
  env: { rules: { bag: { width: number; height: number } }; content: { items: Record<string, { id: string; gridSize: { width: number; height: number }; rarity: string }> } }
}

test('a drop the satchel has no room for waits with BOTH verbs; making room lets the player take it', async ({ page }) => {
  await page.goto('/?screen=battleEnd&seed=3&motion=0')
  await expect(page.getByTestId('field-report')).toBeVisible()

  // a legendary on the field and a satchel packed to the last cell
  const itemId = await page.evaluate(() => {
    const g = (window as unknown as { __game: SeedHandle }).__game
    const s = g.getState() as { run: { bag: unknown[]; pendingLoot: string[]; lastBattle: { loot: unknown[] } } }
    const small = Object.values(g.env.content.items).find((i) => i.gridSize.width === 1 && i.gridSize.height === 1)!
    const drop = Object.values(g.env.content.items).find((i) => i.rarity === 'legendary') ?? small
    const bag: unknown[] = []
    for (let y = 0; y < g.env.rules.bag.height; y++) for (let x = 0; x < g.env.rules.bag.width; x++) bag.push({ itemId: small.id, x, y, charges: 1 })
    const run = { ...s.run, bag, pendingLoot: [drop.id], lastBattle: { ...s.run.lastBattle, loot: [{ itemId: drop.id, rarity: drop.rarity, placed: false }] } }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run } })
    return drop.id
  })

  // the verb is there, disabled, and says why — the bug was a fully enabled Leave and no Take at all
  const take = page.getByTestId(`take-${itemId}`)
  await expect(take).toBeVisible()
  await expect(take).toHaveAttribute('aria-disabled', 'true')
  await expect(take).toHaveAttribute('data-reason', /no room in the bag/i)
  await expect(page.getByTestId(`forfeit-${itemId}`)).toBeVisible()
  await expect(page.getByTestId('report-continue')).toHaveAttribute('data-reason', /take or forfeit/i)

  // the company sheet opens from the report — where a cell gets freed
  await page.getByTestId('report-company').click()
  await expect(page.getByTestId('loadout')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('loadout')).toBeHidden()

  await page.evaluate(() => {
    const g = (window as unknown as { __game: SeedHandle }).__game
    const s = g.getState() as { run: { bag: unknown[] } }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, bag: s.run.bag.slice(1) } } })
  })

  await expect(take).not.toHaveAttribute('aria-disabled', 'true')
  await take.click()
  await expect(page.getByTestId(`take-${itemId}`)).toHaveCount(0)
  await expect(page.getByTestId('report-continue')).not.toHaveAttribute('data-reason', /take or forfeit/i)
  await page.getByTestId('report-continue').click()
  await expect(page.getByTestId('field-report')).toBeHidden()
})

test('a sealed dungeon shows its Enter verb disabled with the reason, not a dead button', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=7&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: SeedHandle }).__game
    g.dispatch({ type: 'dev/teleport', nodeId: 'smugglers_cave' })
    g.dispatch({ type: 'travel/goTo', nodeId: 'smugglers_cave' })
  })
  await expect(page.getByTestId('node-card')).toBeVisible()
  const enter = page.getByTestId('menu-dungeon')
  // The VERB stays "Enter" — a state is never carried by the label alone; the refusal's own sentence is the
  // tooltip and a lock sigil is the second channel (UIS-03).
  await expect(enter).toHaveText(/enter/i)
  await expect(enter.locator('svg')).toHaveCount(1)
  await expect(enter).toHaveAttribute('aria-disabled', 'true')
  await expect(enter).toHaveAttribute('data-reason', /sealed/i)
  // Playwright itself refuses to press it — which is the point: the verb is no longer a dead brass button
  await expect(enter).toBeDisabled()
})

test('the shop refuses with a reason, never with a live button that does nothing', async ({ page }) => {
  await page.goto('/?screen=town&seed=3&motion=0')
  await expect(page.getByTestId('town-screen')).toBeVisible()
  await page.getByTestId('tab-shop').click()
  await expect(page.getByTestId('shop')).toBeVisible()

  // an empty purse: every Buy carries the price it wants, and pressing one changes nothing
  await page.evaluate(() => {
    const g = (window as unknown as { __game: SeedHandle }).__game
    const s = g.getState() as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, gold: 0 } } })
  })
  const buy = page.locator('[data-testid^="buy-"]').first()
  await expect(buy).toHaveAttribute('aria-disabled', 'true')
  await expect(buy).toHaveAttribute('data-reason', /gold/i)
  const bagBefore = await page.getByTestId('bag').innerHTML()
  await buy.click({ force: true })
  expect(await page.getByTestId('bag').innerHTML()).toBe(bagBefore)

  // a full purse and a full satchel: the reason changes to the bag, not to silence
  await page.evaluate(() => {
    const g = (window as unknown as { __game: SeedHandle }).__game
    const s = g.getState() as { run: Record<string, unknown> }
    const small = Object.values(g.env.content.items).find((i) => i.gridSize.width === 1 && i.gridSize.height === 1)!
    const bag: unknown[] = []
    for (let y = 0; y < g.env.rules.bag.height; y++) for (let x = 0; x < g.env.rules.bag.width; x++) bag.push({ itemId: small.id, x, y, charges: 1 })
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, gold: 9999, bag } } })
  })
  await expect(page.locator('[data-testid^="buy-"]').first()).toHaveAttribute('data-reason', /no room in the satchel/i)

  // belt to the braces: a refusal that slips past a disabled control is still SPOKEN, never dropped on the floor.
  // The surface is mounted ONCE at the frame now (`ui/App.tsx`, RE-GATE C 3.6), so it wears one testid everywhere.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: SeedHandle }).__game
    g.dispatch({ type: 'town/buy', itemId: 'no_such_item' })
  })
  await expect(page.getByTestId('refusal')).toBeVisible()
})

test('the satchel is read-only away from the shop counter, and says so', async ({ page }) => {
  await page.goto('/?screen=town&seed=3&motion=0')
  await expect(page.getByTestId('inn')).toBeVisible()
  const cell = page.getByTestId('bag').locator('.bag__item').first()
  await expect(cell).toHaveAttribute('aria-disabled', 'true')
  await expect(cell).toHaveAttribute('data-reason', /shop counter/i)
  await cell.click({ force: true })
  await expect(cell).not.toHaveClass(/bag__item--selected/)

  // at the counter the same grid is live again
  await page.getByTestId('tab-shop').click()
  const shopCell = page.getByTestId('bag').locator('.bag__item').first()
  await expect(shopCell).not.toHaveAttribute('aria-disabled', 'true')
  await shopCell.click()
  await expect(shopCell).toHaveClass(/bag__item--selected/)
})

test('a dungeon says why the way out is shut, and why a room cannot be entered', async ({ page }) => {
  await page.goto('/?screen=dungeon&seed=7&motion=0')
  await expect(page.getByTestId('dungeon-screen')).toBeVisible()

  // standing in an unresolved room: `leaveDungeon` refuses, so the verb must carry that sentence
  await page.evaluate(() => {
    const g = (window as unknown as { __game: SeedHandle }).__game
    const s = g.getState() as { run: { activeDungeon: { graph: { rows: string[][] } } } }
    const first = s.run.activeDungeon.graph.rows[0]![0]!
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, activeDungeon: { ...s.run.activeDungeon, position: first, cleared: {} } } } })
  })
  const leave = page.getByTestId('dungeon-leave')
  await expect(leave).toHaveAttribute('aria-disabled', 'true')
  await expect(leave).toHaveAttribute('data-reason', /through the boss/i)

  // and no room on the chart is a live control that does nothing
  const rooms = page.locator('[data-testid^="room-"]')
  for (let i = 0; i < await rooms.count(); i++) {
    const room = rooms.nth(i)
    if (await room.getAttribute('aria-disabled') === 'true') await expect(room).toHaveAttribute('data-reason', /.+/)
  }
})

test('the name the player chose is the name every roster shows', async ({ page }) => {
  await page.goto('/?screen=town&seed=3&motion=0')
  await expect(page.getByTestId('town-screen')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: SeedHandle }).__game
    const s = g.getState() as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, mcName: 'Wilhelmina' } } })
  })
  await expect(page.getByTestId('inn')).toContainText('Wilhelmina')
  await expect(page.getByTestId('inn')).not.toContainText('The Foundling')

  await page.getByTestId('town-company').click()
  const loadout = page.getByTestId('loadout')
  await expect(loadout).toBeVisible()
  await expect(loadout.locator('.loadout__face-name').first()).toHaveText('Wilhelmina')
  await expect(loadout.locator('.loadout__title')).toHaveText('Wilhelmina')
})

test('two drops of the same item render two rows without a duplicate-key error', async ({ page }) => {
  const errors = await errorsOf(page)
  await page.goto('/?screen=battleEnd&seed=7&motion=0')
  await expect(page.getByTestId('field-report')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: SeedHandle }).__game
    const s = g.getState() as { run: { lastBattle: Record<string, unknown> } }
    const loot = [{ itemId: 'iron_axe', rarity: 'common', placed: true }, { itemId: 'iron_axe', rarity: 'common', placed: true }]
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, lastBattle: { ...s.run.lastBattle, loot } } } })
  })
  await expect(page.locator('.report__row--loot')).toHaveCount(2)
  expect(errors).toEqual([])
})
