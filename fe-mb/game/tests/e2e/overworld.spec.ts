import { test, expect, type Page } from '@playwright/test'
import { clippedText, errorsOf, offStage } from './probes'

/**
 * The map's own rules (BRIEF §2.9, §5, §10), which nothing covered before:
 *   · clicking the node the company stands on re-enters it — no hop, no food, no day
 *   · a camera pan that begins and ends over a node is a pan, never a click, and never latches the next one
 *   · the walking pill counts the legs that are LEFT, the leg in flight included exactly once
 *   · at the shipped party cap of 6 the band still fits the stage and no name is cut without recovery
 *   · low supplies are never signalled by colour alone
 *   · no place-name touches a mark, another name or a road, at any camera position (GATE2-4, GATE3-10)
 *   · the company token never hides the mark it is standing on
 */

interface Handle {
  getState: () => {
    run: {
      nodeId: string
      daysElapsed: number
      pendingTravel: { path: string[]; hopsTotal: number; status: string } | null
      party: Record<string, unknown>
      partyOrder: string[]
      bag: unknown[]
    } | null
  }
  dispatch: (a: unknown) => void
  runtime: { setPaused: (b: boolean) => void }
  settled: () => Promise<void>
}
const MAP = '/?screen=overworld&seed=3&motion=0'
const read = async (page: Page): Promise<{ node: string; day: number; travel: { path: string[]; hopsTotal: number; status: string } | null }> =>
  page.evaluate(() => {
    const s = (window as unknown as { __game: Handle }).__game.getState()
    return { node: s.run?.nodeId ?? '', day: s.run?.daysElapsed ?? -1, travel: s.run?.pendingTravel ?? null }
  })

test('clicking the current node reopens its card — no hop, no food, no day', async ({ page }) => {
  const errors = errorsOf(page)
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  // walk one hop and land, then dismiss the card with Stay — the state the player used to be stranded in
  await page.getByTestId('node-riverside_market').click()
  await expect(page.getByTestId('node-card')).toContainText(/Riverside Market/)
  await page.getByTestId('menu-stay').click()
  await expect(page.getByTestId('node-card')).toHaveCount(0)

  const before = await read(page)
  const food = await page.getByTestId('band-food').innerText()

  // the node underfoot answers the click: `startTravel` gives a zero-length path, so the card comes back and
  // nothing is spent (BRIEF §2.9 "clicking the current node re-enters it with no hop and no food")
  await page.getByTestId(`node-${before.node}`).click()
  await expect(page.getByTestId('node-card')).toBeVisible()
  const after = await read(page)
  expect(after.node).toBe(before.node)
  expect(after.day).toBe(before.day)
  expect(after.travel?.hopsTotal).toBe(0)
  expect(after.travel?.status).toBe('atNode')
  expect(await page.getByTestId('band-food').innerText()).toBe(food)
  expect(errors).toEqual([])
})

test('a pan that starts on a node is a pan, and never latches the next click', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  expect((await read(page)).travel).toBeNull()

  const node = page.getByTestId('node-riverside_market')
  const box = (await node.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx - 120, cy - 60, { steps: 12 })
  await page.mouse.move(cx, cy, { steps: 12 })
  await page.mouse.up()

  // the company has not taken a step, and the pill is not up
  expect((await read(page)).travel).toBeNull()
  await expect(page.getByTestId('walking')).toHaveCount(0)

  // ...and one drag never latches later clicks: the very next plain click travels
  await node.click()
  expect((await read(page)).travel).not.toBeNull()
})

test('the walking pill counts the hops that are left, the leg in flight included once', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  // pause the pump so the first hop stays in flight, then read the engine and the pill side by side
  const hops = await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    g.runtime.setPaused(true)
    g.dispatch({ type: 'travel/goTo', nodeId: 'old_mill_crossing' })
    return g.getState().run?.pendingTravel?.path.length ?? 0
  })
  expect(hops).toBeGreaterThan(1)
  await expect(page.getByTestId('walking')).toHaveText(new RegExp(`${hops} hops to go`))
  await page.evaluate(() => { (window as unknown as { __game: Handle }).__game.runtime.setPaused(false) })
})

