# Filigree kit (kit64)

The one shared kit for every Embermarch board in the chosen style: Filigree, the 64-bit tier over the Painted Country.
See it rendered on `out/boards/KitControls.dc.html` (every control in every state) and `KitPanels.dc.html` (panels, faces, gauges, the satchel, cards, icons, palette).

## Start a screen

```python
import sys
sys.path.insert(0, 'tools/pxworld/src/kit64')
from kit import *

body = world_map()                                   # or world_field(), backdrop('backdrop_thornwood'), ground(1280, 720)
body += window(EDGE, EDGE, 392, 214, T(PAD, HEAD_Y, 'The Foundling', 's16 bone'), title='The Company', note='three of us')
write('F64Town', board_html('Town', body, 1280, 720))
```

Then QA from tools/pxworld: `node preview.mjs F64Town` and Read `out/preview/F64Town.png`.
To check pixels, zoom a crop: `python src/kit64/t/zoom.py F64Town x y w h 4 name` writes `src/kit64/t/name.png`.

- Every function returns an HTML string. Concatenate them into `body`.
- Positioned pieces take `(x, y)` in the coordinates of whatever holds them: the stage, or a window's own top-left (window bodies are positioned from the window's 0,0, frame included).
- Inline pieces (`button`, `command`, `key`, `check_tag`, `price`, `plate`, `icon_inline`, `side_glyph`) flow inside text. Place them with `T(x, y, ...)`, or pass `x=, y=` where offered.
- The CSS is scoped under `.f64`. SVG ids are prefixed `f64-`. Do not add a second scope class. Put any extra CSS in `board_html(..., extra_css=...)`, scoped under `.f64`.
- `board_html(title, body, w, h)` writes the exact canvas wrapper: fonts, CSS, filter defs, `$preview`, and `height` and `min-height` set to `h`. A tall sheet passes its real height.

## Grid and spacing

- **1 art px = 1 screen px.** Use integer coordinates only. Never scale frames, icons or digits by a fraction. `scale=2` exists only for silhouettes.
- **Stage:** 1280 × 720. `EDGE = 14` is the stage margin. `GAP = 12` is the gutter between windows.
- **Inside a window:**
  - `PAD = 20` is the content inset from the outer edge. The moulding and keyline take the first 10 px.
  - First content row: `HEAD_Y = 46` under a `title=` section head, `BIG_Y = 64` under a `big=True` Jacquard title, `MODAL_Y = 90` under a modal's eyebrow and title.
- **Rows:**
  - 56 px with a 48 face, 44 px with an icon, 32 px for answers, 22 to 34 px for command and readout lines.
  - Separate rows with `groove()`. Use `rule()` (with its lozenge) at most once per window, under a header block.
- **Spacing:** steps of 2, 4, 6, 8, 12, 16 or 20 px. Keep a window's inner columns on the 20 px inset. Right-align values to `w - PAD`, as `T(w - PAD, y, s, cls, style='transform:translateX(-100%)')` does.
- **Window states:** windows never overlap, except a modal over the scrim and a tooltip.

## Type, by role

| role | class | used for |
|---|---|---|
| places, screen titles, the Round marker | `tt` (Jacquard 24 at 43 px, straw) | **never a person, a foe or an item**: at 43 px Bagrat "Oak" reads as "Dak". One per window at most; its 1:1 pixel grid is 43 px, so never another size. The one exception is the title-screen wordmark "Embermarch" at 2×, 86 px |
| a person or foe named on their own | `person(x, y, name, tone)` = `s20` bold | the talk-box speaker (straw), the one acting (straw), the target (rust for theirs, rill for ours), a named item or foe group heading a window |
| the readout a window leads with | `s20` | Day 1, a big purse |
| commands, a dialogue line | `s18` | Move, End turn, the talk line (`s18 lt`) |
| names in rows, buttons, section heads | `s16` | Obsidian Fighter 1 in the turn order, "The Company" |
| body lines | `s15` / `s15 lt` | forecasts, event text |
| notes, the log, tooltips | `s14` | |
| sub-lines, labels, reasons, key caps | `s13` | **13 px is the floor. Nothing is ever smaller.** No small caps (they draw at about 9 px) |
| headline numbers only | `num(text, x, y, size, ramp)` | damage (30 or 50), `103 → 88` (22), the round number. Two tones only. Everything else is Source Serif |

