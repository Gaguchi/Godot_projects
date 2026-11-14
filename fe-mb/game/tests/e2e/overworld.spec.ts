import { test, expect, type Page } from '@playwright/test'
import { clippedText, errorsOf, offStage } from './probes'

/**
 * The map's own rules (BRIEF §2.9, §5, §10), which nothing covered before:
 *   · clicking the node the company stands on re-enters it — no hop, no food, no day
 *   · a camera pan that begins and ends over a node is a pan, never a click, and never latches the next one
 *   · the walking line counts the legs that are LEFT, the leg in flight included exactly once
 *   · at the shipped party cap of 6 the windows still fit the stage and no name is cut without recovery
 *   · low supplies are never signalled by colour alone
 *   · no plate or name is cut by the frame, covered by a window or laid on another, at any camera (GATE2-4, GATE3-10)
 *   · the company never stands on the name of the place it is at
 * Ported to the Filigree map over the drawn country on 2026-11-14 (owner: a vertical slice); each rule kept.
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

test('at the party cap of 6 the windows keep every control on the stage and every name recoverable', async ({ page }) => {
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
  // the company window grows a row a head; six rows still stand clear of the region window above it
  await expect(page.getByTestId('company-window').locator('.fniche')).toHaveCount(6)
  const gap = await page.evaluate(() => document.querySelector('[data-testid="company-window"]')!.getBoundingClientRect().top - document.querySelector('[data-testid="ledger-band"]')!.getBoundingClientRect().bottom)
  expect(gap).toBeGreaterThan(0)

  // the Esc/Menu row is the only route to Pause and Save & quit: it may never be pushed off the stage
  expect(await offStage(page, '.fmap-hud')).toEqual([])
  await expect(page.getByTestId('band-menu')).toBeVisible()
  // a cut name is allowed; a cut name with no way to read it is not
  expect(await clippedText(page, '.fmap-hud')).toEqual([])
})

test('low supplies are not signalled by colour alone', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  const food = page.getByTestId('band-food')
  await expect(page.getByTestId('band-food-low')).toHaveCount(0)

  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: { bag: { itemId: string }[] } }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, bag: s.run.bag.filter((b) => b.itemId !== 'food_rations') } } })
  })
  await expect(food).toHaveText('0')
  // a mark AND words, not just a red numeral: the kit's refusal mark beside the count, and the sentence on the count
  await expect(page.getByTestId('band-food-low')).toHaveText(/none left/)
  expect(await page.getByTestId('band-food-low').evaluate((el) => getComputedStyle(el, '::before').backgroundImage)).toMatch(/^url\(/)
  await expect(food).toHaveAttribute('aria-label', /no rations/i)
})

/** Every plate, name, window and the company on the stage, as boxes in stage px. */
interface Lettering {
  readonly plates: readonly { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[]
  readonly names: readonly { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[]
  readonly windows: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number }[]
}
const lettering = async (page: Page): Promise<Lettering> => page.evaluate(() => {
  const stage = document.getElementById('game-stage')!.getBoundingClientRect()
  const s = stage.width / 1280
  const box = (el: Element): { x: number; y: number; w: number; h: number } => {
    const r = el.getBoundingClientRect()
    return { x: (r.left - stage.left) / s, y: (r.top - stage.top) / s, w: r.width / s, h: r.height / s }
  }
  const on = (b: { x: number; y: number; w: number; h: number }): boolean => b.x + b.w > 0 && b.x < 1280 && b.y + b.h > 0 && b.y < 720
  // a name's box is its LETTERS, not the layout box it is centred in
  const letters = (el: Element): { x: number; y: number; w: number; h: number } => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return box(range as unknown as Element)
  }
  return {
    plates: Array.from(document.querySelectorAll('.fmap-world .fw--tag, .fmap-world .fw--taglit')).map((el) => ({ name: (el.textContent ?? '').trim(), ...box(el) })).filter(on),
    names: Array.from(document.querySelectorAll('.fmap-world .fmap-name')).map((el) => ({ name: (el.textContent ?? '').trim(), ...letters(el) })).filter(on),
    windows: Array.from(document.querySelectorAll('.fmap-hud > .fw')).map((el) => box(el)),
  }
})
type B = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
const hits = (a: B, b: B): boolean => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 0.5 && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + 0.5
const cut = (b: B): boolean => b.x < -0.5 || b.y < -0.5 || b.x + b.w > 1280.5 || b.y + b.h > 720.5

