import { test, expect } from '@playwright/test'

test('boot smoke — title screen renders by default', async ({ page }) => {
  await page.goto('/')
  // Title view loads on boot; canvas not mounted until New Game is clicked
  await expect(page.locator('#title-screen')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('#title-new-game')).toBeVisible()
  await expect(page.locator('#title-load-game')).toBeVisible()
  await expect(page.locator('#title-quit')).toBeVisible()
  // DevHud renders in dev mode regardless of active view
  await expect(page.locator('text=Dev HUD')).toBeVisible({ timeout: 2000 })
})

test('new game click → overworld scene mounts', async ({ page }) => {
  await page.goto('/')
  await page.locator('#title-new-game').click()
  // Title screen unmounted; overworld scene now visible (not combat — that needs a travel encounter)
  await expect(page.locator('#title-screen')).toHaveCount(0)
  await expect(page.locator('#overworld-scene')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('#node-pine_crossing')).toBeVisible()
  // DevHud renders in dev mode regardless of active view
  await expect(page.locator('text=Dev HUD')).toBeVisible()
})

test('load game click → modal opens with empty state → close', async ({ page }) => {
  await page.goto('/')
  await page.locator('#title-load-game').click()
  await expect(page.locator('#load-game-modal')).toBeVisible({ timeout: 2000 })
  await expect(page.locator('#load-game-empty')).toContainText('No saved games')
  await page.locator('#load-game-close').click()
  await expect(page.locator('#load-game-modal')).toHaveCount(0)
})

test('quit click → fallback modal in browser → back to title', async ({ page }) => {
  await page.goto('/')
  await page.locator('#title-quit').click()
  await expect(page.locator('#quit-modal')).toBeVisible({ timeout: 2000 })
  await page.locator('#quit-close').click()
  await expect(page.locator('#quit-modal')).toHaveCount(0)
  // Title screen still rendered behind the closed modal
  await expect(page.locator('#title-screen')).toBeVisible()
})
