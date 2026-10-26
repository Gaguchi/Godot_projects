# Variant A: same roads, laid round the camp

Board: `canvas/project/PxOpenA.dc.html`, title `Map · day 1 at Frontier Camp, pointing at Riverside Market`.
Primary (the one brass action): **click to march** to Riverside Market, on the forecast card.

## Rebuild

```
cd C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad
python dirs/px-open-a/gen_open_a.py && node preview.mjs PxOpenA
python dirs/px-open-a/check_graph.py          # the honesty check (exit 1 on any mismatch)
```

The build takes about 35 s. It is deterministic: two runs write byte-identical HTML (md5 565dba3c…).

## Files

- `gen_open_a.py`: the board (labels, exits, region window, company window, forecast card, footnote).
- `openworld.py`: the world renderer, a copy of `pxworld/borderlands.py` driven by `layout_a`. It adds the camp's three-gate ring, the gated watchtower ring and `exit_post()`, the signs where roads leave the view.
- `layout_a.py`: places, roads (as waypoint polylines), river, fields, hills, forests and fords, in stage px.
- `plans_a.py`: the settlement plans (market, South Junction, Pine Crossing), the camp's gates and tents, and the edge posts.
- `country_a.py`: all 47 places in one frame, the crossing check, BFS hops, and `world_json()` (the positions world.json would get).
- `overview_a.py`: the region window's overview.
- `check_graph.py`: compares the board's roads and places with world.json.
- Ignore `lay_*.py`, `opt*.py`, `plan.py` and `t/`. They are scratch from the first builder and from this pass.

## The whole country

The graph is world.json's, so the shape follows from it:

