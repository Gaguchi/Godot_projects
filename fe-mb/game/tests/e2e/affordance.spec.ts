/**
 * tests/e2e/affordance.spec.ts — the reasons and the reachable content are ON THE GLASS.
 *
 * Every defect pinned here shipped because the suite only ever read an ATTRIBUTE. `title=` satisfied
 * "the control carries its reason" while the player saw nothing; `overflow-y: auto` satisfied "the list holds
 * every item" while two thirds of the shop sat below a fold with a zero-width overlay scrollbar over it; and
 * `?motion=0` satisfied "no animation races the screenshot" while every screen still faded in over 420ms.
 *
 * So these look at boxes and pixels, not attributes: is the bubble rendered, is it inside the sheet, does the
 * KEYBOARD reach it, is any card cut by its container, is any player-authored name cut by its own box.
 */
import { test, expect, type Page } from '@playwright/test'

interface Handle {
  getState: () => Record<string, unknown>
  dispatch: (a: unknown) => void
}

/**
 * Every element whose own box CUTS its own content — the one measurement a screenshot cannot make for you.
 * Overflowing a box that does not clip (`overflow: visible`) is not a cut: the letters are all still drawn.
 */
async function clipped(page: Page, selector: string): Promise<readonly string[]> {
  return page.$$eval(selector, (els) => els
    .filter((el) => {
      const s = getComputedStyle(el)
      const clips = s.overflowX !== 'visible' || s.overflowY !== 'visible'
      return clips && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    })
    .map((el) => (el.textContent ?? '').trim()))
}

test('a disabled control speaks its reason on the glass, by hover and by keyboard', async ({ page }) => {
  await page.goto('/?screen=town&seed=21&motion=0')
  await page.getByTestId('tab-shop').click()
  await expect(page.getByTestId('shop')).toBeVisible()

  const steel = page.getByTestId('buy-steel_sword')
  await expect(steel).toHaveAttribute('aria-disabled', 'true')
  // the browser's own tooltip is gone from the control entirely
  expect(await steel.getAttribute('title')).toBeNull()

  // hover: the reason is a real element, inside the stage, carrying the module's own sentence
  await steel.hover()
  const tip = page.locator('.tip')
  await expect(tip).toBeVisible()
  await expect(tip).toHaveText(/costs 160 gold/i)
  await expect(tip).toHaveText(/purse holds 80/i)
  const box = (await tip.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(1280)

  // and it is not a hover-only surface: a refused control stays focusable, and focus opens the same bubble
  await page.mouse.move(2, 2)
  await expect(tip).toHaveCount(0)
  await steel.focus()
  await expect(page.locator('.tip')).toHaveText(/costs 160 gold/i)
  await expect(steel).toHaveAttribute('aria-describedby', /.+/)

  // one bubble at a time: hovering another refused control takes the surface
  await page.getByTestId('buy-iron_greatsword').hover()
  await expect(page.locator('.tip')).toHaveCount(1)
})

test('the shop shows whole cards and says how much stock it has', async ({ page }) => {
  await page.goto('/?screen=town&seed=21&motion=0')
  await page.getByTestId('tab-shop').click()
  const shelf = page.getByTestId('shop-shelf')
  await expect(shelf).toBeVisible()

  // nothing is hidden below a fold: the shelf never scrolls
  const fit = await shelf.evaluate((el) => ({ ch: el.clientHeight, sh: el.scrollHeight }))
  expect(fit.sh).toBeLessThanOrEqual(fit.ch + 1)

  // and every card on it is drawn whole, inside the shelf's box — no row sliced through the middle
  const overhang = await shelf.evaluate((el) => {
    const box = el.getBoundingClientRect()
    return [...el.querySelectorAll('.shop__card')].filter((c) => c.getBoundingClientRect().bottom > box.bottom + 1).length
  })
  expect(overhang).toBe(0)

  // the counter says what it is holding, and the rest is reachable
  const pager = page.getByTestId('shop-pager')
  await expect(pager).toContainText(/shelf\s*1\s*of\s*4/i)
  await expect(pager).toContainText(/26/)
  await expect(page.getByTestId('shelf-prev')).toHaveAttribute('aria-disabled', 'true')
  const first = await page.locator('[data-testid^="stock-"]').first().getAttribute('data-testid')
  await page.getByTestId('shelf-next').click()
  await expect(page.getByTestId('shop-pager')).toContainText(/shelf\s*2\s*of\s*4/i)
  expect(await page.locator('[data-testid^="stock-"]').first().getAttribute('data-testid')).not.toBe(first)

  // walking to the back of the counter reaches the stock the old fold hid
  await page.getByTestId('shelf-next').click()
  await page.getByTestId('shelf-next').click()
  await expect(page.getByTestId('shelf-next')).toHaveAttribute('aria-disabled', 'true')
  expect(await page.locator('[data-testid^="stock-"]').count()).toBeGreaterThan(0)
})

test('the band never cuts a name the player was given or chose', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=21&motion=0')
  await expect(page.getByTestId('ledger-band')).toBeVisible()
  expect(await clipped(page, '.ow-face__name')).toEqual([])
  expect(await clipped(page, '.ow-band__company')).toEqual([])

  // a banner the player wrote at full length still lands whole
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, companyName: 'The Ashen Wardens of Corwin' } } })
  })
  await expect(page.locator('.ow-band__company')).toHaveText('The Ashen Wardens of Corwin')
  expect(await clipped(page, '.ow-band__company')).toEqual([])

  // and a portrait carries the reading the bar can only approximate, on the glass
  await page.locator('.ow-face').first().hover()
  await expect(page.locator('.tip')).toHaveText(/\d+\/\d+/)
})

