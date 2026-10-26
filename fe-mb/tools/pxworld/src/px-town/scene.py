"""Riverside Market at town scale: one 1280 x 720 pixel PNG, 1 art px per screen px.

Composed for the town boards' frame: the visible band is the top ~264 px (the windows sit below it and the header
over its top-left corner). West to east: the market on trampled earth under the header, then the inn, the shop and
the tavern fronting the cobbled street, the quay, the river running north-south with the bridge square across it,
the east bank and its road. The company stands in the street outside the building whose tab is open.

    cv, info = render(active='inn'|'shop'|'tavern')
    info['box'][name] = (x, y, w, h) of each building (for the bracket cursor); info['door'][name] = (x, y)
"""
import math
import random

import numpy as np

from pxt import Canvas, Sprite, pal, IX, kk, CLEAR, nb, smoke_puffs, ground_shadow, shear_shadow
import ground as GR
import buildings as BD
import bld_more as BM
import bridge as BR
import props_town as PT
import folk_town as FT
from pxworld import terrain as TR, trees as TS

GROUND = ('g', 'd', 't', 'h')

# where everything stands (stage px)
INN = (480, 206)         # wall's west end x, wall's foot y
SHOP = (704, 200)
TAVERN = (876, 206)
KERB = 1056              # where the square's setts meet the quay's flags
WATER = 1102             # the quay's coping meets the water here
BANK = 1196              # the east bank's mean line
BRIDGE_ROWS = (140, 152, 169, 207)   # north parapet top, deck top, deck bottom, waterline
COMPANY_AT = {'inn': (552, 251), 'shop': (794, 246), 'tavern': (916, 251)}


def east_x(y):
    return GR.bank_line(y, BANK, 5, seed=11, period=160.0)


class Layer:
    """Y-sorted stamps with optional cast shadows."""

    def __init__(self, cv):
        self.cv = cv
        self.items = []

    def add(self, spr, fx, fy, shadow=None, z=0, flip=False):
        self.items.append((fy + z, fx, fy, spr, shadow, flip))

    def draw(self):
        cv = self.cv
        for (_, fx, fy, spr, sh, flip) in self.items:
            if sh is None:
                continue
            kind = sh[0]
            if kind == 'off':
                ground_shadow(cv, spr, fx, fy, sh[1], sh[2], GROUND + ('a',))
            elif kind == 'shear':
                shear_shadow(cv, spr, fx, fy, lean=sh[1], drop=sh[2], ramps=GROUND + ('a',))
            elif kind == 'ell':
                cv.shift(GR.ellipse(fx + sh[1], fy + sh[2], sh[3], sh[4]), -1, GROUND + ('a',))
        for (_, fx, fy, spr, sh, flip) in sorted(self.items, key=lambda t: (t[0], t[1])):
            cv.stamp(spr, fx, fy, flip)


