# UXREFS: what shipped games do, screen by screen

For the Ux boards in `UXFLOW.md`. Tables first, then take/avoid.

**How sure each row is**
- **V**: checked this session against a source. The number points to the Sources list at the end.
- **P**: from play, not re-checked online. The layout is reliable; treat exact keys and wording as indicative.

---

## 0. The five rules every reference agrees on

1. **The hub is a picture or a short list of places, never a dashboard.** Warband's town menu is one illustration and a list of verbs [V1]. Battle Brothers draws "a panorama of the whole settlement" with "buildings placed along the incline" that "can be interacted with" [V3]. Darkest Dungeon's Hamlet is one painted scene of buildings [P].
2. **A building opens its own window, and that window does one service.** Warband's marketplace is a submenu of five merchant verbs plus "Head back." [V1]. Darkest Dungeon gives each building one job [V6].
3. **The exit is always the last item, named for where it goes.** Warband ends its lists with "Leave...", "Head back.", "I guess I should leave now." and "Not this time. Good-bye." [V1, V2]. Esc closes the city, shop and inventory windows in Battle Brothers [V5].
4. **Inventory appears only where items move:** the market (shop beside stash), the character screen (paper doll beside stash), and the equip step. No reference shows the stash at an inn or in a tavern.
5. **Talking has its own full-screen anatomy:** the scene behind, the speaker large, a text box along the bottom with a name plate, choices as a centred list, and a quick menu with Back, History, Skip and Auto [V7, V8].

---

## 1. Screen by screen

### 1.1 The town square: where in town do we go?

| Game | Way in | On it / left off | Primary action | Way out, keys | Chk |
|---|---|---|---|---|---|
| **Mount & Blade: Warband** | Move the party onto the town on the map. | **On:** one illustration, two or three lines of situation text, and a vertical list of verbs: "Go to the castle.", "Take a walk around the streets.", "Visit the tavern.", "Speak with the merchant.", "Enter the arena.", "Go to the marketplace.", "Wait here for some time.", "Leave...". **Off:** party, inventory, gold. | Every row is a verb; nothing is preselected. | "Leave..." is last; Esc. | V1 (labels from compiled Native `menus.txt`) |
| **M&B II: Bannerlord** | Same. | **On:** the menu as "an overlay on top of the campaign map" with a smaller illustration, district submenus "that mirror town scene areas", and the town's NPCs as **portraits in the top-right panel** to talk to without walking. | List rows. | Last row; Esc. | V4 |
| **Battle Brothers** | Move onto the settlement. | **On:** the painted panorama, building slots along the slope (tooltip names), settlement name, and contract offers "in the top left of settlement screens". **Off:** stash, roster, paper doll. | Click a building. | Leave button; Esc closes the city window. | V3, V5; layout P |
| **Darkest Dungeon** | Between expeditions you are always here. | **On:** the painted hamlet, buildings that light and name themselves on hover, a resource strip, and the roster down the right. **Off:** inventory, trinkets (in the character sheet). | Click a building. | Embark, bottom right, leads to Provision. | P; building jobs V6 |
| **For The King** | Step onto a town tile. | **On:** a small panel of the town's shops as buttons. Each opens its own shop. | A shop button. | Close. | P (low confidence) |

**Take**
- Use Warband's verb list beside Battle Brothers' panorama: the picture is the menu and the list is its keyboard twin (principle 2).
- Write the rows as verbs in the game's voice ("Visit the inn", "Go to the market", "Visit the tavern", "Back to the road").
- Put the exit last, with a number, so keys 1 to 4 run the square.
- Show the gold in the header only. Contract offers can sit top left as Battle Brothers does, if Embermarch has any to show.
- Hover lights the building and shows a one-line purpose. For the inn, the line carries why it matters now ("two wounded").

**Avoid**
- Darkest Dungeon's always-on roster column: the square never needs the party.
- Bannerlord's portrait shortcut: in Embermarch the tavern room is where people are, so they are not on the square.

---

### 1.2 The inn: do we pay to heal the wounded?

| Game | Way in | On it / left off | Primary action | Way out, keys | Chk |
|---|---|---|---|---|---|
| **Dragon Quest (XI and others)** | Talk to the innkeeper. | **On:** one line of offer with the price ("X gold for the night") and a Yes/No pair. **Off:** everything else. | Yes. | No, or B. Afterwards a fade, a jingle, and everyone is whole. | P |
| **Octopath Traveler** | Talk to the innkeeper in town. | **On:** the price per stay, which varies by town, and Rest/Leave. | Rest. | Leave. | P |
| **Darkest Dungeon (Sanitarium, Abbey, Tavern)** | Click the building. | **On:** treatment slots, each with its gold cost; drag a hero from the roster into a slot. Slot counts are limited ("one medical slot and one treatment slot" at start). **Off:** inventory. | Dropping the hero commits. | Close (X) or Esc. | Slots and costs V6; UI P |
| **Battle Brothers (Temple)** | Click the temple. | **On:** only the brothers with injuries, each injury with its price. **Off:** the healthy ones and the stash. | Treat, per injury. | Leave; Esc. | Healing at the temple V3 (developer comment); layout P |
| **FTL (store, Repair)** | At a store. | **On:** hull bar, "Repair 1" and "Repair All", each with its scrap price. | Repair All. | Leave store. | P |