test('the scout report is never sliced through a road', async ({ page }) => {
  await page.goto('/?screen=camp&seed=21&motion=0')
  await page.getByTestId('camp-scout').click()
  const list = page.locator('.camp__report-list')
  await expect(list).toBeVisible()

  // the ration bought the whole page: nothing below the fold…
  const fit = await list.evaluate((el) => ({ ch: el.clientHeight, sh: el.scrollHeight }))
  expect(fit.sh).toBeLessThanOrEqual(fit.ch + 1)
  // …and every row is the same height, so a cap can never cut one in half
  const heights = await list.evaluate((el) => [...new Set([...el.querySelectorAll('.camp__report-row')].map((r) => Math.round(r.getBoundingClientRect().height)))])
  expect(heights).toHaveLength(1)
  // the header states the count, so the player knows the list is complete
  const rows = await page.locator('.camp__report-row').count()
  await expect(page.getByTestId('scout-report')).toContainText(new RegExp(`${rows} roads`, 'i'))
  expect(await clipped(page, '.camp__report-road')).toEqual([])
})

test('Pause has one primary and a real switch, not five identical slabs', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await page.keyboard.press('Escape')
  const pause = page.getByTestId('pause')
  await expect(pause).toBeVisible()

  // exactly one brass primary on the card
  await expect(pause.locator('.btn-forged--primary')).toHaveCount(1)
  await expect(pause.locator('.btn-forged--primary')).toHaveAttribute('data-testid', 'pause-resume')

  // sound is a switch that reads its own state, not a button whose label ends in a value
  const sound = page.getByTestId('pause-sound')
  await expect(sound).toHaveAttribute('role', 'switch')
  await expect(sound).toHaveAttribute('aria-checked', 'true')
  await expect(sound).not.toContainText(':')
  await sound.click()
  await expect(sound).toHaveAttribute('aria-checked', 'false')
  await expect(sound).toContainText(/off/i)
  await sound.click()
  await expect(sound).toHaveAttribute('aria-checked', 'true')
})

test('?motion=0 stops the screen transitions too, not only the pump', async ({ page }) => {
  await page.goto('/?screen=camp&seed=21&motion=0')
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-motion'))).toBe('off')

  // the panel is fully painted the instant it is visible — the gate's shot of this screen came back blank at 0
  const card = page.locator('.camp__card')
  await expect(card).toBeVisible()
  expect(await card.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0)
})

/**
 * RE-GATE C 3.6 — the reducer's refusals were all authored (0093) and eight of the ten screens had nowhere to
 * print them. `RefusalToast` was pasted into `Town` and `Dungeon` only, so a refused combat play returned a
 * perfect sentence ("out of reach") and the SAME state reference, and nothing whatever appeared on the glass.
 * The surface is mounted once at the frame now, so this sweeps all ten screens through the one mount.
 */
const EVERY_SCREEN = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver'] as const

