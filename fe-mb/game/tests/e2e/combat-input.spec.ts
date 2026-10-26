import { test, expect, type Page } from '@playwright/test'
import { captureChance, captureContext } from '../../src/engine/combat/capture'
import { forecast } from '../../src/engine/combat/damage'
import type { Card, GameState } from '../../src/engine/types'
import { gridOrigin, tileCentre, tileRect } from '../../src/ui/combat/geometry'

/** The combat input contract, driven through the real DOM against the `?screen=combat` fixture. Every click is
 *  computed from `ui/combat/geometry.ts` — the ONE measurer (ARCHITECTURE §7) — never from a literal pixel.
 *  Covered here: click-pin-confirm, the commit affordance for plays with no forecast, the AoE victim list, drag to
 *  target and chess-drag move, hover over a token, the item tray via `useLegal`, capture (% and the UX gate),
 *  disabled-with-reason on every command, Esc/Tab ownership and keyboard reach, and the strip/plaque fit. */

const COMBAT = '/?screen=combat&seed=3&motion=0'
const W = 14
const H = 10

function errorsOf(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function state(page: Page): Promise<GameState> {
  return page.evaluate(() => window.__game!.getState())
}

async function unitHp(page: Page, unitId: string): Promise<number> {
  return page.evaluate((id) => window.__game!.getState().combat!.units[id]!.hp.current, unitId)
}

/** Rewrite the fixture through `dev/seedState` (CONTRACT §10) — the mutation runs in the page. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seed<T>(page: Page, mutate: (s: any, arg: T) => void, arg: T): Promise<void> {
  await page.evaluate(({ src, a }) => {
    const g = window.__game!
    const s = structuredClone(g.getState()) as GameState
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(`return (${src})`)() as (st: GameState, arg: unknown) => void
    fn(s, a)
    g.dispatch({ type: 'dev/seedState', state: s })
  }, { src: mutate.toString(), a: arg })
  await settle(page)
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => window.__game!.settled())
}

async function stageBox(page: Page): Promise<{ left: number; top: number; scale: number }> {
  return page.evaluate(() => {
    const el = document.getElementById('game-stage')!
    const r = el.getBoundingClientRect()
    return { left: r.left, top: r.top, scale: r.width / 1280 }
  })
}

type Box = { left: number; top: number; scale: number }
const toClient = (box: Box, p: { x: number; y: number }): { x: number; y: number } => ({ x: box.left + p.x * box.scale, y: box.top + p.y * box.scale })

async function clickTile(page: Page, tile: string): Promise<void> {
  const box = await stageBox(page)
  const p = toClient(box, tileCentre(W, H, tile))
  await page.mouse.click(p.x, p.y)
  await settle(page)
}

async function hoverTile(page: Page, tile: string): Promise<void> {
  const box = await stageBox(page)
  const p = toClient(box, tileCentre(W, H, tile))
  await page.mouse.move(p.x, p.y)
}

/** Put the mage beside the first raider with her turn intact. */
async function lilinaAt(page: Page, tile: string): Promise<void> {
  await seed(page, (s, t: string) => {
    s.combat.units.lilina.position = t
    s.combat.units.lilina.hasMovedThisTurn = false
    s.combat.turn.unitId = 'lilina'
    s.combat.turn.acted = ['lilina'] // the round's ledger holds whoever holds the cursor (0115)
    s.combat.selection = { kind: 'idle' }
  }, tile)
}

test('card with no foe in reach explains itself, then move → pin → forecast → confirm lands the hit', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto(COMBAT)
  await expect(page.getByTestId('combat-screen')).toBeVisible()
  await expect(page.getByTestId('hand').locator('button')).toHaveCount(5)

  // nothing in reach from the deployment tile: the hint, not silence
  await page.getByTestId('hand').locator('button').nth(1).click()
  await expect(page.getByTestId('hand-hint')).toContainText(/no foe within reach/i)
  expect(await page.locator('.board__cell--target').count()).toBe(0)
  await page.screenshot({ path: 'test-results/combat-no-target.png' })

  // Move: blue range → walk beside the first raider (the click comes from the shared geometry)
  await page.getByTestId('move').click()
  expect(await page.locator('.board__cell--reach').count()).toBeGreaterThan(10)
  await clickTile(page, '5,3')
  const origin = gridOrigin(W, H)
  await expect(page.locator('[data-unit="lilina"]')).toHaveCSS('left', `${tileRect(W, H, '5,3').x - origin.x}px`)

  // pin the foe → forecast with before → after HP
  await page.getByTestId('hand').locator('button').nth(1).click()
  await expect(page.locator('.board__cell--target')).toHaveCount(1)
  const before = await unitHp(page, 'ashfall_raiders_0_1')
  await page.locator('[data-testid="token-ashfall_raiders_0_1"] .token__hit').click()
  const forecast = page.getByTestId('forecast')
  await expect(forecast).toBeVisible()
  await expect(forecast).toContainText(`HP ${before} →`)
  await page.screenshot({ path: 'test-results/combat-forecast.png' })

  // confirm: the forecast is the applied number
  const text = await forecast.innerText()
  const predicted = Number(/HP \d+ → (\d+)/.exec(text)?.[1])
  await page.getByTestId('confirm-play').click()
  await expect(forecast).toBeHidden()
  expect(await unitHp(page, 'ashfall_raiders_0_1')).toBe(predicted)
  await expect(page.getByTestId('hand').locator('button')).toHaveCount(4)

  // three End turns: the party's turns pass and the enemy pump runs itself
  for (let i = 0; i < 3; i++) await page.getByTestId('end-turn').click()
  await expect(page.getByTestId('plaque')).toContainText(/turn\s*2/i)
  await page.screenshot({ path: 'test-results/combat-round2.png' })
  expect(errors).toEqual([])
})

