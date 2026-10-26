"""PxTownInn, PxTownShop, PxTownTavern: the town screen in Filigree over Riverside Market drawn as 1x pixel art.

They replace F64TownInn / F64TownShop / F64TownTavern (dirs/f64-town/gen_town.py), keeping each board's state, data,
strings and panel content. What changed is the world and the frame around it:
  - the world is one 1280 x 720 pixel PNG at 1:1 (scene.py), composed for the band the windows leave it, not a
    painted strip squeezed into 224 px;
  - the windows tighten so the scene gets the top 264 px of the stage: the header narrows over the market's corner,
    the counter and the act / satchel column share one top line at y 276, the act window is 160 tall, the
    tariff rows are 24 px;
  - the open tab's building carries the brass bracket cursor (brass marks what you point at), and the company
    stands in the street outside it.

State (from gen_town.py, the real headless runs): the Shop and Tavern are day 2 at Riverside Market, purse 80,
food 7; the Inn is day 4 of seed 36 (Trader's Rest's wolves): purse 173, food 5, Oak 79/84, Lilina 25/62.

Usage: python gen_px_town.py [inn shop tavern]
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT + '/src/kit64')
sys.path.insert(0, HERE)
from kit import *  # noqa: E402,F403
import kit_icons as _I  # noqa: E402  (icon rasters for the local pieces; the kit itself is not edited)
import scene as SC  # noqa: E402

# ------------------------------------------------------------------ real state (unchanged from gen_town.py)
DAY, GOLD = 2, 80
BAG = [('food_rations', 0, 0, 3), ('food_rations', 1, 0, 4), ('healing_potion', 2, 0, None)]
FOOD = 7
INN_PER_HEAD = 12
RUMOURS = [  # town.rumors[daysElapsed % 4] and [(daysElapsed + 1) % 4], daysElapsed = 2
    "I heard there's good coin to be made clearing the roads of brigands.",
    "A traveling healer passed through last week. Sold potions at a fair price.",
]
STOCK = ['food_rations', 'healing_potion', 'power_elixir', 'iron_sword', 'iron_buckler', 'iron_greatsword', 'steel_sword',
         'iron_lance', 'steel_lance', 'iron_axe', 'steel_axe', 'iron_bow', 'steel_bow', 'iron_crossbow', 'steel_crossbow',
         'fire_tome', 'thunder_tome', 'heal_staff', 'mend_staff', 'molten_crossbow', 'steel_buckler', 'iron_tower_shield',
         'steel_tower_shield', 'steel_greatsword', 'longbow', 'composite_bow']
TARIFF = sorted(STOCK, key=lambda i: item(i)['buy'])
WOUNDS = {'mc': (73, 73), 'oak': (79, 84), 'lilina': (25, 62)}          # probe_inn.mts seed 36, day 4
INN = dict(day=4, gold=173, food=5, bag=[('food_rations', 0, 0, 1), ('food_rations', 1, 0, 4), ('healing_potion', 2, 0, None)])
CLASSNAME = {'mc': 'Lord', 'oak': 'Shield Knight', 'lilina': 'Mage'}


def shelf_words(i):
    """Town.tsx shelfWords(): what a shelved item IS, in the shopkeeper's words."""
    it = item(i)
    if it['kind'] == 'food':
        return f"{it.get('charges', 1)} rations"
    if it['kind'] == 'potion':
        e = it.get('effect', {})
        return f"heals {e['amount']}" if e.get('kind') == 'Heal' else f"+{e.get('amount', 0)} AP"
    if it['kind'] == 'quiver':
        return 'quiver'
    if it['kind'] == 'shield':
        return 'off-hand shield'
    return f"{'two-handed' if it.get('twoHanded') else 'one-handed'} {it.get('weaponClass') or it['kind']}"


# ------------------------------------------------------------------ the frame (stage px)
HX, HY, HW, HH = EDGE, EDGE, 440, 124            # header, over the market's north-west corner
TOP = 276                                        # every lower window starts here; the scene owns 0..264
CX, CY, CW = EDGE, TOP, 848                      # the counter
CH = 720 - EDGE - TOP
RX = CX + CW + GAP                               # the right column
RW = 1280 - EDGE - RX
AY, AH = TOP, 160                                # the act window
SAT_H = 720 - EDGE - (AY + AH + GAP)             # the satchel
SY = AY + AH + GAP


