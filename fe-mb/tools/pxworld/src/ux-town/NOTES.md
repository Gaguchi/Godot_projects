# ux-town: the square and the inn

Two boards replace PxTownInn, PxTownShop and PxTownTavern, the one town screen whose tabs each showed everything at once.

- `canvas/project/UxTown.dc.html`: "Town · Riverside Market, day 4, arriving, pointing at the inn"
- `canvas/project/UxInn.dc.html`: "Inn · Riverside Market, day 4, Oak and Lilina hurt, pointing at Rest the wounded"

Rebuild (from the scratchpad root; it writes both boards, then renders them):

    cd C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad && python dirs/ux-town/gen_ux_town.py && node preview.mjs UxTown UxInn

`python dirs/ux-town/gen_ux_town.py town` or `... inn` builds one board. The output is deterministic: two runs write the same bytes.

## UxTown: where in town do we go?

- **Focal point:** the inn. It has the brass bracket (the same corner art as the map's), a lit plate and a forecast window pinned over it with the map's brass leader.
- **The forecast** reads:
  - "The inn", with "click to go in";
  - "Beds for the wounded, 12 a head";
  - "Two of us are hurt: Oak and Lilina."
- **On the screen, and why:**
  - **The square at full screen.** The scene is the menu. The inn, the market and the tavern are the three buildings. The road out is px-town's west road, with a fingerpost where it meets the market's earth.
  - **Four idle plates on the world:** "The inn", "The market", "The tavern" and "Back to the road". They show what can be pointed at before any hover, as the map's plates do for its three roads out.
  - **The list window, top right,** in the same place as the map's command window. It has the same four choices as numbered verbs, the way Warband words its town menu: "1 Visit the inn", "2 Go to the market", "3 Visit the tavern", then a groove and "4 Back to the road" with Esc. The pointed row is in its hover state, mirroring the bracket.
  - **Under another groove, "The Company · roster and gear" with key C.** It is PxMap1x's command row, quiet bone text, outside the numbered places so 1 to 4 still run the square. This is the chosen route into the company (Battle Brothers' C); the "pointable figures" alternative is dropped.
  - **Two plates say "Back to the road":** the west fingerpost and the east end of the bridge. Both ends of the road are the same choice (`town/leave`), and the map then offers every road.
  - **No market stalls outside the market.** The carters' yard west of the square has handcarts, sacks, crates and the well; the square's south half has a second carter. The shop-front plated "The market" is the only market in the picture.
  - **The hint, bottom left,** as on PxCamp and PxMap1x: "Three doors and the road out. Point at one, click to go."
  - **The forecast window sits on the windows' top line** (y 15), 27 px clear of the header.
  - **The header, top left:** Riverside Market, Day 4, the town's line, 173 gold, "The Borderlands · town". Gold shows here because the square is where it is about to be spent.
  - **The company** stands in the middle of the square, among the townsfolk.
- **Way in:** from the map, by marching onto Riverside Market.
- **Ways out:** 1 to 3, or a click on a building, opens that building's screen. 4, Esc, or the road out leads back to the map (`town/leave`).

## UxInn: do we pay to heal the wounded?

- **Focal point:** the bill and its one brass primary, "Rest the wounded · 24 gold", shown in its hover state, with its Enter key.
- **On the screen, and why:**
  - **The scene is the inn's common room** (`innroom.py`), so arriving reads as walking in, not as a window over the square. It is built from the tavern's room kit (a snapshot of `dirs/ux-tavern` in `room/`, never edited), so UxInn and UxTavern are one style: the plastered, timber-framed wall, one window upper left throwing its light on the boards, the hearth with the stew pot over the fire, the counter with the innkeeper behind it, the board of room keys and the shelf of bowls, and a box bed in an alcove with its curtain tied back. The company stand on the boards as their 104 × 152 ComfyUI board sprites at 1:1, as on PxCamp and UxTavern.
  - **"The innkeeper" plate on the counter front,** as the tavern names its barkeep: who the offer comes from. She has no bracket: the pointer is on the primary, and one bracket per screen marks what is pointed at.
  - **The header, top left:** "Riverside Market · day 4" above "The inn": the place, then the room.
  - **"The innkeeper's offer"**, with the note "2 of 3 hurt":
    - The innkeeper's line, verbatim from `Town.tsx`: "A bed, a fire, and a bowl of something hot."
    - The two wounded, each with a face, name, class and HP. Each bar shows its heal as the kit's dithered ghost, with the line "a bed mends 5" or "a bed mends 37". Under half HP the current value is rust, as on PxCamp ("25/62"):
      - Bagrat "Oak", Shield Knight, 79/84;
      - Lilina, Mage, 25/62.
    - The Foundling as one quiet line, his 32 px face centred in the face column and his name on the others' name column: "73/73 · whole, no bed needed".
    - The bill: "Two beds, 12 gold a head". The total is not repeated on this row; the purse and the button carry it.
    - The purse after it: 173 → 149 gold left, in cast digits.
    - The primary, with Enter beside it.
    - Under a groove, the way back as UxTown's list row: "Back to the square", Esc on the inner right edge.
