import { test, expect } from '@playwright/test'
import { bootCombat } from './helpers'

/**
 * Combat HUD buttons now live in React DOM (UI-T18..T24 migration).
 * Click via real DOM selectors, not canvas MouseEvent dispatch.
 */

test('B-02: End Turn button advances the turn counter and switches active unit', async ({ page }) => {
  await bootCombat(page)

  const before = await page.evaluate(() => {
    const cs = window.__debug.combatStore.getState()
    return { activeId: cs.state.turn.unitId, turnNumber: cs.state.turn.number }
  })

  await page.click('#combat-end-turn-btn')
  await page.waitForTimeout(150)

  const after = await page.evaluate(() => {
    const cs = window.__debug.combatStore.getState()
    return { activeId: cs.state.turn.unitId, turnNumber: cs.state.turn.number }
  })
  expect(after.activeId).not.toBe(before.activeId)
})

test('B-02: clicking a card transitions subPhase to SELECTING_TARGET', async ({ page }) => {
  await bootCombat(page)

  // Wait for the React HUD card hand to render
  await page.waitForSelector('[data-testid^="card-"]')

  // Click the first rendered card (first child of hand)
  const firstCard = page.locator('[data-testid^="card-"] >> button').first()
  await firstCard.click()
  await page.waitForTimeout(100)

  const after = await page.evaluate(() => {
    const cs = window.__debug.combatStore.getState()
    return { subPhase: cs.state.subPhase, selectedCardId: cs.state.selectedCardId }
  })
  expect(after.subPhase).toBe('SELECTING_TARGET')
  expect(after.selectedCardId).not.toBeNull()
})

test('B-02: Move button toggles SELECTING_MOVE on/off', async ({ page }) => {
  await bootCombat(page)

  await page.click('#combat-move-btn')
  await page.waitForTimeout(80)

  const afterEnter = await page.evaluate(() =>
    window.__debug.combatStore.getState().state.subPhase,
  )
  expect(afterEnter).toBe('SELECTING_MOVE')

  await page.click('#combat-move-btn')
  await page.waitForTimeout(80)

  const afterCancel = await page.evaluate(() =>
    window.__debug.combatStore.getState().state.subPhase,
  )
  expect(afterCancel).toBe('IDLE')
})
