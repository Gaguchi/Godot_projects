#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BASELINE_KB = 432.67          // gzipped JS at phaser-vertical-slice tag
const CEILING_DELTA_KB = 75
const CEILING_KB = BASELINE_KB + CEILING_DELTA_KB

if (!existsSync('dist/assets')) {
  console.log('No dist found, building...')
  execSync('npm run build', { stdio: 'inherit' })
}

const files = readdirSync('dist/assets')
  .filter((f) => f.endsWith('.js'))
  .map((f) => join('dist/assets', f))

let totalGzip = 0
for (const f of files) {
  const buf = readFileSync(f)
  totalGzip += gzipSync(buf).length
}

const actualKB = (totalGzip / 1024).toFixed(2)
const deltaKB = (Number(actualKB) - BASELINE_KB).toFixed(2)

console.log('--- Bundle gate ---')
console.log(`Baseline:  ${BASELINE_KB} KB gzipped (phaser-vertical-slice)`)
console.log(`Ceiling:   ${CEILING_KB.toFixed(2)} KB gzipped (baseline + ${CEILING_DELTA_KB})`)
console.log(`Actual:    ${actualKB} KB gzipped (${deltaKB > 0 ? '+' : ''}${deltaKB})`)

if (Number(actualKB) > CEILING_KB) {
  console.error(`FAIL: bundle exceeds ${CEILING_KB.toFixed(2)} KB ceiling by ${(Number(actualKB) - CEILING_KB).toFixed(2)} KB`)
  process.exit(1)
}
console.log('PASS')
