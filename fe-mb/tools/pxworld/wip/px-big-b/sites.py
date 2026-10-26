"""The big country's places at grain 1, drawn the pxworld way: selout in each part's own darks, lit from the upper
left, hard cast shadows one step down the ground, every prop in true scale to the 16 x 24 folk. The game's 16
places keep their kit art (as in dirs/px-open-b/world_b.py); the 45 new ones are built here from kit parts.
Nothing here edits pxworld.

    draw_places(sc, keys, road_px, bridges, fords, ctx)   every place in keys, every bridge
    scatter_mask(mask, mind, rng, reject)                 Poisson points inside a mask (pines, woods)
    OWN_GROUND, PATCH                                     which places bring their own ground, the trampled
                                                          patch each job stands on
"""
import math
import random
import zlib

import numpy as np

import bits
import land as LD
from pxworld import pal, props as PR, build as BD, trees as TS, places as PL
from pxworld.canvas import Sprite, ellipse, poly as mpoly

_put = BD._put
asc = BD._ascii
GROUND = ('g', 'd', 'h')

OWN_GROUND = {'riverside_market', 'south_junction', 'pine_crossing', 'old_mill_crossing', 'broken_bridge',
              'plank_bridge', 'toll_bridge', 'lowfield', 'willowbank', 'goose_green', 'reed_marsh', 'old_quarry',
              'brook_mill', 'standing_stones', 'old_barrow', 'gallows_hill', 'boundary_stone'}
PATCH = {'farm': (0, 0), 'croft': (0, 0), 'bees': (0, 0), 'orchard': (0, 0), 'hay': (30, 18), 'well': (24, 15),
         'kilns': (32, 20), 'fold': (0, 0), 'charcoal': (32, 20), 'woodcamp': (30, 19), 'sawpit': (28, 17),
         'lodge': (26, 16), 'trappers': (28, 18), 'fishers': (26, 16), 'drovers': (34, 20), 'cooper': (28, 17),
         'burnt': (30, 19), 'ruin': (30, 20), 'signal': (20, 13), 'beacon': (26, 16), 'tower': (0, 0),
         'shrine': (14, 9), 'cairn': (20, 13), 'ford': (0, 0)}


def _sd(k):
    return zlib.crc32(k.encode())


