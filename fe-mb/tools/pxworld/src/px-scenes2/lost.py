"""The end of the road: a clearing off the Thornwood road, by day, at the board sprites' own scale (1 art px = 1 screen
px, a person about 140 px tall, a metre about 80 px).

What is in it: the pines of the Thornwood along the top and the east; the road across the clearing; a fresh grave in
the grass south of the road, the Foundling's sword planted at its head and the company's standard beside it, Oak's
spade left standing in the turned earth; north of the road the wagon, unhitched and left where they last camped, and
the ring of that camp's fire gone cold; and Oak, a little way on along the road, facing east, alone.

Quiet, not grim: full daylight from the north-west, the grass a little cooler and with fewer flowers than the camp's,
hard one-step shadows, nothing darkened for mood. Materials: Grass, Dirt, Pine and Walnut for the world, the wagon's
cover in Bone, iron in Vault, the stones in Stone. Everything outlined in its own darkest step."""
import math
import random

import numpy as np
from scipy import ndimage

import pxs
from pxs import pal, ix, CLEAR, nb, new, put, get, kk, W, H, shift_where
import cpx
import ground as GR

ROAD = cpx.catmull([(-40, 532), (300, 510), (578, 494), (800, 476), (1000, 454), (1180, 428), (1330, 404)], 10)
ROAD_HW = 31
GRAVE = (792, 604)              # middle of the mound's foot (its south edge)
WAGON = (1012, 404)             # middle of the wagon's ground line (under the wheels)
FIRE = (846, 424)
OAK = (1212, 424)


# ------------------------------------------------------------------ the ground
def build_ground(seed=13):
    rng = random.Random(seed)
    a = GR.meadow(W, H, seed)
    a[a == ix('g5')] = ix('g4')                       # a cooler meadow than the camp's: every patch a half-step down
    a[a == ix('g6')] = ix('g5')
    a[cpx.clean(cpx.smooth_noise(W, H, 120, seed + 5) > .5, 7)] = ix('g6')
    GR.serrate(a, [ix('g4'), ix('g5'), ix('g6')], seed)
    xx, yy = cpx.grid(W, H)
    d, along = cpx.seg_dist(xx, yy, ROAD)
    hw = ROAD_HW + cpx.wobble(seed + 1, 170)(along) * 4
    f_road = GR.ragged((hw - d) / hw, seed + 3, W, H, amp=(.06, .045, .035), cells=(44, 15, 6))
    road = GR.drop_small(cpx.clean(f_road > 0, 3), 40)
    # trampled patches: round the grave where the earth was dug and thrown, and the last camp by the wagon
    gx, gy = GRAVE
    f1 = 1 - (((xx - gx) / 132) ** 2 + ((yy - gy + 26) / 54) ** 2)
    f2 = 1 - (((xx - 930) / 150) ** 2 + ((yy - 412) / 40) ** 2)
    tr = GR.ragged(np.maximum(f1, f2), seed + 9, W, H, amp=(.2, .12, .07), cells=(52, 19, 7)) > .25
    tr = GR.drop_small(cpx.clean(tr, 3), 30)
    dirt = road | tr
    GR.paint_dirt(a, dirt, 'd4', seed)
    # ruts down the road, a groove shadowed on its north lip and lit on its south
    sd = d * _side(xx, yy, ROAD)
    for k, off in enumerate((-12, 11)):
        c = off + cpx.wobble(seed + 20 + k, 90)(along) * 2
        wdt = 2.4 + cpx.wobble(seed + 30 + k, 55)(along) * 1.0
        rut = road & (np.abs(sd - c) < wdt) & (f_road > .12)
        rut = GR.drop_small(cpx.clean(rut, 3), 20)
        a[rut] = ix('d3')
        a[rut & ~nb(rut, 0, -1, False)] = ix('d2')
        a[~rut & nb(rut, 0, -1, False) & road] = ix('d5')
    GR.dirt_texture(a, road & ~np.isin(a, [ix('d2'), ix('d3')]), rng, 1.0)
    GR.dirt_texture(a, tr & ~road, rng, 1.2)
    GR.grass_over_dirt(a, dirt, seed)
    dist_in = ndimage.distance_transform_edt(dirt)
    near = (dist_in > 2) & (dist_in < 20)
    pts = [p for p in cpx.poisson(rng, 0, 0, W, H, 9, 12000) if near[int(p[1]), int(p[0])]
           and rng.random() < .6 - dist_in[int(p[1]), int(p[0])] / 40]
    GR.tufts(a, rng, pts, .75, dirt=True)
    on = dist_in > 4
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 26, 5000):
        if on[int(y), int(x)] and y < H - 6 and x < W - 6:
            r_ = rng.random()
            if r_ < .5:
                GR.pebble(a, int(x), int(y), rng, big=r_ < .12, ramp='t' if r_ < .35 else 'd', base=0 if r_ < .35 else 1)
            elif r_ < .62:
                GR.twig(a, x, y, rng)
    meadow = ~dirt
    dist_out = ndimage.distance_transform_edt(~dirt)
    dens = cpx.smooth_noise(W, H, 70, seed + 77)
    pts = [p for p in cpx.poisson(rng, 0, 0, W, H, 9, 30000) if meadow[int(p[1]), int(p[0])]
           and rng.random() < .2 + .7 * max(0, dens[int(p[1]), int(p[0])])]
    GR.tufts(a, rng, pts, 1.0)
    pts = [p for p in cpx.poisson(rng, 0, 0, W, H, 6, 60000) if meadow[int(p[1]), int(p[0])]
           and rng.random() < .3 + .5 * max(0, dens[int(p[1]), int(p[0])])]
    GR.blade_marks(a, rng, pts)
    edge = meadow & (dist_out < 10) & (dist_out > 1)
    GR.tufts(a, rng, [p for p in cpx.poisson(rng, 0, 0, W, H, 7, 14000) if edge[int(p[1]), int(p[0])]], 1.15)
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 44, 3000):
        if meadow[int(y), int(x)] and dist_out[int(y), int(x)] > 3 and (dist_out[int(y), int(x)] < 16 or dens[int(y), int(x)] > .35):
            if y < H - 2:
                GR.clump(a, rng, int(x), int(y), rng.choice((12, 14, 16, 20)), rng.choice((9, 11, 13)))
    cen = [p for p in cpx.poisson(rng, 0, 0, W, H, 90, 600) if meadow[int(p[1]), int(p[0])] and dist_out[int(p[1]), int(p[0])] > 12]
    GR.flowers(a, rng, cen[:26], kinds=('bone', 'bone', 'sky', 'straw'))
    # under the canopy the meadow gives way to the wood's floor: shade two steps down, needle litter in drawn strokes
    edge_y = 214 + 16 * cpx.wobble(seed + 60, 140)(xx[0]) + 6 * np.sin(xx[0] / 37)
    wood = yy < edge_y[None, :]
    wood |= (xx > 1150) & (yy < 360 + (xx - 1150) * .4)
    wood = cpx.clean(wood, 5)
    sel = wood & np.isin(a, cpx.ids(('g',)))
    a[sel] = cpx.lut(-2, True)[a[sel]]
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 7, 30000):
        x, y = int(x), int(y)
        if not wood[y, x] or y >= H - 2 or x >= W - 4:
            continue
        L_ = rng.choice((2, 3, 3, 4))
        sl = rng.choice((-1, 1))
        for i in range(L_):
            X, Y = x + i, y + (i * sl) // 2
            if 0 <= Y < H and wood[Y, X]:
                a[Y, X] = ix('d3' if i < L_ - 1 else 'd2')
    return a, dict(road=road, dirt=dirt, trampled=tr, wood=wood)


