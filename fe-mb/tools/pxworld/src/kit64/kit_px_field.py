"""Filigree kit, world layer: the combat field as 1x pixel art (owner 2026-10-24: "go pixel everywhere").

    field_uri()   a 1280 x 720 PNG data URI. kit.world_field() picks it up on its own.
    SEAMS = False the PNG draws its own grid, so the kit adds no seam overlay.

Geometry is kit_world_field's, unchanged: the 14 x 10 board of 48 px tiles with its top-left at (303, 18), the dirt
tiles and the two boulders on the tiles kit_world_field.DIRT / WALLS name, so every unit still stands where the
engine put it. The world round the board is the painted field's: a sunlit clearing in a broadleaf wood, the wood
close on the west, east and south, open meadow to the north, and the cart track leaving the board at (11, 9)
running south into the trees.

Scale: on the board the units are the 104 x 152 board sprites at half size (52 x 76), so the field is drawn at
half the camp's scale (dirs/px-camp): tufts 3-6 px, a boulder about a tile wide, trees about 150 px tall.
Palette: pxworld.pal ramps only. Light from the north-west: lit NW faces, shadows thrown to the SE as the ground
one ramp step darker with a hard edge. Seams are the ground one step down its own ramp, and the board's rim is a
seam too, so the board reads as a board even where no frame is drawn over it (the field report, the kit panels).

The PNG is built once and cached (in memory, and on disk in dirs/px-combat/cache keyed by this file's source), so
the many boards that call world_field() pay for it once.
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import base64
import hashlib
import io
import math
import os
import random
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

_HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = ROOT + '/src'
if DIRS not in sys.path:
    sys.path.append(DIRS)
from pxworld import pal                                     # noqa: E402
from pxworld.canvas import Sprite, nb, ring, lut            # noqa: E402
from pxworld.pal import ix, CLEAR                           # noqa: E402
from pxworld.terrain import majority                        # noqa: E402

SEAMS = False
W, H = 1280, 720
T, OX, OY, COLS, ROWS = 48, 303, 18, 14, 10
BW, BH = T * COLS, T * ROWS
# kit_world_field's own layout (the engine's Open Ground map): copied, and checked against it when it imports
DIRT = [(2, 1), (3, 1), (1, 2), (2, 2), (3, 2), (4, 2), (5, 2), (2, 3), (3, 3), (4, 3), (5, 3), (6, 3), (3, 4), (4, 4), (5, 4), (6, 4), (7, 4),
        (6, 5), (7, 5), (8, 5), (10, 8), (11, 8), (11, 9)]
WALLS = [(6, 2), (10, 6)]
try:
    import kit_world_field as _WF
    assert (_WF.T, _WF.OX, _WF.OY, _WF.COLS, _WF.ROWS) == (T, OX, OY, COLS, ROWS)
    assert sorted(_WF.DIRT) == sorted(DIRT) and sorted(_WF.WALLS) == sorted(WALLS)
except ImportError:
    pass

G_IDS = set(pal.RAMP['g'])
D_IDS = set(pal.RAMP['d'])
GROUND_IDS = [i for r in ('g', 'd') for i in pal.RAMP[r]]
SX, SY = .42, .17          # the sun: a point z above the ground throws its shadow (z*SX, z*SY) away
LIGHT = np.array([-.5, -.72, .62])
LIGHT /= np.linalg.norm(LIGHT)
LEAF = pal.RAMP['l']


def K(letter, i):
    r = pal.RAMP[letter]
    return r[max(0, min(len(r) - 1, i))]


def grid():
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    return xx + .5, yy + .5


XX, YY = grid()


def tile_rect(c, r):
    return OX + T * c, OY + T * r, T, T


BOARD = (XX >= OX) & (XX < OX + BW) & (YY >= OY) & (YY < OY + BH)


# ================================================================ small helpers (after dirs/px-camp/cpx.py)
def smooth_noise(w, h, cell, seed):
    rng = np.random.RandomState(seed)
    gw, gh = int(w / cell) + 4, int(h / cell) + 4
    gr = rng.uniform(-1, 1, (gh, gw))
    z = ndimage.zoom(gr, ((h + 3 * cell) / gh, (w + 3 * cell) / gw), order=3)[:h, :w]
    return z / (np.abs(z).max() + 1e-9)


def clean(m, k=3):
    st = np.ones((k, k), bool)
    return ndimage.binary_closing(ndimage.binary_opening(m, st), st)


def disk(r):
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    return xx * xx + yy * yy <= r * r + .5


def drop_small(m, min_px=12):
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= min_px
    return keep[lab]


def poisson(rng, x0, y0, x1, y1, mind, tries, ok=None):
    pts = []
    cell = mind / math.sqrt(2)
    grid_ = {}
    for _ in range(tries):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        if ok is not None and not ok(x, y):
            continue
        gx, gy = int((x - x0) / cell), int((y - y0) / cell)
        bad = False
        for j in range(gy - 2, gy + 3):
            for i in range(gx - 2, gx + 3):
                q = grid_.get((i, j))
                if q and (q[0] - x) ** 2 + (q[1] - y) ** 2 < mind * mind:
                    bad = True
                    break
            if bad:
                break
        if not bad:
            grid_[(gx, gy)] = (x, y)
            pts.append((x, y))
    return pts


def catmull(pts, n=12):
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                   + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1])
    return out


def seg_dist(pts, xx=XX, yy=YY):
    best = np.full(xx.shape, 1e9)
    along = np.zeros(xx.shape)
    side = np.zeros(xx.shape)
    run = 0.0
    for i in range(len(pts) - 1):
        ax, ay = pts[i]; bx, by = pts[i + 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9
        t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / L2, 0, 1)
        d = np.hypot(xx - (ax + t * dx), yy - (ay + t * dy))
        m = d < best
        best[m] = d[m]
        along[m] = run + t[m] * math.sqrt(L2)
        side[m] = np.sign(dx * (yy - ay) - dy * (xx - ax))[m]
        run += math.sqrt(L2)
    return best, along, side


def wobble(seed, scale, n=4):
    rng = random.Random(seed)
    terms = [(rng.uniform(.6, 1.0) / (k + 1), scale / (k + 1) * rng.uniform(.8, 1.25), rng.uniform(0, 6.283)) for k in range(n)]
    tot = sum(a for a, _, _ in terms)
    return lambda t: sum(a * np.sin(2 * np.pi * t / lam + ph) for a, lam, ph in terms) / tot


def new(w, h, ax=None, ay=None):
    return Sprite(int(w), int(h), ax, ay)


def put(s, x, y, key):
    x, y = int(x), int(y)
    if 0 <= x < s.w and 0 <= y < s.h:
        s.ix[y, x] = ix(key) if not isinstance(key, (int, np.integer)) else key


# ================================================================ the meadow (after dirs/px-camp/ground.py, at half scale)
SPIKES = [0, 0, 1, 3, 2, 0, 1, 0, 0, 2, 3, 1, 0, 0, 1, 0, 1, 2, 4, 1, 0, 0, 0, 1, 2, 1, 0, 0, 3, 1, 0, 1]


def meadow(seed):
    """g5 with broad g4 shade and g6 sun patches (half-steps: a change of light, never a new colour)."""
    n = smooth_noise(W, H, 150, seed) + .38 * smooth_noise(W, H, 64, seed + 11)
    # on the board the patches are small (a tile or less), so no stretch of tiles reads as a different ground
    nb_ = smooth_noise(W, H, 72, seed + 23) + .4 * smooth_noise(W, H, 28, seed + 29)
    wgt = np.clip(ndimage.distance_transform_edt(~BOARD) / 48, 0, 1)      # eased out over a tile beyond the rim
    n = (1 - wgt) * nb_ + wgt * n
    lo = .74 - .44 * wgt                 # shade patches are rare on the board, sun patches a little less so
    hi = .58 - .28 * wgt
    a = np.full((H, W), ix('g5'), np.uint8)
    a[clean(n < -lo, 7)] = ix('g4')
    a[clean(n > hi, 7)] = ix('g6')
    return a


def serrate(a, region_ids, seed=0):
    """Where one grass tone sits under another, its blades poke up into the tone above."""
    src = a.copy()
    up = nb(src, 0, -1, CLEAR)
    top = np.isin(src, list(region_ids)) & (up != src) & np.isin(up, list(region_ids))
    ys, xs = np.nonzero(top)
    off = random.Random(seed).randint(0, 23)
    for y, x in zip(ys, xs):
        h = SPIKES[(x * 7 + (y // 3) * 5 + off) % len(SPIKES)]
        v = src[y, x]
        for k in range(1, h + 1):
            yy = y - k
            if yy < 0 or src[yy, x] == v or src[yy, x] not in region_ids:
                break
            a[yy, x] = v
    return a


def _blade(L, lean):
    pts, x = [], 0.0
    for k in range(L):
        t = k / max(1, L - 1)
        x += lean * (.35 + .9 * t)
        pts.append((int(round(x)), -k))
    return pts


def tuft_shape(rng, size=1.0):
    """A tuft of blades {(dx, dy): code}: L lit blade, T lit tip, S shaded blade, B root, R root shadow (SE)."""
    n = rng.choice((3, 3, 4, 4, 5)) if size >= .7 else rng.choice((2, 3, 3))
    cells = {}
    for i in range(n):
        f = (i / (n - 1) - .5) if n > 1 else 0
        lean = f * rng.uniform(.4, .9) + rng.uniform(-.15, .15)
        L = max(2, int(round(rng.uniform(4, 8) * size * (1.15 - abs(f) * .6))))
        lit = f < .05
        for k, (dx, dy) in enumerate(_blade(L, lean)):
            p = (dx + int(round(f * 2.4)), dy)
            code = ('T' if k >= L - 1 else 'L') if lit else 'S'
            if k == 0:
                code = 'B'
            if code == 'S' and p in cells and cells[p] in 'LT':
                continue
            cells[p] = code
    xs = [p[0] for p in cells]
    for x in range(min(xs), max(xs) + 2):
        cells.setdefault((x, 1), 'R')
    return cells


TUFT_N = {'L': 2, 'T': 3, 'S': -2, 'B': -3, 'R': -2}


def stamp_tuft(a, x, y, cells, dirt=False, ok=None):
    for (dx, dy), code in cells.items():
        px, py = x + dx, y + dy
        if not (0 <= px < W and 0 <= py < H):
            continue
        if ok is not None and not ok[py, px]:
            continue
        v = int(a[py, px])
        if dirt:
            if v not in D_IDS:
                continue
            a[py, px] = pal.shift_index(v, -1) if code == 'R' else ix({'L': 'g5', 'T': 'g7', 'S': 'g3', 'B': 'g2'}[code])
        elif v in G_IDS:
            a[py, px] = pal.shift_index(v, TUFT_N[code], fine=True)


def tufts(a, rng, pts, size=1.0, dirt=False, ok=None):
    for (x, y) in pts:
        stamp_tuft(a, int(x), int(y), tuft_shape(rng, size * rng.uniform(.8, 1.2)), dirt, ok)


def clump(a, rng, x, y, w=10, h=8):
    """A tall clump of grass: blades fanning from one root, lit on the west, a root shadow to the SE."""
    n = max(5, int(w * .8))
    for i in range(n):
        f = i / (n - 1) - .5
        bx = x + f * w * .8
        L = int(round(h * (1 - abs(f) * 1.1) * rng.uniform(.7, 1.05)))
        if L < 2:
            continue
        lean = f * 1.3 + rng.uniform(-.2, .2)
        lit = f < .1
        for k, (dx, dy) in enumerate(_blade(L, lean)):
            px, py = int(round(bx + dx)), y + dy
            if not (0 <= px < W and 0 <= py < H):
                continue
            key = 'g2' if k < 1 else (('g8' if k >= L - 1 else ('g7' if k > L * .5 else 'g5')) if lit else ('g4' if k > L * .6 else 'g3'))
            a[py, px] = ix(key)
    for xx in range(int(x - w * .4), int(x + w * .5) + 2):
        if 0 <= xx < W and y + 1 < H and a[y + 1, xx] in G_IDS:
            a[y + 1, xx] = pal.shift_index(int(a[y + 1, xx]), -2, fine=True)


FLOWER = {'bone': ('b5', 'b3'), 'straw': ('o5', 'o3'), 'rose': ('x5', 'x3'), 'sky': ('s5', 's3')}


def flowers(a, rng, centres, kinds=('bone', 'bone', 'straw', 'rose', 'sky'), per=(2, 4), spread=(7, 4), ok=None):
    """Flower clusters: a 2 px head (lit, with one pixel of its shade), a 1 px stem shadow under it."""
    for (cx, cy) in centres:
        hi, lo = FLOWER[rng.choice(kinds)]
        for _ in range(rng.randint(*per)):
            x, y = int(cx + rng.randint(-spread[0], spread[0])), int(cy + rng.randint(-spread[1], spread[1]))
            if not (2 <= x < W - 3 and 3 <= y < H - 2):
                continue
            if any(a[y + j, x + i] not in G_IDS for i in (-1, 0, 1, 2) for j in (-2, -1, 0, 1)):
                continue
            if ok is not None and not ok[y, x]:
                continue
            a[y - 1, x] = ix(hi); a[y - 1, x + 1] = ix(lo)
            a[y, x] = pal.shift_index(int(a[y, x]), -2, fine=True)
            a[y + 1, x + 1] = pal.shift_index(int(a[y + 1, x + 1]), -2, fine=True)


MARKS = [["1.1", ".1."], ["1", "1"], [".1", "1."], ["1.", ".1"]]


def blade_marks(a, rng, pts):
    """The meadow's fine texture: tiny V and blade marks one step down, so no patch is a flat fill."""
    for (x, y) in pts:
        rows = rng.choice(MARKS)
        x, y = int(x), int(y)
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                px, py = x + i, y + j
                if ch != '.' and 0 <= px < W and 0 <= py < H and a[py, px] in G_IDS:
                    a[py, px] = pal.shift_index(int(a[py, px]), -2, fine=True)


