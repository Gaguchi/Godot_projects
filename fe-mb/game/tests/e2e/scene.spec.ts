import { test, expect, type Page } from '@playwright/test'

/**
 * The staged scenes — what the player is looking AT while someone is talking.
 *
 *   · a talk bust is never shown half-painted (GATE2-20: a 775KB sprite streamed in over a drawn box, so the
 *     first frame of a fresh beat was an axe-head floating above the leather)
 *   · behind a road-side talk the world stops being readable (GATE2-21: at rgba(…,0.15) the map under the busts
 *     was still fully legible and the speakers read as two cut-outs pasted on it)
 *   · the game's FIRST image has a subject in frame (GATE2-22: the opening frame was 78% near-black because the
 *     crop landed on the empty middle of a 3:1 panorama and the sun sat crushed against the left edge)
 *
 * None of these had a test: the suite only ever asserted that the elements existed.
 */

interface Handle {
  getState: () => { run: unknown; screen: { kind: string } }
  dispatch: (a: unknown) => void
}

/** Open the road-side beat the gate shot: two busts over the live map. */
async function openRoadsideTalk(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: Record<string, unknown> }
    g.dispatch({
      type: 'dev/seedState',
      state: { ...s, run: { ...s.run, pendingDialogue: { dialogueId: 'bandit_threat', nodeId: 'start', source: 'travel', busts: ['mc', 'bandit_leader'] } } },
    })
  })
}

/** Every alpha in a gradient string — how much of the world the scrim actually puts out. */
const alphasOf = (css: string): readonly number[] =>
  [...css.matchAll(/rgba?\([^)]*?,\s*([0-9.]+)\s*\)/g)].map((m) => Number(m[1]))

test('a talk bust is never shown half-painted', async ({ page }) => {
  // hold the sprites back so the load is a real event rather than an instant cache hit
  await page.route('**/sprites/units/*.png', async (route) => {
    await new Promise((r) => setTimeout(r, 700))
    await route.continue()
  })
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await openRoadsideTalk(page)

  // the box is drawn at once; the face is NOT there yet, and it is not there half-drawn either
  await expect(page.getByTestId('dialogue-text')).toBeVisible()
  const bust = page.getByTestId('bust-right')
  await expect(bust).toHaveAttribute('data-ready', 'no')
  expect(await bust.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(0)

  // ...and when it arrives it is whole, and it is revealed rather than popped
  await expect(bust).toHaveAttribute('data-ready', 'yes', { timeout: 5000 })
  await expect.poll(async () => bust.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1)
  const shown = await bust.evaluate((el) => {
    const img = el.querySelector('img')
    return { complete: img?.complete === true, width: img?.naturalWidth ?? 0, transition: getComputedStyle(el).transitionProperty }
  })
  expect(shown.complete).toBe(true)
  expect(shown.width).toBeGreaterThan(0)
  expect(shown.transition).toContain('opacity')
})

test('the world stops being readable behind a road-side talk', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await openRoadsideTalk(page)
  await expect(page.getByTestId('dialogue')).toBeVisible()

  const scrim = page.locator('.talk__scrim')
  const style = await scrim.evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage, backdrop: getComputedStyle(el).backdropFilter }))
  // the lightest stop is the one the busts stand against; 0.15 was the shipped value and it hid nothing
  expect(Math.min(...alphasOf(style.bg))).toBeGreaterThanOrEqual(0.45)
  expect(style.backdrop).toMatch(/saturate/)
  expect(await scrim.evaluate((el) => el.classList.contains('talk__scrim--staged'))).toBe(false)

  // the speakers stand on something: each bust carries its own contact shadow
  await expect(page.locator('.talk-bust--left .talk-bust__cast')).toHaveCount(1)
  await expect(page.locator('.talk-bust--right .talk-bust__cast')).toHaveCount(1)
})