test('at the party cap of 6 the band keeps every control on the stage and every name recoverable', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: { party: Record<string, { id: string; name: string }>; partyOrder: string[] } }
    const template = s.run.party['oak']!
    const party = { ...s.run.party }
    const partyOrder = [...s.run.partyOrder]
    const names = ['Wilhelmina Thornbury', 'Aurelia Vantranchett', 'Bartholomew Ashgrove']
    names.forEach((name, i) => {
      const id = `extra_${i}`
      party[id] = { ...template, id, name }
      partyOrder.push(id)
    })
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, party, partyOrder, mcName: 'Wilhelmina Thornbury', companyName: 'The Ashenford Free Company' } } })
  })
  await expect(page.getByTestId('ledger-band').locator('.ow-face')).toHaveCount(6)

  // the Esc/Menu chip is the only route to Pause and Save & quit: it may never be pushed off the stage
  expect(await offStage(page, '.ow-band')).toEqual([])
  await expect(page.getByTestId('band-menu')).toBeVisible()
  // a cut name is allowed; a cut name with no way to read it is not
  expect(await clippedText(page, '.ow-band')).toEqual([])
})

test('low supplies are not signalled by colour alone', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  const food = page.getByTestId('band-food')
  await expect(food.locator('svg')).toHaveCount(0)

  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: { bag: { itemId: string }[] } }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, bag: s.run.bag.filter((b) => b.itemId !== 'food_rations') } } })
  })
  await expect(food).toHaveText('0')
  // a sigil AND a sentence, not just a red numeral
  await expect(food.locator('svg')).toHaveCount(1)
  await expect(food).toHaveAttribute('aria-label', /no rations/i)
})

test('no place-name touches a mark, another name or a road — at any camera position', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  // The sheet is measured, not eyeballed: every rendered name box against every drawn disc, every other name box,
  // and the REAL svg geometry of every road (sampled with getPointAtLength, so the bowed curve is what is tested).
  // GATE2-4 counted twelve of these at the default camera; GATE3-10 saw them from the chair.
  const sweep = async (): Promise<readonly string[]> => page.evaluate(() => {
    const world = document.querySelector('.ow-world')!.getBoundingClientRect()
    const local = (r: DOMRect): { x: number; y: number; w: number; h: number } => ({ x: r.x - world.x, y: r.y - world.y, w: r.width, h: r.height })
    const marks = Array.from(document.querySelectorAll('.ow-node')).map((n) => ({
      id: n.getAttribute('data-testid') ?? '',
      name: (n.querySelector('.ow-node__label')?.textContent ?? '').trim(),
      mark: local(n.querySelector('.ow-node__mark')!.getBoundingClientRect()),
      label: local(n.querySelector('.ow-node__label')!.getBoundingClientRect()),
    }))
    const box = { x: 0, y: 0, w: 0, h: 0 }
    const hits = (a: typeof box, b: typeof box): boolean =>
      Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y)
    const out: string[] = []
    for (let i = 0; i < marks.length; i++) {
      const a = marks[i]!
      for (let j = i + 1; j < marks.length; j++) {
        if (hits(a.label, marks[j]!.label)) out.push(`name x name: ${a.name} / ${marks[j]!.name}`)
      }
      for (const m of marks) {
        // the drawn disc/ring is 46 of the 52px mark box; inset so a name may sit right beside a mark
        const disc = { x: m.mark.x + 3, y: m.mark.y + 3, w: m.mark.w - 6, h: m.mark.h - 6 }
        if (m.id !== a.id && hits(a.label, disc)) out.push(`name x mark: ${a.name} / ${m.name}`)
      }
    }
    for (const path of Array.from(document.querySelectorAll<SVGPathElement>('.ow-roads path'))) {
      const len = path.getTotalLength()
      for (let s = 0; s <= len; s += Math.max(2, len / 240)) {
        const pt = path.getPointAtLength(s)
        for (const m of marks) {
          const b = m.label
          if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
            const msg = `name x road: ${m.name}`
            if (!out.includes(msg)) out.push(msg)
          }
        }
      }
    }
    return out
  })

  expect(await sweep()).toEqual([])
  // ...and the plan is sheet-space, so panning the camera can neither create a collision nor move a name
  const firstBoxes = await page.evaluate(() => Array.from(document.querySelectorAll('.ow-node')).map((n) => {
    const w = document.querySelector('.ow-world')!.getBoundingClientRect()
    const r = n.querySelector('.ow-node__label')!.getBoundingClientRect()
    return `${n.getAttribute('data-testid')}:${Math.round(r.x - w.x)},${Math.round(r.y - w.y)}`
  }))
  for (const pan of [{ x: 0, y: 0 }, { x: 760, y: 60 }, { x: 1500, y: 220 }, { x: 1780, y: 330 }]) {
    await page.evaluate((p) => { (window as unknown as { __game: Handle }).__game.dispatch({ type: 'ui/setMapPan', pan: p }) }, pan)
    expect(await sweep(), `camera ${pan.x},${pan.y}`).toEqual([])
    const boxes = await page.evaluate(() => Array.from(document.querySelectorAll('.ow-node')).map((n) => {
      const w = document.querySelector('.ow-world')!.getBoundingClientRect()
      const r = n.querySelector('.ow-node__label')!.getBoundingClientRect()
      return `${n.getAttribute('data-testid')}:${Math.round(r.x - w.x)},${Math.round(r.y - w.y)}`
    }))
    expect(boxes).toEqual(firstBoxes)
  }
})

