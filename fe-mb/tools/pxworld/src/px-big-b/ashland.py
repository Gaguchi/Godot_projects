"""Ashfall's edge of the map: the meadow dries out, then the burnt hills begin.

ground(cv, poly, seed)  inside the polygon (stage px at grain 1) one 'dryness' field (the signed distance into the
                        zone plus two broad noises) sorts every pixel into four grounds that interleave in patches:
                          dry grass   the meadow's own tones moved to the dark end of the Wheat ramp, so the meadow's
                                      patch shapes carry over;
                          scorched    bare burnt earth (Dirt d2-d3);
                          ash         grey ash (Stone t2-t4) in broad patches, a little scorched earth showing;
                        every border is majority-voted, so the patches have clean edges and no per-pixel noise.
                        Returns (zone mask, ash mask, dry mask) for the scene and for route tests.
ridges(cv, hl)          the burnt hills' light: soft swells lit from the north-west on the ash and dry grass
scars(cv, rng, core)    short charcoal streaks with a lit lip (and, unless cinders=False, pale cinders), on the ash
cluster_mask(core, rng) where the marks go: clusters, the open ash between them left open
Only the palette's own ramps: Wheat for dry grass, Dirt for scorched earth, Stone for ash."""
import os
import sys

import numpy as np
from scipy import ndimage

DIRS = os.path.dirname(os.path.abspath(__file__))
while not os.path.isdir(os.path.join(DIRS, 'pxworld')):      # the scratchpad's dirs/ folder
    DIRS = os.path.dirname(DIRS)
if DIRS not in sys.path:
    sys.path.insert(0, DIRS)
from pxworld import pal, terrain as TR                 # noqa: E402
from pxworld.canvas import poly as mpoly               # noqa: E402
from pxworld.pal import ix                             # noqa: E402

# grass place -> dry grass: the meadow's shade, base and sun halves go to the dark straw of the Wheat ramp
DRY = {0: 'h0', 1: 'h0', 2: 'h0', 3: 'h1', 4: 'h1', 5: 'h1', 6: 'h2', 7: 'h2', 8: 'h3', 9: 'h3'}


def zone_field(cv, poly, seed, wobble=10.0):
    """Signed distance into the polygon (+ inside), its edge wobbled by broad noise so it reads as ground."""
    m, x0, y0 = mpoly(poly)
    full = np.zeros((cv.h, cv.w), bool)
    cs, ls = cv._clip(m, x0, y0)
    if cs is not None:
        full[cs] = m[ls]
    sd = np.where(full, ndimage.distance_transform_edt(full), -ndimage.distance_transform_edt(~full))
    return sd + TR.smooth_noise(cv.w, cv.h, 70, seed, 2) * wobble


def ground(cv, poly, seed=21, dry_at=0.0, scorch_at=26.0, ash_at=44.0):
    d = zone_field(cv, poly, seed)
    n = TR.smooth_noise(cv.w, cv.h, 30, seed + 3, 2)            # interleaves the bands in patches
    n2 = TR.smooth_noise(cv.w, cv.h, 110, seed + 11, 2)         # long swells: the bands come and go
    dd = ndimage.gaussian_filter(d + n * 16 + n2 * 20, 2.5)     # smooth, so every border is a stepped curve
    a = cv.ix
    zone = dd > dry_at
    # the band widths vary 3x and more, and in places the scorched band is skipped (dry grass straight to ash)
    N3 = TR.smooth_noise(cv.w, cv.h, 90, seed + 13, 1)
    N4 = TR.smooth_noise(cv.w, cv.h, 70, seed + 17, 1)
    sc_at = scorch_at - 8 + N3 * 18
    gap = ndimage.gaussian_filter(np.clip((.5 - N4) / .35, 0, 1) * (6 + (N4 + 1) * 16), 4)
    # the class of every pixel: 0 meadow, 1 dry grass, 2 scorched, 3 ash
    cls = np.zeros(a.shape, np.uint8)
    cls[zone] = 1
    cls[dd > sc_at] = 2
    cls[dd > sc_at + gap] = 3
    TR.majority(cls, [0, 1, 2, 3], passes=2, size=5)
    grass = np.isin(a, pal.RAMP['g'])
    nk = len(pal.KEYS)
    dry_lut = np.array([ix(DRY[pal.LEVEL[i]]) if (i < nk and pal.RAMP_OF[i] == 'g') else i for i in range(256)], np.uint8)
    m1 = (cls == 1) & grass
    a[m1] = dry_lut[a[m1]]
    # scorched earth: two dirt tones in broad patches
    A = TR.smooth_noise(cv.w, cv.h, 40, seed + 5, 1)
    sco = np.where(A > .15, ix('d3'), ix('d2')).astype(np.uint8)
    # ash: grey in broad patches, darker in the hollows, a little scorched earth showing through
    B = TR.smooth_noise(cv.w, cv.h, 80, seed + 7, 2)
    C = TR.smooth_noise(cv.w, cv.h, 36, seed + 9, 1)
    ash = np.full(a.shape, ix('t3'), np.uint8)
    ash[B + .4 * C < -.25] = ix('t2')
    ash[(B + .4 * C) > .38] = ix('t4')
    ash[(C < -.6) & (B < .1)] = ix('d2')
    TR.majority(ash, [ix(k) for k in ('t2', 't3', 't4', 'd2')], passes=3, size=5)
    TR.majority(sco, [ix('d2'), ix('d3')], passes=2, size=5)
    m2, m3 = cls == 2, cls == 3
    a[m2] = sco[m2]
    a[m3] = ash[m3]
    # layered ash: every patch's north-west lip catches the light, its south-east lip sits in shade
    lv = np.array([pal.LEVEL[i] if i < len(pal.KEYS) else 0 for i in range(256)])
    up = np.roll(a, 1, 0); lf = np.roll(a, 1, 1)
    dn = np.roll(a, -1, 0); rt = np.roll(a, -1, 1)
    gro = m2 | m3
    lit = gro & (((up != a) & (lv[up] < lv[a])) | ((lf != a) & (lv[lf] < lv[a])))
    shd = gro & ~lit & (((dn != a) & (lv[dn] > lv[a])) | ((rt != a) & (lv[rt] > lv[a])))
    from pxworld.canvas import lut
    a[lit] = lut(1)[a[lit]]
    a[shd] = lut(-1)[a[shd]]
    return zone, m3, (cls == 1) | m2


