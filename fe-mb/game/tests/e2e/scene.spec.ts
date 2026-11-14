import { test, expect, type Page } from '@playwright/test'

/**
 * The staged scenes — what the player is looking AT while someone is talking.
 *
 *   · the speaker's face is never shown half-painted (GATE2-20: a 775KB sprite streamed in over a drawn box, so
 *     the first frame of a fresh beat was an axe-head floating above the leather)
 *   · behind a road-side talk the world stops being readable (GATE2-21: at rgba(…,0.15) the map under the talk
 *     was still fully legible and the talk read as a cut-out pasted on it)
 *   · the game's FIRST image has a subject in frame (GATE2-22: the opening frame was 78% near-black because the
 *     crop landed on the empty middle of a 3:1 panorama and the sun sat crushed against the left edge)
 *
 * None of these had a test: the suite only ever asserted that the elements existed.
 */

interface Handle {
  getState: () => { run: unknown; screen: { kind: string } }
  dispatch: (a: unknown) => void
}

/** Open the road-side beat the gate shot: the bandit's toll over the live map. */
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

test("the speaker's face is never shown half-painted", async ({ page }) => {
  // hold the faces back so the load is a real event rather than an instant cache hit
  await page.route('**/sprites/faces/brigand_chief.png', async (route) => {
    await new Promise((r) => setTimeout(r, 700))
    await route.continue()
  })
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await openRoadsideTalk(page)

  // the box is drawn at once, niche and all; the face is NOT in it yet, and it is not there half-drawn either
  await expect(page.getByTestId('dialogue-text')).toBeVisible()
  const face = page.getByTestId('talk-face')
  const art = face.locator('.froad__art')
  await expect(face).toHaveAttribute('data-ready', 'no')
  expect(await art.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(0)

  // ...and when it arrives it is whole, and it is revealed rather than popped
  await expect(face).toHaveAttribute('data-ready', 'yes', { timeout: 5000 })
  await expect.poll(async () => art.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1)
  const shown = await art.evaluate((el) => ({ image: getComputedStyle(el).backgroundImage, transition: getComputedStyle(el).transitionProperty }))
  expect(shown.image).toContain('/sprites/faces/brigand_chief.png')
  expect(shown.transition).toContain('opacity')
})

test('the world stops being readable behind a road-side talk', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await openRoadsideTalk(page)
  await expect(page.getByTestId('dialogue')).toBeVisible()

  // one flat ink tone over the whole stage; 0.15 was the shipped value and it hid nothing
  const scrim = page.getByTestId('dialogue').locator('.fmodal__scrim')
  const style = await scrim.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, box: el.getBoundingClientRect().toJSON() as { width: number; height: number } }))
  expect(Math.min(...alphasOf(style.bg))).toBeGreaterThanOrEqual(0.45)
  expect(style.box.width).toBe(1280)
  expect(style.box.height).toBe(720)
  await expect(page.getByTestId('dialogue')).not.toHaveClass(/froad--staged/)

  // and the dim is under the box, not over it: the line is read at full strength
  const lit = await page.getByTestId('dialogue-text').evaluate((el) => {
    const r = el.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + 4, r.top + 4)
    return top !== null && (top === el || el.contains(top) || top.contains(el)) && !top.classList.contains('fmodal__scrim')
  })
  expect(lit).toBe(true)
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
  await expect(page.getByTestId('dialogue')).toHaveClass(/froad--staged/)
  const veil = await page.getByTestId('dialogue').locator('.fmodal__scrim').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(Math.max(...alphasOf(veil))).toBeLessThanOrEqual(0.1)
})

test('the face in the box is the one who is talking', async ({ page }) => {
  // RE-GATE B 2.4: the plaque was pinned to the box's top-left whoever was talking, so it read "BANDIT LEADER"
  // while sitting directly under the silent, unlit foundling on the left. Lighting said one thing, the label
  // said another — two channels for one fact, disagreeing. The box now shows ONE face and it is the speaker's,
  // with the name beside it, so the two cannot part company whichever way the engine seats the pair.
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await openRoadsideTalk(page)
  await expect(page.getByTestId('dialogue')).toBeVisible()

  const reading = async (): Promise<{ who: string | null; name: string; faceRight: number; nameLeft: number; inBox: boolean }> =>
    page.evaluate(() => {
      const face = document.querySelector('[data-testid="talk-face"]')!
      const name = document.querySelector('[data-testid="dialogue-speaker"]')!
      const box = document.querySelector('[data-testid="dialogue-box"]')!.getBoundingClientRect()
      const f = face.getBoundingClientRect()
      const n = name.getBoundingClientRect()
      return {
        who: face.getAttribute('data-who'),
        name: (name.textContent ?? '').trim(),
        faceRight: f.right,
        nameLeft: n.left,
        inBox: f.left >= box.left && f.bottom <= box.bottom && n.right <= box.right && f.top >= box.top,
      }
    })

  const first = await reading()
  expect(first.who).toBe('bandit_leader')
  expect(first.name).toMatch(/Bandit Leader/i)
  expect(first.nameLeft).toBeGreaterThan(first.faceRight)   // the name is beside the face it names
  expect(first.inBox).toBe(true)
  await page.screenshot({ path: '../.playwright-mcp/fix3-2.4-talk.png' })

  // …and with the SAME speaker seated the other way round by the engine, nothing on the glass moves
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Handle }).__game
    const s = g.getState() as unknown as { run: Record<string, unknown> }
    g.dispatch({ type: 'dev/seedState', state: { ...s, run: { ...s.run, pendingDialogue: { dialogueId: 'bandit_threat', nodeId: 'start', source: 'travel', busts: ['bandit_leader', 'mc'] } } } })
  })
  const second = await reading()
  expect(second.who).toBe('bandit_leader')
  expect(second.name).toBe(first.name)
  expect(second.nameLeft).toBe(first.nameLeft)
})

