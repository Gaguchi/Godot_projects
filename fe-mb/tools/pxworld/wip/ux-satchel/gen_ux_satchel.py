"""UxSatchel: the company's stores. One job: what do we carry?

The state is Riverside Market, day 4, after the inn and the market (dirs/UXFLOW.md, "the moment"):
  - the satchel holds Food Rations x1 and x4 (5 food: "5 hops of rations"), the Healing Potion and the new Iron
    Buckler. findSlot (engine/run/bag.ts) is first-fit, row-major, so the buckler bought into this satchel lands at
    column 3 of the top row, beside the potion;
  - the player points at the buckler: its card says what it is, the three cards it brings (cards.json) and who can
    carry it, by face (equipment.ts canHold: a Lord and a Shield Knight take shields; "Mages do not carry shields").
    No gold on this screen (UXFLOW principle 3, UXREFS 1.12): no purse, no sell value.
  - One brass primary, "Give it to someone…" (UXREFS 1.12), opens UxEquip holding the buckler on The Foundling, the
    first who can carry it; Q and E switch people there, so the person is chosen once, on UxEquip.

Composition: the screen is a layer over the place it was opened in: Riverside Market's square exactly as UxTown
draws it (dirs/ux-town/uxscene.py, imported read-only, the same camera, the company standing in the square), under the
kit's flat scrim. One window holds the satchel on the left and the pointed item's card on the right, split by a
carved vertical groove. The satchel is the kit's bag() build at an 84 px cell: the same gutterless wells and lit
'selected' tile as UxEquip and UxMarket. The icons are an exact 2x (48 px), so the items read at this size, and the
stores line's sack is 2x too; the pointed square carries the map's full-size brass bracket.

Usage (from the scratchpad root):  python dirs/ux-satchel/gen_ux_satchel.py && node preview.mjs UxSatchel
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
sys.path.insert(0, SP + '/dirs/kit64')
sys.path.insert(0, SP + '/dirs/ux-town')     # UxTown's full-screen square (read-only import; nothing there is edited)
from kit import *  # noqa: E402,F403
import kit as K  # noqa: E402  (the kit's cell well and item tile, reused for the large satchel)
import kit_icons as _I  # noqa: E402  (icon rasters for the local pieces; the kit itself is not edited)
import uxscene as SQUARE  # noqa: E402

# ------------------------------------------------------------------ the state (UXFLOW.md, checked against game/ data)
DAY = 4
BAG = [('food_rations', 0, 0, 1), ('food_rations', 1, 0, 4), ('healing_potion', 2, 0, None), ('iron_buckler', 3, 0, None)]
PICK = (3, 0)                     # the Iron Buckler, pointed at
FOOD = 5                          # foodCount: 1 + 4 charges
FREE = 32 - sum(item(i)['w'] * item(i)['h'] for i, *_ in BAG)

BUCKLER = item('iron_buckler')
CARDS = (('Block', 1, '4 armor'), ('Parry', 1, '3 armor · riposte 2'), ('Deflect', 0, '2 armor'))   # cards.json, words.ts

# ------------------------------------------------------------------ the frame (window px; the window is centred)
CELL = 84                         # the satchel, large: the kit's bag() at an 84 px cell (its default is 44)
GW, GH = 8 * CELL, 4 * CELL
LX = PAD                          # the satchel column
GY = MODAL_Y + 34                 # the grid, under its section head
SPLIT = 48                        # the gutter between the columns, with the groove at its middle
RX = LX + GW + SPLIT              # the item card column
RW = 404
MW = RX + RW + PAD
BY = GY + GH + 26      # the foot line: the food line under the grid, the primary level with it on the right
MH = BY + 32 + PAD
MX, MY = (STAGE_W - MW) // 2, (STAGE_H - MH) // 2


def rtext(x, y, text, cls='s13 dim'):
    """Right-aligned text ending at x."""
    return T(x, y, text, cls, style='transform:translateX(-100%)')


def vgroove(x, y, h):
    """A vertical carved groove: 1 px dark, 1 px light (the kit's groove() is horizontal only)."""
    R = Raster(2, h)
    for j in range(h):
        R.set(0, j, 'k0')
        R.set(1, j, 'w3')
    return R.svg(x, y)


# ------------------------------------------------------------------ the satchel column
def big_bag(x, y):
    """The satchel as the kit's bag() draws it (wells from bag(), each packed item as bag_cell() lays it out: the walnut
    tile, 'selected' lighting the pointed one with the kit's small bracket, the stack count bottom-right), with one
    change: each icon at an exact 2x (48 px) instead of 1x, which the kit's bag_cell() cannot do."""
    out = bag(x, y, (), cell=CELL)                                   # the 32 recessed wells, gutterless
    for iid, c, r, n in BAG:
        it = item(iid)
        x0, y0 = x + c * CELL, y + r * CELL
        w, h = it['w'] * CELL, it['h'] * CELL
        st = 'selected' if (c, r) == PICK else 'filled'
        out += K._item_tile(x0 + 1, y0 + 1, w - 2, h - 2, it['rarity'], st)
        out += _I.get(it['icon']).svg(x0 + (w - 48) // 2, y0 + (h - 48) // 2, scale=2)
        if n is not None:
            out += f'<div class="abs s13 bone ol1 nowrap" style="left:{x0}px;top:{y0 + h - 19}px;width:{w - 6}px;text-align:right">×{n}</div>'
        if st == 'selected':
            out += brackets(x0 - 6, y0 - 6, w + 12, h + 12)          # the map's full-size bracket
    return out


def satchel():
    out = section_head('What we carry', x=LX, y=MODAL_Y, w=GW, note=f'{FREE} squares free')
    out += big_bag(LX, GY)
    y = GY + GH + 12
    out += groove(LX, y, GW)
    y = BY - 8                                   # the 2x sack, clear of the window's lower edge
    # the larder exactly as UxMarket draws it (Town.tsx#Larder words + the kit's pips: the first ration has 1 of 4 left),
    # with the sack at 2x like the satchel's own icons. No purse: gold lives where it is spent (UXFLOW principle 3).
    food = f'{FOOD} hops of rations'
    out += icon('food', LX, y, scale=2)
    out += T(LX + 60, y + 4, food, 's16 bone')
    out += food_pips(LX + 60 + text_w(food, 16, 700) + 12, y + 9, (4, 4), (3, 0))
    out += T(LX + 60, y + 25, 'enough for the road ahead', 's13 it dim')
    return out


# ------------------------------------------------------------------ the item card column
def who(x, y, u, verdict, can=True):
    """One line under 'Who can carry it', by face (Octopath's shop faces): a 32 face, the name, the verdict.
    Information only: no key, no lit choice. The person is chosen once, on UxEquip (Q / E)."""
    f = face(u['face'], x, y, 32)
    if not can:
        f = f'<div class="abs" style="left:0;top:0;opacity:.45">{f}</div>'
    nm = u['name']
    out = f + T(x + 44, y + 6, nm, 's15 ' + ('bone' if can else 'faint'))
    out += T(x + 44 + text_w(nm, 15, 700) + 10, y + 8, verdict, 's13')
    return out


def card_column():
    x, w = RX, RW
    out = person(x, MODAL_Y - 1, BUCKLER['name'], 'straw')
    out += T(x, MODAL_Y + 30, 'off-hand shield · common · takes one square', 's14 dim')

    y = MODAL_Y + 58
    out += section_head('The cards it brings', x=x, y=y, w=w)
    y += 34
    for name, cost, what in CARDS:
        out += T(x, y + 2, f'{cost} AP', 's13 dim') + T(x + 44, y, name, 's15 bone') + rtext(x + w, y + 1, what, 's14 bone')
        y += 24

    y += 10
    out += section_head('Who can carry it', x=x, y=y, w=w, note='it goes in the right hand')
    y += 34
    mc, oak, lil = COMPANY
    ok = _I.check_mark('m4').inline('margin:-2px 0 0 5px')
    # the sibling boards' words: UxMarket "right hand free" / "has one already"; the engine's refusal for Lilina
    out += who(x, y, mc, f'<span class="meadow">right hand free{ok}</span>')
    out += who(x, y + 40, oak, '<span class="dim">has one already</span>')
    out += who(x, y + 80, lil, '<span class="why">Mages do not carry shields</span>', can=False)

    label_ = 'Give it to someone…'
    bw = text_w(label_, 17, 700) + 42
    out += T(x, BY - 26, 'Opens on The Foundling. Q and E switch to Oak there.', 's13 dim')
    out += button(label_, 'primary', x=x + w - bw, y=BY, w=bw)
    out += rtext(x + w - bw - 12, BY + 9, key('Enter'), 's14')
    return out


# ------------------------------------------------------------------ the board
def build():
    cv, _info = SQUARE.render('square')          # the square UxTown draws, at UxTown's camera (x 0..1280)
    cv = cv.crop(0, 0, 1280, 720)
    cv.save(os.path.join(HERE, 'z', 'world_town.png'))
    body = (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
            f'width="1280" height="720" src="{cv.data_uri()}">')
    # the one way back on the where-you-are line, label then cap, as UxMarket, UxInn and UxTavern
    inner = rtext(LX + GW, 11, f'Back to the square<span style="margin-left:8px">{key("Esc")}</span>', 's16 bone')
    inner += satchel()
    inner += vgroove(LX + GW + SPLIT // 2 - 1, MODAL_Y, MH - MODAL_Y - PAD)
    inner += card_column()
    body += modal(MX, MY, MW, MH, inner, title='The satchel', eyebrow=f'Riverside Market · day {DAY}')
    title = 'Satchel · the company’s stores after the market, pointing at the new Iron Buckler, day 4'
    # the refusal's lock at an exact 2x (16 px) so it reads beside the red line (this board only; the kit is not edited)
    css = (f' .{SCOPE} .why::before{{width:16px;height:16px;background-size:16px 16px;image-rendering:pixelated;'
           f'vertical-align:-4px;margin-right:6px}}')
    return write('UxSatchel', board_html(title, body, 1280, 720, extra_css=css))


if __name__ == '__main__':
    print(build())
