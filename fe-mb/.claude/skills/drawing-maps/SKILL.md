---
name: drawing-maps
description: Use when drawing, generating, reviewing, or fixing ANY map for FE_MB — a battle board (grid, obstacles, spawns, floor), the open-sheet overworld in tools/map-builder.html, or a dungeon layout — before placing a single tile and again before calling it done. Also use when a map "makes no sense visually", reads as noise or a checkerboard, or when asked to make the ground look like a place.
---

# Drawing Maps

## Overview

A map is a **route with a shape**, not a texture. Every good tactical map
answers two questions from a single glance: *where am I going* and *where
will I be fought*. A map that fails this reads as random tiles no matter how
good the art is — that was the tutorial board before 2026-09 (per-tile
random grass/dirt, no regions, no edges, 5% of the screen).

**Core principle: the model plans, code tiles.** The research on LLM level
generation (arXiv 2509.04481, 2410.15644) and every hand-drawn autotiled map
in this repo agree: an AI that places individual tiles produces noise. An AI
that writes a *plan* — an ASCII region sketch with a critical path — and
hands it to a deterministic autotiler + validator produces a place.

Three root causes behind every bad map (fix causes, not symptoms):
1. **No critical path** — the map was filled, not routed. Dead space and
   one-tile passages are the symptoms.
2. **Noise instead of regions** — texture varies per tile, so nothing has an
   edge. Regions with autotiled edges are what make ground read as ground.
3. **Placed by hand** — blob pieces, corners, and spawn positions typed in
   one at a time; always wrong in a corner somewhere. Use `map-tool`.

## Required workflow

**Before drawing:**
1. Name the map's **job** (tutorial: teach one move; skirmish: 3-turn
   engagement; boss: hold a line) and its **objective type** (seize / rout /
   defend / escape). The type sets the shape — see design rules below.
2. **Draw the critical path first** as an ASCII sketch: `P` party spawns,
   `E` enemy spawns, `#` walls/obstacles, `.` open, `~` dirt (cosmetic, open).
   Everything not on or within 3 tiles of a path needs a reason to exist
   (a side objective) or gets deleted. Smaller is better than empty.
3. Size to the engine: read [repo-hooks.md](repo-hooks.md) for the tile
   pitch a grid will get (5×5 → 84px, 14×10 → 42px) and what the seeders
   support today.

**While drawing:**
- Run `npm run map-tool -- lint <grid.txt>` on the ASCII. Fix every FAIL and
  every WARN you can't justify in one sentence.
- Cosmetic floor follows the path: the dirt lane IS the route (a worn path
  says "go this way" before any overlay does). Shoulders and a second patch
  keep it from reading as a ruler line.
- For the overworld sheet: paint regions on Ground in the builder, export
  the JSON, then `npm run map-tool -- autotile in.json out.json`. Never hand
  place `edge_*` / `outer_*` / `b*_*` pieces. Check the shape first with
  `npm run map-tool -- ascii in.json`.
- Enemy placement is turn-by-turn: decide where the player should be on
  turn 1, 2, 3 and put the fight there. Numbers below.

**Before claiming done — the Iron Rule (same as `crafting-game-ui`):**

```
NO MAP IS DONE UNTIL YOU HAVE LOOKED AT IT RENDERED.
```

1. Render it: battle boards via the game (`/?view=combat`, or title → New
   Game for the tutorial); overworld sheets via `tools/map-builder.html`
   (Load .json). Screenshot at 1280×720.
2. **1-second glance test**: can you point at the route and the fight? Does
   any region have a visible edge? Could the board be mistaken for a
   checkerboard or a random texture? If yes, it isn't done.
3. Sweep the anti-patterns below. Fix, re-render, re-shoot. The screenshot is
   the deliverable evidence.

## Design rules — layout (from the FEUniverse map-design canon)