def ridges(cv, hl):
    """hl as pxworld.terrain.hills (stage px at grain 1): the burnt hills lit from the north-west."""
    return TR.hills(cv, hl, 1, ramps=('t', 'd', 'h'))


def cracks(cv, rng, core, n=60):
    """The burnt crust's cracks: short branching runs one step down the ground's own ramp, each with a lit pixel
    on its upper side (so it reads as a cut, not a line), wandering mostly across the slope."""
    ys, xs = np.nonzero(core)
    if len(xs) == 0:
        return
    for _ in range(n):
        k = rng.randrange(len(xs))
        x, y = int(xs[k]), int(ys[k])
        for branch in range(rng.choice((1, 2, 2, 3))):
            X, Y = x, y
            dx = rng.choice((-1, 1))
            for step in range(rng.randint(3, 7)):
                if not (0 <= X < cv.w and 1 <= Y < cv.h and core[Y, X]):
                    break
                v = cv.get(X, Y)
                if pal.RAMP_OF[v] in ('t', 'd'):
                    cv.ix[Y, X] = pal.shift_index(v, -1)
                    u = cv.get(X, Y - 1)
                    if pal.RAMP_OF[u] in ('t', 'd') and core[Y - 1, X]:
                        cv.ix[Y - 1, X] = pal.shift_index(u, 1)
                X += dx
                if rng.random() < .4:
                    Y += rng.choice((-1, 1))


def drifts(cv, rng, core, n=70, wind=(1, 0)):
    """Pale ash laid by the wind: two- to four-pixel streaks of the lightest ash with a shaded pixel at their lee
    end, all along the wind."""
    ys, xs = np.nonzero(core)
    if len(xs) == 0:
        return
    for _ in range(n):
        k = rng.randrange(len(xs))
        x, y = int(xs[k]), int(ys[k])
        L = rng.choice((2, 3, 3, 4))
        for i in range(L):
            X, Y = x + wind[0] * i, y + wind[1] * i
            if 0 <= X < cv.w and 0 <= Y < cv.h and core[Y, X]:
                cv.put(X, Y, 't5' if 0 < i < L - 1 or L == 2 else 't4')
        X, Y = x + wind[0] * L, y + wind[1] * L
        if 0 <= X < cv.w and 0 <= Y < cv.h and core[Y, X]:
            v = cv.get(X, Y)
            if pal.RAMP_OF[v] in ('t', 'd'):
                cv.ix[Y, X] = pal.shift_index(v, -1)


def cluster_mask(core, rng, n=26, r=16):
    """The ground marks' clusters: n discs of radius r..1.6r inside core (its points picked at random). Returns
    (mask, centres) so the snag stands can stand in the same clusters."""
    ys, xs = np.nonzero(core)
    m = np.zeros(core.shape, bool)
    cen = []
    if len(xs) == 0:
        return m, cen
    H, W = core.shape
    yy, xx = np.ogrid[0:H, 0:W]
    for _ in range(n):
        k = rng.randrange(len(xs))
        x, y = int(xs[k]), int(ys[k])
        rr = r * rng.uniform(1.0, 1.6)
        m |= (xx - x) ** 2 + ((yy - y) * 1.5) ** 2 < rr * rr
        cen.append((x, y))
    return m & core, cen


def scars(cv, rng, core, n=70, cinders=True):
    """Charcoal scars: two- to five-pixel runs two steps down the ash's own ramp, with a lit lip above; a few pale
    cinder clusters. Only on the ash."""
    ys, xs = np.nonzero(core)
    if len(xs) == 0:
        return
    for _ in range(n):
        k = rng.randrange(len(xs))
        x, y = int(xs[k]), int(ys[k])
        L = rng.choice((2, 3, 3, 4, 5))
        for i in range(L):
            X, Y = x + i, y + (i // 3)
            if 0 <= X < cv.w and 0 <= Y < cv.h and core[Y, X]:
                v = cv.get(X, Y)
                if pal.RAMP_OF[v] in ('t', 'd'):
                    cv.ix[Y, X] = pal.shift_index(v, -2)
        if 0 <= y - 1 < cv.h and 0 <= x < cv.w and core[y - 1, x]:
            v = cv.get(x, y - 1)
            if pal.RAMP_OF[v] in ('t', 'd'):
                cv.ix[y - 1, x] = pal.shift_index(v, 1)
    for _ in range(n // 3 if cinders else 0):
        k = rng.randrange(len(xs))
        x, y = int(xs[k]), int(ys[k])
        for (dx, dy) in rng.sample([(0, 0), (2, 1), (-1, 2), (3, -1), (1, 3)], 3):
            X, Y = x + dx, y + dy
            if 0 <= X < cv.w and 0 <= Y + 1 < cv.h and core[Y, X] and core[Y + 1, X]:
                cv.put(X, Y, 't5')
                cv.ix[Y + 1, X] = pal.shift_index(cv.get(X, Y + 1), -1)
