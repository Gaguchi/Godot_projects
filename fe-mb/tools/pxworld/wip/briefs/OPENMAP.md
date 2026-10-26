# Embermarch · the open map (shared brief)

The scratchpad is `SP = C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad`. Every path below is relative to it unless it starts with `E:/`.

## What the owner asked

The owner was looking at the pixel map board (`preview/PxMap1x.png`) when they wrote, in their words: "ok the map i like the visuals quite a bit but i want it to be 'you can travel in every direction' not 'you have to travel to the right', you get me?"

- **Keep the visuals.** The 1× pixel world and the Filigree windows over it are the accepted house style. `preview/PxMap1x.png` is the bar for the art, so match it or beat it.
- **Change the structure.** The company should feel as if it stands in the middle of a country that opens every way.

This is already canon. `E:/Work/GameDev/Godot/fe-mb/docs/worldbuilding/story-bible.md` line 10, which is locked: "**omnidirectional open sandbox** (M&B-style) — NOT a one-way west march. Travel any direction." The same file lists "Map/food tech vs. omnidirectional sandbox — reconcile" as an open fork. `E:/Work/GameDev/Godot/fe-mb/docs/rewrite/BRIEF.md` line 328 records it as open question 1. The bible also says the world is "a handful of petty realms at low-grade border war". None of those realms has a name or content yet, so do not invent any.

## Why the map reads "go right" today

Read these facts before you design. They are measured, not guessed.

- **The game data** is `E:/Work/GameDev/Godot/fe-mb/game/src/content/data/overworld/world.json`: 47 places and 68 roads on a 3060×850 strip. It is read-only.
  - The start, Frontier Camp, is at x=60, on the strip's west edge.
  - The regions sit in a line: the Borderlands at x 60–1000, Thornwood at x 1060–2000, Ashfall at x 2060–3000, and the Iron Throne (the BOSS) at x=3000.
  - Every road is authored from west to east.
- **The engine already lets you walk any road both ways.** See `E:/Work/GameDev/Godot/fe-mb/game/src/engine/run/overworld.ts`: `edgeOf` and `adjacency` are undirected, and pathing is BFS. Nothing stops you turning back. The problem is that nothing lies behind you.
- **Danger is already distance from the camp, not direction.** `E:/Work/GameDev/Godot/fe-mb/game/src/engine/rules.ts` sets `travel.tierByDistance`: 2 hops or fewer from the start is tier 1, 5 or fewer is tier 2, beyond that tier 3.
  - The content gate `engine/content.ts#createEnv` forces each place's `areaTier` to match its BFS hop distance.
  - The BOSS must be at least `bossNodeMinHops = 7` hops away.
  - Each hop costs 1 food and 1 day. A hop at 0 food costs 3 HP per unit.
  - Each region has its own encounter chance per hop: Borderlands 0.40, Thornwood 0.55, Ashfall 0.70.
  - Hops into a TOWN or the BOSS never roll.