| Rule | Number / test |
|---|---|
| Route first, then rooms | A→B path drawn before any terrain; delete cells the path never nears |
| No one-tiling | Every passage ≥2 wide (diagonal adjacency counts as touching); single-tile gaps only as a *deliberate* chokepoint covered by a ranged enemy |
| Shorter beats longer | Every screen-section of map must host an event; if not, cut it |
| Side objectives off the path | Chest / villager / recruit sits where the player would NOT otherwise walk — that's the point |
| Two routes, both viable | If one route is strictly better the other is dead space |
| Terrain variety, not spam | Sprinkle forests/forts/pillars into empty areas; never runs of slow tiles a unit has to crawl through |
| Objective sets shape | Seize/kill-boss: near-linear A→B. Rout: open but not empty. Defend: close quarters + waves from different sides + something worth leaving the line for |
| Size ∝ movement | Higher MOV = smaller map reads the same. FE_MB units move 3–5: a 14×10 field is a 3-turn walk |
| Fliers need an answer | Impassable-to-flier terrain, archers, wind magic, or a ballista |

## Design rules — enemies (RandomWizard's placement guide)

- **Start with 2–3× the party's unit count.** Under 2× feels empty; over 3×
  is a wall. `map-tool lint` reports the ratio.
- **Place per turn.** "On turn 1 the player is here and meets these two; on
  turn 2 they round the corner and the archers see them." Empty turns are
  a design bug.
- **Formations mean something:** a charge line (same MOV, same AI) forces a
  simultaneous engagement; overlapping attack ranges make baiting one pull
  all; a guard cluster on a chokepoint demands a coordinated push.
- **Ranged units are stationary threat multipliers** — put them behind
  melee, covering the tiles you want the player to hesitate on.
- **Vary AI.** All-charge or all-guard maps play themselves.
- **Faction coherence:** an enemy that doesn't belong to the map's faction
  breaks the fiction. Bandits don't field paladins.

## Composition rules — how ground reads (SLYNYRD, top-down tiles)

- **Negative space is your friend.** Flat ground is the material; textured
  patches are the information. Never butt a busy texture against another
  busy texture — it exhausts the eye (the old board: 8 grass variants + 4
  dirt variants, one per tile, nothing flat).
- **Regions, not tiles.** A patch is ≥3 cells with an autotiled edge. A
  single dirt cell reads as a mistake (`boardFloor` culls orphans).
- **Repeat a few clusters.** Two or three patch shapes reused read as style;
  twenty unique shapes read as noise.
- **Few colours.** Ground + one contrasting terrain + one accent; the board
  tint does the rest.
- **The path leads the eye.** On a battle board the dirt lane runs where the
  player should go; on the overworld sheet roads and river edges do.
- **Isolated diagonals don't join.** Two cells touching only at a corner
  render as two blobs — add a cell to make the join orthogonal, or accept
  the gap on purpose.

## Anti-patterns — all mean STOP

| You are about to… | Instead |
|---|---|
| Type `px_dirt_bNE_SW` (or any blob piece) by hand | Paint the region; run `map-tool autotile` |
| Fill the grid, then look for a route | Draw the route, then fill only around it |
| Pick a random texture per tile "for variety" | One flat ground + autotiled patches |
| Ship a map you only saw as JSON/ASCII | Render + screenshot; the Iron Rule |
| Leave a 1-wide corridor because "it's fine" | Widen, or cover it with a ranged enemy and call it a chokepoint in the plan |
| Place enemies where there's room | Place them where the player will be on turn N |
| Make the tutorial board "interesting" | The tutorial has ONE instruction; the map says it (the lane) and nothing else |

## Supporting files

- [repo-hooks.md](repo-hooks.md) — how this binds to `phaser/`: the tile
  pitch, `CombatGrid.floor`, `systems/boardFloor` + `systems/autotile`, the
  px tileset, the map-builder JSON format, `map-tool` commands, the
  screenshot loop, and the known gaps (BattleMap unwired, builder JSON not
  consumed by the game yet).
- Source guides (read when a rule above isn't enough):
  FEUniverse *Map Design and You* — https://feuniverse.us/t/map-design-and-you-a-guide-on-map-designing/4082 ;
  *RandomWizard's Enemy Placement Guide* — https://feuniverse.us/t/randomwizards-enemy-placement-guide/14888 ;
  *Mistakes I've Made in Map Design* — https://feuniverse.us/t/mistakes-ive-made-in-map-design/36382 ;
  SLYNYRD *Pixelblog 20: Top-down tiles* — https://www.slynyrd.com/blog/2019/8/27/pixelblog-20-top-down-tiles
