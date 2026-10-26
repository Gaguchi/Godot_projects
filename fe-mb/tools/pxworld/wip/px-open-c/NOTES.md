# Variant C: march anywhere

Board: `canvas/project/PxOpenC.dc.html`, title "Map · march anywhere, day 1 at Frontier Camp, pointing at Scorched
Village across open country". Render: `preview/PxOpenC.png`. One brass primary: the march to Scorched Village and its
forecast card ("click to march").

Rebuild (from the scratchpad root):

    cd C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad && python dirs/px-open-c/make_c.py && python dirs/px-open-c/gen_open_c.py && node preview.mjs PxOpenC

- `make_c.py` rewrites `gen_open_c.py` from B's current `dirs/px-open-b/gen_open_b.py`, so C keeps every B fix and
  changes only the travel parts. Each C edit is anchored on B's text and is marked `# C:` in the output. If B
  rewrites one of those lines, the script stops and names the edit.
- `gen_open_c.py` alone rebuilds the board from the last generated copy.
- Nothing is copied out of `world_b.py`. Every coordinate, including the destination, the road legs and the
  crossings, is read from B's data at run time. Build time is about 25 s, mostly two Dijkstra passes over the
  country.

**C is an engine change.** It touches `run/travel.ts`, `run/overworld.ts`, `run/encounters.ts`, `run/scout.ts`,
`content.ts`, the content schema, the save format and the map screen. The cost is written up separately in
[`dirs/px-open-cost/COST-C.md`](../px-open-cost/COST-C.md): about two working weeks for one person, or 3 to 4 days
with agents in parallel. It uses this folder's `march.py` constants, and its rule section matches the sketch below.

## What C is

C is B's country, unchanged: the same places, roads, river and ground (`world_b.py`), and the same windows and
numbers. One rule changes. The company is not tied to the roads and can march across any ground. Roads are the
quick way, open country is slower, and forest is slower still. The river can be crossed only where a road crosses
it. Places are still the only stops.

## The rules sketch

All of it is code in `march.py`. The board's numbers come from that code, not from this page.

### How far a day carries

Today one day is one road hop. C measures the march in stage px of B's country instead:

| ground | one day carries | what counts |
|---|---|---|
| road | **210 px** | every one of B's roads, along its own polyline, plus the mill bridge's deck |
| open country | **140 px** (2/3) | meadow, fields, dry grass, Ashfall's ash |
| forest | **70 px** (1/3) | Thornwood's pines and the heartland's copses |
| water | cannot be crossed | except on a road: the mill bridge and the two fords |

Why 210 px. It is measured against B's roads.

- B's four roads out of camp are 135, 143, 187 and 206 px. At 210 px a day each of them stays one day, as it is
  today.
- B's 23 roads in view have a median of 197 px. All of B's roads together have a median of 267 px, because the wild
  country is laid out wider.
- Every heartland place keeps its hop count as its days by road, except Smuggler's Cave. Its road from South
  Junction is 494 px, so the cave is 4 days by road where it was 3 hops.
- Further out, the wild roads are long, and a road trip takes more days than it has hops. The Iron Throne is 9 hops
  but 11 days by road alone.

Beyond the 1280 x 720 view, B draws no ground. There the ground takes the region of the nearest wild place:
Thornwood is forest and Ashfall is open. The river is carried north and south the way B's overview carries it.
Broken Bridge's middle span is gone, so it is not a crossing, and its two roads end at the stumps, one on each
bank.

### Food and days

- 1 food per day.
- A day begun is a day eaten: a march of 3.4 days is 4 days and 4 food.
- A day at 0 food costs every unit 3 HP, as a hop does today.

### Places are where you stop

- A march order still names a place (`travel/goTo` is unchanged). The route between places crosses any ground.
- The route walks round the grounds of the places it passes, so the company stops only where it is pointed. On the
  board, the march leaves the south road just above the wreck at South Road Ambush and goes round it. Passing
  through costs 0.09 days less but would land on an unvisited landmark and open its event.
- Where the only way on runs through a place, such as a bridge or a town street, the march stops there exactly as
  today's walk would: at a town, a camp, a landmark or any place not yet visited.

### Encounters without hops

