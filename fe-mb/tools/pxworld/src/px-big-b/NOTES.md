# The big country (variant B at four times the area): the numbers

The first builder was stopped by the usage limit before it wrote these notes. The numbers come from `python stats.py`. The boards are `PxBigMap` and `PxBigCountry`, built by `gen_boards.py` and not yet reviewed.

## Revised 2026-10-26, after the owner's answers (tier bands 4 / 10; the throne road climbs the Borderlands, then Thornwood, then Ashfall)
- **The throne's approach moved to the south-east corner, past Thornwood's southern end.** It is Final Approach, Warlord's Camp, Ashen Gate and the Iron Throne (`wild_gen.py` MOVE; `land.py` applies wild_data.MOVED). The road in is from Morgana's Grove, which is how today's game already enters Ashfall.
- **The rules in `wild_gen.py`:**
  - **5b, `gate()`:** cut Ashfall roads until every shortest way to the throne passes Thornwood before any Ashfall place.
  - **5c:** split the gated leg's longest roads with new Ashfall places until the leg is `ASH_LEG` = 7 hops.
- **The result:** 195 places and 268 roads. The throne is **17 hops** out: 6 in the Borderlands, 4 in Thornwood, 7 in Ashfall.
  - The route: Frontier Camp > Riverside Market > Hay Meadow > Toll Bridge > Roderick's Camp > Smuggler's Cave > Reed Marsh > Stag Clearing > Morgana's Grove > Timber Hamlet > Lantern Clearing > Hawk Ridge > Ash Shrine > Ember Flats > Flint Camp > Salt Pans > Ashen Gate > The Iron Throne.
  - It expects about **7.9** encounter rolls, the same as today's route.
  - It passes two towns: Riverside Market at hop 1, and Timber Hamlet at hop 9, at the Thornwood end before the long Ashfall leg.
- **Tiers at 4 / 10:** 52 places are tier 1, 118 tier 2 and 24 tier 3.
- **New names** for the pocket (Ashfall pool): Soot Camp, Clinker Camp, Charred Rise, Ember Flats, Scald Camp, Lava Steps, Cinder Rise, Ember Ford, Burnt Gibbet and Gate Market.
- **Rebuild:** `python dirs/px-big-b/wild_gen.py`, then `python dirs/px-big-b/gen_boards.py`. The numbers above are from the first build; this section supersedes them.

## Size (first build)
- 191 places (190 visible on day 1; Daren's Camp stays hidden) and 265 roads.
- The heartland, the drawn 2560×1440 Borderlands, holds 61 places.
- The new places by type: 73 CAMP, 34 TRAIL, 25 DISCOVERY, 7 TOWN, 5 DUNGEON.

## Distance
- The Iron Throne is **18 hops** from Frontier Camp, against 14 today.
- The shortest route: Frontier Camp > Crossroads Well > Kiln Yard > Willowbank > South Watch > Broken Bridge > Ashfall Trail > Pumice Hollow > Ruined Chapel > Tar Pits > Scorched Village > Vulture Rock > Sulfur Springs > Ash Hollow > Final Approach > Ash Shrine > Ashen Gate > Narrow Pass > The Iron Throne.
  - That is 5 hops in the Borderlands and 13 in Ashfall, with no Thornwood at all.
  - It passes one town (Willowbank, at hop 3).
  - It expects 10 encounter rolls, against about 8 on today's route.
- Thornwood is first reached at 4 hops and Ashfall at 5. The regions span: the Borderlands 0-6 hops, Thornwood 4-12, Ashfall 5-19.

## Tiers (tier comes from BFS hops; today's bands are 2 / 5)
| bands | tier 1 | tier 2 | tier 3 | by region |
|---|---|---|---|---|
| today, 2 / 5 | 20 | 51 | 119 | 3 of the 60 Borderlands places are already tier 3; Thornwood is almost all tier 3 |
| doubled, 4 / 10 | 52 | 95 | 43 | Borderlands 1-2, Thornwood mostly 2, Ashfall 2 near and 3 deep, the same shape as today |
| 3 / 8 | 37 | 84 | 69 | a harder middle ground |

## Proposal (the owner decides)
1. **Tier bands at 4 / 10**, doubled with the distances. This keeps today's feel: the Borderlands are safe-ish, Thornwood is the middle and Ashfall's depths are the hard end. Today's bands would make most of the country tier 3.
2. **Food stays at 1 per hop.** The run grows from 14 hops to 18, which meets "at least as long as today". With 8 food at the start, resupply matters, so put a town on the Ashfall road near hop 10-12. Today only Willowbank, at hop 3, lies on the route.
3. **Leave the encounter rates alone** (0.40 / 0.55 / 0.70). Ten rolls instead of about 8 suits the standing finding that the game is too easy.
4. **Optional:** route the throne road through Thornwood (Borderlands, then Thornwood, then Ashfall), as today's chain does. As drawn, it skips Thornwood.

## Rebuild
`cd <scratchpad> && python dirs/px-big-b/gen_boards.py && node preview.mjs PxBigMap PxBigCountry`