test('a refusal is spoken on the glass, on every screen — not only the two that had a toast', async ({ page }) => {
  for (const kind of EVERY_SCREEN) {
    await page.goto(`/?screen=${kind}&seed=21&motion=0`)
    await expect(page.locator('#game-stage')).toBeVisible()
    // one action the flow gate refuses wherever we are: Rest belongs to the camp, the bed to the town
    const action = kind === 'camp' ? { type: 'town/innHeal' } : { type: 'camp/rest' }
    await page.evaluate((a) => { (window as unknown as { __game: Handle }).__game.dispatch(a) }, action)

    const toast = page.getByTestId('refusal')
    await expect(toast, `nothing said no on ${kind}`).toBeVisible()
    const said = (await toast.textContent())?.trim() ?? ''
    // ARCHITECTURE §5.1: a refusal is a lowercase fragment completing an implied "because …", with no full stop
    expect(said, kind).not.toBe('')
    expect(said, `${kind}: "${said}"`).toMatch(/^[a-z0-9]/)
    expect(said, `${kind}: "${said}"`).not.toMatch(/[.!?]$/)

    // …and it never prints over the thing the player is READING or choosing between. The battle screen's foot is
    // the card hand, so the sentence is seated above it — but the raised seat was pasted onto `battleEnd` too,
    // where the hand is put away and the lift dropped the sentence onto the Field Report page instead (2056px²
    // of it over the paper, SHIP GATE B). One rule, measured against every panel the screen actually has.
    const clash = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="refusal"]')?.getBoundingClientRect()
      if (t === undefined) return []
      const out: { what: string; area: number }[] = []
      for (const sel of ['[data-testid="hand"]', '[data-testid="field-report-page"]', '[data-testid="commands"]', '[data-testid="item-tray"]', '[data-testid="hand-hint"]', '[data-testid="capture-hint"]', '[data-testid="chronicle"]']) {
        const r = document.querySelector(sel)?.getBoundingClientRect()
        if (r === undefined) continue
        const w = Math.min(t.right, r.right) - Math.max(t.left, r.left)
        const h = Math.min(t.bottom, r.bottom) - Math.max(t.top, r.top)
        if (w > 0 && h > 0) out.push({ what: sel, area: Math.round(w * h) })
      }
      return out
    })
    expect(clash, `the refusal covers a panel on ${kind}`).toEqual([])
    // the gate's own case, captured while the sentence is still up: a refused play on the battle screen
    if (kind === 'combat') await page.screenshot({ path: '../.playwright-mcp/fix4-3.6-refusal.png' })
  }
})

/**
 * FINAL GATE B B.5 — the six initiative portraits were the only images in the build that could be dragged out of
 * the page, and they were on the ONE screen with real drag-and-drop (a card onto a target, the active unit onto a
 * tile), where the browser's own drag ghost competes with the game's `.drag-ghost`.
 */
test('no image in the game can be dragged out of it', async ({ page }) => {
  for (const kind of EVERY_SCREEN) {
    await page.goto(`/?screen=${kind}&seed=21&motion=0`)
    await expect(page.locator('#game-stage')).toBeVisible()
    const loose = await page.$$eval('#game-stage img', (imgs) => imgs
      .filter((i) => i.getAttribute('draggable') !== 'false')
      .map((i) => `${i.className || '<img>'} ${i.getAttribute('src') ?? ''}`))
    expect(loose, `draggable images on ${kind}`).toEqual([])
  }
})

/**
 * SHIP GATE B — the combat seat, in the state that actually raises BOTH sentences at once. The case above walks
 * the ten screens at rest, where a pinned card with nothing in reach never happens; on the live board it does,
 * and at `bottom: 178px` the reducer's answer printed straight across the hint rail — "out of reach" over "no foe
 * within reach of Elemental Mastery — move closer first", 133×24px of one sentence on top of another.
 */
test('a refusal on the live board clears the hint rail as well as the hand', async ({ page }) => {
  await page.goto('/?screen=combat&seed=505&motion=0')
  await expect(page.getByTestId('combat-screen')).toBeVisible()
  await page.locator('[data-testid^="card-"]').first().click()
  await expect(page.getByTestId('hand-hint')).toBeVisible()
  await page.evaluate(() => {
    const g = window.__game!
    const c = g.getState().combat as unknown as { decks: Record<string, { hand: string[] }>; turn: { unitId: string } }
    g.dispatch({ type: 'combat/playCard', cardUid: c.decks[c.turn.unitId]!.hand[0]!, tile: '13,9' } as never)
  })
  const toast = page.getByTestId('refusal')
  await expect(toast).toBeVisible()
  const clash = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="refusal"]')!.getBoundingClientRect()
    const out: string[] = []
    for (const sel of ['[data-testid="hand-hint"]', '[data-testid="hand"]', '[data-testid="chronicle"]', '[data-testid="commands"]']) {
      const r = document.querySelector(sel)?.getBoundingClientRect()
      if (r === undefined) continue
      const w = Math.min(t.right, r.right) - Math.max(t.left, r.left)
      const h = Math.min(t.bottom, r.bottom) - Math.max(t.top, r.top)
      if (w > 0 && h > 0) out.push(`${sel} by ${Math.round(w * h)}px²`)
    }
    return out
  })
  expect(clash, 'the refusal covers another sentence on the board').toEqual([])
})