test("the game's first image has a subject in frame, and the talk does not put it out", async ({ page }) => {
  await page.goto('/?screen=prologue&seed=3&motion=0')
  await expect(page.getByTestId('prologue-screen')).toBeVisible()
  await page.locator('.vista__art').evaluate((el: HTMLImageElement) => el.decode())

  // Measure the crop the player is actually shown: where the light in it falls, and how much of it is near-black.
  const frame = await page.locator('.vista__art').evaluate((el: HTMLImageElement) => {
    const box = el.getBoundingClientRect()
    const scale = Math.max(box.width / el.naturalWidth, box.height / el.naturalHeight)
    const sw = box.width / scale
    const sh = box.height / scale
    const [px, py] = getComputedStyle(el).objectPosition.split(' ').map((v) => parseFloat(v) / 100)
    const canvas = document.createElement('canvas')
    const W = 160
    const H = 90
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(el, (el.naturalWidth - sw) * (px ?? 0.5), (el.naturalHeight - sh) * (py ?? 0.5), sw, sh, 0, 0, W, H)
    const data = ctx.getImageData(0, 0, W, H).data
    const pixels: { x: number; y: number; l: number }[] = []
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        pixels.push({ x, y, l: 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]! })
      }
    }
    pixels.sort((a, b) => b.l - a.l)
    const top = pixels.slice(0, Math.round(pixels.length * 0.01))
    return {
      focalX: top.reduce((a, p) => a + p.x, 0) / top.length / W,
      focalY: top.reduce((a, p) => a + p.y, 0) / top.length / H,
      nearBlack: pixels.filter((p) => p.l < 40).length / pixels.length,
    }
  })

  // the sun is IN the frame, off-centre and high — not crushed against the edge (it measured x=0.19 before)
  expect(frame.focalX).toBeGreaterThan(0.2)
  expect(frame.focalX).toBeLessThan(0.55)
  expect(frame.focalY).toBeLessThan(0.5)
  // and the frame is a picture, not a gradient
  expect(frame.nearBlack).toBeLessThan(0.2)

  // dusk falls from the sky and pools on the ground; it does not sit on the light (no radial darkening either)
  const dusk = await page.locator('.vista__dusk').evaluate((el) => getComputedStyle(el).backgroundImage)
  expect(dusk).not.toMatch(/radial-gradient/)

  // over a staged frame the talk seats its box instead of blacking out the scene
  await expect(page.getByTestId('dialogue')).toBeVisible()
  const staged = await page.locator('.talk__scrim').evaluate((el) => ({ staged: el.classList.contains('talk__scrim--staged'), bg: getComputedStyle(el).backgroundImage }))
  expect(staged.staged).toBe(true)
  expect(Math.min(...alphasOf(staged.bg))).toBeLessThanOrEqual(0.1)
})

test('the speaker plaque hangs on the SPEAKER side of the box', async ({ page }) => {
  // RE-GATE B 2.4: the plaque was pinned to the box's top-left whoever was talking, so it read "BANDIT LEADER"
  // while sitting directly under the silent, unlit foundling on the left. Lighting said one thing, the label
  // said another — two channels for one fact, disagreeing.
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await openRoadsideTalk(page)
  await expect(page.getByTestId('dialogue')).toBeVisible()

  const geometry = async (): Promise<{ side: string | null; plaqueMid: number; boxMid: number; litMid: number }> =>
    page.evaluate(() => {
      const plaque = document.querySelector('[data-testid="dialogue-speaker"]')!.getBoundingClientRect()
      const box = document.querySelector('.talk__box')!.getBoundingClientRect()
      const lit = document.querySelector('.talk-bust--lit')!.getBoundingClientRect()
      return {
        side: document.querySelector('[data-testid="dialogue-speaker"]')!.getAttribute('data-side'),
        plaqueMid: plaque.left + plaque.width / 2,
        boxMid: box.left + box.width / 2,
        litMid: lit.left + lit.width / 2,
      }
    })

  // the bandit leader is the right-hand bust: the plaque is on the right of the box, on his side of the middle
  const right = await geometry()
  expect(right.side).toBe('right')
  expect(right.plaqueMid).toBeGreaterThan(right.boxMid)
  expect(right.litMid).toBeGreaterThan(right.boxMid)
  await page.screenshot({ path: '../.playwright-mcp/fix3-2.4-talk.png' })

  // …and with the SAME speaker seated in the LEFT slot instead, both channels move together
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, pendingDialogue: { dialogueId: 'bandit_threat', nodeId: 'start', source: 'travel', busts: ['bandit_leader', 'mc'] } } } })
  })
  await expect(page.getByTestId('dialogue-speaker')).toHaveAttribute('data-side', 'left')
  const left = await geometry()
  expect(left.plaqueMid).toBeLessThan(left.boxMid)
  expect(left.litMid).toBeLessThan(left.boxMid)
})

