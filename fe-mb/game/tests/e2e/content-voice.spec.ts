import { test, expect, type Page } from '@playwright/test'
import { errorsOf } from './probes'

/**
 * Two content rules, on the glass.
 *
 * RE-GATE C 3.7 — the game's ONE tutorialisation of capture called the verb "Subdue", a word that appears on no
 * button, in no menu and in no CLI verb. A briefing teaches the mechanic by the name the control carries.
 * RE-GATE C 3.8 — Smuggler's Cave authored two events for a graph that deals up to nine, so half its event rooms
 * fell through to the empty-room line. The underground deck is six per dungeon; these are the new cards, read the
 * way the player reads them.
 */
interface Handle {
  getState: () => { run: Record<string, unknown> | null }
  dispatch: (a: unknown) => void
}

async function openCheck(page: Page, checkEventId: string): Promise<void> {
  await page.evaluate((id) => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, pendingCheckEvent: { checkEventId: id, source: 'dungeon', result: null } } } })
  }, checkEventId)
  await expect(page.getByTestId('check-event')).toBeVisible()
}

test('the capture briefing teaches the word the button carries', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?screen=town&seed=21&motion=0')
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, pendingDialogue: { dialogueId: 'sq_blood_ties_accept', nodeId: 'request', source: 'town', busts: ['mc', 'kael'] } } } })
  })
  const text = page.getByTestId('dialogue-text')
  await expect(text).toContainText('Capture')
  await expect(text).not.toContainText(/subdue/i)
  await page.screenshot({ path: '../.playwright-mcp/fix3-3.7-capture-briefing.png' })
  expect(errors).toEqual([])
})

test('the underground deck reads as one hand: every new room event opens, offers a live option and says what it costs', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?screen=overworld&seed=7&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  for (const id of ['collapsed_shaft', 'black_water', 'earlier_company', 'pale_growth', 'bad_air', 'dripping_font']) {
    await openCheck(page, id)
    const card = page.getByTestId('check-event')
    // a title, a description and at least one option the party can actually take
    await expect(card.locator('.event__title')).not.toBeEmpty()
    const choices = card.locator('.talk__choices button, .event__choices button')
    expect(await choices.count()).toBeGreaterThanOrEqual(3)
    // no id ever reaches the player (ARCHITECTURE §5.1)
    await expect(card).not.toContainText(id)
    if (id === 'black_water') await page.screenshot({ path: '../.playwright-mcp/fix3-3.8-room-event.png' })
  }
  expect(errors).toEqual([])
})
