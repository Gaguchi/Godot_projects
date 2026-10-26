/**
 * ui/timings.ts — the host's pacing knobs. The engine never carries milliseconds (effects are semantic); the
 * scheduler waits for the effect consumer to settle, then these delays. Zero under reduced motion, `?motion=0`,
 * and Playwright (which sets `?motion=0`), so e2e runs and screenshots never race an animation.
 *
 * It also stamps `data-motion="off"` on the document element, which is the CSS half of the same switch
 * (`styles/index.css`, "Reduced motion — ONE gate, two triggers"). Without it `?motion=0` zeroed only the pump
 * delays while every screen still faded in over `--dur-settle`, so a screenshot taken the instant a screen
 * became visible caught the panel at opacity 0 — and any visual snapshot of a navigated screen was a coin flip.
 */
export const HOP_DELAY_MS = 700
export const ENEMY_STEP_MS = 450

let forcedZero = false

/** Called once at boot with the URL; also honours the OS reduced-motion preference. */
export function configureMotion(search: string, reducedMotion: boolean): void {
  forcedZero = reducedMotion || new URLSearchParams(search).get('motion') === '0'
  // the CSS half of the switch; guarded so the module stays importable from node (the CLI never renders)
  if (typeof document === 'undefined') return
  if (forcedZero) document.documentElement.setAttribute('data-motion', 'off')
  else document.documentElement.removeAttribute('data-motion')
}

export function motionEnabled(): boolean {
  return !forcedZero
}

export function delayFor(pump: 'travel/step' | 'combat/enemyStep'): number {
  if (forcedZero) return 0
  return pump === 'travel/step' ? HOP_DELAY_MS : ENEMY_STEP_MS
}