- Thornwood can only be entered at Thornwood Gate (past Border Fortress) and at Southern Trail (past Roderick's Camp).
- Thornwood's own roads form a ring between those two doors. So it is laid as a horseshoe round the Borderlands:
  - the gate side (chapel, druids' circle, hermit's tower, glade, ruins) runs north-east, east and south-east;
  - the trail side (spiders' nest, witch's hut, depths, Morgana's grove) runs south and south-west.
- Ashfall is entered only from Thornwood's far rim: Mountain Pass from Ancient Ruins (south-east) and Ashfall Trail from Morgana's Grove (south). So it lies south of the woods.
- The Iron Throne is at Ashfall's far end, due south of the camp.

```
                 . druids' circle
        N Ridge Path  .           (Thornwood, NE)
   . . . . . . | . . chapel
   Broken  BORDERLANDS      hermit .
   Bridge -- [CAMP] --- Fortress -- Gate ... glade
   (west)      |            Shrine     (Thornwood, E)
   spiders'  Roderick's -- Southern Trail
   nest          (Thornwood, S and SW)
   depths  witch   Morgana   ruins
                ASHFALL (south)
                Iron Throne (due south, 14 hops)
```

North (North Ridge Path) and west (Broken Bridge) are the Borderlands' own rim. The graph has nothing beyond them, and the overview shows that honestly: open land, no roads.

## What lies each way from the camp (on the board)

| Way | Places | Edge exit |
|---|---|---|
| North | Trader's Rest (1 hop), North Ridge Path (off the top), Watchtower Ridge | North Ridge Path: a plaque sign, one road leaving the top edge (its two roads join below the edge) |
| North-east and east | Old Mill Crossing (the timber bridge), Watchtower Ridge, Border Fortress | Borderland Shrine and Thornwood Gate ("into Thornwood"), each with an arm sign |
| South | Riverside Market (1 hop, the hovered route), Bandit Hideout, Pine Crossing, Roderick's Camp | Southern Trail ("into Thornwood"), a plaque sign |
| South-west and west | South Road Ambush (1 hop), South Junction, Smuggler's Cave (locked), with the river and the SJ ford | Broken Bridge: an arm sign on each bank road |

Roads leave the camp by three gates: north (Trader's Rest), south-west (South Road Ambush) and south (Riverside Market). A fourth, to Daren's Camp, is hidden on day 1. Roads run off all four edges.

## Game changes

- **Positions only.** No road is added or removed, no place is added, no rule changes. The hop distances, and so the tiers (`travel.tierByDistance`), are world.json's. The encounter chances, the economy and the boss at 14 hops (at least 7 needed) are unchanged.
- **What world.json would need:** new `position` values for all 47 nodes and a new sheet size. `country_a.world_json()` gives both: offset (77, 172) from stage px and a sheet of 1981 × 1947, so the camera can centre the camp. Run `python dirs/px-open-a/country_a.py` for the table. Frontier Camp is at (737, 502), the Iron Throne at (980, 1883) and Daren's Camp at (577, 412).
- `OverworldScreen`'s camera already centres on a node, so no code change is needed. The BRIEF's open question 1 (map/food tech against the sandbox) is not touched here; that is variant C.

## check_graph.py output

```
world.json: 47 places, 68 roads (24 touch the Borderlands)
board: 22 roads drawn (7 of them run off the view), 2 hidden (Daren's Camp)
country layout: 47 places placed, 0 road crossings
off the view: border_fortress-borderland_shrine, border_fortress-thornwood_gate, broken_bridge-smugglers_cave, broken_bridge-south_junction, north_ridge_path-old_mill_crossing, north_ridge_path-watchtower_ridge, rodericks_camp-southern_trail
hidden: darens_camp-frontier_camp, darens_camp-south_road_ambush
hops (visible graph, as the game computes tier): traders_rest 1, riverside_market 1, south_road_ambush 1, border_fortress 4, rodericks_camp 4, thornwood_gate 5, southern_trail 5, the_iron_throne 14
RESULT: OK, the graph is world.json's exactly
```

## This pass: what the critics found and what was done

Fixed:

- **P0, the mill bridge.**
  - The market road now arrives level along the deck for about 20 px, south of the mill house.
  - The three east roads share a level stub of 24 px off the deck before they fork.
- **The hovered camp-to-market road.**
  - The thatch and gable houses moved west of it.
  - The road now ends on the square's cobbles.
- **South Junction.**
  - It is re-laid on its new street: the four-house north row has its doors on the street, with one house in the fork and one on the ambush road.
  - No house stands on a road.
- **The crop field that the road crossed.** It moved north of the ambush road. The plough moved off the camp's south-west road.
- **The watchtower-to-fortress road.** It now passes west of the west tower and comes round to the south gate.
- **Smuggler's Cave.**
  - The ford road comes down the cave's east flank to the barred mouth on its south face.
  - The other two roads leave from that apron.
  - The rock at the mouth's east foot was dropped so the road can reach it.
- **Bandit Hideout.** Its roads meet in front of the fire pit, below the bush.
- **Edge signs.**
  - `exit_post()` draws a 15 × 24 sign at folk scale: an arm for east or west exits, a plaque for north or south ones.
  - Each stands on its road's verge, inside the edge.
  - Each exit name has a bone chevron pointing off the view, which place labels never carry.
  - No name sits on water.
- **The overview.**
  - The country is re-laid as above (Thornwood a horseshoe, Ashfall and the Throne south).
  - The pin sits about a third of the way down, not on the rim.
  - Each region has a selout coast in its own darkest step, a lit north-west rim and a shaded south-east rim.
  - Thornwood has drawn crowns on a broken stagger, Ashfall drawn ridges, and the Borderlands the board's own fields.
  - The Iron Throne is a 9 × 11 keep in the stone ramp with an oxblood banner.
  - There is an N mark, and each label sits on its own land.
- **Names against directions.**
  - South Road Ambush now lies south-west of the camp (28° south of west), on the "south road" out of the south-west gate.
  - South Junction lies at the end of that road, below the camp's line (10° south of west).
  - To make room, the river's west reach runs about 20 px further south.
- **The Frontier Camp label.** It sits beside the stake ring, not over a field.
- **Doubled roads.**
  - The two North Ridge Path roads join below the top edge, so one road leaves.
  - Pine's two west roads now leave it 50+ px apart: the ford road to the north-west, Roderick's road to the south-west.
- **P2s taken.**
  - Camp: the tan tent moved inside the ring, and the company moved onto the road outside the gate.
  - The forecast leader is now a square L out of the bracket. The card moved 34 px nearer.
  - Labels:
    - the Smuggler's label is clear of the rock;
    - the Southern Trail label and the footnote sit on meadow;
    - Roderick's label sits over its tents.
  - Company names are Source Serif 4 bold 20 px.
  - The title is the state only.
  - The region window is 520 wide, so the encounter line fits on one row and the stores have room.
  - The forest is trimmed under the footnote.

Not taken:

- **"South-row houses show their fronts to the south" (market, Pine).** The critic misread these. They are built with `back=True`, which draws the rear wall: windows, no door. Their doors face the square and street to the north, which is the kit's convention for a street's far side.
- **The Broken Bridge stump at the west edge.**
  - There the river runs east to west, so the bridge would have to run north to south.
  - The kit's `stone_bridge` only lays east to west, and a new north-south bridge sprite is more than this pass should take on.
  - Both bank roads end in signs named Broken Bridge, and the place stays just off the view.
- **"Pin within 15% of the overview's centre."**
  - The graph puts all the deeper country south and east, so a camp-centred box would leave the land at a third of its size.
  - The pin sits at about 41% across and 36% down instead.
- **South Junction at least 15° south of west.** It is at 10°. More would push the river and the cave into the company window. It is no longer north of the camp, and it sits on the south road.

## Weakest point

- The deeper game still runs one way, south. The graph forces this.
- On the board itself every direction has something, but the north and west exits are cul-de-sacs. The overview says so plainly: Thornwood wraps three sides, but the Throne is south.
- Of the three variants, A is the cheapest and the least "go anywhere". The south-west quarter (the junction, the cave, the river) is also the densest part of the view. It sits in the 290 px band between the two left windows.
