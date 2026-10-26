# Embermarch · the big country (variant B at four times the area)

The scratchpad is `SP = C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad`. Paths are relative to it unless they start with `E:/`. Read `dirs/OPENMAP.md` first: it holds the canon, the measured game facts and the pixel-art bar this builds on. Then read `dirs/px-open-b/NOTES.md`.

## What the owner asked

The owner looked at the three open maps (A, B, C) on the map-choice canvas and wrote: "I like all three but the scale is too small I feel like the map itself should be at least 4 times the size with the same density."

Asked what that meant, the owner picked two options:
- **"4x the area, 4x the places"**, whose description read: "The country becomes 2 screens wide and 2 tall, as busy everywhere as it is now: about 190 places instead of 47. The screen shows a quarter of it and scrolls. The new places need names and jobs in the game."
- **"B, camp at the hub"**, whose description read: "Wild country in every direction, with longer Ashfall roads so runs stay as long as today."

## What that means

B's country, with everything at four times the area and today's density.

- **The Borderlands.**
  - The heartland is one screen today (`preview/PxOpenB.png`). It becomes 2 screens wide and 2 tall: 2560×1440 stage px, drawn at 1×.
  - It holds about four times its drawn places: today 15, so about 60.
  - Frontier Camp sits at its centre.
- **The wild country.** The rings beyond grow the same way: Thornwood on the north and east, and Ashfall on the west and south.
  - They hold about four times their places: today 32, so about 130.
  - The Iron Throne stays deep in Ashfall's south-west.
- **In total**, about 190 places.
- **The map screen** is a 1280×720 window onto the heartland, centred on the company, and it scrolls. The region window's overview shows the whole country, with a frame marking the part that is on screen.
- **Keep the visuals.** PxOpenB is the bar. Use the same kit and the same 1× grain, and match its density per screen: fields, woods, houses and roads per 1280×720 should look like PxOpenB's.

## Content

- **Keep every one of the game's 47 places**, with its name, type and region.
  - Start from B's positions in `dirs/px-open-b/world_b.py`.
  - Scale them ×2 about the camp, which doubles the distances and quadruples the area.
  - Then fill in the new places between them.
- **New places get plain, descriptive English names in the game's voice**, like Riverside Market, Old Mill Crossing, Trader's Rest, Watchtower Ridge and Smuggler's Cave.
  - They are hamlets, farms, crossings, mills, camps, shrines, ruins, caves and watchtowers.
  - Each gets a type from those world.json uses, and a region.
  - List them all in NOTES.md as proposals for the owner.
  - Do not invent realms, factions or named people.
- **Roads.**
  - The camp is the hub: roads radiate from it and interconnect, and every place can be reached.
  - Rivers are crossed at bridges and fords. Old Mill Crossing and Broken Bridge stay river crossings by their nature.
  - Bridges span bank to bank along the road's axis, and the owner has called wonky bridges out before.
- **Tiers and run length.** Today, BFS hop distance from the camp sets the tier (2 hops or fewer is tier 1, 5 or fewer tier 2, beyond that tier 3). Every hop costs 1 food and 1 day, and the Iron Throne is 14 hops out. Doubling the distances roughly doubles the hop counts.
  - Measure the hops from the camp to the throne and the size of each tier band.
  - Propose in NOTES.md how the rules should scale: wider tier bands, a hop costing less food or time, longer runs, or a mix.
  - The owner decides. The run should be at least as long as today's.

## Boards (1280×720 unless stated, the board format of `dirs/px-open-b/gen_open_b.py`)

- **`PxBigMap`: the map screen.**
  - Day 1, Frontier Camp in the middle of the view, with the company standing at it.
  - The same UI as PxOpenB: the region window (overview plus view frame), the menu, the company window (The Foundling 73/73, Bagrat "Oak" 84/84, Lilina 62/62), the stores (80 gold, 8 food, a Healing Potion ×1), and a forecast card pointing at a place one road away.
  - Roads run off every edge into more country.
  - Title: "Map · the big country, day 1 at Frontier Camp, pointing at <place>".
- **`PxBigCountry`: the whole heartland at 1×**, 2560×1440 with `$preview` 2560×1440.
  - Every place is labelled.
  - A thin brass frame shows the 1280×720 view that PxBigMap shows.
  - No other UI.
  - Title: "Map · the whole Borderlands at 1×, with the view frame on the camp".

## Code and rules

- **Folder:** `dirs/px-big-b/`.
  - Copy `dirs/px-open-b/world_b.py` (and the helpers you change) into it, and generalise it to a larger world: render 2560×1440, or any window of it.
  - Import the kit (`dirs/pxworld/`, `dirs/kit64/`, `dirs/hyb-64/`) and never edit it.
  - Never edit `dirs/px-open-b/`, another folder or another board.
- **Boards and preview:**
  - Boards go to `canvas/project/PxBigMap.dc.html` and `canvas/project/PxBigCountry.dc.html`.
  - Preview with `node preview.mjs PxBigMap PxBigCountry`. The screenshot uses the board's `$preview` width and its full page height.
- **Determinism:** fixed seeds, never `hash()` of a string, and `zlib.crc32` for a seed from a name.
- **The game** (`E:/Work/GameDev/Godot/fe-mb/game/`) is read-only. Nothing is committed and nothing is published.
- **Rules from the brief:** the owner's no-AI-trappings list, and the pixel-art bar in `dirs/PXWORLD.md`.

## Method

1. **Plan first.**
   - Sketch the whole country in ASCII.
   - Sketch the heartland's 2×2 screens in ASCII, with the places, the roads and the river.
   - Check the density per screen against PxOpenB.
2. **Build** the data, with a BFS check of every place's hop distance. Then render.
3. **QA, at least three rounds.**
   - Read the renders, and crops of them at 3-5× made with PIL NEAREST.
   - Hold a 1280×720 crop of PxBigCountry next to `preview/PxOpenB.png`: the density must match.
4. **Write NOTES.md**, covering:
   - the country, with its ASCII sketch;
   - every new place: name, type, region and position;
   - the road list and every place's hops and tier;
   - the scaling proposal for tiers, food and days;
   - what world.json would need;
   - the rebuild command.
