"""UxMarket: the trade screen. One job: what do we buy, and what do we sell?

The state is Riverside Market, day 4, after the inn (dirs/UXFLOW.md, "the moment"), checked against the real engine
by probe_market.mts (seed 36, the run PxTownInn and PxCamp trace to):
  - the purse holds 149 gold (173 less 24 at the inn);
  - the satchel holds Food Rations x1 at (0,0), Food Rations x4 at (1,0) and the Healing Potion at (2,0);
  - the counter holds that day's shopStock: 27 goods (the brief's 26 were day 2 of another run; on day 4 the two
    rotating picks are the Ice Quiver and the Obsidian Axe, and the Molten Crossbow is gone), cheapest first;
  - the player points at the Iron Buckler: 60 gold, an off-hand shield, one square, common, three cards
    (Block, Parry, Deflect). canHold: The Foundling (Lord) yes, his right hand is empty, deck 9 -> 12;
    Oak (Shield Knight) yes, but he carries one already; Lilina: "Mages do not carry shields".
    findSlot puts it at (3,0), beside the potion. Buying leaves 89 gold.
  - what the merchant pays for ours is entrySellPrice: 5 for the ration with one hop left, 20 for the full one,
    15 for the potion.

Composition: the merchant's goods on the left, ours on the right, the card for what is pointed at between them, so
goods read from his side, through the deal, into ours. The top-left window says where we are and the way back.
Behind it all, Riverside's street (market_scene.py) with the market over the card and the merchant at his counter,
under the kit's flat scrim.

Usage (from the scratchpad root):  python dirs/ux-market/gen_ux_market.py && node preview.mjs UxMarket
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
sys.path.insert(0, SP + '/dirs/kit64')
sys.path.insert(0, SP + '/dirs/px-town')
sys.path.insert(0, HERE)
from kit import *  # noqa: E402,F403
import kit_icons as _I  # noqa: E402  (icon rasters for the local pieces; the kit itself is not edited)
import gen_px_town as PXT  # noqa: E402  (footprint, purse_rule, forecast_line: imported as they are)
import market_scene as MS  # noqa: E402

# ------------------------------------------------------------------ the state (probe_market.mts, seed 36, day 4)
GOLD = 149
BAG = [('food_rations', 0, 0, 1), ('food_rations', 1, 0, 4), ('healing_potion', 2, 0, None)]
FOOD = 5
RATIONS_USED = (3, 0)                                       # food_pips, as UxSatchel: the first ration has 1 of 4 left
SELLS = [('food_rations', 1, 5), ('food_rations', 4, 20), ('healing_potion', None, 15)]     # entrySellPrice
STOCK = ['healing_potion', 'food_rations', 'iron_buckler', 'iron_axe', 'power_elixir', 'iron_sword', 'iron_lance',
         'iron_bow', 'iron_crossbow', 'fire_tome', 'heal_staff', 'iron_tower_shield', 'longbow', 'steel_buckler',
         'iron_greatsword', 'ice_quiver', 'steel_sword', 'steel_axe', 'steel_lance', 'steel_bow', 'obsidian_axe',
         'steel_tower_shield', 'steel_crossbow', 'thunder_tome', 'mend_staff', 'steel_greatsword', 'composite_bow']
TARIFF = sorted(STOCK, key=lambda i: item(i)['buy'])        # already in price order; ties keep shopStock order
assert TARIFF == STOCK and len(TARIFF) == 27
PICK = 'iron_buckler'
LANDS = (3, 0)                                              # findSlot, row-major first fit
CARDS = (('Block', 1, '4 armor'), ('Parry', 1, '3 armor · riposte 2'), ('Deflect', 0, '2 armor'))
DECK_OAK = 10                                               # buildDeck: lance + buckler; a second buckler swaps like for like
DECK, DECK_WITH = 9, 12                                     # buildDeck: 5 Lord + 4 Iron Sword, + 3 Iron Buckler
BUCKLER = item(PICK)
assert BUCKLER['buy'] == 60 and BUCKLER['sell'] == 30 and (BUCKLER['w'], BUCKLER['h']) == (1, 1)

# ------------------------------------------------------------------ the frame (stage px)
HX, HY, HW, HH = EDGE, EDGE, 404, 92                        # where we are (place, then room), and the way back
CX, CY, CW = EDGE, HY + HH + GAP, HW                        # the merchant's counter, under it
CH = STAGE_H - EDGE - CY
LOW = 228                                                   # the card and the satchel; the street shows above them
DX, DW = CX + CW + GAP, 432                                 # the card, between his goods and ours
SX = DX + DW + GAP                                          # our satchel
SW = STAGE_W - EDGE - SX
LH = STAGE_H - EDGE - LOW
ROW_H = 24
LIST_X, LIST_W = 24, 336                                    # the counter's rows (the hover arrow needs 12 px left)
SHOWN = 20                                                  # whole rows that fit the counter; the rest scroll
# the foot band shared by the card and the satchel (window px): a groove, the resource line, the primary's row.
# The primary sits 20 px clear of the inner keyline (PAD + 10 above the window's foot), like UxInn's.
BTN_Y = LH - PAD - 44
LINE_Y = BTN_Y - 29
FOOT_GROOVE = LINE_Y - 10
PRICE_R = 266                                               # the counter's price column ends here (row px)
NUM3 = text_w('250', 16, 700)                               # the widest price: the coin sits left of a 3-digit slot
SELL_ROW_H = 28


def rtext(x, y, text, cls='s13 dim'):
    """Right-aligned text ending at x."""
    return T(x, y, text, cls, style='transform:translateX(-100%)')


def coin_num(right, y, amount, slot, cls='straw', dim=False):
    """A price on a fixed coin column: the 16 px coin at right - slot - 20, the number right-aligned to `right`, so the
    coins stand in one line whatever the digit count."""
    coin = _I.coin16(dim=dim).svg(right - slot - 20, y + 2)
    return coin + rtext(right, y, str(amount), f's16 {cls}')


# ------------------------------------------------------------------ local pieces
def tariff_row(x, y, w, item_id, purse, state='idle'):
    """One line of the counter (gen_px_town.tariff_row, re-spaced for this column): the kind icon, the name, the
    price with its coin on a fixed column; beyond the purse the line stays, dimmed, with the shortfall as its reason.
    No footprint: at 1x it read as noise, and the card's 'fits the satchel' and the landing square carry it."""
    it = item(item_id)
    short = it['buy'] > purse
    cls = 'row' + {'idle': '', 'selected': ' sel'}[state]
    nc = 'straw' if state == 'selected' else ('faint' if short else 'bone')
    ic = _I.silhouette(it['icon'], ('w3', 'w4')) if short else _I.get(it['icon'])
    inner = ic.svg(5, 0)
    inner += T(36, 2, it['name'], f's16 {nc}')
    pc = 'faint' if short else 'straw'
    inner += coin_num(PRICE_R, 2, it['buy'], NUM3, pc, dim=short)
    if short:
        inner += f'<div class="abs s13 rust nowrap" style="left:276px;top:4px">{it["buy"] - purse} short</div>'
    cur = _I.arrow_e(9).svg(-12, (ROW_H - 9) // 2) if state == 'selected' else ''
    return f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{ROW_H}px">{inner}{cur}</div>'


def ghost_cell(x, y, item_id, cell=44):
    """Where the pointed item would land (findSlot's answer): a dotted brass outline round its squares with its
    silhouette inside (gen_px_town.ghost_cell without the bracket cursor: the pointer is on the counter, not here)."""
    it = item(item_id)
    w, h = it['w'] * cell, it['h'] * cell
    R = Raster(w, h)
    for i in range(w):
        for j in range(h):
            if (i in (1, w - 2) or j in (1, h - 2)) and 1 <= i <= w - 2 and 1 <= j <= h - 2 and (i + j) % 4 < 2:
                R.set(i, j, 'o4')
    out = R.svg(x, y)
    out += _I.silhouette(it['icon'], ('w3', 'w5')).svg(x + (w - 24) // 2, y + (h - 24) // 2)
    return out


def mark(ok):
    """The tick or cross that carries a verdict alongside its colour."""
    return (_I.check_mark('m4') if ok else _I.cross_mark('x4')).inline('margin:-2px 0 0 5px')


# ------------------------------------------------------------------ the windows
def header():
    """Where we are, as UxInn and UxSatchel say it: the place and the day over the room's title; the one way back."""
    b = T(PAD, 14, 'Riverside Market · day 4', 's13 dim')
    b += rtext(HW - PAD, 11, f'Back to the square<span style="margin-left:8px">{key("Esc")}</span>', 's16 bone')   # label, then cap: UxInn, UxTavern
    b += T(PAD, 32, 'The market', 'tt')
    return window(HX, HY, HW, HH, b)


def counter():
    """The merchant's counter: the day's goods, cheapest first; the purse line where the money runs out."""
    b = section_head('On the counter', y=13, w=CW - 2 * PAD, note=f'{len(TARIFF)} goods, cheapest first')
    y = HEAD_Y
    shown = 0
    for i, iid in enumerate(TARIFF):
        if shown == SHOWN:
            break
        if item(iid)['buy'] > GOLD and (i == 0 or item(TARIFF[i - 1])['buy'] <= GOLD):
            b += PXT.purse_rule(LIST_X - 8, y, LIST_W + 8, GOLD)
            y += PXT.RULE_H
        b += tariff_row(LIST_X, y, LIST_W, iid, GOLD, 'selected' if iid == PICK else 'idle')
        y += ROW_H
        shown += 1
    b += scrollbar(LIST_X + LIST_W + 10, HEAD_Y, y - HEAD_Y, pos=0.0, frac=SHOWN / len(TARIFF))
    more = len(TARIFF) - SHOWN
    b += rtext(LIST_X + LIST_W, y + 8, f'{more} more further back', 's13 dim')
    return window(CX, CY, CW, CH, b)


def card():
    """The card for what is pointed at: what it is, what it brings, who can carry it, and the deal."""
    w = DW
    b = icon(BUCKLER['icon'], PAD, 21) + person(PAD + 32, 20, BUCKLER['name'], 'straw')
    b += rtext(w - PAD, 23, price(BUCKLER['buy']), 's16')
    b += T(PAD, 51, 'off-hand shield · common', 's14 dim')
    b += rtext(w - PAD, 52, f'fits the satchel{mark(True)}', 's13 meadow')

    y = 78
    b += section_head('The cards it brings', y=y, w=w - 2 * PAD, note=f'{len(CARDS)} cards')
    y += 31
    for name, cost, what in CARDS:
        b += T(PAD, y + 2, f'{cost} AP', 's13 dim') + T(PAD + 44, y, name, 's15 bone') + rtext(w - PAD, y + 1, what, 's14 bone')
        y += 21

    y += 6
    b += section_head('Who can carry it', y=y, w=w - 2 * PAD, note='it goes in the right hand')
    y += 30
    mc, oak, lil = COMPANY
    rw = w - 2 * PAD + 10                                   # the row's value sits 10 px in: this lands it on w - PAD
    gain = f'{DECK} → <span class="meadow">{DECK_WITH}</span> cards'
    b += row(PAD, y, rw, mc['name'], sub=f'Lord · <span class="meadow">right hand free{mark(True)}</span>',
             face_key=mc['face'], value=gain, h=52)
    b += row(PAD, y + 52, rw, oak['name'], sub='Shield Knight · has one already', face_key=oak['face'], h=52,
             value=f'{DECK_OAK} → {DECK_OAK} cards')
    b += row(PAD, y + 104, rw, lil['name'], face_key=lil['face'], state='disabled', reason='Mages do not carry shields', h=52,
             value='<span class="s13 dim">a tome or a staff</span>')
    assert y + 156 < FOOT_GROOVE, (y + 156, FOOT_GROOVE)

    b += groove(PAD, FOOT_GROOVE, w - 2 * PAD)
    b += PXT.forecast_line(LINE_Y, 'Purse', GOLD, GOLD - BUCKLER['buy'], 'gold left')
    label_ = f'Buy · {BUCKLER["buy"]} gold'
    bw = text_w(label_, 17, 700) + 40
    b += button(label_, 'primary', x=w - PAD - bw, y=BTN_Y, w=bw)
    b += rtext(w - PAD - bw - 10, BTN_Y + 8, key('Enter'), 's14')
    return window(DX, LOW, DW, LH, b)


def satchel():
    """Ours: the satchel grid with where the pointed item would land, what the merchant pays for ours and how to sell,
    and at the foot the larder, level with the card's purse line."""
    w = SW
    free = 32 - sum(item(i)['w'] * item(i)['h'] for i, *_ in BAG)
    b = section_head('Our satchel', y=13, w=w - 2 * PAD, note=f'{free} squares free')
    b += bag(PAD, HEAD_Y, BAG)
    b += ghost_cell(PAD + LANDS[0] * 44, HEAD_Y + LANDS[1] * 44, PICK)
    y = HEAD_Y + 176 + 12
    b += groove(PAD, y, w - 2 * PAD)
    y += 10
    b += section_head('What he pays for ours', y=y, w=w - 2 * PAD, note='half his price')
    y += 31
    # the same row anatomy as the counter (icon, name, coin column): these are sell targets, as the grid cells are
    rx, rw = PAD - 6, w - 2 * PAD + 12
    slot2 = text_w('20', 16, 700)
    for iid, n, pays in SELLS:
        it = item(iid)
        nm = it['name'] + (f' ×{n}' if n is not None else '')
        if n is not None and n < it.get('charges', 1):          # entrySellPrice: worth what is left in it
            nm += f'<span class="s13 dim" style="margin-left:8px">{"one hop" if n == 1 else f"{n} hops"} left</span>'
        inner = _I.get(it['icon']).svg(6, (SELL_ROW_H - 24) // 2) + T(38, (SELL_ROW_H - 20) // 2, nm, 's15 bone')
        inner += coin_num(rw - 6, (SELL_ROW_H - 20) // 2, pays, slot2, 'straw')
        b += f'<div class="row" style="left:{rx}px;top:{y}px;width:{rw}px;height:{SELL_ROW_H}px">{inner}</div>'
        y += SELL_ROW_H
    b += T(PAD, y + 6, 'Point at one of ours, here or in the satchel, to sell it.', 's13 dim')
    assert y + 26 < BTN_Y - 10, (y + 26, BTN_Y - 10)
    # the larder, as UxSatchel says it (Town.tsx#Larder words + the kit's pips), on the card's primary row
    b += groove(PAD, BTN_Y - 10, w - 2 * PAD)
    food = f'{FOOD} hops of rations'
    ly = BTN_Y + 2
    b += icon('food', PAD, ly + 2) + T(PAD + 32, ly, food, 's16 bone')
    b += food_pips(PAD + 32 + text_w(food, 16, 700) + 12, ly + 5, (4, 4), RATIONS_USED)
    b += T(PAD + 32, ly + 21, 'enough for the road ahead', 's13 it dim')
    return window(SX, LOW, SW, LH, b)


def build():
    cv, info = MS.render()
    cv.save(os.path.join(HERE, 'z', 'world.png'))
    body = (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
            f'width="1280" height="720" src="{cv.data_uri()}">')
    # the kit's 62% scrim under the windows and over the counter column; the street above the card and the satchel only
    # at 25%, so the market, its awning and its merchant read the way UxInn's square does (the edges fall in gutters)
    xm = CX + CW + GAP // 2
    body += scrim(w=xm, h=STAGE_H)
    body += scrim(w=STAGE_W - xm, h=STAGE_H - LOW, x=xm, y=LOW)
    body += f'<div class="abs" style="left:{xm}px;top:0;width:{STAGE_W - xm}px;height:{LOW}px;background:{rgba("k0", .25)}"></div>'
    body += header() + counter() + card() + satchel()
    title = 'Market · Riverside Market, day 4, 149 gold, pointing at the Iron Buckler on the counter'
    return write('UxMarket', board_html(title, body, 1280, 720))


if __name__ == '__main__':
    print(build())
