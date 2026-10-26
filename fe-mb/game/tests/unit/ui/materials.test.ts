/**
 * tests/unit/ui/materials.test.ts — the two material rules of BRIEF §5 that are cheapest to break and cheapest to
 * pin, read straight off the source:
 *   · "one inline-SVG set … no emoji/pictograph unicode in player-visible JSX" — Chrome renders 🍞 ☠ ♨ 🔒 in COLOUR
 *     emoji presentation, which drops a foreign asset into a hand-inked screen (the loudest asset-flip signal there is)
 *   · "nothing glows … light falls, never emits" — no ember pools, no pulsing halos, no emissive rims
 *   · "Tokens only. No hex, no ad-hoc durations." (ARCHITECTURE §5) — the palette lives in ONE file
 *   · ARCHITECTURE §5.1's voice rules — no id, no raw range/grid code, one capitalisation rule per element class
 * None can be caught by a screenshot diff that has no baseline, and every one of them crept back in at least once.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const UI = join(process.cwd(), 'src', 'ui')
const STYLES = join(process.cwd(), 'src', 'styles')

function walk(dir: string, ext: string): readonly string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full, ext) : full.endsWith(ext) ? [full] : []
  })
}

/**
 * Marks that live in the TEXT face — a middle dot, a multiplication sign, the danger chip's filled/hollow ring.
 * They inherit the type's colour and size and never flip to a colour-emoji sprite, so they are typography, not
 * pictographs. Everything else is drawn (`ui/components/Icon.tsx`).
 *
 * The tick and the cross USED to be listed here, on the argument that a `✓` in a stat badge is typography. It is
 * not: `U+2713` / `U+2717` are Dingbats, they are served from whatever fallback face the machine has, they do not
 * match the weight of the hand every other mark on the glass is drawn in — and the set already ships a `check`
 * (RE-GATE B 2.8). `Icon name="check" / "cross"` is the surface; both are banned from JSX by the sweep below.
 */
const TEXT_MARKS = new Set(['·', '—', '–', '×', '●', '○', '∅', '“', '”', '’', '≥', '→'])

/** The pictograph blocks a glyph can be served from as a colour emoji. */
const PICTOGRAPH = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{2600}-\u{26FF}]/u

