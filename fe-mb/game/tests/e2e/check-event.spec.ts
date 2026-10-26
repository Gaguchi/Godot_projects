import { test, expect, type Page } from '@playwright/test'
import { errorsOf } from './probes'

/**
 * The road-event card must tell the player what a choice will do BEFORE they spend it (BRIEF §5, the crafting-game-ui
 * "disabled / doomed with a reason" rule). Stat and gold checks always printed a green ✓ or a red ✗; `class` and
 * `food` checks rendered a bare neutral pill, so the player clicked a guaranteed failure with nothing to read.
 * Every check kind now carries the ENGINE's own verdict, so the badge and the roll can never disagree.
 */
interface Handle {
  getState: () => { run: Record<string, unknown> | null }
  dispatch: (a: unknown) => void
  settled: () => Promise<void>
}

/** Park a check event on the overworld with the purse and the bag the case needs. */
async function openCheck(page: Page, checkEventId: string, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate(([id, extra]) => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: Record<string, unknown> }
    const run = { ...s.run, ...(extra as Record<string, unknown>), pendingCheckEvent: { checkEventId: id, source: 'travel', result: null } }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run } })
  }, [checkEventId, patch] as const)
  await expect(page.getByTestId('check-event')).toBeVisible()
}

/** Every badge on the open card, with the modifier class that carries its ✓ / ✗. */
async function tags(page: Page): Promise<readonly { cls: string; text: string }[]> {
  return page.evaluate(() => {
    const card = document.querySelector('[data-testid="check-event"]')
    if (card === null) return []
    return Array.from(card.querySelectorAll('.talk__tag')).map((el) => ({ cls: String(el.className), text: (el.textContent ?? '').trim() }))
  })
}

test('every check kind reads as passable or doomed before the player commits', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?screen=overworld&seed=7&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  // a stat check the party passes, next to one it cannot: both are marked, neither is a bare pill
  await openCheck(page, 'ancient_inscription', { gold: 3 })
  let seen = await tags(page)
  expect(seen.length).toBeGreaterThan(0)
  for (const t of seen) expect(t.cls, t.text).toMatch(/talk__tag--(ok|risk)/)

  // a CLASS check with nobody to answer it — the case that used to render blank
  await openCheck(page, 'thieves_crossroads', { gold: 3 })
  seen = await tags(page)
  expect(seen.some((t) => /needs a/.test(t.text))).toBe(true)
  for (const t of seen) expect(t.cls, t.text).toMatch(/talk__tag--(ok|risk)/)
  expect(seen.find((t) => /needs a/.test(t.text))?.cls).toContain('talk__tag--risk')
  await page.screenshot({ path: 'test-results/fix-CONTENT-14-class.png' })

  // a FOOD check on an empty bag — likewise
  await openCheck(page, 'injured_knight', { gold: 3, bag: [] })
  seen = await tags(page)
  const food = seen.find((t) => /food/.test(t.text))
  expect(food?.cls).toContain('talk__tag--risk')
  expect(food?.text).toMatch(/0 held/)
  for (const t of seen) expect(t.cls, t.text).toMatch(/talk__tag--(ok|risk)/)

  await page.screenshot({ path: 'test-results/fix-CONTENT-14.png' })
  expect(errors).toEqual([])
})

/**
 * RE-GATE C 3.5 — twelve of the thirty-seven shipped stat checks plus one class check sat above the sheet the
 * starting three are frozen at (there is no XP, no level-up and no stat-granting item anywhere in the engine), and
 * four decisions carried NOTHING else: at Thornwood Chapel the ravine read `spd 8` with no tick on any of the
 * three rows, and at Cragmaw Fortress the shrine read `lck 6` the same way. The lint fails that shape now, in
 * every region (`content/lint.ts`, 0120); this is what the two cards it retuned look like on the glass.
 */
test('a check card always offers the company at least one row it can tick', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?screen=overworld&seed=7&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  for (const id of ['bridge_crossing', 'ancient_shrine', 'disarm_trap', 'thieves_crossroads']) {
    await openCheck(page, id, { gold: 3 })
    const ticked = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="check-event"]')!
      return Array.from(card.querySelectorAll('.talk__tag')).filter((el) => /talk__tag--ok/.test(el.className)).length
    })
    expect(ticked, id).toBeGreaterThan(0)
  }

  await openCheck(page, 'bridge_crossing', { gold: 3 })
  await page.screenshot({ path: '../.playwright-mcp/fix4-3.5-live-check.png' })
  expect(errors).toEqual([])
})