/**
 * GATE2-22 named two empty frames. The prologue vista was re-composed (0081); the camp was not, and stayed a card
 * floating in a near-featureless dusk with a faint horizon and nothing else in it (RE-GATE B 2.7).
 *
 * Run in BOTH of the camp's states, because the first version of this case only ran the first one: open the scout
 * report and the card grows from ~300px to 542px, the seats that cleared it at rest went under it, and all the
 * player could see of two of the company was a pair of legs below the bottom rule (FINAL GATE B B.2). What the
 * card's height changes is what the case has to sweep.
 */
for (const night of [
  { name: 'at rest', scout: false },
  { name: 'with the scout report open — the state a ration pays for', scout: true },
] as const) {
test(`the camp has a camp in it: a fire, the company round it, and the tent they sleep in (${night.name})`, async ({ page }) => {
  await page.goto('/?screen=camp&seed=21&motion=0')
  await expect(page.getByTestId('camp-screen')).toBeVisible()
  if (night.scout) {
    await page.getByTestId('camp-scout').click()
    await expect(page.getByTestId('scout-report')).toBeVisible()
    await page.evaluate(() => window.__game!.settled())
  }
  await page.evaluate(() => Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => undefined))))

  const scene = await page.evaluate(() => {
    const stage = document.getElementById('game-stage')!.getBoundingClientRect()
    const s = stage.width / 1280
    const card = document.querySelector('.camp__card')!.getBoundingClientRect()
    const box = (sel: string): { x: number; y: number; w: number; h: number } | null => {
      const el = document.querySelector(sel)
      if (el === null) return null
      const b = el.getBoundingClientRect()
      return { x: (b.left - stage.left) / s, y: (b.top - stage.top) / s, w: b.width / s, h: b.height / s }
    }
    const figures = Array.from(document.querySelectorAll('.camp__figure')).map((el) => {
      const b = el.getBoundingClientRect()
      return { x: (b.left - stage.left) / s, y: (b.top - stage.top) / s, w: b.width / s, h: b.height / s, drawn: (el.querySelector('img') as HTMLImageElement | null)?.naturalWidth ?? 0 }
    })
    return { fire: box('.camp__flame'), tent: box('.camp__tent'), figures, card: { x: (card.left - stage.left) / s, y: (card.top - stage.top) / s, w: card.width / s, h: card.height / s }, pointer: getComputedStyle(document.querySelector('.camp__scene')!).pointerEvents }
  })

  expect(scene.fire).not.toBeNull()
  expect(scene.tent).not.toBeNull()
  expect(scene.figures.length).toBeGreaterThanOrEqual(2)
  for (const f of scene.figures) expect(f.drawn, 'a figure with no sprite behind it').toBeGreaterThan(0)

  // …all of it inside the 1280×720 frame, and none of it under the card (so the reading is unchanged)
  const c = scene.card
  for (const b of [scene.fire!, scene.tent!, ...scene.figures]) {
    expect(b.x).toBeGreaterThanOrEqual(-0.5)
    expect(b.x + b.w).toBeLessThanOrEqual(1280.5)
    expect(b.y + b.h).toBeLessThanOrEqual(720.5)
    const over = Math.max(0, Math.min(b.x + b.w, c.x + c.w) - Math.max(b.x, c.x)) * Math.max(0, Math.min(b.y + b.h, c.y + c.h) - Math.max(b.y, c.y))
    expect(over, `scenery under the card at ${Math.round(b.x)},${Math.round(b.y)}`).toBe(0)
  }
  // it is scenery: it never eats a click (the lesson of the invisible-container bug)
  expect(scene.pointer).toBe('none')
  await page.screenshot({ path: `../.playwright-mcp/fix4-B.2-camp-${night.scout ? 'scouted' : 'rest'}.png` })
})
}

