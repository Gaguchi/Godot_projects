/**
 * "Every `Effect['kind']` has an emit site" (CONTRACT §7 WP-FLOW; brief §7.8 "a member lands with its
 * emitter/reader and a test"). This is the guard that would have caught `banner` — a kind in the union, a branch
 * in the CLI, and nothing in the engine that ever produced one.
 *
 * The sweep is textual on purpose: it reads `effects.ts` for the declared kinds and every other engine module for
 * the literals that build them, so a kind added "for later" fails here the moment it lands.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ENGINE = join(process.cwd(), 'src', 'engine')
const EFFECTS = join(ENGINE, 'effects.ts')

function tsFiles(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return tsFiles(full)
    return name.endsWith('.ts') ? [full] : []
  })
}

/** The kinds declared by the union, in source order. */
function declaredKinds(): readonly string[] {
  const src = readFileSync(EFFECTS, 'utf8')
  const kinds = [...src.matchAll(/readonly kind: '([A-Za-z]+)'/g)].map((m) => m[1] as string)
  return [...new Set(kinds)]
}

describe('effects — declared is emitted', () => {
  const kinds = declaredKinds()
  const sources = tsFiles(ENGINE).filter((f) => f !== EFFECTS).map((f) => readFileSync(f, 'utf8'))

  it('the union is not empty and every kind is unique', () => {
    expect(kinds.length).toBeGreaterThan(40)
    expect(new Set(kinds).size).toBe(kinds.length)
  })

  it('every kind is emitted somewhere under src/engine/**', () => {
    const orphans = kinds.filter((k) => !sources.some((src) => src.includes(`kind: '${k}'`)))
    expect(orphans, `declared with no emitter: ${orphans.join(', ')}`).toEqual([])
  })

  it('the union no longer declares `banner` — the kind with no emitter and no reader', () => {
    expect(kinds).not.toContain('banner')
  })
})
