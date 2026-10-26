# Repo hooks — FE_MB `phaser/` (written 2026-09-04; code wins over this file)

How `drawing-maps` binds to THIS repo. Verify paths against the code before
trusting them; update on drift.

## Battle boards

**What a battle actually carries today:** `CombatGrid` in
`src/domain/combatState.ts` — `width`, `height`, `obstacles: Set<TileId>`,
and the optional authored `floor?: string[]` (tile ids that wear dirt).
Terrain kinds, defence bonuses, and spawn zones exist as the `BattleMap`
domain type (`src/domain/map.ts`, Zod in `src/data/schemas/map.ts`,
registry slot `battleTemplates`) but **no battle map content exists and the
seeders never read it** — `seedGroupBattle` / `seedBossBattle` /
`seedDungeonBattle` build an empty 14×10 grid and place units by formula;
`seedTutorialBattle` builds 5×5 with the authored lane. Wiring `BattleMap`
into `startBattle` is the next step if a map needs walls or terrain bonuses;
note `BattleMapSchema` pins `width: 14, height: 10` as literals.

**Tile pitch is derived, not fixed:** `tileSize(w, h)` in
`src/domain/boardGeometry.ts` — the largest even size in [40, 96] that fits
the play band (BAND_TOP 120 → HAND_TOP_Y 560, 8px pad). 5×5 → 84px,
14×10 → 42px, 8×8 → 54px. Unit chrome scales with it (`UNIT_K` in
`BoardScene`). Don't design a board taller than 10 rows or wider than 28
columns; it will drop below 40px and clip under the hand.

**Floor rendering:** `BoardScene.drawGrid` lays `px_grass` (flipped per cell
by hash) under every tile, then for each dirt cell the blob piece from
`systems/autotile.ts` (`autotileKey`), then the dark tint rect. Dirt cells
come from `grid.floor` when authored, else `systems/boardFloor.ts`
`generateDirtRegion(w, h, rng)` (seeded blobs + 2 CA passes, ≤35% of cells,
orphans culled), with `rng = deriveRng(createRng(state.rng), 'floor')`.
Gameplay never reads the floor.

**Authoring a floor in a seeder:** list tile ids on `grid.floor`. Rules of
thumb from SKILL.md: the lane follows the critical path, ≥3 cells per patch,
shoulders so it isn't a ruler line, no orphan cells. The tutorial:
`['0,2','1,2','2,2','3,2','4,2','1,3','2,1','3,1']` — Roy at `0,2`, bandit at
`4,2`.

**Sprites on the board:** `public/sprites/units/board/*.png` are ÷8 bakes of
the 832×1216 renders (`npm run bake-board-sprites`, `scripts/cli/bake-board-sprites.ts`),
loaded with LINEAR filtering. Re-bake after adding a unit render. Portraits
keep using the originals via `spritePathFor`.

## The px tileset

`public/art/terrain/px/` — 64×64 pixel tiles: `px_grass`, `px_dirt`, and the
47-piece dirt blob set. Key grammar (`systems/autotile.ts`):

| Key | Meaning |
|---|---|
| `px_dirt` | full fill |
| `px_dirt_edge_n` … `_w` | one ground side (named for the side the dirt faces) |
| `px_dirt_outer_nw` … `_se` | convex corner, ground on two adjacent sides |
| `px_dirt_b<missing>_<notch>` | generated: `<missing>` = ground sides in N,E,S,W order, `<notch>` = concave diagonals in NE,SE,SW,NW order; `bNESW_0` = isolated cell |

`allTileKeys('dirt')` is the preload manifest (47 keys). `sand` exists only
inside the map builder's embedded palette (overworld sheet) — no PNGs under
`px/` yet; extract from `tools/map-builder.html` if the board ever needs it.
The `inner_*` and `bES_0`-style duplicates in the builder palette are unused
by the autotiler.

## The open-sheet overworld (map builder)

`phaser/tools/map-builder.html` — standalone, serve the folder
(`python -m http.server 8778` in `phaser/tools`) and open
`map-builder.html`. Layers: Ground, Transition, Detail, Roads, Objects,
Markers. JSON shape:

```json
{ "version": 1, "cols": 26, "rows": 18, "cell": 48,
  "layers": [ { "name": "Ground", "visible": true, "halfOffset": false,
                "cells": { "x,y": { "k": "px_grass", "s": 100 } } }, … ] }
```

The game does **not** consume this JSON yet — `PaperMap.tsx` renders the
overworld as an SVG ledger sheet from `data/content/overworld`. The builder
is the authoring surface for the decided "one open-sheet map" direction;
wiring it in is separate work.

**Workflow:** paint `px_sand` / `px_dirt` straight onto Ground over
`px_grass` → Save .json → `npm run map-tool -- ascii sheet.json` (read the
shape) → `npm run map-tool -- autotile sheet.json sheet-tiled.json` → Load
.json in the builder → screenshot. Sample outputs from the first sessions:
`tools/coast-autotiled.json`, `tools/your-sand-edged.json`.

## Commands

```bash
npm run map-tool -- ascii    <builder.json>
npm run map-tool -- autotile <in.json> <out.json> [--terrain dirt|sand] [--ground px_grass]
npm run map-tool -- lint     <grid.txt>     # '#' wall '.' open '~' dirt 'P' party 'E' enemy
npm run bake-board-sprites                   # after adding a unit render
npm run typecheck && npm test && npm run check-context-doc
npx playwright test tests/e2e/combat-movement.spec.ts tests/e2e/visual.spec.ts
```

`lint` FAILs on unreachable enemies / missing spawns; WARNs on unreachable
open cells, one-tile passages, >35% dead space, enemy:party outside 2–3×.

## Screenshot loop

- Dev server `npm run dev` → http://localhost:5183 (pinned; 5173 is another
  app). Electron shell `npm run app` (window title is the page title,
  "Embermarch — …", not FE_MB).
- 14×10 field: `/?view=combat` (dev fast-path; seeds a stub battle).
- Tutorial: `/` → New Game (the prologue is skipped straight into the 5×5).
- Playwright MCP at 1280×720 CSS; `tests/e2e/visual.spec.ts` snapshots the
  combat view — `--update-snapshots` after an intended change.

## Known gaps (fix opportunistically, never extend)

- `BattleMap` unwired (above). Obstacles are always empty in shipped seeders.
- Builder JSON not consumed by the game; sand set only in the builder.
- `UnitDetailPanel` is `fixed top-36 right-4` and can sit over the right
  columns of a 14×10 board when pinned.
