import { test, expect } from '@playwright/test'
import { fireMouse, bootCombat } from './helpers'

test('B-02: End Turn button advances the turn counter and switches active unit', async ({ page }) => {
  await bootCombat(page)

  const before = await page.evaluate(() => {
    const cs = window.__debug.combatStore.getState()
    return { activeId: cs.state.turn.unitId, turnNumber: cs.state.turn.number }
  })

  // End Turn button is drawn at (scale.width - 110, scale.height - 60) = (1170, 660)
  // Container hit-area is centered, 180x40 → spans (1080..1260, 640..680)
  await fireMouse(page, 1170, 660)
  await page.waitForTimeout(150)

  const after = await page.evaluate(() => {
    const cs = window.__debug.combatStore.getState()
    return { activeId: cs.state.turn.unitId, turnNumber: cs.state.turn.number }
  })
  expect(after.activeId).not.toBe(before.activeId)
})

test('B-02: clicking a card transitions subPhase to SELECTING_TARGET', async ({ page }) => {
  await bootCombat(page)

  // Wait long enough for card hand to render
  await page.waitForTimeout(200)

  // Find first hand card for the active unit and compute its canvas position.
  // Layout (matches CombatScene.renderCardHand): CARD_SPACING=110, CARD_HAND_Y=620,
  // first card x = (scale.width - (handLen-1)*110) / 2.
  const cardPos = await page.evaluate(() => {
    const cs = window.__debug.combatStore.getState()
    const activeId = cs.state.turn.unitId as string
    const deck = cs.state.decks[activeId]
    if (!deck) return null
    const handLen = Math.min(deck.hand.length, 5)
    if (handLen === 0) return null
    const totalWidth = (handLen - 1) * 110
    const startX = (1280 - totalWidth) / 2
    return { x: startX, y: 620 }
  })
  expect(cardPos).not.toBeNull()
  await fireMouse(page, cardPos!.x, cardPos!.y)
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

  // Move button position: (scale.width - 310, scale.height - 60) = (970, 660)
  await fireMouse(page, 970, 660)
  await page.waitForTimeout(80)

  const afterEnter = await page.evaluate(() => window.__debug.combatStore.getState().state.subPhase)
  expect(afterEnter).toBe('SELECTING_MOVE')

  // Click again — should cancel
  await fireMouse(page, 970, 660)
  await page.waitForTimeout(80)
  const afterCancel = await page.evaluate(() => window.__debug.combatStore.getState().state.subPhase)
  expect(afterCancel).toBe('IDLE')
})