**Take**
- Show only the wounded, with a bar each (79/84, 25/62), the amount a bed restores, and the price per head. The total and the purse change (173 → 149) sit on the confirm.
- Make the primary one brass button that pays for everyone ("Rest the wounded · 24 gold"), as FTL's Repair All and Dragon Quest's single Yes do.
- Per-person toggles are optional and secondary (Darkest Dungeon slots, Battle Brothers per-injury).
- Afterwards, one beat of payoff: the bars fill. Then return to the square, or stay with the button greyed and "All are whole."
- Name the way back "Back to the square".

**Avoid**
- Drag-to-slot for a one-step decision: Darkest Dungeon needs it because slots are scarce; ours are not.
- Showing whole people at full HP, the satchel, or decks.

---

### 1.3 The merchant: what do we buy, and what do we sell?

| Game | Way in | On it / left off | Primary action | Way out, keys | Chk |
|---|---|---|---|---|---|
| **Octopath Traveler** | Talk to the shopkeeper, then pick Buy, Sell or Leave. | **On:** the item list with price and owned count; the item's text; and the **party as faces**, each with the stat change if they wore it (up/down numbers), dimmed if they cannot equip it. **Off:** a full inventory grid. | Confirm the purchase, then the quantity. An "equip now?" offer is remembered but not confirmed. | Back to Buy/Sell/Leave, then Leave. | P |
| **Fire Emblem (Three Houses and others)** | Monastery menu, then Marketplace, then Armory. | **On:** the item list with price, item stats, and who can use it. **Off:** the map and the roster. | Buy. | B. | Access V9; layout P |
| **Battle Brothers (Marketplace, smiths)** | Click the building on the panorama. | **On:** two grids side by side, **shop stock left and your stash right**, a hover tooltip with value, and the asset strip. **Off:** paper doll, roster. | Right-click moves an item across (buy or sell). Alt-click repairs at a smith. | Leave; Esc. | Esc V5; alt-click repair V10; layout P |
| **The Witcher 3** | Talk to the merchant, then Trade. | **On:** your inventory on one side and the merchant's on the other, the merchant's coin, and a tooltip comparing the item with what you wear (green/red deltas). | Buy or Sell on the hovered item. | Esc. | P |
| **Baldur's Gate 3** | Talk to the trader, then Trade. | **On:** two inventories; items dragged into an offer, a gold balance line, and a Trade button. | Trade, which confirms a whole basket. | Esc. | P |

**Take**
- Battle Brothers' two grids are already our layout: the merchant's counter left, the satchel right.
- Octopath's faces strip on the item card: for the Iron Buckler, Foundling **can** (right hand empty), Oak **can** (already holds one), Lilina **cannot** (dimmed, "a Mage carries a tome or a staff").
- Show what the item brings as card names (Block, Parry, Deflect), Embermarch's equivalent of a stat delta.
- One brass primary, on the item card: "Buy · 60 gold". The purse change (149 → 89) is printed beside it. Selling is the same card with "Sell · 30 gold" when a satchel item is pointed at.
- After a buy of something wearable, offer a secondary "Give it to someone…" that leads to UxEquip (the Octopath idea, as a link, not a modal).

**Avoid**
- The Witcher 3's and Baldur's Gate 3's tabbed category filters for a 26-item stock.
- BG3's barter basket: it is one more step than a single buy.
- Right-click as the only buy gesture (Battle Brothers): it hides the action; keep it as a shortcut beside the visible button.

---

### 1.4 The tavern room: who do we talk to?

| Game | Way in | On it / left off | Primary action | Way out, keys | Chk |
|---|---|---|---|---|---|
| **Mount & Blade: Warband** | Town menu, then "Visit the tavern."; you walk the room in 3D. | **On:** the people in the room are the choices: the tavernkeeper, travellers, a ransom broker, mercenaries, companions. **The keeper:** "Good day dear {sir/madam}. How can I help you?" → buy every man a jar of wine (renown), "Have you heard of anyone in this realm who might have a job…", "I guess I should leave now." **Traveller:** sells a location for "30 denars". **Ransom broker:** "I have got prisoners to sell." | Walk up and talk. | Walk out, or Tab. | Dialogue V2; Tab P |
| **M&B II: Bannerlord** | The town menu's tavern district. | **On:** a list of the people present as portraits, so you can talk without walking. | A portrait. | Back to the town menu. | V4 |
| **Battle Brothers (Tavern)** | Click the tavern. | **On:** one free rumour per visit; buy a round for up to 4 more, each "20 Crowns x" the settlement's price multiplier; drinks for the men (morale). **Off:** stash, roster. | Buy a round. | Leave; Esc. | V11 |
| **Octopath Traveler (Tavern)** | Enter the tavern building. | **On:** the travellers waiting there; you change the party here. | Pick who travels. | Leave. | P |

