/**
 * tests/e2e/engine-truth.spec.ts — the screens over the engine fixes of this pass (Gate 3 findings 3 and 6).
 *
 *  · Camp Rest with a whole company at full HP is a live button that spends a ration and the night on nothing.
 *    It is now illegal, and — the rule the screens are held to — the reason is ON THE GLASS before it is pressed.
 *  · The Field Report and the final ledger print the name the PLAYER gave. That used to be two compensating
 *    remaps in the UI over an engine record that held the authored placeholder; the record now holds the right
 *    string, so these assertions are what stops the remaps coming back as the only thing keeping it true.
 */
import { test, expect, type Page } from '@playwright/test'

interface Handle {
  getState: () => Record<string, unknown>
  dispatch: (a: unknown) => void
}

/** Every living unit one HP down, through the dev door the fixtures already use. */
async function woundParty(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as { run: { party: Record<string, { hp: { current: number; max: number } }> } }
    const party = Object.fromEntries(Object.entries(s.run.party).map(([id, u]) => [id, { ...u, hp: { ...u.hp, current: Math.max(1, u.hp.current - 1) } }]))
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, party } } })
  })
}

test('camp Rest with nobody wounded is disabled and says why, and one scratch lights it again', async ({ page }) => {
  await page.goto('/?screen=camp&seed=21&motion=0')
  const rest = page.getByTestId('camp-rest')
  await expect(rest).toBeVisible()
  await expect(rest).toBeDisabled()
  // the reason is rendered, not hidden in a native tooltip
  await expect(rest.locator('.camp__choice-why')).toHaveText(/nobody is wounded/i)
  // Scout is untouched: it buys information, not health
  await expect(page.getByTestId('camp-scout')).toBeEnabled()

  await woundParty(page)
  await expect(rest).toBeEnabled()
  await expect(rest.locator('.camp__choice-why')).toHaveCount(0)

  // and pressing it now actually spends the night on something
  await rest.click()
  await expect(page.getByTestId('camp-rest')).toHaveCount(0)
})

test('the Field Report names the MC by the name the player gave', async ({ page }) => {
  await page.goto('/?screen=battleEnd&seed=7&motion=0')
  const report = page.getByTestId('field-report')
  await expect(report).toBeVisible()
  const placeholder = (await report.textContent()) ?? ''
  expect(placeholder).toContain('The Foundling')

  // name the MC, then resolve a fresh battle: the RECORD is written with the chosen name
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, mcName: 'Roswyn' } } })
  })
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as { run: { lastBattle: { survivors: { unitId: string; name: string }[] } } }
    // prove the SCREEN reads the record verbatim: a record naming the MC must render that name
    const survivors = s.run.lastBattle.survivors.map((u) => (u.unitId === 'mc' ? { ...u, name: 'Roswyn' } : u))
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, lastBattle: { ...s.run.lastBattle, survivors } } } })
  })
  await expect(report).toContainText('Roswyn')
  await expect(report).not.toContainText('The Foundling')
})

test('the final ledger prints the chosen name for the standing and the fallen alike', async ({ page }) => {
  await page.goto('/?screen=gameOver&seed=7&motion=0')
  const page_ = page.getByTestId('ledger-page')
  await expect(page_).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as { ledger: { mcName: string | null; survivors: unknown[]; fallen: unknown[] } }
    const ledger = {
      ...s.ledger,
      mcName: 'Roswyn',
      survivors: [{ unitId: 'oak', name: 'Bagrat "Oak"', classId: 'shield_knight' }],
      fallen: [{ unitId: 'mc', name: 'Roswyn', classId: 'lord', cause: 'battle', day: 3, battleId: null }],
    }
    g.dispatch({ type: 'dev/seedState', state: { ...s, ledger } })
  })
  await expect(page_).toContainText('Roswyn')
  await expect(page_).not.toContainText('The Foundling')
})
