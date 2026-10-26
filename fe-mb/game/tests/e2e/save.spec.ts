import { test, expect, type Page } from '@playwright/test'
import { errorsOf } from './probes'

/**
 * The save model through the real screens (BRIEF §2.14, §10; CONTRACT §4 "`meta/toTitle` … combat allowed"):
 *   · Save & quit MID-BATTLE → Title → Continue restores the same battle, with no input needed to resume
 *   · Continue is offered only while an autosave exists
 *   · Restart from the Game Over ledger walks the SAME seed
 * These run without `?screen=`, because a fixture session deliberately writes no autosave (CONTRACT §10) — the
 * thing under test here IS the autosave.
 */

interface Handle {
  getState: () => {
    screen: { kind: string }
    run: { nodeId: string } | null
    combat: { battleId: string; turn: { unitId: string; round: number }; units: Record<string, { hp: { current: number } }> } | null
    ledger: { runSeed: number } | null
    meta: { runsLost: number }
  }
  dispatch: (a: unknown) => void
}
const game = (page: Page): Promise<ReturnType<Handle['getState']>> =>
  page.evaluate(() => (window as unknown as { __game: Handle }).__game.getState())

test('Save & quit mid-battle, reload, Continue — the same battle comes back', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?motion=0')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await page.getByTestId('title-new').click()
  await expect(page.getByTestId('combat-screen')).toBeVisible()

  const before = await game(page)
  expect(before.combat).not.toBeNull()

  // the battle is the one screen with no band: the menu chip is its way to Pause (Esc belongs to the board)
  await page.getByTestId('combat-menu').click()
  await expect(page.getByTestId('pause')).toBeVisible()
  await page.getByTestId('pause-quit').click()
  await expect(page.getByTestId('title-continue')).toBeVisible()
  // the parked battle is on disk, not just in memory
  expect(await page.evaluate(() => localStorage.getItem('embermarch:run'))).not.toBeNull()

  await page.reload()
  await page.getByTestId('title-continue').click()
  await expect(page.getByTestId('combat-screen')).toBeVisible()

  const after = await game(page)
  expect(after.screen.kind).toBe('combat')
  expect(after.combat?.battleId).toBe(before.combat?.battleId)
  expect(after.combat?.turn).toEqual(before.combat?.turn)
  expect(Object.keys(after.combat?.units ?? {})).toEqual(Object.keys(before.combat?.units ?? {}))
  expect(errors).toEqual([])

  await page.evaluate(() => { localStorage.clear() })
})

test('Continue is offered only while a run is parked', async ({ page }) => {
  await page.goto('/?motion=0')
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()
  await expect(page.getByTestId('title-new')).toBeVisible()
  await expect(page.getByTestId('title-continue')).toHaveCount(0)
})

test('Restart from the Game Over ledger walks the same seed', async ({ page }) => {
  await page.goto('/?screen=gameOver&seed=5&motion=0')
  await expect(page.getByTestId('gameover-screen')).toBeVisible()
  const seed = (await game(page)).ledger?.runSeed
  expect(typeof seed).toBe('number')

  await page.getByTestId('ledger-again').click()
  await expect(page.getByTestId('gameover-screen')).toHaveCount(0)
  const runSeed = await page.evaluate(() => (window as unknown as { __game: { getState: () => { run: { runSeed: number } | null } } }).__game.getState().run?.runSeed)
  expect(runSeed).toBe(seed)
})