**Take**
- The room as the menu: Kael at his table, the barkeep behind the bar, the bounty desk.
- Each is a numbered row too, with **who** and **what they offer** ("Kael · a hooded bounty hunter nursing a drink alone", "The barkeep · the talk of the room", "The bounty desk · no prisoners in the wagon").
- The barkeep's rumours open in the conversation screen as his lines (Warband's keeper, Battle Brothers' free rumour). They are not printed as a panel on the room screen.
- The bounty desk is Warband's ransom broker. With nothing to sell, its row stays visible but quiet ("no prisoners in the wagon"), and choosing it gives one line of explanation.
- The exit is the last row: "Leave the tavern".

**Avoid**
- Warband's walk-to-find-them search; Bannerlord added portraits exactly to avoid it [V4].
- Putting the quest board, rumours and bounty desk in one panel, which is today's PxTownTavern.

---

### 1.5 A conversation line

| Game | Way in | On it / left off | Primary action | Way out, keys | Chk |
|---|---|---|---|---|---|
| **Ren'Py default** | Script. | **On:** a full-width textbox 185 px tall at the bottom; the name plate at x 240 on its top edge; the line at x 268, 744 wide; a side image optional at the bottom left; and the quick menu bottom centre. **Off:** all other UI. | Advance: Enter, Space or a click. | Esc opens the game menu. | V7, V8, V12 |
| **Fire Emblem: Three Houses** | A story or support scene. | **On:** a background, a large speaker, a text box bottom with a name plate, and an advance mark. | A. | Skip and Log on buttons. | P |
| **Persona 5** | A story scene. | **On:** a full-body portrait cut-in of the speaker and a strongly styled box bottom with the name. | Advance. | Backlog and Skip on buttons. | P |
| **Hades** | Talk to an NPC. | **On:** the speaker's large portrait on one side, a name plate, and the box along the bottom over the dimmed room. | Advance. | Ends on the last line. | P |
| **Triangle Strategy** | A story event in the diorama. | **On:** the diorama, a box with the speaker's portrait and name, and a profile pop-up on first appearance. **Controls:** "Auto-play… with the ZR button", "events can be skipped with the + button", plus conversation logs. | Advance. | + skips the event. | V13; layout P |

**Take**
- Ren'Py's proportions at 1280×720 (section 2) as the frame.
- The room full screen behind. Kael as large standing art, forward and lit; the Foundling a step back and dimmed.
- The name plate sits on the box's top edge. The advance mark appears only when the line has finished typing.

**Avoid**
- Rendering the engine's single "Continue" choice (every `"text": "Continue"` node in `sq_blood_ties_accept.json`) as a choice button. It is the advance mark.

---

### 1.6 A conversation choice

| Game | Way in | On it / left off | Primary action | Way out, keys | Chk |
|---|---|---|---|---|---|
| **Ren'Py default** | `menu:` in script. | **On:** a centred column, 790 wide, centred at y 270 (above the textbox), 22 px between rows; idle #ccc, hover #fff, unavailable #444. The question line usually stays in the box below. | Click a row. | No cancel by default. | V7, V8 |
| **Disco Elysium** | Any dialogue. | **On:** numbered rows "1. …"; skill checks inline in the row ("[Logic - Medium 10]"), the chance on hover, white (retryable) vs red (one-shot) checks. | Number key or click. | The last numbered row is usually leave. | P |
| **Baldur's Gate 3** | Dialogue. | **On:** numbered rows; check rows tagged "[STRENGTH]" or with a class or race tag; the roll then gets its own dice screen with the DC. | Number key or click. | Usually the last row. | P |
| **Pillars of Eternity** | Dialogue. | **On:** numbered rows; requirement tags like "[Might 15]"; unavailable ones are greyed but visible. | Number key. | Last row. | P |
| **Mount & Blade: Warband** | Any conversation. | **On:** NPC line above, player rows below, the leave row last ("Not this time. Good-bye."). | Click. | Last row. | V2 |

**Take**
- Ren'Py's centred list, plus Disco Elysium and Pillars-style numbering and inline tags.
- For Kael's request:
  1. "We'll bring him back alive."
  2. "What's in it for us?"
  3. "Not our problem."
