"""UxMarket's backdrop: Riverside Market's street at town scale, seen from the merchant's counter.

The same street as dirs/px-town/scene.py (the inn, the market, the tavern fronting the cobbles, the quay, the river
and the bridge), imported read-only and composed again for the trade screen:
  - the whole street slides west by OX px, so the market sits over the stage's centre column, above the item card;
  - the company is not in the street (it is at the counter: the screen itself);
  - the merchant stands behind his counter under the striped awning, a nameless townsman at the scene's grain,
    seen from the brow down between the awning's valance and the let-down counter, so the counter is in front of him;
  - two more broadleaves fill the east bank the slide opens up at the stage's right edge.
Everything else (ground, buildings, props, townsfolk, shadows, smoke) is scene.py's own code, copied with the offset
and nothing more. The board lays the kit's flat scrim over all of it.

    cv, info = render()     info['merchant'] = (x, y) of his face; info['shop'] = the market's box on the stage
"""
import math
import random
import sys

import numpy as np

SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
sys.path.insert(0, SP + '/dirs/px-town')
sys.path.insert(0, SP + '/dirs')

from pxt import Canvas, Sprite, pal, CLEAR, selout, smoke_puffs  # noqa: E402
import ground as GR  # noqa: E402
import buildings as BD  # noqa: E402
import bld_more as BM  # noqa: E402
import bridge as BR  # noqa: E402
import props_town as PT  # noqa: E402
import folk_town as FT  # noqa: E402
import folk_more as FM  # noqa: E402
import scene as SC  # noqa: E402  (Layer, town_tree, building_shadow: used as they are)
from pxworld import terrain as TR  # noqa: E402

OX = -132                                  # the slide: the market's centre (778) lands on the card column (646)
GROUND = SC.GROUND
INN = (SC.INN[0] + OX, SC.INN[1])
SHOP = (SC.SHOP[0] + OX, SC.SHOP[1])
TAVERN = (SC.TAVERN[0] + OX, SC.TAVERN[1])
KERB = SC.KERB + OX
WATER = SC.WATER + OX
BANK = SC.BANK + OX
BRIDGE_ROWS = SC.BRIDGE_ROWS

# the merchant: a townsman of folk_more.MAN in his own wool (grey hair and beard, a walnut leather jerkin)
MERCHANT_KM = {'A': 'b3', 'B': 'b2', 'C': 'b1', 'F': 'f3', 'G': 'f2', 'E': 'k1', 'L': 'w5', 'M': 'w4', 'N': 'w3',
               'T': 'b4', 'W': 'w2', 'O': 'o4', 'P': 'w3', 'Q': 'w2', 'V': 'w1'}


def east_x(y):
    return GR.bank_line(y, BANK, 5, seed=11, period=160.0)


