# UxMarket · notes

One board: `canvas/project/UxMarket.dc.html`, titled "Market · Riverside Market, day 4, 149 gold, pointing at the Iron Buckler on the counter". It replaces `PxTownShop`.

## The job and the focal point

- **Job:** what do we buy, and what do we sell?
- **Focal point:** the Iron Buckler's card in the centre column. It has the brass "Buy · 60 gold" button and the faces of who can carry it.
- **Layout:** the merchant's goods are on the left, ours on the right, and the deal between them. The eye runs from his counter, through the card, into our satchel, where a dotted brass outline shows where the buckler would land.

## What is on it, and why the job needs it

- **Top-left window: where we are, and the way back.**
  - It reads "Riverside Market · day 4" over "The market" in Jacquard. This is the same pattern as UxInn ("The inn") and UxSatchel.
  - "Back to the square" then the Esc cap sits top right: label first, cap after, as UxInn and UxTavern spell it.
- **The counter: the day's goods, cheapest first.**
  - Every good shows its icon, its name and its price. The coins stand in one fixed column and the numbers right-align, so 2- and 3-digit prices line up. The footprint glyphs are gone: at 1x they read as noise, and the card's "fits the satchel" and the landing square carry it.
  - The purse line ("beyond the purse · it holds 149 gold") falls between the Steel Buckler (130) and the Iron Greatsword (150).
  - Below that line, rows are dimmed to silhouettes and each shows its shortfall in rust ("1 short" … "51 short"), as PxTownShop did.
  - 20 whole rows show. A scrollbar and "7 more further back" account for the rest, so no row is sliced. The game's own comment on the shelf says the same.
  - The Iron Buckler row is selected: brass ring, straw name, the pointer arrow.
- **The card: what is pointed at.**
  - Its name with the shield icon and 60 gold.
  - "off-hand shield · common" and "fits the satchel" with a tick.
  - The cards it brings: Block 1 AP 4 armor, Parry 1 AP 3 armor · riposte 2, Deflect 0 AP 2 armor.
  - Who can carry it, by face:
    - The Foundling: "Lord · right hand free" with a tick, and "9 → 12 cards".
    - Oak: "Shield Knight · has one already", and "10 → 10 cards" (buildDeck), so every capable row answers in cards.
    - Lilina: the row is disabled with the engine's refusal "Mages do not carry shields", and "a tome or a staff", as UxSatchel prints it.
  - The purse line "Purse 149 → 89 gold left", then Enter and the one brass primary, "Buy · 60 gold".
- **The satchel: ours.**
  - The kit's 8×4 grid with Food Rations ×1, Food Rations ×4 and the Healing Potion.
  - The buckler's landing square at (3,0), beside the potion. This is findSlot's first fit, drawn as a dotted brass outline with a silhouette and no bracket, because the pointer is on the counter.
- **Selling, made plain without a second card.**
  - The satchel window carries "What he pays for ours · half his price":
    - Food Rations ×1 (one hop left): 5.
    - Food Rations ×4: 20.
    - Healing Potion: 15.
  - The three are 28 px rows with the counter's anatomy (icon, name, the same fixed coin column): sell targets, like their grid cells.
  - Under them, in plain secondary text with no bullet: "Point at one of ours, here or in the satchel, to sell it."
  - Pointing at one of ours turns the same card to its sell price, with "Sell · N gold" in danger red.
- **The larder: "5 hops of rations"** with the kit's food pips (1 of 4 left in the first ration, 4 of 4 in the second) and "enough for the road ahead" under it, as UxSatchel says it.
  - It sits on the card's primary row, so both columns end on one baseline. Rations are on the counter, so food matters here.
- **The card's foot:** the Buy button keeps 20 px to the inner keyline; the space came from the card's section gaps.
- **The backdrop: Riverside's street**, from px-town's scene and slid 132 px west so the market stands over the card column.
  - The merchant stands behind his counter under the striped awning. He is a nameless townsman at the scene's grain: grey hair and beard, a walnut leather jerkin, folk_more.MAN's rows in his own palette. The awning's shadow falls on his brow, and the sword laid on the counter stays in front of him.
  - The company is not in the street: they are at the counter, which is the screen itself.
  - The kit's flat 62% scrim lies over the counter column and under the card and satchel. The street above them is dimmed only 25%, so the market, its awning, its shield sign and the merchant read the way UxInn's square does. The scrim edges fall in the gutters.
  - scene.py's second porter landed in the gutter between the card and the satchel after the slide; he walks the east road past the bridge instead.

## The way in and the way back

- **In:** from UxTown, "2 Go to the market", or a click on the market building.
- **Back:** "Back to the square", or Esc, returns to UxTown.
- **Keys:** Enter buys the pointed good, which is the consensus key map in UXREFS §4.

## Left off the screen, and where it lives

- The town's description and the full purse readout: UxTown's header. Here the purse appears where it is spent: the counter's purse line and the card's 149 → 89.
- The company's stats, hands, HP and decks: UxPerson, UxPersonDeck and UxEquip. Here the company appears only as the three faces the buckler question needs.
- Equipping the buckler: UxSatchel, then UxEquip, after the market.
- HP and beds: UxInn. Rumours, the quest board and the bounty desk: UxTavern.
- The food pips: the map and UxSatchel. Here the larder line says it in words.
- The seven dearest goods (Obsidian Axe 200 to Composite Bow 250): one scroll further back on the counter.

