"""pxworld props: the small pieces every place is built from, at both grains.

Procedural (sized in art px, so they work at any grain):
  house(w, d, h, roof, wall)   oblique cottage, ridge east-west: lit north slope, shingled south slope,
                               timber-framed front wall in shade, door and window, inked outline
  rock(r, seed)                a faceted boulder: facets radiate from a peak set to the north-west
  outcrop(pts, seed)           a big faceted rock mass from a polygon (caves, crests)
  tower(w, h)                  a round-shouldered stone tower: lit west half, mortar courses, merlons
Hand-drawn (one sprite per grain, ASCII below):
  tent, fire, wagon, stake, stall, flag, pennant, sack, barrel, haystack, sign, ox, cart, arrows, wheel
Every builder returns a Sprite whose anchor is its foot on the ground.
"""
import math
import random

import numpy as np

from . import pal
from .canvas import Sprite, poly, ellipse, nb, lut
from .pal import ix

INK = 'k0'


def ink(s, key=INK, conn=4):
    s.outline(key, conn=conn)
    return s


# ---------------------------------------------------------------- house
ROOFS = {
    # north face (lit), west hip (lit), south face, shingle course, east hip (shade), eave
    'tile': ('r5', 'r4', 'r4', 'r3', 'r2', 'r1'),
    'tile2': ('r4', 'r4', 'r3', 'r2', 'r2', 'r1'),
    'thatch': ('h5', 'h4', 'h4', 'h3', 'h2', 'h1'),
    'slate': ('t5', 't4', 't4', 't3', 't2', 't1'),
    'shingle': ('w6', 'w6', 'w5', 'w4', 'w3', 'w2'),
}
WALLS = {
    'plaster': ('b3', 'b2', 'w3'),     # front wall, its foot, timbers
    'stone': ('t4', 't3', 't2'),
    'timber': ('w5', 'w4', 'w2'),
}


