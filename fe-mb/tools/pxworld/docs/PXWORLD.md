# Embermarch · the pixel world, round 2 (shared brief)

The house style is still Filigree: the 1:1 walnut-and-brass pixel UI from `src/kit64/`. What changes is the world under it. The owner asked for the map, the town and the camp to be pixel art. We rendered the map at two grains, and the owner chose **1×: one art pixel per screen pixel**. That is the grain of the UI frames, the faces and the 104×152 character sprites.

The owner's verdict on the first pixel map, in their words: "1 is fine but the bridge in the overworld and the town maps wonky and the camp screen is terrible looking".
- **The bridges look wonky.**
  - Old Mill Crossing has a plank stub that floats out from the mill wheel and never spans the river.
  - Broken Bridge has two horizontal stone slabs that don't follow the road, don't span the water, and have loose grey squares between them.
  - The bridge in the town screen's strip runs off the frame at an angle.
- **The towns look wonky.**
  - On the map, the houses are front-on boxes, every one facing the same way, with a flat roof and one window, scattered on a dirt blob.
  - The market is a grey rectangle.
  - The town screen's strip cuts buildings off at the top edge and squeezes the town into 224 px.
- **The camp is terrible.** The current F64Camp is a flat vector illustration: a giant clip-art wagon, a cardboard tent, a cartoon fire and flat lenses of ground. Pixel-art characters are pasted on top of it, and nothing shares a scale or a technique.

## Read first
1. `src/BRIEF.md`: the board format, the asset table (`assets/blobs.json`), the QA loop, the forbidden looks and the game data.
2. `src/SCREENS.md`: the screen rules, all of which still apply. One primary action in brass. Jacquard only for places and titles. People in Source Serif 4 bold 20. The state goes in `<title>`. Real data only.
3. `src/pxworld/__init__.py`: the pixel world kit's API docstring (palette ramps, Canvas/Sprite, terrain, trees, props, places, folk). Build on it.
4. `src/kit64/KIT.md` and `kit.py`: the UI kit. Import it; never edit it.
5. The renders in `out/preview/`: `PxMap1x.png` (the current pixel map), `F64TownInn.png`, `F64TownShop.png`, `F64TownTavern.png` and `F64Camp.png` (the screens you are replacing, which show their states and data), and `KitPanels.png`.

## The pixel-art bar (what "not wonky" means)
This is hand-pixelled art drawn by code. It must never look like vector shapes that happen to have hard edges.
- **Palette.** Use only `pxworld.pal` ramps. You may add a ramp in your own module if you must, and you must report it. Shade by stepping down the object's own ramp, never by blending. There are no gradients and no alpha soft shadows: a cast shadow is the ground one ramp step darker, with a hard edge.
- **Light.** Light comes from the upper left on every object. The lit face is the lightest step, the side face the middle step, the underside and contact line the darkest. Leave a 1 px highlight on edges that face the light.
- **Outlines.** Every object has a 1 px outline in the darkest step of its own ramp (selout), not pure black. Inner lines (planks, timber framing, seams) use a darker step, not outline black.
- **Texture is drawn, not noised.**
  - Wood shows grain lines and knots.
  - Canvas shows seams, creases and a sag between poles.
  - Stone shows coursed blocks with mortar, chips and moss at the base.
  - Roofs show thatch strokes or shingle rows.
  - Grass shows clumps and blades at the edges, plus a few flowers.
  - Dirt shows pebbles and ruts.
  - No random per-pixel speckle over a flat fill.
- **Curves.** Hand-choose the steps on curves (wheels, tent ridges, the river bank). There are no jaggies from naive rasterising: a curve's runs of pixels lengthen and shorten smoothly (1-2-3-3-2-1), never 1-3-1-4.
- **Geometry that makes sense.**
  - A bridge spans from bank to bank along the road's axis, at right angles to the flow, and sits on piers or abutments in the water. A broken bridge is that same bridge with its middle span gone, rubble in the water and the two stumps still aligned.
  - Houses sit on the ground in the map's 3/4 top-down view: a roof with two slopes in two tones, a visible ridge line, eaves that overhang and cast a shadow line, and a front wall below with a door and windows. Vary the orientation: some ridges run east–west, so you see the long roof slope and the front wall; others run north–south, so you see the gable triangle. Houses front a street, and the street is the road.
  - Things stand on their contact shadow.