def pebble(a, x, y, rng, big=False, ramp='t', lift=0):
    """A pebble: lit cap, own shade, a hard shadow below-right on the ground."""
    small = [["45", "32"], ["554", "432"], [".5.", "543", ".3."]]
    large = [[".554.", "55443", "44332", ".322."], [".55.", "5543", "4432", ".33."]]
    sh = rng.choice(large if big else small)
    for j, row in enumerate(sh):
        for i, ch in enumerate(row):
            px, py = x + i + 1, y + j + 1
            if ch != '.' and 0 <= px < W and 0 <= py < H and a[py, px] in G_IDS | D_IDS:
                a[py, px] = pal.shift_index(int(a[py, px]), -1)
    for j, row in enumerate(sh):
        for i, ch in enumerate(row):
            px, py = x + i, y + j
            if ch != '.' and 0 <= px < W and 0 <= py < H:
                a[py, px] = K(ramp, int(ch) + lift)


# ================================================================ dirt
CLODS = [
    ([".5.", "545", ".3."], 'clod'), (["54", "43"], 'clod'), ([".55.", "5443", ".33."], 'clod'),
    (["33", ".5"], 'dent'), (["333", ".55"], 'dent'), ([".3.", "3.5", ".5."], 'dent'),
]


def dirt_texture(a, m, rng, density=1.0, base='d4'):
    """Sun-baked crust a step lighter in broken patches, clods lit on their caps, dents shaded on their lips."""
    b = ix(base)
    ys, xs = np.nonzero(m)
    if not len(xs):
        return
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    n = smooth_noise(x1 - x0, y1 - y0, 8, rng.randint(0, 999)) + .5 * smooth_noise(x1 - x0, y1 - y0, 4, rng.randint(0, 999))
    sub = a[y0:y1, x0:x1]
    mm = m[y0:y1, x0:x1] & (sub == b)
    cross = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)
    crust = drop_small(ndimage.binary_closing(ndimage.binary_opening(n > .6, cross), cross), 6)
    sub[crust & mm] = pal.shift_index(b, 1)
    pts = poisson(rng, x0, y0, x1, y1, 9.0 / math.sqrt(density), int((x1 - x0) * (y1 - y0) / 25))
    for (x, y) in pts:
        x, y = int(x), int(y)
        if not m[y, x]:
            continue
        rows, kind = rng.choice(CLODS)
        if not all(m[min(H - 1, y + j), min(W - 1, x + i)] for j, r in enumerate(rows) for i, ch in enumerate(r) if ch != '.'):
            continue
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == '.':
                    continue
                v = int(a[y + j, x + i])
                if v in D_IDS:
                    a[y + j, x + i] = K('d', pal.LEVEL[v] + {'5': 1, '4': 0, '3': -1}[ch])