/** Let React commit, then let every transition it started actually finish, before the paint is read. */
const settle = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  })
}

/**
 * RE-GATE C 3.20 — the sheet is 3060x850 behind a 1280x600 window, and the window used to end in a hard cut:
 * "Cursed Clearing" printed as a bare "CUR" at x = 1280, with nothing anywhere saying the map could be moved.
 * It did not trip the typography sweep because it is not `text-overflow: ellipsis` — it is the frame's own clip.
 */
test('the frame is a window, not a guillotine: no name is sliced by it, and it says there is more sheet', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  /** Every name the frame CUTS: on screen, but not wholly on it, and still lettered. */
  const sliced = async (): Promise<readonly string[]> => page.evaluate(() => {
    const vp = document.querySelector('[data-testid="map-viewport"]')!.getBoundingClientRect()
    const out: string[] = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.ow-node__label'))) {
      const r = el.getBoundingClientRect()
      const onScreen = r.right > vp.left && r.left < vp.right && r.bottom > vp.top && r.top < vp.bottom
      const whole = r.left >= vp.left - 0.5 && r.right <= vp.right + 0.5 && r.top >= vp.top - 0.5 && r.bottom <= vp.bottom + 0.5
      if (onScreen && !whole && Number(getComputedStyle(el).opacity) > 0.02) out.push((el.textContent ?? '').trim())
    }
    return out
  })
  /** Which sides of the frame declare there is more country behind them. */
  const shadows = async (): Promise<readonly string[]> => page.$$eval('.ow-edge__side', (els) => els.map((e) => e.className.replace(/.*--/, '')).sort())

  // the hint is up before the player has ever moved the sheet, and it names the gesture in words
  await expect(page.getByTestId('map-hint')).toBeVisible()
  await expect(page.getByTestId('map-hint')).toContainText(/drag/i)

  expect(await sliced(), 'a place-name amputated by the frame at the default camera').toEqual([])
  for (const pan of [{ x: 0, y: 0 }, { x: 900, y: 120 }, { x: 1500, y: 240 }, { x: 1780, y: 250 }, { x: 2400, y: 60 }]) {
    await page.evaluate((p) => { (window as unknown as { __game: Handle }).__game.dispatch({ type: 'ui/setMapPan', pan: p }) }, pan)
    await settle(page)
    expect(await sliced(), `camera ${pan.x},${pan.y}`).toEqual([])
    // and the shadow is the truth about the camera, never decoration: at the paper's own edge it lifts
    const sides = await shadows()
    if (pan.x <= 0) expect(sides, 'shadow on a side with no sheet behind it').not.toContain('l')
    else expect(sides, 'no shadow on a side that has more sheet behind it').toContain('l')
  }

  // hard against the sheet's right edge: the right side has nothing behind it and stops declaring that it does
  await page.evaluate(() => { (window as unknown as { __game: Handle }).__game.dispatch({ type: 'ui/setMapPan', pan: { x: 99999, y: 99999 } }) })
  await settle(page)
  const cornered = await shadows()
  expect(cornered).not.toContain('r')
  expect(cornered).not.toContain('b')
  expect(cornered).toContain('l')
  await page.screenshot({ path: '../.playwright-mcp/fix4-3.20-frame.png' })
})