/**
 * FINAL GATE B B.8 — the slot is called a bust and was holding a whole standing figure. A 1216px sprite at 340px
 * is a 0.28 downscale, which puts the foundling's face on the glass 28px tall: a pale oval with no features in
 * it, beside a bandit whose helmet still read as a helmet. The frame has no room to fix that by growing (the box
 * owns the bottom 180px), so the window is a CROP now — the sheet is drawn at 0.55 and the window shows the chest
 * up. The measurement is the one that matters: the image must be far taller than the slot that shows it, and the
 * face must land in the slot's upper half where the light is.
 */
test('a talk bust is a bust: the speaker is close enough to have a face', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await openRoadsideTalk(page)
  await expect(page.getByTestId('dialogue')).toBeVisible()
  await page.locator('.talk-bust--right img').evaluate((el: HTMLImageElement) => el.decode())

  const shot = await page.evaluate(() => {
    const out: Record<string, unknown> = {}
    for (const side of ['left', 'right']) {
      const slot = document.querySelector(`.talk-bust--${side}`) as HTMLElement
      const img = slot.querySelector('img') as HTMLImageElement
      const s = slot.getBoundingClientRect()
      const i = img.getBoundingClientRect()
      const box = document.querySelector('.talk__box')!.getBoundingClientRect()
      out[side] = {
        overflow: getComputedStyle(slot).overflow,
        zoom: i.height / s.height,
        // the head sits in the top third of the source sheet, so the crop must start near the sheet's top
        headTopInSlot: (i.top + i.height * 0.12) - s.top,
        insideBoxColumn: s.left >= box.left && s.right <= box.right,
        // the slot's bottom edge is covered by the box, so the crop's cut is never on the glass
        cutCovered: s.bottom >= box.top,
      }
    }
    return out as Record<string, { overflow: string; zoom: number; headTopInSlot: number; insideBoxColumn: boolean; cutCovered: boolean }>
  })
  for (const side of ['left', 'right'] as const) {
    const m = shot[side]!
    expect(m.overflow, side).toBe('hidden')
    expect(m.zoom, side).toBeGreaterThan(1.5)          // 340/1216 was 1.0 — the whole figure, and no face
    expect(m.headTopInSlot, side).toBeLessThan(140)    // the face is in the lit half, not down by the box
    expect(m.insideBoxColumn, side).toBe(true)
    expect(m.cutCovered, side).toBe(true)
  }
  await page.screenshot({ path: '../.playwright-mcp/fix4-B.8-bust.png' })
})

/**
 * FINAL GATE C 3.10 — five characters ship no `spriteId`, and one of them is Guildmistress Anya, who gives the
 * first contract and runs the naming beat. Every slot fell back to `displayName.slice(0, 2)`, so the first named
 * face in the game was a brown disc reading "Gu" under a plaque that spelled her name out in full. The slot holds
 * her DEVICE now — the `portrait: { accent, faction, shape }` record `characters.json` has carried all along.
 */