Add `lt` (400), `md` (600) or `it` (italic) to change the weight. Defaults are 600 for s13 to s15 and 700 for s16 to s20.

**Colour classes** (text colour carries status, never colour alone; pair it with shape or words):

| class | meaning |
|---|---|
| `bone` | read |
| `dim` | second |
| `faint` | off or disabled |
| `straw` | chosen or pointed at |
| `ochre` | section heads |
| `rust` | harm, foes, refusals, short purse |
| `rill` | ours |
| `meadow` | clears, on |

**On the painted world**, use `ol1d`, the inked outline with a drop: `T(x, y, 'Pine Crossing', 's14 bone ol1d')`. Inside windows, text gets a 1 px ink shadow automatically.

## API

### Board and data
- `board_html(title, body, w=1280, h=720, extra_css='')` returns the whole board file. `write(name, html)` writes `out/boards/<name>.dc.html`.
- `B(key)` returns the `/_blob/<id>` url of a BRIEF asset.
- `C[key]` is the hex of a palette key. `rgba(key, a)` returns a CSS rgba. `RAMPS` and `RAMP[name]` hold the ramps: Ink k0–1, Walnut w0–6, Ochre o0–6 (the brass), Moss m0–5, Slate s0–5, Oxblood x0–5, Bone b0–5.
- `COMPANY` is a list of dicts with `id`, `name`, `face`, `board`, `full`, `cls`, `role`, `hp`, `max`, `stats` and `gear`. HP comes from BRIEF and stats are the class base stats.
- `FOES` holds Obsidian Fighter 1 and 2, the Ember Mage and the Warlord (face only). `UNIT[id]` looks up any of them.
- `item(id)` returns the real item from `game/.../items.json`, plus `w`, `h`, `buy`, `sell` and `icon`. For example, `item('steel_sword')['buy'] == 160`.

### Text
- `T(x, y, text, cls='s14 bone', w=None, align=None, style='')` places text. Without `w` it does not wrap.
- `num(text, x, y, size=30, ramp='Oxblood')` draws cast digits. Ramps are `Oxblood`, `Ochre`, `Bone`, `Slate`, `Moss` and `Dim`.
- `label(x, y, text)` is a dim s13 caption.
- `person(x, y, name, tone='bone')` names one person or foe on their own: Source Serif 4 bold at 20 px. Use it for the speaker, the one acting and the target; tones straw (acting, speaking), rust (theirs), rill (ours).

### Windows and plates
- `window(x, y, w, h, body='', state='idle'|'hover'|'chosen', title=None, note=None, big=False, kind='win'|'card')`
  - `idle` is walnut, `hover` adds the brass moulding, and `chosen` adds the brass moulding plus the bracket cursor outside the frame.
  - `title` gives an ochre section head with a groove; add `big=True` for a Jacquard title instead (a place or a screen title only, never a person). `note` adds a dim line top-right.
  - The frame adds a 2 px hard drop, so allow 2 px right and below.
- `plate(text, state='idle'|'lit', small=False, x=None, y=None, center=False)`: the small tag for labels laid on the world. 26 px tall, or 22 px small.
- `rule(x, y, w)`: the ornament rule; `y` is the groove line. `groove(x, y, w)`: a 2 px carved line.
- `section_head(text, x=20, y=13, w=236, note=None)`: the same head `window(title=)` uses, for a second head lower in a window.
- `brackets(x, y, w, h, small=False)`: the brass cursor around any box. Make it 5 to 7 px bigger than the box on each side.

### Buttons and commands
- `button(text, variant='primary'|'secondary'|'danger', state='idle'|'hover'|'press'|'focus'|'armed'|'disabled', reason=None, w=None, x=None, y=None)`
  - Sizes: primary is 34 px tall, the others 32.
  - `disabled` requires a `reason`, which prints in rust under the button with a small lock.
  - `armed` is a held mode, such as Move: pushed in, with a brass lip.