test('the company never hides the mark it is standing on', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  // GATE3-10: at rest the pawn covered the top third of the sigil, so a town and a camp looked the same while you
  // were in one. The token stands clear of the disc AND is painted under it, so the sheet always outreads it.
  const read = async (): Promise<{ gap: number; pawnZ: number; nodeZ: number }> => page.evaluate(() => {
    const pawn = document.querySelector('[data-testid="pawn"]')!
    const node = document.querySelector('.ow-node--current')!
    const disc = node.querySelector('.ow-node__mark')!.getBoundingClientRect()
    const p = pawn.getBoundingClientRect()
    return {
      gap: disc.y + 3 - (p.y + p.height),
      pawnZ: Number(getComputedStyle(pawn).zIndex),
      nodeZ: Number(getComputedStyle(node).zIndex),
    }
  })
  const at = await read()
  expect(at.gap).toBeGreaterThanOrEqual(0)
  expect(at.pawnZ).toBeLessThan(at.nodeZ)
})

test('the card opens AT the place it names, and points back at it', async ({ page }) => {
  // RE-GATE C 3.11: the node card was pinned to the bottom centre of the stage whatever the player clicked —
  // measured at 562px from `node-riverside_market`, with three quarters of the map between the two.
  await page.goto('/?screen=overworld&seed=41&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  const distance = async (testId: string): Promise<{ d: number; dx: number; cardTop: number; markBottom: number }> =>
    page.evaluate((id) => {
      const stage = document.getElementById('game-stage')!.getBoundingClientRect()
      const s = stage.width / 1280
      const mark = document.querySelector(`[data-testid="${id}"] .ow-node__mark`)!.getBoundingClientRect()
      const card = document.querySelector('[data-testid="node-card"]')!.getBoundingClientRect()
      const mc = { x: (mark.left + mark.width / 2 - stage.left) / s, y: (mark.top + mark.height / 2 - stage.top) / s }
      const cc = { x: (card.left + card.width / 2 - stage.left) / s, y: (card.top + card.height / 2 - stage.top) / s }
      return { d: Math.hypot(cc.x - mc.x, cc.y - mc.y), dx: Math.abs(cc.x - mc.x), cardTop: (card.top - stage.top) / s, markBottom: (mark.bottom - stage.top) / s }
    }, testId)

  await page.getByTestId('node-riverside_market').click()
  await expect(page.getByTestId('node-card')).toBeVisible()
  const near = await distance('node-riverside_market')
  expect(near.d).toBeLessThan(220)
  expect(near.dx).toBeLessThan(40)          // same column as the mark, unless the clamp had to move it
  expect(near.cardTop).toBeGreaterThan(near.markBottom) // seated UNDER a mark in the upper half
  // the notch is on the card, pointing back at the mark
  const notch = await page.getByTestId('node-card').evaluate((el) => getComputedStyle(el, '::before').borderBottomWidth)
  expect(Number.parseFloat(notch)).toBeGreaterThan(0)
  await page.screenshot({ path: '../.playwright-mcp/fix3-3.11-node-card.png' })

  // the whole card stays on the stage even for a mark near the edge
  const box = await page.getByTestId('node-card').evaluate((el) => {
    const stage = document.getElementById('game-stage')!.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    return { left: b.left - stage.left, right: stage.right - b.right, top: b.top - stage.top, bottom: stage.bottom - b.bottom }
  })
  expect(box.left).toBeGreaterThanOrEqual(-0.5)
  expect(box.right).toBeGreaterThanOrEqual(-0.5)
  expect(box.top).toBeGreaterThanOrEqual(-0.5)
  expect(box.bottom).toBeGreaterThanOrEqual(-0.5)
})

test('the road line is a LEDGER reading, not chrome parked over the sheet', async ({ page }) => {
  // RE-GATE B 2.6: "On the road · 1 hop to go" was pinned top-centre of the map at (533-748, 134-160), covering
  // the North Ridge Path mark for the whole journey and butting into that node's name (signal E).
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    g.runtime.setPaused(true)
    g.dispatch({ type: 'travel/goTo', nodeId: 'old_mill_crossing' })
  })
  const pill = page.getByTestId('walking')
  await expect(pill).toBeVisible()
  // it lives inside the band, and nothing in the map viewport is chrome over the world
  expect(await pill.evaluate((el) => el.closest('[data-testid="ledger-band"]') !== null)).toBe(true)
  expect(await pill.evaluate((el) => el.closest('[data-testid="map-viewport"]') === null)).toBe(true)
  const overWorld = await page.evaluate(() => {
    const vp = document.querySelector('[data-testid="map-viewport"]')!.getBoundingClientRect()
    return Array.from(document.querySelectorAll('[data-testid="map-viewport"] > *'))
      .filter((el) => !el.classList.contains('ow-world'))
      // the frame's own shadow (`.ow-edge`) letters nothing and reads nothing; it is the window, not a panel
      .filter((el) => (el.textContent ?? '').trim() !== '')
      .map((el) => {
        const b = el.getBoundingClientRect()
        return { cls: String(el.className), text: (el.textContent ?? '').trim(), midY: (b.top + b.height / 2 - vp.top) / vp.height }
      })
  })
  // The frame may speak for ITSELF over the sheet — the first-time pan hint (3.20), the way back to the company —
  // but a LEDGER READING (the day, the purse, the larder, the hops that are left) belongs in the band.
  expect(overWorld.map((o) => o.cls).sort()).toEqual(['ow-hint'])
  for (const o of overWorld) expect(o.text, `a run reading parked over the sheet: ${o.cls}`).not.toMatch(/day|gold|food|ration|hop/i)
  await page.evaluate(() => { (window as unknown as { __game: Handle }).__game.runtime.setPaused(false) })
  await page.screenshot({ path: '../.playwright-mcp/fix3-2.6-walking.png' })
})