- **Way in:** UxTown, by 1, a click on the inn, or Enter on its list row.
- **Way out:** "Back to the square" or Esc returns to UxTown. Paying stays on this screen: the bars fill, and the primary greys with the engine's own reason, `NOBODY_WOUNDED` ("nobody is wounded").

## What I left off, and where it lives

| Left off | Where it lives instead |
|---|---|
| The satchel and the larder | The market (UxMarket), the satchel screen (UxSatchel) and the map. The inn never uses the satchel. |
| The Company button and window | The company screens (UxPerson, UxPersonDeck, UxEquip). |
| The stock, its prices and the purse rule | The market (UxMarket). |
| Rumours, the board and the bounty desk | The tavern (UxTavern) and the barkeep's conversation. |
| HP on the square | The inn, and a person's screen. The square says only that two are hurt, because that is why the inn matters now. |
| Food | The map and the satchel. |
| Decks, gear and stats at the inn | A person's screen. |

## The references I used, and what I took from each

| Reference | What I took |
|---|---|
| **Mount & Blade: Warband** | The town menu as a list of verbs beside a picture, with the exit last and numbered (keys 1 to 4 run the square). Two depths with two named ways out: Warband's "Head back." is our "Back to the square", and "Leave..." is our "Back to the road". |
| **Battle Brothers** | The settlement panorama whose buildings are its buttons. A building's window opens over the panorama, which is why UxInn keeps the town in view and moves only the camera. Esc closes. |
| **Darkest Dungeon** | Hovering a building lights it and names it. One building does one job. The Sanitarium's layout: who needs it, what it costs, one confirm. |
| **Dragon Quest and Octopath Traveler inns** | One offer and one yes, then everyone is whole. |
| **FTL's Repair All** | One brass button pays for everyone. Per-person toggles were left off. |
| **PxMap1x** (our own) | The bracket, the lit plate, the forecast pinned with the brass leader, and "click to march", which becomes "click to go in". The list sits where the map's command window sits. |
| **PxCamp** (our own) | The scene on the left and the decision on the right. HP bars carry the dithered heal preview, and a line in the game's voice opens the decision. |

## The scene (`uxscene.py`)

`render()` is px-town's `scene.render` copied and changed. Everything else is imported from `dirs/px-town` unchanged: every building, prop, folk figure and ground painter, the bridge, and `scene.py`'s `Layer`, `town_tree`, `building_shadow` and `east_x`.

**What changed:**

- **The world** is 1480 × 720. UxTown crops 1280 × 720 of it at 1:1 from x 0. (UxInn used to crop it at x 159; it now has its own room.)
- **The town sits 230 px lower** than in px-town. The windows along the top now lie over the back lots, not the roofs, and the square in front is deep enough to stand the company in.
- **The square is busy all the way down:**
  - two carters unloading, in the yard and in the square's south half (no stalls);
  - a carter unloading sacks and a crate;
  - two people at their gossip;
  - folk crossing;
  - hens.
- **The quay** gets a second boat, a bollard and crates.
- **The road out** is px-town's west road.

**New pixel art, all from `pxworld.pal` with no new ramp,** lit from the upper left and inked selout:

- a fingerpost at town scale;
- a post-and-rail fence;
- a kitchen garden behind the inn, with a tilled bed, cabbages and leeks;
- an orchard behind the market;
- three runs of hedge;
- a woodland edge behind the town (pxworld's `forest()` at town radii);
- a belt of trees down the west side.

**The company in the square: an exception to the art rule, inherited, for the owner to rule on.** They are px-town's existing town-scale figures, the same ones PxTownInn already uses; nothing new was drawn for a character. The rule says characters are ComfyUI art only. The game's 104 × 152 board sprites would stand taller than the inn's door, and a LANCZOS downscale to the scene's 24 px would turn the ComfyUI faces to mush, so the minis are the only figures that share the square's scale. Question for the owner: keep the minis on town-scale scenes (as PxTownInn), or bake a 24 px town sprite per person from the ComfyUI art? On UxInn the rule holds: the company are the board sprites at 1:1, and the faces in the window are the game's ComfyUI face crops.

## Game changes these boards need

1. **The square: a view of its own.** `ui.townTab` is `inn | shop | tavern` today and opens on a tab.
   - Add `square` as the default that `town/enter` sets.
   - Each building becomes its own screen.
   - Esc in a building returns to `square`; Esc in the square is `town/leave`.
   - Keys 1 to 3 pick a building and 4 leaves.
2. **"Shop" becomes "the market".** This affects the `TABS` label in `Town.tsx` and every string that names the building.
3. **The town screen loses the Company button and the satchel.** That means `ui/openModal loadout` from the town, and the `BagGrid` on every tab.
   - The satchel moves to the market screen.
   - The square's route into the company is the list's quiet row "The Company · roster and gear" and key C (Battle Brothers), outside the numbered places. It opens the company screens (UxPerson) the way PxMap1x's command row does.
4. **The scene replaces the vista strip.** The square's scene (this world) replaces `place__vista` (`/art/backdrops/<region>.png`).
5. **Hover forecasts on the square.**
   - The inn's reads `innCost(town, run, env).wounded` (already exported). With nobody wounded, its line becomes the engine's "nobody is wounded" and the inn stays enterable.
   - The market's and tavern's forecasts, the same three lines as the inn's (name with "click to go in", what it offers, why it matters now), from data:
     - **The market:** "Healing Potions 30, Food Rations 40" (`shopStockIds` to `items.json` `buyPrice`), then "Buy and sell. The satchel opens here."
     - **The tavern:** "Rumours at the bar, work on offer", then "Guildmistress Anya is looking for hands." (the first `tavernQuests` entry whose `visibleIf` holds, by `npcName`). With no visible quest the third line is dropped, so nothing claims an urgency it does not have.
   - Both road plates (west fingerpost and east bridge end) are one hotspot meaning, `town/leave`, with one hover forecast: "Back to the road · the map".
7. **"Shop" on other boards.** PxMap1x's forecast calls the town "inn, shop and tavern"; if the rename stands it becomes "inn, market and tavern".
6. **The inn's screen.**
   - Rows come from `innCost().wounded`, and the whole are listed as one quiet line.
   - The bill is `innCost().total`, and the primary is today's `town/innHeal` with today's label, "Rest the wounded · 24 gold".
   - A short purse greys the primary with `canInnHeal`'s own sentence, "the innkeeper wants 24 gold".

## Data checked

- **Riverside Market** (`towns/riverside_market.json`): the line "A bustling trade hub where the river meets the road.", and `innHealCostPerUnit` 12.
- **The bill** (`run/economy.ts`): `innCost` is wounded × 12 = 24, and `healParty('full', true, 'inn')` heals every wounded unit to full, which is why "a bed mends 5" and "37" make them whole.
- **Class names** (`classes.json`): Lord, Shield Knight, Mage.
- **Day 4, 173 gold, and Oak 79/84 and Lilina 25/62** come from PxTownInn (seed 36, after Trader's Rest's wolves), as the brief gives them.
- **Disagreements:** none found between the brief's figures and the data.

## Fix round (after two critics)

- **UxInn's scene was the square panned 159 px (P1, both critics).** Fixed with the critics' better option: the inn has its own common room (`innroom.py`, started in the first round and finished here; its import path into `room/tpx.py` was broken and is fixed in `innroom.py`, not in the snapshot). The innkeeper's hem stood 4 px clear of the counter top; her foot line moved 6 px down so she stands behind it. `uxscene.py` keeps its `inn` camera and `keeper_at_door` for history, but no board uses them now.
- **No route into the company (P1).** Added the quiet "The Company · roster and gear · C" row. The list widened from 282 to 312 px so the C key clears the sub-line.
- **Stalls that were not the market (P1, and the second critic's P2).** All four stalls and their sellers are gone; handcarts, sacks and a second carter stand in their places.
- **The unlabelled east road (P2).** A second "Back to the road" plate at the bridge's east end.
- **No bottom-left hint (P2).** Added.
- **The forecast jammed against the header (P2).** Moved to y 15, x 482; the leader lengthens to the bracket.
- **UxInn P2s.** The bill row's repeated "24" dropped; Enter beside the primary; the way back is a list row with Esc on the inner right edge; the Foundling's name on the name column; Lilina's 25 in rust.
- **Not taken: the hover pointer on the list's border (P2).** That triangle is the kit's `choice()` hover cursor at x -14, and UxTavern's list and the talk boards draw it in the same place. Moving it on one board would make the town's list the odd one out; if it moves, it moves in the kit.
- **Not taken: downscaling the board sprites for the square (P2).** Recorded above as an inherited exception for the owner.

## The weakest point

The square's company are still town-scale minis, not ComfyUI art (see above): the one place in this pair where the art rule bends, inherited from PxTownInn. On UxInn, the room's right half lies under the offer window, so the benches and casks there only peek out; the room reads from its left two-thirds, as the tavern's does.