# ------------------------------------------------------------------ local pieces (copied from gen_town.py, retuned)
def footprint(w, h, cell=4, lit=False):
    """The satchel footprint drawn to scale (Town.tsx <Footprint>): w x h squares, ink-edged."""
    R = Raster(w * (cell + 1) + 1, h * (cell + 1) + 1)
    for j in range(h):
        for i in range(w):
            x0, y0 = i * (cell + 1), j * (cell + 1)
            for yy in range(y0, y0 + cell + 2):
                for xx in range(x0, x0 + cell + 2):
                    edge = xx in (x0, x0 + cell + 1) or yy in (y0, y0 + cell + 1)
                    R.set(xx, yy, 'k0' if edge else (('o4' if lit else 'b2') if yy == y0 + 1 else ('o3' if lit else 'b1')))
    return R


def ghost_cell(x, y, item_id, cell=44):
    """Where the picked item will land in the satchel (placeInBag's answer): a dotted brass outline round its squares,
    the item's silhouette inside, the small bracket cursor."""
    it = item(item_id)
    w, h = it['w'] * cell, it['h'] * cell
    R = Raster(w, h)
    for i in range(w):
        for j in range(h):
            if (i in (1, w - 2) or j in (1, h - 2)) and 1 <= i <= w - 2 and 1 <= j <= h - 2 and (i + j) % 4 < 2:
                R.set(i, j, 'o4')
    out = R.svg(x, y)
    out += _I.silhouette(it['icon'], ('w3', 'w5')).svg(x + (w - 24) // 2, y + (h - 24) // 2)
    out += brackets(x - 5, y - 5, w + 10, h + 10, small=True)
    return out


ROW_H = 24
LABW = 50          # the act window's label column (Purse, Larder)


def tariff_row(x, y, w, item_id, purse, state='idle'):
    """One line of the price-sorted tariff: kind icon, name, footprint, price; beyond the purse it stays listed,
    dimmed, with the shortfall as its reason."""
    it = item(item_id)
    short = it['buy'] > purse
    cls = 'row' + {'idle': '', 'selected': ' sel', 'hover': ' hov'}[state]
    nc = 'straw' if state == 'selected' else ('faint' if short else 'bone')
    ic = _I.silhouette(it['icon'], ('w3', 'w4')) if short else _I.get(it['icon'])
    inner = ic.svg(5, 0)
    inner += T(36, 2, it['name'], f's16 {nc}')
    fp = footprint(it['w'], it['h'], 4, lit=state == 'selected')
    inner += fp.svg(214 - fp.w // 2, (ROW_H - fp.h) // 2, style='opacity:.5' if short else '')
    coin = _I.coin16(dim=short).inline('margin:-3px 4px 0 0')
    pc = 'faint' if short else 'straw'
    inner += f'<div class="abs nowrap s16 {pc}" style="right:{w - 296}px;top:2px">{coin}{it["buy"]}</div>'
    if short:
        inner += f'<div class="abs s13 rust nowrap" style="left:308px;top:4px">{it["buy"] - purse} short</div>'
    cur = _I.arrow_e(9).svg(-12, (ROW_H - 9) // 2) if state == 'hover' else ''
    return f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{ROW_H}px">{inner}{cur}</div>'


RULE_H = 18


def purse_rule(x, y, w, purse):
    """The line where the purse runs out: the words in rust, a carved groove to the column's end."""
    t = f'beyond the purse · it holds {purse} gold'
    tw = text_w(t, 13, 600)
    return T(x + 8, y + 1, t, 's13 rust') + groove(x + 8 + tw + 10, y + 8, w - tw - 26)


def header(day=DAY, gold=GOLD):
    """Riverside Market: the place's name, the day, the description, the purse."""
    b = T(PAD, 9, 'Riverside Market', 'tt')
    b += T(HW - PAD, 13, f'{icon_inline("day", "margin:-4px 8px 0 0")}Day {day}', 's20 bone', style='transform:translateX(-100%)')
    b += T(PAD, 58, 'A bustling trade hub where the river meets the road.', 's15 lt bone')
    b += groove(PAD, 84, HW - 2 * PAD)
    b += T(PAD, 93, f'{icon_inline("gold", "margin:-4px 8px 0 0")}{gold} gold in the purse', 's16 bone')
    b += T(HW - PAD, 96, 'The Borderlands · town', 's13 dim', style='transform:translateX(-100%)')
    return window(HX, HY, HW, HH, b)


def counter(tab, body):
    """The counter window: the three tabs on a carved baseline, The Company and Back to the road at the strip's right end."""
    sel = ['Inn', 'Shop', 'Tavern'].index(tab)
    b = tabs(12, 12, ['Inn', 'Shop', 'Tavern'], selected=sel, w=CW - 24)
    bx = CW - PAD - text_w('Back to the road', 18, 700) - 16
    b += command('Back to the road', x=bx, y=19)
    b += button('The Company', 'secondary', x=bx - 24 - (text_w('The Company', 16, 700) + 34), y=14)
    return window(CX, CY, CW, CH, b + body)


def satchel(ghost=None, selected=None, bag_=None, food=None):
    """The satchel on every tab (the shop sells FROM it), with the larder under it (Town.tsx <Larder>)."""
    bag_ = bag_ or BAG
    food = FOOD if food is None else food
    free = 32 - sum(item(i)['w'] * item(i)['h'] for i, *_ in bag_)
    b = section_head('The satchel', y=12, w=RW - 2 * PAD, note=f'{free} squares free')
    b += bag(PAD, 42, bag_, selected=selected)
    if ghost:
        b += ghost_cell(PAD + ghost[1] * 44, 42 + ghost[2] * 44, ghost[0])
    b += icon('food', PAD, 224)
    b += T(PAD + 32, 226, f'{food} hops of rations', 's16 bone')
    b += T(RW - PAD, 228, 'enough for the road ahead', 's13 it dim', style='transform:translateX(-100%)')
    return window(RX, SY, RW, SAT_H, b)


def forecast_line(y, lab, before, after, unit, ramp='Ochre'):
    """'Purse  80 -> 40 gold': a label, the cast digits for the headline change, the unit."""
    n = numeral(f'{before} → {after}', 22, ramp)
    return T(PAD, y + 4, lab, 's13 dim') + n.svg(PAD + LABW, y) + T(PAD + LABW + n.w + 8, y + 4, unit, 's13 dim')


def world(active):
    """The pixel world at 1:1, and the bracket cursor on the open tab's building."""
    cv, info = SC.render(active)
    cv.save(os.path.join(HERE, 'z', f'world_{active}.png'))
    uri = cv.data_uri()
    out = (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
           f'width="1280" height="720" src="{uri}">')
    x, y, w, h = info['box'][active]
    out += brackets(x - 7, y - 6, w + 14, h + 12)
    return out, info


def board(name, title, tab, counter_body, act_body, sat_kw, head_kw=None):
    """One town board. The state it shows lives in `title` (the canvas label), never as a caption on the screen."""
    body, info = world(tab.lower())
    body += header(**(head_kw or {}))
    body += counter(tab, counter_body)
    body += window(RX, AY, RW, AH, act_body)
    body += satchel(**sat_kw)
    write(name, board_html(title, body, 1280, 720))


# ------------------------------------------------------------------ Shop
def shop():
    pick = 'food_rations'
    b = section_head('On the counter', y=54, w=CW - 2 * PAD, note=f'{len(TARIFF)} goods, cheapest first')
    colw = (CW - 2 * PAD - 24) // 2
    y0 = 82
    col1, col2 = TARIFF[:13], TARIFF[13:]
    yy = y0
    for i, iid in enumerate(col1):
        if item(iid)['buy'] > GOLD and (i == 0 or item(col1[i - 1])['buy'] <= GOLD):
            b += purse_rule(PAD, yy, colw, GOLD)
            yy += RULE_H
        b += tariff_row(PAD, yy, colw, iid, GOLD, 'selected' if iid == pick else 'idle')
        yy += ROW_H
    yy = y0
    for iid in col2:
        b += tariff_row(PAD + colw + 24, yy, colw, iid, GOLD)
        yy += ROW_H
    arr = _I.arrow_e(9).inline('margin:-2px 0 0 8px')
    b += T(CW - PAD, yy + 4, f'Pick something from the satchel to sell it.{arr}', 's13 dim', style='transform:translateX(-100%)')

    it = item(pick)
    a = T(PAD, 14, 'Picked from the counter', 's13 dim')
    a += icon(it['icon'], PAD, 32) + T(PAD + 32, 33, it['name'], 's18 straw')
    a += T(RW - PAD, 35, price(it['buy']), 's16', style='transform:translateX(-100%)')
    a += T(PAD, 62, f'{shelf_words(pick)} · each hop eats one', 's14 bone')
    a += T(RW - PAD, 63, f'fits the satchel {_I.check_mark("m4").inline("margin:-2px 0 0 4px")}', 's13 meadow',
           style='transform:translateX(-100%)')
    a += groove(PAD, 88, RW - 2 * PAD)
    a += forecast_line(96, 'Purse', GOLD, GOLD - it['buy'], 'gold left')
    a += T(PAD, 128, 'Larder', 's13 dim') + T(PAD + LABW, 126, f'{FOOD} → {FOOD + it["charges"]} hops', 's16 bone')
    bw = text_w(f'Buy · {it["buy"]} gold', 17, 700) + 30
    a += button(f'Buy · {it["buy"]} gold', 'primary', x=RW - PAD - bw, y=AH - 14 - 34, w=bw)
    board('PxTownShop', 'Town · the shop, Food Rations picked, day 2', 'Shop', b, a, dict(ghost=(pick, 3, 0)))


# ------------------------------------------------------------------ Inn
def inn():
    hurt = [u for u in COMPANY if WOUNDS[u['id']][0] < WOUNDS[u['id']][1]]
    total = len(hurt) * INN_PER_HEAD
    b = T(PAD, 56, f'A bed, a fire, and a bowl of something hot. The innkeeper charges <b class="straw">{INN_PER_HEAD}</b> gold a head for the wounded.', 's15 lt bone', w=CW - 2 * PAD)
    b += section_head('The Company', y=86, w=CW - 2 * PAD, note=f'{len(hurt)} of {len(COMPANY)} hurt')
    y = 116
    RH = 96
    for k, u in enumerate(COMPANY):
        hp, mx = WOUNDS[u['id']]
        w = hp < mx
        b += face(u['face'], PAD + 4, y + (RH - 48) // 2, 48)
        b += T(PAD + 68, y + 28, u['name'], 's16 bone') + T(PAD + 68, y + 49, CLASSNAME[u['id']], 's13 dim')
        bx = 330
        b += hp_bar(bx, y + 48, 260, hp, mx, 'ally', gain=(mx - hp) if w else 0, h=11)
        if w:
            b += T(bx, y + 24, f'{hp}/{mx}', 's16 bone') + T(bx + text_w(f'{hp}/{mx}', 16, 700) + 8, y + 26, f'a bed mends {mx - hp}', 's13 meadow')
            b += T(CW - PAD - 10, y + 38, price(INN_PER_HEAD, note='a bed'), 's16', style='transform:translateX(-100%)')
        else:
            b += T(bx, y + 24, f'{hp}/{mx}', 's16 bone')
            b += T(CW - PAD - 10, y + 40, 'no bed needed', 's13 dim', style='transform:translateX(-100%)')
        if k < len(COMPANY) - 1:
            b += groove(PAD, y + RH, CW - 2 * PAD)
        y += RH

    a = T(PAD, 14, 'The innkeeper’s bill', 's13 dim')
    yy = 31
    for u in hurt:
        a += T(PAD, yy, u['name'], 's16 bone') + T(RW - PAD, yy, price(INN_PER_HEAD), 's16', style='transform:translateX(-100%)')
        yy += 22
    a += groove(PAD, yy + 3, RW - 2 * PAD)
    a += forecast_line(yy + 10, 'Purse', INN['gold'], INN['gold'] - total, 'gold left')
    bw = text_w(f'Rest the wounded · {total} gold', 17, 700) + 44
    a += button(f'Rest the wounded · {total} gold', 'primary', 'hover', x=RW - PAD - bw, y=AH - 14 - 34, w=bw)
    board('PxTownInn', 'Town · the inn, Oak and Lilina hurt from the wolves, pointing at Rest, day 4', 'Inn', b, a,
          dict(bag_=INN['bag'], food=INN['food']), dict(day=INN['day'], gold=INN['gold']))


# ------------------------------------------------------------------ Tavern
def tavern():
    b = section_head('What the room is saying', y=54, w=CW - 2 * PAD, note=f'day {DAY}')
    y = 90
    for r in RUMOURS:
        b += T(PAD, y, f'“{r}”', 's16 lt it bone')
        y += 30
    b += section_head('The board', y=y + 16, w=CW - 2 * PAD, note='one name today')
    y += 52
    b += row(PAD, y, CW - 2 * PAD, 'Guildmistress Anya', sub="The merchant guild's mistress, ledgers spread before her, eyes red from lack of sleep.",
             icon_name='contract', state='selected', h=56)
    y += 56
    b += section_head('The bounty desk', y=y + 26, w=CW - 2 * PAD)
    y += 66
    b += empty_state(PAD, y, CW - 2 * PAD, 'capture', 'No prisoners in the wagon.',
                     'Wound a foe, then Capture him on the field. The magistrate pays by the head.')

    a = T(PAD, 14, 'On the board', 's13 dim')
    a += icon('contract', PAD, 32) + T(PAD + 32, 33, 'Guildmistress Anya', 's18 straw')
    a += T(PAD, 58, "The merchant guild's mistress, ledgers spread before her, eyes red from lack of sleep.", 's15 lt bone', w=RW - 2 * PAD)
    a += T(PAD, AH - 14 - 36, 'Contracts held: none yet.', 's13 dim') + T(PAD, AH - 14 - 18, 'This would be the first.', 's13 dim')
    a += button('Talk', 'primary', x=RW - PAD - 96, y=AH - 14 - 34, w=96)
    board('PxTownTavern', "Town · the tavern, Anya's notice picked, day 2", 'Tavern', b, a, {})


if __name__ == '__main__':
    which = sys.argv[1:] or ['inn', 'shop', 'tavern']
    for w in which:
        {'shop': shop, 'inn': inn, 'tavern': tavern}[w]()
        print('wrote', w)