- `command(text, sub=None, state=..., reason=None, x=None, y=None)`: a plain command line with no box. Hover and press show a brass arrow, armed shows a brass square, focus shows brackets, and disabled puts the reason in the sub-line.
- `key(text, state='idle'|'down'|'off')`: a key-cap chip, inline.
- `tabs(x, y, items, selected=0, hover=None, focus=None, disabled=(), w=None)`: the strip is 36 px tall with a carved baseline. The selected tab rises 4 px and gets the brass lip.

### Rows and scroll
- `row(x, y, w, name, sub=None, face_key=None, icon_name=None, value=None, state='idle'|'hover'|'selected'|'disabled', reason=None, h=None)`
  - `value` is any HTML, right-aligned (for example `price(80)` or `'73/73'`).
  - `hover` adds a band and a brass arrow just left of the row, so leave 14 px clear. `selected` gives a brass ring and a straw name. `disabled` puts the reason in place of the sub-line.
- `scrollbar(x, y, h, pos=0..1, frac=visible share)`: 12 px wide. Put it 10 px right of the list.

### Faces and sprites
- `face(key, x, y, size=32|48|96, lit=False, flip=False, bg=None)`
  - Faces sit at 1x in a brass niche. 32 and 48 are crops; 96 is the whole face, in a niche 104 px outside.
  - Flip foes so they face left. `lit` gives the brass lip to the one acting or chosen.
  - Keys: `face_roy`, `face_marcus`, `face_lilina`, `face_bandit`, `face_ember_mage`, `face_warlord`.
- `sprite_well(board_key, x, y, flip=False)`: the 104 × 152 board sprite at 1x in a well, 120 × 176 overall.
- `cutin(full_key, x, y, w=240, h=330, scale=0.36, dx=0, dy=0, flip=False, kind='plate'|'lit')`: the full art, scaled and cropped in a niche, with a 1 px ink edge.

### Gauges
- `hp_bar(x, y, w, hp, mx, side='ally'|'foe', lose=0, gain=0, h=7)`
  - `lose` is the bone damage-preview ghost; `gain` is a dithered heal preview. Use `h=11` for a forecast bar and `h=5` under a unit on the board.
- `food_pips(x, y, rations=(4, 4), used=(0, 0))`: one pip per charge, one group per ration.
- `ap_gems(x, y, total=3, spend=0, spent=0)`: 28 px pitch. `spend` rings the gems the aimed card will cost.
- `meter(x, y, on, n=10, ramp='x'|'o'|'m')`: for example, the encounter odds, 4 in 10.

### Items
- `bag(x, y, entries=[(item_id, col, row, count)], cols=8, rows=4, cell=44, selected=(c, r), equipped=[...], refused=[...])`: 352 × 176 at the default cell.
- `bag_cell(x, y, item_id=None, state='empty'|'filled'|'selected'|'equipped'|'refused', count=None, cell=44)`
  - Items span their real grid size: rations and swords are 1 × 2, and the potion, buckler and tome are 1 × 1.
  - Items 2 wide print their name. Rarity tints the inner keyline.
- `equip_slot(x, y, hand='left'|'right', item_id=None, state='idle'|'target'|'locked'|'refused', reason=None)`: 64 × 108 slots, labelled "Left hand · weapon" and "Right hand · off-hand".
  - **The game has two hand slots only**: left for the weapon, right for the off-hand. A two-handed item locks the right hand.
  - There is no armor or trinket slot in `game/`. Do not draw one; the `armor` and `trinket` icons exist only because they were asked for.

### Small widgets
- `tooltip(x, y, text, reason=False, w=None)`: the nub points down from its centre, so place the tooltip about 46 px above its anchor. `reason=True` gives the oxblood lip and lock for a refusal.
- `toast(x, y, reason, head=None)`: the refusal toast. `head` says what you can't do, in rust; `reason` is the engine's sentence. Seat it at the foot of the stage, or above the card hand in combat.
- `switch(x, y, w, label, on, state='idle'|'hover'|'focus'|'disabled', reason=None)`: the knob's side and the word both say the state.
- `check_tag(text, ok=True|False|None, word=False)`: inline.
  - `text` is the game's own format: `'STR 6 · Oak 6'`, `'needs a Bandit Archer'`, or `'15 gold · 80 held'`.
  - `ok=None` marks a cost, not a test. **The game has no odds.** A check is a threshold against the best unit, so never print a percentage.
