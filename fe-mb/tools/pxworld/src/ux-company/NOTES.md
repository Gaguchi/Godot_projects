# ux-company: the person screens

Three boards in `canvas/project/`, replacing `F64Company`: **UxPerson**, **UxPersonDeck**, **UxEquip**.
The Foundling is chosen on all three. The state is Riverside Market, day 4, after the inn and the market: everyone is whole and the purse holds 89 gold. The satchel holds rations ×1 and ×4, the Healing Potion and the new Iron Buckler.

**Rebuild** (from the scratchpad root):

```
cd "C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad" && python dirs/ux-company/gen_ux_company.py && node preview.mjs UxPerson UxPersonDeck UxEquip
```

The build is deterministic: two rebuilds in a row give the same bytes. The backdrop is UxTown's square, so rebuild after `dirs/ux-town/uxscene.py` changes.

## Files

- `uxc.py`: the game data and the shared pieces.
  - Reads classes, items, cards and characters from `game/` (read-only).
  - `card_face()` ports `combat/words.ts#cardFace` and `CardHand.tsx#cardType`.
  - The card art, and the full art resized once.
  - The dimmed square: `dirs/ux-town/uxscene.py#render('square')`, imported and not copied, the same backdrop UxSatchel uses.
  - The face strip.
- `screen.py`: `person_screen(uid, tab, held, hover_card, tip)`, the one screen.
  - Two tabs, Kit and Deck.
  - A `held` state, which opens the satchel.
- `gen_ux_company.py`: writes the three boards.
- `zoom.py`: QA crops (PIL NEAREST) into `t/`.
- `cache/roy_540.webp`: the full art, cropped to its alpha box and resized once with LANCZOS to 291 × 540.

## The screen, built once

Every state shares the same frame:

- **The world:** Riverside Market's square as UxTown draws it, at 1:1, under the kit's flat 62% scrim. The screen is opened from the square, as UxSatchel is, so both sit over the same dimmed square.
  - Under the art column (x 0 to the sheet's edge) the dim goes one step deeper (a further 45%, easing out under the sheet's left edge so the stage margins show no step). This keeps the 1x townsfolk beside his sword as backdrop, not a second scale.
- **The header window, top-left:**
  - where you are: "Riverside Market · day 4";
  - the screen: "The Company" in Jacquard;
  - the one way back, with its Esc key cap.
- **The full art under the header:**
  - The Foundling, 291 × 540, at 1:1, feet on the stage's foot margin;
  - never drawn on, recoloured or filtered.
- **The sheet window:**
  - his name (s20, straw) and "Lord · level 1 · mov 5";
  - the face strip on the right: Q, the three faces with the chosen one lit, E;
  - the tabs **Kit** and **Deck**, with the D key cap on Deck.

Holding gear narrows the sheet from 920 px to 516 px and opens the satchel window to its right. The hand bands keep their x and y: the right hand's well is at (366, 370) on UxPerson and on UxEquip, so the hand lights where it already stands.

**Why the square is dimmed.** Left bright, the square is drawn at mini scale, so the large painted figure over it reads as a giant standing among the stalls (the earlier test is `t/cmp_scrim.png`). Under the flat scrim he reads as a portrait over the town, the way Darkest Dungeon's character sheet sits over the dimmed Hamlet.

## The boards

### UxPerson: how is this person kitted?

- **Title:** "The Company · The Foundling's kit: Iron Sword in the left hand, the right hand empty, 9 cards"
- **Focal point:** the two hand bands.
  - **Left hand:** the Iron Sword ("one-handed sword · common"), the Put away verb, and the four cards it brings as lines (cost, name, number, second effect).
  - **Right hand:** empty, with "a sword or a shield fits here". It names the one piece in the satchel that fits that hand, the Iron Buckler, which brings 3 cards. Its verb is **Try the Iron Buckler**.
- **Below the hands:**
  - **Health and stats:** 73/73 with the bar, and the seven stats.
  - **The deck, 9 cards:** only the count, "Each turn he draws up to 5 of them" (rules `combat.handSize`) and "See the 9 cards" with its D key, the way to the deck screen (UXREFS §1.9). Where the cards come from is in the hand bands above, so it is not said twice.
- **Primary:** none, on purpose. This is a read screen; Fire Emblem's and Darkest Dungeon's sheets have no primary either. Brass marks only the chosen face and the open tab. Put away and Try the Iron Buckler are secondary, one per hand.
- **Way in:**
  - "The Company [C]" from UxTown's list;
  - the map's command window;
  - Q or E from another person;
  - the Kit tab, or D, from UxPersonDeck;
  - "Put it back" (Esc) from UxEquip.
