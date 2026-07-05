/**
 * Pure shape primitives -> char grids (string[]), '.' = empty. These let larger
 * sprite parts (robes, bases, staves) be generated as clean geometry instead of
 * hand-typing every cell — the key tractability lever for sprites past ~24px.
 * Compose them with the parts system in renderSprite.ts; hand-author only the
 * parts where craft matters (faces, hands).
 *
 * Pure + deterministic: no framework, no I/O, no ambient randomness.
 */

/** Solid w x h block of `ch`. */
export function rect(w: number, h: number, ch: string): string[] {
  return Array.from({ length: h }, () => ch.repeat(w))
}

/** Centred filled trapezoid: row width lerps topW -> botW over `h` rows. */
export function trapezoid(topW: number, botW: number, h: number, ch: string): string[] {
  const maxW = Math.max(topW, botW)
  const out: string[] = []
  for (let y = 0; y < h; y++) {
    const t = h === 1 ? 0 : y / (h - 1)
    const wRow = Math.round(topW + (botW - topW) * t)
    const pad = Math.floor((maxW - wRow) / 2)
    out.push('.'.repeat(pad) + ch.repeat(wRow) + '.'.repeat(maxW - wRow - pad))
  }
  return out
}

/** Centred filled ellipse, w x h. */
export function ellipse(w: number, h: number, ch: string): string[] {
  const out: string[] = []
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const rx = w / 2
  const ry = h / 2
  for (let y = 0; y < h; y++) {
    let line = ''
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      line += dx * dx + dy * dy <= 1.05 ? ch : '.'
    }
    out.push(line)
  }
  return out
}

/** Vertical bar, `w` wide and `h` tall. */
export function vline(h: number, ch: string, w = 1): string[] {
  return Array.from({ length: h }, () => ch.repeat(w))
}

/**
 * Edge-light a filled grid in place of flat colour: replace the first `leftN`
 * filled cells of each row with `leftCh` (rim light) and the last `rightN` with
 * `rightCh` (shadow). Cheap volume for a block-in under an upper-left light.
 */
export function shadeEdges(grid: string[], leftCh: string, leftN: number, rightCh: string, rightN: number): string[] {
  return grid.map((row) => {
    const chars = [...row]
    let first = -1
    let last = -1
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] !== '.') { if (first < 0) first = i; last = i }
    }
    if (first < 0) return row
    for (let k = 0; k < leftN; k++) {
      const i = first + k
      if (i <= last && chars[i] !== '.') chars[i] = leftCh
    }
    for (let k = 0; k < rightN; k++) {
      const i = last - k
      if (i >= first && chars[i] !== '.') chars[i] = rightCh
    }
    return chars.join('')
  })
}