test('Esc cancels a pinned target; Tab owns the danger union only while nothing is focused', async ({ page }) => {
  await page.goto(COMBAT)
  await page.getByTestId('hand').locator('button').nth(1).click()
  await expect(page.getByTestId('hand').locator('button').nth(1)).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('hand').locator('button').nth(1)).toHaveAttribute('aria-pressed', 'false')

  // focus is on the card button now: Tab belongs to the browser, not to the danger union
  const pressedBefore = await page.getByTestId('danger-toggle').getAttribute('aria-pressed')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('danger-toggle')).toHaveAttribute('aria-pressed', pressedBefore ?? 'false')
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')

  // with nothing focused it is the danger key again
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const dangerBefore = await page.locator('.board__cell--danger').count()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('danger-toggle')).toHaveAttribute('aria-pressed', 'true')
  expect(await page.locator('.board__cell--danger').count()).toBeGreaterThan(dangerBefore)
})

test('every command is reachable and operable from the keyboard', async ({ page }) => {
  await page.goto(COMBAT)
  await expect(page.getByTestId('hand')).toBeVisible()
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY')

  // Shift+Tab is never taken by the danger union, so it is the way in; from there the ring walks the whole surface
  const seen: string[] = []
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Shift+Tab')
    seen.push(await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? ''))
  }
  expect(seen).toContain('danger-toggle')
  expect(seen).toContain('end-turn')
  expect(seen).toContain('move')
  expect(seen).toContain('capture')
  expect(seen.some((t) => t.startsWith('card-'))).toBe(true)

  // and Enter presses what is focused — the whole hand is operable without a mouse
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('card-mage_arcane_burst')).toHaveAttribute('aria-pressed', 'true')

  // forward Tab from a focused control belongs to the browser, never to the danger union
  const danger = await page.getByTestId('danger-toggle').getAttribute('aria-pressed')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('danger-toggle')).toHaveAttribute('aria-pressed', danger ?? 'false')
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('card-fire_tome_blaze')
})

