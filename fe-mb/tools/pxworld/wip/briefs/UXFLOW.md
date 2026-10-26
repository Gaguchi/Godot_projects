# Embermarch · one job per screen (shared brief)

The scratchpad is `SP = C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad`. Paths below are relative to it unless they start with `E:/`. The game is `E:/Work/GameDev/Godot/fe-mb/game` (read-only).

## What the owner asked

The owner reviewed the house-style boards and wrote, in their words:

> "Even though I love this UI and the look and the feel and everything is fantastic, I feel like we need to get inspired with actual real life games on this. Like, for example, when entering town, the UI should not show everything all at once. The party, the inventory, the, you know, whatever. I think we need to have, like, you know, in just choices. You go to the tavern, and then maybe you get, like, someone to talk to, and then the dialogue choices, all separate screens. And maybe there's an inventory screen if you go into the inventory, but there's also a trade screen if you go to a merchant of some kind, and custom character screens are separate for their inventory, their equipment, you know, and the dialogue screen, like questline dialogues. Also need to be, you know, the standard VN screens. [...] even though the design is fantastic, let's make also sure that the UX is also good, not just the UI."

- **Keep the look.** It is accepted: Filigree windows (the kit in `dirs/kit64/`) over the 1× pixel world, Jacquard 24 titles, Source Serif 4 reading type, the brass primary.
- **Change the structure.** Every screen does one job. You go deeper by choosing, one step at a time, and every step has its own screen.

## What is wrong today

Look at these renders in `preview/` before you design:
- **The town tabs** (`PxTownInn.png`, `PxTownShop.png`, `PxTownTavern.png`): one screen per town with Inn, Shop and Tavern tabs, and each tab shows everything at once.
  - Every tab also carries the satchel grid, a detail card, The Company button and the way back.
  - The inn's job is healing, which never uses the satchel, but the satchel is there.
  - The tavern shows the rumours, the quest board and the bounty desk together, plus the satchel.
- **The Company** (`F64Company.png`): all three people, with their stats, both hands and their decks, plus the satchel and an item card, in one window.
- **Dialogue** (`F64Dialogue.png`): a small box over the dimmed map. Quest conversations have no screen of their own.
- **The camp** (`PxCamp.png`) already does one job: rest or scout tonight. It is the model. Leave it alone.

## The principles

1. **One job per screen.** Each screen answers one question: where in town do we go; do we pay to heal; what do we buy or sell; who do we talk to; what do we say; how is this person kitted; what do we carry.
2. **The scene is the menu, where there is a scene.** In the town square the buildings are the choices. In the tavern the people are the choices. A short list of the same choices sits beside the scene, numbered for the keyboard, as Mount & Blade's town menu does. Point at a building or a person and it lights (the brass bracket from the map's hover) and names itself.
3. **Show what the decision needs, and nothing else.**
   - The satchel appears only where it is used: at the merchant, and when equipping.
   - HP appears where it matters: at the inn, on a person's screen.
   - Gold appears where it is spent: the town header, the inn and the merchant.
   - Food lives on the map and in the satchel.
   - If a thing is on the screen, the job needs it. Anything else waits one click away.
4. **Where you are, and the way back.**
   - The top-left window says where you are: the place, then the room ("Riverside Market · the inn").
   - Every screen has one way back, named for where it goes ("Back to the square", "Leave the tavern", "Back to the road"), and Esc does the same.
   - One brass primary per screen. Everything else is secondary.
5. **Conversations are visual-novel screens**, with the standard anatomy (Ren'Py's default screens are the reference):
   - the room behind, full screen;
   - the people as large standing art, the speaker forward and lit, a listener a step back and dimmed;
   - a name plate on the text box, and the text box along the bottom;
   - an advance mark when the line is finished, with Space or Enter or a click to go on;
   - the choices as a centred list, numbered, each carrying its cost or check on the choice itself (the way `F64Dialogue` shows "STR 6 · Oak 6");
   - a small quick menu: History, Auto, Skip;
   - a History screen of what has been said.
