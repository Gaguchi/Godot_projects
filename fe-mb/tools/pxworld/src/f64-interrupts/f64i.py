"""Local pieces for the interrupts group, built ON the Filigree kit (never a fork of it).

    map_screen(...)  the overworld screen as it stands under an interrupt: the painted Borderlands, the place
                     labels, the company standing where the run has it, and the three HUD windows (region, commands,
                     company) with the run's own day, purse and larder. Drawn first, then the kit's scrim/modal on top.
    card_slot(...)   an empty card slot in the hand band (the hand retired while a foe acts).
    zoom(...)        QA crops into this folder's t/ (the kit's own zoom writes into the kit folder).
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import math
import sys

sys.path.insert(0, ROOT + '/src/kit64')
from kit import *            # noqa: E402,F401,F403
import kit_px as KP           # noqa: E402  (read-only: frame rasters)
import kit_world_map as WM    # noqa: E402  (read-only: place coordinates, road curves, the company group)

HERE = ROOT + '/src/f64-interrupts'


# ------------------------------------------------------------------ geometry on the painted map
def road_point(a, b, t):
    """A point at parameter t along the road a -> b (the kit map's own quadratic curve)."""
    A, Bp, c, _ = WM.road_geo[(a, b)]
    return ((1 - t) ** 2 * A[0] + 2 * (1 - t) * t * c[0] + t * t * Bp[0],
            (1 - t) ** 2 * A[1] + 2 * (1 - t) * t * c[1] + t * t * Bp[1])


def company_at(x, y):
    """The three miniatures under the standard (the kit map's company group), moved so the camp anchor sits on (x, y)."""
    cx, cy = WM.P['frontier_camp']
    dx, dy = round(x - cx), round(y - cy)
    return (f'<svg class="abs" style="left:0;top:0" width="1280" height="720" viewBox="0 0 1280 720">'
            f'<g transform="translate({dx} {dy})">{WM.company}</g></svg>')


# place labels, as the map screen sets them (x, top, anchor)
LBL = {
    'frontier_camp': (446, 438, 'c'), 'traders_rest': (566, 312, 'c'), 'riverside_market': (660, 440, 'c'),
    'south_road_ambush': (638, 520, 'c'), 'old_mill_crossing': (852, 290, 'l'), 'bandit_hideout': (830, 452, 'c'),
    'south_junction': (820, 566, 'c'), 'north_ridge_path': (984, 262, 'r'), 'watchtower_ridge': (1092, 266, 'c'),
    'pine_crossing': (1076, 436, 'c'), 'smugglers_cave': (1066, 526, 'c'), 'broken_bridge': (954, 592, 'c'),
    'border_fortress': (1262, 376, 'r'), 'rodericks_camp': (1262, 486, 'r'),
}
# South Road Ambush and Bandit Hideout are DISCOVERY nodes: 'landmark' (run/overworld.ts#typeLabel), each a check event
SUB = {'smugglers_cave': ('locked for now', 'rust'), 'south_road_ambush': ('a landmark', 'dim'),
       'bandit_hideout': ('a landmark', 'dim')}


def _label(key, here):
    x, top, al = LBL[key]
    name = WM.NAMES[key]
    if al == 'c':
        pos = f'left:{x - 160}px;width:320px;text-align:center'
    elif al == 'l':
        pos = f'left:{x}px'
    else:
        pos = f'right:{1280 - x}px;text-align:right'
    if key == here:
        out = f'<div class="abs nowrap s18 rill ol1d" style="{pos};top:{top}px">{name}</div>'
        out += f'<div class="abs nowrap s13 rill ol1d" style="{pos};top:{top + 24}px">the company is here</div>'
        return out
    out = f'<div class="abs nowrap s14 bone ol1d" style="{pos};top:{top}px">{name}</div>'
    if key in SUB:
        t, c = SUB[key]
        out += f'<div class="abs nowrap s13 {c} ol1d" style="{pos};top:{top + 18}px">{t}</div>'
    return out


def _region_strip(x, y):
    """The four lands as a strip with the brass pin on the Borderlands (the region window's map of the whole run)."""
    segs = [('Borderlands', ('m2', 'm3', 'm4', 'm5')), ('Thornwood', ('m0', 'm1', 'm2', 'm3')),
            ('Ashfall', ('b0', 'b0', 'b1', 'b2')), ('Iron Throne', ('x1', 'x1', 'x2', 'x3'))]
    SW, SH = 106, 12
    R = Raster(SW * 4 + 4, SH + 2)
    for i, (_, ramp) in enumerate(segs):
        x0 = i * (SW + 1)
        for xx in range(x0, x0 + SW):
            for yy in range(SH + 2):
                if yy in (0, SH + 1) or xx in (x0, x0 + SW - 1):
                    R.set(xx, yy, 'k0')
                elif yy == 1:
                    R.set(xx, yy, ramp[3])
                elif yy == SH:
                    R.set(xx, yy, ramp[0])
                else:
                    R.set(xx, yy, ramp[2] if yy < 6 else ramp[1])
    out = R.svg(x, y)
    for i, (n, _) in enumerate(segs):
        out += T(x + i * (SW + 1), y + 17, n, f's13 {"bone" if i == 0 else "faint"} c', w=SW)
    out += KP.frame(SW + 6, SH + 8, 'plate', shadow=1).svg(x - 3, y - 3)
    out += pin(x + 49, y - 8)
    return out


def map_hud(day=1, food_used=(0, 0), gold=80, potions=1, contracts='none yet', hp=None):
    """The map screen's three windows: the region (day, odds, the lands, the purse and larder), the commands, the company."""
    food = sum(4 - u for u in food_used)
    RW, RH = 472, 176
    rb = (T(RW - PAD, 20, f'{icon_inline("day", "margin:-5px 6px 0 0")}Day {day}', 's20 bone', style='transform:translateX(-100%)')
          + T(PAD, 62, 'Roads here: an encounter on <span class="rust">4 hops in 10</span>', 's15 dim')
          + _region_strip(PAD, 92)
          + rule(PAD, 136, RW - 2 * PAD)
          + T(PAD, 144, f'{icon_inline("gold")}<span class="straw">{gold}</span> gold', 's15 bone')
          + T(116, 144, f'{icon_inline("food")}<span class="straw">{food}</span> food', 's15 bone')
          + f'<div class="abs" style="left:206px;top:148px">{food_pips(0, 0, (4, 4), food_used)}</div>'
          + T(RW - PAD, 144, f'{icon_inline("potion")}Healing Potion ×{potions}', 's15 bone', style='transform:translateX(-100%)'))
    out = window(EDGE, EDGE, RW, RH, rb, title='The Borderlands', big=True)
    CW = max(284, 162 + text_w(contracts, 13, 600) + 8 + PAD)
    cb = (T(PAD, 16, 'The Company', 's18 bone') + T(162, 19, 'roster and gear', 's13 dim') + groove(PAD, 43, CW - 2 * PAD)
          + T(PAD, 50, 'Contracts', 's18 bone') + T(162, 53, contracts, 's13 dim') + groove(PAD, 77, CW - 2 * PAD)
          + T(PAD, 84, 'Menu', 's18 bone') + T(160, 86, key('Esc'), 's13'))
    out += window(1280 - EDGE - CW, EDGE, CW, 122, cb)
    hp = hp or {}
    rows = ''
    for i, u in enumerate(COMPANY):   # the Hyb64Map company window, row for row (f64-company/common.py#company_window)
        cur = hp.get(u['id'], u['hp'])
        y = 44 + i * 52
        rows += face(u['face'], 18, y, 48)
        rows += T(82, y + 4, u['name'], 's16 bone')
        rows += T(82, y + 27, u['role'], 's13 dim')
        rows += hp_bar(250, y + 10, 64, cur, u['max'])
        rows += T(392 - PAD, y + 4, f'{cur}/{u["max"]}', 's14 bone', style='transform:translateX(-100%)')
    out += window(EDGE, 496, 392, 214, rows, title='The Company', note='three of us')
    return out


def map_screen(here=None, at=None, day=1, food_used=(0, 0), gold=80, contracts='none yet', hide=()):
    """The overworld as it stands under an interrupt. here = the place the company stands at; at = (x, y) on a road instead.
    hide = place labels a window will sit across (so no name is left half-cut at a window's edge)."""
    body = world_map(company=False)
    if at is None:
        at = WM.P[here or 'frontier_camp']
    body += company_at(*at)
    for k in LBL:
        if k not in hide:
            body += _label(k, here)
    body += T(1176, 600, 'Thornwood', 's14 bone c', w=78)
    body += T(1264, 646, 'the land runs on east', 's13 bone ol1d', style='transform:translateX(-100%)')
    body += map_hud(day, food_used, gold, contracts=contracts)
    return body


# ------------------------------------------------------------------ combat: the retired hand
def card_slot(x, y, w=136, h=172):
    """An empty card slot: a recessed well the size of a card, its floor a faint checker. The hand withdrawn on a foe's turn."""
    R = Raster(w, h)
    for j in range(h):
        for i in range(w):
            corner = (i in (0, w - 1)) and (j in (0, h - 1))
            if corner:
                continue
            if i == 0 or j == 0:
                R.set(i, j, 'k0')
            elif i == w - 1 or j == h - 1:
                R.set(i, j, 'w4')
            elif i == 1 or j == 1:
                R.set(i, j, 'w0')
            elif i == w - 2 or j == h - 2:
                R.set(i, j, 'w3')
    # where a card sits: a carved keyline 8 px in (dark over light, like the kit's groove), corners cut
    for i in range(9, w - 9):
        R.set(i, 8, 'k0'); R.set(i, h - 9, 'w2')
    for j in range(9, h - 9):
        R.set(8, j, 'k0'); R.set(w - 9, j, 'w2')
    floor = (f'<div class="abs" style="left:{x + 2}px;top:{y + 2}px;width:{w - 4}px;height:{h - 4}px;background-color:{C["w0"]};'
             f'background-image:repeating-conic-gradient({C["w1"]} 0 25%,transparent 0 50%);background-size:2px 2px"></div>')
    return floor + R.svg(x, y)


# ------------------------------------------------------------------ QA
def zoom(name, x, y, w, h, z=3, out='z'):
    from PIL import Image
    im = Image.open(f'{ROOT}/out/preview/{name}.png').crop((x, y, x + w, y + h))
    im.resize((w * z, h * z), Image.NEAREST).save(f'{HERE}/t/{out}.png')


if __name__ == '__main__':
    a = sys.argv[1:]
    zoom(a[0], *map(int, a[1:5]), *(map(int, a[5:6]) if len(a) > 5 else ()), *(a[6:7] if len(a) > 6 else ()))