- **Scale is one world.** Within a scene, every prop is in true scale to the people in it. On the map, the folk minis are about 16×24. In the camp, people are the 104×152 board sprites, so a tent is about 2× a person's height and a wagon wheel is about 0.6× a person's height. Never mix scales in one scene.
- **The world is daylight**, like the map: warm, sunlit and readable. Do not bring back the rejected looks. There is no dusk darkness, no vignette, no amber "candlelit" glow and no glow on the UI. A camp fire is lit, but it is not the scene's only light.
- **Embedding.** Embed the world as one PNG data URI with `image-rendering:pixelated` at exactly 1:1 (CSS width = PNG width). Never scale the world by a non-integer amount.

## QA (mandatory, at least three rounds per board)
Run `node preview.mjs <Board>` from tools/pxworld and read the PNG. Crop the busy parts to 3–5× with NEAREST and read those. Look for every bullet above: wonky geometry, mixed scales, vector-flat fills, stray pixels, jaggy curves, outlines in pure black, and text that clips or overlaps. Then put your render next to `out/preview/PxMap1x.png` and `out/preview/KitPanels.png` and ask whether it reads as the same game. Fix it, render again and look again.

## Rules
- Use your own folder. Never edit `kit64/`, `hyb-64/` or another agent's folder. **Only the map agent may edit `pxworld/`, and only by adding or fixing without breaking the API.** The town and camp agents import pxworld and build their own large-scale props in their own folders.
- `game/` is read-only, and nothing is committed.
- The owner's no-AI-trappings list applies to every pixel of UI and copy.

## Round 3 · pixel everywhere (owner 2026-10-24: "Good, go pixel everywhere")
Round 2 was accepted. The bar to match is:
- `out/preview/PxMap1x.png`;
- `out/preview/PxTownInn.png`, whose scene code is in `src/px-town/`;
- `out/preview/PxCamp.png`, whose scene code is in `src/px-camp/`.

Every remaining screen that shows a world moves to 1× pixel art: the combat field, the dungeon, the title, the prologue, win and loss, and the dimmed map behind every pop-up.

- **How the switch works.** The kit's `world_map()`, `world_field()` and `ground()` now look for a pixel module (`kit_px_map`, `kit_px_field`) and use it when it exists. `F64_PAINTED=1` forces the old paint.
  - `src/kit64/kit_px_map.py` must expose `map_uri(company=True)`, a 1280×720 PNG data URI, and may expose `ground_uri(w, h, seed)`.
  - `src/kit64/kit_px_field.py` must expose `field_uri()`, a 1280×720 PNG data URI with the same geometry as `kit_world_field` (the 14×10 board of 48 px tiles at 303, 18), and an optional `SEAMS = False` if the PNG draws its own grid.
  - Once those exist, every generator that calls the kit picks up the pixel world without being edited.
  - `kit.py` itself stays untouched, and so do the other kit modules.
- **Character art is not hand-drawn.** The game's characters come from its own art pipeline (the board sprites, faces and full art in `assets/up/`).
  - In a close scene, use the 104×152 board sprites at exactly 1:1, as PxCamp does.
  - On the combat board, keep the game's current convention, the board sprites at the scale `hyb-64/gen_combat.py` uses.
  - At map scale, reuse the existing minis (`pxworld/folk.py`, the figures in `src/px-town/`).
  - Do not invent new character sprites. Props, creatures (a dog, hens) and nameless background folk at mini scale are fine.
- **Regenerate in place.** Boards keep their file names and overwrite their old painted versions. Each agent works from its own new folder, copying generators in when it must change one. In the report, give the exact command that rebuilds each board, so a final pass can rebuild everything in order.

## What to return
- The boards: file, `<title>` and the primary action.
- What you changed in the world and why.
- Any kit gaps you filled.
- The weakest point, stated honestly.