test('a play with no forecast still offers Confirm — status-only cards and AoE on empty ground', async ({ page }) => {
  await page.goto(COMBAT)
  // an ally card whose only effect is GainAp: the maths has nothing to say, the panel still must
  await seed(page, (s) => {
    const deck = s.combat.decks.mc
    const uid = (Object.values(deck.cards) as { uid: string; cardId: string }[]).find((c) => c.cardId === 'lord_command')!.uid
    deck.hand = [uid]
    deck.draw = []
    deck.discard = Object.keys(deck.cards).filter((k) => k !== uid)
    s.combat.turn.unitId = 'mc'
    s.combat.turn.acted = ['mc'] // the round's ledger holds whoever holds the cursor (0115)
    s.combat.selection = { kind: 'idle' }
  }, null)
  await page.getByTestId('card-lord_command').click()
  await expect(page.locator('.board__cell--target').first()).toBeVisible()
  await clickTile(page, '2,5') // Oak, one tile south of the lord
  const panel = page.getByTestId('play-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText(/\+1 AP/i)
  await expect(page.getByTestId('confirm-play')).toBeVisible()
  expect(await page.getByTestId('forecast').count()).toBe(0)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-01-status-card.png' })
  const apBefore = await page.evaluate(() => window.__game!.getState().combat!.units.oak!.ap)
  await page.getByTestId('confirm-play').click()
  await settle(page)
  expect(await page.evaluate(() => window.__game!.getState().combat!.units.oak!.ap)).toBe(apBefore + 1)

  // a tile AoE pinned on empty ground: same panel, plus the honest note that nobody is standing in it
  await page.goto(COMBAT)
  await lilinaAt(page, '5,3')
  await page.getByTestId('card-fire_tome_flame_burst').click()
  const empty = await page.evaluate(() => {
    const s = window.__game!.getState()
    const taken = new Set(Object.values(s.combat!.units).filter((u) => u.position !== null).map((u) => u.position))
    const dist = (a: string, b: string): number => {
      const [ax, ay] = a.split(',').map(Number)
      const [bx, by] = b.split(',').map(Number)
      return Math.abs(ax! - bx!) + Math.abs(ay! - by!)
    }
    const foes = Object.values(s.combat!.units).filter((u) => u.team === 'enemy' && u.position !== null).map((u) => u.position!)
    return [...document.querySelectorAll('.board__cell--target')]
      .map((el) => el.getAttribute('data-tile')!)
      .find((t) => !taken.has(t) && foes.every((f) => dist(t, f) > 2)) ?? null
  })
  expect(empty).not.toBeNull()
  await clickTile(page, empty!)
  await expect(page.getByTestId('play-panel')).toBeVisible()
  await expect(page.getByTestId('empty-blast')).toBeVisible()
  await expect(page.getByTestId('confirm-play')).toBeVisible()
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-01-tile-card.png' })
})

test('hovering the unit you are aiming at keeps the hover and the whole AoE preview', async ({ page }) => {
  await page.goto(COMBAT)
  await lilinaAt(page, '5,3')
  await page.getByTestId('card-fire_tome_flame_burst').click()

  // the corner of the tile — the cell itself
  const box = await stageBox(page)
  const r = tileRect(W, H, '6,3')
  await page.mouse.move(box.left + (r.x + 3) * box.scale, box.top + (r.y + 3) * box.scale)
  const cornerAoe = await page.locator('.board__cell--aoe').count()
  expect(cornerAoe).toBeGreaterThan(1)

  // the centre — squarely on `.token__hit`, which used to swallow the hover and erase the preview
  await hoverTile(page, '6,3')
  await expect(page.locator('.board__cell--hover')).toHaveCount(1)
  expect(await page.locator('.board__cell--aoe').count()).toBe(cornerAoe)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-02-hover-on-token.png' })
})

test('an AoE forecast names every victim, not just the pinned one', async ({ page }) => {
  await page.goto(COMBAT)
  await seed(page, (s) => {
    s.combat.units.lilina.position = '5,4'
    s.combat.units.lilina.hasMovedThisTurn = false
    s.combat.units.ashfall_raiders_0_1.position = '6,4'
    s.combat.units.ashfall_raiders_0_2.position = '6,5'
    s.combat.units.ashfall_raiders_1.position = '7,4'
    s.combat.turn.unitId = 'lilina'
    s.combat.turn.acted = ['lilina'] // the round's ledger holds whoever holds the cursor (0115)
    s.combat.selection = { kind: 'idle' }
  }, null)
  await page.getByTestId('card-fire_tome_flame_burst').click()
  await clickTile(page, '6,4')
  await expect(page.getByTestId('forecast')).toBeVisible()
  await expect(page.getByTestId('forecast-victims')).toBeVisible()
  await expect(page.getByTestId('victim-ashfall_raiders_0_2')).toBeVisible()
  await expect(page.getByTestId('victim-ashfall_raiders_1')).toBeVisible()
  // every unit the blast lands on wears the ember ring, not only the centre
  await expect(page.locator('.token__ring--target')).toHaveCount(3)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-07-aoe-victims.png' })

  const rows = await page.getByTestId('forecast-victims').innerText()
  await page.getByTestId('confirm-play').click()
  await settle(page)
  for (const [id, after] of [...rows.matchAll(/→\s*(\d+)/g)].map((m, i) => [['ashfall_raiders_0_2', 'ashfall_raiders_1'][i]!, Number(m[1])] as const)) {
    expect(await unitHp(page, id)).toBe(after)
  }
})

test('a card can be dragged onto its target, and the active unit dragged to a tile', async ({ page }) => {
  await page.goto(COMBAT)
  await lilinaAt(page, '1,4')
  const box = await stageBox(page)

  // chess-drag the mage three tiles east
  const token = await page.locator('[data-unit="lilina"] .token__hit').boundingBox()
  const dest = toClient(box, tileCentre(W, H, '4,4'))
  await page.mouse.move(token!.x + token!.width / 2, token!.y + token!.height / 2)
  await page.mouse.down()
  await page.mouse.move(dest.x, dest.y, { steps: 12 })
  await expect(page.getByTestId('drag-ghost')).toBeVisible()
  await page.mouse.up()
  await settle(page)
  expect(await page.evaluate(() => window.__game!.getState().combat!.units.lilina!.position)).toBe('4,4')

  // StS drag-to-target: grab Blaze and drop it on the raider
  await seed(page, (s) => { s.combat.units.lilina.position = '5,3' }, null)
  const before = await unitHp(page, 'ashfall_raiders_0_1')
  const card = await page.getByTestId('card-fire_tome_blaze').boundingBox()
  const foe = toClient(box, tileCentre(W, H, '6,3'))
  await page.mouse.move(card!.x + card!.width / 2, card!.y + card!.height / 2)
  await page.mouse.down()
  await page.mouse.move(foe.x, foe.y, { steps: 12 })
  await expect(page.locator('.board__cell--drop')).toHaveCount(1)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-04-drag.png' })
  await page.mouse.up()
  await settle(page)
  expect(await unitHp(page, 'ashfall_raiders_0_1')).toBeLessThan(before)
  await expect(page.getByTestId('hand').locator('button')).toHaveCount(4)
})

test('the bag lists every distinct consumable, each disabled with its own reason', async ({ page }) => {
  await page.goto(COMBAT)
  await seed(page, (s) => { s.combat.consumables = ['healing_potion', 'power_elixir', 'healing_potion'] }, null)
  await expect(page.getByTestId('item-tray')).toBeVisible()
  await expect(page.getByTestId('use-item-healing_potion')).toContainText('×2')
  await expect(page.getByTestId('use-item-power_elixir')).toBeVisible()

  // a Heal at full health is refused BEFORE it costs an item and an AP
  await expect(page.getByTestId('use-item-healing_potion')).toHaveAttribute('data-reason', /full health/i)
  await page.getByTestId('use-item-healing_potion').click({ force: true })
  expect((await state(page)).combat!.consumables).toHaveLength(3)

  // the second item is reachable — it never was behind the potion
  await page.getByTestId('use-item-power_elixir').click()
  await settle(page)
  expect((await state(page)).combat!.consumables).toEqual(['healing_potion', 'healing_potion'])
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-03-item-tray.png' })

  // out of AP: both rows say why
  await seed(page, (s) => { s.combat.units.lilina.ap = 0 }, null)
  await expect(page.getByTestId('use-item-healing_potion')).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByTestId('use-item-healing_potion')).toHaveAttribute('data-reason', /no AP left/i)
})