def house(w, d, h, roof='tile', wall='plaster', g=1, door=True, chimney=False, seed=0, hip=None):
    """An oblique cottage seen from the south: a hipped roof w+2 wide and d deep over a front wall h tall.
    The north face and west hip take the light, the east hip is in shade, the south face is shingled.
    Foot = middle of the front wall's base."""
    rng = random.Random(seed)
    R = ROOFS[roof]
    Wl = WALLS[wall]
    RW = w + 2                          # the roof overhangs the walls by 1 each side
    hip = hip if hip is not None else max(1, int(round(min(d * .5, RW * .22))))
    ridge = max(1, int(round(d * .36)))
    s = Sprite(RW + 2, d + h + 5, (RW + 2) // 2, d + h + 2)
    ox, oy = 1, 3
    for y in range(d):
        if y <= ridge:
            ins = hip * y / ridge
        else:
            ins = hip * (d - 1 - y) / max(1, d - 1 - ridge)
        for x in range(RW):
            west = x < ins - .01
            east = x > RW - 1 - ins + .01
            if west:
                k = R[1]
            elif east:
                k = R[4]
            elif y <= ridge:
                k = R[0]
            else:
                k = R[2]
                if g == 1 and (y - ridge) % 2 == 0 and y < d - 1:
                    k = R[3]
            if y == d - 1:
                k = R[4] if (west or east) else R[5]
            s.put(ox + x, oy + y, k)
    r0, r1 = int(math.ceil(hip)), RW - 1 - int(math.ceil(hip))
    for x in range(r0, r1 + 1):
        s.put(ox + x, oy + ridge, pal.KEYS[pal.shift_index(ix(R[0]), 1)])
    top = oy + d
    for y in range(h):
        for x in range(1, w + 1):
            k = Wl[0] if (y < h - 1 or g == 2) else Wl[1]
            s.put(ox + x, top + y, k)
    if wall == 'plaster' and g == 1 and w >= 10:
        for x in (1, w):
            for y in range(h):
                s.put(ox + x, top + y, Wl[2])
        for x in range(1, w + 1):
            s.put(ox + x, top, Wl[2])
    if door:
        dw = 2 if (g == 1 and w >= 10) else 1
        dh = min(h - (1 if g == 1 else 0), 3 if g == 1 else 2)
        dx = ox + 1 + max(1, int(w * .28)) + (rng.randint(0, 1) if g == 1 else 0)
        for y in range(h - dh, h):
            for i in range(dw):
                s.put(dx + i, top + y, 'w1')
        if g == 1 and w >= 12 and h >= 5:
            wx = ox + int(w * .66)
            wy = top + 2
            for (i, j, k) in ((0, 0, 'k1'), (1, 0, 'k1'), (0, 1, 'o4'), (1, 1, 'k1')):
                s.put(wx + i, wy + j, k)
    cx = None
    if chimney:
        cx = ox + int(RW * .7)
        for y in range(-2, ridge):
            s.put(cx, oy + y, 't5'); s.put(cx + 1, oy + y, 't3')
        s.put(cx, oy - 2, 't6'); s.put(cx + 1, oy - 2, 't4')
    ink(s, 'k0')
    s0x, s0y = s.ax, s.ay
    t = s.trimmed()
    t.chimney = (cx - s0x + .5, oy - 3 - s0y) if chimney else None      # relative to the foot
    return t


def house_shadow(cv, fx, fy, sp, g=1):
    """A building's shadow, thrown east and a little south onto the ground."""
    cv.shift((sp.mask(), int(round(fx)) - sp.ax + max(1, 3 // g), int(round(fy)) - sp.ay + max(1, 2 // g)), -1, ('g', 'd', 'h'))


# ---------------------------------------------------------------- rocks
def facets(m, peak, ramp='t', tones=(5, 4, 3, 2), seed=0, n=7):
    """Shade bool mask m as facets radiating from peak (x, y): each wedge one flat tone by its facing."""
    rng = random.Random(seed)
    H, W = m.shape
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    ang = (np.arctan2(yy + .5 - peak[1], xx + .5 - peak[0]) + 2 * math.pi) % (2 * math.pi)
    cuts = sorted(rng.uniform(0, 2 * math.pi) for _ in range(n))
    sector = np.searchsorted(cuts, ang) % n
    out = np.zeros((H, W), int)
    L = (-.62, -.78)
    for k in range(n):
        a0 = cuts[k - 1] if k > 0 else cuts[-1] - 2 * math.pi
        a1 = cuts[k]
        mid = (a0 + a1) / 2
        v = math.cos(mid) * L[0] + math.sin(mid) * L[1]
        lvl = 0 if v > .5 else (1 if v > -.05 else (2 if v > -.6 else 3))
        out[sector == k] = lvl
    lv = np.array([ix(f'{ramp}{t}') for t in tones], np.uint8)
    return lv[out]


def mask_in(W, H, pts):
    m, x0, y0 = poly(pts)
    M = np.zeros((H, W), bool)
    for j in range(m.shape[0]):
        for i in range(m.shape[1]):
            if m[j, i] and 0 <= y0 + j < H and 0 <= x0 + i < W:
                M[y0 + j, x0 + i] = True
    return M


def blob_mask(W, H, cx, cy, rx, ry, seed, n=9, jag=.12):
    rng = random.Random(seed)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-.2, .2)
        rr = rng.uniform(1 - jag, 1)
        pts.append((cx + math.cos(a) * rx * rr, cy + math.sin(a) * ry * rr))
    return mask_in(W, H, pts)


def rock(r, seed=0, ramp='t', g=1, squash=.74):
    """A boulder about 2r wide (art px), cut into flat facets lit from the north-west. Foot = bottom centre."""
    size = int(2 * r + 4)
    c = size / 2
    M = blob_mask(size, size, c, c, r, r * squash, seed, n=9 if r > 3 else 7, jag=.14)
    s = Sprite(size, size, int(c), int(c + r * squash))
    if r < 2.6:
        yy, xx = np.mgrid[0:size, 0:size]
        t = np.where((yy + xx * .5) < (c * 1.5 - .5), ix(f'{ramp}5'), ix(f'{ramp}3'))
        s.ix[M] = t[M]
    else:
        sh = facets(M, (c - r * .2, c - r * .35), ramp, seed=seed, n=5 if r < 5 else 6)
        s.ix[M] = sh[M]
        bot = M & ~nb(M, 0, 1)
        s.ix[bot] = ix(f'{ramp}2')
    s.despeckle(1)
    ink(s, 'k0')
    return s.trimmed()


def voronoi_facets(M, seed=0, ramp='t', spacing=7.0, tones=(6, 5, 4, 3, 2), crown=.32):
    """Shade mask M as a faceted rock: Voronoi cells, each a flat plane tilted out from a dome whose crown
    sits up and to the west; each plane's tone is its facing to the north-west light."""
    rng = random.Random(seed)
    H, W = M.shape
    ys, xs = np.nonzero(M)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    cx, cy = x0 + (x1 - x0) * .42, y0 + (y1 - y0) * crown
    rx, ry = (x1 - x0) / 2 + 1, (y1 - y0) * .75 + 1
    seeds = []
    for _ in range(4000):
        k = rng.randrange(len(xs))
        p = (xs[k] + .5, ys[k] + .5)
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= spacing * spacing for q in seeds):
            seeds.append(p)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    best = np.full((H, W), 1e9)
    lab = np.zeros((H, W), int)
    for i, (sx, sy) in enumerate(seeds):
        d = (xx + .5 - sx) ** 2 + (yy + .5 - sy) ** 2
        m = d < best
        best[m] = d[m]
        lab[m] = i
    L = np.array([-.55, -.7, .45]); L /= np.linalg.norm(L)
    lv = np.zeros(len(seeds), int)
    for i, (sx, sy) in enumerate(seeds):
        nx, ny = (sx - cx) / rx, (sy - cy) / ry
        nx += rng.uniform(-.25, .25); ny += rng.uniform(-.25, .25)
        nz = math.sqrt(max(.05, 1 - min(1, nx * nx + ny * ny)))
        nrm = np.array([nx, ny, nz]); nrm /= np.linalg.norm(nrm)
        b = float(nrm @ L)
        lv[i] = 0 if b > .78 else (1 if b > .5 else (2 if b > .18 else (3 if b > -.15 else 4)))
    keys = np.array([ix(f'{ramp}{t}') for t in tones], np.uint8)
    out = keys[lv[lab]]
    # a fine crack between neighbouring facets on their shaded side
    crack = (lab != nb(lab, 1, 0, -1)) | (lab != nb(lab, 0, 1, -1))
    darker = lv[lab] >= 2
    out[crack & darker & M] = ix(f'{ramp}{max(1, tones[-1] - 1)}')
    return out


def outcrop(W, H, pts, seed=0, ramp='t', peak=None, n=9, spacing=None):
    """A rock mass from polygon pts (local art px inside W x H), faceted. Foot = bottom centre."""
    M = mask_in(W, H, pts)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    s = Sprite(W, H, int((min(xs) + max(xs)) / 2), int(max(ys)))
    sh = voronoi_facets(M, seed, ramp, spacing or max(3.5, (max(xs) - min(xs)) / 8))
    s.ix[M] = sh[M]
    bot = M & ~nb(M, 0, 1)
    s.ix[bot] = ix(f'{ramp}1')
    s.despeckle(2)
    ink(s, 'k0')
    return s


# ---------------------------------------------------------------- stone tower
def tower(w, h, g=1, ramp='t', merlons=True, slit=True, door=True):
    """A round stone tower w wide and h tall (art px) on a battered foot: lit as a drum from the west,
    mortar courses, a crenellated top with gaps. Foot = base centre."""
    top = 3 if g == 1 else 2
    W, H = w + 4, h + top + 2
    s = Sprite(W, H, W // 2, top + h - 1)
    x0 = 2

    def tone(x, ww):
        f = (x + .5) / ww
        if f < .12:
            return 4
        if f < .45:
            return 6 if (g == 1 and .2 < f < .32) else 5
        if f < .7:
            return 4
        if f < .88:
            return 3
        return 2
    for y in range(h):
        batter = 1 if y >= h - (3 if g == 1 else 1) else 0
        for x in range(-batter, w + batter):
            k = tone(x + batter, w + 2 * batter)
            if g == 1 and y % 5 == 3 and 0 < x < w - 1:
                k = max(2, k - 1)
            s.put(x0 + x, top + y, f'{ramp}{k}')
    for x in range(w):
        s.put(x0 + x, top - 1, f'{ramp}{max(2, tone(x, w) - 1)}')
    if merlons:
        mw = 2 if g == 1 else 1
        step = 4 if g == 1 else 2
        for x in range(0, w, step):
            for i in range(mw):
                if x + i < w:
                    for y in range(0, top - 1):
                        s.put(x0 + x + i, y, f'{ramp}{tone(x + i, w)}')
    if slit:
        sx = x0 + int(w * .38)
        for y in range(top + h // 4, top + h // 4 + (3 if g == 1 else 2)):
            s.put(sx, y, 'k1')
        if g == 1 and h > 20:
            for y in range(top + h // 2, top + h // 2 + 3):
                s.put(x0 + int(w * .62), y, 'k1')
    if door:
        dx = x0 + w // 2 - (1 if g == 1 else 0)
        dh = 4 if g == 1 else 2
        for y in range(top + h - dh, top + h):
            s.put(dx, y, 'w0')
            if g == 1:
                s.put(dx + 1, y, 'w0')
    ink(s, INK)
    return s.trimmed()


# ---------------------------------------------------------------- hand-drawn pieces
def A(rows, km, ax=None, ay=None):
    return Sprite.ascii(rows, km, ax, ay)


# tent: 6..1 = the cloth ramp light..dark, d = doorway, k = ink
TENT_1 = [
    "......kk.......",
    ".....k65k......",
    "....k6654k.....",
    "...k66543k.....",
    "..k665433kk....",
    ".k6654kk332k...",
    "k6654kddk3221k.",
    "k654kdddk32211k",
    "kkkkkkkkkkkkkkk",
]
TENT_1B = [   # a larger tent
    ".......kk........",
    "......k65k.......",
    ".....k6654k......",
    "....k66544k......",
    "...k665433kk.....",
    "..k6654k3332k....",
    ".k6654kddk3322k..",
    "k6654kdddk33221k.",
    "k654kddddk322211k",
    "kkkkkkkkkkkkkkkkk",
]
TENT_2 = [
    "...kk...",
    "..k64k..",
    ".k654kk.",
    "k65kdk3k",
    "kkkkkkkk",
]
CLOTH = {
    'canvas': {'6': 'b5', '5': 'b4', '4': 'b3', '3': 'b2', '2': 'b1', '1': 'b0'},
    'tan': {'6': 'h5', '5': 'h4', '4': 'h3', '3': 'h2', '2': 'h1', '1': 'h0'},
    'red': {'6': 'x5', '5': 'x4', '4': 'x3', '3': 'x2', '2': 'x1', '1': 'x0'},
    'blue': {'6': 's5', '5': 's4', '4': 's3', '3': 's2', '2': 's1', '1': 's0'},
}


def tent(g=1, cloth='canvas', big=False, stripe=None):
    rows = (TENT_1B if big else TENT_1) if g == 1 else TENT_2
    km = dict(CLOTH[cloth]); km.update({'k': 'k0', 'd': 'w0'})
    s = A(rows, km)
    if stripe and g == 1:
        # a coloured band down the lit roof plane
        sc = CLOTH[stripe]
        for y in range(2, len(rows) - 1):
            row = rows[y]
            xs = [i for i, ch in enumerate(row) if ch in '6']
            if xs:
                x = xs[-1]
                s.put(x, y, sc['4'])
    return s


FIRE_1 = [
    "...6...",
    "..656..",
    ".6545..",
    ".54345.",
    "t5434t.",
    "tw33wtt",
    ".tttt..",
]
FIRE_2 = [
    ".6.",
    "545",
    "tWt",
]
FIRE_KM = {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'x4', 't': 't3', 'w': 'w4', 'W': 'x3'}


def fire(g=1):
    s = A(FIRE_1 if g == 1 else FIRE_2, FIRE_KM)
    ink(s, INK)
    return s


SMOKE_1 = ["..b.", ".b..", "..bb", ".b..", "b...", ".b..", "..b."]


def smoke(cv, x, y, g=1, n=None):
    """A wisp of smoke rising from (x, y), leaning east on the wind: small pale puffs that thin out as they
    climb, never a blur. Only drawn over pixels already painted."""
    n = n or (12 if g == 1 else 6)
    for k in range(n):
        yy = y - 1 - k
        xx = x + int(round(math.sin(k * .55) * (1.4 if g == 1 else .6) + k * (.22 if g == 1 else .25)))
        if g == 1 and k % 4 == 3:
            continue
        key = 'b4' if k < n * .35 else ('b3' if k < n * .7 else 'b2')
        if cv.get(xx, yy) != pal.CLEAR:
            cv.put(xx, yy, key)
        if g == 1 and k < n * .6 and k % 2 == 0 and cv.get(xx + 1, yy) != pal.CLEAR:
            cv.put(xx + 1, yy, 'b3')


STAKE_1 = [".k.", "k6k", "k5k", "k5k", "k4k", "k4k", "k3k", "k3k", "kkk"]
STAKE_2 = ["k", "5", "4", "3"]
STAKE_KM = {'6': 'd6', '5': 'd5', '4': 'd4', '3': 'd3', 'k': 'w0'}


def stake(g=1, lit=True):
    rows = STAKE_1 if g == 1 else STAKE_2
    km = dict(STAKE_KM)
    if not lit:
        km.update({'6': 'd4', '5': 'd3', '4': 'd3', '3': 'd2'})
    s = A(rows, km)
    if g == 2:
        ink(s, 'w0')
    return s


WAGON_1 = [
    "....kkkkkkkk....",
    "...k66665554k...",
    "..k6665554443k..",
    "..k6665554433k..",
    "..k5k55k44k32k..",
    ".kkkkkkkkkkkkkk.",
    ".kwwwwwwwwwwvvk.",
    ".kvvvvvvvvvvuuk.",
    "kkkk..kkkk..kkk.",
    "kWWk..kWWk...k..",
    "kkkk..kkkk......",
]
WAGON_2 = [
    ".kkkkkk.",
    "k666543k",
    "kkkkkkkk",
    "kwwwwvvk",
    "kWk..kWk",
]
WAGON_KM = {'6': 'b5', '5': 'b4', '4': 'b3', '3': 'b2', '2': 'b1', 'w': 'w5', 'v': 'w4', 'u': 'w3', 'W': 'w3', 'k': 'k0'}


def wagon(g=1):
    return A(WAGON_1 if g == 1 else WAGON_2, WAGON_KM)


STALL_1 = [
    "kkkkkkkkk",
    "k6565656k",
    "k5454545k",
    "kkkkkkkkk",
    ".kw...wk.",
    ".kwbobwk.",
    ".kkkkkkk.",
]
STALL_2 = [
    "kkkkk",
    "k656k",
    "kkkkk",
    ".kok.",
]


def stall(g=1, cloth='red'):
    sc = CLOTH[cloth]
    km = {'6': 'b5', '5': sc['4'], '4': sc['3'], 'k': 'k0', 'w': 'w4', 'b': 'h4', 'o': 'x4'}
    if g == 2:
        km.update({'6': sc['5'], '5': 'b5', 'o': 'h4'})
    return A(STALL_1 if g == 1 else STALL_2, km)


BARREL_1 = [".kkk.", "k545k", "k333k", "k545k", ".kkk."]
SACK_1 = [".kk.", "k54k", "k543k", "kkkk"]


def barrel(g=1):
    return A(BARREL_1 if g == 1 else ["kk", "54", "kk"], {'5': 'w6', '4': 'w5', '3': 'w3', 'k': 'k0'})


def sack(g=1, split=False):
    return A(SACK_1 if g == 1 else ["k5k", "kkk"], {'5': 'b5', '4': 'b4', '3': 'b3', 'k': 'w1'})


HAY_1 = [
    "..kkkk..",
    ".k5554k.",
    "k554443k",
    "k544332k",
    ".kkkkkk.",
]
HAY_2 = [".kk.", "k54k", "kkkk"]


def haystack(g=1):
    return A(HAY_1 if g == 1 else HAY_2, {'5': 'h5', '4': 'h4', '3': 'h3', '2': 'h2', 'k': 'h0'})


def flag(g=1, cloth=('s3', 'b4'), h=None, ragged=False):
    """A banner on a pole. cloth = (field, top band). Foot = pole base."""
    if g == 1:
        h = h or 18
        fw, fh = 9, 7
    else:
        h = h or 10
        fw, fh = 5, 4
    W, H = fw + 3, h + 2
    s = Sprite(W, H, 1, H - 1)
    for y in range(1, H):
        s.put(1, y, 'w5' if y < H - 1 else 'w3')
    s.put(1, 0, 't5')
    f0, band = cloth
    fr = ix(f0)
    for y in range(fh):
        for x in range(fw):
            if g == 1 and y >= fh - 2 and x >= fw - 2 - (y - (fh - 2)):
                if ragged or x > fw - 3:
                    continue
            k = f0
            if y < (2 if g == 1 else 1):
                k = band
            elif y == fh - 1:
                k = pal.KEYS[pal.shift_index(fr, -1)]
            s.put(2 + x, 1 + y, k)
    ink(s, INK)
    return s


SIGN_1 = [
    ".kkkkkkkkk.",
    "k666666665k",
    "k5555555543k",
    "k4444444433k",
    ".kkkkkkkkkk.",
]


def signpost(g=1, w=None, arrow=True):
    """A finger-post: a plank on a post, its east end cut to a point. Foot = post base."""
    if g == 1:
        w = w or 14
        ph = 14
        bh = 5
    else:
        w = w or 7
        ph = 7
        bh = 3
    W, H = w + 4, ph + 2
    s = Sprite(W, H, 2, H - 1)
    for y in range(1, H - 1):
        s.put(2, y, 'w4')
        if g == 1:
            s.put(3, y, 'w2')
    for y in range(bh):
        for x in range(w):
            tip = arrow and x >= w - (bh // 2 + 1) and abs(y - bh // 2) > (w - 1 - x)
            if tip:
                continue
            k = 'w6' if y == 0 else ('w5' if y < bh - 1 else 'w3')
            s.put(1 + x, 1 + y, k)
    ink(s, INK)
    return s


OX_1 = [
    "..........b.",
    ".kkkkkkk.kbk",
    "k6655554kk5k",
    "k65544443k3k",
    "k544433333kk",
    ".kkkkkkkkkk.",
]
OX_2 = [
    ".kkkk.b",
    "k5544kk",
    "kkkkkk.",
]


def ox(g=1):
    """The dead ox, a dun hump on its side, horns pale."""
    return A(OX_1 if g == 1 else OX_2, {'6': 'd6', '5': 'd5', '4': 'd4', '3': 'd3', 'k': 'k0', 'b': 'b4'})


# ---------------------------------------------------------------- scene-scale builders (any size, art px)
def ridge_tent(w, h, cloth='canvas', door=True, ropes=True):
    """A ridge tent of any size seen from the south and above: the front gable with its doorway, the west roof
    plane in sun showing above its left edge, the east plane in shade beyond its right edge, seams, guy ropes
    and pegs. Foot = middle of the front base."""
    C = CLOTH[cloth]
    pad = 4
    dx, dy = -max(1, int(round(w * .04))), max(2, int(round(h * .34)))   # the ridge runs back (up), a touch west
    W, H = w + dx + 2 * pad + 4, h + dy + 2 * pad
    ox, oy = pad + 3, pad + dy
    s = Sprite(W, H, ox + int(w * .45), oy + h - 1)
    A = (ox + w * .45, oy)                       # front apex
    R = (A[0] + dx, A[1] - dy)                   # back apex
    BL, BR = (ox, oy + h), (ox + w * .9, oy + h)
    BLb, BRb = (BL[0] + dx, BL[1] - dy), (BR[0] + dx, BR[1] - dy)
    s.poly_fill([BL, A, R, BLb], C['5'])                              # west plane, sunlit
    s.poly_fill([A, R, BRb, BR], C['2'])                              # east plane, in shade
    s.line_px(BLb[0], BLb[1], R[0], R[1], C['6'])                     # the sun along the west plane's top
    s.poly_fill([BL, A, BR], C['4'])                                  # front gable
    s.line_px(A[0], A[1], BL[0] + 1, BL[1] - 1, C['5'])               # its lit west edge
    if w >= 16:
        s.line_px(A[0], A[1] + 2, A[0], BL[1] - 1, C['3'])            # the centre seam
    if door:
        dw = max(1, int(round(w * .1)))
        top = A[1] + h * .45
        s.poly_fill([(A[0] - dw, BL[1]), (A[0], top), (A[0] + dw, BL[1])], 'w0')
    s.outline('k0')
    if ropes and w >= 24:
        for (x0, y0, x1, y1) in ((A[0] - 1, A[1] + 2, ox - 3, oy + h - 1), (R[0] + 1, R[1] + 1, BRb[0] + 4, BRb[1] + 2)):
            s.line_px(x0, y0, x1, y1, 'b1')
            s.put(int(x1), int(y1) + 1, 'w2')
    return s


def campfire(h, logs=True, stones=True):
    """A cookfire h art px tall (flames), on crossed logs inside a ring of stones. Foot = centre of the ring."""
    h = max(6, int(h))
    w = max(5, int(h * .7))
    W, H = w + 10, h + 8
    s = Sprite(W, H, W // 2, H - 3)
    c = W / 2
    base = H - 4
    # flame tongues, outer to inner
    for (k, sc, lean) in (('x3', 1.0, 0), ('o3', .82, .5), ('o4', .62, .3), ('o5', .42, .1), ('o6', .22, 0)):
        hh, ww = h * sc, w * sc * .5
        pts = [(c - ww, base), (c - ww * .7, base - hh * .45), (c - ww * .2 + lean, base - hh * .8), (c + lean, base - hh),
               (c + ww * .35 + lean, base - hh * .7), (c + ww * .8, base - hh * .35), (c + ww, base)]
        s.poly_fill(pts, k)
    if logs:
        s.line_px(c - w * .7, base + 1, c + w * .7, base - 1, 'w4')
        s.line_px(c - w * .7, base, c + w * .7, base - 2, 'w5')
        s.line_px(c - w * .6, base - 1, c + w * .6, base + 1, 'w3')
    s.outline('k0')
    if stones:
        n = 9
        for i in range(n):
            a = math.pi * (i / (n - 1))
            x = int(round(c + math.cos(a) * (w * .75 + 2)))
            y = int(round(base + 2 - math.sin(a) * 1.5)) if i % 2 else int(round(base + 2))
            s.put(x, y, 't4'); s.put(x + 1, y, 't3'); s.put(x, y + 1, 't2'); s.put(x + 1, y + 1, 't2')
    return s
