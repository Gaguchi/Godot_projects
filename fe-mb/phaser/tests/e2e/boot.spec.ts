import { test, expect } from '@playwright/test'

test('boot smoke', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#game-canvas-container canvas')).toBeVisible({ timeout: 5000 })
  // DevHud renders in dev mode
  await expect(page.locator('text=Dev HUD')).toBeVisible({ timeout: 2000 })
})
