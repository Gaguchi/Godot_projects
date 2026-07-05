/**
 * Pure pixel-sprite renderer: a palette + char-grids -> an RGBA pixel buffer.
 * No I/O, no framework, fully deterministic — a pure system (architecture
 * invariant #3) usable from Node (the CLI baker), Vitest, and an in-browser
 * preview alike.
 *
 * Two authoring modes share one palette (text-first: a one-pixel edit is a
 * one-character git diff; a single-char palette covers the pixel-art skill's
 * 16-colour budget; `.`/null = transparent):
 *
 *   - FLAT  — `rows`: `h` strings of exactly `w` chars. Good for tiles/icons.
 *   - PARTS — `parts`: named body parts, each its OWN small grid placed by an
 *             [x,y] offset and drawn in order (later parts on top). This is the
 *             "draw the parts separately, then combine" workflow: you author a
 *             head as an 8x8 grid and just say where it goes, instead of padding
 *             every row to the full canvas width.
 *
 * `renderSilhouette` (one flat colour) and `renderPartsMap` (a distinct colour
 * per part) are debug views for planning proportions and seeing what-goes-where.
 */

export interface SpritePart {
  name: string
  /** top-left placement of this part's grid on the canvas, [x, y] */
  at: [number, number]
  /** the part's own rows of single-char palette keys (any size; clipped to canvas) */
  rows: string[]
}

export interface SpriteSpec {
  id: string
  /** native canvas width in pixels */
  w: number
  /** native canvas height in pixels */
  h: number
  /** palette key (single char) -> hex ("#rgb"/"#rrggbb"), or null = transparent */
  palette: Record<string, string | null>
  /** FLAT mode: exactly `h` rows of `w` chars */
  rows?: string[]
  /** PARTS mode: named parts placed by offset, composited in array order */
  parts?: SpritePart[]
}

export interface RenderedImage {
  width: number
  height: number
  /** RGBA, row-major, 4 bytes per pixel, top-left origin */
  rgba: Uint8Array
}

export type Rgba = readonly [number, number, number, number]

/** Parse "#rgb" or "#rrggbb" into [r,g,b]. Throws on malformed input. */
export function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) throw new Error(`bad hex colour: ${JSON.stringify(hex)}`)
  const h = m[1]!
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

function resolvePalette(spec: SpriteSpec): Map<string, Rgba> {
  const m = new Map<string, Rgba>()
  for (const [key, val] of Object.entries(spec.palette)) {
    if ([...key].length !== 1) throw new Error(`${spec.id}: palette key ${JSON.stringify(key)} must be a single character`)
    if (val === null) { m.set(key, [0, 0, 0, 0]); continue }
    const [r, g, b] = parseHex(val)
    m.set(key, [r, g, b, 255])
  }
  return m
}

function toLayers(spec: SpriteSpec): SpritePart[] {
  if (spec.parts && spec.parts.length > 0) return spec.parts
  if (spec.rows) return [{ name: 'flat', at: [0, 0], rows: spec.rows }]
  throw new Error(`${spec.id}: sprite needs "rows" or "parts"`)
}

/**
 * Core compositor. `colorAt(partIndex, key)` returns the RGBA to paint for an
 * opaque cell, or null to leave it transparent. Flat mode enforces exact
 * dimensions; parts mode clips to the canvas.
 */
function composite(spec: SpriteSpec, colorAt: (partIndex: number, key: string) => Rgba | null): RenderedImage {
  const { id, w, h } = spec
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) {
    throw new Error(`${id}: w/h must be positive integers, got ${w}x${h}`)
  }
  const isFlat = !(spec.parts && spec.parts.length > 0)
  const layers = toLayers(spec)
  const rgba = new Uint8Array(w * h * 4)
  layers.forEach((part, pi) => {
    const [ox, oy] = part.at
    if (isFlat && part.rows.length !== h) throw new Error(`${id}: expected ${h} rows, got ${part.rows.length}`)
    part.rows.forEach((row, ry) => {
      const cells = [...row]
      if (isFlat && cells.length !== w) throw new Error(`${id}: row ${ry} has ${cells.length} cells, expected ${w} — "${row}"`)
      cells.forEach((key, rx) => {
        const c = colorAt(pi, key)
        if (!c) return
        const x = ox + rx
        const y = oy + ry
        if (x < 0 || y < 0 || x >= w || y >= h) return
        const i = (y * w + x) * 4
        rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = c[3]
      })
    })
  })
  return { width: w, height: h, rgba }
}

