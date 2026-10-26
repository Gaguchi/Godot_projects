"""Riverside Market at full screen: the px-town scene recomposed so the square, its three buildings and the road out
fill the view (UxTown), and the same world seen with the camera over the inn (UxInn).

Imported unchanged from dirs/px-town: every building, prop and folk figure, the ground painters, the bridge, and
scene.py's Layer, town_tree, building_shadow and east_x. Copied and changed here: render() itself.
  - The world is 1480 x 720 and each board's camera shows 1280 of it: UxTown looks at x 0..1280, UxInn at
    x PAN_INN..PAN_INN + 1280, so the inn's front sits in the middle of what its offer window leaves.
  - The town sits DY px lower than in px-town. The windows along the top lie over back lots, not roofs, and the
    square in front is deep enough to stand the company in.
  - The square is busy all the way down: a greengrocer's stall, a carter unloading, two at their gossip, folk
    crossing, hens. The road out is px-town's west road (the one the company came in on) with a fingerpost
    (new here, town scale) where it meets the market's trampled earth.
  - The back lots are new: a kitchen garden behind the inn, an orchard behind the market, a paddock rail behind
    the tavern, a hedge closing the town off from the meadow, and trees beyond.

    cv, info = render(company='square'|'inn', keeper_at_door=False)
    info['box'][name] = (x, y, w, h) in world px for 'inn', 'shop', 'tavern', 'road'; info['door'][name] = (x, y)
"""
import math
import os
import random
import sys

import numpy as np

SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
sys.path.insert(0, SP + '/dirs/px-town')
sys.path.insert(0, SP + '/dirs')

from pxt import Canvas, Sprite, pal, CLEAR, smoke_puffs, selout  # noqa: E402
import ground as GR  # noqa: E402
import buildings as BD  # noqa: E402
import bld_more as BM  # noqa: E402
import bridge as BR  # noqa: E402
import props_town as PT  # noqa: E402
import folk_town as FT  # noqa: E402
import scene as PXS  # noqa: E402  (Layer, town_tree, building_shadow, east_x: reused as they are)
from pxworld import terrain as TR, trees as TS  # noqa: E402

WW, WH = 1480, 720       # the world; each board's camera shows 1280 x 720 of it
DY = 230                 # the town sits this much lower than in px-town
PAN_INN = 159            # the UxInn camera: the inn's front centred in the 846 px its offer window leaves


def Y(y):
    return y + DY


INN = (480, Y(206))      # wall's west end x, wall's foot y
SHOP = (704, Y(200))
TAVERN = (876, Y(206))
KERB = 1056
WATER = 1102
BRIDGE_ROWS = (Y(140), Y(152), Y(169), Y(207))
COMPANY_AT = {'square': (668, 590), 'inn': (570, Y(272))}
ROAD = [(-10, Y(246)), (60, Y(242)), (140, Y(236)), (200, Y(232))]        # px-town's west road: the road out
POST = (122, Y(224))                                                     # the fingerpost, on its north verge


def east_x(y):
    return PXS.east_x(y - DY)


# ------------------------------------------------------------------ new town-scale pieces
def fingerpost():
    """A fingerpost at town scale (folk are ~42 px): a squared oak post and two arms, one pointing back up the road
    to the west, one east into the square. Lit from the upper left, inked selout. Foot anchor at the post's base."""
    s = Sprite(46, 52, 23, 50)
    for y in range(6, 50):              # the post, 4 px: lit west face, dark east face
        s.put(21, y, 'w5'); s.put(22, y, 'w4'); s.put(23, y, 'w4'); s.put(24, y, 'w2')
        if y % 9 == 4:
            s.put(23, y, 'w3')
    s.put(21, 5, 'w6'); s.put(22, 5, 'w6'); s.put(23, 5, 'w5'); s.put(24, 5, 'w4')
    for (x, y) in ((22, 31), (22, 32), (23, 40)):     # a knot and a check in the grain
        s.put(x, y, 'w3')

    def arm(y0, x0, x1, point_left):
        """A board 7 px deep: lit top edge, the face, a dark under-edge, cut to a point at one end; carved
        strokes stand for lettering (no words at this size)."""
        for x in range(x0, x1 + 1):
            d = (x - x0) if point_left else (x1 - x)
            for j in range(7):
                if d < 3 and (j < 3 - d or j > 3 + d):
                    continue
                k = 'w6' if j == 0 else ('w2' if j == 6 else ('w5' if j < 3 else 'w4'))
                s.put(x, y0 + j, k)
        for x in range(x0 + 5, x1 - 4, 3):
            s.put(x, y0 + 3, 'w2')
    arm(9, 3, 20, True)
    arm(19, 25, 42, False)
    selout(s)
    return s