test('the ration is spent at the camp and READ on the map: every scouted road carries its mark, and the preview quotes it', async ({ page }) => {
  // RE-GATE C 3.9: Scout cost a ration and a camp action to produce a thirteen-row report readable ONLY while
  // standing at that camp. The sheet, the node card, the hover preview and the CLI all ignored `run.scoutedEdges`,
  // so the intel was gone by the time the road was chosen. It is now annotated onto the roads themselves.
  await page.goto('/?screen=camp&seed=21&motion=0')
  await page.getByTestId('camp-scout').click()
  const reported = await page.locator('.camp__report-row').count()
  expect(reported).toBeGreaterThan(0)

  await page.getByTestId('camp-leave').click()
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.getByTestId('menu-stay').click()
  await expect(page.getByTestId('node-card')).toHaveCount(0)

  // one mark per road the ration paid for, drawn ON the road (the same count the camp report printed)
  await expect(page.locator('[data-testid="scout-marks"] > g')).toHaveCount(reported)

  // …and the WORDS on the leg the pointer is asking about, before the click that spends the day
  const leg = await page.evaluate(() => {
    const s = (window as unknown as { __game: { getState: () => { run: { nodeId: string; scoutedEdges: Record<string, unknown> } | null } } }).__game.getState()
    const here = s.run!.nodeId
    const key = Object.keys(s.run!.scoutedEdges).find((k) => k.startsWith(`${here}->`))!
    return { here, to: key.slice(key.indexOf('->') + 2, key.lastIndexOf('#')) }
  })
  await page.getByTestId(`node-${leg.to}`).hover()
  const sighting = page.getByTestId('path-sighting').first()
  await expect(sighting).toBeVisible()
  await expect(sighting).toHaveText(/ · (The road is quiet|Armed men on the road|Someone waits by the road|Something on the road)$/)
  await page.screenshot({ path: '../.playwright-mcp/fix3-3.9-scouted-map.png' })

  // a road nobody walked down carries nothing: the mark is what was BOUGHT, not decoration on every edge
  const totalRoads = await page.evaluate(() => document.querySelectorAll('.ow-roads > g:first-child > path').length)
  expect(reported).toBeLessThan(totalRoads)
})