- **Way back:** "Back to the square" (Esc). Opened from the map, it reads "Back to the road".

### UxPersonDeck: what will he draw?

- **Title:** "The Company · The Foundling's deck: 5 cards from the class and 4 from the Iron Sword, pointing at Riposte Stance"
- **Focal point:** the two rows of cards, in the game's card look: the kit's `card()` as the combat board (Hyb64Combat) draws the hand, with the cost pips and "n AP", the name, the 40 px art, the cast number and what it counts, a groove, the small print and who it lands on.
  - **From the class · Lord, 5 cards:** Rally, Inspiring Strike, Nobility, Command, Charge.
  - **Left hand · Iron Sword, 4 cards:** Slash, Thrust, Guard Break, Riposte Stance.
  - Then "Right hand · empty", counted "0 cards" like the group heads, and "9 cards. Each turn he draws up to 5 of them."
- **The numbers are the game's:** `attackPower` is the base plus STR 5, so Slash 9, Thrust 13, Guard Break 8, Inspiring Strike 9 and Charge 10.
- **The number's colour follows the card's kind**, as `CardHand.tsx` does:
  - attack: Oxblood;
  - ward: Slate, as the combat board's Barrier;
  - focus: Ochre, the game's hearth amber;
  - arcane: Bone, since the kit has no violet ramp.
- **Pointing at Riposte Stance**, the card whose face says least. It carries the kit's bracket cursor, as hovers do on the map, the town and UxEquip. Its tooltip sits beside it, in the empty space right of the card, wrapped to 206 px with the nub turned to point left, so it covers nothing. The tooltip is the rule in `combat/damage.ts` (physical damage above 0 from an orthogonally adjacent attacker), at the card's own value and duration: "For 1 turn, when a foe beside him lands a physical blow, he hits back for 3."
- **Primary:** none; it is a read screen.
- **Way in:** the Deck tab, D, or "See the 9 cards" from UxPerson.
- **Way back:** D or the Kit tab returns to his kit. "Back to the square" (Esc) leaves the screen.

### UxEquip: where does the new buckler go?

- **Title:** "The Company · holding the Iron Buckler from the satchel, pointing at The Foundling's right hand: 9 to 12 cards"
- **The same sheet as UxPerson**, narrowed to 516 px. The two hand bands are stacked at the same x and y as on the Kit tab (`screen.py#hand_bands` draws both).
- **Focal point:** the lit right hand, in place at (366, 370): dashed brass and the one bracket cursor on the screen. Beside it, "the Iron Buckler goes here" (s18, straw, one line), "brings 3 cards", and the three cards as the cost / name / number rows the Kit tab uses for the sword: Block 4 armor, Parry 3 armor · riposte 2, Deflect 2 armor.
- **The left hand is not lit.** It keeps the Iron Sword, "stays where it is". The right hand is the one place the buckler goes (UXREFS §1.11, Diablo). See the owner question below.
- **The change, then the commit:** under the bands, "The deck 9 → 12 cards" and "Lord 5 · Iron Sword 4 · **Iron Buckler +3**", with the primary straight under them.
- **The tabs are disabled** while gear is held: D does nothing until Enter or Esc settles the piece.
- **Who cannot carry it** shows on the face strip, not in a second list: Lilina's face is dimmed with the kit's small lock, and canHold's sentence sits under the strip in the kit's refusal style, "Lilina: mages do not carry shields". The person was chosen on the screen before, so the screen does not ask again.
- **The satchel window**, open only in this state, is cut to the grid and what is held:
  - the 8 × 4 bag; the buckler's square at (3, 0) is drawn lifted (a dashed bone outline, the icon at 40%) with no bracket;
  - "Holding: Iron Buckler, off-hand shield · common".
- **Primary:** **Put it in his right hand** (Enter), right-aligned, straight under the change it commits. The game's Loadout prints "Take Iron Buckler" on the hand itself. Here the one primary names the hand (UXREFS §1.11).
- **Way in:**
  - UxSatchel's "Equip on The Foundling";
  - UxPerson's "Try the Iron Buckler".
- **Way back:** "Put it back" (Esc). The buckler stays in the satchel, the satchel closes, and you return to where you came from (UxPerson or UxSatchel).
- **Q and E while holding:** you switch person and the buckler stays held.
  - Oak's two hands both show as legal swaps (the `valid` hand state in `screen.py#hand_well`).
  - Lilina's two hands are refused with "Mages do not carry shields".

