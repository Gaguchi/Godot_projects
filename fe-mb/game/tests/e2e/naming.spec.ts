import { test, expect, type Page } from '@playwright/test'
import { errorsOf } from './probes'

/**
 * The two naming beats (BRIEF §2.16), and the order they happen in.
 *
 * RE-GATE C 3.6: both prompts were raised by the node's `onEnter`, and a name prompt outranks a dialogue in the
 * overlay stack — so the slip opened OVER the line that asks for the name and the player typed into an empty
 * question, then read what it was for. The prompt now rides the CHOICE that answers: the question is on the glass
 * first, and pressing it is what hands over the name.
 */
interface Handle {
  getState: () => { run: Record<string, unknown> | null }
  dispatch: (a: unknown) => void
}

async function open(page: Page, dialogueId: string, nodeId: string, busts: readonly (string | null)[]): Promise<void> {
  await page.evaluate(({ dialogueId, nodeId, busts }) => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, pendingDialogue: { dialogueId, nodeId, source: 'town', busts } } } })
  }, { dialogueId, nodeId, busts })
}

test('the guild asks for the name before the slip opens', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?screen=town&seed=21&motion=0')
  await open(page, 'sq_caravan_accept', 'accept', ['mc', 'guildmistress_anya'])

  // the QUESTION first: Anya's line is readable, and nothing is covering it
  await expect(page.getByTestId('dialogue-text')).toContainText("I put no one on the guild's books unnamed")
  await expect(page.getByTestId('name-prompt')).toHaveCount(0)
  await page.screenshot({ path: '../.playwright-mcp/fix3-3.6-question-first.png' })

  // …then the answer, on the choice that gives it
  await page.getByTestId('choice-continue').click()
  await expect(page.getByTestId('name-prompt')).toBeVisible()
  await expect(page.getByTestId('name-input')).toBeFocused()
  await page.getByTestId('name-input').fill('Verity Locke')
  await page.getByTestId('name-submit').click()
  await expect(page.getByTestId('name-prompt')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __game: Handle }).__game.getState().run!['mcName'])).toBe('Verity Locke')
  expect(errors).toEqual([])
})

test('the company is named after the line that asks for a banner, not before it', async ({ page }) => {
  await page.goto('/?screen=town&seed=21&motion=0')
  await open(page, 'sq_blood_ties_daren_captured', 'join', ['kael', 'daren'])
  await expect(page.getByTestId('dialogue-text')).toContainText('wants a name on the contracts')
  await expect(page.getByTestId('name-prompt')).toHaveCount(0)
  await page.getByTestId('choice-continue').click()
  await expect(page.getByTestId('name-prompt')).toBeVisible()
  await expect(page.getByTestId('name-prompt')).toContainText(/What will the company be called/i)
})

/**
 * FINAL GATE C 3.15 — the one name the game must not be given is the one it invites the player to write. A lord
 * named "Mercer Kaine" put `party: A Mercer Kaine hp 73/73` above `enemy: b Mercer Kaine hp 265/265` on the final
 * board, and the Field Report and the ledger carried the one string for both sides. The slip refuses it BEFORE
 * the press: `run/naming.ts#canTakeName` is read by the flow gate and by the reducer, so the reason is on the
 * glass and Set is unlit, never a swallowed click.
 */
test('the slip refuses a name the cast already answers to, and says whose fault it is', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto('/?screen=town&seed=21&motion=0')
  await open(page, 'sq_caravan_accept', 'accept', ['mc', 'guildmistress_anya'])
  await page.getByTestId('choice-continue').click()
  await expect(page.getByTestId('name-prompt')).toBeVisible()

  const input = page.getByTestId('name-input')
  const set = page.getByTestId('name-submit')
  const why = page.getByTestId('name-why')

  // the authored warlord's own name — the collision the gate shipped
  await input.fill('Mercer Kaine')
  await expect(why).toHaveText('someone on these roads already answers to that')
  await expect(set).toHaveAttribute('aria-disabled', 'true')
  await page.screenshot({ path: '../.playwright-mcp/fix4-3.15-collision.png' })

  // …however it is typed: the collision is on the NAME, not on the keystrokes
  await input.fill('  mercer   KAINE ')
  await expect(set).toHaveAttribute('aria-disabled', 'true')
  // and a press is swallowed by the gate, not by silence: the run is still unnamed
  await set.click({ force: true })
  await expect(page.getByTestId('name-prompt')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __game: Handle }).__game.getState().run!['mcName'])).toBeNull()

  // a name of their own goes straight through
  await input.fill('Verity Locke')
  await expect(why).toHaveText(' ')
  await set.click()
  await expect(page.getByTestId('name-prompt')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __game: Handle }).__game.getState().run!['mcName'])).toBe('Verity Locke')
  expect(errors).toEqual([])
})
