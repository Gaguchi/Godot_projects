import { test, expect } from '@playwright/test'

/** Gear-as-deck through The Company: open it from the map band, and the Foundling's empty right hand offers the
 *  spare blade in the satchel. Trying it shows what it would bring and the deck before and after; putting it in
 *  grows the deck by exactly that; putting it away shrinks it back and the blade is in the satchel again. Each step
 *  is what the player sees, not the store. */

test('equip and unequip from The Company changes the deck', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { dispatch: (a: unknown) => void } }).__game
    g.dispatch({ type: 'dev/addItem', itemId: 'steel_sword' })
  })
  await page.getByTestId('band-company').click()
  const modal = page.getByTestId('loadout')
  await expect(modal).toBeVisible()
  // A Lord's hands: sword, greatsword, shield (`classes.json#weaponClasses`) — a steel blade is his to take.
  await modal.getByTestId('roster-mc').click()
  const deckSize = async (): Promise<number> => Number(/(\d+) cards/i.exec(await modal.getByTestId('deck').innerText())?.[1])
  const before = await deckSize()

  // the empty hand lists what in the satchel fits it; pressing one HOLDS it, and nothing has changed yet
  await modal.locator('[data-item="steel_sword"]').first().click()
  await expect(modal).toHaveAttribute('data-holding', 'yes')
  await expect(modal.getByTestId('held-name')).toHaveText('Steel Sword')
  await expect(modal.getByTestId('hand-right')).toHaveAttribute('data-take', 'yes')
  await expect(modal.getByTestId('hand-right')).toContainText(/brings \d+ cards?/)
  // the deck is told before it is changed: now, and after
  const told = /(\d+) cards now, (\d+) after/.exec((await modal.getByTestId('deck-project').locator('[role="img"]').getAttribute('aria-label')) ?? '')
  expect(Number(told?.[1])).toBe(before)
  expect(Number(told?.[2])).toBeGreaterThan(before)

  await modal.getByTestId('equip-right').click()
  await expect(modal).toHaveAttribute('data-holding', 'no')
  await expect(modal.getByTestId('hand-right')).toContainText(/Steel Sword/)
  expect(await deckSize()).toBe(Number(told?.[2]))
  await expect(modal.locator('[data-item="steel_sword"]')).toHaveCount(0)
  // …and the deck's own page files those cards under the hand that brought them
  await page.keyboard.press('d')
  await expect(modal).toHaveAttribute('data-tab', 'deck')
  await expect(modal).toContainText(/Right hand · Steel Sword/)
  expect(await modal.getByTestId('deck-card').count()).toBe(Number(told?.[2]))
  await page.keyboard.press('d')

  await modal.getByTestId('unequip-right').click()
  await expect(modal.getByTestId('hand-right')).toContainText(/empty/)
  await expect(modal.locator('[data-item="steel_sword"]')).toHaveCount(1)
  expect(await deckSize()).toBe(before)

  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
})

/**
 * RE-GATE C 3.13 — no class or weapon restriction existed anywhere, so `equip` put a Volcanic Tower Shield in the
 * Mage's off hand and the game said nothing. The rule lives in `classes.json#weaponClasses` and is read by
 * `run/equipment.ts#canHold`; what the PLAYER gets is a sentence in the hand that will not take it, and no verb
 * to put it there — not a lit control that swallows the press.
 */
test('a hand that is not trained to the gear says so, and offers no way to take it', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { dispatch: (a: unknown) => void } }).__game
    g.dispatch({ type: 'dev/addItem', itemId: 'iron_tower_shield' })
  })
  await page.getByTestId('band-company').click()
  const modal = page.getByTestId('loadout')
  await expect(modal).toBeVisible()

  // the Shield Knight can carry it: his off hand offers the change, and holding it lights that hand
  await modal.getByTestId('roster-oak').click()
  await modal.getByTestId('change-right').click()
  await expect(modal.getByTestId('held-name')).toHaveText('Iron Tower Shield')
  await expect(modal.getByTestId('hand-right')).toHaveAttribute('data-take', 'yes')
  await expect(modal.getByTestId('equip-right')).toBeVisible()

  // still holding it, ask the Mage: both her hands say why not, and there is no verb to put it in either
  await modal.getByTestId('roster-lilina').click()
  for (const slot of ['left', 'right'] as const) {
    const hand = modal.getByTestId(`hand-${slot}`)
    await expect(hand).toContainText('Mages do not carry shields')
    await expect(hand).toHaveAttribute('data-take', 'no')
    await expect(modal.getByTestId(`equip-${slot}`)).toHaveCount(0)
    await expect(modal.getByTestId(`aim-${slot}`)).toHaveCount(0)
  }
  // her face in the strip is marked, and says the same sentence when pointed at
  await expect(modal.getByTestId('roster-lilina')).toHaveAttribute('data-reason', /Mages do not carry shields/)
  await page.mouse.move(640, 700) // off the strip, so the bubble is not over the sentences under test
  await page.screenshot({ path: '../.playwright-mcp/fix4-3.13-training.png' })

  // …and the shield is still the Shield Knight's to take, so the rule is a restriction and not a wall.
  await modal.getByTestId('roster-oak').click()
  await expect(modal.getByTestId('hand-right')).toHaveAttribute('data-take', 'yes')

  // Esc puts the piece back before it closes anything
  await page.keyboard.press('Escape')
  await expect(modal).toHaveAttribute('data-holding', 'no')
  await expect(modal).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
})
