import { test, expect, type Page } from '@playwright/test'
import { offStage } from './probes'

/** Boot + no console errors + no horizontal overflow. The cheapest gate that
 *  still catches a white screen, a thrown reducer, or a layout leak. */
async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test('boots to the title with no console errors', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/embermarch/i)
  expect(errors).toEqual([])
})

test('stage never scrolls horizontally', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('a save the game cannot read is cleared, and the title says so in words', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('embermarch:run', JSON.stringify({ saveVersion: '0.0.0-ancient', contentVersion: 'deadbeef', meta: {}, run: null, combat: null }))
  })
  await page.reload()

  const notice = page.getByTestId('title-notice')
  await expect(notice).toBeVisible()
  await expect(notice).toContainText(/could not be opened|could not be read/i)
  await expect(notice).toContainText(/cleared/i)
  // the run really is gone, and the player is not left hunting for a Continue that no longer works
  await expect(page.getByTestId('title-continue')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('embermarch:run'))).toBeNull()
  expect(errors).toEqual([])

  await page.evaluate(() => localStorage.clear())
})

test('a healthy boot shows no notice, and the e2e wait primitives are wired', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await expect(page.getByTestId('title-notice')).toHaveCount(0)
  // CONTRACT §10 / 0021: the sanctioned wait is settled() then isQuiescent() — never a getState() poll
  await page.evaluate(() => (window as unknown as { __game: { settled: () => Promise<void> } }).__game.settled())
  const quiet = await page.evaluate(() => (window as unknown as { __game: { isQuiescent: () => boolean } }).__game.isQuiescent())
  expect(quiet).toBe(true)
  // a scratch session wears its badge and writes no autosave (CONTRACT §10)
  await expect(page.getByTestId('dev-badge')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('embermarch:run'))).toBeNull()
})

/** Marks that live in the TEXT face (a middle dot, a tick, the danger chip's ring); everything else must be drawn
 *  by `ui/components/Icon.tsx` — BRIEF §5 bans pictograph unicode, which Chrome serves as colour emoji. */
const TEXT_MARKS = '·—–×✓✗●○∅“”’≥→'
const SCREENS = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver'] as const

test('every screen renders drawn icons, not emoji, and keeps its chrome on the stage', async ({ page }) => {
  const errors = await collectErrors(page)
  for (const kind of SCREENS) {
    await page.goto(`/?screen=${kind}&seed=3&motion=0`)
    await expect(page.locator('#game-stage')).toBeVisible()
    const found = await page.evaluate((marks) => {
      const text = document.getElementById('game-stage')?.innerText ?? ''
      const pictograph = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{2600}-\u{26FF}]/u
      return [...text].filter((c) => !marks.includes(c) && pictograph.test(c))
    }, TEXT_MARKS)
    expect(found, `pictographs on ${kind}`).toEqual([])
    // the chrome of the banded screen must fit the authored stage
    if (kind === 'overworld') expect(await offStage(page, '.ow-band'), 'band off-stage').toEqual([])
  }
  expect(errors).toEqual([])
})

test('Quit belongs to the desktop shell: a browser tab is not offered a dead button', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('title-new')).toBeVisible()
  // `window.close()` is a no-op in a normally opened tab — the control would press with no outcome
  await expect(page.getByTestId('title-quit')).toHaveCount(0)
})