/** Render a sprite to a native-resolution RGBA buffer. Pure + deterministic. */
export function renderSprite(spec: SpriteSpec): RenderedImage {
  const resolved = resolvePalette(spec)
  return composite(spec, (_pi, key) => {
    const c = resolved.get(key)
    if (!c) throw new Error(`${spec.id}: key ${JSON.stringify(key)} not in palette`)
    return c[3] === 0 ? null : c
  })
}

/** Same shape, but every opaque pixel painted one flat colour (proportion read). */
export function renderSilhouette(spec: SpriteSpec, color: Rgba): RenderedImage {
  const resolved = resolvePalette(spec)
  return composite(spec, (_pi, key) => {
    const c = resolved.get(key)
    if (!c) throw new Error(`${spec.id}: key ${JSON.stringify(key)} not in palette`)
    return c[3] === 0 ? null : color
  })
}

/** Each part painted a distinct colour from `colors` (what-goes-where view). */
export function renderPartsMap(spec: SpriteSpec, colors: readonly Rgba[]): RenderedImage {
  const resolved = resolvePalette(spec)
  return composite(spec, (pi, key) => {
    const c = resolved.get(key)
    if (!c) throw new Error(`${spec.id}: key ${JSON.stringify(key)} not in palette`)
    if (c[3] === 0) return null
    return colors[pi % colors.length]!
  })
}

/**
 * Add a 1px outline around the opaque silhouette (paints transparent cells that
 * touch an opaque cell). With `light` set, top/left light-facing edges use it and
 * bottom/right edges use `dark` — a cheap "selout" that reads as a forged rim
 * under an upper-left light. Pure + deterministic. Assumes 1px of transparent
 * margin around the figure (the canvas edge clips, which is fine).
 */
export function addOutline(img: RenderedImage, dark: Rgba, light?: Rgba): RenderedImage {
  const { width: w, height: h, rgba } = img
  const out = new Uint8Array(rgba) // copy; we only paint into transparent cells
  const opaque = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && rgba[(y * w + x) * 4 + 3]! > 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (rgba[i + 3]! > 0) continue // keep existing opaque pixels
      const up = opaque(x, y - 1), dn = opaque(x, y + 1), lf = opaque(x - 1, y), rt = opaque(x + 1, y)
      const diag = opaque(x - 1, y - 1) || opaque(x + 1, y - 1) || opaque(x - 1, y + 1) || opaque(x + 1, y + 1)
      if (!(up || dn || lf || rt || diag)) continue
      const c: Rgba = light && !(up || lf) && (dn || rt) ? light : dark
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = c[3]
    }
  }
  return { width: w, height: h, rgba: out }
}

/**
 * Nearest-neighbour integer upscale by explicit block-copy. Pure + deterministic
 * and pixel-uniform by construction — we do NOT delegate to a resampler (sharp's
 * `kernel:'nearest'` can emit uneven blocks, lovell/sharp#752).
 */
export function upscale(img: RenderedImage, factor: number): RenderedImage {
  if (!Number.isInteger(factor) || factor < 1) throw new Error(`upscale factor must be a positive integer, got ${factor}`)
  if (factor === 1) return img
  const { width: w, height: h, rgba } = img
  const W = w * factor
  const H = h * factor
  const out = new Uint8Array(W * H * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4
      const r = rgba[si]!, g = rgba[si + 1]!, b = rgba[si + 2]!, a = rgba[si + 3]!
      for (let dy = 0; dy < factor; dy++) {
        const oy = y * factor + dy
        for (let dx = 0; dx < factor; dx++) {
          const ox = x * factor + dx
          const di = (oy * W + ox) * 4
          out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = a
        }
      }
    }
  }
  return { width: W, height: H, rgba: out }
}