6. **Road events stay pop-ups over the map** (`F64Dialogue`'s job), because the map is their context and they are quick. Story and quest conversations get the visual-novel screens. This is the builder team's call, flagged to the owner.
7. **The game's model, not a new one.**
   - The company shares one satchel, an 8×4 grid (`game/src/ui/components/BagGrid.tsx`).
   - Each person has two hands: the left hand holds a weapon, the right an off-hand.
   - A person's deck is built from their class's cards plus the cards their gear brings.
   - There are no per-person packs, recruits or blacksmith.
   - So a person's screen is where their kit lives, and the satchel screen is the company's stores. If a board needs something the game does not have (a new menu entry, a new screen), list it under game changes in NOTES.md.
8. **Keys.**
   - Number keys pick a choice or a place.
   - Esc goes back.
   - Q and E (or Tab) switch person.
   - Space or Enter advances a line.

## The moment: shared facts every board traces to

**The town flow is Riverside Market on day 4.** The figures come from `PxTownInn` and the game data.
- **The town:** "A bustling trade hub where the river meets the road." The Borderlands, a town. The purse holds **173 gold**.
- **The company:**
  - **The Foundling**: Lord, level 1, mov 5, 73/73. Iron Sword in the left hand, the right hand empty. STR 5, MAG 0, SKL 4, SPD 5, DEF 3, RES 1, LCK 4.
  - **Bagrat "Oak"**: Shield Knight, level 1, mov 3, 79/84. Iron Lance and Iron Buckler. STR 6, MAG 0, SKL 3, SPD 2, DEF 9, RES 2, LCK 1.
  - **Lilina**: Mage, level 1, mov 5, 25/62. Fire Tome. STR 1, MAG 7, SKL 5, SPD 5, DEF 2, RES 7, LCK 3.
- **The satchel** (8×4): Food Rations ×1 and ×4 (5 food, "5 hops of rations") and a Healing Potion ×1 (heals 10).
- **The path through town:**
  1. Arrive at the square.
  2. The inn: the innkeeper charges 12 gold a head for the wounded. Oak and Lilina are hurt; a bed mends 5 and 37, which makes them whole. 24 gold, so **173 → 149**.
  3. The market: the stock is today's `PxTownShop` list (26 goods, cheapest first; read it from `dirs/px-town/`). Buy the **Iron Buckler**: 60 gold (sells for 30), a shield, 1×1 in the satchel, common, bringing 3 cards (Block, Parry, Deflect). That makes **149 → 89**.
     - The Foundling can carry it: a Lord takes shields, and his right hand is empty.
     - Oak can carry it, but he already has one.
     - Lilina cannot: a Mage carries a tome or a staff.
  4. The company screens come after the market. Everyone is whole (73/73, 84/84, 62/62), there are **89 gold**, and the satchel holds rations ×1 and ×4, the Healing Potion and the new Iron Buckler.
  5. The Foundling's deck is **9 cards**: 5 from the class and 4 from the Iron Sword (Slash, Thrust, Guard Break, Riposte). With the buckler in his right hand it is **12**.
- Read exact names, cards and prices from `game/src/content/data/` (`items.json`, `classes.json`, `cards.json`, `towns/riverside_market.json`) and the engine (`game/src/engine/run/town.ts`). Where a figure above disagrees with the data, the data wins: say so in NOTES.md.

**The tavern and conversation flow is Pine Crossing on day 6.**
- **The town:** "A quiet crossroads settlement nestled among the pines." The Borderlands (`towns/pine_crossing.json`).
- **The tavern room:**
  - **Kael**, "A hooded bounty hunter nursing a drink alone.", who offers the questline Blood Ties;
  - **the barkeep**, who has the talk of the room: the town's three rumours, verbatim;
  - **the bounty desk**: no prisoners in the wagon. You wound a foe, capture him on the field, and the magistrate pays by the head.
- **The conversation** is `dialogue/sq_blood_ties_accept.json`, every line verbatim:
  1. start;
  2. explain: Kael's brother Daren has fallen in with a bandit gang;
  3. request: three answers, "We'll bring him back alive.", "What's in it for us?" and "Not our problem.";
  4. then offer, accept or decline.
- **Later in the questline**, `dialogue/sq_blood_ties_daren_captured.json` is the reunion back at the tavern: Daren says "Kael...? I thought you'd given up on me."

## The boards

| Board | Folder | The job | The state |
|---|---|---|---|
| `UxTown` | `ux-town` | Where in town do we go? | Riverside Market, day 4, arriving in the square. The inn, the market, the tavern, and the road out. Pointing at the inn, since two of the company are hurt. |
| `UxInn` | `ux-town` | Do we pay to heal the wounded? | The innkeeper's offer: Oak 79/84 and Lilina 25/62, 12 gold a head, 173 → 149. |
| `UxMarket` | `ux-market` | What do we buy, and what do we sell? | The merchant's counter and our satchel, side by side. Pointing at the Iron Buckler: who can carry it, what it brings, 149 → 89. |
| `UxTavern` | `ux-tavern` | Who do we talk to? | Pine Crossing's tavern: Kael alone at a table, the barkeep, the bounty desk. Pointing at Kael. |
| `UxTalk` | `ux-talk` | Read Kael's line | Blood Ties, the "explain" line, with Kael speaking and The Foundling listening. |
| `UxTalkChoice` | `ux-talk` | What do we say? | Kael's request and the three answers, one of them pointed at. |
| `UxTalkTwo` | `ux-talk` | Two people on stage | The reunion: Daren speaking, Kael beside him. |
| `UxTalkLog` | `ux-talk` | What was said? | The History screen for Blood Ties so far. |
| `UxPerson` | `ux-company` | How is this person kitted? | The Foundling: Iron Sword in the left hand, the right hand empty, 9 cards. The other two are one key away. |
| `UxPersonDeck` | `ux-company` | What will they draw? | The Foundling's 9 cards, grouped by where each comes from. |
| `UxEquip` | `ux-company` | Where does the new buckler go? | Holding the Iron Buckler from the satchel. The right hand takes it, and 9 → 12 cards. |
| `UxSatchel` | `ux-satchel` | What do we carry? | The satchel after the market. Pointing at the new Iron Buckler; its action leads to UxEquip. |
| `UxFlow` | `ux-flow` | How do the screens connect? | Every Ux board as a small picture, with the ways in and the ways back. Built last. |

Each board is 1280×720, `$preview` 1280×720, with `<title>` in the form "Screen · the state" (e.g. "Town · Riverside Market, day 4, arriving, pointing at the inn"). Use the same board format as `dirs/pxworld/gen_map.py` and `dirs/px-town/gen_px_town.py` write.

## Real games to learn from

`dirs/UXREFS.md` holds the full study. A research agent writes it while you build, so read it when it appears. The short list:

| Screen | Games |
|---|---|
| **The town square** | Battle Brothers, where the town is a painted panorama and each building is a button that opens its own screen. Darkest Dungeon's Hamlet. Mount & Blade: Warband's town menu, a picture and a list of places. For The King. |
| **The inn** | Darkest Dungeon's treatment slots: who needs it, the price, one confirm. |
| **The merchant** | Octopath Traveler and Fire Emblem shops, which show who can use an item, by face, with the change it makes. Battle Brothers, whose stash sits beside the market. The Witcher 3: the merchant's goods on one side, yours on the other, and a compare card. |
| **The tavern** | Mount & Blade's tavern, where the people in the room are the choices: the keeper for rumours, travellers, and the ransom broker (our bounty desk). |
| **The conversation** | Ren'Py's standard screens (say, choice, quick menu, history). Fire Emblem's support conversations. Triangle Strategy. |
| **A person** | Fire Emblem's unit screen. Battle Brothers' character screen, where the stash opens beside the paper-doll when you equip. Darkest Dungeon's character sheet. For the deck, Slay the Spire's deck view. |
| **The satchel** | Battle Brothers' stash. Darkest Dungeon's inventory. A grid with an item card, as in Diablo and Baldur's Gate 3. |

## Art and code

- **The UI kit** is `dirs/kit64/`, documented in `KIT.md`. Import it and never edit it. Its satchel grid, windows, buttons, faces, bars and type are what make the boards match each other.
- **Today's boards and their code** are the starting point. Read them, import them, and copy only what you change:
  - the town scene and its three tab boards in `dirs/px-town/`;
  - the camp in `dirs/px-camp/`;
  - the company, dialogue, pause and contracts pop-ups in `dirs/px-popups/` and `dirs/f64-interrupts/`;
  - the world kit in `dirs/pxworld/`: palette ramps, Canvas, Sprite, `build.py` and `props.py`.
- **Characters are ComfyUI art from the game, and only that.**
  - The full art is `game/public/sprites/units/<sprite>.png`, 832×1216 with alpha.
  - The board sprites are `game/public/sprites/units/board/<sprite>.png`, 104×152.
  - Face crops are in `mock/` (`face_<sprite>_<n>.png`).
  - The sprite ids come from `game/src/content/data/characters.json`: mc → roy, oak → marcus, lilina → lilina, kael → kael, daren → daren.
  - Resize once with Pillow LANCZOS to the size you show, and place the result at exactly 1:1. Never draw, repaint, recolour or edit a character.
  - People without art (Guildmistress Anya, the barkeep, the merchant, patrons) appear only as small procedural background folk at the scene's grain, the way `dirs/px-town/` draws its townsfolk, and never close up.
- **New art goes into the board as a data URI**: WebP with alpha for painted character art, PNG for pixel art. Art already on the canvas is referenced through `mock/blobs.json`, as today's boards do. `preview.mjs` maps those blobs to `mock/up/`.

## Rules

- **Work in your own folder** (`dirs/ux-town`, `ux-market`, `ux-tavern`, `ux-talk`, `ux-company`, `ux-satchel` or `ux-flow`) and write only your own boards (`canvas/project/Ux*.dc.html`).
- **Never edit** shared code, another folder, an existing board, `canvas_index.py` or anything under `game/`. Nothing is committed and nothing is published by you.
- **Determinism.** Use fixed seeds, never `hash()` of a string; use `zlib.crc32` for a seed from a name. The same code writes the same bytes on every run.
- **The pixel-art bar for any new scene** (a tavern interior, the square at full screen) is `dirs/PXWORLD.md`:
  - selout outlines;
  - light from the upper left, through windows when indoors;
  - drawn texture;
  - hand-stepped curves;
  - hard cast shadows one ramp step down;
  - one scale per scene.
- **The screen rules** are in `dirs/SCREENS.md`, apart from its painted-world line.
- **The owner's no-AI-trappings list** (in your CLAUDE.md) applies to every pixel and every word.
- **Copy is in the game's voice.** Lines from the game's data are quoted verbatim.

## Method

1. **Plan before you draw.**
   - Name each board's job and its one focal point.
   - List everything that will be on it, and why the job needs each thing.
   - Sketch the 1280×720 layout in ASCII.
   - Check it against the references.
2. **Build and render**: `cd SP && python dirs/<your folder>/<generator>.py && node preview.mjs <Board>`.
3. **QA, at least three rounds:**
   - read the PNG, and 3-5× crops made with PIL NEAREST;
   - hold it next to `preview/PxTownInn.png` and `preview/PxCamp.png` and ask whether it is the same game and at least as good;
   - ask whether the board does one job in one second;
   - fix, and render again.
4. **Write NOTES.md** in your folder:
   - each board's job and focal point;
   - the way in and the way back;
   - what you left off the screen and where it lives instead;
   - the references you used and what you took from each;
   - any game changes;
   - the exact rebuild command.
