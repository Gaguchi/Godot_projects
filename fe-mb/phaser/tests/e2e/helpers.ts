import { type Page } from '@playwright/test'

export interface CombatStateShape {
  phase: string
  subPhase: string
  selectedCardId: string | null
  turn: { number: number; unitId: string | null; team: string }
  units: Record<string, {
    id: string
    name: string
    position?: string
    ap: number
    hp: { current: number; max: number }
    hasMovedThisTurn?: boolean
  }>
  decks: Record<string, { hand: string[]; draw: string[]; discard: string[] }>
}

declare global {
  interface Window {
    __debug: {
      combatStore: { getState: () => { state: CombatStateShape; dispatch: (e: unknown, r: unknown) => void } }
    }
  }
}

export async function fireMouse(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('canvas')
    if (!canvas) throw new Error('no canvas')
    const fire = (type: string): void => {
      canvas.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window, button: 0, buttons: 1,
        clientX: x, clientY: y, screenX: x, screenY: y, relatedTarget: null,
      }))
    }
    fire('mousemove'); fire('mousedown'); fire('mouseup'); fire('click')
  }, { x, y })
}

export async function bootCombat(page: Page): Promise<void> {
  await page.goto('http://localhost:5173?view=combat')
  await page.waitForFunction(() => window.__debug?.combatStore?.getState().state.phase === 'COMBAT')
  await page.waitForFunction(() => document.querySelector('canvas') !== null)
}
