import { test, expect } from '@playwright/test'

/**
 * Exercises the role-based enemy AI in a real combat scene.
 *
 * Flow: navigate to ?view=combat (URL hack seeds a stub battle), capture
 * the initial unit positions, end the player turn, wait for the enemy
 * turn to resolve, then assert at least one enemy unit moved or attacked.
 */
test.describe('Enemy AI in combat', () => {
  test('AI moves or attacks during the enemy turn', async ({ page }) => {
    await page.goto('/?view=combat')
    await page.waitForSelector('#combat-hud', { timeout: 10000 })
    // Wait for the BoardScene to seed units into combatStore
    await page.waitForFunction(
      () => {
        const debug = (window as unknown as { __debug?: { combatStore?: { getState: () => { state: { units: Record<string, unknown> } } } } }).__debug
        const cs = debug?.combatStore
        if (!cs) return false
        return Object.keys(cs.getState().state.units).length > 0
      },
      { timeout: 10000 },
    )

    // Snapshot enemy positions + party HP before ending turn.
    const before = await page.evaluate(() => {
      const debug = (window as unknown as { __debug: { combatStore: { getState: () => { state: { turn: { team: string; unitId: string }; units: Record<string, { id: string; classId: string; hp: { current: number; max: number }; position: string | null }> } } } } }).__debug
      const state = debug.combatStore.getState().state
      return {
        turnTeam: state.turn.team,
        turnUnitId: state.turn.unitId,
        units: Object.values(state.units).map((u) => ({
          id: u.id, classId: u.classId, hp: u.hp.current, position: u.position,
        })),
      }
    })

    expect(before.turnTeam).toBe('party')

    // Click End Turn for every party unit until enemy team takes over.
    for (let i = 0; i < 10; i++) {
      const team = await page.evaluate(() => {
        const debug = (window as unknown as { __debug: { combatStore: { getState: () => { state: { turn: { team: string } } } } } }).__debug
        return debug.combatStore.getState().state.turn.team
      })
      if (team === 'enemy') break
      await page.click('text=/end turn/i').catch(() => undefined)
      await page.waitForTimeout(300)
    }

    // Wait up to ~6s for the AI to complete its turn (multiple enemy moves +
    // animations). When the team flips back to 'party', the AI is done.
    await page.waitForFunction(
      () => {
        const debug = (window as unknown as { __debug: { combatStore: { getState: () => { state: { turn: { team: string } } } } } }).__debug
        return debug.combatStore.getState().state.turn.team === 'party'
      },
      { timeout: 20000 },
    )

    const after = await page.evaluate(() => {
      const debug = (window as unknown as { __debug: { combatStore: { getState: () => { state: { units: Record<string, { id: string; classId: string; hp: { current: number; max: number }; position: string | null }> } } } } }).__debug
      const state = debug.combatStore.getState().state
      return {
        units: Object.values(state.units).map((u) => ({
          id: u.id, classId: u.classId, hp: u.hp.current, position: u.position,
        })),
      }
    })

    // At least one enemy moved (position changed) OR at least one party unit
    // took damage (hp dropped) — proof the AI did something this turn.
    const enemiesMoved = after.units.some((a) => {
      const b = before.units.find((x) => x.id === a.id)
      return b && a.classId.includes('bandit') && b.position !== a.position
    })
    const partyDamaged = after.units.some((a) => {
      const b = before.units.find((x) => x.id === a.id)
      return b && !a.classId.includes('bandit') && a.hp < b.hp
    })

    expect(enemiesMoved || partyDamaged).toBe(true)
  })
})