/**
 * GATE2-22 named two empty frames. The prologue vista was re-composed (0081); the camp was not, and stayed a card
 * floating in a near-featureless dusk with a faint horizon and nothing else in it (RE-GATE B 2.7).
 *
 * The camp is a place now: a clearing drawn at 1:1 with the fire, the tent and the standard in it, and the company
 * the run has standing on it. Run in BOTH of the camp's states, because the first version of this case only ran the
 * first one: open the scout report and the night's window grows, and what it grew over was two of the company, cut
 * off at the knees under its bottom rule (FINAL GATE B B.2). What a window's height changes is what the case sweeps.
 */
/** Where the picture keeps its fire and its tent (tools/pxworld `px-camp/scene.py`: FIRE, TENT_AT), in stage px. */
const CAMP_FIRE = { x: 348, y: 470, w: 128, h: 115 }
const CAMP_TENT = { x: 548, y: 176, w: 256, h: 256 }

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
    const rel = (b: DOMRect): { x: number; y: number; w: number; h: number } => ({ x: (b.left - stage.left) / s, y: (b.top - stage.top) / s, w: b.width / s, h: b.height / s })
    const world = document.querySelector('[data-testid="camp-screen"] .fplace__world') as HTMLImageElement
    const figures = Array.from(document.querySelectorAll('[data-testid="camp-company"] img')).map((el) => ({
      ...rel(el.getBoundingClientRect()),
      drawn: (el as HTMLImageElement).naturalWidth,
      pointer: getComputedStyle(el).pointerEvents,
    }))
    const windows = ['camp-place', 'camp-night', 'camp-roster'].map((id) => rel(document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect()))
    return { world: { w: world.naturalWidth, h: world.naturalHeight, box: rel(world.getBoundingClientRect()) }, figures, windows }
  })

  // the place is one picture, the size of the stage, and the company is IN it
  expect(scene.world.w).toBe(1280)
  expect(scene.world.h).toBe(720)
  expect(scene.world.box).toEqual({ x: 0, y: 0, w: 1280, h: 720 })
  expect(scene.figures.length).toBeGreaterThanOrEqual(2)
  for (const f of scene.figures) expect(f.drawn, 'a figure with no sprite behind it').toBeGreaterThan(0)

  // …all of it inside the 1280×720 frame, and none of it under a window (so the reading is unchanged)
  for (const b of [CAMP_FIRE, CAMP_TENT, ...scene.figures]) {
    expect(b.x).toBeGreaterThanOrEqual(-0.5)
    expect(b.x + b.w).toBeLessThanOrEqual(1280.5)
    expect(b.y + b.h).toBeLessThanOrEqual(720.5)
    for (const c of scene.windows) {
      const over = Math.max(0, Math.min(b.x + b.w, c.x + c.w) - Math.max(b.x, c.x)) * Math.max(0, Math.min(b.y + b.h, c.y + c.h) - Math.max(b.y, c.y))
      expect(over, `scenery under a window at ${Math.round(b.x)},${Math.round(b.y)}`).toBe(0)
    }
  }
  // they are scenery: they never eat a click (the lesson of the invisible-container bug)
  for (const f of scene.figures) expect(f.pointer).toBe('none')
  await page.screenshot({ path: `../.playwright-mcp/fix4-B.2-camp-${night.scout ? 'scouted' : 'rest'}.png` })
})
}

/**
 * FINAL GATE B B.8 — a talk "bust" drew the whole 832×1216 figure in a 340px window: a 0.28 downscale, which put
 * the foundling's face on the glass 28px tall, a pale oval with no features in it. The road talk now shows the
 * speaker's FACE: a 96px crop cut around the head (`tools/pxworld/src/px-popups/export_game.py`), behind the niche's
 * brass lip, at one art pixel to one stage pixel. The measurement is the one that matters: what is in the niche is a
 * face file at its own size, and every sprite that can speak has one.
 */
