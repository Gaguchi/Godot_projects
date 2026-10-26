// Local QA render of a board: swaps /_blob/<id> for the local asset file, screenshots at 1x.
//   node preview.mjs PxMap1x F64Camp ...        -> out/preview/<Board>.png
//   node preview.mjs --clip x,y,w,h PxMap1x     -> a clipped shot
// Uses the Playwright that game/ installs (cd game && npm install).
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')
const { chromium } = await import(pathToFileURL(resolve(ROOT, '../../game/node_modules/@playwright/test/index.mjs')).href)
const blobs = JSON.parse(readFileSync(`${ROOT}/assets/blobs.json`, 'utf8'))
const map = {}
for (const [k, id] of Object.entries(blobs)) {
  const f = `${ROOT}/assets/up/${k}.png`
  if (existsSync(f)) map[id] = f
}
mkdirSync(`${ROOT}/out/preview`, { recursive: true })
const args = process.argv.slice(2)
const clip = args[0] === '--clip' ? args.splice(0, 2)[1].split(',').map(Number) : null
const browser = await chromium.launch()
for (const name of args) {
  let s = readFileSync(`${ROOT}/out/boards/${name}.dc.html`, 'utf8')
  const w = +s.match(/"\$preview":\{"width":(\d+)/)[1]
  s = s.replace('<script src="./support.js"></script>', '').replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => (map[id] ? 'file:///' + map[id] : m))
  const page = await browser.newPage({ viewport: { width: w, height: 900 } })
  writeFileSync(`${ROOT}/out/preview/${name}.html`, s)
  await page.goto('file:///' + `${ROOT}/out/preview/${name}.html`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const h = await page.evaluate(() => { const el = document.querySelector('x-dc > div'); el.style.minHeight = '0px'; return el.getBoundingClientRect().height })
  if (clip) await page.screenshot({ path: `${ROOT}/out/preview/${name}.png`, clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3] }, fullPage: true })
  else await page.screenshot({ path: `${ROOT}/out/preview/${name}.png`, fullPage: true })
  console.log(name, w, 'x', Math.round(h))
  await page.close()
}
await browser.close()
