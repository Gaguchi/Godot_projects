# ux-tavern: the tavern room, and the room behind every conversation

One board replaces the Tavern tab of PxTownTavern, which put the rumours, the quest board, the bounty desk and the satchel on one counter.

- `canvas/project/UxTavern.dc.html`: "Tavern · Pine Crossing, day 6, pointing at Kael"
- `dirs/ux-tavern/interior.py`: Pine Crossing's tavern by day, the 1280 × 720 room at grain 1. UxTalk, UxTalkChoice, UxTalkTwo and UxTalkLog (dirs/ux-talk) use it as their background, with `render(people=False)`.

Rebuild (from the scratchpad root; it writes the board, then renders it):

    cd C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad && python dirs/ux-tavern/gen_ux_tavern.py && node preview.mjs UxTavern

The output is deterministic: fixed seeds only, so two runs write the same bytes. The conversation boards pick up the room when dirs/ux-talk rebuilds (`python dirs/ux-talk/gen_talk.py`), so rebuild ux-tavern first.

## UxTavern: who do we talk to?

- **Focal point:** Kael. He has the brass bracket and a forecast window pinned under him on the map's brass leader. While he is pointed at, his plate gives way to the forecast, so his name shows once on the world. The forecast holds his line and the one brass primary, Talk, with its Enter key as on UxInn. He stands in the window light, which is the brightest light on the floor now that the hearth is banked.
- **The room is the menu**, as in Mount & Blade's tavern: the people in the room are the choices.
  - **Kael** stands alone at the end of a small table by the windows. The table's corner is at his right hand and his tankard is on it, under that hand. He is his ComfyUI board sprite (`board/kael.png`, 104 × 152) at exactly 1:1, with the kit's 1 px ink edge, and is never redrawn.
  - **The barkeep** stands behind the bar, polishing a tankard, with the shelves and the casks behind him.
  - **The bounty desk** stands under its board of three WANTED bills (red heading bar, an inked hood-and-shoulders likeness, a red wax seal) and one slip, with a ledger, an inkpot and a cash box on it. It reads as the desk's wanted board, not a quest board.
  - The barkeep and the desk have plates on the world, so what you can point at reads before any hover (Kael's plate is hidden only while his forecast is open). The desk's plate is quiet (dim, with the lock) because the wagon is empty, and it matches its row in the list.
- **The forecast** (pointing at Kael):
  - "Kael", set with `person()` in straw;
  - his line from the town data, verbatim: "A hooded bounty hunter nursing a drink alone." (`towns/pine_crossing.json`, `tavernQuests[0].npcDescription`);
  - "Talk", the one primary.
- **The list window, bottom right,** "In the room", holds the same three, numbered for the keyboard:
  - "1 Kael · work on offer", in its hover state to mirror the bracket;
  - "2 The barkeep · the talk of the room";
  - "3 The bounty desk", disabled, with the engine's own reason `NO_PRISONERS` ("no prisoners in the wagon", `engine/run/town.ts`) in the quiet tone with the lock (an empty wagon is not danger, so no rust);
  - then a groove, and "4 Back to the square" with Esc.
- **The header, top left,** reads "Pine Crossing · day 6" over "The tavern": the place, then the room. It is the same window as UxInn's header ("Riverside Market · day 4" / "The inn"), so the two rooms read alike. The brief worded it "Pine Crossing · the tavern", day 6, and the board carries the same three facts in UxInn's order.
- **Way in:** UxTown's "Visit the tavern" (3), or a click on the tavern on the square.
- **Ways out:**
  - 1, a click on Kael, or Talk opens UxTalk, the Blood Ties conversation (`dialogue/sq_blood_ties_accept.json`).
  - 2, or a click on the barkeep, opens his conversation, where the town's rumours are his lines.
  - 3 does nothing while the wagon is empty. Pointing at the desk shows the reason and the game's hint: "Wound a foe, then Capture him on the field. The magistrate pays by the head." With prisoners, it opens the desk's screen: the prisoners, their bounties, and "Turn in all".
  - 4, or Esc, goes back to the square (UxTown).

## The interior (interior.py)

`render(people=True, seed=6)` returns `(Room, info)`. Room has `image()`, `png_bytes()`, `data_uri()` and `save(path, zoom=1)`.

- **people=False** takes out the two you can talk to, Kael and the barkeep (the conversation screens bring them back as stage art). The two drinkers at the bar stay, so the room does not empty when a talk opens. Every table, mug and cask stays.
- **info** gives the stage points in screen px, the same with or without people (only the `light` mask differs, since Kael cuts the light):
  - `kael`: `foot`, `head`, `box` and `plate`;
  - `barkeep`: the same keys;
  - `bounty_desk`: `box`, `desk_box`, `board_box` and `plate`;
  - `bar`: `box`, `top_y` and `shelf_box`;
  - `hearth`: `box` and `fire`;
  - `windows`, `light` (the mask of the window light on the boards), `patrons` (now two, on the bar stools), `floor_y`, `scale` and `open_floor`;
  - `kael_table` (x, y, w, h), added this session. Nothing else changed, and the signature is the same.
- **The room:**
  - a timber-and-plaster back wall, with two windows on the upper left looking out on pines and hills;
  - a stone chimney breast with antlers over the mantel and a fire banked low (a short tongue with no white core, over a long bed of embers), so it does not outshine the window light round Kael;
  - the wanted board over the bounty desk, and shackles on the post beside it;
  - the bar along the right, with shelves of mugs, jugs and bottles, a cradle of casks and a hop bine under the beam;
  - a long table with two benches, empty but for one cup; Kael's small table; a table near the door end; two tall bar stools with a drinker on each; stools; and three barrels;
  - floorboards with straw, and the windows' light laid on the boards with the mullions' shadows in it.
- **The pixel bar (PXWORLD):**
  - Every colour is a pxworld ramp index (`tpx.py` builds on px-camp's `cpx`). Shading steps down each object's own ramp.
  - Light comes from the windows on the upper left. Every prop throws a hard cast shadow down-right, as the floor one ramp step darker. Kael also stands on a hard block of shadow under his boots, as UxInn's people do.
  - Everything in the window light cuts it: each prop's and Kael's silhouette is carried along the light's own direction (`_light_cast`, the same rule as the windows' patches), and that floor stays unlit.
  - Every object has a selout outline in its own darkest step.
  - Texture is drawn: wood grain and knots, coursed stone with mortar and chips, planks with butt joints and nails.
  - **One scale:** 80 px to a metre of height, 40 px to a metre of floor depth, which is the camp's. Kael is 140 px tall.
  - The barkeep and the patrons have no art, so they are procedural background folk at the room's own scale (`folk.py`). The barkeep shows only above his counter. The patrons sit on tall stools at the bar with their backs to the room, their forearms angled onto the counter and their boots on the stools' rungs. They wear low-chroma tunics (grey wool and dull tan), so none outshines Kael's leathers, and they never come close.

## What I left off the screen, and where it lives

| Left off | Where it lives instead |
|---|---|
| The rumours | The barkeep's conversation: his lines, verbatim from `towns/pine_crossing.json` |
| The satchel and the larder | The market (UxMarket), the satchel screen (UxSatchel) and the map |
| The Company button and window | The company screens (UxPerson, UxPersonDeck, UxEquip) |
| Gold | The town header on the square, the inn and the market. Nothing is spent in the tavern room. |
| Blood Ties, its reward and its story | The conversation (UxTalk, UxTalkChoice). As in Mount & Blade, you learn the job by sitting down with him. |
| The desk's hint and its prisoner rows | Pointing at the desk (the hint), and the desk's own screen once there are prisoners |
| A door | The way out is behind the viewer. The list's last row and Esc are the way back. |

## The references, and what I took from each

- **Mount & Blade: Warband's tavern.** The people in the room are the choices: the keeper for the talk of the room, a traveller with work, and the ransom broker, which is our bounty desk.
- **Mount & Blade II: Bannerlord.** The same people as a list, so you never walk the room to find them. That is the numbered window, which also gives the number keys.
- **Battle Brothers' tavern.** The rumours are something you get from the keeper, not a panel. The barkeep's row is "the talk of the room".
- **UXREFS 1.4.** Each row says who it is and what they offer. The desk's row stays visible but quiet when the wagon is empty. I did not take its "Leave the tavern": the task names the way back "Back to the square", which is where it goes.
- **dirs/ux-town (UxTown, UxInn).** The header window, the plates on the world, the bracket, the forecast on the map's brass leader, and a numbered list with the way back last, with its Esc key.
- **PxCamp.** The scale and the projection: board sprites at 1:1 among props drawn to them.

## Game changes

- **The tavern is a room screen of its own.** It is not a tab of one town screen. You enter it from the square, and it lists the people in the room.
- **The barkeep is a new talk target.** In `Town.tsx` today, the rumours are a register on the tavern pane ("What the room is saying", two rumours chosen by the day). Here they become the barkeep's lines in a conversation. The game needs a barkeep conversation built from `town.rumors`. Whether he says the day's two rumours or all three is a design call: the brief says all three, verbatim.
- **The bounty desk is a place in the room.** It shows as disabled with `NO_PRISONERS` while the wagon is empty. It needs its own small screen when there are prisoners: the rows and "Turn in · n" from `Town.tsx`, plus "Turn in all".
- **The wanted board is scenery.** It belongs to the bounty desk. Quest givers are people in the room (Kael), and there is no separate quest-board panel. Guildmistress Anya, on Riverside Market's board, would stand in that town's tavern the same way.
- **A town data field for where each person stands** (Kael by the window), if rooms are to be laid out from data. For now, the board places them by hand.

## Data checks

- "Pine Crossing", "A quiet crossroads settlement nestled among the pines.", and Kael's `npcName` and `npcDescription` all come from `towns/pine_crossing.json`. The quest is `sq_blood_ties`, and the dialogue is `sq_blood_ties_accept`.
- Day 6 comes from the brief.
- The town's inn heals at 8 gold a head (`innHealCostPerUnit`), but the tavern board shows no price, so nothing here disagrees with the data.
- `NO_PRISONERS` = "no prisoners in the wagon", from `engine/run/town.ts`. The hint is from `Town.tsx`; the board writes it without the em dash.

## QA

Four rounds: render, Read the PNG, and 3 to 6× NEAREST crops of Kael, the desk, the bar and the barkeep, the hearth, the windows, the patrons, the forecast and the list. Then I held it next to PxCamp, PxTownInn, UxTown and UxInn.

- **This session's fixes:**
  - **The patrons were boxy sacks.** They now have hand-stepped round shoulders, and upper arms that angle out to elbows on the table's edge, with a crease where each arm meets the back.
  - **The desk's plate read as open** while its row said shut. It is now dim, with the lock.
- **Checked:**
  - no text under 13 px;
  - nothing clipped or overlapping;
  - brass only on what is pointed at, plus the one primary;
  - no satchel, company, rumours or gold on the board;
  - the AI-trappings list is clean;
  - `people=False` renders, and two renders are byte-identical.

### The critics' round (two critics, both "fix")

Fixed:
- **P1, the patrons at the centre were not choices.** I moved them out of the middle. Two now sit on tall stools at the bar, backs to the room, either side of the barkeep's plate. I dropped the third. The long table in the middle is empty but for one cup.
- **P1, the desk's reason was in danger red.** "no prisoners in the wagon" is now the quiet tone (b2) with the lock. The row's faint name and off key say that it is disabled.
- **P1, Kael had no shadow and did not cut the light.** He now stands on a hard down-right block, the floor one step darker. His silhouette, and every prop's, is carried along the window light's direction and kept off the lit floor.
- **P1, the fire and the green and blue tunics led the eye.** The fire is banked: a smaller flame with no o6 core and no sparks, over more embers. The tunics are now grey and dull tan. The window pool round Kael is the brightest light on the floor.
- **P1/P2, the picture disagreed with "nursing a drink alone".** The table now butts against his right side, its corner at his hand, with the tankard right under that hand. I dropped the stool on the far side. I tried critic 2's version, with Kael standing behind the table, and rejected it: the table hid him from the belt down, and the focal figure shrank to about 80 px.
- **P2, Talk had no key.** It now has the Enter cap on its left, placed as UxInn places it (58 px left, 9 px down).
- **P2, the row pointer sat on the window's inner rule.** It now sits inside the row's band (4 px in), with the key caps moved right to make room. The back row's key lines up under the others.
- **P2, the notice board read as a quest board.** It is now three WANTED bills with inked likenesses and red seals, plus one slip.
- **P2, Kael's name appeared three times.** His plate is hidden while the forecast is open. The leader runs from the bracket's foot to the forecast.
- **P2, the room emptied when a talk opened.** `people=False` keeps the two drinkers.
- **P2, the patrons had no forearms.** `folk.patron(arms=True)` adds a wedge past each elbow, angled forward and in onto the counter.

Not taken:
- **P2, move the list window to the top right to match UxTown and UxInn.** The top right of this room holds the bar and the barkeep, who is one of the three choices. A list of the room's people on top of one of those people breaks the screen's own rule that the room is the menu. Restaging the bar to the left would put it in the hearth's place and reflow the whole room, and the conversation boards that use it. So the list stays bottom right, the one place where it covers nothing you can point at. This is a deliberate exception to the town boards' layout.

Rounds after the critics: two. Each round I rendered the board, then made 2 to 6x NEAREST crops of Kael and his table, his feet and shadow, the bar and its drinkers, the hearth, the wanted board, the forecast and the list. I also checked the `people=False` room and confirmed that two renders are byte-identical.

The ux-talk boards (UxTalk, UxTalkChoice, UxTalkTwo, UxTalkLog) were not re-run: they belong to another builder. They pick up this room when `python dirs/ux-talk/gen_talk.py` runs next.