test('Move and Capture carry their refusal instead of doing nothing', async ({ page }) => {
  await page.goto(COMBAT)
  // no foe within arm's reach from the deployment tile
  await expect(page.getByTestId('capture')).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByTestId('capture')).toHaveAttribute('data-reason', /arm's reach/i)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-05-capture-disabled.png' })

  await page.getByTestId('move').click()
  await clickTile(page, '5,3')
  await expect(page.getByTestId('move')).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByTestId('move')).toHaveAttribute('data-reason', /already moved/i)

  // adjacent now, but the capture costs more AP than is left
  await seed(page, (s) => { s.combat.units.lilina.ap = 1 }, null)
  await expect(page.getByTestId('capture')).toHaveAttribute('data-reason', /needs 2 AP/i)
})

test('capture lists only what the gate allows, and shows the real chance', async ({ page }) => {
  await page.goto(COMBAT)
  await lilinaAt(page, '5,3')
  // a full-HP raider is too strong to take alive: offered as a muted note, never as a red target
  await page.getByTestId('capture').click()
  expect(await page.locator('.board__cell--target').count()).toBe(0)
  await expect(page.locator('.token__badge--muted')).toContainText(/too strong/i)
  await expect(page.getByTestId('capture-hint')).toContainText(/wound them first/i)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-10-capture-gate.png' })

  // wound him past the gate and the badge is exactly `captureChance`
  await seed(page, (s) => {
    s.combat.units.ashfall_raiders_0_1.hp.current = 10
    s.combat.selection = { kind: 'capture' }
  }, null)
  const s = await state(page)
  const env = await page.evaluate(() => window.__game!.env)
  const target = s.combat!.units.ashfall_raiders_0_1!
  // the badge is the engine's own number for THIS board — lilina is alone on him, so no ally is supporting her
  const ctx = captureContext(s.combat!, 'lilina', 'ashfall_raiders_0_1', env)
  expect(ctx.supportingAllies).toBe(0)
  const expected = `${Math.round(captureChance(target, ctx.supportingAllies, ctx.bountyHunter, env) * 100)}%`
  await expect(page.locator('[data-testid="token-ashfall_raiders_0_1"] .token__badge')).toHaveText(expected)
})

test('an ally card that has nothing in reach says ALLY, not foe', async ({ page }) => {
  await page.goto(COMBAT)
  await seed(page, (s) => {
    const deck = s.combat.decks.mc
    const uid = (Object.values(deck.cards) as { uid: string; cardId: string }[]).find((c) => c.cardId === 'lord_command')!.uid
    deck.hand = [uid]
    deck.draw = []
    deck.discard = Object.keys(deck.cards).filter((k) => k !== uid)
    s.combat.turn.unitId = 'mc'
    s.combat.turn.acted = ['mc'] // the round's ledger holds whoever holds the cursor (0115)
    s.combat.selection = { kind: 'idle' }
    // park both allies on real, free ground well outside Command's 1-2 range
    const g = s.combat.grid
    const walls = new Set(g.obstacles as string[])
    const here = s.combat.units.mc.position as string
    const [hx, hy] = here.split(',').map(Number) as [number, number]
    const free: string[] = []
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const t = `${x},${y}`
        if (!walls.has(t) && t !== here && Math.abs(x - hx) + Math.abs(y - hy) > 4) free.push(t)
      }
    }
    s.combat.units.oak.position = free[0]
    s.combat.units.lilina.position = free[free.length - 1]
  }, null)
  await page.getByTestId('card-lord_command').click()
  await expect(page.getByTestId('hand-hint')).toContainText(/No ally within reach of Command/i)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-11-ally-hint.png' })
})