def town_tree(r, seed):
    """A broadleaf at town scale: a pxworld clump crown over a proper trunk with bark and a root flare."""
    cr = TS.clumps(r, seed, 'l')
    th = int(r * .7)
    tw = max(4, int(r * .26))
    W, H = cr.w, cr.h + th
    s = Sprite(W, H, W // 2, H - 1)
    tx = W // 2 - tw // 2
    for y in range(cr.h - r // 2, H):
        flare = 1 if y >= H - 3 else 0
        for i in range(-flare, tw + flare):
            f = (i + flare) / max(1, tw + 2 * flare - 1)
            k = 'w4' if f < .3 else ('w3' if f < .7 else 'w2')
            if (y * 3 + i * 5) % 7 == 0 and 0 < i < tw - 1:
                k = 'w2'
            s.put(tx + i, y, k)
    for y in range(cr.h - r // 2, H):
        s.put(tx - 1 - (1 if y >= H - 3 else 0), y, 'w0')
        s.put(tx + tw + (1 if y >= H - 3 else 0), y, 'w0')
    s.hline(tx - 2, tx + tw + 1, H - 1, 'w0')
    s.blit(cr, 0, 0)
    return s


def building_shadow(cv, spr, fx, fy, dx=16, dy=8):
    """A building's hard shadow on the ground to its east: the silhouette swept dx east and dy south."""
    a = spr.ix != CLEAR
    x0, y0 = int(fx) - spr.ax, int(fy) - spr.ay
    m = np.zeros((cv.h, cv.w), bool)
    ys, xs = np.nonzero(a)
    for k in range(0, dx + 1):
        yy = int(round(k * dy / dx))
        sx, sy = xs + x0 + k, ys + y0 + yy
        ok = (sx >= 0) & (sx < cv.w) & (sy >= 0) & (sy < cv.h)
        m[sy[ok], sx[ok]] = True
    cv.shift((m, 0, 0), -1, GROUND)
    # the contact line: the foot of the front wall, one step darker again
    foot = np.zeros((cv.h, cv.w), bool)
    bottom = a & ~np.vstack([a[1:], np.zeros((1, a.shape[1]), bool)])
    ys, xs = np.nonzero(bottom)
    for yy, xx in zip(ys, xs):
        X, Y = xx + x0, yy + y0 + 1
        if 0 <= X < cv.w and 0 <= Y < cv.h - 1:
            foot[Y, X] = True
    cv.shift((foot, 0, 0), -1, GROUND)


def render(active='inn', seed=5, guides=False):
    R = random.Random(seed)
    cv = Canvas(1280, 720)
    TR.grass(cv, seed=4, g=1, cell=210)
    # ---------------------------------------------------------------- the ground
    # the market: trampled earth where the road comes in, under the stalls and round the well
    TR.patch(cv, 300, 262, 200, 128, seed=6, g=1, base='d4')
    west = [(int(452 + 7 * math.sin(y / 23.0) + 4 * math.sin(y / 9.0 + 1)), y) for y in range(720, 131, -6)]
    sq = GR.mask_poly(cv, [(464, 132), (KERB, 132), (KERB, 720)] + west)
    GR.cobbles(cv, sq, seed=3)
    GR.loose_setts(cv, sq, R, 40)
    quay = GR.mask_poly(cv, [(KERB, 96), (WATER, 96), (WATER, 720), (KERB, 720)])
    GR.flags(cv, quay, seed=5)
    for y in range(96, 720):                       # the kerb between square and quay
        cv.put(KERB, y, 't5'); cv.put(KERB + 1, y, 't4'); cv.put(KERB - 1, y, 't2')
    for y in range(96, 720):                       # the coping along the water's edge
        for i, k in enumerate(('t5', 't6', 't5', 't4', 't3')):
            cv.put(WATER - 5 + i, y, k)
        if y % 11 == 0:
            for i in range(5):
                cv.put(WATER - 5 + i, y, 't2')
    for x in range(KERB, WATER):                   # the quay's north end
        cv.put(x, 95, 't2'); cv.put(x, 94, 't3')
    TR.road(cv, [(-10, 246), (60, 242), (140, 236), (200, 232)], 15, g=1, base='d4', pebbles=.02, seed=2)
    GR.grass_edge_tufts(cv, sq, R, n=80)
    # ---------------------------------------------------------------- the river, its east bank, the bridge
    W = GR.river(cv, WATER, east_x, 0, 720, seed=4)
    GR.east_bank(cv, east_x, 0, 720)
    bx0, bx1 = WATER - 22, int(east_x(170)) + 26
    br, binfo = BR.bridge(bx0, bx1, WATER - 4, int(east_x(170)) + 8, *BRIDGE_ROWS)
    for y in range(BRIDGE_ROWS[3] + 1, BRIDGE_ROWS[3] + 7):      # its shadow on the water, to the south-east
        for x in range(WATER + (y - BRIDGE_ROWS[3]), int(east_x(y))):
            if W[y, x]:
                cv.ix[y, x] = pal.shift_index(cv.ix[y, x], -1)
    GR.ripples(cv, W, WATER + 4, BANK - 2, 0, 712, R, n=150,
               avoid=lambda x, y: BRIDGE_ROWS[0] - 12 < y < BRIDGE_ROWS[3] + 10)
    pc = binfo['cut']                               # the wake below the cutwater
    for k in range(1, 18):
        for s_ in (-1, 1):
            x = pc + s_ * (2 + k // 2)
            y = BRIDGE_ROWS[3] + 1 + k
            if W[y, x] and k % 3 != 2:
                cv.put(x, y, 'a5' if k < 9 else 'a4')
    TR.road(cv, [(bx1 - 6, 161), (1256, 160), (1300, 157)], 9, g=1, base='d4', pebbles=.02, seed=7)
    reed_pts = [(int(east_x(y)) + 6, y) for y in range(20, 720, 9) if not (120 < y < 215) and R.random() < .55]
    TR.reeds(cv, R, reed_pts, g=1)
    # ---------------------------------------------------------------- the meadow's detail
    meadow = lambda p: cv.get(int(p[0]), int(p[1])) in pal.RAMP['g']  # noqa: E731
    TR.tufts(cv, R, TR.poisson(R, 0, 0, 1280, 720, 7, 2600, meadow), g=1)
    TR.flowers(cv, R, TR.clustered(R, [(60, 214), (24, 262)], (3, 5), 7, meadow), g=1)
    TR.stones(cv, R, [(30, 286), (110, 196), (1226, 120), (1262, 262)], g=1)
    # ---------------------------------------------------------------- everything that stands up
    L = Layer(cv)
    places = {}
    for name, sp, (wx, fy) in (('inn', BD.inn(), INN), ('shop', BM.shop(), SHOP), ('tavern', BM.tavern(), TAVERN)):
        fx = wx + sp.points['w'] // 2
        building_shadow(cv, sp, fx, fy)
        L.add(sp, fx, fy)
        x0, y0 = fx - sp.ax, fy - sp.ay
        ys, xs = np.nonzero(sp.ix != CLEAR)
        places[name] = dict(box=(int(x0 + xs.min()), int(y0 + ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)),
                            door=(wx + sp.points['door'][0], fy), chimney=sp.points.get('chimney'), wx=wx, fy=fy, spr=sp)
    L.add(br, bx0, BRIDGE_ROWS[3] + 3)
    for (tx, ty, r, sd) in ((1244, 104, 20, 3), (1248, 258, 17, 9), (1236, 46, 14, 4),
                            (556, 40, 12, 5), (962, 50, 12, 8), (32, 196, 20, 2), (112, 128, 16, 12)):
        sp = town_tree(r, sd)
        L.add(sp, tx, ty, shadow=('ell', r * .7, -2, r * 1.15, r * .45))
    # the market under the header
    for sp, x, y in ((PT.stall(62, ('b5', 'x3'), ('b4', 'x2'), ('apples', 'greens'), seed=1), 198, 196),
                     (PT.stall(58, ('b5', 's3'), ('b4', 's2'), ('pots', 'cloth'), seed=2), 286, 200),
                     (PT.stall(54, ('b5', 'h3'), ('b4', 'h2'), ('bread', 'apples'), seed=3), 372, 194)):
        L.add(sp, x, y, shadow=('off', 6, 3))
    L.add(PT.well(), 340, 262, shadow=('off', 6, 3))
    L.add(PT.handcart(seed=4), 82, 262, shadow=('off', 6, 3))
    for (x, y) in ((158, 212), (424, 214), (246, 214)):
        L.add(PT.crate(seed=x), x, y, shadow=('off', 4, 2))
    L.add(PT.sack(), 170, 216, shadow=('off', 3, 2))
    L.add(PT.barrel(), 452, 232, shadow=('off', 4, 2))
    L.add(PT.trough(30), 642, 236, shadow=('off', 4, 2))                 # the inn's horse trough
    L.add(PT.blades_barrel(), 726, 222, shadow=('off', 4, 2))            # the shop's barrel of blades
    L.add(PT.crate(16, 14, seed=9), 744, 216, shadow=('off', 4, 2))
    for (x, y) in ((884, 226), (980, 222), (994, 227)):                  # the tavern's barrels
        L.add(PT.barrel(), x, y, shadow=('off', 4, 2))
    L.add(PT.trestle(40), 1026, 238, shadow=('off', 4, 2))
    L.add(PT.boat(48, 18), WATER + 14, 128, shadow=None)                 # the quay
    for by in (112, 238):
        L.add(PT.bollard(), WATER - 9, by, shadow=('off', 3, 2))
    L.add(PT.rope_coil(), 1080, 124, shadow=None)
    for (x, y) in ((1066, 246), (1082, 240), (1072, 254)):
        L.add(PT.crate(14, 12, seed=x), x, y, shadow=('off', 4, 2))
    # the townsfolk at their business
    for who, x, y, flip in (('trader', 196, 190, False), ('keeper', 290, 194, False), ('goodwife', 252, 240, False),
                            ('porter', 1082, 262, False), ('trader', 392, 252, True), ('keeper', 664, 254, True),
                            ('porter', 1000, 256, False)):
        L.add(FT.figure(who), x, y, shadow=('ell', 3, 0, 9, 2.5), flip=flip)
    # the company, outside the building the tab is on
    cx, cy = COMPANY_AT[active]
    for who, dx, dy in (('marcus', -24, -1), ('roy', 0, 1), ('lilina', 25, -1)):
        L.add(FT.figure(who), cx + dx, cy + dy, shadow=('ell', 3, 0, 10, 2.5))
    for (x, y, flip) in ((150, 250, False), (162, 256, True), (428, 258, False)):    # hens scratching by the road
        L.add(PT.hen(), x, y, shadow=('ell', 1, 0, 4, 1.5), flip=flip)
    L.add(PT.dog(), 1044, 230, shadow=('ell', 2, 0, 8, 2), flip=True)                    # the tavern's dog
    L.draw()
    # the boat's painter, from its bow ring to the north bollard: a slack line, two px of rope
    for i, (x, y) in enumerate(((WATER + 14, 82), (WATER + 10, 84), (WATER + 6, 86), (WATER + 2, 88), (WATER - 2, 90),
                                (WATER - 5, 92), (WATER - 8, 96), (WATER - 9, 100), (WATER - 9, 104))):
        cv.put(x, y, 'b3'); cv.put(x, y + 1, 'b1')
    for name in ('inn', 'tavern'):                  # chimney smoke
        p = places[name]
        cx_, cy_ = p['chimney']
        smoke_puffs(cv, p['wx'] + cx_, (p['fy'] - p['spr'].ay) + cy_ + 3, R, n=4, lean=4, step=4)
    info = {'box': {k: v['box'] for k, v in places.items()}, 'door': {k: v['door'] for k, v in places.items()},
            'company': COMPANY_AT[active]}
    if guides:
        for (x, y, w, h) in ((14, 14, 440, 124), (14, 276, 848, 430), (874, 276, 392, 160), (874, 448, 392, 258)):
            for i in range(w):
                cv.put(x + i, y, 'o6'); cv.put(x + i, y + h - 1, 'o6')
            for j in range(h):
                cv.put(x, y + j, 'o6'); cv.put(x + w - 1, y + j, 'o6')
    return cv, info


if __name__ == '__main__':
    import sys
    cv, info = render(sys.argv[1] if len(sys.argv) > 1 else 'inn', guides=True)
    cv.save('z/scene.png')
    print(info)