def rail_fence(n_posts, span=18, post_h=18):
    """A post-and-rail fence running east-west: posts every `span` px, two rails, lit tops. Foot anchor at the
    west post's base; the sprite runs east from there."""
    W = (n_posts - 1) * span + 3
    s = Sprite(W + 2, post_h + 3, 1, post_h + 1)
    for y in (5, 12):
        for x in range(1, W + 1):
            s.put(x, y, 'w5'); s.put(x, y + 1, 'w4'); s.put(x, y + 2, 'w2')
            if x % 11 == 5:
                s.put(x, y + 1, 'w3')
    for i in range(n_posts):
        x = 1 + i * span
        for y in range(1, post_h + 1):
            s.put(x, y, 'w5'); s.put(x + 1, y, 'w4'); s.put(x + 2, y, 'w2')
        s.put(x, 0, 'w6'); s.put(x + 1, 0, 'w5'); s.put(x + 2, 0, 'w4')
    selout(s)
    return s


CABBAGE = ["..lL..", ".lLLl.", "lLlllk", ".lllk.", "..kk.."]
LEEK = [".L.", "LlL", ".l.", ".l.", ".k."]


def garden(cv, x0, y0, w, h, seed):
    """A kitchen garden: a tilled bed in rows 8 px apart (lit ridge, dark furrow), cabbages and leeks along the
    ridges, the bed's north and west lip a step dark where the grass shades it."""
    R = random.Random(seed)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            r = (y - y0) % 8
            k = 'd5' if r == 1 else ('d4' if r in (2, 3) else ('d2' if r in (6, 7) else 'd3'))
            if y == y0 or x == x0:
                k = 'd2'
            elif y == y0 + h - 1 or x == x0 + w - 1:
                k = 'd5'
            cv.put(x, y, k)
    km = {'l': 'l3', 'L': 'l5', 'k': 'l1'}
    for row in range(h // 8):
        yy = y0 + row * 8
        rows = CABBAGE if row % 2 == 0 else LEEK
        x = x0 + 3 + R.randint(0, 3)
        while x < x0 + w - 7:
            for j, rr in enumerate(rows):
                for i, ch in enumerate(rr):
                    if ch != '.':
                        cv.put(x + i, yy + j, km[ch])
            x += R.randint(9, 12) if rows is CABBAGE else R.randint(6, 8)


def tree_at(L, x, y, r, seed):
    sp = PXS.town_tree(r, seed)
    L.add(sp, x, y, shadow=('ell', r * .7, -2, r * 1.15, r * .45))


# ------------------------------------------------------------------ the world
def render(company='square', seed=5, keeper_at_door=False):
    R = random.Random(seed)
    cv = Canvas(WW, WH)
    TR.grass(cv, seed=4, g=1, cell=210)
    # ---------------------------------------------------------------- the ground
    TR.patch(cv, 300, Y(262), 200, 128, seed=6, g=1, base='d4')          # the market's trampled earth
    west = [(int(452 + 7 * math.sin(y / 23.0) + 4 * math.sin(y / 9.0 + 1)), y) for y in range(WH, Y(131), -6)]
    sq = GR.mask_poly(cv, [(464, Y(132)), (KERB, Y(132)), (KERB, WH)] + west)
    GR.cobbles(cv, sq, seed=3)
    GR.loose_setts(cv, sq, R, 40)
    quay = GR.mask_poly(cv, [(KERB, Y(96)), (WATER, Y(96)), (WATER, WH), (KERB, WH)])
    GR.flags(cv, quay, seed=5)
    for y in range(Y(96), WH):                     # the kerb between square and quay
        cv.put(KERB, y, 't5'); cv.put(KERB + 1, y, 't4'); cv.put(KERB - 1, y, 't2')
    for y in range(Y(96), WH):                     # the coping along the water's edge
        for i, k in enumerate(('t5', 't6', 't5', 't4', 't3')):
            cv.put(WATER - 5 + i, y, k)
        if y % 11 == 0:
            for i in range(5):
                cv.put(WATER - 5 + i, y, 't2')
    for x in range(KERB, WATER):                   # the quay's north end
        cv.put(x, Y(95), 't2'); cv.put(x, Y(94), 't3')
    TR.road(cv, ROAD, 15, g=1, base='d4', pebbles=.02, seed=2)            # the road out
    GR.grass_edge_tufts(cv, sq, R, n=80)
    # the back lots: the inn's kitchen garden
    garden(cv, 494, 196, 176, 41, seed=12)
    # ---------------------------------------------------------------- the river, its east bank, the bridge
    W = GR.river(cv, WATER, east_x, 0, WH, seed=4)
    GR.east_bank(cv, east_x, 0, WH)
    bx0, bx1 = WATER - 22, int(east_x(Y(170))) + 26
    br, binfo = BR.bridge(bx0, bx1, WATER - 4, int(east_x(Y(170))) + 8, *BRIDGE_ROWS)
    for y in range(BRIDGE_ROWS[3] + 1, BRIDGE_ROWS[3] + 7):      # its shadow on the water, to the south-east
        for x in range(WATER + (y - BRIDGE_ROWS[3]), int(east_x(y))):
            if W[y, x]:
                cv.ix[y, x] = pal.shift_index(cv.ix[y, x], -1)
    GR.ripples(cv, W, WATER + 4, int(east_x(360)) - 2, 0, 712, R, n=170,
               avoid=lambda x, y: BRIDGE_ROWS[0] - 12 < y < BRIDGE_ROWS[3] + 10)
    pc = binfo['cut']                               # the wake below the cutwater
    for k in range(1, 18):
        for s_ in (-1, 1):
            x = pc + s_ * (2 + k // 2)
            y = BRIDGE_ROWS[3] + 1 + k
            if W[y, x] and k % 3 != 2:
                cv.put(x, y, 'a5' if k < 9 else 'a4')
    TR.road(cv, [(bx1 - 6, Y(161)), (1256, Y(160)), (1380, Y(158)), (1500, Y(155))], 9, g=1, base='d4', pebbles=.02, seed=7)
    reed_pts = [(int(east_x(y)) + 6, y) for y in range(20, WH, 9) if not (Y(120) < y < Y(215)) and R.random() < .55]
    TR.reeds(cv, R, reed_pts, g=1)
    # ---------------------------------------------------------------- the meadow's detail
    meadow = lambda p: cv.get(int(p[0]), int(p[1])) in pal.RAMP['g']  # noqa: E731
    TR.tufts(cv, R, TR.poisson(R, 0, 0, WW, WH, 7, 3400, meadow), g=1)
    TR.flowers(cv, R, TR.clustered(R, [(60, Y(214)), (24, Y(262)), (70, 640), (330, 690), (420, 120), (600, 70),
                                       (860, 40), (1300, 520), (1350, 650), (1260, 90)], (3, 5), 7, meadow), g=1)
    TR.stones(cv, R, [(30, Y(286)), (110, Y(196)), (1226, Y(120)), (1262, Y(262)), (150, 690), (408, 708),
                      (1300, 560), (1420, 300), (380, 60), (980, 80)], g=1)
    # the woodland edge behind the town: a mass of broadleaves north of the hedge (pxworld's forest at town scale)
    WR = random.Random(31)
    wood = []
    for j, yy in enumerate(range(-14, 132, 30)):
        for xx in range(-30 + (j % 2) * 19, WW + 30, 40):
            x_ = xx + WR.randint(-7, 7)
            y_ = yy + WR.randint(-6, 6)
            if 1086 < x_ < 1224:                     # the river runs through it
                continue
            if y_ > 96 and 440 < x_ < 1060:          # leave the meadow strip behind the hedge open
                continue
            wood.append((x_, y_))
    TS.forest(cv, wood, WR, 17, 26, kind='leaf', g=1)
    hedge = (TS.hedge(cv, (440, 194), (560, 184), R, g=1, r=(7.5, 9.5), gap=12) + TS.hedge(cv, (560, 184), (690, 180), R, g=1, r=(7.5, 9.5), gap=12)
             + TS.hedge(cv, (880, 182), (1000, 186), R, g=1, r=(7.5, 9.5), gap=12) + TS.hedge(cv, (1000, 186), (1050, 196), R, g=1, r=(7.5, 9.5), gap=12))
    # ---------------------------------------------------------------- everything that stands up
    L = PXS.Layer(cv)
    places = {}
    for name, sp, (wx, fy) in (('inn', BD.inn(), INN), ('shop', BM.shop(), SHOP), ('tavern', BM.tavern(), TAVERN)):
        fx = wx + sp.points['w'] // 2
        PXS.building_shadow(cv, sp, fx, fy)
        L.add(sp, fx, fy)
        x0, y0 = fx - sp.ax, fy - sp.ay
        ys, xs = np.nonzero(sp.ix != CLEAR)
        places[name] = dict(box=(int(x0 + xs.min()), int(y0 + ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)),
                            door=(wx + sp.points['door'][0], fy), chimney=sp.points.get('chimney'), wx=wx, fy=fy, spr=sp)
    L.add(br, bx0, BRIDGE_ROWS[3] + 3)
    for (tx, ty, r, sd) in (
            # px-town's own trees, lowered with the town
            (1244, Y(104), 20, 3), (1248, Y(258), 17, 9), (1236, Y(46), 14, 4), (32, Y(196), 20, 2), (112, Y(128), 16, 12),
            # the orchard behind the market, peeping over its roof
            (722, 226, 15, 40), (760, 216, 16, 41), (800, 228, 15, 42), (842, 218, 14, 43),
            # the west belt under the header, where the woodland comes down to the market
            (40, 236, 24, 21), (118, 284, 19, 22), (22, 330, 17, 23), (210, 214, 16, 24),
            # the east bank, for the inn's camera
            (1330, 270, 22, 29), (1400, 470, 24, 30), (1310, 670, 20, 31), (1430, 150, 19, 32), (1460, 640, 17, 33),
            # the meadow south and west of the market
            (48, 650, 24, 34), (250, 712, 18, 35), (402, 676, 16, 36)):
        tree_at(L, tx, ty, r, sd)
    L.add(rail_fence(6), 906, 232, shadow=('off', 3, 2))                    # the tavern's paddock rail
    L.add(fingerpost(), *POST, shadow=('shear', .45, .2))
    # the carters' yard on the trampled earth: no stalls, so the shop-front plated 'The market' is the only market
    # in the picture (critic, round 2: the yard's stalls read as the market and lit nothing)
    L.add(PT.handcart(seed=2), 212, Y(200), shadow=('off', 6, 3))
    L.add(PT.handcart(seed=5), 352, Y(196), shadow=('off', 6, 3))
    for (x, y) in ((282, Y(194)), (296, Y(198))):
        L.add(PT.sack(), x, y, shadow=('off', 3, 2))
    L.add(PT.well(), 340, Y(262), shadow=('off', 6, 3))
    L.add(PT.handcart(seed=4), 250, Y(318), shadow=('off', 6, 3))
    for (x, y) in ((172, Y(206)), (424, Y(214)), (246, Y(214))):
        L.add(PT.crate(seed=x), x, y, shadow=('off', 4, 2))
    L.add(PT.sack(), 186, Y(212), shadow=('off', 3, 2))
    L.add(PT.barrel(), 452, Y(232), shadow=('off', 4, 2))
    L.add(PT.trough(30), 642, Y(236), shadow=('off', 4, 2))                 # the inn's horse trough
    L.add(PT.blades_barrel(), 726, Y(222), shadow=('off', 4, 2))            # the shop's barrel of blades
    L.add(PT.crate(16, 14, seed=9), 744, Y(216), shadow=('off', 4, 2))
    for (x, y) in ((884, Y(226)), (980, Y(222)), (994, Y(227))):            # the tavern's barrels
        L.add(PT.barrel(), x, y, shadow=('off', 4, 2))
    L.add(PT.trestle(40), 1026, Y(238), shadow=('off', 4, 2))
    L.add(PT.boat(48, 18), WATER + 14, Y(128), shadow=None)                 # the quay
    L.add(PT.boat(44, 16), WATER + 12, 640, shadow=None)
    for by in (Y(112), Y(238), 620):
        L.add(PT.bollard(), WATER - 9, by, shadow=('off', 3, 2))
    L.add(PT.rope_coil(), 1080, Y(124), shadow=None)
    for (x, y) in ((1066, Y(246)), (1082, Y(240)), (1072, Y(254)), (1070, 690), (1086, 684)):
        L.add(PT.crate(14, 12, seed=x), x, y, shadow=('off', 4, 2))
    # the square's south half: two carters unloading (no stall here either)
    L.add(PT.handcart(seed=4), 972, 600, shadow=('off', 6, 3))
    for (x, y) in ((998, 606), (1008, 600)):
        L.add(PT.crate(14, 12, seed=x), x, y, shadow=('off', 4, 2))
    L.add(PT.barrel(), 1024, 612, shadow=('off', 4, 2))
    L.add(PT.handcart(seed=7), 846, 690, shadow=('off', 6, 3))
    for (x, y) in ((890, 700), (902, 694)):
        L.add(PT.sack(), x, y, shadow=('off', 3, 2))
    L.add(PT.crate(seed=77), 918, 708, shadow=('off', 4, 2))
    # the townsfolk at their business
    folk = [('porter', 236, Y(204), False), ('goodwife', 252, Y(240), False),
            ('porter', 1082, Y(262), False), ('trader', 392, Y(252), True), ('porter', 1040, Y(268), False),
            ('goodwife', 782, 532, True), ('trader', 800, 534, False),            # two at their gossip
            ('porter', 872, 680, True),                                             # the carter
            ('porter', 948, 604, True),                                             # the second carter
            ('trader', 540, 668, False), ('goodwife', 742, 640, True),              # crossing the square
            ('porter', 1074, 676, False), ('trader', 40, Y(252), True)]             # on the quay; on the road in
    if keeper_at_door:
        folk.append(('keeper', 547, Y(209), False))                                 # the innkeeper on her doorstep
    else:
        folk.append(('keeper', 664, Y(254), True))
    for who, x, y, flip in folk:
        L.add(FT.figure(who), x, y, shadow=('ell', 3, 0, 9, 2.5), flip=flip)
    cx, cy = COMPANY_AT[company]                    # the company
    for who, dx, dy in (('marcus', -24, -1), ('roy', 0, 1), ('lilina', 25, -1)):
        L.add(FT.figure(who), cx + dx, cy + dy, shadow=('ell', 3, 0, 10, 2.5))
    for (x, y, flip) in ((150, Y(250), False), (162, Y(256), True), (428, Y(258), False), (602, 700, True), (618, 706, False)):
        L.add(PT.hen(), x, y, shadow=('ell', 1, 0, 4, 1.5), flip=flip)
    L.add(PT.dog(), 1044, Y(230), shadow=('ell', 2, 0, 8, 2), flip=True)
    # the hedge first (it is the farthest thing), then the layer
    TS.stamp_bushes(cv, hedge)
    L.draw()
    for (bx, by, ty) in ((WATER + 14, Y(82), Y(104)), (WATER + 12, 600, 616)):   # the boats' painters
        for i, (x, y) in enumerate(((bx, by), (bx - 4, by + 2), (bx - 8, by + 4), (bx - 12, by + 6), (bx - 16, by + 8),
                                    (bx - 19, by + 10), (bx - 22, by + 14), (bx - 23, by + 18))):
            if y <= ty:
                cv.put(x, y, 'b3'); cv.put(x, y + 1, 'b1')
    for name in ('inn', 'tavern'):                  # chimney smoke
        p = places[name]
        cx_, cy_ = p['chimney']
        smoke_puffs(cv, p['wx'] + cx_, (p['fy'] - p['spr'].ay) + cy_ + 3, R, n=6, lean=4, step=5)
    box = {k: v['box'] for k, v in places.items()}
    box['road'] = (0, POST[1] - 50, 214, 94)        # the road's end and the fingerpost, for the bracket
    info = {'box': box, 'door': {k: v['door'] for k, v in places.items()}, 'company': COMPANY_AT[company]}
    return cv, info


if __name__ == '__main__':
    cv, info = render(sys.argv[1] if len(sys.argv) > 1 else 'square')
    here = os.path.dirname(os.path.abspath(__file__))
    cv.save(os.path.join(here, 'z', 'world.png'))
    print(info)