describe('BRIEF §5 — one drawn icon set, no pictograph unicode in player-visible JSX', () => {
  it('no player-visible source under src/ui carries an emoji or pictograph glyph', () => {
    // Comments are prose for the next reader (this file's own header names the glyphs it bans) — the rule is about
    // what RENDERS, so they come out before the sweep.
    const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    const offenders: string[] = []
    for (const file of walk(UI, '.tsx')) {
      for (const [i, line] of stripComments(readFileSync(file, 'utf8')).split('\n').entries()) {
        for (const ch of line) {
          if (TEXT_MARKS.has(ch)) continue
          if (PICTOGRAPH.test(ch)) offenders.push(`${file.slice(UI.length + 1)}:${i + 1} ${ch}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('every icon name the set declares draws something', async () => {
    const source = readFileSync(join(UI, 'components', 'Icon.tsx'), 'utf8')
    const names = /export type IconName =([\s\S]*?)\n\n/.exec(source)?.[1] ?? ''
    const declared = [...names.matchAll(/'([a-z]+)'/g)].map((m) => m[1]!)
    expect(declared.length).toBeGreaterThan(10)
    const paths = /const PATHS[\s\S]*/.exec(source)?.[0] ?? ''
    for (const name of declared) expect(paths, name).toContain(`${name}:`)
  })
})

describe('BRIEF §5 — nothing glows: light falls, never emits', () => {
  const css = walk(STYLES, '.css').map((f) => ({ file: f.slice(STYLES.length + 1), text: readFileSync(f, 'utf8') }))

  it('no emissive drop-shadow (a halo centred on the element with a blur)', () => {
    const bad = css.flatMap(({ file, text }) => [...text.matchAll(/drop-shadow\(0 0 [1-9]/g)].map(() => file))
    expect(bad).toEqual([])
  })

  it('no ember flicker, ping or pulse keyframes', () => {
    for (const { file, text } of css) {
      expect(text, file).not.toMatch(/@keyframes\s+(flicker|owPing|roomPulse)/)
      expect(text, file).not.toMatch(/animation:\s*(flicker|owPing|roomPulse)/)
    }
  })
})

/**
 * ARCHITECTURE §5 "Tokens only. No hex, no ad-hoc durations." — `styles/index.css` IS the palette; every other
 * stylesheet, and every inline `style` in `src/ui/**`, spends it through `var(--…)`. 21 literal hexes had leaked
 * back into the four screen stylesheets (`#7ba33f` for heal/ward/rest in three files, `#efe2c0` for the map's
 * vellum in three places, the leather letterbox gradient copy-pasted into two TSX files), which is exactly how a
 * palette silently forks.
 *
 * `ui/overworld/palette.ts` is the ONE exemption: it is the map sheet's own declared palette (region inks, a
 * content-shaped table), not an ad-hoc colour, and `NodeMark`/`roadInk` read it rather than inventing values.
 * The exemption list once carried those two consumers as well, which is how three literal hexes — a distant
 * disc, its highlight and a fork of `--color-hearth` — stayed in the tree with the suite green (RE-GATE B 2.1).
 * It is back to one entry; keep it there.
 */
describe('ARCHITECTURE §5 — tokens only: no hex outside the palette file', () => {
  const HEX = /#[0-9a-fA-F]{3,8}\b/g
  const PALETTE = new Set(['index.css'])
  const EXEMPT_TS = new Set(['overworld/palette.ts'])

  it('no stylesheet but index.css names a colour by hex', () => {
    const offenders = walk(STYLES, '.css').flatMap((f) => {
      const name = f.slice(STYLES.length + 1)
      if (PALETTE.has(name)) return []
      return [...readFileSync(f, 'utf8').matchAll(HEX)].map((m) => `${name} ${m[0]}`)
    })
    expect(offenders).toEqual([])
  })

  it('no inline style under src/ui hard-codes a hex colour', () => {
    const offenders = [...walk(UI, '.tsx'), ...walk(UI, '.ts')].flatMap((f) => {
      const name = f.slice(UI.length + 1).split(sep).join('/')
      if (EXEMPT_TS.has(name)) return []
      return [...readFileSync(f, 'utf8').matchAll(HEX)].map((m) => `${name} ${m[0]}`)
    })
    expect(offenders).toEqual([])
  })

  it('the numeric face is embedded, not the OS monospace', () => {
    const tokens = readFileSync(join(STYLES, 'index.css'), 'utf8')
    const decl = /--font-numeric:([^;]+);/.exec(tokens)?.[1] ?? ''
    expect(decl).not.toMatch(/monospace|ui-monospace|system-ui/)
    const family = /"([^"]+)"/.exec(decl)?.[1] ?? ''
    expect(family).not.toBe('')
    // …and it is actually shipped and preloaded, the way Cinzel and EB Garamond are.
    const faces = readFileSync(join(process.cwd(), 'public', 'fonts', 'fonts.css'), 'utf8')
    expect(faces).toContain(`font-family: '${family}'`)
    const woff2 = new RegExp(`src: url\('(/fonts/[^']+\.woff2)'\)`, 'g')
    const declared = [...faces.matchAll(woff2)].map((m) => m[1]!)
    for (const url of declared) expect(existsSync(join(process.cwd(), 'public', url))).toBe(true)
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    expect(html).toMatch(new RegExp(`rel="preload" href="/fonts/${family.toLowerCase()}[^"]*\.woff2"`))
  })

  it('the face sheet is linked exactly once', () => {
    // It was linked from `index.html` AND `@import`ed from `styles/index.css`, so every boot fetched the same
    // stylesheet twice and `document.fonts` held 16 faces instead of 8, half of them permanently `unloaded`
    // (RE-GATE C 3.20). The document head is the one home — it is where the preloads are.
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    expect([...html.matchAll(/\/fonts\/fonts\.css/g)]).toHaveLength(1)
    for (const file of walk(STYLES, '.css')) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/@import[^;]*fonts\.css/)
    }
  })

  it('no browser disabled-cursor inside a game surface', () => {
    const offenders = [...walk(STYLES, '.css'), ...walk(UI, '.tsx')]
      .filter((f) => /not-allowed/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})

/**
 * ARCHITECTURE §5.1 — the voice rules. Every one of these shipped broken: seven screens printed
 * `classId.replace(/_/g, ' ')` although `classes.json` ships `"name": "Lord"`, the Title screen printed the raw
 * node id as the place, twenty event headlines carried a terminal full stop that no other headline in the game
 * carries, and the card foot printed the authored range code ("a tile r2") on the loudest element on screen.
 */
const NEWLINE = String.fromCharCode(10)

describe('ARCHITECTURE §5.1 — no id, no raw code, one capitalisation rule', () => {
  const ui = [...walk(UI, '.tsx'), ...walk(UI, '.ts')].map((f) => ({
    file: f.slice(UI.length + 1).split(sep).join('/'),
    text: readFileSync(f, 'utf8'),
  }))

  it('nothing under src/ui humanises an id with replace(/_/g, ...)', () => {
    // `ui/names.ts` owns the ONE fallback, for a save that outlived the content that named it.
    const offenders = ui.filter((f) => f.file !== 'names.ts' && /replace\(\/_\/g/.test(f.text)).map((f) => f.file)
    expect(offenders).toEqual([])
  })

  /**
   * FINAL GATE C 3.10 — a slice of a word is not an initial. `displayName.slice(0, 2)` was copy-pasted into eight
   * face slots, so Guildmistress Anya — the giver of the first contract and the host of the naming beat — was
   * delivered by a plain brown disc reading "Gu", a two-letter piece of a TITLE. The reachable slot is drawn now
   * (`components/Sigil`); the rest ask `names.ts#initialsOf`, and nothing under src/ui may cut a name again.
   */
  it('no face slot cuts a name into a two-letter slice', () => {
    const offenders: string[] = []
    for (const f of ui) {
      if (f.file === 'names.ts') continue // initialsOf itself takes the first two WORDS
      for (const [i, line] of f.text.split(NEWLINE).entries()) {
        if (/^\s*\*/.test(line)) continue // the finding is quoted verbatim in several file headers
        if (/(?:name|displayName)[^~]*[.]slice[(][ ]*0[ ]*,[ ]*2[ ]*[)]/.test(line)) offenders.push(`${f.file}:${i + 1}`)
      }
    }
    expect(offenders).toEqual([])
  })

  /** The identity record every character has carried since the first commit is DRAWN, not printed as letters. */
  it('the talk frame draws a speaker with no likeness, and names no ink to do it', () => {
    const talk = ui.find((f) => f.file === 'overlays/DialogueOverlay.tsx')!.text
    expect(talk).toMatch(/<Sigil[ /]/)
    const sigil = ui.find((f) => f.file === 'components/Sigil.tsx')!.text
    // colour is CSS: the component sets data-accent and the `--id-*` ramp does the rest
    expect(sigil).toMatch(/data-accent=/)
    expect(sigil).not.toMatch(/var\(--id-/)
    const index = readFileSync(join(STYLES, 'index.css'), 'utf8')
    for (const accent of ['gold', 'steel', 'rose', 'moss', 'arcane', 'ember', 'slate', 'wine']) {
      expect(index, accent).toContain(`.sigil[data-accent="${accent}"]`)
    }
  })

  it('every class shown to the player has an authored display name', () => {
    const classes = JSON.parse(readFileSync(join(process.cwd(), 'src', 'content', 'data', 'classes.json'), 'utf8')) as { id: string; name: string }[]
    for (const c of classes) {
      expect(c.name, c.id).toBeTruthy()
      expect(c.name, c.id).not.toBe(c.id)
      expect(c.name, c.id).toMatch(/^[A-Z]/)
    }
  })

  it('event headlines are sentence case with no terminal full stop', () => {
    const dir = join(process.cwd(), 'src', 'content', 'data', 'checkEvents')
    const titles = readdirSync(dir).map((n) => ({
      n, title: (JSON.parse(readFileSync(join(dir, n), 'utf8')) as { title: string }).title,
    }))
    expect(titles.length).toBeGreaterThan(10)
    for (const { n, title } of titles) {
      expect(title, n).toMatch(/^[A-Z]/)
      expect(title, n).not.toMatch(/\.$/)
    }
  })

  it('no card face or shop shelf prints a raw range or grid code', () => {
    const hand = readFileSync(join(UI, 'combat', 'CardHand.tsx'), 'utf8')
    expect(hand).not.toMatch(/`[^`]*\br\$\{/)          // `foes r${radius}`
    expect(hand).not.toMatch(/\$\{e\.turns\}t\b/)      // `3t`
    expect(hand).not.toMatch(/\$\{e\.effectId\}/)      // the status id itself
    const town = readFileSync(join(UI, 'screens', 'Town.tsx'), 'utf8')
    expect(town).not.toMatch(/gridSize\.width\}×\$\{/) // `sword · 1×2`
  })

  /**
   * The gate found sixteen `title=` attributes carrying every disabled-with-reason in the game, and the e2e suite
   * had written four of them down as the contract — which is how a reason that is invisible, late, unthemed and
   * unreachable from the keyboard stayed shipped. `ui/components/Tooltip` is the surface now; `title` on an
   * `<Icon>` is the SVG's accessible name, not a browser tooltip, so that one stays.
   */
  it('no player-facing element hands its reason to a native browser tooltip', () => {
    const offenders: string[] = []
    for (const f of ui) {
      if (f.file === 'components/Icon.tsx') continue
      for (const [i, line] of f.text.split('\n').entries()) {
        if (!/(^|\s)title=/.test(line)) continue
        if (/<Icon\b/.test(line)) continue // <Icon … title="sealed" /> is the svg's accessible name
        offenders.push(`${f.file}:${i + 1}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('a disabled control is unlit, not desaturated into a web-form slab', () => {
    // `filter: saturate(…)` drags the brass clean out of the Field Ledger palette, and the state belongs to the
    // recipe in styles/index.css keyed off aria-disabled, never to an inline style in the component.
    const button = readFileSync(join(UI, 'components', 'Button.tsx'), 'utf8')
    expect(button).not.toMatch(/saturate\(/)
    const index = readFileSync(join(STYLES, 'index.css'), 'utf8')
    expect(index).toMatch(/\.btn-forged\[aria-disabled="true"\]/)
    // …and a ghost is still a control at rest: a transparent idle border is not chrome
    const ghost = /\.btn-forged--ghost \{([^}]*)\}/.exec(index)?.[1] ?? ''
    expect(ghost).not.toMatch(/border-color:\s*transparent/)
  })

  it('reduced motion and ?motion=0 are the same switch', () => {
    // `?motion=0` used to zero only the pump delays, so a screen screenshotted the instant it became visible was
    // still mid-fade at opacity 0 (GATE3-14).
    const timings = readFileSync(join(UI, 'timings.ts'), 'utf8')
    expect(timings).toMatch(/data-motion/)
    const index = readFileSync(join(STYLES, 'index.css'), 'utf8')
    expect(index).toMatch(/:root\[data-motion="off"\]/)
    // and no stylesheet carries a dangling selector list — that is how the map's one looping animation went ungated
    for (const file of walk(STYLES, '.css')) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/,\s*\n\s*\}/)
    }
  })

})
