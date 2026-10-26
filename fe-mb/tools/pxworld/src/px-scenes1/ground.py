"""The camp's ground at camp scale: meadow, the road, the trampled clearing, tufts, clumps, pebbles, flowers.

Grass is a base tone with broad half-step patches whose upper edges are serrated by blades (the nearer grass
always overlaps the grass behind it, so blades poke up). The road and the clearing are dirt; where grass meets
dirt the grass either throws a 1 px lip shadow onto the dirt (north edges) or pokes blades up into it (south
edges), and loose tufts grow on the dirt near its edge. No speckle: every mark is a drawn shape."""
import math
import random

import numpy as np

from cpx import (pal, ix, CLEAR, K, ids, grid, ell_mask, seg_dist, wobble, smooth_noise, clean, poisson, nb,
                 shift_arr, lut)

G_IDS = set(pal.RAMP['g'])
D_IDS = set(pal.RAMP['d'])


def is_grass(v):
    return v in G_IDS


# ---------------------------------------------------------------- grass
def meadow(W, H, seed=3):
    """Base meadow: g5 with broad g4 (shade) and g6 (sun) patches."""
    n = smooth_noise(W, H, 230, seed) + .38 * smooth_noise(W, H, 96, seed + 11)
    a = np.full((H, W), ix('g5'), np.uint8)
    dark = clean(n < -.36, 7)
    sun = clean(n > .34, 7)
    a[dark] = ix('g4')
    a[sun] = ix('g6')
    return a


SPIKES = [0, 0, 2, 4, 3, 0, 1, 0, 0, 3, 5, 2, 0, 0, 1, 0, 2, 3, 6, 2, 0, 0, 0, 1, 3, 2, 0, 0, 4, 2, 0, 1]