- Kael's question stays in the box below the list.
- Costs and checks are written into the row ("STR 6 · Oak 6"), never in a tooltip only.
- A choice the company cannot take stays visible and greyed, with the reason in its tag.

**Avoid**
- A dialogue wheel, or paraphrased options: show the line verbatim.
- Timed choices.

---

### 1.7 Two people on stage

| Game | How it stages them | Chk |
|---|---|---|
| **Fire Emblem: Awakening and Fates (supports)** | Two busts, one left and one right, mirrored to face each other, over a plain background, with the text box at the bottom. The name plate shows the speaker; both stay on stage the whole scene. Supports are reached from a menu (Awakening: the world map's Support menu). | Access V14; staging P |
| **Fire Emblem: Three Houses (supports)** | Two characters waist-up in a monastery setting; the speaker is indicated by the name plate and their animation, the listener stays put. | P |
| **Triangle Strategy** | Sprites stand in the diorama at their real places; the speaker's portrait and name ride on the box; the camera favours the speaker. | P |
| **Ren'Py default** | `show x at left` / `right` / `center` (bottom-anchored transforms). It does **not** dim listeners by default; the usual recipe is a character callback that brightens the speaker and darkens the rest. | P (docs pattern) |
| **Hades** | Zagreus's portrait on the left when he answers, the NPC on the right; only the current speaker's portrait is fully up. | P |

**Take**
- Daren speaking: forward, lit and slightly larger, on the side his line belongs to. Kael beside and behind, dimmed one ramp step, never removed.
- The name plate goes to the speaker's side of the box.
- When the speaker changes, swap who is lit. Do not move anyone. Moving people on every line reads as jitter.

**Avoid**
- Three or more people at full size; anyone else in the room is background folk.
- Mirroring a ComfyUI sprite to face the other: the brief forbids edits. Choose the side by the art's facing instead.

---

### 1.8 The conversation history

| Game | Way in | On it | Way out, keys | Chk |
|---|---|---|---|---|
| **Ren'Py default** | Quick menu "History", or the game menu. | Opens **scrolled to the bottom** (newest last). Each entry has the name right-aligned to x 155 (155 wide) in the character colour, the line at x 170, 740 wide, and an entry height of 140. It keeps 250 entries. When empty: "The dialogue history is empty." | Return or Esc. | V7, V8 |
| **Triangle Strategy** | A log button during events. | Prior lines, with voice replay. | Back. | V13 |
| **Persona 5** | A Backlog button. | Speaker and line, newest at the bottom. | Back. | P |
| **Disco Elysium** | Always on: the right-hand column is the scrolling transcript. | The whole conversation, including your chosen replies. | Not applicable. | P |

**Take**
- Ren'Py's layout: a names column right-aligned, then the lines, newest at the bottom, opened at the bottom.
- Your chosen answers appear in the log as the Foundling's line, in a distinct colour.
- The way back is "Back to the conversation", and Esc does the same.

**Avoid**
- A log you can click to jump back and re-choose (Ren'Py rollback past a choice). See section 2.3.

---

### 1.9 A person's kit

| Game | Way in | On it / left off | Primary action | Way out, keys | Chk |
|---|---|---|---|---|---|
| **Fire Emblem (unit screen)** | Select a unit, then R or Status. | **On:** portrait, name, class, level, HP, a stats column, the weapon/item list, and weapon ranks. **Off:** the convoy. | Not applicable (read). | B. Switch units with up/down or L/R. | P |
| **Battle Brothers (character screen)** | C or I. | **On:** the paper doll (head, body, main hand, off-hand, accessory, ammo, bag slots), stats, the stash grid beside it (toggles to perks), and the roster grid "in the lower right corner". | Drag an item to a slot. | Esc, C or I. Switch by clicking a roster portrait. | C/I and roster V5, V15; layout P |
| **Darkest Dungeon (character sheet)** | Click a hero in the roster. | **On:** portrait, class, resolve level, stats, skills, two trinket slots, weapon and armour levels, quirks, diseases. | Not applicable. | Close (X). Switch by clicking another roster hero. | P |
| **Card Hunter** | The party screen, then a character. | **On:** item slots by type (weapon, armour, boots…); "highlighting an item in a slot reveals… the cards that are attached to it"; right-click for a big view. **Off:** gear can only be swapped "between battles". | Drag an item in. | Back. | V16 |

**Take**
- Fire Emblem's portrait and stat column, plus Card Hunter's slot-to-cards link: the Foundling's two hands, left (Iron Sword) and right (empty).
- Point at a hand and its cards light in the deck summary ("Iron Sword · 4 cards").
- The deck count (9) is shown with a link to the deck screen.
- Q and E (or Tab) switch person, with the other two shown as small faces. Fire Emblem and Darkest Dungeon both keep the switcher small.

**Avoid**
- Battle Brothers' always-open stash on this screen. The stash opens here only in the equip state (UxEquip).

---

### 1.10 A person's deck

| Game | Way in | On it | Way out, keys | Chk |
|---|---|---|---|---|
| **Slay the Spire** | The deck icon at the top right, or **D**. | Every card in a grid, full size; sort header: obtained order (default), type, cost, A–Z. The map is on M. | Esc, or Return. | V17 (keys from `InputActionSet`: D deck, M map, A draw, S discard, X exhaust, E end turn; sort from `MasterDeckSortHeader`) |
| **Card Hunter** | The character sheet. | Cards attached to each item, revealed per item on hover; the deck is the sum of items. | Back. | V16 |
| **Griftlands** | The deck button. | Two separate decks (battle and negotiation) as tabs, cards in a grid. | Esc. | P |

**Take**
- Group the Foundling's cards by **where they come from**: Lord (5) and Iron Sword (4: Slash, Thrust, Guard Break, Riposte).
- The group header is the source with its count; that is Card Hunter's model, laid out as Slay the Spire's grid.
- Duplicates stack with ×n.
- Esc leads back to the person.

**Avoid**
- Slay the Spire's sort header: 9 to 12 cards do not need sorting, and source grouping already says more.

---

### 1.11 Equipping an item from the stores

| Game | Way in | On it | Primary action | Way out | Chk |
|---|---|---|---|---|---|
| **Battle Brothers** | The character screen. | The paper doll and stash side by side. | Drag, or right-click to equip. | Esc. | P |
| **Diablo II / IV** | Inventory. | Grid and paper doll; while holding an item, valid slots light up and invalid ones show red. | Drop on a slot. | Esc. | P |
| **Card Hunter** | The character sheet. | Party loot list and slots. The cards an item adds show before you commit. | Drag in. | Back. | V16 |
| **Octopath Traveler** | Equip menu, then the person, then the slot. | Only items that fit that slot, each with the stat delta. | Confirm. | B. | P |
| **Darkest Dungeon** | Character sheet, plus the trinket list. | Trinkets dragged to two slots. | Drop. | Close. | P |

**Take**
- Hold the Iron Buckler and the right hand lights as the only valid slot (Diablo).
- The deck change is previewed before committing: "9 → 12, + Block, Parry, Deflect" (Card Hunter).
- Commit with one brass "Put it in the right hand"; the satchel is visible beside the person only in this state (Battle Brothers).
- When equipping from the satchel side, offer the people who can take it, as faces (Octopath's filter); Lilina shows dimmed.

**Avoid**
- Drag as the only route: keep click-to-pick-up, click-to-place, and the button.

---

### 1.12 The stores themselves (the satchel)

| Game | On it | Primary action | Chk |
|---|---|---|---|
| **Battle Brothers (stash)** | A big grid with filter buttons, sitting beside the market or the paper doll. | Context: buy/sell/equip by right-click. | P |
| **Diablo II/IV (inventory, stash)** | A cell grid; items take their footprint; a hover card shows stats and price. | Drag. | P |
| **Resident Evil 4 (attaché case)** | A grid with real item footprints, a selected-item card with actions (Use / Equip / Discard), and a rotate action. | The action list on the selected item. | P |
| **Darkest Dungeon (expedition inventory)** | 16 stack slots, food and torches included, with stack counts. | Use. | P |

**Take**
- RE4's selected-item card with its action list.
- Pointing at the Iron Buckler gives one brass "Give it to someone…", which leads to UxEquip. A Healing Potion's action is "Use on…".
- Show the food total as a fact of the grid ("5 food · 5 hops"), because food lives in the satchel and on the map.

**Avoid**
- Item-rotation and Tetris mechanics: our items are fixed shapes in an 8×4 grid.
- Gold or HP on this screen.

---

## 2. The standard visual-novel anatomy (Ren'Py default screens)

### 2.1 Proportions at 1280×720

The values come from `gui/game/gui.rpy` (`gui.init(1280, 720)`) and `screens.rpy` [V7, V8].

| Part | Position and size | Style notes |
|---|---|---|
| Textbox (`say` window) | Full width, `ysize 185`, `yalign 1.0`, so it spans y 535 to 720 (26% of the height). | Background image. |
| Name plate (`namebox`) | `xpos 240`, `ypos 0`, so it sits on the textbox's top edge at x 240; the size follows the text; borders 5 px. | Name text 30 px, in the accent or the character's colour. |
| Dialogue text | `xpos 268`, `ypos 50`, `xsize 744`, so it spans x 268 to 1012 and starts at y about 585. | 22 px, left-aligned, white. The margins are symmetric: 268 px each side. |
| Side image | Bottom left, inside the 240 px left gutter. | Optional; hidden on phones. |
| Choice list | `xalign 0.5`, `ypos 270`, `yanchor 0.5`, so it is centred in the area above the textbox; rows 790 wide (x 245 to 1035); padding 100/5; 22 px spacing. | Text 22 px, centred; idle #cccccc, hover #ffffff, unavailable #444444. |
| Quick menu | `xalign 0.5`, `yalign 1.0`, in a row at the bottom centre, over the textbox's bottom edge. | Text 14 px; idle #aaaaaa, selected in the accent colour. Buttons: Back, History, Skip, Auto, Save, Q.Save, Q.Load, Prefs (touch: Back, Skip, Auto, Menu). |
| Skip indicator | Top left, `ypos 10`. | "Skipping". |
| Notify | `ypos 45`. | Toast. |
| History entry | Row height 140; name right-aligned at x 155 (155 wide); text at x 170, 740 wide. | 250 entries kept; opens at the bottom. |
| NVL mode (alternative) | 6 entries on a full-screen page; name at x 430, text at x 450, 590 wide. | Not for us. |

**For Embermarch**
- Keep the frame: a bottom box about 185 tall, the name plate on its top edge, a text column about 744 wide, choices centred above the box, a small quick menu.
- Swap DejaVu for Source Serif 4 (dialogue), Jacquard 24 (the name plate only if it reads at 30 px), and the Filigree window.
- Trim the quick menu to **History · Auto · Skip** (no saves mid-conversation in a roguelite).

### 2.2 Behaviours (Ren'Py defaults)

| Behaviour | Default | Keys | Chk |
|---|---|---|---|
| Advance | The first press finishes the typing line, the next advances. Text speed `text_cps` defaults to 0, meaning instant. | Enter, Space, keypad Enter, left click | V12, V18 |
| Auto-forward | Off by default (`afm_enable False`), `afm_time 15`; toggled from the quick menu. `toggle_afm` has no default key. | None | V12, V18 |
| Skip | Skips **only seen text** by default (`skip_unseen False`) and **stops at a choice** (`skip_after_choices False`). | Hold Ctrl; Tab toggles; `>` fast-skips to the next choice | V12, V18 |
| Rollback | Steps back line by line, even across choices, and lets you re-pick. | PageUp, wheel up; rollforward PageDown, wheel down | V12 |
| Hide the UI | Shows the art alone. | H, middle click | V12 |
| Game menu | Opens the menu, with History as a tab. | Esc, right click | V12 |

**For Embermarch**
- Space, Enter or a click advances; the first press completes the line.
- Auto is a toggle with a visible state.
- Skip runs through seen lines only and always stops at a choice. A quest conversation is "seen" if read in an earlier run.
- **Rollback is reading only:** History can be scrolled, but nothing re-picks a choice after its effects have happened (`startQuest`, gold). It is a roguelite.
- Esc in a conversation opens the pause menu, not "leave"; a conversation ends only through its own last line or choice.
- H hides the box to see the art. It is optional.

### 2.3 How Fire Emblem and Triangle Strategy stage two speakers

| | Fire Emblem supports (Awakening, Fates) | Fire Emblem: Three Houses | Triangle Strategy |
|---|---|---|---|
| Stage | Plain or location backdrop. | A 3D monastery location. | The HD-2D diorama, the real place. |
| The two | Busts left and right, facing inward, both visible throughout. | Waist-up models side by side. | Small sprites at their places; the portrait rides on the text box. |
| Who speaks | The name plate and expression change; the speaker is the lit or front one. | Name plate and animation. | Portrait and name on the box; the camera favours them. |
| Extras | Supports reached from a menu (Awakening: the world map). | Log and skip buttons. | Auto on ZR, Skip on +, conversation logs and profile pop-ups [V13]. |
| Chk | Access V14; staging P | P | Controls V13; staging P |

**For UxTalkTwo**
- Fire Emblem's two-bust stage (both stay, facing each other by choice of side), with the lit/dimmed swap from principle 5.
- Triangle Strategy's profile pop-up idea is worth stealing once: the first time Daren appears, a one-line tag ("Daren · Kael's brother").

---

## 3. In detail: the four closest models

### 3.1 Mount & Blade: Warband, the town menu and the tavern [V1, V2]

**The town menu (`menu_town`)**
- An illustration, then the situation text, then the verbs, in this order, shown only when they apply:
  1. "Go to the castle." / "Go to the Lord's hall."
  2. "Join the tournament."
  3. "Take a walk around the streets."
  4. "Visit the tavern."
  5. "Speak with the merchant."
  6. "Enter the arena."
  7. "Go to the marketplace."
  8. "Manage this town."
  9. "Wait here for some time."
  10. "Leave..."
- Rows that do not apply are **hidden, not greyed**.
- "Go to the marketplace." opens `menu_town_trade`, "You head towards the marketplace.", with:
  1. "Assess the local prices."
  2. "Trade with the arms merchant."
  3. "Trade with the armor merchant."
  4. "Trade with the horse merchant."
  5. "Trade with the goods merchant."
  6. "Head back."
- Each "Trade with…" opens the trade screen, with the merchant's goods and yours side by side.
- **Two depths, two ways out:** "Head back." returns to the town menu; "Leave..." returns to the map.

**The tavern**
- A walkable scene. Each person is a conversation with its own menu, and the **last row is always the goodbye**.
- **The tavernkeeper:** "Good day dear {sir/madam}. How can I help you?"
  - "I'd like to buy every man who comes in here tonight a jar of your best wine." The price comes back in a line ("I reckon {reg5} denars should be enough for that"), with "Actually, cancel that order." as the escape.
  - "Have you heard of anyone in this realm who might have a job for a {man/woman} like myself?"
  - "I guess I should leave now."
  - Returning to the menu: "Anything else?"
- **The traveller:**
  - "What can you tell me about this land?"
  - "I want to know the location of a claimant."
  - "I am looking for one of my companions..." The price is stated as a line ("For 30 denars, I'll tell you."), then "All right. Here is 30 denars." or "Never mind."
  - "Farewell."
- **The ransom broker:**
  - "I have got prisoners to sell."
  - "Tell me about what you do again."
  - "I wish to ransom one of my companions."
  - "Not this time. Good-bye."

**Lessons**
1. The price is said in the conversation and confirmed by a choice, with a cancel beside it: our bounty desk and the barkeep's round.
2. "Anything else?" returns you to the person's menu after each topic, so a person is a small hub.
3. Hidden rows keep the list short; Embermarch can grey the bounty desk instead, because "no prisoners" teaches the capture mechanic.

### 3.2 Battle Brothers, the settlement and market screens [V3, V5, V10, V11, V15]

**The settlement**
- "A panorama of the whole settlement", built from 15 layers. The background follows the terrain; a townhall or keep sits on the hill, and "a set of buildings placed along the incline" are the interactive services.
- Contract offers show "in the top left of settlement screens".
- Buildings include the marketplace, specialist weapon and armour smiths (sell and repair), the tavern, the temple (healing), recruits, and docks (paid passage).
- Esc closes the city, shop and inventory windows.

**The market** [P layout]
- A dialog over the panorama: shop grid on the left, your stash on the right.
- Right-click moves an item across. Hover gives the value, which varies by settlement. At a smith, alt-click repairs.

**The tavern**
- 1 free rumour per visit, up to 4 more bought with a round (20 crowns × the settlement's price multiplier, and +0.1 relations each).
- Drinks for the men raise morale.

**The character screen**
- C or I opens it.
- Paper doll and stats on the left, the stash grid right (toggles to perks), and a roster grid with 27 slots in the lower right (two battle lines plus reserves).
- Switch brother by clicking his portrait; drag and drop for formation.

**Lessons**
1. A building is a picture you click, and its window opens over the panorama, so you never lose "where".
2. The market is exactly two grids, which is our UxMarket.
3. Rumours have a **free first one**, which suits the barkeep: one rumour told for free, the rest heard on asking.
4. Do **not** take the character screen whole: it is the "everything at once" screen the owner rejected.

### 3.3 Darkest Dungeon, the Hamlet [V6; UI P]

**The scene**
- One painted hamlet that brightens as you upgrade it. Hover lights a building and names it; click opens its window.
- Resources run across the top; the roster of heroes, with stress bars, runs down the right; Embark sits bottom right and leads to the Provision shop.

**The buildings, one job each**

| Building | Job |
|---|---|
| Stagecoach | Recruit, free |
| Guild | Skills |
| Blacksmith | Gear levels |
| Sanitarium | Quirks and diseases, in slots |
| Abbey and Tavern | Stress relief, in slots, which lock the hero for the next expedition |
| Survivalist | Camp skills |
| Nomad Wagon | Trinkets |
| Graveyard | The dead |
| Memoirs | The Ancestor's journal |

**Building windows**
- A header art, the slots with their gold cost, and the roster dragged in.
- Slot counts are scarce and upgradable (Sanitarium: "one medical slot and one treatment slot" at start).
- Close returns to the panorama.

**The character sheet**
- Opens from the roster; trinkets are dragged to its two slots.

**Lessons**
1. One building = one service; a building that does two things (the Sanitarium) uses two tabs, not one crowded panel.
2. The roster on the right is DD's one concession, because every building consumes heroes. Embermarch's square does not, so leave it off.
3. The hover-to-light-and-name on the painted scene is the closest match to our brass bracket.

### 3.4 Octopath Traveler, shops, inns and taverns [P]

- **The way in:** walk up to the shopkeeper and talk. The first screen is a three-row choice: Buy / Sell / Leave.
- **Buy**
  - The item list with price and owned count on the left; the item's description and stats; the party as four faces, each with the stat change it would make (up or down, coloured), and a dimmed face if they cannot use it.
  - Select, then quantity, then confirm.
  - An offer to equip on the spot is remembered but **not confirmed online**; builders should treat it as an idea, not a citation.
- **Sell:** your items with the sell price.
- **The inn:** talk to the innkeeper; one price per stay (varying by town) and Yes/No; a fade, then everyone is restored.
- **The tavern:** where you change who travels with you; the people waiting are the choices.

**Lessons**
1. "Who can use this, by face, and what it does for each" is the best single idea for UxMarket's item card.
2. Buy/Sell is a first choice, not two panes, in Octopath; Embermarch's side-by-side counter and satchel (Battle Brothers) is better for selling, so keep the Octopath faces but not the extra step.
3. The inn as a one-question screen.

---

## 4. Cross-screen key map (consensus)

| Key | Does | Precedent |
|---|---|---|
| 1 to 9 | Pick a row (place, person, answer) | Disco Elysium, BG3, Pillars (P); Ren'Py has no default number keys |
| Esc | Back one level, named; in a conversation, the pause menu | Battle Brothers [V5], Ren'Py game menu [V12], Slay the Spire cancel [V17] |
| Space, Enter, click | Advance a line, or confirm the brass primary | Ren'Py `dismiss` [V12], Slay the Spire confirm = Enter [V17] |
| Q / E, Tab | Previous / next person | Fire Emblem L/R (P). Note: Ren'Py uses Tab for skip; keep Tab out of conversations |
| Ctrl (hold) | Skip seen lines | Ren'Py [V12] |
| D | The person's deck, from the person screen | Slay the Spire [V17] |

---

## Sources (checked 2026-10-25)

1. Warband Native compiled menus (`menu_town`, `menu_town_trade` option strings): github.com/Pavolab/warband, `menus.txt` (fetched via the GitHub API, labels extracted).
2. Warband Native conversations (tavernkeeper, traveller, ransom broker lines): github.com/Pavolab/warband, `conversation.txt`.
3. Battle Brothers Dev Blog #53, Village Screen Rework: https://battlebrothersgame.com/dev-blog-53-village-screen-rework/
4. Bannerlord dev blog, Town Menu: https://www.gamebanshee.com/k4d9x
5. Battle Brothers controls (Esc closes city/shop/inventory, C/I inventory), via search summary of Steam threads: https://steamcommunity.com/app/365360/discussions/0/620712364039071912 and https://www.magicgameworld.com/?p=124793
6. Darkest Dungeon wiki: Hamlet, Town, Sanitarium: https://darkestdungeon.wiki.gg/wiki/Hamlet, https://darkestdungeon.wiki.gg/wiki/Town, https://darkestdungeon.wiki.gg/wiki/Sanitarium
7. Ren'Py `gui.rpy`: https://raw.githubusercontent.com/renpy/renpy/master/gui/game/gui.rpy
8. Ren'Py `screens.rpy`: https://raw.githubusercontent.com/renpy/renpy/master/gui/game/screens.rpy
9. Three Houses Armory access (Monastery, Marketplace): twinfinite.net guide via search summary.
10. Battle Brothers repair with alt-click at a smith: Steam threads, app 365360 (search summary).
11. Battle Brothers Tavern Rumours: https://battlebrothers.fandom.com/wiki/Tavern_Rumors (search summary; the page itself is paywalled to the fetcher).
12. Ren'Py keymap: https://www.renpy.org/doc/html/keymap.html
13. Triangle Strategy demo-survey changes: https://www.nintendo.com/us/whatsnew/triangle-strategy-debut-demo-survey-results-nintendo-switch
14. Awakening supports from the world map menu: siliconera.com and rpgamer.com review, via search summary.
15. Battle Brothers new UI (roster grid lower right, 27 slots, drag between duty and reserve): https://battlebrothersgame.com/ui-released-beta-branch/
16. Card Hunter: https://en.wikipedia.org/wiki/Card_Hunter and https://www.quartertothree.com/fp/?p=25913
17. Slay the Spire decompiled `InputActionSet.java` and `MasterDeckSortHeader.java` (libGDX keycodes: 32 D, 41 M, 29 A, 47 S, 52 X, 33 E, 66 Enter, 131 Esc): github.com/Li-Binghui/MySlayTheSpire
18. Ren'Py preferences: https://www.renpy.org/doc/html/preferences.html

**Not reachable this session:** Mount & Blade and Battle Brothers Fandom pages (402), StrategyWiki (403), GameFAQs (403), Game UI Database (403). Rows marked P could not be confirmed against them.
