# Project hooks — FE_MB `phaser/` (verify against code; re-verified 2026-08-28)

How this skill binds to THIS repo. Code wins over this file; update on drift.

**Visual authority:** `docs/superpowers/specs/2026-08-28-ui-retheme-field-ledger-design.md`
("Field Ledger"). Its §1 fiction and §3 invariants are binding and they
SUPERSEDE the older candle-lit "Forged & Lit" direction that earlier versions
of this file taught. Tone context: `docs/worldbuilding/story-bible.md`.

## The fiction, in four lines

The game is the company quartermaster's **ledger and camp table in daylight**.

- **PAGE** (light) = information you READ: linen canvas, walnut ink, flat ink
  rules, brass pins. Title, overworld map, town, shop, tavern, quest log,
  loadout, save/load, dialogue.
- **FIELD** (dark) = things you ACT ON: warm earth / saddle leather with brass
  edges and dashed stitch headers. Combat, camp, dungeon — dark ground kept so
  units and overlays stay legible.
- **Materials act: canvas = read, leather = act.** The ONE primary action on a
  page is the one piece of leather on it. That is how you direct the eye.
- **NOTHING GLOWS.** No radial hearth pools, no flicker, no ember-as-fire, no
  emissive rims, no vignettes. Motes may exist only as daylight dust.

## The token system ("Field Ledger") — `phaser/src/index.css`

Already defined and GOOD — the failure mode here is not using it. **You may not
invent a value; if a token is missing, add it to `index.css`, never to a
component.**

- Type voices: `--font-display` (Cinzel) / `--font-body` (EB Garamond) /
  `--font-numeric` (tabular mono). Utilities: `.voice-display`, `.numeral`.
- **Ground scopes** — the whole trick of the system. `.page-canvas` (a whole
  screen) and `.surface-parchment` (a card) re-declare the text + HP ramp on
  themselves; `.surface-iron` / `.hud-panel` / `.btn-forged` / `.forged-card`
  re-assert the bone ramp. So a component moved between grounds **inverts
  automatically** — by specificity, not source order. Ghost buttons are
  deliberately excluded (no material of their own → they take the ground's ramp).
- Page ground: `--canvas-base #e7dec9` / `--canvas-mid` / `--canvas-deep`,
  `--canvas-rule`. Leather ramp: `--iron-900/800/700` + `--iron-edge` (brass).
- Palette by ROLE (names are frozen for the `boardPalette.ts` mirror, so some
  read oddly): `--color-parchment` = "primary text on THIS ground",
  `--color-parchment-dim` = secondary, `--color-text-muted` = muted,
  `--color-ink` = walnut, `--color-hearth` = the one struck-brass accent,
  `--color-ember` = oxblood danger, team `--color-ally/enemy`, gem hues,
  `--hp-*` tiers, `--id-*` identity ramp (WHO someone is — never actions,
  never threat).
- Materials: `.surface-iron`, `.surface-parchment`, `.hud-panel(-header)`,
  `.hud-divider`, `.iron-grain`, `.ap-pip`, `.hp-bar`, `--bevel-iron`,
  `--rivet-tl/tr/bl/br`, `--elevation-flat/raised/float`, `--focus-ring`.
- Daylight: `.hearth-glow(-strong)` is now a **top-down daylight wash**, not a
  radial pool. `--key-light-dx/dy` is the canonical overworld key-light vector
  (high, from the LEFT) — every grounding shadow derives from it.
- Motion: `--dur-instant/quick/move/settle` + `--ease-out-quart/expo/impact`,
  keyframes (`phaseBanner`, `fogDrift*`, `emberRise`, `nodePing`, `roadDash`,
  `roadComet`) — all collapse under reduced-motion. `hearthFlicker` is retained
  as an **inert** hook (daylight does not gutter); `emberRise` is now **dust
  lifting off a camp track**, same motion contract, no fire.

**Material rule (from the index.css header): leather = chrome you ACT on;
canvas = information you READ. Texture lives on chrome, never on numeric data.
One brass accent per screen. Light falls; it never emits.**

## Rules when touching phaser UI

1. **No new hex values in components.** Consume tokens/utilities. New board
   (canvas) colors go in `game/boardPalette.ts` — the ONE named-constant
   palette module, a numeric mirror of the CSS tokens (BoardScene can't read
   CSS vars). Keep the two in sync.
2. **Never bypass `components/Button.tsx`** with a raw `<button>` — and when
   improving looks, restyle the `.btn-forged*` recipes in `index.css` (all
   screens inherit them). Same for `Dialog`, `Tooltip`, `Menu`, `ListBox`.
3. **Do not re-candle the UI.** If you find yourself reaching for a radial
   warm gradient, a flicker keyframe, a vignette, an emissive rim or a
   glow-on-hover, stop — that is the retired direction. Direct the eye with
   *material* (one leather primary on a canvas page) and *placement*, not light.
4. Respect the architecture fence: Phaser canvas = board only; everything
   else React DOM. Vignettes/panels never migrate into the canvas; board
   overlays never into DOM.
5. `boardGeometry.ts` is the single source of board math for BOTH canvas and
   HUD drag code (`HAND_TOP_Y` etc. — no bare pixel literals).
6. Contrast contract: small text clears **AA 4.5:1** against its own ground —
   and on a page, against BOTH `--canvas-base` and `--canvas-mid`. Keep small
   muted text OUT of the bottom ~15% deep band of a page gradient (audited at
   4.16:1 there). Verify with computed styles in the browser, not by eye.
7. Update `phaser/CONTEXT.md` in the same commit if exports change
   (`npm run check-context-doc` gates CI).

## Quality bar — match the showpieces

The best-realized surfaces set the bar; new work should look like it belongs
next to them:

- **`screens/TitleScreen.tsx`** — the reference PAGE. A linen ledger sheet
  (820px on the 1280 stage, so the table shows either side and the page reads
  as an *object*) pinned to the camp table with brass corner brackets; walnut
  title between two flat ink rules; **New Game is the single piece of leather
  on the page**; Load/Quit recede to ghosts. Copy its idioms verbatim.
- **`screens/OverworldScene.tsx` + `overworld/PaperMap.tsx` / `TravelBand.tsx`**
  — the linen map page and the roster page over the daylight travel band.
- **`scenes/combat/*` + `components/Card.tsx`** — the reference FIELD: saddle-
  leather straps, brass rivets, dashed stitch headers, numerals largest.
- **`components/GameHud.tsx`** — `surface="parchment"` mode, the band-safe
  ledger card (its raw `LEDGER_*` hexes are gone; it consumes tokens).

**Weakest tier** (still inheriting Field Ledger token *values* inside the old
dark layouts — match the bar when you touch them): Town/Inn/Shop/Tavern,
DialogueModal, QuestLog, PartyLoadoutModal, Save/Load, PauseMenu, CampScene,
DungeonScene, BattleEndModal. Spec §4 "Remaining" is the live list — check it
and the code before trusting this paragraph, conversions are landing in waves.

## The screenshot loop (Iron Rule mechanics)

- Dev server: `npm run dev` in `phaser/` → http://localhost:5183 (pinned;
  5173 belongs to another app). Parallel agents: `npx vite --port 0 --strictPort`.
