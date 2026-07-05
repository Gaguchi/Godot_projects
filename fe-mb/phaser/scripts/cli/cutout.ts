/**
 * cutout — flood-fill background removal for generated sprites.
 *
 * RemBG (ML salient-object matting) reliably mattes high-contrast character
 * sprites and solid building masses, but it ERASES low-contrast / sparse
 * subjects (tents, cave mouths, single trees) down to a faint ghost. For those
 * we generate full-colour on a plain light background and key the background
 * out here instead: a flood fill seeded from the image border eats every
 * background-coloured pixel CONNECTED to the edge, then stops at the subject's
 * darker outline. Interior light details (a white window, snow on a roof) are
 * preserved because they are not border-connected. A final de-halo erosion
 * removes the bright anti-aliased fringe left around the cut edge.
 *
 * Pure (Buffer in, Buffer out) so it can be unit-tested without ComfyUI.
 */
import { PNG } from 'pngjs'

export interface CutoutOpts {
  /** Per-channel colour distance (sum over RGB) under which a pixel counts as background. */
  tolerance?: number
  /** Erode opaque pixels brighter than this luminance that touch transparency (de-halo). */
  haloLuma?: number
}

/** Remove the border-connected background of a PNG buffer, returning a new PNG buffer. */
export function floodKeyAlpha(buf: Buffer, opts: CutoutOpts = {}): Buffer {
  const tol = (opts.tolerance ?? 36) * 3 // summed over 3 channels
  const haloLuma = opts.haloLuma ?? 232
  const png = PNG.sync.read(buf)
  const { width: w, height: h, data } = png
  const n = w * h

  // Reference background colour = median-ish average of the four corners.
  const corners: Array<[number, number]> = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
  let rr = 0, gg = 0, bb = 0
  for (const [cx, cy] of corners) { const i = (cy * w + cx) * 4; rr += data[i]!; gg += data[i + 1]!; bb += data[i + 2]! }
  rr /= 4; gg /= 4; bb /= 4

  // Flood fill from every border pixel inward, marking background.
  const bg = new Uint8Array(n)
  const stack: number[] = []
  const seed = (x: number, y: number): void => { const p = y * w + x; if (!bg[p]) { bg[p] = 2; stack.push(p) } } // 2 = queued
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1) }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y) }
  while (stack.length) {
    const p = stack.pop()!
    const i = p * 4
    const d = Math.abs(data[i]! - rr) + Math.abs(data[i + 1]! - gg) + Math.abs(data[i + 2]! - bb)
    if (d > tol) { bg[p] = 0; continue } // hit the subject edge — not background
    bg[p] = 1
    const x = p % w, y = (p / w) | 0
    if (x + 1 < w && !bg[p + 1]) { bg[p + 1] = 2; stack.push(p + 1) }
    if (x - 1 >= 0 && !bg[p - 1]) { bg[p - 1] = 2; stack.push(p - 1) }
    if (y + 1 < h && !bg[p + w]) { bg[p + w] = 2; stack.push(p + w) }
    if (y - 1 >= 0 && !bg[p - w]) { bg[p - w] = 2; stack.push(p - w) }
  }

  // Apply: background -> transparent.
  for (let p = 0; p < n; p++) if (bg[p] === 1) data[p * 4 + 3] = 0

  // De-halo: opaque, very-bright pixels touching transparency are the AA fringe
  // of the old background bleeding onto the cut edge — erode them.
  const isClear = (x: number, y: number): boolean => x < 0 || x >= w || y < 0 || y >= h || data[(y * w + x) * 4 + 3] === 0
  const erode: number[] = []
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] === 0) continue
    const x = p % w, y = (p / w) | 0
    if (!(isClear(x + 1, y) || isClear(x - 1, y) || isClear(x, y + 1) || isClear(x, y - 1))) continue
    const i = p * 4
    const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
    if (luma >= haloLuma) erode.push(p)
  }
  for (const p of erode) data[p * 4 + 3] = 0

  return PNG.sync.write(png)
}

/** True if a buffer is mostly transparent (a ghost) — used to flag RemBG failures. */
export function opaqueFraction(buf: Buffer): number {
  const png = PNG.sync.read(buf)
  const { data } = png
  let opaque = 0
  const n = data.length / 4
  for (let p = 0; p < n; p++) if (data[p * 4 + 3]! > 24) opaque++
  return opaque / n
}