- **Today the graph is one long chain.** The hop distances are: the Borderlands 0–5, Thornwood 5–8, Ashfall 9–14, and the Iron Throne 14.
  - The Borderlands: Frontier Camp 0.
    - 1 hop: Daren's Camp (hidden until discovered), Trader's Rest (a dead end), South Road Ambush, Riverside Market.
    - 2 hops: Bandit Hideout, South Junction, Old Mill Crossing.
    - 3 hops: Broken Bridge, North Ridge Path, Smuggler's Cave (locked), Watchtower Ridge, Pine Crossing.
    - 4 hops: Border Fortress, Roderick's Camp.
    - 5 hops: Borderland Shrine (a dead end).
  - Thornwood is entered at Thornwood Gate (via Border Fortress) and at Southern Trail (via Roderick's Camp). Ashfall is entered only through Thornwood: Mountain Pass via Ancient Ruins, and Ashfall Trail via Morgana's Grove. The Iron Throne is reached via Ashen Gate.
  - Print the whole table yourself with BFS over world.json when you need it.
- **The map board makes the one-way reading worse.**
  - Frontier Camp sits at stage x 452, left of centre, and every road fans east.
  - The region window draws the land as a strip running left to right (Borderlands → Thornwood → Ashfall → Iron Throne) with a pin on its west end.
  - The right edge says "the land runs on east", and the footnote says "Three roads out of camp".

## The bar for every variant

1. **The camp in the middle.** Frontier Camp, with the company standing at it, sits in the middle third of the view both ways.
2. **Roads every way.** Roads leave the camp in at least three clearly different compass directions, and roads run off all four edges of the screen. A road that leaves the screen ends in a fingerpost or an edge label that names what lies that way. Name a real place or region only.
3. **Something worth going to in every direction.** No side of the map is empty filler.
4. **Nothing says "east is the way".** There is no left-to-right strip, no "runs on east" copy, and no row of places marching to one side.
5. **An overview, not a strip.** The region window shows the whole country as a small overview, north up. It shows where the Borderlands, Thornwood and Ashfall lie relative to the company, where the Iron Throne is, and the company's mark. Draw it as pixel art in the kit's ramps, at 1×.
6. **The glance test.** Someone who sees the board for one second should come away with "I'm in the middle, and I can go anywhere".

Everything else from PxMap1x stays as it is:
- the moment: day 1 at Frontier Camp, pointing at one destination, with the forecast card;
- the company window (The Foundling 73/73, Bagrat "Oak" 84/84, Lilina 62/62);
- the stores: 80 gold, 8 food, a Healing Potion ×1;
- one brass primary;
- Jacquard 24 only for places and titles, and people in Source Serif 4 bold at 20 px;
- the rules in `dirs/SCREENS.md`, except its painted-world line, which `dirs/PXWORLD.md` round 3 replaces.

Every number traces to the game, except where your variant deliberately changes a rule. List every such change in your NOTES.md.

## The three variants

**A · Same roads, laid round the camp.** Use the game's 47 places and 68 roads exactly as world.json has them. The graph does not change, only where things are drawn, so tiers and the economy do not change either.
- Find a layout of the Borderlands' places around Frontier Camp that fills every direction. Today the camp's roads lead to Trader's Rest, Riverside Market and South Road Ambush, plus Daren's Camp once it is found.
- The deeper game (Thornwood, then Ashfall, then the Iron Throne) still lies beyond the Borderlands' exits, which are Border Fortress and Roderick's Camp. Put them wherever the graph forces and the layout reads best, and say so honestly in the overview.
- This is the cheapest variant to build in the game: new positions in world.json, nothing else.

**B · The camp at the hub, the wilds all round.** The Borderlands are the heartland around the camp. The wild country rings them: Thornwood's forest on some sides and Ashfall's burnt hills on others, so every direction leads outward into harder country.
- Tier already follows hop distance, so a graph that radiates from the camp makes danger grow outward in every direction without any rule change.
- You may move places between wedges, add roads (link the Borderlands' rim straight to Thornwood and to Ashfall) and remove a road if you must. Keep every place the game has.
- The Iron Throne stays the end. Put it deep in one wedge, at least 7 hops from the camp, and say how many.
- In NOTES.md, list every new or removed road and every place whose hop distance, and so its tier, changes.
- No engine change: this is world.json content only.

**C · March anywhere.** This is B's country, unchanged, so that the owner compares only the travel rule. The company is not tied to roads: it can march to any point. Roads are the quick way, open country is slower and forest slower still, and rivers can be crossed only at bridges and fords. Places are where you stop.
- The board shows the company pointed at a destination reached partly off the road, with the route drawn across the country and the forecast in days and food.
- Write the rules sketch in NOTES.md:
  - Keep 1 food per day.
  - Today 1 day is 1 road hop. Say how far a day carries on the road, in the open and in the forest.
  - Say how encounters and tier work without hops. Tier could come from distance from the camp, measured in days.
  - Say what this costs in the engine: `run/travel.ts`, `run/overworld.ts` and the content schema.
- This one is an engine change. Say so plainly.

## Where the current map's code lives (read it, do not edit it)

- `dirs/pxworld/borderlands.py`: the overworld renderer. It takes its layout data from `dirs/hyb-64/world_map.py`, which holds:
  - `P`, the places in stage px;
  - `ROADS`, as `(a, b, bend)`;
  - `RIVER`, `FIELDS`, `HILLS`, `FORESTS`, `FARMS`, `EAST` (the two exits) and `place_art`.
  The bridge heads, fords and ridge set at the top of `borderlands.py` are hard-coded to today's layout.
- `dirs/pxworld/gen_map.py`: the board. It holds the place labels, the region window (the strip, around lines 141–200), the company window, the forecast card, the route beads and the footnote.
- `dirs/pxworld/__init__.py`: the kit's API docstring.
  - `places.py` holds the map's places, including Scene, `lay()` and the grain-1 `south_junction` and `pine_crossing`.
  - `build.py` holds the grain-1 structures: `cottage`, `lhouse`, `stone_bridge(…, broken=)`, `timber_bridge`, `waterwheel`, `ford`, `fingerpost`, `board_sign`, `stake_arc` and the rest.
  - The other modules are `terrain.py`, `trees.py`, `props.py` and `folk.py` (the company minis).
- `dirs/kit64/`: the UI kit. `KIT.md` documents it. Import it and never edit it.
- **Places that are river crossings by their nature.** Old Mill Crossing is the timber mill bridge, and Broken Bridge is the stone bridge whose middle span is gone. Your river must run through both, and their roads must cross it there. Today two more roads wade fords: Bandit Hideout to Pine Crossing, and South Junction to Smuggler's Cave.

## Rules

- **Work in your own folder.**
  - Variant A: `dirs/px-open-a/`, which writes `canvas/project/PxOpenA.dc.html`.
  - Variant B: `dirs/px-open-b/`, which writes `canvas/project/PxOpenB.dc.html`.
  - Variant C: `dirs/px-open-c/`, which writes `canvas/project/PxOpenC.dc.html`. C imports B's world from `dirs/px-open-b/` and does not change it.
- **Never edit** `dirs/pxworld/`, `dirs/kit64/`, `dirs/hyb-64/`, any `dirs/px-*` folder but your own, or any existing board. Copy `borderlands.py`, `gen_map.py` and `world_map.py` into your folder and adapt the copies. Import the kit modules as they are, and put new props or terrain (Ashfall ground, for example) in your own folder.
- `E:/Work/GameDev/Godot/fe-mb/game/` is read-only. Nothing is committed.
- **Determinism.** Use fixed seeds. Never seed from `hash()` of a string, because Python salts it per process; use `zlib.crc32` if you need a seed from a name. The same code must write the same bytes on every run.
- **The board.** It is 1280×720, with `$preview` 1280×720 and `<title>` in the form "Map · <the state>". Use the same board format as `pxworld/gen_map.py` writes.
- **The pixel-art bar** is `dirs/PXWORLD.md`, all of it:
  - selout outlines;
  - light from the upper left;
  - drawn texture;
  - hand-stepped curves;
  - hard cast shadows one step down a ramp;
  - one scale per scene;
  - daylight;
  - bridges that span bank to bank along the road's axis;
  - houses fronting the roads.
- **The owner's no-AI-trappings list** applies to every pixel of UI and every word of copy. It is in your CLAUDE.md.

## Method

1. **Plan before you draw.** Sketch two or three ASCII layouts of the 1280×720 view and one of the whole country. Choose between them against the bar and write down why. `E:/Work/GameDev/Godot/fe-mb/.claude/skills/drawing-maps/SKILL.md` puts it this way: a map is a route with a shape, the model plans and the code draws.
2. **Build** the layout data and the renderer copy, then render.
3. **QA**, at least three rounds:
   - Run `node preview.mjs PxOpenX` from the scratchpad, then read `preview/PxOpenX.png`.
   - Crop the busy parts to 3–5× with PIL NEAREST and read the crops.
   - Hold the render next to `preview/PxMap1x.png` and ask whether it reads as the same game and is at least as good.
   - Fix what you find and do the same again.
4. **Write NOTES.md** in your folder:
   - the whole country, in words and a small ASCII sketch;
   - what lies in each direction from the camp;
   - every game change (positions only, new roads, tier changes, rules);
   - what world.json would need;
   - the exact command that rebuilds your board.