def grass_over_dirt(a, m, seed=1):
    """At dirt's south edges the turf below pokes blades up into it; the turf's own top row darkens (its side)."""
    src = a.copy()
    off = random.Random(seed).randint(0, 23)
    turf = ~m & nb(m, 0, 1, False) & np.isin(src, list(G_IDS))
    a[turf] = lut(-2, True)[src[turf]]
    edge = ~m & nb(m, 0, -1, False) & np.isin(src, list(G_IDS))
    ys, xs = np.nonzero(edge)
    for y, x in zip(ys, xs):
        h = SPIKES[(x * 5 + off) % len(SPIKES)]
        h = h + (1 if h else 0)
        v = int(src[y, x])
        for k in range(1, h + 1):
            yy = y - k
            if yy < 0 or not m[yy, x]:
                break
            a[yy, x] = pal.shift_index(v, 2 if k == h else 0, fine=True)


def dirt_mask(seed, track):
    """The dirt tiles as one worn patch: the union of their squares, outer corners rounded (r 7), inner corners
    eased (r 3), the edge roughened by 1-2 px so it reads as ground while staying on the tile lines."""
    D = np.zeros((H, W), bool)
    for c, r in DIRT:
        x, y, w, h = tile_rect(c, r)
        D[y:y + h, x:x + w] = True
    D |= track
    D = ndimage.binary_opening(D, disk(7))
    D = ndimage.binary_closing(D, disk(3))
    D |= track
    sdf = ndimage.distance_transform_edt(D) - ndimage.distance_transform_edt(~D)
    f = sdf + 1.7 * smooth_noise(W, H, 14, seed + 1) + .9 * smooth_noise(W, H, 6, seed + 2)
    m = clean(f > 0, 3)
    return drop_small(m, 40) & ~drop_small(~m, 30) | (track & (sdf > 2))