- Playwright MCP or `npx playwright test`: drive to the state, screenshot at
  1280×720 CSS. Dev fast-paths `/?view=town|overworld|combat|dungeon|camp`.
  Dev builds expose `window.__debug` (combatStore/runStore/metaStore dispatch
  + `diag`) and `window.__game` (Phaser) — seed any state deterministically:
  `applyQuestEffects` with a `startCombat` effect for battles, store `setState`
  for HP/phase. `tests/e2e/helpers.ts` has the established seeding idioms.
- Verify contrast with computed styles in the page, not by eye.
- Visual regression: `tests/e2e/visual.spec.ts` snapshots
  (`--update-snapshots` after intended changes; tolerance is tight on purpose).
- Full gate: `npm run verify` + `npx playwright test`.

## Known drift points (re-verified 2026-08-28 — fix opportunistically, never extend)

**Still live:**

- **Stock-Tailwind colour island — now a DungeonScene/CampScene cluster, not a
  component-library problem.** Counts of `amber-*/stone-*/red-*/…` utilities:
  `screens/DungeonScene.tsx` **42** (incl. a whole legend row of
  `text-red-500 / purple-400 / emerald-400 / red-600 / red-400` — five hues, no
  token, no shape channel), `screens/CampScene.tsx` **14**. Residue elsewhere:
  `ListBox` 7, `PartyChip` 8, `Menu` 3, `OverworldScene` 3, and 1–2 each in
  `Card`, `Dialog`, `GameHud`, `Heading`, `Icon`, `QuitModal`.
- **Three HP-tier implementations → now two.** `scenes/combat/hpTier.ts` is
  canonical and correctly delegates its THRESHOLDS to
  `game/boardPalette.hpTierFor`. `components/PartyChip.tsx:29` still rolls its
  own (`text-amber-200 / amber-400 / red-400` at 0.5 / 0.25) — different colours
  AND different thresholds. Fix by consuming `hpTextClass`.
- **One native `title=` tooltip left:** `components/PartyChip.tsx:34`. (The
  `title=` in `CampScene`/`OverworldScene` are component *props*, not HTML
  attributes — leave them.) Use the `Tooltip` component.
- **One magic offset left:** `scenes/combat/UnitDetailPanel.tsx:38`
  `fixed top-36 right-4`.
- `components/PartyChip.tsx` also predates the ground scopes — it hard-codes
  `ring-amber-700/50` and `bg-stone-950/85` rather than taking a ramp.

**FIXED — do not re-report these (verified against the code):**

- ~~Button/Tooltip stock-Tailwind~~ — `Button.tsx` and `Tooltip.tsx` now carry
  **zero** stock-palette utilities; Button consumes the `.btn-forged*` recipes.
- ~~BoardScene duplicates token values as hex literals~~ — `game/scenes/
  BoardScene.ts` now has **zero** hex literals; all colour comes from
  `game/boardPalette.ts`.
- ~~Fonts load from a Google CDN~~ — Cinzel + EB Garamond are **self-hosted**
  woff2 in `phaser/public/fonts` (`fonts.css`), preloaded from `index.html`.
  No network dependency, no flash-of-Georgia.
- ~~Magic-offset chain in combat HUD~~ — `CombatHud.tsx` children now flow in a
  column (see its comment at :139); `CardHand.tsx` uses `HAND_TOP_Y` from
  `domain/boardGeometry.ts` instead of a bare `560`. Only `UnitDetailPanel`
  remains (above).
- ~~`×`/`▾` text glyphs in several modals~~ — the surviving `×` are genuine
  multiplication signs in counts (`PartyLoadoutModal` `×{count}`,
  `ForecastStatusRow` stacks) and `NodeBeacon`'s `✕` is a designed failed
  badge. `DevHud`'s `×` close button is dev-only and out of scope.
- ~~`GameHud` raw `LEDGER_*` hexes~~ — gone; it consumes tokens.
</content>
