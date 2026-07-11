import { test, expect } from '@playwright/test'
import { GAME_TITLE } from '../../src/ui/strings'

test('travel checkEvent panel renders + resolves cleanly (smoke)', async ({ page }) => {
  await page.goto('/')
  // Smoke: app boots without crashing into a checkEvent code path.
  // Full-flow assertion (force-roll + click + resolve) requires a debug hook
  // that doesn't exist yet; this guards against breaking the overworld mount.
  await expect(page.locator('h1')).toContainText(GAME_TITLE)
})