/** The faults the lettering may never have, at whatever camera: a plate on a plate, under a window or cut by the frame; a name cut or under a plate or window. */
const faults = (l: Lettering): readonly string[] => {
  const out: string[] = []
  l.plates.forEach((a, i) => {
    if (cut(a)) out.push(`plate cut by the frame: ${a.name}`)
    for (const w of l.windows) if (hits(a, w)) out.push(`plate under a window: ${a.name}`)
    for (const b of l.plates.slice(i + 1)) if (hits(a, b)) out.push(`plate x plate: ${a.name} / ${b.name}`)
  })
  for (const n of l.names) {
    if (cut(n)) out.push(`name cut by the frame: ${n.name}`)
    for (const w of l.windows) if (hits(n, w)) out.push(`name under a window: ${n.name}`)
    for (const p of l.plates) if (hits(n, p)) out.push(`name under a plate: ${n.name} / ${p.name}`)
  }
  return out
}

/** Let React commit, then let every transition it started actually finish, before the paint is read. */
const settle = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  })
}

/**
 * GATE2-4, GATE3-10 and RE-GATE C 3.20, on the drawn country. The art's name boxes are laid out once by the tool that
 * draws it (clear of every sprite, road and river: `tools/pxworld`), so what the SCREEN owns is what a camera can
 * break: a plate under a window, two plates on one seat, a name the frame slices in half.
 */
test('no plate or name is cut by the frame, covered by a window or laid on another — at any camera', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  expect(faults(await lettering(page)), 'at the camp, day 1').toEqual([])
  // the camp has six roads out: all six of their names are on the stage as plates, none dropped to dodge a window
  expect((await lettering(page)).plates).toHaveLength(6)

  // the hint is up before the player has ever moved the map, and it names the gesture in words
  await expect(page.getByTestId('map-hint')).toContainText(/drag/i)

  const here = await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle & { env: { content: { overworld: { nodes: { id: string; position: { x: number; y: number } }[] } } } } }).__game
    return g.env.content.overworld.nodes.find((n) => n.id === g.getState().run!.nodeId)!.position
  })
  for (const d of [{ x: -640, y: -360 }, { x: -200, y: -500 }, { x: 180, y: -220 }, { x: -900, y: 40 }, { x: -640, y: 200 }]) {
    await page.evaluate((p) => { (window as unknown as { __game: Handle }).__game.dispatch({ type: 'ui/setMapPan', pan: p }) }, { x: here.x + d.x, y: here.y + d.y })
    await settle(page)
    expect(faults(await lettering(page)), `camera ${d.x},${d.y} from the camp`).toEqual([])
  }
})

test('the company never stands on the name of the place it is at', async ({ page }) => {
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  const overlap = async (): Promise<number> => page.evaluate(() => {
    const p = document.querySelector('[data-testid="pawn"]')!.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(document.querySelector('.fmap-name--here')!)
    const n = range.getBoundingClientRect()
    return Math.max(0, Math.min(p.right, n.right) - Math.max(p.left, n.left)) * Math.max(0, Math.min(p.bottom, n.bottom) - Math.max(p.top, n.top))
  })
  // GATE3-10: at rest the token covered what told the player where they were. In the camp, and after a march.
  expect(await overlap()).toBe(0)
  await page.getByTestId('node-riverside_market').click()
  await expect(page.getByTestId('node-card')).toBeVisible()
  await page.getByTestId('menu-stay').click()
  await settle(page)
  expect(await overlap()).toBe(0)
})

