#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

// Re-baselined 2026-07-06 for the beta feature set (story 478): the old
// 432.67 KB baseline + 75 was scoped to the ui-input-overhaul milestone.
// Beta added the full gear catalog (161 cards / 49 items JSON), the enemy
// roster + AI content, quests/events, and the WebAudio engine → 528 KB.
// New budget: beta baseline + 40 KB headroom for the remaining hardening.
const BASELINE_KB = 528.08          // gzipped JS at beta feature-complete
const CEILING_DELTA_KB = 40
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
console.log(`Baseline:  ${BASELINE_KB} KB gzipped (beta feature-complete)`)
console.log(`Ceiling:   ${CEILING_KB.toFixed(2)} KB gzipped (baseline + ${CEILING_DELTA_KB})`)
console.log(`Actual:    ${actualKB} KB gzipped (${deltaKB > 0 ? '+' : ''}${deltaKB})`)

if (Number(actualKB) > CEILING_KB) {
  console.error(`FAIL: bundle exceeds ${CEILING_KB.toFixed(2)} KB ceiling by ${(Number(actualKB) - CEILING_KB).toFixed(2)} KB`)
  process.exit(1)
}
console.log('PASS')