- `price(amount, short=False, note=None)`: inline, with a 16 px coin. `short=True` gives rust and "beyond the purse".

### Dialogue and input
- `choice(x, y, w, n, text, state='idle'|'hover'|'chosen'|'locked', tag=None, ok=None, req=None)`: 32 px tall. `locked` takes `req`, for example `'needs 15 gold'`.
- `dialogue(x, y, w, h, face_key, speaker, line, choices=[dict(text, state, tag, ok, req)], cue=None)`
  - The whole face sits in a lit niche, the name is `person()` (Source Serif 4 bold 20, straw) and the line is s18.
  - With no choices it shows a Continue cue with an Enter key.
- `text_input(x, y, w, value='', placeholder='a name', state='idle'|'focus'|'error', reason=None, maxlen=None)`: 40 px tall, with a pixel caret when focused. The reason prints 6 px under it.

### Overlays and empty states
- `scrim(w, h, x, y)`: one flat ink tone at 62%. Never blur, vignette or gradient it.
- `modal(x, y, w, h, body, title=None, eyebrow=None, scrim_box=(0, 0, 1280, 720))` lays the scrim, then a big window. Start the body at `MODAL_Y`.
- `empty_state(x, y, w, icon_name, line, hint, action=None)`: a dim 48 px silhouette, the line in the game's voice (s16 italic), a brass arrow and a hint naming what fills it. Pass a `button(...)` as `action` if one exists.

### Icons
- `icon(name, x, y)`, `icon_inline(name, style)` and `silhouette(name, x, y, scale)`. `ICON_GROUPS` lists all 54:

| group | names |
|---|---|
| resources | gold food potion elixir day night ap |
| card kinds | attack ward arcane focus heal flame burst |
| commands | move capture end_turn danger watch rest scout map contract sound sound_off save quit settings company |
| item kinds | sword greatsword dagger lance axe bow crossbow tome staff shield quiver armor trinket |
| marks and places | lock check cross fight elite boss treasure town camp dungeon battle waypoint |

- For a real item, use `item(id)['icon']`. Card kinds in the game are attack, ward, arcane and focus, matching `CardHand.tsx`.

### Combat pieces
- `card(x, y, name, cost, kind, mag, mag_word, line1, line2, art, state='idle'|'hover'|'chosen'|'disabled', reason=None)`
  - Cards are 136 × 172. `chosen` rises 20 px and gets brackets.
  - `art` is `'flame'`, `'fire'`, `'burst'`, `'ward'` or `'arcane'` (40 px art), or any icon name.
- `base_ring(tile_x, tile_y, side, act=False)` returns `(back, front)`. Draw `back`, then the 52 × 76 figure with `filter:url(#f64-ol1)` and its feet at tile y + 39, then `front`.
- `ordinal(n, x, y)` draws the 1 and 2 plaques. Also available: `arrow_down(x, y)` over the one acting, `side_glyph(side, act)`, `hand_cursor(x, y)` and `pin(x, y)`.

### The painted world
- `world_map(crop=None)`: the Borderlands at 1280 × 720.
- `world_field(crop=None)`: the combat field with its 14 × 10 board of 48 px tiles, origin (303, 18).
- `world_inset(x, y, w, h, 'map'|'field', at=(wx, wy))`: a framed 1:1 crop.
- `ground(w, h)`: a plain sunlit meadow of any size.
- `backdrop('backdrop_borderlands'|'backdrop_thornwood'|'backdrop_ashfall', x, y, w, h)`.
- Each world is written into a board once, as a `<symbol>`. Every later crop is a `<use>`, so crops are cheap.

## Placing a modal over a world render

```python
body = world_map()                                   # the screen the modal interrupts, drawn as it was
body += modal(360, 150, 560, 330, T(PAD, MODAL_Y, '...', 's16 lt bone', w=520) + choice(PAD + 4, MODAL_Y + 76, 516, 1, '...'),
              title='A caravan blocks the road', eyebrow='On the road')
```

