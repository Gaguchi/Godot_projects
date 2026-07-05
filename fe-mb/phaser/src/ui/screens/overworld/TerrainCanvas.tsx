import { useEffect, useRef, type ReactElement } from 'react'
import { biomeGrid, seedFromId, dualConfig, decorationScatter, BIOME_ORDER, BIOMES, DECORATIONS } from './terrain'

const T = 64 // display cell size (tiles are 128px native, drawn scaled)

const cache = new Map<string, HTMLImageElement>()
function img(src: string): HTMLImageElement {
  let i = cache.get(src)
  if (!i) { i = new Image(); i.src = src; cache.set(src, i) }
  return i
}
const tileImg = (key: string): HTMLImageElement => img(`/art/terrain/${key}.png`)
const decoImg = (key: string): HTMLImageElement => img(`/art/decoration/${key}.png`)

// Fraction of the prop's content box (from the TOP) to actually draw. The sprite
// model insists on planting cultivated greenery (tree/bush) in a wooden box; keep
// only the leafy top so they read as wild foliage on the map. 1 = use the whole prop.
const DECO_KEEP: Record<string, number> = { tree: 0.62, bush: 0.6 }

/**
 * Opaque content bounding box of a (RemBG-cut) decoration image, in source pixels.
 * Lets the scatter bottom-anchor the *visible* prop onto the ground regardless of
 * the transparent padding around it. Computed once per image, cached.
 */
const boxCache = new Map<string, { sx: number; sy: number; sw: number; sh: number }>()
function contentBox(im: HTMLImageElement): { sx: number; sy: number; sw: number; sh: number } {
  const hit = boxCache.get(im.src)
  if (hit) return hit
  const W = im.naturalWidth, H = im.naturalHeight
  const full = { sx: 0, sy: 0, sw: W, sh: H }
  const oc = document.createElement('canvas')
  oc.width = W; oc.height = H
  const octx = oc.getContext('2d', { willReadFrequently: true })
  if (!octx) return full
  octx.drawImage(im, 0, 0)
  let data: Uint8ClampedArray
  try { data = octx.getImageData(0, 0, W, H).data } catch { return full }
  let minX = W, minY = H, maxX = 0, maxY = 0, any = false
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3]! > 16) { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  }
  const box = any ? { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 } : full
  boxCache.set(im.src, box)
  return box
}

/**
 * The overworld terrain layer: a single canvas rendered with the DUAL-GRID
 * autotiling algorithm (per-cell opaque base + per-biome transparent transition
 * overlays at the half-tile offset). Sits inside the pan container, behind the
 * roads + nodes. Deterministic from mapId.
 */
export function TerrainCanvas({ width, height, mapId }: { width: number; height: number; mapId: string }): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cols = Math.ceil(width / T) + 1
    const rows = Math.ceil(height / T) + 1
    const grid = biomeGrid(cols, rows, seedFromId(mapId))

    const imgs: HTMLImageElement[] = []
    for (const b of BIOMES) { imgs.push(tileImg(b)); for (let cfg = 1; cfg < 15; cfg++) imgs.push(tileImg(`${b}_${cfg}`)) }
    for (const d of DECORATIONS) imgs.push(decoImg(d))
    let cancelled = false
    void Promise.all(imgs.map((im) => new Promise<void>((resolve) => {
      if (im.complete && im.naturalWidth > 0) resolve()
      else { im.onload = () => resolve(); im.onerror = () => resolve() }
    }))).then(() => {
      if (cancelled) return
      ctx.clearRect(0, 0, width, height)
      // base: each cell with its own biome (opaque)
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        ctx.drawImage(tileImg(grid[r]![c]!), c * T, r * T, T, T)
      }
      // dual-grid transition overlays, low -> high precedence
      for (const B of BIOME_ORDER) {
        for (let dr = 0; dr <= rows; dr++) for (let dc = 0; dc <= cols; dc++) {
          const cfg = dualConfig(grid, rows, cols, dr, dc, B)
          if (cfg === 0) continue
          ctx.drawImage(tileImg(cfg === 15 ? B : `${B}_${cfg}`), dc * T - T / 2, dr * T - T / 2, T, T)
        }
      }
      // decoration scatter: trees/bushes/rocks bottom-anchored on the ground via
      // their opaque content box, drawn in painter order (lower props overlap higher).
      ctx.imageSmoothingEnabled = true
      for (const d of decorationScatter(grid, rows, cols, seedFromId(mapId))) {
        const im = decoImg(d.kind)
        if (!im.complete || im.naturalWidth === 0) continue
        const { sx, sy, sw, sh } = contentBox(im)
        const shK = sh * (DECO_KEEP[d.kind] ?? 1) // crop the planter band off the bottom
        const targetH = T * 1.3 * d.scale       // visible prop height on the map
        const sc = targetH / shK
        const targetW = sw * sc
        // base of the visible content sits just below the cell point (planted look)
        ctx.drawImage(im, sx, sy, sw, shK, d.x * T - targetW / 2, d.y * T - targetH * 0.86, targetW, targetH)
      }
    })
    return () => { cancelled = true }
  }, [width, height, mapId])

  return <canvas ref={ref} width={width} height={height} className="absolute top-0 left-0 pointer-events-none" style={{ width, height, filter: 'brightness(1.12) saturate(1.1)' }} />
}
