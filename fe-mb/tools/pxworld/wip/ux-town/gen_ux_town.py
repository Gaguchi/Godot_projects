"""UxTown and UxInn: the town as one job per screen. They replace PxTownInn, PxTownShop and PxTownTavern.

UxTown  Where in town do we go? The square is the menu: the inn, the market and the tavern, and the road out.
        Riverside Market, day 4, arriving, pointing at the inn (two of the company are hurt).
UxInn   Do we pay to heal the wounded? The innkeeper's offer and nothing more: 173 -> 149.

The world is dirs/ux-town/uxscene.py (px-town's scene, recomposed for full screen). The UI is the kit (dirs/kit64),
imported and never edited. Local pieces built on its primitives: leader() (the map's brass leader, copied from
pxworld/gen_map.py), forecast_line() (copied from px-town), place_plate().

    cd <scratchpad> && python dirs/ux-town/gen_ux_town.py && node preview.mjs UxTown UxInn
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
sys.path.insert(0, SP + '/dirs/kit64')
sys.path.insert(0, HERE)
from kit import *  # noqa: E402,F403
import kit_icons as _I  # noqa: E402  (icon rasters for local pieces; the kit is not edited)
import kit_px as _P  # noqa: E402
import uxscene as SC  # noqa: E402
import innroom as IR  # noqa: E402  (the inn's common room, built from the tavern's room kit)

# ------------------------------------------------------------------ the moment: Riverside Market, day 4
TOWN = 'Riverside Market'
DESC = 'A bustling trade hub where the river meets the road.'       # towns/riverside_market.json
DAY, GOLD = 4, 173
PER_HEAD = 12                                                       # riverside_market.json innHealCostPerUnit
HP = {'mc': (73, 73), 'oak': (79, 84), 'lilina': (25, 62)}          # PxTownInn: seed 36, day 4, after the wolves
CLASSNAME = {'mc': 'Lord', 'oak': 'Shield Knight', 'lilina': 'Mage'}
SHORT = {'mc': 'The Foundling', 'oak': 'Oak', 'lilina': 'Lilina'}
HURT = [u for u in COMPANY if HP[u['id']][0] < HP[u['id']][1]]
BILL = len(HURT) * PER_HEAD                                         # innCost(): wounded x innHealCostPerUnit = 24


# ------------------------------------------------------------------ local pieces
def world_img(cv, vx):
    """The world at 1:1: a 1280 x 720 crop of the 1480-wide scene, starting at world x = vx."""
    view = cv.crop(vx, 0, 1280, 720)
    view.save(os.path.join(HERE, 'z', f'view_{vx}.png'))
    return (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
            f'width="1280" height="720" src="{view.data_uri()}">')


def leader(x, y0, y1):
    """The map's brass leader (pxworld/gen_map.py): a 4 px brass line from a window's foot down to the bracket,
    ending in a small arrowhead. x = its centre."""
    lead = Raster(5, y1 - y0 + 1)
    for j in range(lead.h - 4):
        lead.set(0, j, 'k0'); lead.set(1, j, 'o5'); lead.set(2, j, 'o3'); lead.set(3, j, 'k0')
    lead.stamp(['kkkkk', 'k454k', '.k3k.', '..k..'], 0, lead.h - 4, keymap=_P.BR)
    return lead.svg(x - 2, y0)


def forecast_line(x, y, lab, before, after, unit, labw=58):
    """'Purse  173 -> 149 gold left': a label, the cast digits for the headline change, the unit (from px-town)."""
    n = numeral(f'{before} → {after}', 22, 'Ochre')
    return T(x, y + 4, lab, 's13 dim') + n.svg(x + labw, y) + T(x + labw + n.w + 8, y + 4, unit, 's13 dim')


def place_plate(cx, y, text, lit=False):
    """A plate laid on the world under a place, centred on cx (the map's place plates)."""
    return plate(text, 'lit' if lit else 'idle', x=cx, y=y, center=True)


# ------------------------------------------------------------------ UxTown
HX, HY, HW, HH = EDGE, EDGE, 440, 124
LW = 312
LX, LY = 1280 - EDGE - LW, EDGE


def town_header():
    """Where we are: the town, the day, its line, the purse (gold appears where it is spent)."""
    b = T(PAD, 9, TOWN, 'tt')
    b += T(HW - PAD, 13, f'{icon_inline("day", "margin:-4px 8px 0 0")}Day {DAY}', 's20 bone', style='transform:translateX(-100%)')
    b += T(PAD, 58, DESC, 's15 lt bone')
    b += groove(PAD, 84, HW - 2 * PAD)
    b += T(PAD, 93, f'{icon_inline("gold", "margin:-4px 8px 0 0")}{GOLD} gold in the purse', 's16 bone')
    b += T(HW - PAD, 96, 'The Borderlands · town', 's13 dim', style='transform:translateX(-100%)')
    return window(HX, HY, HW, HH, b)


CHOICES = ['Visit the inn', 'Go to the market', 'Visit the tavern']      # verbs, as Warband's town menu (UXREFS 1.1)


def town_list(hover=0):
    """The same choices as the square, numbered for the keyboard (Mount & Blade's town menu); the way back last."""
    rw = LW - 2 * PAD - 4
    b = ''
    y = 14
    for i, name in enumerate(CHOICES):
        b += choice(PAD + 4, y, rw, i + 1, name, 'hover' if i == hover else 'idle')
        y += 34
    b += groove(PAD, y + 4, LW - 2 * PAD)
    y += 14
    b += choice(PAD + 4, y, rw, 4, 'Back to the road')
    b += f'<div class="abs nowrap" style="right:{PAD + 6}px;top:{y + 6}px">{key("Esc")}</div>'
    # outside the numbered places, so 1-4 still run the square: the way into the company (PxMap1x's row, key C)
    y += 32 + 8
    b += groove(PAD, y, LW - 2 * PAD)
    y += 10
    b += T(PAD + 12, y + 5, 'The Company', 's16 bone')
    b += T(PAD + 12 + text_w('The Company', 16, 700) + 10, y + 8, 'roster and gear', 's13 dim')
    b += f'<div class="abs nowrap" style="right:{PAD + 6}px;top:{y + 6}px">{key("C")}</div>'
    return window(LX, LY, LW, y + 32 + 14, b)


def town():
    cv, info = SC.render('square')
    body = world_img(cv, 0)
    box = info['box']
    # the four plates: what you can point at reads before any hover (the map's place plates)
    PLATE_Y = 474
    for k, t, cx in (('inn', 'The inn', 582), ('shop', 'The market', 778), ('tavern', 'The tavern', 962)):
        body += place_plate(cx, PLATE_Y, t, lit=(k == 'inn'))
    body += place_plate(96, SC.POST[1] + 38, 'Back to the road')
    body += place_plate(1190, 452, 'Back to the road')     # the bridge's road east is the same way out
    # pointing at the inn: the bracket, the lit plate, the forecast pinned over it with the map's brass leader
    x, y, w, h = box['inn']
    bx0, by0 = x - 7, y - 6
    body += brackets(bx0, by0, w + 14, h + 12)
    # what it offers, and why it matters now (UXREFS 1.1: a one-line purpose that carries the reason)
    fx, fy, fw, fh = 482, EDGE, 340, 112             # on the windows' top line, 27 px clear of the header
    f = T(PAD, 9, 'The inn', 'tt')
    f += T(fw - PAD, 22, 'click to go in', 's14 straw', style='transform:translateX(-100%)')
    f += T(PAD, 57, f'Beds for the wounded, {price(PER_HEAD)}<span style="margin-left:5px">a head</span>', 's15 bone')
    f += T(PAD, 81, '<span class="rust">Two of us are hurt:</span> Oak and Lilina.', 's15 bone')
    body += window(fx, fy, fw, fh, f, state='hover')
    body += leader(x + 74, fy + fh + 2, by0 + 2)          # onto the open roof, clear of the chimney's smoke
    body += town_header()
    body += town_list(hover=0)
    body += T(EDGE + 6, 692, 'Three doors and the road out. Point at one, click to go.', 's14 bone ol1d')
    write('UxTown', board_html('Town · Riverside Market, day 4, arriving, pointing at the inn', body, 1280, 720))


# ------------------------------------------------------------------ UxInn
OW = 420
OX, OY = 1280 - EDGE - OW, EDGE


def inn_header():
    """Where we are: the place, then the room."""
    w, h = 286, 92
    b = T(PAD, 14, f'{TOWN} · day {DAY}', 's13 dim')
    b += T(PAD, 32, 'The inn', 'tt')
    return window(EDGE, EDGE, w, h, b)


def bed_row(u, y, w):
    """One of the company: face, name, class; HP now and after a bed (the dithered heal ghost on the bar).
    The current HP is rust under half, as on PxCamp."""
    hp, mx = HP[u['id']]
    hurt = hp < mx
    b = face(u['face'], PAD, y + 2, 48)
    b += T(PAD + 60, y + 2, u['name'], 's16 bone')
    b += T(PAD + 60, y + 23, CLASSNAME[u['id']], 's13 dim')
    hp_cls = 'rust' if hp * 2 < mx else 'bone'
    b += T(w - PAD, y + 2, f'<span class="{hp_cls}">{hp}</span>/{mx}', 's16 bone', style='transform:translateX(-100%)')
    if hurt:
        b += T(w - PAD, y + 23, f'a bed mends {mx - hp}', 's13 meadow', style='transform:translateX(-100%)')
    else:
        b += T(w - PAD, y + 23, 'no bed needed', 's13 dim', style='transform:translateX(-100%)')
    b += hp_bar(PAD + 60, y + 43, w - 2 * PAD - 60, hp, mx, 'ally', gain=(mx - hp) if hurt else 0, h=9)
    return b


def whole_line(u, y, w):
    """One who needs no bed: a small face centred in the face column, one quiet line, no bar (UXREFS 1.2)."""
    hp, mx = HP[u['id']]
    b = face(u['face'], PAD + 8, y, 32)
    b += T(PAD + 60, y + 7, u['name'], 's15 bone')
    b += T(w - PAD, y + 8, f'{hp}/{mx} · whole, no bed needed', 's13 dim', style='transform:translateX(-100%)')
    return b


def back_row(x, y, w, text):
    """The way back as UxTown's list row: the line at left, its Esc chip on the window's inner right edge."""
    return (f'<div class="row" style="left:{x}px;top:{y}px;width:{w}px;height:32px">'
            f'<div class="abs nowrap" style="left:8px;top:5px;line-height:22px"><span class="s16 bone">{text}</span></div></div>'
            f'<div class="abs nowrap" style="left:{x + w - 40}px;top:{y + 6}px">{key("Esc")}</div>')


def inn():
    room, info = IR.render()
    room.save(os.path.join(HERE, 'z', 'innroom.png'))
    body = (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
            f'width="1280" height="720" src="{room.data_uri()}">')
    # the innkeeper named on her counter, as the tavern names its barkeep: who the offer is from
    cx_, cy_, cw_, ch_ = info['counter']
    body += place_plate(cx_ + cw_ // 2, cy_ + 40, 'The innkeeper')
    b = section_head("The innkeeper's offer", y=13, w=OW - 2 * PAD, note=f'{len(HURT)} of {len(COMPANY)} hurt')
    b += T(PAD, 46, '“A bed, a fire, and a bowl of something hot.”', 's15 lt it bone')
    y = 78
    RH = 62
    for u in HURT:                                   # the wounded, each with a bar and what a bed mends
        b += bed_row(u, y, OW)
        y += RH
        b += groove(PAD, y - 7, OW - 2 * PAD)
    for u in COMPANY:                                # whoever is whole, marked and quiet
        if u not in HURT:
            b += whole_line(u, y, OW)
            y += 40
    b += rule(PAD, y + 2, OW - 2 * PAD)
    y += 14
    b += T(PAD, y, f'Two beds, {PER_HEAD} gold a head', 's16 bone')
    y += 30
    b += forecast_line(PAD, y, 'Purse', GOLD, GOLD - BILL, 'gold left')
    y += 42
    lab = f'Rest the wounded · {BILL} gold'
    bw = text_w(lab, 17, 700) + 44
    bx = OW - PAD - bw
    b += button(lab, 'primary', 'hover', x=bx, y=y, w=bw)
    b += f'<div class="abs nowrap" style="left:{bx - 58}px;top:{y + 9}px">{key("Enter")}</div>'
    y += 34 + 14
    b += groove(PAD, y, OW - 2 * PAD)
    y += 8
    b += back_row(PAD - 8, y, OW - 2 * PAD + 8, 'Back to the square')    # its text on the bill's left edge
    oh = y + 32 + 12
    body += window(OX, OY, OW, oh, b)
    body += inn_header()
    write('UxInn', board_html('Inn · Riverside Market, day 4, Oak and Lilina hurt, pointing at Rest the wounded', body, 1280, 720))


if __name__ == '__main__':
    which = sys.argv[1:] or ['town', 'inn']
    for w in which:
        {'town': town, 'inn': inn}[w]()
        print('wrote', w)
