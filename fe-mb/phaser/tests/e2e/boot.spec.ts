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
