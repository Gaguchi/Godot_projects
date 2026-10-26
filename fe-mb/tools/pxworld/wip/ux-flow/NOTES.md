# UxFlow: how the screens connect

Board: `canvas/project/UxFlow.dc.html`, title "Flow · one job per screen, how the screens connect". Render: `preview/UxFlow.png`.

## Job and focal point
- **Job:** how do the one-job screens connect?
- **Focal point:** the middle row, the spine: the map, the square, the tavern, the say screen and the choice. The town's rooms hang above the square, History and the reunion hang above the talk, and the company's screens run along the bottom from the map's menu.

## What is on it, and why
- **The background:** the pixel map (`world_map()`) under the kit's flat scrim. This is the house style: Filigree windows over a dimmed pixel scene. The map is also the flow's root.
- **Two windows only:**
  - the header, with "Flow" in Jacquard, one line on what the board is, and the legend;
  - "The map's menu", which draws the map's command window as it is today (The Company, Contracts, Menu) plus the new satchel row. Row C starts here.
- **Thirteen pictures.** Each is a board's own preview PNG, cropped to its 1280 x 720 stage and downscaled once with LANCZOS to 192 x 108. Each sits in the kit's recessed well. The root is `PxMap1x`, the accepted map; there is no Ux map board.
- **Each picture has two lines:** its job in a few words (s14), then the screen's name and its named way back (s13 dim), for example "Inn · Back to the square".
- **The ways between screens** are plain pixel rules: a 2 px o4 brass core on a 1 px ink edge, with square corners. They have no arrowheads and no boxes. Each rule carries two lines: over it (or first) the way in, a key cap, click or choice; under it (or second) the way back. A rule is dashed where the game lacks that way today.
- **A short note in the empty corner** names what these screens replace: the town's three tabs, The Company window and the dialogue box for quest talk.

## The ways, as drawn
| From | To | Way in | Way back |
|---|---|---|---|
| Map | Town | march onto Riverside Market | Esc (or 4), "Back to the road" |
| Town | Inn | 1 | Esc, "Back to the square" |
| Town | Market | 2 | Esc, "Back to the square" |
| Town | Tavern | 3 | Esc (or 4), "Back to the square" |
| Tavern | Talk | 1 (Talk, or a click on Kael) | the talk's own answer 3, "Not our problem." |
| Talk | Choice | Space (Enter, a click) | none: Esc pauses |
| Talk | History | History, in the quick menu on any line | Esc, "Back to the conversation" |
| Choice | Talk Two | 1, then the field (Daren caught alive, back at the tavern) | none: it must be heard |
| Map | the map's menu | on the map, top right | |
| Menu | Person | C, The Company | Esc, "Back to the road" ("Back to the square" from town) |
| Person | Deck | D, or the Deck tab | D, or the Kit tab |
| Person | Equip | Try the Iron Buckler | Esc, "Put it back" |
| Satchel | Equip | Enter, "Give it to someone…" | Esc, "Put it back" |
| Menu | Satchel (dashed) | I, The satchel: a new entry on the map's menu and the square's list | Esc, "Back to the road" (or the square) |

- Every horizontal rule reads left to right. That is why the satchel sits before the equip screen in row C.
- Q and E (the next person) is on the person's label, not a rule, because it is a step within the same screen.
- The Choice to Talk Two rule follows `sq_blood_ties_accept.json`: answer 1 (or 2, then "You have a deal.") goes to `accept`, which starts the quest. The reunion, `sq_blood_ties_daren_captured.json`, plays back at the tavern after Daren is captured.

## Left off, and where it lives
- **Each board's state and details:** on the board itself. The pictures are for recognising a board, not for reading it.
- **Contracts and Menu (pause):** shown dim in the map's menu because they are outside this pass. They have no rules.
- **The Company from the square** (UxTown's "The Company [C]"): named in the satchel tag and in UxTown's own board. It has no second rule, so row C keeps one root.
- **Road events:** they keep `F64Dialogue`'s pop-up over the map (UXFLOW principle 6). That is not drawn here.
- **"Today's boards these replace":** one sentence, not pictures. Pictures of the old boards would double the board's count of images.

## References
- **UXREFS section 4, the cross-screen key map:** numbers pick, Esc goes back by name, Space or Enter advances, Q and E switch person, D opens the deck. Every tag uses these keys.
- **The six groups' NOTES.md:** every way in and way back on the board comes from them, word for word where they give the label ("Back to the square", "Back to the conversation", "Put it back", "Give it to someone…").
- **Mount & Blade's town menu:** the square as the hub with the places as numbered children, and the leave row last. This is why the Town node is drawn as a hub.

## Game changes
- **The satchel entry** on the map's command window and the square's list (key I). This is ux-satchel's request: ux-town has not drawn it, and the map board has no such row. It is drawn dashed, as ux-satchel asked.
- The other game changes (the square as a view of its own, the market, tavern and talk screens, and the person, deck and equip split) are in each group's NOTES.md and are not repeated here.

## Rebuild
```
cd C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad && python dirs/ux-flow/gen_ux_flow.py && node preview.mjs UxFlow
```
- The board reads the other boards' `preview/*.png`. Re-render those first if any of them changes.
- Two builds give the same sha1.

## QA rounds
1. **First render.**
   - The header's legend overflowed its window: reworded and tightened.
   - "Try the Iron Buckler" and "Put it back" sat on one line: split above and below the rule, as the legend says.
2. **Crops at 3x** of the header, the spine, the map's menu and the talk lane.
   - The dashed rule's start crowded the C rule's Esc tag: its corner moved to x 218.
   - The stray space in "1 , then the field": fixed.
   - The satchel-to-equip rule read right to left: the satchel and the equip screen swapped columns, so every horizontal way reads left to right.
3. **The foot, the comb and the corner note.**
   - The note ran past the right margin and onto the stage's foot: shortened to three lines inside the margin.
   - The final render was checked in full. No text is under 13 px, nothing clips, and there are no rounded corners, shadows beyond the kit frame's own, pills or icons in circles.