- **One roll per day of march.** It is made where the company camps that night, at the chance of that country's
  region.
- **The chance.** Each region's `encounterChancePerHop` from `regions.json` is read as a chance per day:
  Borderlands 0.40, Thornwood 0.55, Ashfall 0.70.
- **Which region.** Inside the main view, the region is the ground B draws there: Ashfall's ash and dry grass count
  as Ashfall, Thornwood's pines as Thornwood, and the rest is the Borderlands. Beyond the view, the country belongs
  to its nearest place's region, the same rule B's overview draws. (The game would read both from world.json's
  `terrain` block; see below.)
- **No roll on arrival at a town or the throne.** A day that ends at a TOWN or at the Iron Throne never rolls, as
  `noRollInto` has it today.
- **Cooldown and Scout key on places.** The per-road cooldown keys on the place nearest the night's camp, and Scout
  pre-rolls the places within 3 days. See COST-C.md sections 2.5 and 2.8.

### Tier without hops

- **The bands.** Tier is read from whole days from Frontier Camp by the quickest march. The bands of
  `rules.travel.tierByDistance` stay the same, read in days: 2 days or fewer is tier 1, 5 or fewer is tier 2, and
  beyond that is tier 3.
- **The gate.** The content gate keeps both of its checks, now in days. Each place's `areaTier` must match its band,
  and the BOSS must be at least 7 days out.
- **The Iron Throne** is 8.48 days by the quickest march, so 9 days. By road alone it is 10.97 days, so 11. B has
  it at 9 hops. The gate passes.

## The board

### The destination: Scorched Village, past the south edge

The off-road leg has to be clearly the quicker way, and that is a measured choice. B's heartland roads run straight
out from the hub, so near the camp the open country never wins. Every place in view is as quick or quicker by road.
The best in-view case is Smuggler's Cave, whose road is 1.23 times the straight line, and the open country is 1.5
times slower. The shortcuts are toward Ashfall, where B's roads go the long way round by Broken Bridge:

| place | by road alone | quickest march | saved |
|---|---|---|---|
| Scorched Village | 6.98 days, so 7 | 3.32, so 4 | 3 days, 3 food |
| Sulfur Springs | 8.38, so 9 | 4.69, so 5 | 4 |
| Warlord's Camp | 9.59, so 10 | 5.91, so 6 | 4 |
| Ruined Chapel | 5.54, so 6 | 3.54, so 4 | 2 |

Scorched Village is the nearest of these, and its march is the cleanest on the screen: it uses the south road out of
camp, then crosses open country past the wreck and the ash. It is a camp in Ashfall, "rest or scout", 5 hops away in
B.

### The march as drawn

- **Road:** 117 px down the south road. B's brass beads mark it, 14 px apart, from the palisade gate to where the
  march leaves the road, just above the wreck.
- **Open country:** 398 px south-south-west across the meadow, the dry grass and the ash, to Scorched Village
  (430, 880). On screen it is a line of brass stitches as heavy as the beads: rounded dashes 14 px apart, lit on
  their upper-left side, in an ink outline. They run all the way off the bottom edge.
- **Off the edge:** where the line leaves the screen, the destination has its own sign, planted on the line's east
  side the way B plants its edge signs: B's plank board on two posts (`bits.edge_sign`), with "Ashfall" on the board
  and "Scorched Village · 4 days" on its inland side. It is the pointed-at sign, so its board has brass trim and its
  words are in straw.
- **The long way round, dim:** the road-alone route is drawn in small unlit bone dots from the wreck down to South
  Junction, along the road to Broken Bridge and off the bottom edge on the Ashfall Trail road, with "by road 7 days"
  over it. Dots are only drawn on open road, never over a house. They are dim so the brass march stays the one
  primary, but they put the shortcut on the map, not only in the card.
- **The overview:** the same march is drawn in the region window's overview as a brass track (solid on the road,
  dotted across country) to a hollow brass diamond on Scorched Village in Ashfall. The company's pin is bone, so
  "you are here" and "where you are going" no longer share one brass. B's "Borderlands" label moves from under the
  pin to over it, so it no longer covers the track.
- **The river:** the march does not cross it. Every crossing in the country is a road crossing (the mill bridge and
  the fords), and the planner never wades open water.