## References, and what each gave

- **Battle Brothers' market:** shop stock left, your stash right, Esc to leave. That is the two sides.
- **Octopath Traveler's shop:** the party as faces on the item, each with what it does for them, dimmed if they cannot use it. That is the "Who can carry it" rows, with the deck change as our stat delta.
- **Fire Emblem's armory:** the price list, and who can use the item.
- **The Witcher 3's trade screen:** the merchant's goods on one side, yours on the other, and the hovered item's card. Here the card sits between the two sides rather than floating.
- **Mount & Blade:** the exit is named for where it goes.
- **Avoided:** category tabs for a 27-item stock, BG3's barter basket, and a right-click-only buy.
- **The game's own Town.tsx:**
  - the footprint drawn, not printed;
  - the beyond-the-purse reason;
  - "Pick something from the satchel to sell it.";
  - the Larder's words;
  - the sell price as entrySellPrice, so a part-used ration fetches what is left in it.

## Data: checked against the engine, and where the brief and the data differ

`probe_market.mts` replays seed 36: Trader's Rest, Frontier Camp, then Riverside Market. This is the run PxTownInn and PxCamp trace to. The probe enters the town, pays the inn and reads the market.

- **The data wins on the stock.** On day 4 the counter holds **27 goods, not 26**.
  - shopStock's one or two rotating picks are drawn per run and per day. On day 4 of seed 36 they are the **Ice Quiver (150)** and the **Obsidian Axe (200)**.
  - The **Molten Crossbow** came from day 2 of another run (seed 7), the PxTownShop list, and is not on this counter.
- **Everything else matches the brief:**
  - the purse is 149 after the inn and 89 after the buy;
  - the satchel holds rations ×1 at (0,0), rations ×4 at (1,0) and the potion at (2,0), and the buckler lands at (3,0);
  - canHold says yes for the Lord and the Shield Knight, and "Mages do not carry shields" for Lilina;
  - buildDeck gives The Foundling 9 cards, and 12 after planEquip puts the buckler in his right hand;
  - entrySellPrice gives 5, 20 and 15; the buckler would sell back for 30.
- **For ux-company:** buildDeck gives Oak **10** cards with the lance and the buckler (4 from the class, 3 from each). F64Company printed 7.

## Game changes this board needs

- **A market screen of its own**, opened from the square, in place of the Shop tab of today's three-tab Town screen.
  - Its way back is the square. Today's town screen only goes back to the road.
- **The counter as one priced list**, cheapest first, scrolled, with the purse line. Today the shelf holds eight cards with Back and More.
- **An item card for the pointed good**, built only from engine functions that exist today:
  - canHold for each person;
  - buildDeck with the item planned in, through planEquip, for the deck change;
  - placeInBag and findSlot for "fits the satchel" and where it lands;
  - the purse change.
- **The same card turns to the sell side** when a satchel item is pointed at: its entrySellPrice and "Sell · N gold". Today a separate sell bar does this with Sell and Keep.
- **A "What he pays for ours" list** beside the satchel, one entrySellPrice per bag entry.
- **Keys:** Enter buys, and Esc goes back to the square.
- **Not drawn, but suggested by UXREFS §1.3:** after buying something wearable, a secondary "Give it to someone…" that opens UxEquip.

## Files

- `gen_ux_market.py`: the board. It imports the kit and px-town's `gen_px_town` (footprint, purse_rule, forecast_line). It copies and changes tariff_row (re-spaced) and ghost_cell (without the bracket).
- `market_scene.py`: the backdrop. It imports px-town's scene pieces read-only, and copies render() with the 132 px slide, no company, the merchant and two east-bank trees.
- `probe_market.mts`: the engine check. Run it with game/'s tsx; it writes nothing to game/.
- `zoom.py`: QA crops (PIL NEAREST) into `z/`.

## Rebuild

```
cd C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad && python dirs/ux-market/gen_ux_market.py && node preview.mjs UxMarket
```

The output is deterministic: two builds write byte-identical boards (same md5). To re-check the data:

```
E:/Work/GameDev/Godot/fe-mb/game/node_modules/.bin/tsx dirs/ux-market/probe_market.mts
```

## Review round (critics' findings, 2026-10-25)

- **Fixed:**
  - The P1 on selling: the sell list is a set of rows with the counter's anatomy, and the hint is plain text without the arrow glyph.
  - The P1 townsman in the gutter: moved to the east road, and both gutters were checked clear below y 228.
  - The way back now reads label then cap. The footprint column is gone. The coin columns are fixed. Oak's row shows "10 → 10 cards". The larder uses UxSatchel's pips and is pinned to the primary's row. The Buy button has its 20 px inset. The band above the windows is under a lighter scrim.
- **Not taken:**
  - Moving "Back to the square" to the card's foot. The market has no action list for it to end, the way UxInn's offer and UxTavern's room list do. The card's foot has no room beside Enter and Buy. UxSatchel uses the same header placement. Only the order was changed.
  - Dropping "a tome or a staff" and writing "right hand empty". UxSatchel's render prints "a tome or a staff" and "right hand free", the same words as this board, so the two already agree.
  - UxTown's camera. It puts the market at y 250-430, under the card. The street keeps its framing, and the lighter band names the place instead. No hover bracket was added, because it means "the pointer is here", and the pointer is on the counter.