## Left off the screen, and where it lives

| Left off | Where it lives instead |
|---|---|
| The satchel grid | Only in UxEquip, plus UxSatchel and UxMarket. UxPerson names the one piece that fits the empty hand, nothing more. |
| Gold | The town header, the inn and the market. |
| Food | The map and the satchel. |
| Oak's and Lilina's sheets | One key away (Q and E). |
| HP and the seven stats | The Kit tab only. Not on the Deck tab and not while equipping, where the decision does not use them. |
| A card's full rule | Its hover tooltip. One is drawn, on Riposte Stance. |
| The buckler's sale price | The market and the satchel. |
| Passives | The Foundling has none. Oak's `genatsvale` would sit on his Kit tab. |

## Where the brief and the data differ (the data wins)

- **"Riposte Stance":** the fourth Iron Sword card is called this in `cards.json`, not "Riposte".
- **The left hand could take the buckler:** `planEquip` puts no hand rule on gear, so the engine would let the left (weapon) hand take the buckler as a swap, sending the sword back into the satchel.
  - The brief, UXREFS and the kit's slot labels ("Left hand · weapon") say the right hand is the only place.
  - The board follows the brief and lights only the right hand. The owner question is below.
- **The right hand also takes a sword:** the Lord trains sword, greatsword and shield, and the greatsword is two-handed, so it always goes left. Hence "a sword or a shield fits here".
- **Max HP:** class `startingHp` × `rules.party.hpMultiplier` 2.8 gives 73, 84 and 62, which matches the brief.
- **The buckler lands at (3, 0):** `run/bag.ts#findSlot` scans row by row. That leaves 26 of 32 squares free, matching UxSatchel.
- **Card kinds** (`cardType`):
  - attack: Inspiring Strike, Charge, Slash, Thrust, Guard Break;
  - ward: Nobility, Block, Parry, Deflect;
  - focus: Rally, Command;
  - arcane: Riposte Stance (status only).

## Game changes these boards need

1. **The Loadout modal splits in two:**
   - the person screen (Kit and Deck tabs), with no satchel at rest;
   - the equip state, where the satchel opens beside the sheet while gear is held.
2. **A Deck tab:** `buildDeck` grouped by source and laid out as full cards. The Loadout today prints a text list.
3. **An empty hand gets a verb:**
   - "Try the {item}" when exactly one satchel piece fits it;
   - "Choose from the satchel" when several do.
   - Either opens the equip state, holding the piece.
4. **One equip primary:** a brass button straight under the preview that names the hand ("Put it in his right hand") replaces a "Take {name}" button on each hand.
5. **Who cannot carry it, on the face strip:** `planEquip` for every living unit while gear is held; a refused face is dimmed with the lock, and its canHold sentence shows under the strip.
6. **Keys:**
   - D toggles between Kit and Deck, and does nothing while gear is held;
   - Q and E (or Tab) switch person, and held gear stays held;
   - Enter commits;
   - Esc puts held gear back, or otherwise goes back to the square.
7. **A local card look for the deck view:** cards 150 px wide, because the kit's 108 px name line cannot hold "Inspiring Strike" at s16, and the number in its kind's colour. The kit itself is not edited.
8. **Owner question: should the left (weapon) hand refuse shields?** The board assumes yes, as the brief does. If so, `planEquip` needs a hand rule (a shield only in the right hand). If not, the left hand should light as a second legal place, quieter than the right, and the board changes back to that.

## References, and what I took from each

| Game | What I took |
|---|---|
| Fire Emblem, unit screen | A large portrait beside the name, class, level, HP and a stats column. The unit switcher kept small: Q, three faces, E. |
| Card Hunter | The link from slot to cards: each hand band lists the cards it brings. The preview of what an item adds before you commit: 9 → 12 with Block, Parry and Deflect. |
| Slay the Spire, deck view | The deck as full-size cards in a grid, opened with D. I dropped its sort header and grouped by source instead (UXREFS §1.10). |
| Battle Brothers, character screen | The stash opens beside the paper doll; here, only while equipping. |
| Diablo | While you hold an item, the one slot it goes to lights. |
| Octopath Traveler | Who can take it, by face, with the one who cannot dimmed and the reason given (here on the face strip itself). |
| Darkest Dungeon, character sheet | It opens over the dimmed Hamlet; these screens open over the dimmed square. |