test('the initiative strip never runs under the herald plaque', async ({ page }) => {
  await page.goto(COMBAT)
  await seed(page, (s) => {
    const src = s.combat.units.ashfall_raiders_1
    for (let i = 0; i < 2; i++) {
      const clone = structuredClone(src)
      clone.id = `extra_${i}`
      clone.name = `Ashfall Outrider ${i}`
      clone.position = `${11 + (i % 3)},${1 + Math.floor(i / 3)}`
      s.combat.units[clone.id] = clone
      s.combat.decks[clone.id] = { cards: {}, draw: [], hand: [], discard: [] }
    }
  }, null)
  expect(Object.keys((await state(page)).combat!.units)).toHaveLength(8)
  const strip = (await page.getByTestId('initiative').boundingBox())!
  const plaque = (await page.getByTestId('plaque').boundingBox())!
  expect(strip.x + strip.width).toBeLessThanOrEqual(plaque.x)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-06-strip-plaque.png' })
})

test('the combat keys stop at the battle: the Field Report keeps Tab and Esc', async ({ page }) => {
  await page.goto('/?screen=battleEnd&seed=3&motion=0')
  await expect(page.getByTestId('field-report')).toBeVisible()
  const before = (await state(page)).ui.showDanger
  await page.keyboard.press('Tab')
  expect((await state(page)).ui.showDanger).toBe(before)
  // Esc reaches the modal layer instead of being swallowed by a battle that is over
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('field-report')).toBeVisible()
  expect((await state(page)).combat).toBeNull()
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-08-battleend-keys.png' })
})

test('a failed capture is not silent: the roll gets its own feedback', async ({ page }) => {
  // no `motion=0` here — the float has to be observable
  const errors = errorsOf(page)
  await page.goto('/?screen=combat&seed=3')
  await seed(page, (s) => {
    s.combat.units.lilina.position = '5,3'
    s.combat.units.lilina.hasMovedThisTurn = true
    s.combat.turn.unitId = 'lilina'
    s.combat.turn.acted = ['lilina'] // the round's ledger holds whoever holds the cursor (0115)
    // a 25 % chance: the RNG is reseeded below until the roll misses
    s.combat.selection = { kind: 'capture' }
  }, null)
  const missed = await page.evaluate(() => {
    const g = window.__game!
    for (let seedN = 1; seedN < 200; seedN++) {
      g.dispatch({ type: 'dev/setCombatRng', rng: { seed: seedN, counter: 0 } })
      const before = structuredClone(g.getState())
      g.dispatch({ type: 'combat/capture', targetId: 'ashfall_raiders_0_1' })
      const after = g.getState()
      if (after.combat !== null && after.combat.units.ashfall_raiders_0_1!.captured === false) return true
      g.dispatch({ type: 'dev/seedState', state: before })
    }
    return false
  })
  expect(missed).toBe(true)
  await expect(page.locator('.float--miss')).toContainText('ESCAPED')
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-12-failed-capture.png' })
  expect(errors).toEqual([])
})

test('the living paint over the fallen, and a prisoner never reads as a combatant', async ({ page }) => {
  await page.goto(COMBAT)
  await seed(page, (s) => {
    const dead = s.combat.units.ashfall_raiders_0_1
    dead.lastTile = dead.position
    dead.position = null
    dead.hp.current = 0
    const taken = s.combat.units.ashfall_raiders_0_2
    taken.lastTile = taken.position
    taken.position = null
    taken.hp.current = 0
    taken.captured = true
    s.combat.units.lilina.position = dead.lastTile   // walk onto the corpse's tile
    s.combat.turn.unitId = 'lilina'
    s.combat.turn.acted = ['lilina'] // the round's ledger holds whoever holds the cursor (0115)
    s.combat.selection = { kind: 'idle' }
  }, null)

  const z = async (unit: string): Promise<number> =>
    Number(await page.locator(`[data-unit="${unit}"]`).evaluate((el) => getComputedStyle(el).zIndex))
  expect(await z('lilina')).toBeGreaterThan(await z('ashfall_raiders_0_1'))
  await expect(page.locator('[data-unit="ashfall_raiders_0_1"]')).toHaveClass(/token--fallen/)
  // a prisoner is chained, not slain: its own modifier, never the corpse's
  await expect(page.locator('[data-unit="ashfall_raiders_0_2"]')).toHaveClass(/token--captured/)
  await expect(page.locator('[data-unit="ashfall_raiders_0_2"]')).not.toHaveClass(/token--fallen/)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-16-corpse-order.png' })
})

/* ── the board's own surfaces: the frame that used to vanish, the panel that led with a formula, the wash that
      was the same hue as the floor, the second brass primary, and the face that quoted a number nobody plays with
      (GATE2 6/10/11/18, GATE3 5). ───────────────────────────────────────────────────────────────────────── */