1. Draw the world, plus any HUD windows that stay under the dim.
2. Call `modal()`. It covers `scrim_box` (the whole stage by default) and then draws the window.
3. Centre the window. Keep at least 64 px of world visible above and below it.
4. Put at most one primary inside the modal. If the event's answers are `choice()` rows, they are the acts, so add no primary.
5. Esc closes the modal unless the beat must be answered.
6. To demo a modal inside a smaller world crop, as on a sheet, use `world_inset()` and set `scrim_box` to the inset's box.

## Rules that keep screens consistent

0. **The board's state lives in its `<title>`**, as "Screen · the state" (for example "Town · the shop, Food Rations picked, day 2"); it becomes the canvas label. Never print a state caption inside the 1280 × 720 screen.
1. **One primary per screen.** The brass button is the one act the screen exists for, such as Resume, Set or Break camp. Everything else is secondary, a command line or a plate. Danger is only for what cannot be undone, such as Sell.
2. **Brass marks only what you point at or have chosen:**
   - hover, focus and chosen windows
   - the bracket cursor
   - the acting unit's ring, arrow and niche lip
   - the selected tab, row or card
   - straw text
   Section heads use ochre text, not brass frames. Nothing else gets a brass edge.
3. **Disabled always says why.** Every disabled button, command, row, choice and switch carries the engine's sentence, in rust under or beside it. Use the game's own reason strings where they exist, such as `NO_RATIONS` and `NAME_EMPTY` in `game/src/engine/run/*.ts`, and avoid em dashes.
4. **Status is never colour alone.** Pair the colour with a shape (square ours, diamond theirs, tick, cross, lock) or a word (on/off, within reach/falls short, beyond the purse).
5. **One type system:**
   - Jacquard at 43 px for places, screen titles and the Round marker only, one per window. People, foes and items are never set in it; name them with `person()` (Source Serif 4 bold 20). The title wordmark at 86 px is the one exception.
   - Source Serif 4 at 13 to 20 px for everything read.
   - Cast digits only for headline numbers.
6. **Pixels at 1:1.** Use integer positions. Never use a fractional `transform: scale`, a rounded corner, a gradient, blur, glow, translucent glass, a heavy shadow or a pill. The only shadow is the frame's own 2 px hard drop.
7. **Windows are the only boxes.** Never nest a window in a window. Inside one, separate with `groove()`, `rule()`, spacing and type. Use `plate()` for labels on the world and wells (`world_inset`, `sprite_well`) for pictures.
8. **Everything is daylight and painted.** The world is C's painted country. Do not draw paper sheets, parchment, candlelight, a near-black void or amber glow.
9. **One name for each thing, the game's.** Oak's class is "Shield Knight" (`classes.json`), the roster is "The Company" (the company's name) on every heading, button, tab and command, and the combat log is "Blow by blow" (`ui/combat/Hud.tsx`). A DISCOVERY node is "a landmark" (`run/overworld.ts#typeLabel`), never "a fight".
10. **Use real data.** Take names, prices and stats from `COMPANY`, `FOES` and `item()`. Day 1 is 80 gold, 8 food (2 rations × 4) and 1 Healing Potion. The tariff is Healing Potion 30, Iron Buckler 60, Iron Sword 80, Iron Lance 80 and Steel Sword 160, which is beyond the purse at 80.
11. **QA every board.** Render it, Read the PNG, zoom into crops, and check that no text is under 13 px, nothing is clipped or overlapping, and the AI-trappings list is clean.

## Known gaps
- **Locked choices:** no dialogue in `game/` content is truly gated; hidden choices simply disappear. The `locked` state is drawn for when one is.
- **Missing icons:** there is no settings, save or quit art in the game yet, so the icons are the kit's own proposal.
- **Unused icons:** `armor` and `trinket` icons exist, but the game has no slots for them.
- **Text measurement:** `text_w()` uses PIL metrics, so the browser can differ by a few px. Leave slack, or give `w=` and let the text centre.