test('the speaker has a face: the niche shows the head, not the whole figure', async ({ page }) => {
  await page.goto('/?screen=overworld&seed=3&motion=0')
  await expect(page.getByTestId('overworld-screen')).toBeVisible()
  await openRoadsideTalk(page)
  await expect(page.getByTestId('dialogue')).toBeVisible()
  await expect(page.getByTestId('talk-face')).toHaveAttribute('data-ready', 'yes')

  const shot = await page.evaluate(() => {
    const slot = document.querySelector('[data-testid="talk-face"]') as HTMLElement
    const art = slot.querySelector('.froad__art') as HTMLElement
    const box = document.querySelector('[data-testid="dialogue-box"]')!.getBoundingClientRect()
    const s = slot.getBoundingClientRect()
    const a = art.getBoundingClientRect()
    const cs = getComputedStyle(art)
    return {
      image: cs.backgroundImage,
      // the crop is drawn at the size it was baked: one art pixel, one stage pixel
      size: cs.backgroundSize,
      rendering: cs.imageRendering,
      art: { w: a.width, h: a.height },
      slot: { w: s.width, h: s.height },
      insideBox: s.left >= box.left && s.right <= box.right && s.top >= box.top && s.bottom <= box.bottom,
    }
  })
  expect(shot.image).toContain('/sprites/faces/')      // a face crop, never the 832×1216 figure squeezed into a chip
  expect(shot.size).toMatch(/^96px/)
  expect(shot.rendering).toBe('pixelated')
  expect(shot.art.w).toBe(96)                           // 28px was the face the gate measured; this is the whole niche
  expect(shot.art.h).toBe(96)
  expect(shot.slot.w).toBeGreaterThanOrEqual(96)
  expect(shot.insideBox).toBe(true)                     // and nothing of it is cut by the frame

  // every sprite that can be given a line has its own face file: no speaker falls back to a seat on the full art
  const missing = await page.evaluate(async () => {
    const g = (window as unknown as { __game: { env: { content: { characters: Record<string, { spriteId?: string | null }> } } } }).__game
    const sprites = [...new Set(Object.values(g.env.content.characters).map((c) => c.spriteId).filter((id): id is string => typeof id === 'string'))]
    const out: string[] = []
    for (const id of sprites) {
      const res = await fetch(`/sprites/faces/${id}.png`)
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('image/png')) out.push(id)
    }
    return out
  })
  expect(missing).toEqual([])
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

  const slot = page.getByTestId('talk-face')
  await expect(slot).toHaveAttribute('data-who', 'guildmistress_anya')
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
  expect(drawn.paths).toBeGreaterThanOrEqual(2) // the struck field and its charge: shapes, not glyphs
  expect(drawn.ink).not.toBe('')
  expect(drawn.w).toBeGreaterThan(56)         // it fills the niche a face would fill, not a 40px avatar chip
  expect(drawn.h).toBeGreaterThan(56)
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
 * under a painted dusk, and it was the subject the eye landed on first. The fire is now part of the clearing: one
 * picture, one palette, one pixel to one stage pixel. The ratchet is the thing that made it wrong, measured on the
 * pixels themselves: the fire's patch of the picture holds a few dozen inks with hard edges, and re-drawing it with
 * curves or gradients (or scaling the picture) turns that into hundreds.
 */
test('the camp fire is drawn in the same hand as everything around it', async ({ page }) => {
  await page.goto('/?screen=camp&seed=21&motion=0')
  await expect(page.getByTestId('camp-screen')).toBeVisible()
  const world = page.locator('[data-testid="camp-screen"] .fplace__world')
  await world.evaluate((el: HTMLImageElement) => el.decode())

  const fire = await world.evaluate((el: HTMLImageElement, at) => {
    const count = (x: number, y: number, w: number, h: number): number => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(el, x, y, w, h, 0, 0, w, h)
      const d = ctx.getImageData(0, 0, w, h).data
      const inks = new Set<number>()
      for (let i = 0; i < d.length; i += 4) inks.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!)
      return inks.size
    }
    const box = el.getBoundingClientRect()
    return {
      natural: [el.naturalWidth, el.naturalHeight],
      shown: [Math.round(box.width), Math.round(box.height)],
      rendering: getComputedStyle(el).imageRendering,
      fireInks: count(at.x, at.y, at.w, at.h),
      allInks: count(0, 0, el.naturalWidth, el.naturalHeight),
      // nothing vector is laid over the picture to stand in for a part of it
      vectors: document.querySelectorAll('[data-testid="camp-screen"] svg').length,
    }
  }, CAMP_FIRE)
  expect(fire.natural).toEqual([1280, 720])
  expect(fire.shown).toEqual([1280, 720])           // one art pixel, one stage pixel: nothing is resampled
  expect(fire.rendering).toBe('pixelated')
  expect(fire.vectors, 'a vector drawn over the clearing').toBe(0)
  expect(fire.fireInks, 'the fire needs its ramp: rim, ember, hearth, core, wood, stone').toBeGreaterThanOrEqual(8)
  expect(fire.fireInks, 'a smoothed or gradient fire').toBeLessThanOrEqual(48)
  expect(fire.allInks, 'the clearing is one palette').toBeLessThanOrEqual(128)
  await page.screenshot({ path: '../.playwright-mcp/fix4-B.6-fire.png' })
})