/**
 * GATE3-01 — the last surviving instance of the "authored name on the glass" class (CONTRACT-CHANGES 0051 closed
 * every other surface). The card credited `run.party[id].name`, so a foundling the player christened was sealed
 * "FAILED · THE FOUNDLING" one line under a band reading her chosen name. Both reads go through `displayName` now.
 */
test('a resolved event seals the name the player chose, never the authored one', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?screen=overworld&seed=21&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, mcName: 'Verity Locke' } } })
  })
  await openCheck(page, 'ancient_inscription', {})

  // the MC attempts it by name — whatever the roll says, the seal must carry HER name
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    g.dispatch({ type: 'check/choose', choiceId: 'read_arcane', attemptingUnitId: 'mc' })
  })
  const seal = page.getByTestId('check-result')
  await expect(seal).toBeVisible()
  await expect(seal).toContainText('Verity Locke')
  await expect(seal).not.toContainText('Foundling')

  // the same read in the choice badge: a class check names its candidate, and that is a display name too
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: { party: Record<string, { classId: string }> } }
    const mc = s.run.party['mc']
    const party = { ...s.run.party, mc: { ...mc, classId: 'bandit_archer' } }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, party } } })
  })
  await openCheck(page, 'thieves_crossroads', {})
  const badges = await tags(page)
  const classTag = badges.find((t) => /needs a/.test(t.text))
  expect(classTag?.text).toContain('Verity Locke')
  expect(classTag?.text).not.toContain('Foundling')

  expect(errors).toEqual([])
})

test('the verdict on a check badge is DRAWN, in the one hand the game has', async ({ page }) => {
  // RE-GATE B 2.8: the badge printed a literal ✓ / ✗ — Dingbats, served from whatever fallback face the machine
  // has, at whatever weight that face draws them, next to a set that already ships a `check` glyph
  // (BRIEF §5, "one inline-SVG set … no pictograph unicode in player-visible JSX").
  await page.goto('/?screen=overworld&seed=7&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await openCheck(page, 'bandit_hideout', {})

  const badges = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="check-event"] .talk__tag')).map((el) => ({
      text: (el.textContent ?? ''),
      ok: el.getAttribute('data-ok'),
      svgs: el.querySelectorAll('svg').length,
    })))
  expect(badges.length).toBeGreaterThan(0)
  for (const b of badges) {
    expect(b.text, b.text).not.toMatch(/[\u2713\u2717]/)
    if (b.ok !== null) expect(b.svgs, b.text).toBe(1)
  }
  await page.screenshot({ path: '../.playwright-mcp/fix3-2.8-check.png' })
})

/**
 * RE-GATE C 3.11 — an option carrying NO check came back under the same PASSED seal as a won roll ("Go the long
 * way around. Safer." → PASSED). Passing implies a test was taken; there was none. The stamp reads the choice now
 * (`run/checks.ts#verdictOf`), and the engine's own `passed: true` branch pick is untouched.
 */
test('a choice with no check is sealed as taken, never as won', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?screen=overworld&seed=7&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  await openCheck(page, 'bridge_crossing', {})
  await page.getByTestId('check-take_long_way').click()
  const seal = page.getByTestId('check-result')
  await expect(seal).toHaveAttribute('data-verdict', 'untested')
  await expect(seal).toHaveText('Chosen')
  await expect(seal).not.toHaveClass(/event__seal--pass/)

  // a real roll the company cannot make still stamps a verdict — the ambush's SPD 8 scatter, which 0120 left
  // standing beside a live purse check rather than lowering it
  await openCheck(page, 'ambush_toll', {})
  await page.getByTestId('check-slip_away').click()
  await expect(page.getByTestId('check-result')).toHaveAttribute('data-verdict', 'failed')
  await expect(page.getByTestId('check-result')).toContainText('Failed')

  expect(errors).toEqual([])
})
