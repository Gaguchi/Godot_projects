/**
 * tests/e2e/probes.ts — the sweeps every screen spec runs, in one place: console errors, chrome that leaves the
 * 1280×720 stage, and real content cut off with no way to recover it. They are assertions about the RULES
 * (ARCHITECTURE §5, BRIEF §5), not about any one screen, so they belong to a helper rather than to a copy in each
 * spec. Not a `*.spec.ts`, so Playwright never collects it as a test file.
 */
import type { Page } from '@playwright/test'

/** Collect console errors + page errors for the life of the page. Attach BEFORE `goto`. */
export function errorsOf(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

export interface OffStage { readonly testId: string | null; readonly cls: string; readonly text: string; readonly overBy: number }

/** Every visible element under `root` that pokes out of the stage's left or right edge (the stage clips, so an
 *  off-stage control is simply gone — the Esc/Menu chip at a 6-strong party was 24px past the edge). */
export async function offStage(page: Page, root: string): Promise<readonly OffStage[]> {
  return page.evaluate((sel) => {
    const stage = document.getElementById('game-stage')
    const host = document.querySelector(sel)
    if (stage === null || host === null) return []
    const bounds = stage.getBoundingClientRect()
    const out: { testId: string | null; cls: string; text: string; overBy: number }[] = []
    for (const el of Array.from(host.querySelectorAll('*'))) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      if (getComputedStyle(el).visibility === 'hidden') continue
      const overBy = Math.max(box.right - bounds.right, bounds.left - box.left)
      if (overBy > 0.5) out.push({ testId: el.getAttribute('data-testid'), cls: String(el.className), text: (el.textContent ?? '').trim().slice(0, 40), overBy: Math.round(overBy) })
    }
    return out
  }, root)
}

export interface Clipped { readonly cls: string; readonly text: string; readonly cutBy: number }

/** Leaf text that its own box cuts off. A name the player chose or a place they can travel to is content: it may
 *  ellipsise, but never without a way to read it — and since the native `title=` recovery is banned outright
 *  (`ui/components/Tooltip` is the surface now), a cut string with nothing on the glass beside it is simply a cut
 *  string. `data-tip` marks a leaf whose full text a reason bubble carries. */
export async function clippedText(page: Page, root = '#game-stage'): Promise<readonly Clipped[]> {
  return page.evaluate((sel) => {
    const host = document.querySelector(sel)
    if (host === null) return []
    const out: { cls: string; text: string; cutBy: number }[] = []
    for (const el of Array.from(host.querySelectorAll('*'))) {
      const he = el as HTMLElement
      if (he.children.length > 0) continue
      const text = (he.textContent ?? '').trim()
      if (text === '') continue
      const cs = getComputedStyle(he)
      if (cs.overflowX === 'visible') continue
      const cutBy = he.scrollWidth - he.clientWidth
      if (cutBy > 1 && he.dataset.tip === undefined) out.push({ cls: String(he.className), text, cutBy })
    }
    return out
  }, root)
}

export interface Void { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly area: number }

/**
 * The largest empty axis-aligned rectangle inside an element — the measurable form of crafting-game-ui signal E,
 * "dead space (tiny widgets in a void)". GATE2-16 named six screens by eye; this is the number behind that eye.
 *
 * Occupancy is sampled on a 16px grid over the host's box: every visible descendant marks the cells it covers,
 * except one as large as the host itself (a scrim, a grain layer, a full-bleed background tells us nothing about
 * whether the space is composed). The answer is the biggest all-empty rectangle, by the classic largest-rectangle
 * -in-a-histogram sweep, reported in stage pixels.
 */
export async function largestVoid(page: Page, selector: string): Promise<Void> {
  return page.evaluate((sel) => {
    const CELL = 16
    const host = document.querySelector(sel)
    if (host === null) throw new Error(`largestVoid: no element for '${sel}'`)
    const box = host.getBoundingClientRect()
    const cols = Math.max(1, Math.floor(box.width / CELL))
    const rows = Math.max(1, Math.floor(box.height / CELL))
    const grid = new Uint8Array(cols * rows)
    for (const el of Array.from(host.querySelectorAll('*'))) {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue
      const r = el.getBoundingClientRect()
      if (r.width < 3 || r.height < 3) continue
      if (r.width > box.width * 0.92 && r.height > box.height * 0.92) continue
      const c0 = Math.max(0, Math.floor((r.left - box.left) / CELL))
      const c1 = Math.min(cols, Math.ceil((r.right - box.left) / CELL))
      const r0 = Math.max(0, Math.floor((r.top - box.top) / CELL))
      const r1 = Math.min(rows, Math.ceil((r.bottom - box.top) / CELL))
      for (let y = r0; y < r1; y++) for (let x = c0; x < c1; x++) grid[y * cols + x] = 1
    }
    // largest rectangle of zeros: per-row histogram of empty cells above, then a stack sweep per row
    const heights = new Int32Array(cols)
    let best = { x: 0, y: 0, w: 0, h: 0, area: 0 }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) heights[x] = grid[y * cols + x] === 1 ? 0 : (heights[x] ?? 0) + 1
      const stack: number[] = []
      for (let x = 0; x <= cols; x++) {
        const h = x === cols ? 0 : heights[x]!
        while (stack.length > 0 && heights[stack[stack.length - 1]!]! >= h) {
          const top = stack.pop()!
          const left = stack.length === 0 ? 0 : stack[stack.length - 1]! + 1
          const width = x - left
          const height = heights[top]!
          const area = width * height
          if (area > best.area) best = { x: left, y: y - height + 1, w: width, h: height, area }
        }
        stack.push(x)
      }
    }
    return { x: best.x * CELL, y: best.y * CELL, w: best.w * CELL, h: best.h * CELL, area: best.w * best.h * CELL * CELL }
  }, selector)
}