test('a speaker with no likeness gets their mark, never two letters of their title', async ({ page }) => {
  await page.goto('/?screen=town&seed=21&motion=0')
  await expect(page.getByTestId('town-screen')).toBeVisible()
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, pendingDialogue: { dialogueId: 'sq_caravan_accept', nodeId: 'start', source: 'town', busts: ['mc', 'guildmistress_anya'] } } } })
  })
  await expect(page.getByTestId('dialogue-speaker')).toHaveText(/Guildmistress Anya/i)

  const slot = page.locator('.talk-bust--right')
  const sigil = slot.locator('[data-testid="sigil"]')
  await expect(sigil).toHaveCount(1)
  // her own ink and her own shape, off the identity ramp — not a shared placeholder
  await expect(sigil).toHaveAttribute('data-accent', 'gold')
  await expect(sigil).toHaveAttribute('data-shape', 'diamond')
  const drawn = await sigil.evaluate((el) => {
    const box = el.getBoundingClientRect()
    const ink = getComputedStyle(el).getPropertyValue('--sigil-ink').trim()
    return { text: (el.textContent ?? '').trim(), w: box.width, h: box.height, ink, paths: el.querySelectorAll('path, rect, circle').length }
  })
  expect(drawn.text).toBe('')                 // "Gu" is gone, and nothing replaced it with letters
  expect(drawn.paths).toBeGreaterThan(2)
  expect(drawn.ink).not.toBe('')
  expect(drawn.w).toBeGreaterThan(120)        // it fills a bust's volume, not a 40px avatar chip
  expect(drawn.h).toBeGreaterThan(200)
  // every faceless speaker in the build is told apart by ink AND shape
  const marks = await page.evaluate(() => {
    const g = (window as unknown as { __game: { env: { content: { characters: Record<string, { spriteId?: string; portrait: { accent: string; shape: string } }> } } } }).__game
    return Object.values(g.env.content.characters).filter((c) => c.spriteId === undefined).map((c) => `${c.portrait.accent}/${c.portrait.shape}`)
  })
  expect(marks.length).toBeGreaterThan(3)
  expect(new Set(marks).size).toBe(marks.length)
  await page.screenshot({ path: '../.playwright-mcp/fix4-3.10-sigil.png' })
})

/**
 * FINAL GATE B B.6 — the fire was the one object in the build not drawn in the game's hand: three nested flat
 * teardrops in fully saturated red/orange/yellow on five plain grey ellipses, in a frame of dithered pixel art
 * under a painted dusk, and it was the subject the eye landed on first. It is pixels now. The ratchet is the
 * thing that made it wrong — geometry: every cell of the fire sits on a whole-number lattice and no edge is
 * smoothed, so re-drawing it with curves reddens here.
 */
test('the camp fire is drawn in the same hand as everything around it', async ({ page }) => {
  await page.goto('/?screen=camp&seed=21&motion=0')
  await expect(page.getByTestId('camp-screen')).toBeVisible()

  const fire = await page.evaluate(() => {
    const svg = document.querySelector('.camp__flame') as SVGSVGElement
    const parts = Array.from(svg.querySelectorAll('path'))
    return {
      crisp: getComputedStyle(svg).shapeRendering,
      viewBox: svg.getAttribute('viewBox') ?? '',
      inks: parts.length,
      // resolved to RGB through a canvas: the fills are color-mix() and come back as oklab() otherwise
      fills: parts.map((p) => {
        const ctx = document.createElement('canvas').getContext('2d')!
        ctx.fillStyle = getComputedStyle(p).fill
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return [d[0]!, d[1]!, d[2]!] as [number, number, number]
      }),
      // every command is an integer move: M x y h n v1 h-n z, and nothing else
      lattice: parts.every((p) => /^(M-?\d+ -?\d+h\d+v1h-\d+z)+$/.test(p.getAttribute('d') ?? '')),
      curves: parts.some((p) => /[CcSsQqTtAa]/.test(p.getAttribute('d') ?? '')),
      ellipses: svg.querySelectorAll('ellipse, circle').length,
    }
  })
  expect(fire.crisp.toLowerCase()).toBe('crispedges')
  expect(fire.viewBox).toMatch(/^0 0 \d+ \d+$/)
  expect(fire.lattice, 'a fire cell off the pixel lattice').toBe(true)
  expect(fire.curves, 'a curve in the fire').toBe(false)
  expect(fire.ellipses, 'a smooth ellipse in the fire').toBe(0)
  expect(fire.inks, 'a flame needs its ramp: rim, ember, hearth, core, wood, stone').toBeGreaterThanOrEqual(6)
  expect(new Set(fire.fills.map((f) => f.join(','))).size).toBeGreaterThanOrEqual(6)
  // …and it is still LIT rather than emitting: the old flame was pure ember/orange/yellow, the loudest thing in
  // the build. Every ink is mixed down into the dusk's own ash now, so none of them is a raw primary.
  for (const [r, g, b] of fire.fills) {
    expect(Math.max(r, g, b) - Math.min(r, g, b), `a fully saturated ink rgb(${r},${g},${b})`).toBeLessThan(210)
  }
  await page.screenshot({ path: '../.playwright-mcp/fix4-B.6-fire.png' })
})