## Local pieces, built over the kit (the kit is not edited)

- `game_card`: `kit.card()`, 150 px wide, with the number in its kind's colour.
- `blade40` and `cards40`: the kit's own 24 px `attack()` and `focus()` icons, drawn at the 40 px card-art size.
- `hand_well`: `equip_slot`'s well without its labels and name line, so the name can sit beside the slot at reading size. It also has a `valid` state (dashed brass without the bracket cursor) for a second legal hand, as Oak's would be.
- `face_strip`: Q, the three faces, E; a refused face dimmed with the small lock.
- `side_tip`: `kit.tooltip()` placed beside what it explains, wrapped, its nub turned to point left.

## QA

Earlier session, four rounds:

1. "Inspiring Strike" and "Riposte Stance" overran the card edge; the focus and arcane numbers were red; the tooltip hid "Left hand · Iron Sword"; the sword's card names ran into Put away; "Take from the satchel" read as a label.
2. Cards widened to 150 px; each kind's number in its own colour; the hover moved to Riposte Stance; the Kit tab rebuilt as hand bands; verbs made into buttons.
3. UXREFS applied (D for the deck, the primary names the hand, Lilina dimmed); the bright-town variant tested and rejected.
4. "right hand free" matched to UxMarket's words; dead code removed; 3× crops checked.

This session, three rounds:

1. **Read against the brief and the sibling boards.**
   - The backdrop was px-town's old strip scene, while UxTown and UxSatchel had moved to the full-screen square.
   - UxEquip lit both hands (the left as a dashed swap), so the eye had two places to land; the brief and UXREFS light the right hand only.
   - UxEquip's primary floated under the cards with 80 px of empty window below it.
   - UxPerson's deck column had no way to the deck screen except the tab.
2. **Fixed and rendered:**
   - the backdrop is now `uxscene.render('square')` under the scrim, the same as UxSatchel's;
   - the left hand is idle with "stays where it is";
   - the primary sits at the sheet's foot, right-aligned with Enter beside it, as UxSatchel and UxMarket seat theirs;
   - the change gained its breakdown, "Lord 5 · Iron Sword 4 · Iron Buckler +3";
   - "See the 9 cards" with D was added. A kit `command()` at s18 was too loud beside the hands, so it is s15 with a key cap.
3. **Checked at 3× and 4× crops:**
   - the header, the lit hand, the deck column, the cards, the satchel and the figure's edges against the square;
   - nothing under 13 px, nothing clipped or overlapping (the Riposte tooltip crosses only the groove under its section head, as a tooltip may);
   - no AI trappings;
   - every number traced to `cards.json`, `classes.json` and `items.json`;
   - held beside PxTownInn and PxCamp: the same walnut windows, Jacquard title and Source Serif reading type.

Fix pass after two critics, two rounds:

1. **Applied:**
   - UxEquip keeps UxPerson's stacked bands at the same coordinates; the right hand lights in place and lists the three cards it adds as rows; the three full cards are gone (the Deck tab is where full cards live).
   - "Who can carry it" and the rations line are gone; the refusal is on Lilina's face in the strip, with canHold's sentence under it. The satchel ends at y 340.
   - One bracket: the held square is drawn lifted, without brackets.
   - The tabs are disabled while holding.
   - The caption is one line ("the Iron Buckler goes here", s18, in the full-width band).
   - The primary sits straight under the change, not 70 px below it.
   - UxPerson's deck block is cut to its count, the draw and "See the 9 cards [D]".
   - UxPersonDeck: the tooltip says "physical blow" and sits beside the card with a left nub; the hovered card has the bracket; the empty hand reads "0 cards".
   - The art column's dim is one step deeper, easing out under the sheet so the margins show no step.
   - The faces: the blank niches were a render taken before `mock/up/face_roy.png` and `face_marcus.png` were rewritten. A fresh render shows all three.
   - UxTown already has "The Company [C]": the way-in line is updated and that game change is removed.
2. **Checked at 3× to 5× crops:** the equip sheet, the strip and its refusal line, the satchel's lifted square, the tooltip and its nub, the stage margins at the sheet's top and foot, and the townsperson beside the sword, now at about 80% dim. Nothing clips or overlaps, and no text is under 13 px.

Not taken: critic 1's "add the deck delta and use the same sentence on all three boards" for Oak. The block it applied to is deleted. UxMarket ("has one already") and UxSatchel ("his own goes in the satchel") still word Oak's verdict differently. Those boards are not mine, so their builders need to settle it.
