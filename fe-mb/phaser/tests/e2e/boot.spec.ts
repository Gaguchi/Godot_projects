import { test, expect } from '@playwright/test'

test('boot smoke — title screen renders by default', async ({ page }) => {
  await page.goto('/')
  // Title view loads on boot; canvas not mounted until New Game is clicked
  await expect(page.locator('#title-screen')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('#title-new-game')).toBeVisible()
  await expect(page.locator('#title-load-game')).toBeVisible()
  await expect(page.locator('#title-quit')).toBeVisible()
  // DevHud is toggle-hidden by default now (backtick key) — no persistent
  // stamp on the title screen. Just assert the app booted without errors.
})

test('new game click → first-run tutorial battle mounts', async ({ page }) => {
  await page.goto('/')
  await page.locator('#title-new-game').click()
  // Title screen unmounted; FIRST run routes to the guided tutorial battle
  // (ship plan §12) — the overworld comes after tutorial victory.
  await expect(page.locator('#title-screen')).toHaveCount(0)
  await expect(page.locator('#tutorial-overlay')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('canvas')).toBeVisible()
})

test('load game with no saves → button disabled with reason (never a dead-end modal)', async ({ page }) => {
  await page.goto('/')
  // New contract (UI overhaul): with no chronicles to load, Load Game is
  // disabled-with-reason (tooltip) instead of opening an empty modal.
  const load = page.locator('#title-load-game')
  await expect(load).toBeVisible({ timeout: 5000 })
  await expect(load).toBeDisabled()
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
