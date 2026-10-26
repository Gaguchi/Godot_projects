import { test, expect, type Page } from '@playwright/test'
import type { GameState } from '../../src/engine/types'
import { tileCentre } from '../../src/ui/combat/geometry'

/** CONTRACT §7 (WP-UI-COMBAT): "the last hit / death play on the read-only field under the Field Report" and
 *  "two battles in one session". A battle is fought to victory, the report is read over the frozen field, the
 *  ledger closes, a second battle is seeded — and the hand, plaque and initiative strip must rebuild clean, with
 *  no stale selection, no leftover token and no console error. */

// no `motion=0`: the killing blow's float has to be observable over the read-only field (CONTRACT §7)
const COMBAT = '/?screen=combat&seed=3'
const W = 14
const H = 10

function errorsOf(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => window.__game!.settled())
}

async function state(page: Page): Promise<GameState> {
  return page.evaluate(() => window.__game!.getState())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seed(page: Page, mutate: (s: any) => void): Promise<void> {
  await page.evaluate((src) => {
    const g = window.__game!
    const s = structuredClone(g.getState()) as GameState
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(`return (${src})`)() as (st: GameState) => void
    fn(s)
    g.dispatch({ type: 'dev/seedState', state: s })
  }, mutate.toString())
  await settle(page)
}

async function clickTile(page: Page, tile: string): Promise<void> {
  const box = await page.evaluate(() => {
    const el = document.getElementById('game-stage')!
    const r = el.getBoundingClientRect()
    return { left: r.left, top: r.top, scale: r.width / 1280 }
  })
  const c = tileCentre(W, H, tile)
  await page.mouse.click(box.left + c.x * box.scale, box.top + c.y * box.scale)
  await settle(page)
}

test('two battles in one session: the report reads over the field, then the HUD rebuilds', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto(COMBAT)
  await expect(page.getByTestId('combat-screen')).toBeVisible()

  // one raider left, on his last legs, next to the mage — the last hit is one click away
  await seed(page, (s) => {
    for (const id of ['ashfall_raiders_0_2', 'ashfall_raiders_1']) {
      const u = s.combat.units[id]
      u.lastTile = u.position
      u.position = null
      u.hp.current = 0
    }
    const foe = s.combat.units.ashfall_raiders_0_1
    foe.position = '6,3'
    foe.hp.current = 1
    s.combat.units.lilina.position = '5,3'
    s.combat.units.lilina.hasMovedThisTurn = true
    s.combat.turn.unitId = 'lilina'
    s.combat.turn.acted = ['lilina'] // the round's ledger holds whoever holds the cursor (0115)
    s.combat.selection = { kind: 'idle' }
  })

  await page.getByTestId('card-fire_tome_blaze').click()
  await clickTile(page, '6,3')
  await expect(page.getByTestId('forecast')).toContainText(/SLAIN/)
  await page.getByTestId('confirm-play').click()
  // the death plays on the field the report is written over — the float outlives the battle by its dwell
  await expect(page.locator('.float--hit').filter({ hasText: 'SLAIN' })).toBeVisible()
  await settle(page)

  // the Field Report reads OVER the field, and the field is still mounted with the fallen where they fell.
  // (The ledger sheet currently covers the board completely — that is FieldReport's composition, WP-UI-SHELL;
  //  what this pins is that the read-only field and its floats render at all under the report.)
  await expect(page.getByTestId('field-report')).toBeVisible()
  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.locator('[data-testid="token-ashfall_raiders_0_1"]')).toHaveClass(/token--fallen/)
  expect((await state(page)).combat).toBeNull()
  // the command chrome retires with the battle (brief §2.8) — nothing left to press over the ledger
  expect(await page.getByTestId('hand').count()).toBe(0)
  expect(await page.getByTestId('plaque').count()).toBe(0)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-14-field-report.png' })

  // any drop still waiting blocks Continue with its reason; leaving it is a legal answer
  for (const btn of await page.locator('[data-testid^="forfeit-"]').all()) await btn.click()
  await settle(page)
  await page.getByTestId('report-continue').click()
  await settle(page)
  expect((await state(page)).run?.lastBattle ?? null).toBeNull()

  // a SECOND battle in the same session: the whole HUD rebuilds from the new slice
  await page.evaluate(() => {
    const g = window.__game!
    const s = g.getState()
    const party = s.run!.partyOrder.map((id) => s.run!.party[id]!).filter((u) => u.hp.current > 0)
    g.dispatch({
      type: 'dev/startBattle',
      spec: {
        battleId: 'battle:sim:second',
        tag: 'travel',
        origin: { kind: 'travel', from: s.run!.nodeId, to: s.run!.nodeId, encounterId: 'second_battle' },
        regionTier: 1,
        enemyGroupId: 'ashfall_raiders',
        grid: { width: 14, height: 10, obstacles: [], terrain: null },
        party,
        enemies: { kind: 'group', enemyGroupId: 'ashfall_raiders', level: 2 },
        consumables: ['healing_potion'],
        captureTargets: [],
        rng: { seed: 99, counter: 0 },
      },
    })
  })
  await settle(page)
  await expect(page.getByTestId('combat-screen')).toBeVisible()
  await expect(page.getByTestId('plaque')).toBeVisible()
  await expect(page.getByTestId('initiative')).toBeVisible()
  await expect(page.getByTestId('hand').locator('button')).toHaveCount(5)
  // no stale selection and no leftover corpse from the first battle
  expect((await state(page)).combat!.selection).toEqual({ kind: 'idle' })
  expect(await page.locator('.token--fallen').count()).toBe(0)
  expect(await page.locator('.board__cell--target').count()).toBe(0)
  await page.screenshot({ path: '../.playwright-mcp/fix-UIC-14-second-battle.png' })

  // and the new battle takes input exactly like the first
  await page.getByTestId('hand').locator('button').first().click()
  await expect(page.getByTestId('hand').locator('button').first()).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})