test('the command column and the hand keep their frame through the enemy turn', async ({ page }) => {
  await page.goto(COMBAT)
  const commandsBefore = (await page.getByTestId('commands').boundingBox())!
  const handBefore = (await page.getByTestId('hand').boundingBox())!

  // hold the enemy's turn still — the runtime pumps it to the end in a blink otherwise
  await page.evaluate(() => { window.__game!.runtime.setPaused(true) })
  await seed(page, (s) => {
    s.combat.turn.unitId = 'ashfall_raiders_0_1'
    s.combat.turn.acted = ['ashfall_raiders_0_1'] // the round's ledger holds whoever holds the cursor (0115)
    s.combat.selection = { kind: 'idle' }
  }, null)
  await expect(page.getByTestId('plaque')).toContainText(/enemy turn/i)

  // every verb is still where it was, and says why it will not answer
  await expect(page.getByTestId('commands')).toBeVisible()
  for (const id of ['end-turn', 'move', 'capture']) {
    await expect(page.getByTestId(id)).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId(id)).toHaveAttribute('data-reason', /enemy is acting/i)
  }
  // the hand's footprint is held by a rail that states who is acting — the band never goes empty
  const rail = page.getByTestId('hand')
  await expect(rail).toHaveAttribute('data-waiting', 'true')
  await expect(rail).toContainText(/is acting/i)

  const commandsAfter = (await page.getByTestId('commands').boundingBox())!
  const handAfter = (await rail.boundingBox())!
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(handAfter[k] - handBefore[k])).toBeLessThanOrEqual(1) // the stage is scaled: a subpixel, never a jump
  }
  expect(Math.abs((commandsAfter.y + commandsAfter.height) - (commandsBefore.y + commandsBefore.height))).toBeLessThanOrEqual(1)
  await page.screenshot({ path: '../.playwright-mcp/fix2-g2-06-enemy-turn.png' })
  await page.evaluate(() => { window.__game!.runtime.setPaused(false) })
})

test('the forecast leads with the outcome and keeps the reckoning under it, in words', async ({ page }) => {
  await page.goto(COMBAT)
  await lilinaAt(page, '5,3')
  await page.getByTestId('card-fire_tome_blaze').click()
  await clickTile(page, '6,3')

  const outcome = page.getByTestId('forecast-outcome')
  const reckon = page.getByTestId('forecast-reckoning')
  await expect(outcome).toBeVisible()
  await expect(outcome).toHaveText(/^−\d+ HP/)

  // the maths sits UNDER the outcome and is smaller than it
  const o = (await outcome.boundingBox())!
  const r = (await reckon.boundingBox())!
  expect(r.y).toBeGreaterThan(o.y)
  const size = async (loc: typeof outcome): Promise<number> => Number(await loc.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)))
  expect(await size(reckon)).toBeLessThan(await size(outcome))

  // and it names every term in a word: no raw stat key, no "DR", no equals sign
  const line = await reckon.innerText()
  expect(line).toMatch(/\d+ base/)
  expect(line).toMatch(/magic/)
  expect(line).not.toMatch(/\bmag\b|\bstr\b|\bskl\b|\bDR\b|=/)

  // the number the panel leads with is the number that lands
  const lost = Number(/−(\d+) HP/.exec(await outcome.innerText())![1])
  const before = await unitHp(page, 'ashfall_raiders_0_1')
  await page.screenshot({ path: '../.playwright-mcp/fix2-g2-10-forecast.png' })
  await page.getByTestId('confirm-play').click()
  await settle(page)
  expect(await unitHp(page, 'ashfall_raiders_0_1')).toBe(before - lost)
})

test('nothing paints over the panel the player commits on', async ({ page }) => {
  // The foe roll and the forecast share one footprint at `right:16px`. Muting the roll to opacity 0.14 left it at
  // `z-index: 2` — above the panel — so a foe's green HP bar ran through the "−15 HP" headline and its "76/76"
  // printed itself twice inside the card. Every earlier test read the panel's TEXT, which was correct throughout;
  // only the pixels were wrong. So this one compares the panel as drawn against the panel with the roll deleted:
  // if the roll contributes a single pixel inside the card, the two differ.
  await page.goto(COMBAT)
  await lilinaAt(page, '5,3')
  await page.getByTestId('card-fire_tome_blaze').click()
  await clickTile(page, '6,3')
  const panel = page.getByTestId('play-panel')
  await expect(panel).toBeVisible()
  const roll = page.getByTestId('foe-roll')
  await expect(roll).toHaveClass(/foe-roll--muted/)
  // it really is under the same box — otherwise this test proves nothing
  const p = (await panel.boundingBox())!
  const r = (await roll.boundingBox())!
  const shared = Math.max(0, Math.min(p.x + p.width, r.x + r.width) - Math.max(p.x, r.x)) * Math.max(0, Math.min(p.y + p.height, r.y + r.height) - Math.max(p.y, r.y))
  expect(shared).toBeGreaterThan(10_000)

  // inset past the rounded corners, where the panel's own backdrop blur legitimately samples the sheet behind it
  const face = { x: p.x + 10, y: p.y + 10, width: p.width - 20, height: p.height - 20 }
  const drawn = await page.screenshot({ clip: face })
  await roll.evaluate((el) => { el.remove() })
  const alone = await page.screenshot({ clip: face })
  expect(drawn.equals(alone), 'the foe roll paints inside the forecast card').toBe(true)
  await page.screenshot({ path: '../.playwright-mcp/fix2-g2b-forecast.png' })
})