def _side(xx, yy, pts):
    best = np.full(xx.shape, 1e9)
    side = np.zeros(xx.shape)
    for i in range(len(pts) - 1):
        ax, ay = pts[i]; bx, by = pts[i + 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9
        t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / L2, 0, 1)
        dd = np.hypot(xx - (ax + t * dx), yy - (ay + t * dy))
        m = dd < best
        best[m] = dd[m]
        side[m] = np.sign(dx * (yy - ay) - dy * (xx - ax))[m]
    return side


# ------------------------------------------------------------------ the Thornwood's pines
def pine_big(h=380, w=200, seed=0, trunk_vis=.2):
    """A pine at the people's scale, in tiers of drooping boughs: each tier's upper face lit on its west side, its
    underside and its east side in shade, its lower edge a fringe of hanging needle tufts; each tier's skirt shades
    the top of the tier below it; needle strokes drawn on every tier; a fissured trunk under the lowest boughs with
    its roots flaring. Pine ramp, outlined in its own darkest step. Foot = the trunk's base."""
    rng = random.Random(seed)
    W_, H_ = int(w + 24), int(h + 12)
    s = new(W_, H_, W_ // 2, H_ - 5)
    cx, base = W_ / 2, H_ - 5
    crown_bot = base - int(h * trunk_vis)
    crown_top = base - h
    n = max(6, int((crown_bot - crown_top) / 30))
    span = crown_bot - crown_top
    tiers = []
    for k in range(n):
        f = (k + 1) / n
        yb = crown_top + span * f + rng.uniform(-3, 3)
        hw = (w / 2) * (.16 + .84 * f ** .9) * rng.uniform(.9, 1.06)
        th = span / n * 1.9
        tiers.append((yb, hw, th, rng.uniform(0, 6.3), rng.uniform(-.06, .06)))
    yy, xx = np.mgrid[0:H_, 0:W_].astype(float) + .5
    tone = np.full((H_, W_), CLEAR, np.uint8)
    P = [ix(kk('p', i)) for i in range(6)]
    # the trunk first, so the boughs hang over it
    tw = max(10, int(w * .085))
    for y in range(int(crown_bot - span * .5), int(base) + 1):
        flare = 0
        if y > base - 10:
            flare = int((y - (base - 10)) * .9)
        x0, x1 = int(cx - tw / 2 - flare), int(cx + tw / 2 + flare)
        for x in range(x0, x1 + 1):
            q = (x - x0) / max(1, x1 - x0)
            key = 'w4' if q < .3 else ('w3' if q < .7 else 'w2')
            if (x * 7 + y // 9 * 3) % 11 == 0 and .15 < q < .85:
                key = 'w2' if q > .4 else 'w3'                   # bark fissures, running down the trunk
            if (x + y // 13) % 5 == 0 and .2 < q < .8:
                key = 'w1'
            tone[y, x] = ix(key)
    for k in range(n - 1, -1, -1):
        yb, hw, th, ph, lean = tiers[k]
        yt = yb - th
        u = (xx - cx) / hw
        au = np.abs(u)
        top_e = yt + (yb - yt) * au ** .8
        teeth = 3.2 * np.abs(np.sin(xx * .55 + ph)) + 1.5 * np.abs(np.sin(xx * 1.3 + ph * 2))
        bot_e = yb - th * .34 * np.clip(1 - au, 0, 1) ** 1.6 + teeth * (.5 + .5 * au) - 2
        m = (au <= 1) & (yy >= top_e) & (yy <= bot_e)
        v_ = (yy - top_e) / np.maximum(1, bot_e - top_e)
        L = -.75 * u - .9 * (v_ - .35)
        q = np.select([L > .75, L > .3, L > -.15, L > -.6], [5, 4, 3, 2], 1)
        q[(bot_e - yy) < 2.5] = np.minimum(q[(bot_e - yy) < 2.5], 2)
        q[(bot_e - yy) < 1.2] = 1
        # the tier above's skirt shades this tier's top
        prev = tone != CLEAR
        tone[m] = np.array(P, np.uint8)[q][m]
        if k < n - 1:
            pass
    # skirts: under each tier's lower edge, the tier below sits in its shade for a few rows
    for k in range(n - 1):
        yb, hw, th, ph, lean = tiers[k]
        u = (xx - cx) / hw
        au = np.abs(u)
        teeth = 3.2 * np.abs(np.sin(xx * .55 + ph)) + 1.5 * np.abs(np.sin(xx * 1.3 + ph * 2))
        bot_e = yb - th * .34 * np.clip(1 - au, 0, 1) ** 1.6 + teeth * (.5 + .5 * au) - 2
        sk = (au <= 1) & (yy > bot_e) & (yy <= bot_e + 5) & np.isin(tone, P)
        tone[sk] = cpx.lut(-1)[tone[sk]]
    s.ix[:] = tone
    # needle strokes: short drooping strokes a step lighter on the lit side, a step darker in the shade
    for (x, y) in cpx.poisson(rng, 0, 0, W_, H_, 5, 4000):
        x, y = int(x), int(y)
        if not (0 <= y < H_ - 4 and 0 <= x < W_) or s.ix[y, x] not in P:
            continue
        lv = P.index(int(s.ix[y, x]))
        d_ = 1 if lv >= 3 else -1
        for j in range(rng.choice((2, 3, 3, 4))):
            Y = y + j
            X = x + (1 if j == 3 else 0)
            if Y < H_ and s.ix[Y, X] in P:
                s.ix[Y, X] = P[max(0, min(5, P.index(int(s.ix[Y, X])) + d_))]
    cpx.selout(s)
    return s


# ------------------------------------------------------------------ the grave
def grave_mound(L=192, D=66, Hm=36, seed=3):
    """A fresh grave as a heightfield seen in the 3/4 view: every point of the mound z px high draws z px up, rows laid
    from the far (north) side forward, each pixel toned by its own facing to the north-west light (the crown and the
    west end lit, the south flank in the middle step, the foot dark where it sits in the grass). Clods with lit caps,
    turned-up stones and four cut sods laid back along the crown, all drawn as shapes. Foot = middle of its south edge.
    The sprite carries .head = (dx, dy) of the top of its west end from the foot, for the marker."""
    rng = random.Random(seed)
    W_, H_ = L + 14, D + Hm + 14
    s = new(W_, H_, W_ // 2, H_ - 6)
    cx, cy = W_ / 2, H_ - 6 - D / 2
    gy, gx = np.mgrid[0:H_, 0:W_].astype(float) + .5
    p = 2.4

    def zf(x, y):
        dx, dy = (x - cx) / (L / 2), (y - cy) / (D / 2)
        r = (np.abs(dx) ** p + np.abs(dy) ** p) ** (1 / p)
        return Hm * np.clip(1 - r ** 2, 0, None) ** 1.1 * (1 + .05 * np.sin(x * .09 + 1))

    Z = zf(gx, gy)
    foot = Z > 0
    dzdx = (zf(gx + 1, gy) - zf(gx - 1, gy)) / 2
    dzdy = (zf(gx, gy + 1) - zf(gx, gy - 1)) / 2
    nrm = np.stack([-dzdx, -dzdy, np.ones_like(Z)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    # the house rule for objects: the top faces lightest, the side faces the middle step, the contact darkest;
    # the light is the same north-west sun, so the west end is a touch brighter than the east
    Lv = np.array([-.32, -.12, 1.0])
    Lv /= np.linalg.norm(Lv)
    b = nrm @ Lv
    q = np.select([b > .9, b > .72, b > .4, b > .22], [6, 5, 4, 3], 2)
    keys = np.array([ix(kk('d', i)) for i in range(7)], np.uint8)
    out = np.full((H_, W_), CLEAR, np.uint8)
    for x in range(W_):
        col = np.nonzero(foot[:, x])[0]
        top = None
        for y in col[::-1]:                                  # a horizon per column: from the near (south) edge back,
            sy = int(round(y - Z[y, x]))                     # a point shows only where it rises above all nearer ones
            k_ = keys[q[y, x]]
            if top is None:
                if 0 <= sy < H_:
                    out[sy, x] = k_
                top = sy
            elif sy < top:
                out[max(0, sy):top, x] = k_                  # and it fills every row up to where it shows
                top = sy
    m = out != CLEAR
    out[m & ~nb(m, 0, 1)] = ix('d2')                         # where it sits in the grass
    out[m & ~nb(m, 0, 2) & nb(m, 0, 1)] = ix('d3')
    s.ix[:] = out
    # clods: lit caps over shaded feet
    CL = [[".6.", "654", ".3."], [".66.", "6554", ".33."], ["65", "43"], ["..6.", ".654", "6543", ".33."]]
    for (x, y) in cpx.poisson(rng, 0, 0, W_, H_, 8, 1200):
        x, y = int(x), int(y)
        sh = rng.choice(CL)
        if y + len(sh) + 2 >= H_ or x + 4 >= W_:
            continue
        if not all(m[y + j, x + i] and m[y + j + 2, x + i] for j in range(len(sh)) for i in range(len(sh[0])) if sh[j][i] != '.'):
            continue
        for j, row in enumerate(sh):
            for i, ch in enumerate(row):
                if ch != '.':
                    lv = pal.LEVEL[s.ix[y + j, x + i]]
                    s.ix[y + j, x + i] = ix(kk('d', max(2, min(6, lv + {'6': 1, '5': 1, '4': 0, '3': -1}[ch]))))
    for (x, y) in cpx.poisson(rng, 0, 0, W_, H_, 24, 300):
        x, y = int(x), int(y)
        if y + 4 < H_ and x + 4 < W_ and m[y, x] and m[y + 3, x + 3] and rng.random() < .55:
            for (i, j, kk_) in ((1, 0, 't5'), (2, 0, 't5'), (0, 1, 't5'), (1, 1, 't4'), (2, 1, 't4'), (3, 1, 't3'),
                                (1, 2, 't3'), (2, 2, 't2'), (3, 2, 't2')):
                s.ix[y + j, x + i] = ix(kk_)
    # cut sods laid back along the crown
    for i in range(4):
        x0 = int(cx - L * .36 + i * L * .19 + rng.randint(-3, 3))
        colt = np.nonzero(s.ix[:, x0 + 10] != CLEAR)[0]
        y0 = (int(colt[0]) if len(colt) else int(cy - Hm)) + 7 + rng.randint(0, 3)
        w_ = rng.randint(18, 24)
        for jj in range(8):
            for ii in range(w_):
                X, Y = x0 + ii, y0 + jj
                if not (0 <= X < W_ and 0 <= Y < H_) or not m[Y, X]:
                    continue
                if jj < 5:
                    key = 'g6' if (ii < w_ * .45 and jj < 2) else ('g5' if jj < 3 else 'g4')
                    if (ii * 3 + jj * 2) % 7 == 0 and jj > 0:
                        key = 'g3'
                elif jj < 7:
                    key = 'd2'
                else:
                    key = 'd1'
                s.ix[Y, X] = ix(key)
        for ii in range(1, w_ - 1, 3):
            X, Y = x0 + ii, y0
            if 0 <= X < W_ and 0 <= Y < H_ and m[Y, X]:
                s.ix[Y, X] = ix('g7')
    cpx.selout(s)
    hx = int(cx - L * .42)
    col = np.nonzero(s.ix[:, hx] != CLEAR)[0]
    s.head = (hx - s.ax, (int(col[0]) + 7 if len(col) else s.ay - Hm) - s.ay)
    return s


def grave_sword():
    """A longsword planted point-down as the grave's marker: a gilt cross-guard and pommel (the Foundling's colours),
    a wrapped grip, a steel blade lit on its west edge going into the earth. Foot = where the blade enters the ground."""
    rows = [
        "......kk......",
        ".....k66k.....",
        ".....k54k.....",
        "......kk......",
        "......ww......",
        "......ww......",
        "......WW......",
        "......ww......",
        "......WW......",
        "......ww......",
        "......WW......",
        "kkkkkkkkkkkkkk",
        "k666665555443k",
        "k544444333322k",
        "kkkkk6543kkkkk",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
        "....k6543k....",
    ] + ["....k6543k...."] * 14
    s = new(16, len(rows) + 2, 7, len(rows))
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            if 11 <= j <= 13 or j < 4:
                key = {'k': 'o1', '6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o2'}[ch]
            elif 4 <= j <= 10:
                key = {'w': 'w2', 'W': 'w3', 'k': 'w0'}[ch]
            else:
                key = {'k': 'v1', '6': 'v7', '5': 'v6', '4': 'v5', '3': 'v4'}[ch]
            put(s, 1 + i, 1 + j, key)
    for (i, j) in ((5, 4), (8, 4), (5, 10), (8, 10)):
        put(s, 1 + i, 1 + j, 'w0')
    return s


def spade():
    """Oak's spade, left standing in the earth at the grave's foot, leaning a little: a D-grip, an ash shaft lit on
    its west, an iron blade half sunk and lit on its west edge. Foot = where the blade enters the earth."""
    H_ = 104
    s = new(30, H_ + 4, 14, H_)
    lean = .14
    grip = ["..kkkkkkk..", ".k6555543k.", "k6k.....k3k", "k5k.....k3k", ".k5k...k3k.", "..k54443k..", "....k43k..."]
    gxs = 14 + int(round(H_ * lean)) - 5
    for j, row in enumerate(grip):
        for i, ch in enumerate(row):
            if ch != '.':
                put(s, gxs + i, 1 + j, {'k': 'w1', '6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3'}[ch])
    for j in range(7, H_):
        x = int(round(14 + (H_ - j) * lean))
        if j < H_ - 16:
            put(s, x - 1, j + 1, 'w5')
            put(s, x, j + 1, 'w4')
            put(s, x + 1, j + 1, 'w3')
        else:
            k = j - (H_ - 16)
            hw = 3 + min(4, k)
            for i in range(-hw, hw + 1):
                put(s, x + i, j + 1, 'v6' if i == -hw else ('v5' if i < 0 else ('v4' if i < hw - 1 else 'v3')))
    cpx.selout(s)
    return s


# ------------------------------------------------------------------ the wagon
def wheel(r, spokes=12, seed=0):
    """A spoked wheel face-on: an iron tyre, the felloe in Walnut lit on its upper-left arc, spokes, a hub with its
    iron cap. Sampled at pixel centres so every arc steps evenly."""
    n = int(2 * r + 4)
    s = new(n, n, n // 2, n - 2)
    c = n / 2
    yy, xx = np.mgrid[0:n, 0:n].astype(float) + .5
    d = np.hypot(xx - c, yy - c)
    ang = np.arctan2(yy - c, xx - c)
    lit = np.cos(ang + 2.25)                 # +1 toward the upper left
    tyre = (d <= r) & (d > r - 3)
    fel = (d <= r - 3) & (d > r - 8)
    hub = d <= r * .2 + 1
    cap = d <= r * .1 + .6
    sp = np.zeros_like(tyre)
    for k in range(spokes):
        a = 2 * math.pi * k / spokes + .13
        dx, dy = math.cos(a), math.sin(a)
        along = (xx - c) * dx + (yy - c) * dy
        perp = np.abs(-(xx - c) * dy + (yy - c) * dx)
        sp |= (along > 0) & (along < r - 7) & (perp < 1.6)
    s.ix[sp] = ix('w4')
    s.ix[sp & (lit > .2)] = ix('w5')
    s.ix[sp & (lit < -.5)] = ix('w3')
    s.ix[fel] = ix('w4')
    s.ix[fel & (lit > .35)] = ix('w5')
    s.ix[fel & (lit < -.4)] = ix('w3')
    s.ix[fel & (d > r - 4)] = ix('w2')
    s.ix[tyre] = ix('v3')
    s.ix[tyre & (lit > .3)] = ix('v5')
    s.ix[tyre & (lit < -.45)] = ix('v2')
    s.ix[hub] = ix('w3')
    s.ix[hub & (lit > 0)] = ix('w5')
    s.ix[cap] = ix('v4')
    s.ix[cap & (lit > .3)] = ix('v6')
    cpx.selout(s)
    return s


def wagon_body(L=250):
    """The covered wagon's body, from the south side: a plank bed with iron-strapped corners on its frame, the canvas
    cover over five hoops (lit along its crown and the west end, the side in the middle step, sagging between the hoops
    in soft seams, a drawstring pucker at the east end where the dark inside shows), the shafts down on the grass.
    Returns (sprite, wheel positions). Anchor = the ground line under the middle of the wagon."""
    W_, H_ = L + 120, 230
    gy = H_ - 4
    s = new(W_, H_, 40 + L // 2, gy)
    x0 = 40
    bed_top, bed_bot = gy - 104, gy - 62
    # the frame under the bed: a dark beam and the axle blocks
    for x in range(x0 + 6, x0 + L - 6):
        for y in range(bed_bot, bed_bot + 7):
            put(s, x, y, 'w2' if y < bed_bot + 5 else 'w1')
    # the bed: two side boards, grain running along each plank, knots, iron corner straps with their nails
    R2 = random.Random(77)
    for x in range(x0, x0 + L):
        for y in range(bed_top, bed_bot):
            j = y - bed_top
            jj = j % 21
            key = 'w4'
            if jj == 0:
                key = 'w5'
            elif jj == 1:
                key = 'w5' if x % 9 else 'w4'
            elif jj >= 19:
                key = 'w2'
            elif jj == 18:
                key = 'w3'
            if x - x0 < 3:
                key = 'w5'
            if x0 + L - x <= 3:
                key = 'w2'
            put(s, x, y, key)
    for _ in range(26):                                        # grain streaks along the planks
        pl = R2.randint(0, 1)
        y = bed_top + pl * 21 + R2.randint(4, 16)
        xa = R2.randint(x0 + 4, x0 + L - 30)
        for x in range(xa, xa + R2.randint(12, 40)):
            if get(s, x, y) == ix('w4'):
                put(s, x, y + (1 if (x - xa) > 20 and R2.random() < .08 else 0), 'w3')
    for _ in range(5):                                         # knots
        kx, ky = R2.randint(x0 + 30, x0 + L - 30), bed_top + R2.randint(0, 1) * 21 + R2.randint(6, 13)
        for (i, j, k_) in ((0, 0, 'w2'), (1, 0, 'w2'), (-1, 0, 'w3'), (2, 0, 'w3'), (0, -1, 'w3'), (1, -1, 'w3'),
                           (0, 1, 'w3'), (1, 1, 'w5'), (-2, 0, 'w3'), (3, 0, 'w3')):
            put(s, kx + i, ky + j, k_)
    for (sx0, d_) in ((x0 + 6, 1), (x0 + L - 7, -1)):         # the straps: an L of iron at each corner, nailed
        for y in range(bed_top + 2, bed_bot - 2):
            put(s, sx0, y, 'v4' if d_ > 0 else 'v3')
            put(s, sx0 + d_, y, 'v3' if d_ > 0 else 'v2')
        for k in range(18):
            for y in (bed_top + 3, bed_top + 24):
                put(s, sx0 + d_ * k, y, 'v4')
                put(s, sx0 + d_ * k, y + 1, 'v2')
        for (k, y) in ((3, bed_top + 3), (12, bed_top + 3), (3, bed_top + 24), (12, bed_top + 24)):
            put(s, sx0 + d_ * k, y, 'v6')
    for x in range(x0 - 2, x0 + L + 2):                       # the bed's rim, lit
        put(s, x, bed_top - 1, 'w6'); put(s, x, bed_top - 2, 'w4')
    # the cover: canvas over five hoops. Bands of light follow the loaf (crown lit, the side in the middle step, the
    # lower side and the tucked hem in shade), each hoop a ridge under the cloth (lit west, shaded east), creases
    # pulled up from each tie, a patch sewn on, ropes over the rim
    cov_top = bed_top - 108
    hoops = [x0 + 14 + i * (L - 28) / 4 for i in range(5)]
    tops = {}
    for x in range(x0 - 4, x0 + L + 8):
        u = (x - (x0 - 4)) / (L + 12)
        rise = math.sqrt(max(0, 1 - ((u - .5) / .52) ** 2))
        ytop = bed_top - 4 - (bed_top - 4 - cov_top) * (.55 + .45 * rise)
        if u > .93:
            ytop += (u - .93) * 900
        hd = min(abs(x - hx) for hx in hoops)
        ytop += 3 * min(1, hd / 18)
        tops[x] = int(ytop)
        near = min(hoops, key=lambda h_: abs(x - h_))
        for y in range(int(ytop), bed_top - 1):
            v_ = (y - ytop) / max(1, bed_top - ytop)
            w1 = .14 + .03 * math.sin(x / 9)
            w2 = .5 + .05 * math.sin(x / 13 + 1)
            w3 = .8 + .03 * math.sin(x / 7 + 2)
            key = 'b5' if v_ < w1 else ('b4' if v_ < w2 else ('b3' if v_ < w3 else 'b2'))
            if u < .05:
                key = 'b5' if v_ < .75 else 'b4'
            if v_ < .03:
                key = 'b5'
            if abs(x - near) < 1.5 and v_ > .04:
                key = 'b3' if v_ < w2 else 'b2'                  # the hoop's shaded east flank
            elif -3 < x - near <= -1.5 and v_ > .04:
                key = 'b5' if v_ < w3 else 'b4'                  # its lit west flank
            put(s, x, y, key)
    # creases: from each tie point at the hem, two pulled folds rising toward the panel's middle
    for i in range(len(hoops) - 1):
        a_, b_ = hoops[i], hoops[i + 1]
        for (sx_, sl, L_) in ((a_ + 9, .22, .46), (b_ - 9, -.2, .4), ((a_ + b_) / 2 + 2, .06, .26)):
            for k in range(int((bed_top - cov_top) * L_)):
                x = int(round(sx_ + k * sl))
                y = bed_top - 3 - k
                if y > tops.get(x, 9999) + 4 and get(s, x, y) in (ix('b4'), ix('b3'), ix('b2')):
                    put(s, x, y, pal.KEYS[pal.shift_index(int(get(s, x, y)), -1)])
                    if get(s, x - 1, y) in (ix('b4'), ix('b3')):
                        put(s, x - 1, y, pal.KEYS[pal.shift_index(int(get(s, x - 1, y)), 1)])
    # a patch sewn over a tear, its stitches showing
    pxp, pyp = int(hoops[2] + 14), bed_top - 52
    for j in range(14):
        for i in range(18):
            k_ = 'b3' if (i in (0, 17) or j in (0, 13)) else ('b4' if j < 5 else 'b3')
            if (i in (0, 17) and j % 3 == 1) or (j in (0, 13) and i % 3 == 1):
                k_ = 'b1'
            put(s, pxp + i, pyp + j, k_)
    # the ropes: a loop over the rim at each hoop's foot, lashed to a ring on the bed
    for h_ in hoops:
        hx_ = int(h_)
        for j in range(-6, 6):
            put(s, hx_ - 1, bed_top + j, 'w5' if j < 0 else 'w4')
            put(s, hx_, bed_top + j, 'w3')
        put(s, hx_ - 1, bed_top + 6, 'v4'); put(s, hx_, bed_top + 6, 'v3'); put(s, hx_ - 1, bed_top + 7, 'v2')
    # the pucker at the east end: dark inside, drawn in by the cord
    px_, py_ = x0 + L + 2, bed_top - 44
    for j in range(-26, 27):
        for i in range(-10, 1):
            if (i / 10) ** 2 + (j / 26) ** 2 <= 1:
                put(s, px_ + i, py_ + j, 'w1' if i > -7 else 'w2')
    for j in range(-26, 27, 6):
        for i in range(-12, -9):
            put(s, px_ + i, py_ + j, 'b3')
    # the shafts, resting on the grass ahead of the wagon
    for (dy_, k1, k2) in ((0, 'w5', 'w3'), (10, 'w4', 'w2')):
        for i in range(0, 118):
            x = x0 + L - 20 + i
            y = int(round(bed_bot + 4 + dy_ + i * (gy - 6 - bed_bot - 4 - dy_) / 118))
            put(s, x, y, k1); put(s, x, y + 1, k2)
    cpx.selout(s)
    wheels = [(x0 + 52 - (40 + L // 2), 44), (x0 + L - 56 - (40 + L // 2), 38)]
    return s, wheels


def cold_ring(rx=40, ry=16, seed=6):
    """The last camp's fire, long cold: fieldstones round a bed of grey ash and a few charred sticks (fire.stone)."""
    import fire as FI
    rng = random.Random(seed)
    parts = []
    W_, H_ = 2 * rx + 10, 2 * ry + 10
    bed = new(W_, H_, W_ // 2, H_ // 2)
    yy, xx = np.mgrid[0:H_, 0:W_].astype(float) + .5
    m = cpx.ell_mask(W_, H_, W_ / 2, H_ / 2, rx - 5, ry - 2, xx, yy)
    bed.ix[m] = ix('t3')
    inner = cpx.ell_mask(W_, H_, W_ / 2, H_ / 2 + 1, rx - 13, ry - 6, xx, yy)
    bed.ix[inner] = ix('t4')
    for _ in range(18):
        x0, y0 = rng.uniform(10, W_ - 10), rng.uniform(6, H_ - 6)
        for k in range(rng.choice((2, 3, 4))):
            if m[int(y0), int(x0 + k)]:
                bed.ix[int(y0), int(x0 + k)] = ix('t5') if k == 0 else ix('t2')
    for (x_, y_, L_) in ((W_ / 2 - 12, H_ / 2, 16), (W_ / 2 + 2, H_ / 2 - 2, 12)):
        for k in range(L_):
            bed.ix[int(y_ + k * .2), int(x_ + k)] = ix('w1')
            bed.ix[int(y_ + k * .2) + 1, int(x_ + k)] = ix('k0')
    parts.append((bed, 0, 0))
    for i in range(11):
        a = 2 * math.pi * (i + .5) / 11 + rng.uniform(-.06, .06)
        w_, h_ = rng.randint(13, 18), rng.randint(9, 11)
        st = FI.stone(w_, h_, rng.randint(0, 9999), soot=.6 if math.sin(a) < 0 else 0)
        parts.append((st, math.cos(a) * rx, math.sin(a) * ry + h_ * .35))
    return parts


# ------------------------------------------------------------------ the scene
def compose(seed=13):
    import people as PP
    import standard as SD
    import bigtree as BT
    a, info = build_ground(seed)
    st_ = pxs.Stage(a, ground_ramps=('g', 'd'))
    # the pines: a wall of them along the top, more down the east side
    rng = random.Random(seed + 1)
    PINES = [(-10, 120, 300, 170), (96, 112, 290, 160), (210, 118, 310, 170), (318, 106, 280, 156), (436, 120, 300, 168),
             (556, 102, 280, 160), (650, 116, 300, 168), (760, 100, 286, 160), (872, 114, 304, 170), (986, 98, 280, 158),
             (1096, 112, 296, 166), (1200, 100, 290, 162),
             (40, 210, 390, 204), (176, 188, 352, 186), (300, 222, 400, 210), (424, 196, 350, 180), (546, 214, 380, 198),
             (684, 190, 344, 178), (806, 206, 376, 196), (936, 186, 340, 176), (1056, 212, 384, 200), (1150, 190, 350, 180),
             (1262, 214, 390, 206), (1254, 330, 400, 208), (1170, 314, 330, 170), (1276, 810, 390, 200)]
    for k, (px_, py_, h_, w_) in enumerate(PINES):
        sp = pine_big(h_, w_, seed=40 + k)
        st_.add(sp, px_, py_)
        st_.throw_sprite(sp, px_, py_, zcap=110)
    # undergrowth along the wood's edge
    for (bx, by, rx, ry, sd) in ((560, 236, 40, 24, 31), (668, 226, 34, 22, 32), (760, 236, 44, 26, 33), (880, 226, 36, 22, 34),
                                 (1086, 232, 40, 24, 35), (1214, 352, 38, 24, 36), (1130, 690, 44, 28, 37), (600, 712, 40, 26, 38)):
        bu = BT.bush(rx, ry, sd)
        st_.add(bu, bx, by)
        st_.throw_sprite(bu, bx, by)
    # the wagon, left where they last camped, its wheels on the grass
    body, wheels = wagon_body()
    wx, wy = WAGON
    st_.add(body, wx, wy, z=wy - 2)
    st_.throw_sprite(body, wx, wy)
    for (dx_, r_) in wheels:
        wl = wheel(r_, seed=r_)
        st_.add(wl, wx + dx_, wy, z=wy)
        st_.throw_sprite(wl, wx + dx_, wy)
    # the cold fire of that camp
    fx, fy = FIRE
    for (sp, dx_, dy_) in cold_ring():
        st_.add(sp, fx + dx_, fy + dy_, z=fy + dy_ - 20 if sp.h > 20 else fy + dy_)
    # the grave, its sword and the standard at its head, the spade at its foot
    gx, gy = GRAVE
    gm = grave_mound()
    st_.add(gm, gx, gy)
    st_.throw_sprite(gm, gx, gy, zcap=30)
    hx, hy = gm.head
    sw = grave_sword()
    st_.add(sw, gx + hx, gy + hy, z=gy + 1)                 # planted in the top of the mound's west end
    st_.throw_sprite(sw, gx + hx, gy + hy, zcap=40)
    sd = SD.standard()
    st_.add(sd, gx - 118, gy - 40)                          # beside the head, a step to the north-west
    st_.throw_sprite(sd, gx - 118, gy - 40)
    spd = spade()
    st_.add(spd, gx + 92, gy - 12, z=gy + 2)
    st_.throw_sprite(spd, gx + 92, gy - 12)
    # Oak, on the road east, alone
    pxs.person(st_, 'board_marcus', OAK[0], OAK[1], flip=True)
    return st_, info


if __name__ == '__main__':
    import os
    st_, info = compose()
    im = st_.render().convert('RGB')
    os.makedirs(os.path.join(pxs.HERE, 't'), exist_ok=True)
    im.save(os.path.join(pxs.HERE, 't', 'lost.png'))
    print('ok')