- **Total:** 3.40 days, so 4 days and 4 food. The drawn route is the planner's own route string-pulled straight, and
  the build asserts that it is within a quarter day of the quickest march and quicker in whole days than the road.

### The forecast card

| line | words | where the number comes from |
|---|---|---|
| title | Scorched Village | |
| place | camp · rest or scout, in Ashfall | |
| days and food | 4 days, 4 food, "click to march" | 3.40 days begun is 4 days, at 1 food a day |
| encounters | "an encounter 4 nights in 10, 7 in 10 in Ashfall" | night 1 is in the Borderlands (0.40); night 2 is on the ash at the foot of the view, so Ashfall (0.70), as are night 3 and the arrival; about 2.5 encounters expected against 4.0 by road |
| the road | "by road alone 7 days, round by Broken Bridge" | the road-only planner's route: South Road Ambush, South Junction, Broken Bridge, Ashfall Trail |

### What else C changes on B's board

- **The roads out of camp.** B's bone beads on the camp's four roads are gone. They said "pick one of four roads",
  which is the rule C drops.
- **The tags.** The 1-day places keep B's tags: North Ridge Path, South Road Ambush, Trader's Rest and Riverside
  Market are all one day by march too. No place's tag is lit, because the lit thing is the march.
- **The labels.** Frontier Camp's label stands beside the palisade on its west side (419, 404), clear of the beads,
  and South Road Ambush's tag sits just above the wreck's clearing (412, 490), west of the beads, 46 px below the
  camp's label so the two no longer read as one stack. The label placer also keeps every label off the drawn route
  and off the destination's sign.
- **No leader.** The card stands 30 px from the beads, so B's leader from the card is gone; it crossed the South
  Junction road and pointed at the wreck.
- **The region window** reads "Marching here: an encounter 4 nights in 10", where B has "Roads here: an encounter
  on 4 hops in 10".
- **The edge signs** give days of march, by `sign_words_c`:
  - Thornwood Gate · 4 days (4 in B);
  - Southern Trail · 5 days (5 in B);
  - Ashfall Trail · 5 days (4 in B);
  - Mountain Pass · 5 days (4 in B).

  The two Ashfall roads are 4.21 and 4.50 days long.
- **The footnote:** "Point at a place, click to march.", right of the destination's sign. Places are still the
  only stops, so it no longer says "point anywhere".

### What C leaves to B (world_b.py, which C must not change)

The critics found these in the world, and they show on PxOpenB the same way. C picks up any fix on its next rebuild:

- Broken Bridge's two stumps are not on one axis and the gap between them is about 4 px.
- At South Junction, the east road runs under the gable house at (691-706, 636-657) and the pair at (795-835, 630-650).
- A snag stands in the Mountain Pass road at (33-43, 305-322).
- The ash ground in view is flat facets with straight seams; row 719 carries the ash polygons' outline.
- The Ashfall Trail road is faint on the ash; the dead-tree clusters tangle; a tree rests on a hamlet roof at (563-598, 120-168).
- The N and S edge boards have no direction; "Southern Trail" leaves due east (B kept it and says why).
- The overview's ash ticks are one repeated stamp, and the company window names are 16 px, as on PxMap1x and B.

## The country and what lies each way (B's, read in days)

    north up; the box is the screen; numbers are whole days of march from the camp

                 Hermit's Tower 6   Druid's Circle 6   Thornwood Gate 4   Dark Hollow 5   Foggy Marsh 6
                                  THORNWOOD (pines: 70 px a day)
       Mountain Pass 5  +------------------------------------------------------------+
                        | Shrine 3     N.Ridge 1  Watchtower 2  Fortress 3  ~river     |  Spider's Nest 6
       ASHFALL          | Bandit H. 2  Trader's 1  CAMP  Market 1  Mill 2  Pine X. 3  |  Southern Trail 5
       (open: 140/day)  |                .  Ambush 1       Roderick's 4               |  Witch's Hut 7
                        |               .  South Junction 2  ford  Smuggler's Cave 4   |
                        +--------------v-------------------------Broken Bridge 3------+
            Sulfur Springs 5   Scorched Village 4   Ruined Chapel 4   Ashfall Trail 5   Morgana's Grove 7
          Final Approach 6   Warlord's Camp 6   Ashen Gate 8   THE IRON THRONE 9 (south-west)