test('one brass primary: End turn hands it to Confirm while a play is pending', async ({ page }) => {
  await page.goto(COMBAT)
  await expect(page.locator('.btn-forged--primary')).toHaveCount(1)
  await expect(page.getByTestId('end-turn')).toHaveClass(/btn-forged--primary/)

  await lilinaAt(page, '5,3')
  await page.getByTestId('card-fire_tome_blaze').click()
  await clickTile(page, '6,3')
  await expect(page.getByTestId('play-panel')).toBeVisible()
  await expect(page.locator('.btn-forged--primary')).toHaveCount(1)
  await expect(page.getByTestId('confirm-play')).toHaveClass(/btn-forged--primary/)
  await expect(page.getByTestId('end-turn')).not.toHaveClass(/btn-forged--primary/)
  await page.screenshot({ path: '../.playwright-mcp/fix2-g2-18-one-primary.png' })

  // cancelling gives it back — the view always has exactly one lead
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('play-panel')).toBeHidden()
  await expect(page.locator('.btn-forged--primary')).toHaveCount(1)
  await expect(page.getByTestId('end-turn')).toHaveClass(/btn-forged--primary/)
})

test('a target tile is a mark on the board, never a tint of it', async ({ page }) => {
  await page.goto(COMBAT)
  await lilinaAt(page, '5,3')
  await page.getByTestId('card-fire_tome_blaze').click()
  await expect(page.locator('.board__cell--target').first()).toBeVisible()

  const read = await page.evaluate(() => {
    const wash = (sel: string): string => {
      const el = document.querySelector(sel)
      return el === null ? '' : getComputedStyle(el, '::before').backgroundColor
    }
    const img = document.querySelector('.board__cell img')
    const target = document.querySelector('.board__cell--target')!
    return {
      target: wash('.board__cell--target'),
      plain: wash('.board__cell:not(.board__cell--target):not(.board__cell--reach):not(.board__cell--danger)'),
      edge: getComputedStyle(target, '::before').boxShadow,
      art: img === null ? '' : getComputedStyle(img).filter,
    }
  })
  // the cosmetic ground has given its chroma up to the signals — terrain grants nothing here (DECISIONS)
  const saturation = Number(/saturate\(([\d.]+)\)/.exec(read.art)?.[1] ?? '1')
  expect(saturation).toBeLessThanOrEqual(0.3)
  // and the mark carries a hue AND a crisp cell-aligned edge, so hue is never the only channel
  expect(read.target).not.toBe(read.plain)
  expect(read.target).not.toBe('rgba(0, 0, 0, 0)')
  expect(read.edge).not.toBe('none')
  await page.screenshot({ path: '../.playwright-mcp/fix2-g2-11-target-wash.png' })
})

test('a ward offers its tiles in the mending hue, never in the danger one', async ({ page }) => {
  await page.goto(COMBAT)
  // a foe card first, to read the threat wash off the live board
  await lilinaAt(page, '5,3')
  await page.getByTestId('card-fire_tome_blaze').click()
  const threat = await page.locator('.board__cell--target').first().evaluate((el) => getComputedStyle(el, '::before').backgroundColor)

  // now a ward: the same mark, the other hue — oxblood aimed at your own knight reads as a threat
  await seed(page, (s) => {
    const deck = s.combat.decks.mc
    const uid = 'lord_nobility#w1'
    deck.cards[uid] = { uid, cardId: 'lord_nobility', source: 'innate', mod: null }
    deck.discard = [...deck.discard, ...deck.hand]
    deck.hand = [uid]
    s.combat.turn.unitId = 'mc'
    s.combat.turn.acted = ['mc'] // the round's ledger holds whoever holds the cursor (0115)
    s.combat.selection = { kind: 'idle' }
  }, null)
  await page.getByTestId('card-lord_nobility').click()
  const cell = page.locator('.board__cell--target').first()
  await expect(cell).toHaveClass(/board__cell--mend/)
  expect(await cell.evaluate((el) => getComputedStyle(el, '::before').backgroundColor)).not.toBe(threat)

  // and the panel says what a ward actually does — `predictedArmor` is the only place a grant lands
  await clickTile(page, (await cell.getAttribute('data-tile'))!)
  await expect(page.getByTestId('forecast-outcome')).toHaveText(/^\+\d+ armor$/)
  await page.screenshot({ path: '../.playwright-mcp/fix2-g2-11-ward-hue.png' })
})

test('a card face shows what the card will do, and the panel agrees with it', async ({ page }) => {
  await page.goto(COMBAT)
  await lilinaAt(page, '5,3')
  const face = Number(await page.locator('[data-testid="card-fire_tome_blaze"] .card__number').innerText())

  const s = await state(page)
  const env = await page.evaluate(() => window.__game!.env)
  const card = env.content.cards['fire_tome_blaze'] as Card
  const authored = card.effects.find((e) => e.kind === 'Damage')!.base
  // the authored base is NOT what the card does in this mage's hands
  expect(face).toBeGreaterThan(authored)

  const deck = s.combat!.decks['lilina']!
  const inst = deck.hand.map((uid) => deck.cards[uid]!).find((c) => c.cardId === 'fire_tome_blaze')!
  const f = forecast(s.combat!, 'lilina', { card, mod: inst.mod }, 'ashfall_raiders_0_1', env)!
  expect(face).toBe(f.baseTerm + f.statTerm + f.empowerTerm + f.quiverTerm)

  // pin the foe: what lands is the face less that foe's own reduction, and the panel says both
  await page.getByTestId('card-fire_tome_blaze').click()
  await clickTile(page, '6,3')
  await expect(page.getByTestId('forecast-reckoning')).toContainText(`${authored} base`)
  const lost = Number(/−(\d+) HP/.exec(await page.getByTestId('forecast-outcome').innerText())![1])
  expect(lost).toBe(face - f.drTerm)
  await page.screenshot({ path: '../.playwright-mcp/fix2-g3-05-card-face.png' })
})

