import { test, expect } from '@playwright/test'

test('boot smoke — title view by default', async ({ page }) => {
  await page.goto('/')
  // P1-01: view defaults to 'title'; canvas not yet mounted (no New Game click yet)
  await expect(page.locator('#title-placeholder')).toBeVisible({ timeout: 5000 })
  // DevHud renders in dev mode regardless of active view
  await expect(page.locator('text=Dev HUD')).toBeVisible({ timeout: 2000 })
})
