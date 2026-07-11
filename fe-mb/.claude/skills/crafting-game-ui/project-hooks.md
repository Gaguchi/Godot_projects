# Project hooks — FE_MB `phaser/` (verify against code; written 2026-07-10)

How this skill binds to THIS repo. Code wins over this file; update on drift.

## The token system ("Forged & Lit") — `phaser/src/index.css`

Already defined and GOOD — the failure mode here is not using it:
- Type voices: `--font-display` (Cinzel) / `--font-body` (EB Garamond) /
  `--font-numeric` (tabular mono). Utilities: `.voice-display`, `.numeral`.
- Palette: `--color-hearth` (THE scarce "act here" amber — one per screen),
  `--color-ember`, `--color-ink/ash`, `--color-parchment(-dim)`,
  `--color-text-muted`, team `--color-ally/enemy`, gem hues, `--hp-*` tiers.
- Materials: `.surface-iron`, `.surface-parchment`, `.hud-panel(-header)`,
  `.hud-divider`, `.iron-grain`, `.hearth-glow(-strong)`, `--bevel-iron`.
- Motion: `--dur-instant/quick/move/settle` + `--ease-out-quart/expo/impact`,
  keyframes (`phaseBanner`, `hearthFlicker`, `fogDrift*`, `emberRise`,
  `nodePing`, `roadDash`) — all collapse under reduced-motion.

**Material rule (from index.css header): iron = chrome you ACT on; parchment
= information you READ. Texture lives on chrome, never on numeric data. One
hearth glow per screen.**

## Rules when touching phaser UI

1. **No new hex values in components.** Consume tokens/utilities. New board
   (canvas) colors go in ONE named-constant palette module, derived from the
   same values as CSS (BoardScene can't read CSS vars — keep the bridge file
   in sync, or generate it).
2. **Never bypass `components/Button.tsx`** with a raw `<button>` — and when
   improving looks, restyle Button's variants (all screens inherit it).
3. Respect the architecture fence: Phaser canvas = board only; everything
   else React DOM. Vignettes/panels never migrate into the canvas; board
   glows/frames never into DOM.
4. `boardGeometry.ts` is the single source of board math for BOTH canvas and
   HUD drag code.
5. Update `phaser/CONTEXT.md` in the same commit if exports change
   (`npm run check-context-doc` gates CI).

## Quality bar — match the showpieces

The best-realized surfaces set the bar; new work should look like it belongs
next to them: `TitleScreen.tsx` (hearth plate + embers), `overworld/TravelBand.tsx`
+ `PaperMap.tsx` (band + ink cartography), `components/Card.tsx` (forged card),
`modals/DialogueModal.tsx` (bust band). The weakest tier (match the bar when
touching them): PauseMenu, Save/Load, Inn/Shop/Tavern panels, QuestLog,
PartyLoadoutModal, CampScene.

## The screenshot loop (Iron Rule mechanics)

- Dev server: `npm run dev` in `phaser/` → http://localhost:5183 (pinned;
  5173 belongs to another app).
- Playwright MCP or `npx playwright test`: drive to the state, screenshot at
  1280×720 CSS. Dev builds expose `window.__debug` (combatStore/runStore/
  metaStore dispatch + `diag`) and `window.__game` (Phaser) — seed any state
  deterministically: `?view=combat` boot, `applyQuestEffects` with a
  `startCombat` effect for battles, store `setState` for HP/phase.
- Visual regression: `tests/e2e/visual.spec.ts` masked snapshots
  (`--update-snapshots` after intended changes).
- Full gate: `npm run verify` + `npx playwright test`.

## Known drift points (fix opportunistically, never extend)

- Stock-Tailwind color island: Button/Menu/ListBox/Tooltip + most modals use
  `amber-*/stone-*/red-*` instead of tokens — two color systems coexist.
- BoardScene duplicates token values as hex literals (HP tiers, hearth ring,
  highlight fills) and re-declares font stacks (canvas can't read CSS).
- Three HP-tier implementations: `hpTier.ts` (canonical), PartyChip,
  CampScene (different colors AND thresholds).
- Magic-offset chain in combat HUD: ModeLabel `top-[13rem]`, InitiativeStrip
  `top-[6.25rem]`, UnitDetailPanel `top-36`; `CardHand.tsx` `pt.y < 560`.
- Fonts load from Google CDN (flash of Georgia; network dependency for a
  desktop build) — self-hosting is the fix.
- `title=` tooltips and `×`/`▾` text glyphs in several modals (Icon set and
  Tooltip component exist — use them).