test.describe('under OS reduced motion', () => {
  test('a damage number is still shown — no animation is not no information', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?screen=combat&seed=3')
    await seed(page, (s) => {
      s.combat.units.lilina.position = '5,3'
      s.combat.units.lilina.hasMovedThisTurn = true
      s.combat.turn.unitId = 'lilina'
      s.combat.turn.acted = ['lilina'] // the round's ledger holds whoever holds the cursor (0115)
      s.combat.selection = { kind: 'idle' }
    }, null)
    await page.getByTestId('card-fire_tome_blaze').click()
    await clickTile(page, '6,3')
    await page.getByTestId('confirm-play').click()
    const float = page.locator('.float--hit').first()
    await expect(float).toBeVisible()
    await expect(float).toHaveText(/^−\d+$/)
    expect(await float.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    await page.screenshot({ path: '../.playwright-mcp/fix-UIC-13-reduced-motion-float.png' })
  })
})

test('an armed verb says so on itself, not only in the board wash', async ({ page }) => {
  // RE-GATE B 2.3: pressing Move changed nothing about the control — same class, same gradient, no `aria-pressed`
  // — and the only feedback was the reach wash deepening from 0.24 to 0.40 alpha, ~13/255 in one channel. Two
  // frames of the battle read as the same frame (crafting-game-ui signal D applied to a toggle).
  await page.goto(COMBAT)
  const move = page.getByTestId('move')
  const capture = page.getByTestId('capture')
  const face = async (l: typeof move): Promise<string> => l.evaluate((el) => {
    const cs = getComputedStyle(el)
    return `${el.className}|${cs.backgroundImage}|${cs.boxShadow}|${cs.color}`
  })

  const idle = await face(move)
  await expect(move).toHaveAttribute('aria-pressed', 'false')
  await move.click()
  await move.evaluate((el) => (el as HTMLElement).blur())
  await expect(move).toHaveAttribute('aria-pressed', 'true')
  await expect(move).toHaveClass(/btn-forged--armed/)
  const armed = await face(move)
  expect(armed).not.toBe(idle)
  // …and only the verb that was pressed is armed
  await expect(capture).toHaveAttribute('aria-pressed', 'false')
  await page.screenshot({ path: '../.playwright-mcp/fix3-2.3-move-armed.png' })

  // cancelling gives the control back
  await page.keyboard.press('Escape')
  await move.evaluate((el) => (el as HTMLElement).blur())
  await expect(move).toHaveAttribute('aria-pressed', 'false')
  await expect(move).not.toHaveClass(/btn-forged--armed/)
  expect(await face(move)).not.toBe(armed)

  // a verb that cannot be armed is still not pressed — the two states never blur into each other
  await expect(capture).toHaveAttribute('aria-disabled', 'true')
  await expect(capture).toHaveAttribute('aria-pressed', 'false')
  await expect(capture).not.toHaveClass(/btn-forged--armed/)
})

test('the battle keeps an account of itself, and it fills the corner that had none', async ({ page }) => {
  // RE-GATE B 2.9. A float dwells 700ms; an enemy phase pumps four of them while the player is reading elsewhere.
  await page.goto('/?screen=combat&seed=21&motion=0')
  await settle(page)
  const log = page.getByTestId('chronicle')
  await expect(log).toBeVisible()
  await expect(log).toContainText(/nothing has come of it yet/i)

  for (let i = 0; i < 4; i++) {
    await page.getByTestId('end-turn').click()
    await settle(page)
  }
  const lines = await log.locator('.chronicle__line').allTextContents()
  expect(lines.length).toBeGreaterThan(0)
  expect(lines.join(' ')).not.toMatch(/nothing has come of it/i)
  // in words, with names and no id or camelCase code anywhere in it
  for (const line of lines) {
    expect(line).toMatch(/[a-z]{3,} [a-z]{3,}/i)
    expect(line, line).not.toMatch(/_|[a-z][A-Z]/)
  }
  // and it sits in the void the gate measured: x 0-256, y 528-672 of the stage
  const seat = await log.evaluate((el) => {
    const stage = document.getElementById('game-stage')!.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    const s = stage.width / 1280
    return { x: (b.left - stage.left) / s, y: (b.top - stage.top) / s, w: b.width / s, h: b.height / s }
  })
  expect(seat.x).toBeLessThan(60)
  expect(seat.y).toBeGreaterThan(500)
  expect(seat.y + seat.h).toBeLessThan(672)
  // …without running under the hand, whose first card begins at x 260
  expect(seat.x + seat.w).toBeLessThanOrEqual(260)
  await page.screenshot({ path: '../.playwright-mcp/fix3-2.9-chronicle.png' })
})