# ================================================================ standing things: crowns, trunks, bushes, boulders
def crown(rx, ry, seed=0, lift=0, density=1.0, leaf=.62, deep=False):
    """A broadleaf crown lit as one ball from the north-west (after dirs/px-camp/bigtree.py, at half scale):
    clump domes, quantised to five Leaf tones, every tone boundary broken into leaf scallops `leaf` x the camp's
    size, leaf marks inside each tone, a darker underside, an l0 outline (l1 on the lit shoulder).
    Returns (Sprite anchored at the crown centre, silhouette)."""
    rng = random.Random(seed)
    sp = 36 * leaf * .72 / density
    pad = int(sp * .9) + 6
    Wc, Hc = int(2 * rx + 2 * pad), int(2 * ry + 2 * pad)
    s = new(Wc, Hc, Wc // 2, Hc // 2)
    cx, cy = Wc / 2, Hc / 2
    yy, xx = np.mgrid[0:Hc, 0:Wc].astype(float) + .5
    pts = poisson(rng, cx - rx, cy - ry, cx + rx, cy + ry, sp, 3000,
                  ok=lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < .8)
    ne = int(2 * math.pi * math.sqrt((rx * rx + ry * ry) / 2) / (sp * .8))
    a0 = rng.uniform(0, 6.28)
    for k in range(ne):
        a = a0 + 2 * math.pi * k / ne + rng.uniform(-.1, .1)
        d = rng.uniform(.82, .94)
        pts.append((cx + math.cos(a) * rx * d, cy + math.sin(a) * ry * d))
    best = np.full((Hc, Wc), -1e9)
    nrm = np.zeros((Hc, Wc, 3))
    for (x, y) in pts:
        r = sp * rng.uniform(.66, .86)
        d2 = (xx - x) ** 2 + ((yy - y) / .9) ** 2
        inside = d2 < r * r
        hgt = np.sqrt(np.maximum(0, r * r - d2)) + .25 * r * (1 - ((y - cy) / ry))
        mm = inside & (hgt > best)
        best[mm] = hgt[mm]
        nz = np.sqrt(np.maximum(0, r * r - d2)) / r
        nrm[mm, 0] = ((xx - x) / r)[mm]
        nrm[mm, 1] = ((yy - y) / r)[mm]
        nrm[mm, 2] = nz[mm]
    sil = ndimage.binary_fill_holes(best > -1e8)
    gx, gy = (xx - cx) / rx, (yy - cy) / ry
    gz = np.sqrt(np.maximum(0, 1 - gx * gx - gy * gy))
    bball = gx * LIGHT[0] + gy * LIGHT[1] + gz * LIGHT[2] - .15 * gy
    b = .5 * (nrm @ LIGHT) + .6 * bball
    vals = b[sil]
    levels = [LEAF[min(6, i + lift)] for i in (1, 2, 3, 4, 5)]
    th = np.quantile(vals, [.3, .56, .78, .93] if deep else [.16, .4, .66, .88])
    q = np.zeros((Hc, Wc), int)
    for t_ in th:
        q += b > t_
    tone = np.array(levels, np.uint8)[np.minimum(q, 4)]
    tone[~sil] = levels[0]
    majority(tone, levels, passes=2, size=5)
    qq = np.zeros((Hc, Wc), int)
    for i, lv in enumerate(levels):
        qq[tone == lv] = i
    edge = np.zeros((Hc, Wc), bool)
    for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
        edge |= (nb(qq, dx, dy, -1) != qq) & sil
    near = ndimage.binary_dilation(edge, np.ones((5, 5), bool)) & sil
    cells = poisson(rng, cx - rx - 6, cy - ry - 6, cx + rx + 6, cy + ry + 6, 3.4 * leaf * 1.1, 30000,
                    ok=lambda x, y: 0 <= int(y) < Hc and 0 <= int(x) < Wc and near[int(y), int(x)])
    out = tone.copy()
    for (t_, _, x, y) in sorted(((qq[int(y), int(x)], rng.random(), x, y) for (x, y) in cells)):
        r1 = rng.uniform(2.4, 3.4) * leaf * 1.1
        x0, x1 = int(x - r1 - 1), int(x + r1 + 2)
        y0, y1 = int(y - r1 - 1), int(y + r1 + 2)
        sub = (xx[y0:y1, x0:x1] - x) ** 2 / (r1 * r1) + (yy[y0:y1, x0:x1] - y) ** 2 / (r1 * r1 * .72) <= 1
        sub &= sil[y0:y1, x0:x1]
        out[y0:y1, x0:x1][sub] = levels[t_]
    tone = out
    marks = poisson(rng, cx - rx, cy - ry, cx + rx, cy + ry, 7.5 * leaf, 6000,
                    ok=lambda x, y: 1 <= int(y) < Hc - 2 and 0 <= int(x) < Wc - 3 and sil[int(y), int(x)] and not near[int(y), int(x)])
    med = np.quantile(vals, .5)
    for (x, y) in marks:
        x, y = int(x), int(y)
        t_ = qq[y, x]
        k = min(4, t_ + 1) if b[y, x] > med else max(0, t_ - 1)
        if k == t_:
            continue
        for (dx, dy) in rng.choice([[(0, 0), (1, 0), (2, -1)], [(0, 0), (1, -1)], [(0, 0), (1, 0)]]):
            if sil[y + dy, x + dx]:
                tone[y + dy, x + dx] = levels[k]
        if t_ == 4 and rng.random() < .4:
            tone[y - 1, x] = LEAF[6]
    s.ix[sil] = tone[sil]
    bot = sil & ~nb(sil, 0, 2) & (yy > cy - ry * .2)
    s.ix[bot] = lut(-1)[s.ix[bot]]
    s.despeckle(1)
    rg = ring(np.pad(sil, 1), 4)[1:-1, 1:-1]
    upl = rg & (nb(sil, 1, 0) | nb(sil, 0, 1)) & ~nb(sil, -1, 0) & ~nb(sil, 0, -1)
    s.ix[rg] = ix('l0')
    s.ix[upl & (yy < cy)] = ix('l1')
    return s, sil


def trunk(h, w, seed=0):
    """A Walnut trunk h tall, w wide at the flaring root, lit on its west side, fissured. Anchor = base centre."""
    rng = random.Random(seed)
    Wt, Ht = w * 3 + 12, h + 8
    s = new(Wt, Ht, Wt // 2, Ht - 3)
    cx, base = Wt / 2, Ht - 3
    yy, xx = np.mgrid[0:Ht, 0:Wt].astype(float) + .5
    t = (base - yy) / h
    half = w / 2 * (1 - .28 * np.clip(t, 0, 1)) + (np.clip(.14 - t, 0, 1) / .14) ** 2 * w * .5
    lean = 1.5 * np.sin(t * 2.2 + seed)
    m = (np.abs(xx - cx - lean) <= half) & (t >= 0) & (t <= 1)
    u = (xx - cx - lean) / np.maximum(half, 1)
    tone = np.full((Ht, Wt), ix('w4'), np.uint8)
    tone[u < -.35] = ix('w5')
    tone[u < -.75] = ix('w6')
    tone[u > .25] = ix('w3')
    tone[u > .62] = ix('w2')
    s.ix[m] = tone[m]
    for k in range(max(1, int(w / 4))):
        x = cx - w / 2 + 2.5 + k * 4 + rng.uniform(-.6, .6)
        y = base - rng.uniform(0, 6)
        while y > base - h + 3:
            seg = rng.uniform(6, 18)
            for j in range(int(seg)):
                py = int(y - j)
                if py < 0:
                    break
                tx = x + 1.5 * math.sin((base - py) / h * 2.2 + seed)
                tx = tx * (1 - .28 * (base - py) / h) + cx * .28 * (base - py) / h
                px = int(round(tx))
                if 0 < px < Wt - 1 and m[py, px] and m[py, px - 1] and m[py, px + 1]:
                    s.ix[py, px] = pal.shift_index(int(tone[py, px]), -2)
                    if tone[py, px - 1] in (ix('w4'), ix('w3')):
                        s.ix[py, px - 1] = pal.shift_index(int(tone[py, px - 1]), 1)
            y -= seg + rng.uniform(3, 6)
    rg = ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    s.ix[rg] = ix('w0')
    return s


def tree(rx, ry, h, w, seed=0, lift=0):
    """A whole broadleaf: trunk, two limbs into the crown, the crown. Anchor = the trunk's foot."""
    tr = trunk(h + int(ry * .5), w, seed)
    cr, _ = crown(rx, ry, seed, lift)
    Wt = max(cr.w, tr.w)
    Ht = h + int(ry * .35) + cr.h // 2 + 8
    s = new(Wt, Ht, Wt // 2, Ht - 3)
    ccx, ccy = s.ax, s.ay - h - int(ry * .35)
    s.blit(tr, s.ax - tr.ax, s.ay - tr.ay)
    for (dx, k) in ((-1, .6), (1, .8)):
        for j in range(int(ry * .6)):
            px = s.ax + dx * j * k * .9
            py = s.ay - h + 4 - j
            for i in range(-1, 2):
                put(s, px + i, py, 'w5' if i < 0 else ('w3' if i > 0 else 'w4'))      # lit west, shaded east
            put(s, px - 2, py, 'w0'); put(s, px + 2, py, 'w0')
    s.blit(cr, ccx - cr.ax, ccy - cr.ay)
    return s


def bush(rx, ry, seed=0, lift=1):
    """A low shrub of a few small clumps, flat where it meets the ground, darker at its foot. Anchor = foot."""
    rng = random.Random(seed)
    n = rng.choice((3, 4))
    parts = []
    for k in range(n):
        f = (k / (n - 1) - .5) if n > 1 else 0
        r1 = rx * rng.uniform(.5, .66)
        parts.append((f * rx * .9, -ry * rng.uniform(.4, .7) * (1.15 - abs(f)), r1, r1 * ry / rx * 1.1))
    Wb, Hb = int(2 * rx + 30), int(2 * ry + 24)
    s = new(Wb, Hb, Wb // 2, Hb - 5)
    for (dx, dy, r1, r2) in sorted(parts, key=lambda p: -p[1]):
        cr, _ = crown(r1, r2, rng.randint(0, 9999), lift=lift, density=1.6, leaf=.55)
        s.blit(cr, int(s.ax + dx - cr.ax), int(s.ay + dy - cr.ay))
    s.ix[s.ay + 1:, :] = CLEAR
    m = s.ix != CLEAR
    foot = m & ~nb(m, 0, 2)
    s.ix[foot] = lut(-1)[s.ix[foot]]
    rg = ring(np.pad(m, 1), 4)[1:-1, 1:-1] & (s.ix == CLEAR)
    s.ix[rg] = ix('l0')
    return s.trimmed()


def boulder(w, h, seed=0, moss=True):
    """A field boulder about w x h: a lumpy dome on a flat-ish foot, cut into Voronoi facets lit from the NW,
    fine cracks on the shaded side, a chipped lit edge, moss and lichen low on its north and west, a Stone
    selout (t2 lit, t1 shade). Anchor = middle of its foot."""
    rng = random.Random(seed)
    Wb, Hb = w + 8, int(h * 1.3) + 8
    yy, xx = np.mgrid[0:Hb, 0:Wb].astype(float) + .5
    cx, base = Wb / 2 + rng.uniform(-1, 1), Hb - 3.5
    # the outline: a dome over a nearly flat foot (a superellipse split at its widest line), a few lobes, the
    # west shoulder a little higher; sized so the whole stone is about w x h and never touches its box
    mid = base - h * .38
    ang = np.arctan2(yy - mid, xx - cx)
    lob = 1 + .06 * np.sin(3 * ang + rng.uniform(0, 6)) + .04 * np.sin(5 * ang + rng.uniform(0, 6))
    u = (xx - cx) / (w / 2)
    hump = 1 + .08 * np.clip(-u, 0, 1)
    top = yy < mid
    v = (yy - mid) / np.where(top, h * .58 * hump, h * .38)
    M = (np.abs(u) ** 2.0 + np.abs(v) ** np.where(top, 2.0, 2.8)) <= lob
    M = clean(M, 3) & (yy <= base)
    s = new(Wb, Hb, int(round(cx)), int(base))
    # facets: a few big flat planes (Voronoi cells about a third of the stone across), each one tone by how its
    # plane faces the north-west light, tilted out from a dome whose crown sits up and to the west
    ys, xs = np.nonzero(M)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    dcx, dcy = x0 + (x1 - x0) * .42, y0 + (y1 - y0) * .32
    drx, dry = (x1 - x0) / 2 + 1, (y1 - y0) * .78 + 1
    spc = max(5.0, w / 3.4)
    seeds = []
    for _ in range(3000):
        k = rng.randrange(len(xs))
        p = (xs[k] + .5, ys[k] + .5)
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= spc * spc for q in seeds):
            seeds.append(p)
    best = np.full(M.shape, 1e9)
    lab = np.zeros(M.shape, int)
    for i, (sx, sy) in enumerate(seeds):
        d = (xx - sx) ** 2 + ((yy - sy) * 1.15) ** 2
        mm = d < best
        best[mm] = d[mm]
        lab[mm] = i
    Lr = np.array([-.55, -.7, .45]); Lr /= np.linalg.norm(Lr)
    lv = np.zeros(len(seeds), int)
    for i, (sx, sy) in enumerate(seeds):
        nx = (sx - dcx) / drx + rng.uniform(-.2, .2)
        ny = (sy - dcy) / dry + rng.uniform(-.2, .2)
        nz = math.sqrt(max(.05, 1 - min(1, nx * nx + ny * ny)))
        nrm = np.array([nx, ny, nz]); nrm /= np.linalg.norm(nrm)
        bb = float(nrm @ Lr)
        lv[i] = 0 if bb > .8 else (1 if bb > .55 else (2 if bb > .25 else (3 if bb > -.05 else 4)))
    TONES = ('t6', 't5', 't4', 't3', 't2')
    keys = np.array([ix(t) for t in TONES], np.uint8)
    L_ = lv[lab]
    s.ix[M] = keys[L_][M]
    # cracks: where a facet meets a darker one on the shaded side, the darker plane's edge one step down
    seam = M & ((lab != nb(lab, 1, 0, -1)) | (lab != nb(lab, 0, 1, -1)))
    shade_side = (xx > dcx - 2) | (yy > dcy + 3)
    crk = seam & shade_side & (L_ >= 2)
    s.ix[crk] = lut(-1)[s.ix[crk]]
    # the lit rim: the top-left edge of the lit facets catches the sun
    rim = M & (~nb(M, 0, -1, False) | ~nb(M, -1, 0, False)) & (L_ <= 1) & (yy < base - h * .3)
    s.ix[rim] = ix('t6')
    # a chip on the lit shoulder: a notch of shade with a lit floor
    chx, chy = int(dcx - drx * .25), int(dcy + 2)
    for (dx, dy, k) in ((0, 0, 't3'), (1, 0, 't3'), (0, 1, 't5'), (1, 1, 't6'), (2, 1, 't5')):
        if M[chy + dy, chx + dx]:
            put(s, chx + dx, chy + dy, k)
    # the foot: the underside in shade, darkest at the contact line
    bot = M & ~nb(M, 0, 1)
    s.ix[bot] = ix('t1')
    low = M & ~bot & ~nb(M, 0, 3) & (yy > base - h * .35)
    s.ix[low] = lut(-1)[s.ix[low]]
    if moss:
        # moss in patches on the damp skirt, thickest on the north-west, and a few lichen flecks on the crown
        mn = smooth_noise(Wb, 1, 6, seed + 5)[0]
        for x in range(Wb):
            col = np.nonzero(M[:, x])[0]
            if not len(col):
                continue
            y1 = col.max()
            hm = int(round(1.2 + 2.6 * (1 - x / Wb) + 2.2 * mn[x]))
            for j in range(max(0, hm)):
                yy_ = y1 - 1 - j
                if M[yy_, x]:
                    s.ix[yy_, x] = ix('m4' if j == hm - 1 and x < Wb * .5 else ('m3' if j == hm - 1 else 'm2'))
        for _ in range(int(w * h / 160)):
            x, y = int(rng.uniform(cx - w * .3, cx + w * .15)), int(rng.uniform(base - h * .92, base - h * .6))
            if M[y, x] and M[y, x + 1] and pal.LEVEL[int(s.ix[y, x])] >= 4:
                s.ix[y, x] = ix('m4'); s.ix[y, x + 1] = ix('m3')
    s.despeckle(1)
    from pxworld.build import selout
    selout(s)
    return s.trimmed()


# ================================================================ the stage: shadows on the ground, then y-sorted sprites
class Stage:
    def __init__(self, a):
        self.a = a
        self.shadow = np.zeros((H, W), bool)
        self.items = []

    def add(self, spr, fx, fy, z=None, flip=False):
        self.items.append((fy if z is None else z, spr, int(round(fx)), int(round(fy)), flip))

    def throw(self, spr, fx, fy, zcap=None, dapple=0, clip=None, base=0):
        """Throw a standing sprite's silhouette along the ground: a pixel z above its foot lands (z*SX, z*SY) away.
        base lifts the whole sprite (a crown on a trunk), clip limits where the shadow may fall."""
        a = spr.ix != CLEAR
        ys, xs = np.nonzero(a)
        if not len(xs):
            return
        z = np.maximum(0, spr.ay - ys).astype(float) + base
        if zcap is not None:
            z = np.minimum(z, zcap)
        px = np.round(fx - spr.ax + xs + z * SX).astype(int)
        py = np.round(fy + z * SY).astype(int)
        # work in a local window round the shadow, then merge it into the stage's
        X0, Y0 = px.min() - 8, py.min() - 8
        X1, Y1 = px.max() + 9, py.max() + 9
        m = np.zeros((Y1 - Y0, X1 - X0), bool)
        m[py - Y0, px - X0] = True
        m = ndimage.binary_closing(m, np.ones((3, 3), bool))
        m = ndimage.binary_fill_holes(m)
        if dapple:
            rng = random.Random(dapple)
            ly, lx = np.mgrid[0:m.shape[0], 0:m.shape[1]].astype(float) + .5
            ys2, xs2 = np.nonzero(m)
            if len(xs2):
                inner = ndimage.binary_erosion(m, np.ones((7, 7), bool))
                edge_ = m & ~ndimage.binary_erosion(m, np.ones((3, 3), bool))
                eys, exs = np.nonzero(edge_)
                for k in range(0, len(exs), 8):
                    r1 = rng.uniform(2.5, 5)
                    e = ((lx - exs[k] - rng.uniform(-1, 1)) / r1) ** 2 + ((ly - eys[k]) / (r1 * .5)) ** 2 <= 1
                    if rng.random() < .5:
                        m |= e
                    else:
                        m &= ~(e & ~inner)
                for (fx_, fy_) in poisson(rng, xs2.min(), ys2.min(), xs2.max(), ys2.max(), 13, 300):
                    if inner[int(fy_), int(fx_)]:
                        r1 = rng.uniform(1.6, 3.0)
                        m &= ~(((lx - fx_) / r1) ** 2 + ((ly - fy_) / (r1 * .5)) ** 2 <= 1)
        cx0, cy0, cx1, cy1 = max(0, X0), max(0, Y0), min(W, X1), min(H, Y1)
        if cx1 <= cx0 or cy1 <= cy0:
            return
        sub = m[cy0 - Y0:cy1 - Y0, cx0 - X0:cx1 - X0]
        if clip is not None:
            sub = sub & clip[cy0:cy1, cx0:cx1]
        self.shadow[cy0:cy1, cx0:cx1] |= sub

    def throw_ell(self, cx, cy, rx, ry, clip=None):
        m = ((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2 <= 1
        if clip is not None:
            m &= clip
        self.shadow |= m

    def render(self):
        a = self.a
        sh = self.shadow & np.isin(a, GROUND_IDS)
        a[sh] = lut(-1)[a[sh]]
        for (z, spr, x, y, flip) in sorted(self.items, key=lambda t: (t[0], t[2])):
            src = spr.ix[:, ::-1] if flip else spr.ix
            ax = (spr.w - 1 - spr.ax) if flip else spr.ax
            x0, y0 = x - ax, y - spr.ay
            cx0, cy0 = max(0, x0), max(0, y0)
            cx1, cy1 = min(W, x0 + spr.w), min(H, y0 + spr.h)
            if cx1 <= cx0 or cy1 <= cy0:
                continue
            s = src[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
            d = a[cy0:cy1, cx0:cx1]
            mm = s != CLEAR
            d[mm] = s[mm]
        return a


# ================================================================ the field
TRACK = [(855, 470), (856, 500), (858, 545), (863, 600), (871, 660), (878, 730)]


def build(seed=5):
    rng = random.Random(seed)
    a = meadow(seed)
    serrate(a, {ix('g4'), ix('g5'), ix('g6')}, seed)

    # ---- the cart track south out of (11, 9), and the dirt
    td, talong, tside = seg_dist(catmull(TRACK, 10))
    thw = 19 + wobble(seed + 3, 80)(talong) * 1.5 - np.clip((YY - 520) / 200, 0, 1) * 3
    track = (td <= thw) & (YY >= OY + BH - 30)
    dirt = dirt_mask(seed, track)
    a[dirt] = ix('d4')
    # the trodden way across the patch: the painted field's worn line from the north-west to the south-east,
    # a broad band a step darker in broken lengths (feet and hooves keep to it), never a groove
    WAY = [(2, 1), (3, 2), (4, 3), (5, 4), (6, 4), (7, 5), (8, 5)]
    inner = ndimage.binary_erosion(dirt, disk(5))
    pts = catmull([(OX + T * c + T / 2, OY + T * r + T / 2) for c, r in WAY], 10)
    d, along, side = seg_dist(pts)
    band = inner & (d < 14)
    for (x, y) in poisson(rng, OX, OY, OX + BW, OY + BH, 7, 8000):
        x, y = int(x), int(y)
        if not band[y, x] or rng.random() < .35:
            continue
        if rng.random() < .8:      # a boot's heel-scrape: a short dark crescent with a lit lip under it
            L = rng.choice((3, 4, 4, 5))
            for i in range(L):
                yy_ = y + (1 if i in (0, L - 1) else 0)
                if inner[yy_, x + i] and inner[yy_ + 1, x + i]:
                    a[yy_, x + i] = ix('d3')
                    if i not in (0, L - 1):
                        a[yy_ + 1, x + i] = ix('d5')
        else:                      # a hoofprint: a shaded U open to the south, its floor lit
            for (dx, dy, k) in ((0, 0, 'd3'), (1, 0, 'd3'), (2, 0, 'd3'), (0, 1, 'd3'), (2, 1, 'd3'), (1, 1, 'd5')):
                if inner[y + dy, x + dx]:
                    a[y + dy, x + dx] = ix(k)
    band = np.zeros((H, W), bool)
    # the track's own ruts, running on south into the trees
    for j, off in enumerate((-7, 7)):
        wob = wobble(seed + 40 + j, 70)(talong) * 1.0
        g_ = track & ndimage.binary_erosion(dirt, disk(3)) & (np.abs(td * tside - off - wob) < 1.1) & (YY > OY + T * 8 + 20)
        g_ = drop_small(g_, 8)
        a[g_] = ix('d3')
        a[g_ & ~nb(g_, 0, -1, False)] = ix('d2')
        a[~g_ & nb(g_, 0, -1, False) & dirt & ~np.isin(a, [ix('d2'), ix('d3')])] = ix('d5')
    ruts = np.isin(a, [ix('d2'), ix('d3')]) & dirt & track & ~band
    dirt_texture(a, dirt & ~ruts & ~nb(ruts, 0, 1, False), rng, 1.0)
    # the lip: grass to the north and west throws a 1 px shadow onto the dirt
    a[dirt & (~nb(dirt, 0, -1, True) | ~nb(dirt, -1, 0, True))] = ix('d3')
    grass_over_dirt(a, dirt, seed)
    # grass creeping back in at the dirt's edge, sparse on the board so a dirt tile stays a dirt tile
    din = ndimage.distance_transform_edt(dirt)
    near = (din > 1.5) & (din < 9)
    pts = [p for p in poisson(rng, 0, 0, W, H, 11, 9000) if near[int(p[1]), int(p[0])] and rng.random() < .5 - din[int(p[1]), int(p[0])] / 20]
    tufts(a, rng, pts, .5, dirt=True)
    # pebbles on the dirt
    pts = [p for p in poisson(rng, 0, 0, W, H, 21, 6000) if din[int(p[1]), int(p[0])] > 4 and not ruts[int(p[1]), int(p[0])]]
    for (x, y) in pts:
        r_ = rng.random()
        if r_ < .6:
            pebble(a, int(x), int(y), rng, big=r_ < .08, ramp='t' if r_ < .35 else 'd', lift=0 if r_ < .35 else 1)

    # ---- the meadow: calm on the board (short, sparse tufts), longer and wilder off it
    dout = ndimage.distance_transform_edt(~dirt)
    grass = ~dirt
    dens = smooth_noise(W, H, 60, seed + 77)
    wild = ~ndimage.binary_dilation(BOARD, disk(2))
    pts = [p for p in poisson(rng, 0, 0, W, H, 10, 30000) if grass[int(p[1]), int(p[0])]
           and rng.random() < (.24 + .5 * max(0, dens[int(p[1]), int(p[0])]) if BOARD[int(p[1]), int(p[0])] else .5 + .5 * max(0, dens[int(p[1]), int(p[0])]))]
    for (x, y) in pts:
        stamp_tuft(a, int(x), int(y), tuft_shape(rng, (.62 if BOARD[int(y), int(x)] else .85) * rng.uniform(.8, 1.2)))
    pts = [p for p in poisson(rng, 0, 0, W, H, 6, 60000) if grass[int(p[1]), int(p[0])] and rng.random() < .3 + .4 * max(0, dens[int(p[1]), int(p[0])])]
    blade_marks(a, rng, pts)
    # grass is longer along the dirt's edge
    edge = grass & (dout < 7) & (dout > 1)
    pts = [p for p in poisson(rng, 0, 0, W, H, 8, 14000) if edge[int(p[1]), int(p[0])]]
    tufts(a, rng, pts, .72)
    # clumps: a few on the board's grass, many in the wild verge
    pts = [p for p in poisson(rng, 0, 0, W, H, 34, 4000) if grass[int(p[1]), int(p[0])] and dout[int(p[1]), int(p[0])] > 4]
    for (x, y) in pts:
        onb = BOARD[int(y), int(x)]
        if (onb and rng.random() < .22) or (not onb and rng.random() < .8):
            clump(a, rng, int(x), int(y), rng.choice((8, 10, 12)) if not onb else rng.choice((7, 8)),
                  rng.choice((6, 7, 9)) if not onb else rng.choice((5, 6)))
    cen = [p for p in poisson(rng, 0, 0, W, H, 70, 1500) if grass[int(p[1]), int(p[0])] and dout[int(p[1]), int(p[0])] > 10]
    flowers(a, rng, [p for p in cen if BOARD[int(p[1]), int(p[0])]][:16], per=(2, 3))
    flowers(a, rng, [p for p in cen if not BOARD[int(p[1]), int(p[0])]], per=(3, 5))
    # stones in the wild grass
    for (x, y) in poisson(rng, 0, 0, W, H, 60, 800):
        if wild[int(y), int(x)] and grass[int(y), int(x)] and rng.random() < .35:
            pebble(a, int(x), int(y), rng, big=rng.random() < .3)
    return a, dict(dirt=dirt, track=track, td=td, talong=talong)


def seams(a):
    """The grid: every seam is the ground one step down its own ramp (grass a full step, two half-steps),
    with the board's rim drawn the same way just outside its edge."""
    m = np.zeros((H, W), bool)
    for c in range(1, COLS):
        m[OY:OY + BH, OX + T * c] = True
    for r in range(1, ROWS):
        m[OY + T * r, OX:OX + BW] = True
    rim = np.zeros((H, W), bool)
    rim[OY - 1, OX - 1:OX + BW + 1] = True
    rim[OY + BH, OX - 1:OX + BW + 1] = True
    rim[OY - 1:OY + BH + 1, OX - 1] = True
    rim[OY - 1:OY + BH + 1, OX + BW] = True
    sel = (m | rim) & np.isin(a, GROUND_IDS)
    a[sel] = lut(-1)[a[sel]]
    return a


def woods(st, info, seed=5):
    """The broadleaf wood close round the clearing: a front row with trunks and dappled shade on the west and
    east, a sea of crowns over a dark understory to the south, parted by the track; shrubs at its edge."""
    rng = random.Random(seed + 100)
    a = st.a
    off_board = ~ndimage.binary_dilation(BOARD, disk(3))
    keep_off = off_board.copy()
    keep_off[:, OX - 4:OX + BW + 4] &= (YY[:, OX - 4:OX + BW + 4] > OY + BH + 3)   # nothing on the board, nor in the board's columns above its foot
    # -- the south: understory, then crowns row by row (north row first)
    track = info['track']
    tdist = info['td']
    corridor = tdist < 30
    edge_y = 574 + 6 * wobble(seed + 7, 160)(XX[0])               # the crowns' centre line of the front row
    under = (YY > edge_y[None, :] + 4) & ~(corridor & (YY < 610))
    a[under & ~track] = ix('l1')
    a[under & ~track & ((XX + YY * 2) % 7 == 0) & (YY > 640)] = ix('l0')
    crowns = []
    def track_x(y):
        return 862 + (y - 574) * .12
    x = -30
    while x < W + 40:                                   # the front row: the treeline facing the clearing
        rx = rng.uniform(40, 60)
        cx = x + rx * .8
        if abs(cx - track_x(574)) > rx + 30:
            crowns.append((cx, edge_y[int(min(W - 1, max(0, cx)))] + rng.uniform(-4, 6) + (60 - rx) * .25, rx, rng.random()))
        x = cx + rx * rng.uniform(.6, .85)
    for (cx, cy) in poisson(rng, -60, 610, W + 60, 790, 46, 6000):
        rx = rng.uniform(42, 64)
        if abs(cx - track_x(cy)) > rx * (.95 if cy < 660 else .45) + (26 if cy < 660 else 4):
            crowns.append((cx, cy, rx, rng.random()))
    for i, (cx, cy, rx, tone) in enumerate(crowns):
        cr, _ = crown(rx, rx * .86, seed * 31 + i, lift=1 if tone > .82 else 0, deep=tone < .3)
        st.add(cr, cx, cy, z=cy + 2000)
    # where the track goes in under the trees it walks in their shade: a hard-edged, sun-flecked pool
    shade = corridor & (YY > 598 + 5 * wobble(seed + 61, 40)(XX))
    for (fx_, fy_) in poisson(rng, 820, 600, 910, 720, 11, 400):
        r1 = rng.uniform(1.6, 3.2)
        shade &= ~(((XX - fx_) / r1) ** 2 + ((YY - fy_) / (r1 * .5)) ** 2 <= 1)
    st.shadow |= shade
    # the two trees that stand either side of the track where it goes in, trunks showing
    for (bx, by, rx, sd) in ((796, 668, 48, 901), (930, 676, 50, 902)):
        tr = tree(rx, rx * .86, 64, 13, sd)
        st.add(tr, bx, by, z=by + 2000 + 1)
        st.throw(tr, bx, by, dapple=sd, clip=(YY > 560))
    # -- the west and east: trees with trunks, shadows to the SE kept off the board
    side_trees = []
    for (x0, x1, front) in ((-30, 236, 'e'), (1000, 1310, 'w')):
        pts = poisson(rng, x0, -20, x1, 760, 62, 4000)
        for (x, y) in pts:
            side_trees.append((x, y, front))
    for i, (x, y, front) in enumerate(side_trees):
        rx = rng.uniform(42, 56)
        h = int(rng.uniform(56, 70))
        if front == 'e' and x + rx > 252:
            x = 252 - rx
        if front == 'w' and x - rx < 990:
            x = 990 + rx
        if y > 560:      # the south wood's crowns take over there
            continue
        tr = tree(rx, rx * .86, h, int(rng.uniform(11, 15)), seed * 7 + i, lift=rng.choice((0, 0, 1)))
        st.add(tr, x, y)
        st.throw(tr, x, y, dapple=seed * 7 + i, clip=keep_off)
    # shrubs at the wood's edge and at the trunks' feet
    for (bx, by, rx, ry) in ((262, 150, 20, 13), (268, 330, 22, 14), (1000, 250, 22, 14), (998, 410, 24, 15)):
        bu = bush(rx, ry, seed + int(bx + by))
        st.add(bu, bx, by, z=by + (3000 if by > 500 else 0))
        st.throw(bu, bx, by, dapple=int(bx), clip=keep_off)


def walls(st, seed=5):
    """The two impassable tiles: a boulder that fills the tile, a smaller stone at its foot, scree round it."""
    rng = random.Random(seed + 300)
    a = st.a
    for k, (c, r) in enumerate(WALLS):
        x, y, _, _ = tile_rect(c, r)
        fx, fy = x + 23, y + 41
        # scree: a few stones scattered on the ground of the tile, kept inside it
        for (dx, dy, big) in ((-17, -2, False), (14, 3, False), (-8, 4, False), (19, -6, False)):
            pebble(a, fx + dx, fy + dy, rng, big=big)
        b1 = boulder(41, 35, seed + 11 * k + 1)
        b2 = boulder(15, 11, seed + 11 * k + 2)
        b3 = boulder(9, 7, seed + 11 * k + 3, moss=False)
        clip = (XX >= x) & (XX < x + T + 12) & (YY >= y) & (YY < y + T + 4)
        for (spr, dx, dy) in ((b1, 0, 0), (b2, 14, 4), (b3, -15, 3)):
            st.add(spr, fx + dx, fy + dy)
            st.throw(spr, fx + dx, fy + dy, clip=clip)
            st.throw_ell(fx + dx + 2, fy + dy + 1, spr.w * .45, 2.2, clip=clip)
        # grass growing against the boulder's foot, drawn in front of it
        for (tx, ty) in ((fx - 20, fy + 1), (fx - 4, fy + 2), (fx + 22, fy + 5), (fx + 6, fy + 3)):
            cells = tuft_shape(rng, .55)
            sp = new(12, 10, 5, 8)
            for (dx, dy), code in cells.items():
                if code != 'R':
                    put(sp, sp.ax + dx, sp.ay + dy, {'L': 'g6', 'T': 'g8', 'S': 'g3', 'B': 'g2'}[code])
            st.add(sp, tx, ty, z=fy + 10)


def render(seed=5):
    a, info = build(seed)
    seams(a)
    st = Stage(a)
    walls(st, seed)
    woods(st, info, seed)
    return st.render()


def to_rgba(a):
    lut_ = np.zeros((256, 4), np.uint8)
    for i, h in enumerate(pal.HEX):
        lut_[i] = (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
    return lut_[a]


def png_bytes(a):
    im = Image.fromarray(a, 'P')
    im.putpalette(pal.flat_palette())
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


# ================================================================ cache
_URI = None


def _key():
    h = hashlib.sha1()
    for p in (os.path.abspath(__file__), DIRS + '/pxworld/pal.py', DIRS + '/pxworld/props.py', DIRS + '/pxworld/canvas.py'):
        with open(p, 'rb') as fh:
            h.update(fh.read())
    return h.hexdigest()[:12]


def field_png():
    """Path of the cached field PNG, building it first if this source has changed."""
    cdir = DIRS + '/px-combat/cache'
    os.makedirs(cdir, exist_ok=True)
    path = f'{cdir}/field-{_key()}.png'
    if not os.path.exists(path):
        data = png_bytes(render())
        tmp = path + f'.{os.getpid()}.tmp'
        with open(tmp, 'wb') as fh:
            fh.write(data)
        os.replace(tmp, path)
    return path


def field_uri():
    """The combat field, 1280 x 720, as a PNG data URI (built once, cached)."""
    global _URI
    if _URI is None:
        with open(field_png(), 'rb') as fh:
            _URI = 'data:image/png;base64,' + base64.b64encode(fh.read()).decode()
    return _URI


if __name__ == '__main__':
    import time
    t0 = time.time()
    arr = render()
    Image.fromarray(to_rgba(arr), 'RGBA').save(DIRS + '/px-combat/t/field.png')
    print('rendered in', round(time.time() - t0, 1), 's')
