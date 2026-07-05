/**
 * Visual + structural regression tests for the fixed-stage UI. These catch the
 * class of bugs the headless CLI cannot: layout, overflow, clipping, and boot
 * console errors. Uses the dev fast-path (?view=) which now seeds a real party.
 *
 * Robust assertions (no baselines, run anywhere): zero console errors on boot,
 * no horizontal overflow past the stage, dialogue choices contained in-stage.
 * Pixel snapshots (env-specific baselines; regenerate with --update-snapshots)
 * mask the GPU-dependent Phaser canvas.
 *
 * Dungeon is intentionally excluded from the console check pending the known
 * React duplicate-key warning on the dungeon graph.
 */
import { test, expect, type Page } from '@playwright/test'

// reducedMotion is set project-wide in playwright.config.ts (stable snapshots).
const SCENES = ['combat', 'overworld', 'town'] as const

async function bootScene(page: Page, view: string): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(view === 'title' ? '/' : `/?view=${view}`)
  await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready)
  await page.waitForTimeout(400) // scene settle: dev seed effect + first render
  return errors
}

for (const view of ['title', ...SCENES]) {
  test(`${view}: boots with no console errors`, async ({ page }) => {
    const errors = await bootScene(page, view)
    expect(errors, errors.join('\n')).toHaveLength(0)
  })
}

for (const view of SCENES) {
  test(`${view}: no horizontal overflow past the stage`, async ({ page }) => {
    await bootScene(page, view)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test(`${view}: matches snapshot`, async ({ page }) => {
    await bootScene(page, view)
    await expect(page).toHaveScreenshot(`${view}.png`, {
      mask: [page.locator('#game-canvas-container')],
      maxDiffPixelRatio: 0.02,
    })
  })
}

test('dialogue choices stay inside the stage (no clipping)', async ({ page }) => {
  await bootScene(page, 'overworld')
  await page.evaluate(() => {
    const w = window as unknown as { __debug: { runStore: { getState(): { dispatch(a: unknown): void } } } }
    w.__debug.runStore.getState().dispatch({ type: 'startDialogue', payload: { dialogueId: 'bandit_threat', nodeId: 'start' } })
  })
  await page.waitForTimeout(300)
  await page.locator('#dialogue-modal button').first().click() // skip typewriter
  await page.waitForTimeout(400)

  const stage = await page.locator('#game-stage').boundingBox()
  expect(stage).not.toBeNull()
  const choices = page.locator('#dialogue-modal button')
  const n = await choices.count()
  expect(n).toBeGreaterThan(1) // the multi-choice node
  for (let i = 0; i < n; i++) {
    const box = await choices.nth(i).boundingBox()
    if (!box) continue
    expect(box.y + box.height, `choice ${i} extends below the stage`).toBeLessThanOrEqual(stage!.y + stage!.height + 1)
  }
})
