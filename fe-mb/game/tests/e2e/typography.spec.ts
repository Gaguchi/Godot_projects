/**
 * tests/e2e/typography.spec.ts — ARCHITECTURE §5.1's type contract, measured in the browser rather than read off
 * the source. `--font-numeric` used to be `ui-monospace, …, monospace`: it resolved to a DIFFERENT face on every
 * machine and read as console output, and no test noticed because nothing ever asked the browser what it had
 * actually loaded. These three assertions are what would have caught it.
 */
import { test, expect } from '@playwright/test'

test('the numeric face is embedded, loaded, and its digits are tabular', async ({ page }) => {
  await page.goto('/?screen=combat&seed=3&motion=0')
  await page.evaluate(() => document.fonts.ready)

  const family = (await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--font-numeric'))).trim()
  const first = /"([^"]+)"/.exec(family)?.[1] ?? ''
  expect(first, family).not.toBe('')
  // a generic family anywhere in the stack means the machine, not the game, chooses the numerals
  expect(family).not.toMatch(/monospace|system-ui|sans-serif/)

  const loaded = await page.evaluate((f) => document.fonts.check(`40px "${f}"`), first)
  expect(loaded, `${first} is declared but not shipped`).toBe(true)

  // tabular: every digit string of the same length measures the same width, so a rolling counter cannot jitter
  const widths = await page.evaluate(() => {
    const measure = (t: string): number => {
      const s = document.createElement('span')
      s.className = 'numeral'
      s.style.cssText = 'position:absolute;font-size:40px'
      s.textContent = t
      document.body.appendChild(s)
      const w = s.getBoundingClientRect().width
      s.remove()
      return w
    }
    return ['111111', '000000', '489357'].map(measure)
  })
  expect(new Set(widths).size, `digit widths ${widths.join(' / ')}`).toBe(1)
})

test('no screen shows the player an id', async ({ page }) => {
  // classes.json ships display names; the roster used to print `shield_knight` humanised to "shield knight",
  // and the Title screen printed the raw node id as the place.
  await page.goto('/?screen=town&seed=21&motion=0')
  await expect(page.getByTestId('inn')).toBeVisible()
  const inn = (await page.getByTestId('inn').textContent()) ?? ''
  expect(inn).not.toMatch(/_/)
  expect(inn).toMatch(/Lord|Knight|Mage|Cleric|Thief/)

  await page.getByTestId('town-company').click()
  const loadout = (await page.getByTestId('loadout').textContent()) ?? ''
  expect(loadout).not.toMatch(/[a-z]_[a-z]/)
  expect(loadout).toMatch(/Lord|Knight|Mage|Cleric|Thief/)
})

test('the quest log has ONE name on every surface that opens it', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('band-quests')).toHaveText(/contracts/i)
  await page.getByTestId('band-menu').click()
  await expect(page.getByTestId('pause-quests')).toHaveText(/contracts/i)
  await page.getByTestId('pause-quests').click()
  await expect(page.getByTestId('quest-log').locator('.report__title')).toHaveText(/contracts/i)
})

/**
 * FINAL GATE B B.3 — a changing number typeset in the DISPLAY face and uppercased stops reading as a number: the
 * roll of the fallen printed the authored string "fell in battle · day 1" in Cinzel + `text-transform: uppercase`
 * and the bare 1 came out as a Roman "I" — "FELL IN BATTLE · DAY I", three times, under three struck-through
 * names. ARCHITECTURE §5.1: every changing number wears `.numeral`, with its ordinal or unit inside the same span.
 * A number baked into an authored string cannot wear it, which is what makes this a sweep and not a code review.
 */
test('no changing number is inscribed in the display face', async ({ page }) => {
  const SCREENS = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver'] as const
  for (const kind of SCREENS) {
    await page.goto(`/?screen=${kind}&seed=21&motion=0`)
    await expect(page.locator('#game-stage')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const offenders = await page.evaluate(() => {
      const stage = document.getElementById('game-stage')
      if (stage === null) return []
      const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT)
      const out: string[] = []
      for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
        const text = (n.textContent ?? '').trim()
        if (!/\d/.test(text)) continue
        const el = n.parentElement
        if (el === null) continue
        if (el.classList.contains('numeral')) continue
        const cs = getComputedStyle(el)
        const display = cs.fontFamily.includes('Cinzel')
        const shouted = cs.textTransform === 'uppercase'
        if (display && shouted) out.push(`${el.className || el.tagName}: ${text}`)
      }
      return out
    })
    expect(offenders, `numbers inscribed as capitals on ${kind}`).toEqual([])
  }
})

/**
 * SHIP GATE B — the UA stylesheet hands every native control a `font:` SHORTHAND (`400 13.333px Arial`), and a
 * shorthand does not inherit. Nothing in the build reset it, so EVERY verb in the game was typeset in Arial while
 * three self-hosted faces carried everything around it: NEW RUN under the Cinzel wordmark on the title page,
 * MOVE / CAPTURE / END TURN on the board, REST and SCOUT above their EB Garamond blurbs on the camp card, and the
 * map's own node buttons. `.btn-forged` never named a family, so no rule ever overrode the UA's.
 *
 * signals.md row A #1 — "Default/system font (Arial, Roboto, Inter): the 'nobody chose this' fingerprint" — and
 * ARCHITECTURE §5.1's "three self-hosted faces, no fourth". Measured on the control itself, not on its text leaf:
 * a button whose label lives in a styled child hid the fault from every sweep that walked text nodes.
 */
test('every control is typeset in one of the three faces, never the browser default', async ({ page }) => {
  const FACES = ['Cinzel', 'EB Garamond', 'Bitter']
  const controls = async (): Promise<readonly string[]> => page.evaluate((faces) => {
    const out = new Set<string>()
    for (const el of Array.from(document.querySelectorAll('#game-stage button, #game-stage input, #game-stage select, #game-stage textarea'))) {
      const first = (getComputedStyle(el).fontFamily.split(',')[0] ?? '').replace(/["']/g, '').trim()
      if (!faces.includes(first)) out.add(`${first} on <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 48)}">`)
    }
    return Array.from(out)
  }, FACES)

  for (const kind of ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver'] as const) {
    await page.goto(`/?screen=${kind}&seed=21&motion=0`)
    await expect(page.locator('#game-stage')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    expect(await controls(), `browser-default type on ${kind}`).toEqual([])
  }

  // the layers above the screens carry their own controls (the name slip's text field included)
  await page.goto('/?screen=overworld&seed=21&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  for (const modal of [{ kind: 'pause' }, { kind: 'questLog' }, { kind: 'loadout', unitId: null }]) {
    await page.evaluate((m) => window.__game!.dispatch({ type: 'ui/openModal', modal: m } as never), modal)
    expect(await controls(), `browser-default type in the ${modal.kind} modal`).toEqual([])
    await page.evaluate(() => window.__game!.dispatch({ type: 'ui/closeModal' }))
  }
  await page.goto('/?screen=town&seed=21&motion=0')
  await expect(page.getByTestId('town-screen')).toBeVisible()
  await page.evaluate(() => {
    const s = window.__game!.getState()
    window.__game!.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run!, pendingDialogue: { dialogueId: 'sq_caravan_accept', nodeId: 'accept', source: 'town', busts: ['mc', 'guildmistress_anya'] } } } } as never)
  })
  await page.getByTestId('choice-continue').click()
  await expect(page.getByTestId('name-prompt')).toBeVisible()
  expect(await controls(), 'browser-default type on the name slip').toEqual([])
})
