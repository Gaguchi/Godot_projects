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

test('new game click → combat view → canvas mounts', async ({ page }) => {
  await page.goto('/')
  await page.locator('#title-new-game').click()
  // Title screen unmounted; canvas container + Phaser canvas now in DOM
  await expect(page.locator('#title-screen')).toHaveCount(0)
  await expect(page.locator('#game-canvas-container canvas')).toBeVisible({ timeout: 5000 })
  // metaStore action log entry shown in DevHud (totalRuns increments)
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