test('the way back to the company is legible on the paper it stands on', async ({ page }) => {
  // FINAL GATE B. `.ow-recentre` is the only strap in the game that sits on the SHEET rather than on leather, and
  // `.btn-forged--ghost` letters itself in `--color-parchment-dim` — bone at the document root. Bone on vellum:
  // the only way back to the party after a pan measured 1.36:1 across its own painted pixels (the band's chips
  // measure 14.5:1), which is a control the player cannot see. The ratio is taken off what the browser actually
  // PAINTS, because the defect was a token inherited from an ancestor, not a value written on the rule.
  const painted = async (locator: ReturnType<Page['locator']>): Promise<number> => {
    const shot = (await locator.screenshot()).toString('base64')
    return page.evaluate(async (b64) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      const channel = (v: number): number => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
      const ls: number[] = []
      for (let i = 0; i < data.length; i += 4) ls.push(0.2126 * channel(data[i]!) + 0.7152 * channel(data[i + 1]!) + 0.0722 * channel(data[i + 2]!))
      ls.sort((a, b) => a - b)
      // 3rd/97th percentile: the ink and the ground, with the antialiased rim of every letter discounted
      const lo = ls[Math.floor(ls.length * 0.03)]!
      const hi = ls[Math.floor(ls.length * 0.97)]!
      return (hi + 0.05) / (lo + 0.05)
    }, shot)
  }

  await page.goto('/?screen=overworld&seed=41&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => { (window as unknown as { __game: { dispatch: (a: unknown) => void } }).__game.dispatch({ type: 'ui/setMapPan', pan: { x: -400, y: 40 } }) })
  const recentre = page.locator('.ow-recentre')
  await expect(recentre).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready })

  expect(await painted(recentre), 'the control that finds the company is painted in one flat tone').toBeGreaterThan(3)
  // it takes the PAPER ramp, the way `.page-canvas` does — not the leather bone it used to inherit
  const ink = await recentre.evaluate((el) => getComputedStyle(el).color)
  expect(ink).not.toBe('rgb(213, 200, 173)')
  // …and it still recedes: a ghost on the sheet, never a second primary next to the band's chips
  expect(await recentre.evaluate((el) => el.className)).toContain('btn-forged--ghost')
})


/**
 * RE-GATE C 3.14 — the dungeon mouth warns before it commits the company (0113) and the LAST door had nothing at
 * all: `Challenge the throne` over an empty card. Who waits, and what is behind the door, is read BEFORE the verb.
 */
test('the last door names who holds it, and says there is nothing behind it', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=7&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  const bossId = await page.evaluate(() => {
    const g = window.__game!
    const node = g.env.content.overworld.nodes.find((n: { type: string }) => n.type === 'BOSS')!
    g.dispatch({ type: 'dev/teleport', nodeId: node.id })
    g.dispatch({ type: 'travel/goTo', nodeId: node.id })
    return node.id as string
  })
  await page.evaluate(() => window.__game!.settled())
  const card = page.getByTestId('node-card')
  await expect(card).toBeVisible()
  const warning = page.getByTestId('throne-warning')
  await expect(warning).toBeVisible()
  const said = (await warning.textContent())?.trim() ?? ''
  // Named, and warned: the company, the man who leads it, the place, and the two facts that make it the LAST door.
  expect(said).toContain('The Ashford Company')
  expect(said).toContain('Mercer Kaine')
  expect(said).toContain('The Iron Throne')
  expect(said).toContain('no retreat')
  expect(said).toContain('no inn')
  expect(said).not.toContain(bossId)
  // …over a verb that is still lit, the way the descent's mouth is
  await expect(page.getByTestId('menu-boss')).not.toHaveAttribute('aria-disabled', 'true')
  await page.screenshot({ path: '../.playwright-mcp/fix4-3.14-throne-door.png' })

  // and nowhere else: the market's card is a market's card
  await page.evaluate(() => {
    const g = window.__game!
    g.dispatch({ type: 'dev/teleport', nodeId: 'riverside_market' })
    g.dispatch({ type: 'travel/goTo', nodeId: 'riverside_market' })
  })
  await page.evaluate(() => window.__game!.settled())
  await expect(page.getByTestId('node-card')).toBeVisible()
  await expect(page.getByTestId('throne-warning')).toHaveCount(0)
})
