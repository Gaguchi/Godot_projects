# Variant B: the camp at the hub, the wilds all round

Board: `canvas/project/PxOpenB.dc.html`, title "Map · day 1 at Frontier Camp, pointing at Riverside Market".
Render: `preview/PxOpenB.png`. One brass primary: the Riverside Market route and its forecast card ("click to march").

Rebuild (from the scratchpad root):

    cd C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad && python dirs/px-open-b/gen_open_b.py && node preview.mjs PxOpenB

The build is deterministic: two runs write the same bytes.

## The country

The Borderlands are the farmed heartland, and Frontier Camp stands in the middle of them (stage 600, 410). The wild
country rings them. Thornwood's pine forest closes the north and runs down the east side. Ashfall's burnt hills lie
west and south. Danger grows outward in every direction because tier follows hop distance. The Iron Throne lies deep
in Ashfall to the south-west, 9 hops from the camp.

    the whole country (north up; the box is the screen)

              Ancient Ruins   Moonlit Glade   Hermit's Tower   Wolf Den   Thornwood Chapel  Dark Hollow
                                     THORNWOOD (pines)          Druid's Circle   Thornwood Gate   Foggy Marsh
     Ashfall Outpost         +---------------------------------------------------------+
      Mountain Pass ======== | Shrine        N.Ridge   Watchtower  Fortress  ~river     |     Cursed Clearing
     Dragon's Lookout        | Bandit H.  Trader's   CAMP   Market  Mill   Pine Xing   | ==== Spider's Nest
       Ember Creek  ASHFALL  |            Daren's     Ambush        Roderick's        |  Southern Trail
     Obsidian Cavern         |                 South Junction  ford  Smuggler's Cave  |     Witch's Hut
     Cragmaw F.  Lava Fields +-----------------------------------Broken Bridge--------+  Thornwood Depths
     Iron Mine  Final Approach  Sulfur Springs  Scorched Village  Ruined Chapel  Ashfall Trail  Morgana's Grove
     Ashen Gate   Warlord's Camp
     THE IRON THRONE (south-west, 9 hops)

What lies each way from the camp:

- **North:** North Ridge Path (1 hop, on a new road), then Watchtower Ridge (2) and Border Fortress (3). The road
  leaves the fortress by its front gate, goes round its west wall and runs off the top edge to Thornwood Gate:
  board "Thornwood", caption "Thornwood Gate · 4 days".
- **East:** Riverside Market (1), Old Mill Crossing on the river (2), Pine Crossing (3) and Roderick's Camp (4).
  The road leaves Roderick's off the right edge to Southern Trail: board "Thornwood", caption "Southern Trail · 5 days".
- **South:** South Road Ambush (1), South Junction (2) and Broken Bridge (3), where the river crosses. Smuggler's
  Cave (3, locked) lies over the ford. The old road runs on past the broken bridge off the bottom edge to Ashfall
  Trail: board "Ashfall", caption "Ashfall Trail · 4 days".
- **West:** Trader's Rest (1), Bandit Hideout (2) and Borderland Shrine (3). The road leaves the shrine off the left
  edge to Mountain Pass: board "Ashfall", caption "Mountain Pass · 4 days".

The region window's overview is 156 x 104 px at 1x in the kit's ramps. It shows Thornwood north and east, Ashfall
west and south, the Borderlands round the brass pin, the Iron Throne's keep in the south-west, every road as a 1 px
track, the river, and a small N in the top-right corner.

## Game changes (world.json content only, no engine change)

### Roads removed (5)

| road | encounterTableId | why |
|---|---|---|
| riverside_market - bandit_hideout | borderlands_road | the hideout moved west; this road would cross the camp |
| bandit_hideout - pine_crossing | borderlands_road | west to east across the whole heartland |
| border_fortress - borderland_shrine | borderlands_road | the shrine moved west, onto the road out to Mountain Pass |
| wolf_den - morganas_grove | thornwood_road | once Thornwood wraps round the north and east, its two far ends are half a circle apart |
| bandit_hideout - south_junction | borderlands_road | with the hideout in the west, this road would cut across the south road; the west road reaches the hideout in the same 2 hops |

### Roads added (5)

