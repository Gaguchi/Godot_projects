/**
 * Parametric mage VARIANT generator for the fast rating loop. Composes clean
 * block-in mages by varying build (proportions), headpiece, robe palette, and
 * staff side, then renders each to public/sprites/lab/<id>@review.png and writes
 * a manifest.json. Run sprite-lab to rate them; I read lab/ratings.json and bias
 * the next batch toward what you marked good.
 *
 *   npm run gen-variants            (default batch)
 *   npx tsx scripts/cli/gen-variants.ts
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSprite, addOutline, upscale, type SpriteSpec, type SpritePart, type Rgba } from '../../src/systems/pixel/renderSprite'
import { trapezoid, ellipse, vline, shadeEdges } from '../../src/systems/pixel/shapes'
import { encodePng } from './png'

const HERE = dirname(fileURLToPath(import.meta.url))
const LAB = join(HERE, '..', '..', 'public', 'sprites', 'lab')
const W = 48
const H = 48
const CX = 24
const HEM = 43
const REVIEW = 6
const INK: Rgba = [26, 20, 16, 255]
const SELOUT: Rgba = [58, 46, 34, 255]

const BASE_PAL: Record<string, string | null> = {
  '.': null, K: '#1a1410', s: '#ffdbb5', f: '#d4956a',
  i: '#e8c878', I: '#ffe9b0', j: '#b08a3a',
  w: '#6b4a2c', g: '#e8a93a', G: '#ffe39a', b: '#7ba6dd', d: '#3f6aa0',
}
const HUES: Record<string, { p: string; v: string; u: string }> = {
  violet: { p: '#8a63d6', v: '#b89cf0', u: '#4e3a82' },
  blue: { p: '#3f6aa0', v: '#7ba6dd', u: '#22314f' },
  crimson: { p: '#b5384a', v: '#e0707f', u: '#6e1d2a' },
  teal: { p: '#2f8f86', v: '#6fd0c6', u: '#175049' },
  green: { p: '#4e8f3a', v: '#86c46a', u: '#2a5020' },
  ash: { p: '#5a5560', v: '#8a8590', u: '#312e36' },
}
interface Build { headW: number; headH: number; robeTopW: number; robeBotW: number; robeH: number; baseW: number; staffH: number }
const BUILDS: Record<string, Build> = {
  heroic: { headW: 10, headH: 10, robeTopW: 10, robeBotW: 24, robeH: 26, baseW: 18, staffH: 30 },
  balanced: { headW: 11, headH: 11, robeTopW: 12, robeBotW: 22, robeH: 22, baseW: 18, staffH: 28 },
  tall: { headW: 9, headH: 9, robeTopW: 9, robeBotW: 20, robeH: 30, baseW: 16, staffH: 34 },
  chunky: { headW: 12, headH: 11, robeTopW: 16, robeBotW: 30, robeH: 18, baseW: 22, staffH: 26 },
}

function poke(grid: string[], cells: Array<[number, number, string]>): string[] {
  const g = grid.map((r) => [...r])
  for (const [x, y, ch] of cells) {
    const row = g[y]
    if (row && x >= 0 && x < row.length) row[x] = ch
  }
  return g.map((r) => r.join(''))
}

function buildHead(w: number, h: number): string[] {
  let g = ellipse(w, h, 's')
  const ey = Math.max(1, Math.round(h * 0.4))
  const eL = Math.round(w * 0.3)
  const eR = w - 1 - eL
  const nx = Math.floor(w / 2)
  const ny = Math.min(h - 2, Math.round(h * 0.62))
  g = poke(g, [[eL, ey, 'K'], [eR, ey, 'K'], [nx, ny, 'f']])
  return g
}

const GEM = ['.g.', 'gGg', '.G.']

function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)) }

function compose(build: Build, hat: string, side: 'L' | 'R'): SpritePart[] {
  const b = build
  const robeY = HEM - b.robeH
  const headX = CX - Math.floor(b.headW / 2)
  const headY = robeY - b.headH + 2
  const parts: SpritePart[] = []

  parts.push({ name: 'base_shadow', at: [CX - Math.floor((b.baseW + 4) / 2), HEM + 1], rows: ellipse(b.baseW + 4, 4, 'd') })
  parts.push({ name: 'base_disc', at: [CX - Math.floor(b.baseW / 2), HEM], rows: ellipse(b.baseW, 4, 'b') })
  parts.push({ name: 'robe', at: [CX - Math.floor(b.robeBotW / 2), robeY], rows: verticalShade(shadeEdges(trapezoid(b.robeTopW, b.robeBotW, b.robeH, 'p'), 'v', 2, 'u', 3)) })

  // staff (behind body) + gem
  const staffX = side === 'R' ? clamp(CX + Math.floor(b.robeTopW / 2) + 2, 0, W - 2) : clamp(CX - Math.floor(b.robeTopW / 2) - 4, 0, W - 2)
  const staffTop = headY - 2
  parts.push({ name: 'staff', at: [staffX, staffTop], rows: vline(b.staffH, 'w', 2) })
  parts.push({ name: 'gem', at: [staffX - 1, staffTop - 3], rows: GEM })

  if (hat === 'hood') parts.push({ name: 'hood', at: [CX - Math.floor((b.headW + 4) / 2), headY - 2], rows: ellipse(b.headW + 4, b.headH + 3, 'u') })

  parts.push({ name: 'head', at: [headX, headY], rows: buildHead(b.headW, b.headH) })

  if (hat === 'hair') {
    const hairH = Math.max(3, Math.round(b.headH * 0.5))
    parts.push({ name: 'hair', at: [headX - 1, headY - 1], rows: ellipse(b.headW + 2, hairH, 'i') })
  } else if (hat === 'point' || hat === 'wide') {
    const brimW = b.headW + (hat === 'wide' ? 12 : 6)
    const coneH = hat === 'wide' ? 7 : 12
    parts.push({ name: 'hat_cone', at: [CX - Math.floor((brimW - 4) / 2), headY - 1 - coneH + 2], rows: trapezoid(2, brimW - 4, coneH, 'u') })
    parts.push({ name: 'hat_brim', at: [CX - Math.floor(brimW / 2), headY - 1], rows: ellipse(brimW, 3, 'u') })
  }
  return parts
}

function verticalShade(grid: string[]): string[] {
  return grid.map((row) => {
    const ch = [...row]
    let first = -1
    let last = -1
    for (let i = 0; i < ch.length; i++) { if (ch[i] !== '.') { if (first < 0) first = i; last = i } }
    if (first < 0) return row
    const span = last - first
    const hi = first + Math.round(span * 0.32)
    const lo = first + Math.round(span * 0.66)
    if (ch[hi] !== undefined && ch[hi] !== '.') ch[hi] = 'v'
    if (ch[lo] !== undefined && ch[lo] !== '.') ch[lo] = 'u'
    return ch.join('')
  })
}

interface Config { id: string; build: string; hat: string; hue: string; side: 'L' | 'R' }

// Batch 1 — a spread across the design space so the first ratings localise taste.
const BATCH: Config[] = [
  { id: 'v01', build: 'heroic', hat: 'hair', hue: 'violet', side: 'R' },
  { id: 'v02', build: 'heroic', hat: 'hood', hue: 'violet', side: 'R' },
  { id: 'v03', build: 'heroic', hat: 'point', hue: 'violet', side: 'R' },
  { id: 'v04', build: 'heroic', hat: 'wide', hue: 'blue', side: 'L' },
  { id: 'v05', build: 'balanced', hat: 'point', hue: 'crimson', side: 'R' },
  { id: 'v06', build: 'balanced', hat: 'hood', hue: 'teal', side: 'L' },
  { id: 'v07', build: 'tall', hat: 'point', hue: 'violet', side: 'L' },
  { id: 'v08', build: 'tall', hat: 'hood', hue: 'blue', side: 'R' },
  { id: 'v09', build: 'tall', hat: 'hair', hue: 'crimson', side: 'R' },
  { id: 'v10', build: 'chunky', hat: 'wide', hue: 'violet', side: 'R' },
  { id: 'v11', build: 'chunky', hat: 'point', hue: 'green', side: 'L' },
  { id: 'v12', build: 'balanced', hat: 'hair', hue: 'ash', side: 'R' },
]

function main(): void {
  rmSync(LAB, { recursive: true, force: true })
  mkdirSync(LAB, { recursive: true })
  const manifest: Array<{ id: string; label: string; config: Config }> = []
  for (const cfg of BATCH) {
    const build = BUILDS[cfg.build]!
    const hue = HUES[cfg.hue]!
    const spec: SpriteSpec = {
      id: cfg.id, w: W, h: H,
      palette: { ...BASE_PAL, p: hue.p, v: hue.v, u: hue.u },
      parts: compose(build, cfg.hat, cfg.side),
    }
    const img = addOutline(renderSprite(spec), INK, SELOUT)
    writeFileSync(join(LAB, `${cfg.id}@review.png`), encodePng(upscale(img, REVIEW)))
    writeFileSync(join(LAB, `${cfg.id}.json`), JSON.stringify({ ...spec, outline: true }, null, 2) + '\n')
    const label = `${cfg.build} · ${cfg.hat} · ${cfg.hue} · staff-${cfg.side}`
    manifest.push({ id: cfg.id, label, config: cfg })
    console.log(`  ✓ ${cfg.id}  ${label}`)
  }
  writeFileSync(join(LAB, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`generated ${manifest.length} variants -> public/sprites/lab/  (run: npm run sprite-lab)`)
}

main()