def serrate(a, region_ids, seed=0, only=None):
    """Where a region sits directly below a different grass tone, its blades poke up into the tone above.
    region_ids: the indices allowed to grow upward; only: indices they may grow over."""
    H, W = a.shape
    src = a.copy()
    up = nb(src, 0, -1, CLEAR)
    top = np.isin(src, list(region_ids)) & (up != src) & (up != CLEAR)
    if only is not None:
        top &= np.isin(up, list(only))
    ys, xs = np.nonzero(top)
    rng = random.Random(seed)
    off = rng.randint(0, 23)
    for y, x in zip(ys, xs):
        h = SPIKES[(x * 7 + (y // 3) * 5 + off) % len(SPIKES)]
        v = src[y, x]
        for k in range(1, h + 1):
            yy = y - k
            if yy < 0:
                break
            if only is not None and src[yy, x] not in only:
                break
            if src[yy, x] == v:
                break
            a[yy, x] = v
    return a


def _blade(rng, L, lean):
    """One blade as a list of (dx, dy) from its root, curving with its lean."""
    pts = []
    x = 0.0
    for k in range(L):
        t = k / max(1, L - 1)
        x += lean * (.35 + .9 * t)
        pts.append((int(round(x)), -k))
    return pts


def tuft_shape(rng, size=1.0):
    """A tuft of blades: {(dx, dy): code}. codes: L lit blade, T lit tip, S shaded blade, B root shadow."""
    n = rng.choice((3, 4, 4, 5, 5, 6)) if size >= 1 else rng.choice((2, 3, 3))
    cells = {}
    hmax = 0
    for i in range(n):
        f = (i / (n - 1) - .5) if n > 1 else 0
        lean = f * rng.uniform(.5, 1.0) + rng.uniform(-.15, .15)
        L = int(round(rng.uniform(4, 9) * size * (1.15 - abs(f) * .6)))
        L = max(2, L)
        hmax = max(hmax, L)
        lit = f < .05
        for k, (dx, dy) in enumerate(_blade(rng, L, lean)):
            p = (dx + int(round(f * 3)), dy)
            code = ('T' if (lit and k >= L - 2) else 'L') if lit else 'S'
            if k == 0:
                code = 'B'
            if code == 'S' and p in cells and cells[p] in 'LT':
                continue
            cells[p] = code
    # a root shadow cast to the lower right
    xs = [p[0] for p in cells]
    for x in range(min(xs), max(xs) + 2):
        cells.setdefault((x, 1), 'R')
    return cells


TUFT_N = {'L': 2, 'T': 3, 'S': -2, 'B': -3, 'R': -2}


def stamp_tuft(a, x, y, cells, ok_ids=G_IDS, dirt=False):
    """Draw a tuft coloured from the ground under it (shifted along its own ramp). On dirt, the blades are
    grass coloured (g5 / g7 / g3) and the root shadow is the dirt one step down."""
    H, W = a.shape
    for (dx, dy), code in cells.items():
        px, py = x + dx, y + dy
        if not (0 <= px < W and 0 <= py < H):
            continue
        v = int(a[py, px])
        if dirt:
            if v not in D_IDS:
                continue
            if code == 'R':
                a[py, px] = pal.shift_index(v, -1)
            else:
                a[py, px] = ix({'L': 'g5', 'T': 'g7', 'S': 'g3', 'B': 'g2'}[code])
            continue
        if v not in ok_ids:
            continue
        a[py, px] = pal.shift_index(v, TUFT_N[code], fine=True)


def tufts(a, rng, pts, size=1.0, dirt=False):
    for (x, y) in pts:
        stamp_tuft(a, int(x), int(y), tuft_shape(rng, size * rng.uniform(.8, 1.2)), dirt=dirt)


def clump(a, rng, x, y, w=16, h=12):
    """A big grass clump: a mound of blades, darker at the root, sunlit on its west side."""
    n = max(6, int(w * .8))
    for i in range(n):
        f = i / (n - 1) - .5
        bx = x + f * w * .8
        L = int(round(h * (1 - abs(f) * 1.1) * rng.uniform(.7, 1.05)))
        if L < 2:
            continue
        lean = f * 1.4 + rng.uniform(-.2, .2)
        lit = f < .1
        for k, (dx, dy) in enumerate(_blade(rng, L, lean)):
            px, py = int(round(bx + dx)), y + dy
            if not (0 <= px < a.shape[1] and 0 <= py < a.shape[0]):
                continue
            if k < 2:
                key = 'g2'
            elif lit:
                key = 'g8' if k >= L - 2 else ('g7' if k > L * .5 else 'g5')
            else:
                key = 'g4' if k > L * .6 else 'g3'
            a[py, px] = ix(key)
    for xx in range(int(x - w * .45), int(x + w * .5) + 2):
        if 0 <= xx < a.shape[1] and y + 1 < a.shape[0] and a[y + 1, xx] in G_IDS | D_IDS:
            a[y + 1, xx] = pal.shift_index(int(a[y + 1, xx]), -2 if a[y + 1, xx] in G_IDS else -1, fine=True)


FLOWER = {'bone': ('b5', 'b3'), 'straw': ('o5', 'o3'), 'rose': ('x5', 'x3'), 'sky': ('s5', 's3')}


def flowers(a, rng, centres, kinds=('bone', 'bone', 'straw', 'rose', 'sky')):
    """Little flower clusters: a 2x2 lit head (one pixel of its shade), a stem, a leaf."""
    H, W = a.shape
    for (cx, cy) in centres:
        kind = rng.choice(kinds)
        hi, lo = FLOWER[kind]
        for _ in range(rng.choice((2, 3, 3, 4, 5))):
            x, y = int(cx + rng.randint(-9, 9)), int(cy + rng.randint(-5, 5))
            if not (2 <= x < W - 3 and 4 <= y < H - 1):
                continue
            if any(a[y + j, x + i] not in G_IDS for i in (-1, 0, 1, 2) for j in (-3, -2, -1, 0, 1)):
                continue
            a[y, x] = pal.shift_index(int(a[y, x]), -2, fine=True)          # stem
            a[y - 1, x] = pal.shift_index(int(a[y - 1, x]), -2, fine=True)
            a[y - 3, x] = ix(hi); a[y - 3, x + 1] = ix(hi); a[y - 2, x] = ix(hi); a[y - 2, x + 1] = ix(lo)
            a[y + 1, x + 1] = pal.shift_index(int(a[y + 1, x + 1]), -2, fine=True)


def pebble(a, x, y, rng, big=False, ramp='t', base=None):
    """A pebble on the ground: lit top-left, its own shade, a hard shadow below-right on the ground."""
    H, W = a.shape
    shapes_small = [["45", "32"], ["554", "432"], [".5.", "543", ".3."]]
    shapes_big = [[".554.", "55443", "44332", ".322."], [".55.", "5543", "4432", ".33."], ["..54.", ".5543", "54432", ".3322"]]
    sh = rng.choice(shapes_big if big else shapes_small)
    lift = 0 if base is None else base
    for j, row in enumerate(sh):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            for (sx, sy) in ((1, 1),):
                px, py = x + i + sx, y + j + sy
                if 0 <= px < W and 0 <= py < H and (a[py, px] in G_IDS or a[py, px] in D_IDS):
                    a[py, px] = pal.shift_index(int(a[py, px]), -1)
    for j, row in enumerate(sh):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            px, py = x + i, y + j
            if 0 <= px < W and 0 <= py < H:
                a[py, px] = K(ramp, int(ch) + lift)


def scuffs(a, rng, pts):
    """Short worn marks in trodden dirt: a dark crescent with a lit lip under it (a boot's heel-scrape)."""
    H, W = a.shape
    for (x, y) in pts:
        x, y = int(x), int(y)
        L = rng.choice((3, 4, 5, 6))
        for i in range(L):
            yy = y + (1 if i in (0, L - 1) else 0)
            if 0 <= x + i < W and 0 <= yy + 1 < H and a[yy, x + i] in D_IDS:
                a[yy, x + i] = pal.shift_index(int(a[yy, x + i]), -1)
                if i not in (0, L - 1) and a[yy + 1, x + i] in D_IDS:
                    a[yy + 1, x + i] = pal.shift_index(int(a[yy + 1, x + i]), 1)


def twig(a, x, y, rng):
    L = rng.choice((5, 7, 9))
    sl = rng.choice((-1, 1)) * rng.uniform(0, .35)
    for i in range(L):
        px, py = int(x + i), int(y + i * sl)
        if 0 <= px < a.shape[1] and 0 <= py + 1 < a.shape[0]:
            a[py, px] = ix('w4' if i < L * .6 else 'w3')
            if a[py + 1, px] in D_IDS:
                a[py + 1, px] = pal.shift_index(int(a[py + 1, px]), -1)


# ---------------------------------------------------------------- dirt
def paint_dirt(a, m, base='d4', seed=0, lip=True):
    """Fill mask m with dirt: base tone, the edge under grass to the north shadowed (grass lip), grass to the
    south pokes up into it. Returns the mask actually painted."""
    a[m] = ix(base)
    b = ix(base)
    if lip:
        # north edge: the grass above throws a 1-2 px shadow onto the dirt
        above_grass = m & ~nb(m, 0, -1, True)
        a[above_grass] = pal.shift_index(b, -1)
        two = m & nb(m, 0, -1, True) & ~nb(m, 0, -2, True)
        rng = np.random.RandomState(seed)
        a[two & (rng.rand(*m.shape) < .0)] = pal.shift_index(b, -1)
        # west edge: the grass casts a short shadow east onto the dirt as well
        west = m & ~nb(m, -1, 0, True)
        a[west] = pal.shift_index(b, -1)
    return m


def grass_over_dirt(a, m, seed=1):
    """South edges of a dirt area: the grass below pokes blades up into the dirt; the grass just under a
    north lip darkens its own top row (the turf's side)."""
    H, W = a.shape
    src = a.copy()
    rng = random.Random(seed)
    # turf side under the north lip: the row of grass directly above dirt reads as the turf's edge
    turf = ~m & nb(m, 0, 1, False) & np.isin(src, list(G_IDS))
    a[turf] = shift_arr(src[turf], -2, True)
    # blades up into the dirt from the grass below
    edge = ~m & nb(m, 0, -1, False) & np.isin(src, list(G_IDS))
    ys, xs = np.nonzero(edge)
    off = rng.randint(0, 23)
    for y, x in zip(ys, xs):
        h = SPIKES[(x * 5 + off) % len(SPIKES)]
        h = h + (1 if h else 0)
        v = int(src[y, x])
        for k in range(1, h + 1):
            yy = y - k
            if yy < 0 or not m[yy, x]:
                break
            tone = pal.shift_index(v, 2 if k == h else 0, fine=True)
            a[yy, x] = tone
        if h and y - h - 1 >= 0 and m[y - h - 1, x] is not None:
            pass
    return a


# ---------------------------------------------------------------- drawn dirt texture
CLODS = [
    # a small clod: lit cap, body, shaded foot          a dent: shaded lip above, lit floor below
    ([".5.", "545", ".3."], 'clod'), ([".55.", "5443", ".33."], 'clod'), (["54", "43"], 'clod'),
    (["33", ".5"], 'dent'), ([".33.", "3..5", ".55."], 'dent'), (["333", ".55"], 'dent'),
]


def dirt_texture(a, m, rng, density=1.0, base='d4', lit=True):
    """Drawn texture for an area of dirt: broken patches a step lighter (sun-baked crust) and a step darker
    (worn), clods lit on their caps and dents shadowed on their lips, all at Poisson spacing. Each mark is a
    small shape, never a lone pixel."""
    H, W = a.shape
    b = ix(base)
    ys, xs = np.nonzero(m)
    if not len(xs):
        return
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # broken tonal patches
    n = smooth_noise(x1 - x0, y1 - y0, 15, rng.randint(0, 999)) + .5 * smooth_noise(x1 - x0, y1 - y0, 7, rng.randint(0, 999))
    sub = a[y0:y1, x0:x1]
    mm = m[y0:y1, x0:x1] & (sub == b)
    hi = clean(n > .66, 3) & mm
    if lit:
        sub[hi] = pal.shift_index(b, 1)
    # marks
    pts = poisson(rng, x0, y0, x1, y1, 11.0 / math.sqrt(density), int((x1 - x0) * (y1 - y0) / 30))
    for (x, y) in pts:
        x, y = int(x), int(y)
        if not m[y, x]:
            continue
        rows, kind = rng.choice(CLODS)
        ok = all(m[min(H - 1, y + j), min(W - 1, x + i)] for j, r in enumerate(rows) for i, ch in enumerate(r) if ch != '.')
        if not ok:
            continue
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == '.':
                    continue
                v = int(a[y + j, x + i])
                if v not in D_IDS:
                    continue
                lv = pal.LEVEL[v]
                k = {'5': 1, '4': 0, '3': -1}[ch]
                a[y + j, x + i] = K('d', lv + k)


def ragged(field, seed, W, H, amp=(.16, .08, .04), cells=(46, 18, 7)):
    """Add multi-scale noise to a signed field so its zero contour is a ragged, natural edge."""
    out = field.copy()
    for k, (am, c) in enumerate(zip(amp, cells)):
        out += am * smooth_noise(W, H, c, seed + 31 * k)
    return out


def drop_small(m, min_px=12):
    from scipy import ndimage
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= min_px
    return keep[lab]


MARKS = [["1.1", ".1."], ["1", "1"], [".1", "1."], ["1.", ".1"], ["1..1", ".11."], ["1", "1", "1"]]


def blade_marks(a, rng, pts):
    """Fine texture for the meadow: tiny V and blade marks one step down, so no patch is a flat fill."""
    H, W = a.shape
    for (x, y) in pts:
        rows = rng.choice(MARKS)
        x, y = int(x), int(y)
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == '.':
                    continue
                px, py = x + i, y + j
                if 0 <= px < W and 0 <= py < H and a[py, px] in G_IDS:
                    a[py, px] = pal.shift_index(int(a[py, px]), -2, fine=True)


def poly_sdist(W, H, pts):
    """Signed distance (px) to a closed polygon: + inside."""
    from scipy import ndimage
    from cpx import poly_mask
    m = poly_mask(W, H, pts)
    return ndimage.distance_transform_edt(m) - ndimage.distance_transform_edt(~m)