| road | encounterTableId |
|---|---|
| frontier_camp - north_ridge_path | borderlands_road (the camp's north road) |
| traders_rest - bandit_hideout | borderlands_road (the west road runs on past Trader's Rest) |
| bandit_hideout - borderland_shrine | borderlands_road |
| borderland_shrine - mountain_pass | ashfall_road (west, into Ashfall) |
| broken_bridge - ashfall_trail | ashfall_road (south, the old road on past the broken bridge) |

The total stays at 68 roads (`world_b.b_roads()`).

### Hop distances (game to B) for all 46 visible places

Daren's Camp is hidden and BFS skips it, as `engine/content.ts#nodeDistances` does.

| place | region | game | B | tier |
|---|---|---|---|---|
| Frontier Camp | borderlands | 0 | 0 | 1 |
| Riverside Market | borderlands | 1 | 1 | 1 |
| South Road Ambush | borderlands | 1 | 1 | 1 |
| Trader's Rest | borderlands | 1 | 1 | 1 |
| North Ridge Path | borderlands | 3 | **1** | **2 to 1** |
| Old Mill Crossing | borderlands | 2 | 2 | 1 |
| South Junction | borderlands | 2 | 2 | 1 |
| Bandit Hideout | borderlands | 2 | 2 | 1 |
| Watchtower Ridge | borderlands | 3 | **2** | **2 to 1** |
| Pine Crossing | borderlands | 3 | 3 | 2 |
| Smuggler's Cave | borderlands | 3 | 3 | 2 |
| Broken Bridge | borderlands | 3 | 3 | 2 |
| Borderland Shrine | borderlands | 5 | **3** | 2 |
| Border Fortress | borderlands | 4 | **3** | 2 |
| Roderick's Camp | borderlands | 4 | 4 | 2 |
| Thornwood Gate | thornwood | 5 | **4** | 2 |
| Southern Trail | thornwood | 5 | 5 | 2 |
| Thornwood Chapel | thornwood | 6 | **5** | **3 to 2** |
| Dark Hollow | thornwood | 6 | **5** | **3 to 2** |
| Foggy Marsh | thornwood | 6 | **5** | **3 to 2** |
| Cursed Clearing | thornwood | 6 | 6 | 3 |
| Spider's Nest | thornwood | 6 | 6 | 3 |
| Witch's Hut | thornwood | 7 | **6** | 3 |
| Hermit's Tower | thornwood | 7 | **6** | 3 |
| Wolf Den | thornwood | 7 | **6** | 3 |
| Druid's Circle | thornwood | 7 | **6** | 3 |
| Morgana's Grove | thornwood | 8 | **5** | **3 to 2** |
| Ancient Ruins | thornwood | 8 | **5** | **3 to 2** |
| Thornwood Depths | thornwood | 8 | **6** | 3 |
| Moonlit Glade | thornwood | 8 | **6** | 3 |
| Mountain Pass | ashfall | 9 | **4** | **3 to 2** |
| Ashfall Trail | ashfall | 9 | **4** | **3 to 2** |
| Scorched Village | ashfall | 10 | **5** | **3 to 2** |
| Ruined Chapel | ashfall | 10 | **5** | **3 to 2** |
| Ashfall Outpost | ashfall | 10 | **5** | **3 to 2** |
| Lava Fields | ashfall | 10 | **5** | **3 to 2** |
| Ember Creek | ashfall | 10 | **5** | **3 to 2** |
| Sulfur Springs | ashfall | 11 | **6** | 3 |
| Dragon's Lookout | ashfall | 11 | **6** | 3 |
| Iron Mine | ashfall | 11 | **6** | 3 |
| Final Approach | ashfall | 12 | **7** | 3 |
| Warlord's Camp | ashfall | 12 | **7** | 3 |
| Cragmaw Fortress | ashfall | 12 | **7** | 3 |
| Obsidian Cavern | ashfall | 12 | **7** | 3 |
| Ashen Gate | ashfall | 13 | **8** | 3 |
| The Iron Throne | ashfall | 14 | **9** | 3 |

### areaTier edits world.json needs (14; the content gate forces them)

- 2 to 1: north_ridge_path, watchtower_ridge.
- 3 to 2: ashfall_trail, mountain_pass, scorched_village, ruined_chapel, morganas_grove, ashfall_outpost,
  lava_fields, ember_creek, ancient_ruins, thornwood_chapel, dark_hollow, foggy_marsh.

Tier counts move from 7 / 10 / 29 (game) to 9 / 20 / 17 (B).

### The Iron Throne: 9 hops, a deliberate economy change

`world_b.hops()['the_iron_throne'] == 9`. That clears `bossNodeMinHops = 7`; the game has it at 14.

- The shortest B route is Frontier Camp > South Road Ambush > South Junction > Broken Bridge > Ashfall Trail >
  Scorched Village > Sulfur Springs > Final Approach > Ashen Gate > The Iron Throne.
- The west route ties at 9: Trader's Rest > Bandit Hideout > Borderland Shrine > Mountain Pass > Lava Fields >
  Iron Mine > Final Approach > Ashen Gate > Throne.
- The game's shortest route is 14 hops: Riverside Market > Bandit Hideout > Pine Crossing > Border Fortress >
  Thornwood Gate > Dark Hollow > Wolf Den > Ancient Ruins > Mountain Pass > Ashfall Outpost > Dragon's Lookout >
  Cragmaw Fortress > Ashen Gate > Throne.

The arithmetic (1 food and 1 day a hop, 8 food at the start):

- A straight run to the boss costs 9 days and 9 food in B, against 14 and 14 in the game.
- From the starting 8 food, the run is 1 food short in B and 6 short in the game, so a resupply is still needed but
  barely.
- Expected encounter rolls on the shortest route are 4.3 in B and 5.8 in the game. That assumes each hop rolls at
  its destination region's rate (Borderlands 0.40, Thornwood 0.55, Ashfall 0.70) and that towns and the boss never
  roll.
- Ashfall is reached on day 4 instead of day 9, and five of its places drop to tier 2.

This makes the run shorter and softer, and the owner's own finding is that the game is already too easy. B keeps
it at 9 because pushing it back is not one road's work. I tried every single and paired removal of an Ashfall road
that keeps all places reachable, and none moves the Throne past 9. Both rim entries sit 5 hops from it inside
Ashfall. To get 11 to 13 you would have to rewire Ashfall's inner chain, for example so that Ashen Gate is reached
only through Warlord's Camp, or retune the tier bands. Both are design calls for the owner, not layout.

### Positions

Every place gets a new position. `world_b.P` holds them in stage px: the screen is [0, 1280] x [0, 720], and the
wild places lie off it in the same frame, from x -670 to 1710 and y -350 to 1210. world.json needs them shifted to
non-negative values, for example x + 700 and y + 400, on a 2410 x 1610 sheet. Only the camp's 1280 x 720 window is
on screen at once.

## What moved in this pass (variant C reads this data at run time)

- `P['rodericks_camp']`: (1186, 458) to (1172, 460), so the east sign's board clears the tents.
- `DOOR` (new): `bandit_hideout` (252, 441) and `smugglers_cave` (1141, 603). Roads to the two caves now end on the
  apron in front of the south-facing mouth and come round the rock to get there. C should arrive at
  `DOOR.get(k, P[k])`.
- `road_paths()`:
  - The north exit road leaves Border Fortress by its front gate and goes round the west wall. It used to run into
    the keep's back.
  - The Old Mill to Watchtower Ridge and Old Mill to North Ridge Path roads now end on the mill's bridge head
    through `MILL_J`, now (923, 346). They used to end in the mill's wall.
  - The Pine Crossing west road bends south along the house fronts.
  - Roderick's to Smuggler's Cave goes round the cave's east side.
  - South Junction to Smuggler's Cave shares the Broken Bridge road to x 940 (`SHARE`), then crosses the ford square
    to the flow, about 10 px further south.
- `ZONES['ashfall']` is reshaped. A tongue reaches in along the Mountain Pass road to the shrine and another up the
  Ashfall Trail road. The meadow reaches the left edge at y 446-516 and the foot at x 800-846.
- `EXITS`:
  - Each sign has moved onto its road's verge.
  - The new keys are `post`, `ph`, `cap` ('above' or 'below') and `align`.
  - Boards are 84-90 px wide (they were 110-124). The board names the region and the caption names the place and
    its days. `sign_words(e)` returns both. C still writes `NAMES[to]` on the board, so it should switch to
    `sign_words(e)` or the word will overflow the narrower board.
- `render()`:
  - The farms get narrow dirt tracks to the nearest road. These are in `info['roads']` and listed in
    `info['tracks']`.
  - Watchtower Ridge has a gate on each road.
  - Broken Bridge stands on piers, and the fallen span lies in three drowned chunks.
  - The shrine is a figure on a plinth.
  - The ash marks are clustered.
  - The cinder specks are gone, and so are the stray river rock and the smoke wisp at (1112, 704).

## How variant C imports this world

    import sys; sys.path.insert(0, 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad/dirs/px-open-b')
    import world_b as WB
    cv, info = WB.render(company=(x, y))     # True: in the camp yard; False: nobody; (x, y): the middle figure's foot
    uri = cv.data_uri()                      # 1280 x 720, show at 1:1, image-rendering:pixelated
    # data: WB.P, WB.NODE, WB.NAMES, WB.b_roads(), WB.hops(), WB.tier(h), WB.road_paths(), WB.RIVER, WB.river_pts,
    #       WB.RIVER_HW, WB.river_x(y), WB.BRIDGES, WB.FORD_ROADS, WB.ZONES, WB.WOODS, WB.FIELDS, WB.HILLS,
    #       WB.EXITS (+ e['board_box'] after render), WB.sign_words(e), WB.DOOR, WB.drawn(k), WB.in_view(k)
    # routes: WB.terrain_at(x, y[, info]), WB.terrain_along(pts[, info])

The names, signatures, return shapes and the stage frame are unchanged. `DOOR`, `SHARE`, `sign_words`, the extra
`EXITS` keys and `info['tracks']` are additions.

## Files

- `gen_open_b.py`: the board.
- `world_b.py`: the world, whose docstring is its API.
- `overview.py`: the region window's overview.
- `bits.py`: the camp, shrine, edge signs, snags, stumps, the gated watchtower, the broken bridge on piers and the
  ember.
- `ashland.py`: the dry and burnt ground.
- `country.py`: the solver that placed the wild places.
- `geo.py`: geometry.
- `crop.py`: QA crops into `qb/`.
- `dev/`: the working copies used for this pass, swapped in with `os.replace`.
- `qa/`, `t/`, `plan_graph.py`, `qa_*.py` and `_nodes_snapshot.txt` are the first builder's scratch.
