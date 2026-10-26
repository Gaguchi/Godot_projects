import { test, expect } from '@playwright/test'

/** Gear-as-deck through the modal: open the company from the map band, pick a spare blade in the satchel, hand it
 *  to the Foundling's empty right hand — the deck grows by the blade's cards; put it away — the deck shrinks back
 *  and the blade is in the satchel again. Each step is what the player sees, not the store. */

test('equip and unequip from the loadout modal changes the deck', async ({ page }) => {
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
  const deckLabel = modal.locator('.loadout__deck .place__label')
  const before = Number(/(\d+) cards/i.exec((await deckLabel.innerText()))?.[1])

  // Cell-scoped ids: `bag-<item>` alone matches twice for a stacked item (two ration piles ship in the kit).
  await modal.locator('[data-item="steel_sword"]').first().click()
  await expect(modal.getByTestId('hand-right')).toHaveClass(/loadout__hand--take/)
  await modal.getByTestId('equip-right').click()
  await expect(modal.getByTestId('hand-right')).toContainText(/Steel Sword/)
  await expect(modal.getByTestId('deck')).toContainText(/Right hand/i)
  const after = Number(/(\d+) cards/i.exec((await deckLabel.innerText()))?.[1])
  expect(after).toBeGreaterThan(before)
  await expect(modal.locator('[data-item="steel_sword"]')).toHaveCount(0)

  await modal.getByTestId('unequip-right').click()
  await expect(modal.getByTestId('hand-right')).toContainText(/empty/)
  await expect(modal.locator('[data-item="steel_sword"]')).toHaveCount(1)
  const back = Number(/(\d+) cards/i.exec((await deckLabel.innerText()))?.[1])
  expect(back).toBe(before)

  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
})

/**
 * RE-GATE C 3.13 — no class or weapon restriction existed anywhere, so `equip` put a Volcanic Tower Shield in the
 * Mage's off hand and the game said nothing. The rule lives in `classes.json#weaponClasses` and is read by
 * `run/equipment.ts#canHold`; what the PLAYER gets is a sentence under the hand that will not take it, and no
 * Take button — not a lit control that swallows the press.
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
  await modal.getByTestId('roster-lilina').click()
  await modal.locator('[data-item="iron_tower_shield"]').first().click()

  for (const slot of ['left', 'right'] as const) {
    const hand = modal.getByTestId(`hand-${slot}`)
    await expect(hand).toContainText('Mages do not carry shields')
    await expect(hand).not.toHaveClass(/loadout__hand--take/)
    await expect(modal.getByTestId(`equip-${slot}`)).toHaveCount(0)
  }
  await page.mouse.move(640, 690) // off the satchel, so the hover tip is not over the sentence under test
  await page.screenshot({ path: '../.playwright-mcp/fix4-3.13-training.png' })
  // …and the shield is still the Shield Knight's to take, so the rule is a restriction and not a wall.
  await modal.getByTestId('roster-oak').click()
  await modal.locator('[data-item="iron_tower_shield"]').first().click()
  await expect(modal.getByTestId('hand-right')).toHaveClass(/loadout__hand--take/)
})
