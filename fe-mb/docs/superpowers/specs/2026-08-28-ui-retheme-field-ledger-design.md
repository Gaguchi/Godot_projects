# UI Retheme — "Field Ledger"

> **Status:** Approved 2026-08-28 (owner decision via three-way rendered bake-off).
> **Supersedes:** the visual identity of `2026-05-09`-era "Forged & Lit" (the
> candle-lit iron-and-parchment skin chosen 2026-05-28) and the tone sections of
> `docs/research/visual-style-brief.md`. The token SYSTEM, layout grammar,
> legibility contracts and component wrappers those established are UNCHANGED —
> this spec swaps the skin, not the plumbing.
> **Why:** the story bible (`docs/worldbuilding/story-bible.md`) locks an earthy
> Mount & Blade free-company tone and explicitly rejects the candle-lit grimdark
> look. Three candidates were rendered from live token swaps (Banner & Rope,
> Field Ledger, Campaign Map); the owner picked Field Ledger from screenshots.

## 1. Fiction

The game is the company quartermaster's **ledger and camp table under open
sky**. Two grounds, on purpose:

- **The page** — information screens (title, overworld map, town, shop,
  tavern, quest log, loadout, save/load, dialogue): linen canvas
  (`--canvas-base #e7dec9`), walnut ink text (`#2a2119`), flat ink rules,
  brass pins. Daylight.
- **The field** — combat: warm trodden earth under the painted board,
  saddle-leather chrome (`--iron-700 #6a4b2f`) with brass edges
  (`--iron-edge #b08a3e`) and dashed stitch headers. Dark ground stays for
  unit/overlay legibility.

The light/dark seam is a feature: the page describes the field. Materials act —
**canvas = read, leather = act** (the single primary on a page is the one piece
of leather). Nothing glows: no radial pools, no flicker, no embers-as-fire
(the title's motes are daylight dust), no vignettes, no emissive rims.

## 2. Token deltas (authoritative values live in `src/index.css`)

Core swaps: hearth → brass `#d9a93f`/`#b8862b` (fills and edges only — brass
never carries small text on canvas); ember/danger → oxblood `#9a2c22`; ink/ash
→ walnut/dark-oak; parchment ramp → linen ramp; ally `#3f628a` / enemy
`#a6432f` deepened for the light ground; HP ramp re-derived (`--hp-ok #5d7a33`
etc.); new `--canvas-*` ground tokens + `.page-canvas` scope that re-declares
the text/HP ramp so components invert automatically when placed on a page.
Canvas mirror re-valued in `game/boardPalette.ts` (export names unchanged);
board overlay grammar (blue move / red target / purple danger / arcane AoE /
brass active ring) intact. Type voice unchanged: Cinzel display, EB Garamond
body, tabular numerals.

## 3. What must never change (inherited invariants)

1280×720 stage + portal rule; `Button`/`Dialog`/`Tooltip` wrappers as the only
bases; type-voice roles with numerals largest on combat elements; AA 4.5:1 for
small text on BOTH grounds (the `.page-canvas` scope owns the page-side ramp);
colour never the sole channel (sigils, gem shapes, disc/star); one primary per
view; reduced-motion kills every loop; `boardPalette.ts` is the only canvas
colour module.

## 4. Landed vs remaining

**Landed with this spec** (harvested from the bake-off worktree, verified
rendered): tokens + recipes in `index.css`, `boardPalette.ts` mirror, title
screen (ledger sheet pinned to the camp table), combat chrome, overworld
(linen map page + roster page over the daylight band), `GameHud` parchment
mode promoted off its raw `LEDGER_*` hexes.

**Remaining (tracked in Atlas, epic "UI tone retheme"):**
- Page conversions: Town/Inn/Shop/Tavern, DialogueModal, QuestLog, Loadout,
  Save/Load, PauseMenu, CampScene, DungeonScene, BattleEnd — these currently
  inherit token values inside the old dark layouts.
- Copy: `GAME_TITLE`/tagline and the premise-bound lines ("steel remembers",
  "No chronicle yet — forge a new one", "The fire crackles") await the story
  bible's title decision.
- Known contrast edges from the bake-off audit: muted text in the bottom 15%
  of a page gradient (4.16:1 — keep small muted text out of the deep band),
  arcane numeral on card wells (AA-large only), disabled ghosts on pages.
- Policy docs that still teach candle-lit: `docs/research/visual-style-brief.md`,
  `.claude/skills/crafting-game-ui/project-hooks.md` + `materials.md` §1.4/§5,
  `phaser/art/world-bible.md` — update or future agents will re-candle the UI.
- Region palettes / baked vistas are CONTENT tied to the old three-region
  world; revisit with the open-sheet map, not as part of this retheme.