# ================================================================ scatter
def scatter_mask(mask, mind, rng, reject=None, density=6.0):
    """Poisson-ish points inside a full-canvas bool mask, at least mind apart (a grid keeps it fast)."""
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return []
    n = int(len(xs) / (mind * mind) * density)
    cell = mind / math.sqrt(2)
    grid = {}
    out = []
    for _ in range(n):
        j = rng.randrange(len(xs))
        p = (xs[j] + rng.random(), ys[j] + rng.random())
        gx, gy = int(p[0] / cell), int(p[1] / cell)
        bad = False
        for i in range(gx - 2, gx + 3):
            for jj in range(gy - 2, gy + 3):
                q = grid.get((i, jj))
                if q and (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < mind * mind:
                    bad = True
                    break
            if bad:
                break
        if bad or (reject and reject(p)):
            continue
        grid[(gx, gy)] = p
        out.append(p)
    return out


# ================================================================ small hand-drawn pieces (grain 1)
def skep():
    """A straw beehive on its board: coiled straw in bands, lit on the upper left."""
    return asc([".54.", "5443", "2222", "4432", "3321"], {'5': 'h5', '4': 'h4', '3': 'h3', '2': 'h1', '1': 'h1'}, ay=4)


def menhir(h=8, w=4, seed=0, lean=0):
    """A standing stone: lit west face, shaded east face, a weathered top, lichen, moss at the foot."""
    rng = random.Random(seed)
    S = Sprite(w + 6, h + 4)
    for y in range(h):
        t = y / max(1, h - 1)
        sh = int(round(lean * (1 - t)))
        ww = w if y > 0 else max(2, w - 2)
        x0 = 2 + (w - ww) // 2 + sh
        for i in range(ww):
            k = 't5' if i == 0 else ('t4' if i < ww - 1 else 't3')
            if y == 0:
                k = 't5' if i < ww - 1 else 't4'
            if i == ww - 1 and y > h * .5:
                k = 't2'
            if rng.random() < .07 and 0 < i < ww - 1:
                k = 'm4' if rng.random() < .5 else 't3'
            if y == h - 1:
                k = 'm3' if i % 2 else 'm4'
            _put(S, x0 + i, 1 + y, k)
    BD.selout(S)
    S.ax, S.ay = 2 + w // 2, h
    return S.trimmed()


def sheep(seed=0, flip=False):
    rows = [".5554.", "554443k", ".43332.", ".2..2.."]
    if seed % 2:
        rows = [".554..", "5544433", "k43332.", "..2..2."]
    s = asc(rows, {'5': 'b5', '4': 'b4', '3': 'b3', '2': 'w2', 'k': 'w1'})
    return s.flipped() if flip else s


def ox_standing(seed=0):
    """A live ox side-on, facing west: dun hide lit along its back, pale horns, dark legs."""
    rows = ["b.b.......",
            "k4k5555544",
            "k45555444433",
            ".4444443333.",
            "..3.3...3.3.",
            "..2.2...2.2."]
    W = max(len(r) for r in rows)
    rows = [r.ljust(W, '.') for r in rows]
    return asc(rows, {'5': 'd5', '4': 'd4', '3': 'd3', '2': 'w1', 'k': 'w1', 'b': 'b5'})


def boat():
    """A rowing boat drawn up on the bank, keel up: lit planks, a shaded strake under."""
    return asc(["..655555554..", ".65444444443.", "6544444444332", ".3333333332.."],
               {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2'})


def rack(goods='hide'):
    """A drying rack: two posts and a pole, hides (or split fish) hung over it."""
    if goods == 'hide':
        rows = ["5..........5", "566666666665", "4.dDd..dDd.4", "4.dDd..dDd.4", "4.dDd..dDd.4", "4..d....d..4",
                "3..........3"]
        km = {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', 'd': 'h3', 'D': 'h2'}
    else:
        rows = ["5..........5", "566666666665", "4.f.f.f.f.f4", "4.F.F.F.F.F4", "4.F.F.F.F.F4", "4..........4",
                "3..........3"]
        km = {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', 'f': 't5', 'F': 't4'}
    return asc(rows, km)


def gallows():
    """A gallows on the hill: one squared post, an arm out to the east on a brace, a frayed rope."""
    rows = ["5666666665..",
            "54.k....4...",
            "54..k...b...",
            "54...k..b...",
            "54....k.b...",
            "54......b...",
            "54..........",
            "54..........",
            "54..........",
            "54..........",
            "54..........",
            "43..........",
            "43..........",
            "43..........",
            "32..........",
            "3322........"]
    return asc(rows, {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2', 'k': 'w3', 'b': 'h2'}, ax=1, ay=15)


def barrier():
    """The toll barrier: a post and a striped pole lowered across the road's verge."""
    rows = ["5bxbxbxbxbx", "4..........", "4..........", "3..........", "32........."]
    return asc(rows, {'5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2', 'b': 'b5', 'x': 'x3'}, ax=0, ay=4)


def roadside_shrine():
    """A wayside shrine: a little gabled box on a post, a carved figure in its niche, a bowl of flowers."""
    rows = ["...6...", "..665..", ".66554.", "6655443", ".4kkk3.", ".4k5k3.", ".4kkk3.", ".43332.", "...4...",
            "...4...", "...3...", "..f3F..", "...2..."]
    return asc(rows, {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2', 'k': 'w1', 'f': 'x5', 'F': 'o5'}, ay=12)


def boundary_stone():
    rows = [".55.", "5543", "5443", "5x43", "5443", "5443", "4433", "4432", "4432", "4332", "m3m2"]
    return asc(rows, {'5': 't5', '4': 't4', '3': 't3', '2': 't2', 'm': 'm3', 'x': 't2'})


def log_stack():
    """Felled trunks stacked on their sides: the cut ends lit, rings dark in the middle."""
    rows = ["...ab.ab...", "..abcdabcd.", ".abcdabcdab", "abcdabcdabc", "cdcdcdcdcdc"]
    return asc(rows, {'a': 'h4', 'b': 'h3', 'c': 'w4', 'd': 'w3'})


def fresh_stump(seed=0):
    rows = [".454.", "45534", "32221", ".211."]
    return asc(rows, {'5': 'h4', '4': 'h3', '3': 'w4', '2': 'w3', '1': 'w2'})


def sawhorse():
    return asc(["5555555", ".4...4.", "4.3.4.3"], {'5': 'w5', '4': 'w4', '3': 'w3'})


def brick_stack():
    return asc(["5455", "4344", "3233"], {'5': 'r5', '4': 'r4', '3': 'r3', '2': 'r2'})


def plank_stack():
    return asc(["66666666", "55555554", "44444443", "33333332"], {'6': 'h5', '5': 'h4', '4': 'w5', '3': 'w4', '2': 'w3'})


def chopping_block():
    return asc([".45.", "4554", "3443", ".22."], {'5': 'h4', '4': 'w5', '3': 'w4', '2': 'w3'})


def basket():
    """The beacon's iron basket with its heap of dry wood, waiting."""
    return asc([".5.4.5.", "5454545", "k44444k", ".k3k3k.", "..kkk.."], {'5': 'w5', '4': 'w4', '3': 'w3', 'k': 't1'})


def beacon_stack():
    """Smoke Hill's signal fire, built and unlit: split logs leant into a cone round a pole."""
    rows = ["....6....", "...656...", "...545...", "..55443..", "..54433..", ".5544332.", ".5443332.",
            "554433322", "544333222"]
    return asc(rows, {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2'})


def lintel():
    """The barrow's door: two uprights and a capstone set into the mound, the dark way in."""
    rows = ["65555554", "54kkkk43", "5kkkkkk3", "4kkkkkk3", "4kkkkkk2", "43....32"]
    return asc(rows, {'6': 't6', '5': 't5', '4': 't4', '3': 't3', '2': 't2', 'k': 'k0'})


def kiln(w=15, h=10, fire=True, seed=0):
    """A brick kiln: a dome of brick courses lit from the north-west, an arched stoke-hole at its foot (glowing
    when it is firing), a vent at the crown."""
    S = Sprite(w + 4, h + 4)
    cx, base = (w + 3) / 2, h + 1
    for y in range(h):
        for x in range(w + 2):
            u, v = (x + .5 - cx) / (w / 2), (base - (y + 1) + .5) / h
            if u * u + v * v > 1:
                continue
            nz = math.sqrt(max(0, 1 - u * u - v * v))
            lit = (-u * .6 + v * .5 + nz * .6)
            t = 5 if lit > .75 else (4 if lit > .45 else (3 if lit > .15 else 2))
            if (y + 1) % 2 == 0:
                t = max(1, t - 1)                                  # the brick courses
            elif (x + (y // 2) * 2) % 4 == 3:
                t = max(1, t - 1)
            _put(S, x + 1, y + 1, f'r{t}')
    # the stoke-hole
    mx = int(cx)
    for j in range(4):
        for i in range(-2, 2):
            if j == 0 and i in (-2, 1):
                continue
            k = 'w0'
            if fire and j >= 2 and i in (-1, 0):
                k = 'o4' if j == 3 else 'x3'
            _put(S, mx + i, base - 3 + j, k)
    _put(S, mx - 1, 1, 'r1'); _put(S, mx, 1, 'r1')                 # the vent
    BD.selout(S)
    S.ax, S.ay = mx, base
    S.vent = (0, -(base - 1))
    return S.trimmed()


def clamp(w=22, h=8, seed=0):
    """A charcoal clamp: a low dome of turf over the stacked wood, earth showing through, a vent at the top."""
    rng = random.Random(seed)
    S = Sprite(w + 4, h + 4)
    cx, base = (w + 3) / 2, h + 1
    for y in range(h):
        for x in range(w + 2):
            u, v = (x + .5 - cx) / (w / 2), (base - (y + 1) + .5) / h
            if u * u + v * v > 1:
                continue
            nz = math.sqrt(max(0, 1 - u * u - v * v))
            lit = (-u * .6 + v * .5 + nz * .6)
            t = 4 if lit > .7 else (3 if lit > .35 else 2)
            ramp = 'd'
            if (x // 3 + y + seed) % 5 == 0 and y < h - 2:
                ramp = 'g'
                t = {4: 6, 3: 4, 2: 3}[t]
            _put(S, x + 1, y + 1, f'{ramp}{t}')
    _put(S, int(cx), 1, 'w0')
    BD.selout(S)
    S.ax, S.ay = int(cx), base
    return S.trimmed()


# ================================================================ helpers
def _gates(k, rx, ry, road_px, dy=3, hw=.3):
    X, Y = LD.P[k]
    return bits.gate_angles((X, Y + dy), rx, ry, [v if kk[0] == k else v[::-1] for kk, v in road_px.items() if k in kk],
                            hw=hw)


def _house(sc, x, y, ridge='ew', w=13, roof='thatch', wall='plaster', seed=0, chimney=None, back=False, d=None, h=None,
           door='auto', windows=None):
    sp = BD.cottage(w, ridge, roof, wall, d=d, h=h, chimney=chimney, seed=seed, back=back, door=door, windows=windows)
    sc.add(sp, x, y, shadow='house')
    if sp.chimney:
        cx, cy = sp.chimney
        sc.later(lambda cv, X=x, Y=y, cx=cx, cy=cy: PR.smoke(cv, int(X + cx), int(Y + cy), 1, n=8))
    return sp


def _box(sp, x, y, pad=0):
    return (x - sp.ax - pad, y - sp.ay - pad, x - sp.ax + sp.w + pad, y - sp.ay + sp.h + pad)


def _hits(sc, box, roads=True, water=True):
    x0, y0, x1, y1 = [int(v) for v in box]
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(sc.cv.w, x1), min(sc.cv.h, y1)
    if x1 <= x0 or y1 <= y0:
        return True
    if roads and sc.roads[y0:y1, x0:x1].any():
        return True
    if water and sc.water[y0:y1, x0:x1].any():
        return True
    return False


_BOXES = []


def _free(box):
    return not any(not (box[2] <= b[0] or b[2] <= box[0] or box[3] <= b[1] or b[3] <= box[1]) for b in _BOXES)


def _claim(box):
    _BOXES.append(box)


# ================================================================ the jobs
def farm(sc, k, x, y):
    i = _sd(k) % len(PL.FARM_PLANS)
    home = [(586, 432), (318, 322), (872, 650), (716, 452), (270, 448), (196, 330)][i]
    PL.lay(sc, PL.FARM_PLANS[i], x - home[0], y - home[1])


def croft(sc, k, x, y):
    cv = sc.cv
    BD.yard(cv, x - 14, y + 1, 26, 4, seed=3)
    _house(sc, x - 2, y, 'ew', 12, 'thatch', 'plaster', seed=_sd(k) % 50, chimney='e')
    BD.garden(cv, x + 12, y - 9, 10, 8, 'cabbage')
    BD.fence_ring(cv, x + 11, y - 10, x + 23, y - 1, [('w', y - 6, y - 4)])
    sc.add(BD.woodpile(), x - 14, y + 1, shadow='house')
    sc.tree(x - 22, y - 6, 8.5)


def bees(sc, k, x, y):
    cv = sc.cv
    BD.yard(cv, x - 16, y + 1, 30, 4, seed=4)
    _house(sc, x - 6, y, 'ns', 11, 'thatch', 'plaster', seed=_sd(k) % 50, chimney='w')
    BD.garden(cv, x + 6, y - 14, 14, 9, 'flowers')
    # the bee bench: a plank on two stones, five skeps on it
    for i in range(6):
        cv.put(x + 6 + i * 3, y + 4, 'w5'); cv.put(x + 7 + i * 3, y + 4, 'w4'); cv.put(x + 8 + i * 3, y + 4, 'w4')
        cv.put(x + 6 + i * 3, y + 5, 'w3'); cv.put(x + 7 + i * 3, y + 5, 'w3'); cv.put(x + 8 + i * 3, y + 5, 'w3')
    for i in range(5):
        sc.add(skep(), x + 8 + i * 4, y + 3, shadow='house')
    sc.add(TS.bush(3.6, 4, lift=1), x + 28, y - 2, shadow=('ell', 2, 1, 4, 2))


def orchard(sc, k, x, y):
    cv = sc.cv
    rng = random.Random(_sd(k))
    BD.fence_ring(cv, x - 34, y - 34, x + 26, y + 2, [('s', x - 6, x + 2)])
    for j in range(3):
        for i in range(4):
            tx, ty = x - 26 + i * 15 + (j % 2) * 4, y - 24 + j * 11
            sp = TS.tree(4.6, rng.randint(0, 999), 'l', trunk=2)
            sc.add(sp, tx, ty, shadow=('tree', 4.6))
            # the fruit: a few red pixels on the crown's lit side
            for (dx, dy) in rng.sample([(-2, -6), (1, -7), (-3, -4), (2, -5), (0, -8)], 3):
                sc.later(lambda cv, X=tx + dx, Y=ty + dy: cv.put(X, Y, 'x4') if pal.RAMP_OF[cv.get(X, Y)] == 'l' else None)
    _house(sc, x + 40, y + 2, 'ew', 13, 'tile', 'plaster', seed=_sd(k) % 50, chimney='w')
    BD.yard(cv, x + 30, y + 3, 22, 4, seed=5)
    sc.add(BD.crate(), x + 30, y + 6, shadow='house')
    sc.add(BD.crate(), x + 35, y + 7, shadow='house')


def cooper(sc, k, x, y):
    cv = sc.cv
    BD.yard(cv, x - 22, y - 2, 46, 12, seed=6)
    _house(sc, x - 6, y - 2, 'ew', 17, 'shingle', 'boards', seed=_sd(k) % 50, chimney='e')
    for (dx, dy) in ((12, 6), (17, 6), (22, 6), (14, 3), (19, 3), (-20, 8), (-16, 9)):
        sc.add(BD.R(sc, PR.barrel(1)), x + dx, y + dy, shadow='house')
    sc.add(BD.handcart(), x + 4, y + 9, shadow='house')
    sc.add(plank_stack(), x - 18, y + 1, shadow='house')


def hay(sc, k, x, y):
    cv = sc.cv
    for (dx, dy) in ((-18, -6), (-6, -10), (8, -6), (-12, 4), (2, 3)):
        sc.add(BD.R(sc, PR.haystack(1)), x + dx, y + dy, shadow='house')
    sp = BD.barn(15, 'ew', 'thatch', d=8, h=6, seed=_sd(k) % 50)
    sc.add(sp, x + 26, y + 2, shadow='house')
    sc.add(BD.handcart(), x + 14, y + 8, shadow='house')


def well(sc, k, x, y):
    sc.add(BD.well2(), x, y, shadow='house')
    sc.add(BD.trough(), x + 12, y + 4, shadow='house')
    sc.add(BD.fingerpost('ew'), x - 12, y + 6, shadow='house')
    sc.tree(x + 4, y - 14, 9)


def kilns(sc, k, x, y):
    for (dx, dy, w_, h_, fire) in ((-14, 0, 15, 10, True), (8, -6, 13, 9, False), (16, 8, 11, 8, True)):
        sp = kiln(w_, h_, fire, seed=dx)
        sc.add(sp, x + dx, y + dy, shadow='house')
        if fire:
            sc.later(lambda cv, X=x + dx, Y=y + dy - h_: PR.smoke(cv, int(X), int(Y), 1, n=11))
    for (dx, dy) in ((-26, 8), (-22, 10), (-28, 12), (2, 10)):
        sc.add(brick_stack(), x + dx, y + dy, shadow='house')
    _house(sc, x - 2, y - 14, 'ew', 11, 'tile', 'boards', seed=_sd(k) % 50, d=7, h=5)


def fold(sc, k, x, y):
    """A dry-stone sheepfold: a ring of coursed stones with a gap toward the road, the shepherd's hut, the flock."""
    cv = sc.cv
    rng = random.Random(_sd(k))
    rx, ry = 20, 12
    cxf, cyf = x + 6, y + 2
    gaps = _gates(k, rx, ry, sc.road_px, dy=2, hw=.35)
    n = int(7 * (rx + ry))
    pts = {}
    for i in range(n):
        a = 2 * math.pi * i / n
        if bits._in_gap(a, gaps):
            continue
        X = int(round(cxf + math.cos(a) * rx))
        Y = int(round(cyf + math.sin(a) * ry))
        pts[(X, Y)] = math.cos(a)
    for (X, Y), east in sorted(pts.items(), key=lambda t: t[0][1]):
        top = 't5' if east < .3 else 't4'
        cv.put(X, Y - 2, top); cv.put(X, Y - 1, 't3' if (X + Y) % 3 else 't2'); cv.put(X, Y, 't2')
        if pal.RAMP_OF[cv.get(X + 1, Y + 1)] in GROUND:
            cv.ix[Y + 1, X + 1] = pal.shift_index(cv.get(X + 1, Y + 1), -1)
    _house(sc, x - 22, y - 6, 'ns', 9, 'thatch', 'stone', seed=_sd(k) % 50, d=6, h=4)
    for i in range(6):
        sx, sy = cxf + rng.randint(-12, 12), cyf + rng.randint(-6, 7)
        sc.add(sheep(i, rng.random() < .5), sx, sy, shadow='house')


def charcoal(sc, k, x, y):
    for (dx, dy, w_, sd) in ((-12, -2, 22, 1), (12, 8, 18, 2)):
        sp = clamp(w_, 7, sd)
        sc.add(sp, x + dx, y + dy, shadow='house')
        sc.later(lambda cv, X=x + dx, Y=y + dy - 7: PR.smoke(cv, int(X), int(Y), 1, n=12))
    sc.add(BD.R(sc, PR.ridge_tent(16, 10, 'tan')), x + 18, y - 8, shadow='house')
    sc.add(log_stack(), x - 24, y + 10, shadow='house')
    sc.add(BD.woodpile(), x - 2, y + 12, shadow='house')


def woodcamp(sc, k, x, y):
    sc.add(BD.R(sc, PR.ridge_tent(18, 11, 'canvas')), x - 12, y - 4, shadow='house')
    sc.add(BD.R(sc, PR.ridge_tent(16, 10, 'tan')), x + 8, y - 10, shadow='house')
    sc.add(log_stack(), x + 18, y + 6, shadow='house')
    sc.add(log_stack(), x + 24, y + 1, shadow='house')
    sc.add(BD.fallen_oak(30, 6), x - 30, y + 14, shadow='house')
    sc.add(sawhorse(), x + 2, y + 10, shadow='house')
    for (dx, dy) in ((-26, -6), (-18, 18), (30, 14)):
        sc.add(fresh_stump(dx), x + dx, y + dy, shadow='house')
    f = BD.R(sc, PR.fire(1))
    sc.add(f, x - 2, y + 2)
    sc.later(lambda cv: PR.smoke(cv, int(x - 2), int(y + 2 - f.h), 1))


def sawpit(sc, k, x, y):
    cv = sc.cv
    # the pit: a dark trench with a lit far lip, the log across it on two trestles
    for j in range(6):
        for i in range(24):
            X, Y = x - 12 + i, y - 2 + j
            k_ = 'd1' if j > 1 else 'd2'
            if j == 0:
                k_ = 'd3'
            if i in (0, 23):
                k_ = 'd2'
            cv.put(X, Y, k_)
    for i in range(24):
        cv.put(x - 12 + i, y + 4, 'd5')
    for i in range(30):
        cv.put(x - 15 + i, y - 4, 'w5' if i % 7 else 'w4'); cv.put(x - 15 + i, y - 3, 'w4'); cv.put(x - 15 + i, y - 2, 'w3')
    for i in (-15, 14):
        cv.put(x + i, y - 5, 'h4')
    sc.add(plank_stack(), x + 18, y + 6, shadow='house')
    sc.add(plank_stack(), x + 20, y + 2, shadow='house')
    for (dx, dy) in ((-22, 8), (-30, -2), (24, -8)):
        sc.add(fresh_stump(dx), x + dx, y + dy, shadow='house')


def lodge(sc, k, x, y):
    cv = sc.cv
    BD.yard(cv, x - 18, y + 1, 34, 5, seed=7)
    _house(sc, x - 4, y, 'ew', 15, 'shingle', 'boards', seed=_sd(k) % 50, chimney='e')
    sc.add(rack('hide'), x + 20, y + 4, shadow='house')
    sc.add(BD.woodpile(), x - 18, y + 3, shadow='house')
    sc.add(chopping_block(), x - 10, y + 7, shadow='house')


def trappers(sc, k, x, y):
    sc.add(BD.R(sc, PR.ridge_tent(17, 10, 'tan')), x - 12, y - 2, shadow='house')
    sc.add(BD.R(sc, PR.ridge_tent(15, 9, 'tan')), x + 8, y - 8, shadow='house')
    sc.add(rack('hide'), x + 18, y + 8, shadow='house')
    sc.add(rack('hide'), x - 24, y + 10, shadow='house')
    f = BD.R(sc, PR.fire(1))
    sc.add(f, x + 2, y + 8)
    sc.later(lambda cv: PR.smoke(cv, int(x + 2), int(y + 8 - f.h), 1))


def fishers(sc, k, x, y):
    cv = sc.cv
    BD.yard(cv, x - 22, y - 1, 44, 5, seed=8)
    _house(sc, x - 12, y - 2, 'ns', 9, 'thatch', 'boards', seed=_sd(k) % 50, d=6, h=4)
    _house(sc, x + 6, y - 4, 'ew', 11, 'shingle', 'boards', seed=_sd(k) % 49 + 1, d=7, h=5, chimney='e')
    sc.add(rack('fish'), x + 6, y + 10, shadow='house')
    sc.add(boat(), x - 26, y + 10, shadow='house')


def drovers(sc, k, x, y):
    cv = sc.cv
    BD.fence_ring(cv, x - 4, y - 18, x + 34, y + 4, [('w', y - 10, y - 6)])
    for (dx, dy) in ((6, -8), (20, -11), (14, 0)):
        sc.add(ox_standing(dx), x + dx, y + dy, shadow='house')
    sc.add(BD.R(sc, PR.ridge_tent(17, 10, 'canvas')), x - 22, y - 6, shadow='house')
    sc.add(BD.R(sc, PR.ridge_tent(15, 9, 'tan')), x - 18, y + 10, shadow='house')
    sc.add(BD.R(sc, PR.wagon(1)), x + 2, y + 14, shadow='house')
    f = BD.R(sc, PR.fire(1))
    sc.add(f, x - 8, y + 4)
    sc.later(lambda cv: PR.smoke(cv, int(x - 8), int(y + 4 - f.h), 1))
    sc.add(BD.trough(), x + 24, y + 2, shadow='house')


def burnt(sc, k, x, y):
    cv = sc.cv
    cv.shift(ellipse(x, y - 2, 30, 17), -2, ('g', 'h', 'd'))
    a = bits.charred(BD.cottage(14, 'ew', 'thatch', 'stone', seed=_sd(k) % 40, chimney='w'))
    for jj in range(0, 7):                       # the roof has burnt through: its ridge is gone
        for ii in range(a.w):
            if (ii * 7 + jj * 3) % 5 < 3 and a.ix[jj, ii] != pal.CLEAR:
                a.ix[jj, ii] = pal.CLEAR
    BD.selout(a)
    sc.add(a, x - 8, y, shadow='house')
    b = bits.charred(BD.barn(13, 'ns', 'thatch', d=8, h=6, seed=_sd(k) % 30))
    for jj in range(0, 9):
        for ii in range(b.w):
            if (ii + jj * 2) % 4 < 2 and b.ix[jj, ii] != pal.CLEAR:
                b.ix[jj, ii] = pal.CLEAR
    BD.selout(b)
    sc.add(b, x + 16, y + 4, shadow='house')
    sc.add(bits.charred(BD.reink(BD.fallen_oak(18, 4))), x - 26, y + 10, shadow='house')
    sc.add(bits.snag(14, seed=_sd(k) % 9), x + 30, y - 6, shadow=('ell', 3, 1, 4, 1.6))
    sc.later(lambda cv: PR.smoke(cv, int(x - 6), int(y - 14), 1, n=7))


def ruin(sc, k, x, y):
    """Ruined Keep: the stump of a round tower and two broken lengths of curtain wall, rubble, a bush in a breach."""
    rng = random.Random(_sd(k))
    t = BD.stone_tower(16, 26, slits=1, door=True, seed=5)
    cut = int(t.h * .3)
    prof = [cut + int(3 * math.sin(i * 1.3) + rng.randint(-1, 2)) for i in range(t.w)]
    for i in range(t.w):
        t.ix[:max(0, prof[i]), i] = pal.CLEAR
    BD.selout(t)
    sc.add(t, x - 6, y + 2, shadow='house')
    for (dx, dy, L, hh) in ((-34, -2, 24, 8), (14, -6, 22, 6)):
        S = Sprite(L + 4, hh + 6)
        BD.coursed(S, 2, 3, L, hh, tones=(5, 4, 3), course=3, moss_row=hh - 1, seed=dx)
        for i in range(L):
            top = int(abs(math.sin(i * .5 + dx)) * 3) + (2 if i > L * .6 else 0)
            for j in range(top):
                S.ix[3 + j, 2 + i] = pal.CLEAR
        BD.selout(S)
        S.ax, S.ay = 2, 3 + hh - 1
        sc.add(S.trimmed(), x + dx, y + dy + hh, shadow='house')
    for (dx, dy, w_, h_, tl) in ((-10, 12, 4, 3, 1), (4, 14, 3, 2, 0), (20, 10, 5, 3, -1), (-24, 12, 3, 2, 0)):
        sc.add(BD.masonry(w_, h_, tl), x + dx, y + dy, shadow='house')
    sc.add(TS.bush(3.8, 2, lift=1), x + 10, y + 2, shadow=('ell', 2, 1, 4, 2))


def stones(sc, k, x, y):
    rng = random.Random(_sd(k))
    y -= 30                                     # the ring stands on its knoll north of where the roads meet
    sc.cv.shift(ellipse(x + 1, y - 2, 26, 12), 1, ('g',), fine=True)
    n = 9
    for i in range(n):
        a = 2 * math.pi * i / n + .2
        X, Y = x + math.cos(a) * 21, y - 2 + math.sin(a) * 9
        if 4.2 < a < 5.0:
            continue                                  # a fallen one
        sc.add(menhir(rng.randint(7, 10), rng.choice((3, 4, 4)), seed=i, lean=rng.choice((0, 0, -1, 1))), X, Y,
               shadow='house')
    sc.add(BD.masonry(6, 3, 1), x + 14, y + 10, shadow='house')


def marker(sc, k, x, y):
    sc.add(boundary_stone(), x, y, shadow='house')
    sc.add(BD.fingerpost('we'), x + 10, y + 2, shadow='house')


def gallows_hill(sc, k, x, y):
    sc.add(gallows(), x - 2, y, shadow='house')
    for (dx, dy) in ((-14, 4), (12, 6)):
        sc.rock(x + dx, y + dy, 3.5)


def barrow(sc, k, x, y):
    y -= 22                                     # the mound stands north of where the roads meet; its door faces them
    sc.add(lintel(), x, y + 4, shadow='house')
    for (dx, dy, r) in ((-30, 4, 3), (26, 6, 3.5)):
        sc.rock(x + dx, y + dy, r)


def quarry(sc, k, x, y):
    """Old Quarry: a pit cut back into the slope. Its north face stands in shade with the rock's beds and joints
    showing, the floor lies in the face's shadow at its foot and in sun beyond, the west wall is dark and the
    far (south and east) lips catch the light; squared blocks left on the floor, a spoil heap, a cart."""
    cv = sc.cv
    rng = random.Random(_sd(k))
    pts = [(x - 36, y - 20), (x - 6, y - 26), (x + 28, y - 22), (x + 40, y - 6), (x + 24, y + 9), (x - 8, y + 12),
           (x - 32, y + 6)]
    m, x0, y0 = mpoly(pts)
    H_, W_ = m.shape
    top = np.full(W_, -1)
    for i in range(W_):
        col = np.nonzero(m[:, i])[0]
        if len(col):
            top[i] = col[0]
    for j in range(H_):
        for i in range(W_):
            if not m[j, i]:
                continue
            X, Y = x0 + i, y0 + j
            depth = j - top[i]
            left = i - (np.nonzero(m[j])[0][0])
            if depth < 10:                                            # the north face, in its own shade
                k_ = 't2' if depth % 3 else 't1'
                if (i * 7 + (depth // 3) * 5) % 11 == 0 and depth % 3:
                    k_ = 't1'                                         # a vertical joint
                if depth == 0:
                    k_ = 't3'                                         # the lip of the cut, a little light
            elif depth < 13:
                k_ = 't3'                                             # the face's shadow on the floor
            else:
                k_ = 't4' if (i + j * 5) % 17 else 't5'
                if left < 3:
                    k_ = 't2'                                         # the west wall's shadow
            cv.put(X, Y, k_)
    for i in range(W_):                                               # the turf over the cut, and the far lip
        if top[i] >= 0:
            cv.put(x0 + i, y0 + top[i] - 1, 'd2')
            col = np.nonzero(m[:, i])[0]
            cv.put(x0 + i, y0 + col[-1] + 1, 't5')
    for j in range(H_):
        row = np.nonzero(m[j])[0]
        if len(row):
            cv.put(x0 + row[-1] + 1, y0 + j, 't5')
    for (dx, dy, w_, h_, tl) in ((-14, 4, 5, 3, 0), (-6, 6, 4, 3, 1), (6, 2, 6, 3, 0), (14, 6, 4, 2, -1)):
        sc.add(BD.masonry(w_, h_, tl), x + dx, y + dy, shadow='house')
    for (dx, dy, r) in ((50, -10, 4.5), (56, -6, 3.5), (46, -4, 3), (52, -14, 3)):
        sc.rock(x + dx, y + dy, r, seed=int(dx * 3 + dy))
    sc.add(BD.handcart(), x + 36, y + 16, shadow='house')


def signal(sc, k, x, y):
    sc.add(beacon_stack(), x + 2, y, shadow='house')
    PL.cairn(sc, x - 16, y + 4)


def beacon(sc, k, x, y):
    t = BD.stone_tower(12, 22, slits=1, door=True, seed=9)
    sc.add(t, x - 4, y + 2, shadow='house')
    sc.add(basket(), x - 4, y + 2 - t.h + 4, z=t.h + 1)
    _house(sc, x + 14, y + 8, 'ns', 9, 'shingle', 'boards', seed=_sd(k) % 50, d=6, h=4)
    sc.add(BD.woodpile(), x + 4, y + 12, shadow='house')


def tower(sc, k, x, y):
    gaps = _gates(k, 26, 15, sc.road_px, dy=5, hw=.28)
    back = bits.stake_arc_gaps(26, 15, 8, False, gaps)
    front = bits.stake_arc_gaps(26, 15, 8, True, gaps)
    sc.add(back, x, y + 5, z=-16)
    sc.add(front, x, y + 5, z=16)
    sc.cv.shift(ellipse(x + 2, y + 7, 28, 16.5), -1, GROUND, where=lambda a: ~np.isin(a, pal.RAMP['d']))
    t = BD.stone_tower(13, 26, seed=4)
    sc.add(t, x - 3, y + 3, shadow='house')
    fl = BD.R(sc, PR.flag(1, ('x3', 'b4'), h=12))
    sc.add(fl, x - 4, y + 3 - t.h + 3, z=t.h + 1)
    sc.add(BD.cottage(9, 'ew', 'shingle', 'boards', d=6, h=5, seed=6), x + 14, y + 10, shadow='house')


def shrine(sc, k, x, y):
    if k == 'wayside_shrine':
        sc.add(roadside_shrine(), x, y, shadow='house')
        sc.add(TS.bush(3.4, 6, lift=1), x + 9, y - 1, shadow=('ell', 2, 1, 4, 2))
        sc.add(TS.bush(3.0, 7, lift=0), x - 8, y + 1, shadow=('ell', 2, 1, 4, 2))
    else:
        sc.add(bits.shrine(), x, y, shadow='house')
        sc.tree(x + 16, y - 4, 9.5)
        sc.rock(x - 12, y + 3, 3)


def ford_place(sc, k, x, y):
    """A ford: the stepping stones are the road's (world_big); a finger-post stands on the near bank."""
    f = sc.fords[k]
    ax = f['across']
    if ax[0]:                                   # across a north-south river: the post on the west bank's verge
        sc.add(BD.fingerpost('we'), x - 26, y - 8, shadow='house')
    else:                                       # across the brook's westward run: on the north bank
        sc.add(BD.fingerpost('we'), x + 10, y - 16, shadow='house')
    if k == 'sheep_ford':
        rng = random.Random(4)
        for i in range(4):
            sc.add(sheep(i, i % 2 == 0), x - 26 + i * 6 + rng.randint(-1, 1), y - 18 + rng.randint(-3, 3), shadow='house')


def mill(sc, k, x, y, ctx):
    """Brook Mill: a stone-and-thatch mill on the brook's north bank, its wheel turning in the water at its east
    end; flour sacks by the door; Lowfield's road wades the brook at the mill's ford."""
    cv = sc.cv
    by = ctx['brook_y'](x + 10)
    mh = BD.cottage(18, 'ew', 'thatch', 'stone', d=9, h=7, seed=12, door=4, windows=1)
    mx, my = x - 2, int(by) - 9
    sc.add(mh, mx, my, shadow='house')
    if mh.chimney:
        cx, cy = mh.chimney
        sc.later(lambda cv: PR.smoke(cv, int(mx + cx), int(my + cy), 1, n=9))
    wh = BD.waterwheel()
    wx = mx + 14
    wl = int(by) - 2
    cut = wh.ay - 4
    for j in range(cut + 1, wh.h):
        wh.ix[j, :] = pal.CLEAR
    sc.add(wh, wx, wl + (wh.ay - cut), z=1)
    water = sc.water

    def foam(cv, wx=wx, wl=wl):
        for i in range(-7, 8):
            X = wx + i
            if water[wl + 1, X]:
                cv.put(X, wl + 1, 'a7' if i % 3 else 'a6')
            if abs(i) < 6 and i % 2 == 0 and water[wl + 2, X + 1]:
                cv.put(X + 1, wl + 2, 'a6')
    sc.later(foam)
    BD.yard(cv, mx - 14, my + 1, 18, 4, seed=5, pebbles=False)
    sc.add(BD.flour_sacks(), mx - 9, my + 4, shadow='house')


def marsh(sc, k, x, y):
    """Reed Marsh: standing pools among reed beds where Thornwood comes down to Ashfall, a plank walk across."""
    cv = sc.cv
    rng = random.Random(_sd(k))
    pools = [(x - 22, y - 4, 14, 6), (x + 6, y + 6, 16, 7), (x + 24, y - 8, 10, 5), (x - 4, y - 14, 9, 4)]
    wm = np.zeros((cv.h, cv.w), bool)
    for (px, py, rx, ry) in pools:
        m, x0, y0 = ellipse(px, py, rx, ry)
        for (dx, dy) in ((1, 1),):
            pass
        cs, ls = cv._clip(m, x0, y0)
        if cs is None:
            continue
        sub = cv.ix[cs]
        mm = m[ls]
        sub[mm] = pal.ix('a3')
        wm[cs] |= mm
    # banks: mud round the pools, the west lip of each pool in shadow, a lit east shallow
    from pxworld.canvas import nb
    rim = ~wm & (nb(wm, 1, 0) | nb(wm, -1, 0) | nb(wm, 0, 1) | nb(wm, 0, -1))
    cv.ix[rim] = pal.ix('d3')
    sh = wm & ~nb(wm, 0, -1, False)
    cv.ix[sh] = pal.ix('a1')
    lit = wm & ~nb(wm, 0, 1, False)
    cv.ix[lit] = pal.ix('a5')
    sc.water = sc.water | wm
    pts = []
    for (px, py, rx, ry) in pools:
        for i in range(10):
            a = rng.uniform(0, 2 * math.pi)
            pts.append((px + math.cos(a) * (rx + 2), py + math.sin(a) * (ry + 2) + 2))
    from pxworld import terrain as TR
    TR.reeds(cv, rng, pts, 1)
    for i in range(22):                         # the plank walk over the middle pool
        X = x - 6 + i
        cv.put(X, y + 4, 'w5' if i % 3 else 'w4'); cv.put(X, y + 5, 'w3')


def hamlet(sc, k, x, y, green=False, most=8):
    """A hamlet on its roads: cottages front every road out of it (long side or gable to the street; the houses
    south of an east-west street show their backs to it), a yard before each front door, gardens behind, a
    well or a green in the middle."""
    cv = sc.cv
    rng = random.Random(_sd(k))
    roads = [v if kk[0] == k else v[::-1] for kk, v in sc.road_px.items() if k in kk]
    if green:
        m, x0, y0 = ellipse(x, y - 2, 24, 12)
        cs, ls = cv._clip(m, x0, y0)
        sub = cv.ix[cs]
        from pxworld.canvas import nb
        mm = m[ls]
        sub[mm] = pal.ix('g7')
        sub[mm & (~nb(mm, 0, -1, False) | ~nb(mm, -1, 0, False))] = pal.ix('g5')
        sub[mm & ~nb(mm, 0, 1, False)] = pal.ix('g8')
        for i in range(7):                                    # geese on the green
            gx, gy = x + rng.randint(-16, 14), y - 2 + rng.randint(-6, 5)
            cv.put(gx, gy, 'b5'); cv.put(gx + 1, gy, 'b5'); cv.put(gx + 1, gy - 1, 'b5'); cv.put(gx + 2, gy - 1, 'o4')
            cv.put(gx, gy + 1, 'b3'); cv.put(gx + 1, gy + 1, 'b3')
        _claim((x - 26, y - 16, x + 26, y + 12))
    else:
        BD.yard(cv, x - 10, y - 5, 20, 10, seed=9)
        sc.add(BD.well2(), x + 1, y + 2, shadow='house')
        _claim((x - 8, y - 12, x + 8, y + 4))
    roofs = ['thatch', 'tile', 'tile2', 'thatch', 'slate', 'tile']
    walls = ['plaster', 'plaster', 'timber', 'plaster', 'stone']
    slots = []
    for ri, pts in enumerate(roads):
        acc, prev = 0.0, pts[0]
        marks = list(range(22, 104, 13))
        for p in pts[1:]:
            seg = math.dist(prev, p)
            while marks and acc + seg >= marks[0]:
                s_ = marks.pop(0)
                slots.append((s_, ri, p, (p[0] - prev[0], p[1] - prev[1])))
            acc += seg
            prev = p
    slots.sort(key=lambda t: (t[0], t[1]))
    placed = 0
    for (s_, ri, (px, py), (tx, ty)) in slots:
        if placed >= most:
            break
        tl = math.hypot(tx, ty) or 1
        tx, ty = tx / tl, ty / tl
        for side in ((1, -1) if (ri + s_ // 13) % 2 else (-1, 1)):
            if placed >= most:
                break
            nx, ny = -ty * side, tx * side
            ew = abs(tx) >= abs(ty) * .8
            roof, wall = rng.choice(roofs), rng.choice(walls)
            chim = rng.choice(('w', 'e', None))
            if ew:
                north = ny < 0
                w_ = rng.choice((11, 12, 13, 14, 15))
                sp = BD.cottage(w_, 'ew', roof, wall, chimney=chim, seed=rng.randint(0, 99), back=not north)
            else:
                w_ = rng.choice((9, 11))
                sp = BD.cottage(w_, 'ns', roof, wall, chimney=chim, seed=rng.randint(0, 99))
            ok = None
            for off in range(0, 16, 2):                           # step off the street until the house is clear
                if ew:
                    fx = px + nx * (4 + off)
                    fy = py - 7 - off if north else py + 7 + sp.ay + off
                else:
                    fx = px + (1 if nx > 0 else -1) * (6 + sp.w / 2 + off)
                    fy = py + 8
                fx, fy = int(round(fx)), int(round(fy))
                box = _box(sp, fx, fy, 0)
                if not _hits(sc, box):
                    ok = box
                    break
            if ok is None or not _free((ok[0] - 2, ok[1] - 1, ok[2] + 2, ok[3] + 1)):
                continue
            box = ok
            _claim(box)
            sc.add(sp, fx, fy, shadow='house')
            if sp.chimney:
                cx, cy = sp.chimney
                sc.later(lambda cv, X=fx, Y=fy, cx=cx, cy=cy: PR.smoke(cv, int(X + cx), int(Y + cy), 1, n=8))
            placed += 1
            if ew and north:                                      # the yard before the door
                BD.yard(cv, int(box[0]) + 2, fy + 1, max(4, int(box[2] - box[0]) - 4), 2, seed=fx, pebbles=False)
                if rng.random() < .45:                            # a kitchen garden behind
                    gx, gy = int(box[0]) + 1, int(box[1]) - 9
                    gbox = (gx, gy, gx + 11, gy + 8)
                    if _free(gbox) and not _hits(sc, gbox):
                        BD.garden(cv, gx, gy, 11, 7, rng.choice(('greens', 'cabbage', 'beans')))
                        _claim(gbox)
    return placed


def toll(sc, k, x, y, br):
    """Toll Bridge's toll house on the west bank by the bridge head, its barrier across the verge."""
    wx, wy = br['west']
    _house(sc, wx - 26, wy - 7, 'ns', 11, 'slate', 'stone', seed=21, chimney='w')
    sc.add(barrier(), wx - 14, wy + 9, shadow='house')


# ================================================================ bridges
def timber_bridge(sc, br):
    cv = sc.cv
    water = sc.water
    L, x0, y = br['L'], br['x0'], br['y']
    b = BD.timber_bridge(L, deck=5, piers=(L // 2 - 2,) if L > 34 else (), abut=(5, 5), pier_h=3, seed=L)
    m = np.ones((4, L), bool)
    BD.water_shade(cv, water, m, x0, y + 1, -2)
    m2 = np.ones((2, L), bool)
    BD.water_shade(cv, water, m2, x0 + 2, y + 5, -1)
    sc.add(b, x0, y, z=-2)


def stone_bridge(sc, br):
    cv = sc.cv
    water = sc.water
    L, x0, y = br['L'], br['x0'], br['y']
    s = BD.stone_bridge(L, 0, deck=4, face=6, arches=[(9, 19, 3), (21, 31, 3), (33, 43, 3)], abut=(8, 7), seed=6)
    for c in range(L):
        yw = y + 7
        for j in range(2):
            X, Y = x0 + c + 1, yw + j
            if 0 <= Y < cv.h and 0 <= X < cv.w and water[Y, X]:
                cv.ix[Y, X] = pal.shift_index(cv.get(X, Y), -1)
    sc.add(s, x0, y, z=-3)


# ================================================================ the whole set
def draw_places(sc, keys, road_px, bridges, fords, ctx):
    _BOXES.clear()
    sc.fords = fords
    P = LD.P
    for name, br in bridges.items():
        if br['kind'] == 'timber':
            timber_bridge(sc, br)
        elif br['kind'] == 'stone':
            stone_bridge(sc, br)
    for k in keys:
        X, Y = P[k]
        X, Y = int(round(X)), int(round(Y))
        job = LD.JOB.get(k)
        if k == 'frontier_camp':
            bits.camp4(sc, X, Y, _gates(k, 40, 25, road_px))
        elif k == 'traders_rest':
            PL.camp(sc, X, Y, 'traders')
        elif k == 'rodericks_camp':
            PL.camp(sc, X, Y, 'roderick')
        elif k == 'riverside_market':
            PL.market(sc, X, Y)
            _claim((X - 64, Y - 30, X + 68, Y + 40))
        elif k == 'south_junction':
            PL.south_junction(sc, X, Y)
            _claim((X - 26, Y - 44, X + 58, Y + 28))
        elif k == 'pine_crossing':
            PL.pine_crossing(sc, X, Y)
            _claim((X - 34, Y - 32, X + 46, Y + 30))
        elif k == 'watchtower_ridge':
            bits.watchtower(sc, X, Y, _gates(k, 26, 15, road_px, dy=5, hw=.28))
        elif k == 'border_fortress':
            PL.fortress(sc, X, Y)
        elif k == 'smugglers_cave':
            PL.cave(sc, X, Y)
        elif k == 'bandit_hideout':
            PL.hideout(sc, X, Y)
        elif k == 'south_road_ambush':
            PL.wreck(sc, X, Y)
        elif k == 'old_mill_crossing':
            PL.mill(sc, X, Y, ctx['river_x'](Y - 5))
        elif k == 'broken_bridge':
            bits.broken_bridge(sc, ctx['river_x'](Y), Y)
        elif k == 'north_ridge_path':
            PL.cairn(sc, X, Y)
        elif k == 'borderland_shrine':
            sc.add(bits.shrine(), X, Y, shadow='house')
            sc.tree(X + 16, Y - 4, 9.5)
        elif job == 'farm':
            farm(sc, k, X, Y)
        elif job in ('hamlet',):
            hamlet(sc, k, X, Y, green=(k == 'goose_green'))
        elif job == 'mill':
            mill(sc, k, X, Y, ctx)
        elif job == 'ford':
            ford_place(sc, k, X, Y)
        elif job == 'bridge':
            if k == 'toll_bridge':
                toll(sc, k, X, Y, bridges['toll_bridge'])
            else:
                br = bridges[k]
                sc.add(BD.fingerpost('we'), br['west'][0] - 14, br['west'][1] - 8, shadow='house')
        elif job == 'gallows':
            gallows_hill(sc, k, X, Y)
        elif job == 'cairn':
            PL.cairn(sc, X, Y)
        else:
            fn = globals().get(job)
            if fn is None:
                raise KeyError(f'no art for {k} ({job})')
            fn(sc, k, X, Y)


def roadside(sc, x, y, tx, ty, n=2, seed=0):
    """Two or three cottages fronting an east-west stretch of road between the places, their yards on the road,
    a garden behind one of them."""
    cv = sc.cv
    rng = random.Random(seed)
    roofs = ['thatch', 'tile', 'tile2', 'thatch', 'slate']
    walls = ['plaster', 'plaster', 'timber', 'stone']
    placed = 0
    for s_ in (-22, 2, 26)[:n]:
        px, py = x + tx * s_, y + ty * s_
        w_ = rng.choice((11, 12, 13, 14))
        sp = BD.cottage(w_, 'ew', rng.choice(roofs), rng.choice(walls), chimney=rng.choice(('w', 'e', None)),
                        seed=rng.randint(0, 99))
        box = None
        for off in range(0, 14, 2):
            fx, fy = int(round(px)), int(round(py - 7 - off))
            b_ = _box(sp, fx, fy, 0)
            if not _hits(sc, b_):
                box = b_
                break
        if box is None or not _free((box[0] - 2, box[1] - 1, box[2] + 2, box[3] + 1)):
            continue
        _claim(box)
        sc.add(sp, fx, fy, shadow='house')
        if sp.chimney:
            cx, cy = sp.chimney
            sc.later(lambda cv, X=fx, Y=fy, cx=cx, cy=cy: PR.smoke(cv, int(X + cx), int(Y + cy), 1, n=8))
        BD.yard(cv, int(box[0]) + 2, fy + 1, max(4, int(box[2] - box[0]) - 4), 2, seed=fx, pebbles=False)
        if placed == 0 and rng.random() < .6:
            gx, gy = int(box[0]) + 1, int(box[1]) - 9
            gbox = (gx, gy, gx + 11, gy + 8)
            if _free(gbox) and not _hits(sc, gbox):
                BD.garden(cv, gx, gy, 11, 7, rng.choice(('greens', 'cabbage', 'beans')))
                _claim(gbox)
        placed += 1
    return placed
