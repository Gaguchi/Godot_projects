# ux-satchel · NOTES

One board: `canvas/project/UxSatchel.dc.html`, render `preview/UxSatchel.png`.
Title: "Satchel · the company’s stores after the market, pointing at the new Iron Buckler, day 4".
It replaces the satchel inside `F64Company` and the satchel window on every town tab (`PxTownInn`, `PxTownShop`, `PxTownTavern`).

## Rebuild

```
cd C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad
python dirs/ux-satchel/gen_ux_satchel.py && node preview.mjs UxSatchel
```

- The build is deterministic: two runs write the same bytes (sha1 checked).
- It imports `dirs/kit64` and `dirs/ux-town/uxscene.py` (UxTown's full-screen square) read-only. Nothing outside this folder is written except the board itself.
- The backdrop follows UxTown: the square's strips below the window match `preview/UxTown.png` pixel for pixel before the scrim (checked).
- `z/gen_ux_satchel.round1.py` to `round4.py` are the earlier generators, kept for comparison. `zoom.py` makes the QA crops into `z/`.

## The job and the focal point

- **Job:** what do we carry? The company's stores after the inn and the market.
- **Focal point:** the new Iron Buckler in the large satchel: its icon at 2x (48 px), the kit's lit 'selected' tile and the map's full-size brass bracket, and its card beside it with the name in straw.
- **The one primary:** "Give it to someone…" (brass, Enter; UXREFS 1.12's word). It opens UxEquip holding the buckler on The Foundling, the first who can carry it; Q and E switch people there. The person is chosen once, on UxEquip, never here.

What is on the screen, and why the job needs it:

| On the screen | Why |
|---|---|
| "Riverside Market · day 4", then the title "The satchel" | Where you are: the place, then the screen. |
| "Back to the square Esc" on the where-you-are line, label then cap | The one way back, in the same place and shape as UxMarket, UxInn and UxTavern. |
| The 8 × 4 satchel: the kit's `bag()` at an 84 px cell (gutterless wells, the 'selected' tile, the full-size bracket on the buckler), every icon at an exact 2x NEAREST, "26 squares free" | The job itself, and whether loot or a purchase will fit. The same build and the same selection mark as the satchel on UxEquip and UxMarket, so Satchel → Equip → back shows one satchel. Only the icon scale differs: `bag_cell()` draws 1x, which is a 24 px coin in an 84 px square. |
| The stores line: the sack at 2x, "5 hops of rations", the kit's pips (the ×1 ration shows 1 of 4 left), "enough for the road ahead" | Food lives in the satchel. The words and the pips are exactly UxMarket's larder line (`Town.tsx#Larder`), so the same stores read the same on both screens. The sack is 2x like the grid's icons, so the window has one icon scale. |
| The pointed item's card: "Iron Buckler · off-hand shield · common · takes one square" | What it is (`Town.tsx#shelfWords`). No sell value: nothing is sold here, and gold appears only where it is spent (UXFLOW principle 3, UXREFS 1.12). |
| "The cards it brings": Block 1 AP 4 armor, Parry 1 AP 3 armor · riposte 2, Deflect 0 AP 2 armor | Gear is the deck, so this is the item's real effect (`cards.json`, checked this round, worded as `combat/words.ts`). |
| "Who can carry it": three plain lines with 32 faces, no keys, no lit choice | Information, not a choice: **The Foundling** "right hand free" with a tick; **Oak** "has one already" (UxMarket's words; the swap is explained on UxEquip); **Lilina** face at 45 % and the name faint, the lock and the engine's "Mages do not carry shields". A dim line over the primary says where the choice happens: "Opens on The Foundling. Q and E switch to Oak there." |

## How this screen is reached (the way in)

- **Today the satchel lives inside The Company** (`ui/modals/Loadout.tsx`, "The satchel · pick gear to equip") and on every town tab. There is no screen of its own.
- **New, a game change:** a menu entry "The satchel" beside The Company and Contracts.
  - On the map's command window: "The Company · roster and gear", then **"The satchel · what we carry"**, then "Contracts", then "Menu Esc". It opens over the dimmed map, and the way back reads "Back to the road".
  - In town, the same entry on the square. This board's state is that one: opened from Riverside Market's square after the market, over the square exactly as UxTown draws it under the kit's flat scrim, so closing it lands on the square the player left.
  - **UxTown does not draw the entry.** Its list is 1 to 3 for the places and 4 for the road. It needs one row above the exit with a letter key (suggested **I**, Battle Brothers' inventory key), so the place numbers stay put. That board belongs to ux-town; the request is passed on, not drawn here.
- UxMarket does not route through here. A wearable buy can go straight to UxEquip.

## The way back, and the ways on

- **Esc or "Back to the square":** returns to where it was opened ("Back to the road" from the map).
- **Enter or "Give it to someone…":** opens UxEquip holding the buckler on The Foundling; Q and E switch to Oak there (his own buckler would go back into the satchel; `planEquip` allows it). Lilina cannot be picked on UxEquip either.
- **From UxEquip,** its "Put it back" (Esc) returns here when it was opened from here (ux-company's NOTES say the same).

**Other states of this screen** (not drawn):
- **Pointing at a ration:** "Food Rations · 1 of 4 left". No primary: food is eaten on the road.
- **Pointing at the Healing Potion:** "heals 10". No primary: the engine has no verb to drink it outside battle (see game changes).
- **Nothing pointed at:** the card column is an empty state; the satchel and the stores line still answer the job.

## What I left off, and where it lives

| Left off | Lives on |
|---|---|
| HP | UxInn, UxPerson |
| Decks, deck size, the 9 → 12 change | UxPerson, UxPersonDeck, UxEquip (UxMarket shows it at the moment of buying) |
| Stats, and what each hand holds beyond the verdict | UxPerson |
| The merchant's goods, Buy and Sell | UxMarket (selling from the satchel happens there) |
| Region and encounter odds | the map |
| Throw away (`run/discardItem`) and rearranging (`run/moveBagItem`) | No UI uses them today. They would be quiet secondary verbs here (game change); left off to keep one job and one primary. |

## References, and what I took from each

| Game | What I took |
|---|---|
| Diablo II/IV, Baldur's Gate 3 | A grid with real footprints, and a card for the pointed item: what it is and what it is worth. |
| Resident Evil 4 (attaché case) | The selected item's card carries its action, so the primary belongs to the pointed item. |
| Octopath Traveler (shops) | Who can use it, by face; the one who cannot is dimmed (face and name). |
| Battle Brothers (stash) | A big grid as the screen, the free squares counted, Esc closes; I as the key. |
| Darkest Dungeon (expedition inventory) | Food counted as stacks in the bag: the ×1 and ×4 on the ration tiles. |
| Card Hunter | The cards an item brings are shown with the item. |
| Fire Emblem (convoy) | The class rule in words beside the person. |

## Where the brief and the references disagree

- **The purse is out** (round 5). UXFLOW principle 3 and UXREFS 1.12 both keep gold off this screen and UXFLOW never asks for it here; the round-4 claim that "this brief asks for it" did not hold. The sell value went with it.
- **Lilina's face is dimmed here** (45 %, Octopath), on a plain information line. UxMarket and UxEquip leave her face undimmed inside the kit's `row(state='disabled')`, which dims only the name. If the boards should match, the cheap way is the same 45 % wrapper on those two faces; that is ux-market's and ux-company's call.

## Data checks

Every figure traces to `game/` and agrees with UXFLOW.md:
- **The bag after the buy:** rations ×1 at (0,0), rations ×4 at (1,0), the potion at (2,0), the buckler at (3,0). `findSlot` is first-fit, row-major; the headless run of seed 36 (`dirs/ux-market/probe_market.mts`) confirms it. 26 of 32 squares free, as UxEquip shows.
- **Food:** 1 + 4 = 5, above `lowFoodWarnAt` 3, so the note is "enough for the road ahead".
- **The cards:** `iron_buckler_block` 1 AP, armor 4; `iron_buckler_parry` 1 AP, armor 3 and riposte 2 for 1 turn; `iron_buckler_deflect` 0 AP, armor 2.
- **Lilina's wording:** the engine's sentence, "Mages do not carry shields", alone. UXFLOW's "a tome or a staff" was a loose fragment in the key column here and is gone (it still works on UxMarket, where that column holds deck figures).

## Game changes

1. **A satchel entry** beside The Company and Contracts, on the map's command window and on the town square. It opens a new `satchel` modal (`ui/modals/index.tsx`). Suggested key I, not yet in the shared key map.
2. **The satchel screen itself:** `BagGrid` at a larger cell; a pointed-item card from what the engine already has (`shelfWords`, the item's `gearCardIds` through `combat/words.ts`, `entrySellPrice`, `canHold` / `planEquip` per person); who can carry it (`canHold`) as information, Enter for the primary, Esc to go back; the larder line under the grid.
3. **"Give it to someone…" opens the person screen holding the item, on the first person who can carry it.** `LoadoutModal({ initialUnitId })` cannot start with an item picked, so it needs an initial picked bag entry.
4. **Optional, not drawn:** "Throw away" and drag-to-move, which the engine has but no screen uses; "Use on…" for the Healing Potion outside battle, which would be a new engine verb.

## QA log

- **Round 1 (first build):** four rounds; weakest point named as the sparse grid and small focal item.
- **Round 2 (critics' fixes):** icons at 2x in 80 px squares with a 4 px gutter, the bracket wholly in the gutter; UxTown's square as the backdrop; purse out; dead band closed; Lilina's key removed; the lock at 2x.
- **Round 3 (this brief):**
  1. Full render and crops of the stores line, the holder rows and the buckler at 2 to 4x: the purse and "5 hops of rations" fit the 668 px column with 54 px to spare; nothing clips; the bracket sits in the gutter.
  2. Crops of the header and the card at 3x; the cards checked against `cards.json`; two builds give the same sha1; no font under 13 px; the backdrop strips equal UxTown's.
  3. The holder rows beside UxMarket's at 2x (the words now match: "right hand free", "a tome or a staff"), and the board beside PxTownInn, UxMarket and UxEquip at half size: the same frames, type and scrim as UxEquip.
- **Round 4 (critics' fixes):**
  - The satchel is the kit's `bag()` at an 84 px cell: no gutter, the kit's 'selected' tile and small bracket on the buckler. The hand-rolled 80 px + 4 px gutter grid and the straw tint are gone. The icons stay at 2x.
  - Pips gone from the stores line; "26 squares free" as on UxEquip and UxMarket; the 1x header icon gone; Lilina's face undimmed and "a tome or a staff" gone; Oak's line says the swap ("his own goes in the satchel"; "goes back in the satchel" crowded key 2 to 10 px).
  - Not fixed here: **the way in on UxTown** (P1). It is ux-town's board; the request stands: one row "The satchel · what we carry" with key cap I, under the divider directly above "4 Back to the road", unnumbered; the same row on the map's command window between "The Company" and "Contracts". Until it is drawn, UxFlow should show that edge as a dashed game-change arrow.
  - QA: (1) full render, crops of the bag at 4x (the buckler's lit lip reads against the potion's walnut one, bracket clear of neighbours), the holder rows at 3x (Oak's line ends about 40 px before key 2) and the stores line at 2x; (2) a second full render, the strings that should be gone checked absent in the board file, two builds give the same sha1.
- **Round 5 (two critics' fixes):**
  - Faces: the blank Foundling and Oak faces were a render caught while `mock/up/face_*.png` was rewritten at 22:50. Re-rendered at 23:0x with the files unchanged since; the pixels at (812,404) and (812,444) are face colours, not #2b3c4e.
  - One job: the three 58 px holder rows, keys 1/2 and the lit Foundling are gone. "Who can carry it" is three plain lines with 32 faces; the primary is "Give it to someone…", which opens UxEquip on The Foundling, where Q/E switch. The person is chosen once.
  - Gold out: no purse, no "a merchant pays 30".
  - The larder line now has UxMarket's pips (4, 4 with 3 used) and the sack at 2x, so the window has one icon scale; the stores line sits 6 px higher, clear of the window's lower edge.
  - The buckler carries the full-size bracket (the report's "full-size" claim is now true).
  - The way back moved to the where-you-are line, label then cap ("Back to the square Esc"), as UxMarket.
  - Oak's line is "has one already"; Lilina's face is now actually dimmed (the round-4 report claimed it and was wrong).
  - Not done here: the way in on UxTown and the map's command window (ux-town's board; the request stands, see above).
  - QA: (1) full render, crops of the holder lines at 3x, the bracket at 4x, the stores line at 3x, the header at 2x; the lock was 8 px outside a `.row`, fixed to 16 px; the sack touched the frame, lifted. (2) Second render and crops of the stores line and the primary row; the removed strings are absent from the board file; two builds give the same sha1; the face pixels checked.