def merchant():
    """folk_town.figure() with the merchant's palette: the same rows, ramps and selout."""
    rows = FM.MAN
    w = max(len(r) for r in rows)
    s = Sprite(w + 2, len(rows) + 2, (w + 2) // 2, len(rows))
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in '. ':
                s.put(i + 1, j + 1, MERCHANT_KM[ch])
    selout(s, over={'b': 'b1'})
    return s


def behind_counter(cv, spr, fx, fy, y_top, y_bot, shade_rows=2):
    """Stamp spr with its foot at (fx, fy), keeping only rows y_top..y_bot of the stage: the awning above and the
    counter below stay in front of him. The top shade_rows sit in the awning's shadow, one step down their ramps."""
    c = Sprite(spr.w, spr.h, spr.ax, spr.ay)
    c.ix = spr.ix.copy()
    top = int(fy) - spr.ay
    for j in range(spr.h):
        y = top + j
        if not (y_top <= y <= y_bot):
            c.ix[j, :] = CLEAR
        elif y < y_top + shade_rows:
            for i in range(spr.w):
                if c.ix[j, i] != CLEAR:
                    c.ix[j, i] = pal.shift_index(int(c.ix[j, i]), -1)
    cv.stamp(c, fx, fy)


def restamp(cv, spr, ox, oy, sx0, sx1, sy0, sy1, keys):
    """Put back the sprite's pixels of the given palette keys inside a box (sprite px): goods lying on the counter."""
    want = {pal.ix(k) for k in keys}
    for sy in range(sy0, sy1 + 1):
        for sx in range(sx0, sx1 + 1):
            v = int(spr.ix[sy, sx])
            if v in want:
                cv.ix[oy + sy, ox + sx] = v


def render(seed=5):
    R = random.Random(seed)
    cv = Canvas(1280, 720)
    TR.grass(cv, seed=4, g=1, cell=210)
    # ---------------------------------------------------------------- the ground (scene.py, slid by OX)
    TR.patch(cv, 300 + OX, 262, 200, 128, seed=6, g=1, base='d4')
    west = [(int(452 + OX + 7 * math.sin(y / 23.0) + 4 * math.sin(y / 9.0 + 1)), y) for y in range(720, 131, -6)]
    sq = GR.mask_poly(cv, [(464 + OX, 132), (KERB, 132), (KERB, 720)] + west)
    GR.cobbles(cv, sq, seed=3)
    GR.loose_setts(cv, sq, R, 40)
    quay = GR.mask_poly(cv, [(KERB, 96), (WATER, 96), (WATER, 720), (KERB, 720)])
    GR.flags(cv, quay, seed=5)
    for y in range(96, 720):
        cv.put(KERB, y, 't5'); cv.put(KERB + 1, y, 't4'); cv.put(KERB - 1, y, 't2')
    for y in range(96, 720):
        for i, k in enumerate(('t5', 't6', 't5', 't4', 't3')):
            cv.put(WATER - 5 + i, y, k)
        if y % 11 == 0:
            for i in range(5):
                cv.put(WATER - 5 + i, y, 't2')
    for x in range(KERB, WATER):
        cv.put(x, 95, 't2'); cv.put(x, 94, 't3')
    TR.road(cv, [(-10 + OX, 246), (60 + OX, 242), (140 + OX, 236), (200 + OX, 232)], 15, g=1, base='d4', pebbles=.02, seed=2)
    GR.grass_edge_tufts(cv, sq, R, n=80)
    # ---------------------------------------------------------------- the river, its east bank, the bridge
    W = GR.river(cv, WATER, east_x, 0, 720, seed=4)
    GR.east_bank(cv, east_x, 0, 720)
    bx0, bx1 = WATER - 22, int(east_x(170)) + 26
    br, binfo = BR.bridge(bx0, bx1, WATER - 4, int(east_x(170)) + 8, *BRIDGE_ROWS)
    for y in range(BRIDGE_ROWS[3] + 1, BRIDGE_ROWS[3] + 7):
        for x in range(WATER + (y - BRIDGE_ROWS[3]), int(east_x(y))):
            if W[y, x]:
                cv.ix[y, x] = pal.shift_index(cv.ix[y, x], -1)
    GR.ripples(cv, W, WATER + 4, BANK - 2, 0, 712, R, n=150,
               avoid=lambda x, y: BRIDGE_ROWS[0] - 12 < y < BRIDGE_ROWS[3] + 10)
    pc = binfo['cut']
    for k in range(1, 18):
        for s_ in (-1, 1):
            x = pc + s_ * (2 + k // 2)
            y = BRIDGE_ROWS[3] + 1 + k
            if W[y, x] and k % 3 != 2:
                cv.put(x, y, 'a5' if k < 9 else 'a4')
    TR.road(cv, [(bx1 - 6, 161), (1256 + OX, 160), (1300 + OX, 157), (1340, 156)], 9, g=1, base='d4', pebbles=.02, seed=7)
    reed_pts = [(int(east_x(y)) + 6, y) for y in range(20, 720, 9) if not (120 < y < 215) and R.random() < .55]
    TR.reeds(cv, R, reed_pts, g=1)
    # ---------------------------------------------------------------- the meadow's detail
    meadow = lambda p: cv.get(int(p[0]), int(p[1])) in pal.RAMP['g']  # noqa: E731
    TR.tufts(cv, R, TR.poisson(R, 0, 0, 1280, 720, 7, 2600, meadow), g=1)
    TR.flowers(cv, R, TR.clustered(R, [(60 + OX, 214), (24 + OX, 262), (1206, 214)], (3, 5), 7, meadow), g=1)
    TR.stones(cv, R, [(30 + OX, 286), (110 + OX, 196), (1226 + OX, 120), (1262 + OX, 262), (1250, 132)], g=1)
    # ---------------------------------------------------------------- everything that stands up
    L = SC.Layer(cv)
    places = {}
    for name, sp, (wx, fy) in (('inn', BD.inn(), INN), ('shop', BM.shop(), SHOP), ('tavern', BM.tavern(), TAVERN)):
        fx = wx + sp.points['w'] // 2
        SC.building_shadow(cv, sp, fx, fy)
        L.add(sp, fx, fy)
        x0, y0 = fx - sp.ax, fy - sp.ay
        ys, xs = np.nonzero(sp.ix != CLEAR)
        places[name] = dict(box=(int(x0 + xs.min()), int(y0 + ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)),
                            origin=(int(x0), int(y0)), chimney=sp.points.get('chimney'), wx=wx, fy=fy, spr=sp)
    L.add(br, bx0, BRIDGE_ROWS[3] + 3)
    for (tx, ty, r, sd) in ((1244 + OX, 104, 20, 3), (1248 + OX, 258, 17, 9), (1236 + OX, 46, 14, 4),
                            (556 + OX, 40, 12, 5), (962 + OX, 50, 12, 8), (32 + OX, 196, 20, 2), (112 + OX, 128, 16, 12),
                            (1206, 72, 19, 21), (1262, 214, 17, 23)):                 # the last two: the east bank
        sp = SC.town_tree(r, sd)
        L.add(sp, tx, ty, shadow=('ell', r * .7, -2, r * 1.15, r * .45))
    for sp, x, y in ((PT.stall(62, ('b5', 'x3'), ('b4', 'x2'), ('apples', 'greens'), seed=1), 198 + OX, 196),
                     (PT.stall(58, ('b5', 's3'), ('b4', 's2'), ('pots', 'cloth'), seed=2), 286 + OX, 200),
                     (PT.stall(54, ('b5', 'h3'), ('b4', 'h2'), ('bread', 'apples'), seed=3), 372 + OX, 194)):
        L.add(sp, x, y, shadow=('off', 6, 3))
    L.add(PT.well(), 340 + OX, 262, shadow=('off', 6, 3))
    for (x, y) in ((158, 212), (424, 214), (246, 214)):
        L.add(PT.crate(seed=x), x + OX, y, shadow=('off', 4, 2))
    L.add(PT.sack(), 170 + OX, 216, shadow=('off', 3, 2))
    L.add(PT.barrel(), 452 + OX, 232, shadow=('off', 4, 2))
    L.add(PT.trough(30), 642 + OX, 236, shadow=('off', 4, 2))
    L.add(PT.blades_barrel(), 726 + OX, 222, shadow=('off', 4, 2))
    L.add(PT.crate(16, 14, seed=9), 744 + OX, 216, shadow=('off', 4, 2))
    for (x, y) in ((884, 226), (980, 222), (994, 227)):
        L.add(PT.barrel(), x + OX, y, shadow=('off', 4, 2))
    L.add(PT.trestle(40), 1026 + OX, 238, shadow=('off', 4, 2))
    L.add(PT.boat(48, 18), WATER + 14, 128, shadow=None)
    for by in (112, 238):
        L.add(PT.bollard(), WATER - 9, by, shadow=('off', 3, 2))
    L.add(PT.rope_coil(), 1080 + OX, 124, shadow=None)
    for (x, y) in ((1066, 246), (1082, 240), (1072, 254)):
        L.add(PT.crate(14, 12, seed=x), x + OX, y, shadow=('off', 4, 2))
    for who, x, y, flip in (('trader', 196, 190, False), ('keeper', 290, 194, False), ('goodwife', 252, 240, False),
                            ('porter', 1082, 262, False), ('trader', 392, 252, True), ('keeper', 664, 254, True),
                            ):
        L.add(FT.figure(who), x + OX, y, shadow=('ell', 3, 0, 9, 2.5), flip=flip)
    # scene.py's second porter (1000, 256) lands in the 861-874 gutter between the card and the satchel after the
    # slide: he walks the east road instead, clear above the windows
    L.add(FT.figure('porter'), 1150, 172, shadow=('ell', 3, 0, 9, 2.5), flip=True)
    for (x, y, flip) in ((150, 250, False), (162, 256, True), (428, 258, False)):
        L.add(PT.hen(), x + OX, y, shadow=('ell', 1, 0, 4, 1.5), flip=flip)
    L.add(PT.dog(), 1044 + OX, 230, shadow=('ell', 2, 0, 8, 2), flip=True)
    L.draw()
    for i, (x, y) in enumerate(((WATER + 14, 82), (WATER + 10, 84), (WATER + 6, 86), (WATER + 2, 88), (WATER - 2, 90),
                                (WATER - 5, 92), (WATER - 8, 96), (WATER - 9, 100), (WATER - 9, 104))):
        cv.put(x, y, 'b3'); cv.put(x, y + 1, 'b1')
    for name in ('inn', 'tavern'):
        p = places[name]
        cx_, cy_ = p['chimney']
        smoke_puffs(cv, p['wx'] + cx_, (p['fy'] - p['spr'].ay) + cy_ + 3, R, n=4, lean=4, step=4)
    # ---------------------------------------------------------------- the merchant, behind his counter
    # bld_more.shop(): the opening runs x 26..108, y 156..172 of the sprite, the counter's top board is at y 168
    # He stands on the shop floor in front of the shelved potions; the shields stay in view to his right, and the
    # sword laid along the counter (bld_more: x 50..71, y 164..167) is put back in front of him.
    ox, oy = places['shop']['origin']
    open_top, counter_top = oy + 156, oy + 168
    mx = ox + 56
    behind_counter(cv, merchant(), mx, oy + 186, open_top, counter_top - 1)
    restamp(cv, places['shop']['spr'], ox, oy, 44, 72, 164, 167, ('t5', 't6', 'w4', 'w5', 'o4', 'o5'))
    info = {'shop': places['shop']['box'], 'merchant': (mx, open_top + 4), 'opening': (ox + 26, open_top, 83, 12)}
    return cv, info


if __name__ == '__main__':
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    cv, info = render()
    cv.save(os.path.join(here, 'z', 'scene.png'))
    print(info)