test('the card opens AT the place it names', async ({ page }) => {
  // RE-GATE C 3.11: the node card was pinned to the bottom centre of the stage whatever the player clicked —
  // measured at 562px from `node-riverside_market`, with three quarters of the map between the two.
  await page.goto('/?screen=overworld&seed=41&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()

  await page.getByTestId('node-riverside_market').click()
  await expect(page.getByTestId('node-card')).toBeVisible()
  await settle(page)
  const near = await page.evaluate(() => {
    const stage = document.getElementById('game-stage')!.getBoundingClientRect()
    const s = stage.width / 1280
    const place = document.querySelector('[data-testid="node-riverside_market"]')!.getBoundingClientRect()
    const card = document.querySelector('[data-testid="node-card"]')!.getBoundingClientRect()
    const pc = { x: (place.left + place.width / 2 - stage.left) / s, y: (place.top + place.height / 2 - stage.top) / s }
    const cc = { x: (card.left + card.width / 2 - stage.left) / s, y: (card.top + card.height / 2 - stage.top) / s }
    return {
      d: Math.hypot(cc.x - pc.x, cc.y - pc.y), dx: Math.abs(cc.x - pc.x),
      // the card sits clear of the place's buildings, on one side of them or the other
      clear: card.top >= place.bottom - 8 * s || card.bottom <= place.top + 8 * s,
      left: card.left - stage.left, right: stage.right - card.right, top: card.top - stage.top, bottom: stage.bottom - card.bottom,
    }
  })
  expect(near.d).toBeLessThan(220)
  expect(near.dx).toBeLessThan(40)          // same column as the place, unless the clamp had to move it
  expect(near.clear).toBe(true)
  // the whole card stays on the stage
  expect(near.left).toBeGreaterThanOrEqual(-0.5)
  expect(near.right).toBeGreaterThanOrEqual(-0.5)
  expect(near.top).toBeGreaterThanOrEqual(-0.5)
  expect(near.bottom).toBeGreaterThanOrEqual(-0.5)
})

test('the road line is a reading in the region window, not chrome parked over the map', async ({ page }) => {
  // RE-GATE B 2.6: "On the road · 1 hop to go" was pinned top-centre of the map at (533-748, 134-160), covering
  // the North Ridge Path mark for the whole journey and butting into that node's name (signal E).
  await page.goto(MAP)
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    g.runtime.setPaused(true)
    g.dispatch({ type: 'travel/goTo', nodeId: 'old_mill_crossing' })
  })
  const line = page.getByTestId('walking')
  await expect(line).toBeVisible()
  // it lives inside the region window, and the map's viewport holds the world and nothing else
  expect(await line.evaluate((el) => el.closest('[data-testid="ledger-band"]') !== null)).toBe(true)
  expect(await line.evaluate((el) => el.closest('[data-testid="map-viewport"]') === null)).toBe(true)
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="map-viewport"] > *')).map((el) => String(el.className)))).toEqual(['fmap-world'])
  // while the company walks nothing is offered, so the footnote that offers the roads is down
  await expect(page.getByTestId('map-foot')).toHaveCount(0)
  await page.evaluate(() => { (window as unknown as { __game: Handle }).__game.runtime.setPaused(false) })
})

test('the ration is spent at the camp and READ on the map: every scouted road carries its mark, and the forecast quotes it', async ({ page }) => {
  // RE-GATE C 3.9: Scout cost a ration and a camp action to produce a thirteen-row report readable ONLY while
  // standing at that camp. The sheet, the node card, the hover preview and the CLI all ignored `run.scoutedEdges`,
  // so the intel was gone by the time the road was chosen. It is now annotated onto the roads themselves.
  await page.goto('/?screen=camp&seed=21&motion=0')
  await page.getByTestId('camp-scout').click()
  // the report's header counts the whole sweep (the card lists the nearest roads and counts the rest)
  const reported = Number((await page.getByTestId('scout-report').innerText()).match(/(\d+) roads?/i)?.[1] ?? 0)
  expect(reported).toBeGreaterThan(0)

  await page.getByTestId('camp-leave').click()
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await page.getByTestId('menu-stay').click()
  await expect(page.getByTestId('node-card')).toHaveCount(0)

  // one mark per road the ration paid for, drawn ON the road (the same count the camp report printed)
  await expect(page.locator('[data-testid="scout-marks"] > *')).toHaveCount(reported)

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

  // a road nobody walked down carries nothing: the mark is what was BOUGHT, not decoration on every road
  const totalRoads = Number(await page.getByTestId('scout-marks').getAttribute('data-roads'))
  expect(reported).toBeLessThan(totalRoads)
})

test('the way back to the company is legible on the map it sits on', async ({ page }) => {
  // FINAL GATE B: the only way back to the party after a pan once measured 1.36:1 across its own painted pixels,
  // a control the player could not see. The ratio is taken off what the browser actually PAINTS.
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
  await page.evaluate(() => { (window as unknown as { __game: { dispatch: (a: unknown) => void } }).__game.dispatch({ type: 'ui/setMapPan', pan: { x: 1200, y: 900 } }) })
  const recentre = page.getByTestId('map-recentre')
  await expect(recentre).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready })

  // a walnut button with bone lettering: its own ground, whatever country is under it
  expect(await painted(recentre), 'the control that finds the company').toBeGreaterThan(4.5)
  // …and it recedes: a secondary on the map, never a second brass primary
  expect(await recentre.evaluate((el) => el.className)).not.toContain('pri')
  await recentre.click()
  await expect(recentre).toHaveCount(0)
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
