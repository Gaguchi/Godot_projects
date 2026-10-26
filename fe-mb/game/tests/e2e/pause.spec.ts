import { test, expect, type Page } from '@playwright/test'

/** Esc on the map opens Pause; Esc again resumes; the quest log opens from the band and closes; Save & quit lands
 *  on the title with Continue offered (the autosave holds the run). And — with the pacing ON — the Pause card
 *  actually stops the world: no hop lands, no day passes, no encounter rolls while it is up. */

interface GameHandle {
  getState: () => { run: { nodeId: string; daysElapsed: number } | null; screen: { kind: string } }
  dispatch: (a: unknown) => void
  runtime: { isPaused: () => boolean }
  isQuiescent: () => boolean
  settled: () => Promise<void>
}
/** `window.__game` lives in the PAGE — every reader has to reach for it inside the evaluate. */
async function road(page: Page): Promise<{ node: string; day: number }> {
  return page.evaluate(() => {
    const s = (window as unknown as { __game: GameHandle }).__game.getState()
    return { node: s.run?.nodeId ?? '', day: s.run?.daysElapsed ?? -1 }
  })
}
async function paused(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __game: GameHandle }).__game.runtime.isPaused())
}

test('Esc pauses and resumes; contracts open; save & quit returns to a resumable title', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause')).toBeHidden()

  await page.getByTestId('band-quests').click()
  await expect(page.getByTestId('quest-log')).toBeVisible()
  await page.getByTestId('quest-log-close').click()
  await expect(page.getByTestId('quest-log')).toBeHidden()

  await page.getByTestId('band-menu').click()
  await page.getByTestId('pause-quit').click()
  await expect(page.getByTestId('title-continue')).toBeVisible()
})

test('the Pause card stops the world: the road holds until Resume', async ({ page }) => {
  // pacing ON: hops land on the real HOP_DELAY_MS, so a pump that keeps firing behind the card is visible
  await page.goto('/?screen=overworld&seed=7')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  // a multi-hop journey across the borderlands
  await page.evaluate(() => { (window as unknown as { __game: GameHandle }).__game.dispatch({ type: 'travel/goTo', nodeId: 'border_fortress' }) })
  await expect(page.getByTestId('walking')).toBeVisible()

  await page.getByTestId('band-menu').click()
  await expect(page.getByTestId('pause')).toBeVisible()
  expect(await paused(page)).toBe(true)

  const before = await road(page)
  // more than three hop delays' worth of nothing happening
  await page.waitForTimeout(2600)
  const after = await road(page)
  expect(after).toEqual(before)
  await expect(page.getByTestId('pause')).toBeVisible()

  // Resume and the company walks on
  await page.getByTestId('pause-resume').click()
  await expect(page.getByTestId('pause')).toBeHidden()
  expect(await paused(page)).toBe(false)
  await expect.poll(async () => (await road(page)).node, { timeout: 10_000 }).not.toBe(before.node)
})

test('the Field Report can be paused: Esc and the menu chip both reach it', async ({ page }) => {
  await page.goto('/?screen=battleEnd&seed=3&motion=0')
  await expect(page.getByTestId('field-report')).toBeVisible()

  // the report is a run screen like any other: the battle is over, so Esc belongs to the modal layer here
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause')).toBeHidden()

  await page.getByTestId('report-menu').click()
  await expect(page.getByTestId('pause')).toBeVisible()
  await expect(page.getByTestId('pause-quit')).toBeEnabled()
})

test('Esc backs out ONE level in a battle: the selection first, then the menu', async ({ page }) => {
  // RE-GATE C 3.13: Escape opened Pause on every screen EXCEPT combat, and the combat Menu chip was the only chip
  // in the game with no ESC keycap on it. One rule now: Esc undoes the last thing you opened, and when there is
  // nothing to undo it opens the menu — so the screen a player most wants to stop and save on can be.
  await page.goto('/?screen=combat&seed=5&motion=0')
  await expect(page.getByTestId('combat-screen')).toBeVisible()

  // with a card selected, Esc is the board's: it cancels, and does NOT open pause behind it
  await page.getByTestId('hand').locator('button').first().click()
  await expect(page.getByTestId('hand').locator('button').first()).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('hand').locator('button').first()).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('pause')).toHaveCount(0)

  // with nothing selected, the same key opens the menu — and the chip says so
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause')).toBeVisible()
  await expect(page.getByTestId('pause-quit')).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause')).toBeHidden()

  await expect(page.getByTestId('combat-menu')).toContainText('Esc')
  await page.getByTestId('combat-menu').click()
  await expect(page.getByTestId('pause')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause')).toBeHidden()
})

/**
 * FINAL GATE C 3.4 — Contracts is the page whose whole job is naming things, and its stage line was
 * `stage.replace(/_/g, ' ')` relocated into the engine: it read "Blood Ties — Find daren", a character's name
 * lower-cased. The stage carries an AUTHORED label now, in the reading voice, on a line of its own — because a
 * sentence in the old column squeezed the contract's own name into "Blood T…", and nothing player-authored is
 * ellipsised (ARCHITECTURE §5.1).
 */
test('a contract reads by name and by objective, and neither is cut', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=4&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  const quests = await page.evaluate(() => {
    const g = (window as unknown as { __game: { env: { content: { quests: Record<string, { name: string; initialStage: string; stages: Record<string, { label: string }> }> } }; dispatch: (a: unknown) => void } }).__game
    const ids = Object.keys(g.env.content.quests)
    for (const id of ids) g.dispatch({ type: 'quest/start', questId: id })
    return ids.map((id) => {
      const q = g.env.content.quests[id]!
      return { id, name: q.name, stage: q.initialStage, label: q.stages[q.initialStage]!.label }
    })
  })
  await page.getByTestId('band-quests').click()
  await expect(page.getByTestId('quest-log')).toBeVisible()

  const page1 = page.getByTestId('quest-log-page')
  for (const q of quests) {
    await expect(page1).toContainText(q.name)
    await expect(page1).toContainText(q.label)
    await expect(page1, 'a stage id on the page that names things').not.toContainText(q.stage)
    await expect(page1).not.toContainText(q.stage.replace(/_/g, ' '))
  }
  // …and every line of it is whole: no ellipsis, no clipped box, on the names OR the objectives
  const cut = await page.evaluate(() => {
    const out: string[] = []
    for (const el of Array.from(document.querySelectorAll('[data-testid="quest-log-page"] *'))) {
      const he = el as HTMLElement
      if (he.children.length > 0) continue
      const text = (he.textContent ?? '').trim()
      if (text === '') continue
      if (he.scrollWidth - he.clientWidth > 1) out.push(`${he.className}: ${text}`)
      if (getComputedStyle(he).textOverflow === 'ellipsis' && he.scrollWidth > he.clientWidth) out.push(`ellipsis: ${text}`)
    }
    return out
  })
  expect(cut).toEqual([])
  await page.screenshot({ path: '../.playwright-mcp/fix4-3.4-contracts.png' })
})