The dotted line is the board's march: down the south road, then across country off the bottom edge.

- **North:** North Ridge Path (1 day), Watchtower Ridge (2), Border Fortress (3), and Thornwood Gate (4) off the top
  edge.
- **East:** Riverside Market (1), Old Mill Crossing (2), Pine Crossing (3), Roderick's Camp (4), and Southern Trail
  (5) off the right edge.
- **South:** South Road Ambush (1), South Junction (2), Broken Bridge (3), Smuggler's Cave (4, locked), and Ashfall
  Trail (5) off the bottom edge. Across open country, Scorched Village and Ruined Chapel are 4 days each.
- **West:** Trader's Rest (1), Bandit Hideout (2), Borderland Shrine (3), and Mountain Pass (5) off the left edge.

For the country itself (positions, the 5 roads B removes and the 5 it adds, B's hop table) see
[`dirs/px-open-b/NOTES.md`](../px-open-b/NOTES.md). C changes none of it.

## Every game change C needs

C needs all of B's world.json changes (positions, roads, B's areaTier edits), plus the following.

### Rules (an engine change)

These follow COST-C.md section 2.13.

| today | C |
|---|---|
| `travel.foodPerHop: 1` | `foodPerDay: 1` |
| `travel.daysPerHop: 1` | gone: a step of the walk is one day |
| none | `dayPx: { road: 210, open: 140, forest: 70 }` |
| `tierByDistance[].maxHops` 2 / 5 / infinity | `maxDays` 2 / 5 / infinity |
| `bossNodeMinHops: 7` | `bossNodeMinDays: 7` |
| `camp.scoutDepth: 3` (roads) | `scoutDepthDays: 3` |
| `region.encounterChancePerHop` | `encounterChancePerDay`, the same values |

Unchanged: `starvationDamage` (3), `noRollInto` (TOWN, BOSS), `decisionNodeTypes`, the cooldown numbers, and
everything about battles, loot and enemy levels.

### Tier changes against B (the areaTier edits the gate in days forces)

| place | B hops | C days | tier |
|---|---|---|---|
| Sulfur Springs | 6 | 5 | 3 to 2 |
| Foggy Marsh | 5 | 6 | 2 to 3 |
| Lava Fields | 5 | 6 | 2 to 3 |
| Ember Creek | 5 | 6 | 2 to 3 |
| Ashfall Outpost | 5 | 6 | 2 to 3 |
| Ancient Ruins | 5 | 6 | 2 to 3 |
| Morgana's Grove | 5 | 7 | 2 to 3 |

Every other place keeps B's tier. Print the whole table (hops, days by road, days by march, both tiers) with
`python dirs/px-open-c/march.py` from the scratchpad root.

### What world.json needs beyond B

These follow COST-C.md section 2.2.

- **A `terrain` block.** It holds coarse ground polygons for the whole country: forest areas, the river with its
  half-width, and the crossings. B's art only covers the view, and `march.py` fills the rest by region, which the
  game must not do.
- **A `via` polyline on each edge.** That way the engine's road and the drawn road are one line.
  `world_b.road_paths()` already produces them.
- **The 7 areaTier edits** in the table above.

## Files

- **`march.py`:** the rule. It holds the constants, the cost grid over the whole country, the Dijkstra over cells and
  road polylines, the route and its string-pulling, the costing of drawn legs, the rolls per day, and the table.
- **`make_c.py`:** writes `gen_open_c.py` from B's generator.
- **`gen_open_c.py`:** the board, generated. Its C edits are marked `# C:`.
- **`t/`:** scratch, including the world PNG, the first route tests and B's generator as first copied.
- **`qa/`:** the QA crops.

## Weakest point

The destination is off the screen. In B's country the off-road shortcut only pays toward Ashfall, so the board
points past the south edge, and the march ends at a sign and an overview mark rather than a place you can see. The
dim road-alone dots and "by road 7 days" now put the long way round on the map, but the cut is still a short one
on screen: about 200 px of stitches against a road that bends round by South Junction. The bottom row is also
busy, with the destination's sign, South Junction's label, the footnote and the Ashfall Trail sign side by side.
