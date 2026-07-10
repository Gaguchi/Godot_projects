/**
 * Regression: the Phaser canvas must survive combat → overworld → combat.
 *
 * The canvas is parented into #game-canvas-container ONCE at boot (main.tsx).
 * That container used to render only while view === 'combat', so leaving
 * combat destroyed the canvas with it and every later battle drew into a
 * detached canvas — an invisible board over a black void. The container is
 * now permanently mounted (visibility-toggled); this spec locks that in by
 * running two battles in one page session and asserting the board is really
 * attached and populated both times.
 */
import { test, expect, type Page } from '@playwright/test'

type DebugApi = {
  combatStore: {
    getState(): {
      state: {
        phase: string
        units: Record<string, { id: string; team?: string; classId: string; hp: { current: number }; position: string | null }>
      }
      dispatch(e: unknown, rng?: unknown): void
    }
  }
  runStore: { getState(): { dispatch(e: unknown): void; pendingDialogue: unknown } }
}
// NOTE: page.evaluate/waitForFunction callbacks are serialized into the
// browser — they must self-contain the __debug accessor (no outer closures).

/** The board is "really there": canvas attached under the visible container
 *  and the combat scene display list actually holds tiles/units. */
async function expectBoardAttached(page: Page): Promise<void> {
  const board = await page.evaluate(() => {
    const container = document.getElementById('game-canvas-container')
    const canvas = container?.querySelector('canvas') ?? null
    const scene = (window as unknown as { __game?: { scene: { scenes: { children: { list: unknown[] } }[] } } }).__game?.scene.scenes[0]
    return {
      canvasInDom: !!canvas,
      containerVisible: container ? getComputedStyle(container).visibility : null,
      sceneChildren: scene?.children.list.length ?? 0,
    }
  })
  expect(board.canvasInDom).toBe(true)
  expect(board.containerVisible).toBe('visible')
  expect(board.sceneChildren).toBeGreaterThan(50)
}

/** Kill every enemy via sanctioned playCard dispatches from the active unit. */
async function winBattle(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __debug?: DebugApi }).__debug?.combatStore?.getState().state.phase === 'COMBAT')
  await page.evaluate(() => {
    const dbg = (window as unknown as { __debug: DebugApi }).__debug as unknown as DebugApi
    const s = dbg.combatStore.getState().state
    const isEnemy = (u: { team?: string; classId: string }): boolean =>
      u.team ? u.team === 'enemy' : ['bandit', 'brigand', 'wolf', 'warlord'].some(f => u.classId.includes(f))
    const partyId = Object.values(s.units).find(u => !isEnemy(u) && u.hp.current > 0)!.id
    for (const u of Object.values(s.units)) {
      if (!isEnemy(u) || u.hp.current <= 0 || !u.position) continue
      dbg.combatStore.getState().dispatch({
        type: 'playCard',
        payload: {
          cardId: 'e2e_resolve',
          srcId: partyId,
          targets: [u.position],
          card: { apCost: 0, targetKind: 'enemy', effects: [{ kind: 'Damage', params: { base: 999 } }] },
        },
      })
      dbg.combatStore.getState().dispatch({ type: 'animationsCompleted' })
    }
  })
  await page.waitForFunction(() => (window as unknown as { __debug: DebugApi }).__debug.combatStore.getState().state.phase === 'VICTORY')
}

test('board renders in a SECOND battle after returning to the overworld', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // Battle 1: tutorial via New Game.
  await page.goto('/')
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.waitForFunction(() => (window as unknown as { __debug?: DebugApi }).__debug?.combatStore?.getState().state.phase === 'COMBAT')
  await page.waitForTimeout(1000) // walk-in/settle
  await expectBoardAttached(page)

  await winBattle(page)
  await page.locator('#battle-end-continue').click()

  // Overworld: canvas must survive, hidden not destroyed.
  await page.waitForTimeout(500)
  const between = await page.evaluate(() => {
    const container = document.getElementById('game-canvas-container')
    return {
      canvasInDom: !!container?.querySelector('canvas'),
      containerVisible: container ? getComputedStyle(container).visibility : null,
    }
  })
  expect(between.canvasInDom).toBe(true)
  expect(between.containerVisible).toBe('hidden')

  // Click through the prologue so the overworld is interactive.
  for (let i = 0; i < 40; i++) {
    const btn = page.locator('#dialogue-modal button').first()
    if (!(await btn.isVisible().catch(() => false))) break
    await btn.click()
    await page.waitForTimeout(120)
  }

  // Battle 2: routed exactly like a dialogue startCombat effect.
  await page.evaluate(() => {
    const dbg = (window as unknown as { __debug: DebugApi }).__debug as unknown as DebugApi
    dbg.runStore.getState().dispatch({
      type: 'applyQuestEffects',
      payload: { effects: [{ kind: 'startCombat', enemyGroupId: 'brigands' }] },
    })
  })
  await page.waitForFunction(() => (window as unknown as { __debug: DebugApi }).__debug.combatStore.getState().state.phase === 'COMBAT')
  await page.waitForTimeout(1200) // walk-in/settle
  await expectBoardAttached(page)

  expect(errors).toEqual([])
})
