"""Ground painting for a deep (perspective) view: every mark takes its size from its depth.

The ground is a per-pixel field of world coordinates (persp.ground_grid). Regions (river, road, fields) are
defined in metres, so their edges come out in true perspective. Texture is drawn in stage pixels, but every
mark's size and spacing is scaled by the depth of the row it sits on: blades near the company are as long as
PxCamp's, a few px at the bridge, a single stroke at the woods. Where a pattern would fall under 2-3 px it is
dropped and the tone goes flat (the pixel artist's level of detail), so the horizon never turns to speckle.
"""
import math
import random

import numpy as np
from scipy import ndimage

import cpx
import ground as GR
import persp as P
from cpx import pal, ix, CLEAR, K, nb, poisson

G_IDS = list(pal.RAMP['g'])
SZ_REF = float(P.S(P.Z_of_y(P.Y_FEET)))        # px per metre at the company (77.8)


def rel(y):
    """Size of a mark at row y relative to the company's row."""
    return float(P.S_at_y(y)) / SZ_REF


def wnoise(X, Z, lam, seed, n=7, fade=True):
    """Smooth noise in world metres (a sum of plane waves), faded out where a pixel's footprint grows past a
    third of its wavelength (so distant rows go flat instead of aliasing into speckle)."""
    rng = np.random.RandomState(seed)
    out = np.zeros_like(X)
    for k in range(n):
        a = rng.uniform(0, math.pi)
        lk = lam * rng.uniform(.7, 1.35)
        ph = rng.uniform(0, 2 * math.pi)
        out += np.sin((X * math.cos(a) + Z * math.sin(a)) * 2 * math.pi / lk + ph)
    out /= math.sqrt(n / 2)
    if fade:
        foot = Z * Z / (P.F * P.HC)              # metres of depth per pixel row
        out *= np.clip(1.6 - foot / (lam / 3), 0, 1)
    return out


def vpoisson(rng, x0, y0, x1, y1, base, ok=None, tries_per=1.0, min_d=2.5):
    """Poisson-ish points whose spacing shrinks with depth: band by band, spacing = base * rel(y)."""
    pts = []
    y = y0
    while y < y1:
        r = rel(y + 4)
        d = max(min_d, base * r)
        band = max(4, int(d))
        n = int((x1 - x0) * band / (d * d) * 2.2 * tries_per)
        for p in poisson(rng, x0, y, x1, min(y1, y + band), d, n, ok=ok):
            pts.append(p)
        y += band
    return pts


# ---------------------------------------------------------------- grass
def meadow(X, Z, ground, seed=3):
    """Base meadow tones: g5 with g4 shade and g6 sun patches near, a step lighter with distance (the air)."""
    n = wnoise(X, Z, 9.0, seed) + .45 * wnoise(X, Z, 3.6, seed + 1)
    far = np.clip((Z - 30) / 140, 0, 1)
    v = n * .8 + far * 1.05
    a = np.full(X.shape, ix('g5'), np.uint8)
    a[v < -.42] = ix('g4')
    a[v > .42] = ix('g6')
    a[v > 1.25] = ix('g7')
    a[~ground] = CLEAR
    from pxworld.terrain import majority
    majority(a, [ix('g4'), ix('g5'), ix('g6'), ix('g7')], passes=3, size=5)
    a[~ground] = CLEAR
    return a


SPIKES = GR.SPIKES


def serrate(a, seed=0):
    """Blades of the nearer (lower) tone poke up into the tone above, their height scaled by depth."""
    Hh, Ww = a.shape
    src = a.copy()
    up = nb(src, 0, -1, CLEAR)
    top = np.isin(src, G_IDS) & (up != src) & np.isin(up, G_IDS)
    ys, xs = np.nonzero(top)
    rng = random.Random(seed)
    off = rng.randint(0, 23)
    for y, x in zip(ys, xs):
        r = rel(y)
        h = int(round(SPIKES[(x * 7 + (y // 3) * 5 + off) % len(SPIKES)] * min(1.0, r * 1.1)))
        v = src[y, x]
        for k in range(1, h + 1):
            yy = y - k
            if yy < 0 or src[yy, x] == v or src[yy, x] not in G_IDS:
                break
            a[yy, x] = v
    return a


def tuft_cells(rng, size):
    return GR.tuft_shape(rng, size)


def tufts(a, rng, pts, scale=1.0, dirt=False, only=None):
    for (x, y) in pts:
        r = rel(y) * scale
        if r < .12:
            continue
        GR.stamp_tuft(a, int(x), int(y), GR.tuft_shape(rng, max(.3, min(1.3, r * rng.uniform(.8, 1.2)))), dirt=dirt)


def strokes(a, rng, pts, only_ids):
    """Distant grass: short horizontal strokes one step down (a far meadow reads as layered bands of growth)."""
    Hh, Ww = a.shape
    oks = set(only_ids)
    for (x, y) in pts:
        x, y = int(x), int(y)
        L = rng.choice((2, 3, 3, 4))
        for i in range(L):
            if 0 <= x + i < Ww and a[y, x + i] in oks:
                a[y, x + i] = pal.shift_index(int(a[y, x + i]), -2 if a[y, x + i] in G_IDS else -1, fine=True)


def clump(a, rng, x, y, r):
    GR.clump(a, rng, int(x), int(y), max(6, int(16 * r)), max(4, int(12 * r)))


def flowers(a, rng, centres, kinds=('bone', 'bone', 'straw', 'rose', 'sky')):
    """Flower clusters: PxCamp's 2x2 heads near, single lit heads at mid depth, none far."""
    Hh, Ww = a.shape
    for (cx, cy) in centres:
        r = rel(cy)
        kind = rng.choice(kinds)
        hi, lo = GR.FLOWER[kind]
        spread = max(2, int(9 * r))
        for _ in range(rng.choice((2, 3, 3, 4, 5))):
            x, y = int(cx + rng.randint(-spread, spread)), int(cy + rng.randint(-spread // 2, spread // 2))
            if not (2 <= x < Ww - 3 and 4 <= y < Hh - 1):
                continue
            if any(a[y + j, x + i] not in G_IDS for i in (-1, 0, 1, 2) for j in (-3, -2, -1, 0, 1)):
                continue
            if r > .55:
                a[y, x] = pal.shift_index(int(a[y, x]), -2, fine=True)
                a[y - 1, x] = pal.shift_index(int(a[y - 1, x]), -2, fine=True)
                a[y - 3, x] = ix(hi); a[y - 3, x + 1] = ix(hi); a[y - 2, x] = ix(hi); a[y - 2, x + 1] = ix(lo)
            elif r > .25:
                a[y, x] = pal.shift_index(int(a[y, x]), -2, fine=True)
                a[y - 1, x] = ix(hi)
                a[y - 1, x + 1] = ix(lo)
            else:
                a[y, x] = ix(hi)


# ---------------------------------------------------------------- dirt (the road)
def road(a, X, Z, pts, half_w, seed=2, ground=None):
    """A dirt track in true perspective: ragged edges (world noise), two ruts at +-0.75 m that taper with depth,
    a grass crown between them near the viewer, pebbles scaled by depth. Returns (mask, signed offset)."""
    d, along = cpx.seg_dist(X, Z, pts)
    side = _side(X, Z, pts)
    sd = d * side
    edge = half_w + .22 * wnoise(X, Z, 2.4, seed) + .12 * wnoise(X, Z, .9, seed + 1)
    m = (d < edge) & np.isfinite(Z)
    if ground is not None:
        m &= ground
    m = cpx.clean(m, 3)
    GR.paint_dirt(a, m, 'd4', seed)
    # ruts: each a groove whose west wall is in shade, floor a step down, east lip lit
    px_m = P.F / np.where(np.isfinite(Z), Z, 1e9)
    for k, c in enumerate((-.78, .74)):
        cc = c + .05 * wnoise(X, Z, 6.0, seed + 10 + k, fade=False)
        wdt = .17
        dist_px = np.abs(sd - cc) * px_m
        half_px = np.maximum(.6, wdt * px_m)
        rut = m & (dist_px < half_px) & (Z < 70) & (d < edge - .3)
        rut = GR.drop_small(rut, 6)
        a[rut] = ix('d3')
        west = rut & ~nb(rut, -1, 0, False)
        a[west & (half_px > 1.4)] = ix('d2')
        lip = ~rut & nb(rut, -1, 0, False) & m
        a[lip & (px_m > 14)] = ix('d5')
    return m, sd, d


def _side(xx, yy, pts):
    best = np.full(xx.shape, 1e9)
    side = np.zeros(xx.shape)
    for i in range(len(pts) - 1):
        ax, ay = pts[i]; bx, by = pts[i + 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9
        with np.errstate(invalid='ignore'):
            t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / L2, 0, 1)
            dd = np.hypot(xx - (ax + t * dx), yy - (ay + t * dy))
        mm = dd < best
        best[mm] = dd[mm]
        side[mm] = np.sign(dx * (yy - ay) - dy * (xx - ax))[mm]
    return side


def dirt_detail(a, m, rng):
    """Clods and dents near, pebbles scaled by depth (PxCamp's marks), nothing past the bridge."""
    ys, xs = np.nonzero(m)
    if not len(xs):
        return
    y_top = ys.min()
    # near half: PxCamp's drawn texture
    near = m.copy()
    near[:int(P.y_of_Z(28)), :] = False
    GR.dirt_texture(a, near, rng, 1.0)
    dist_in = ndimage.distance_transform_edt(m)
    pts = vpoisson(rng, 0, y_top, P.W, P.H, 30, ok=lambda x, y: m[int(y), int(x)] and dist_in[int(y), int(x)] > 3 * rel(y) + 1)
    for (x, y) in pts:
        r = rel(y)
        q = rng.random()
        if r > .45:
            if q < .55:
                GR.pebble(a, int(x), int(y), rng, big=q < .15 and r > .8, ramp='t' if q < .4 else 'd', base=0 if q < .4 else 1)
            elif q < .64 and r > .7:
                GR.twig(a, x, y, rng)
        elif r > .2 and q < .5:
            x, y = int(x), int(y)
            a[y, x] = ix('t5'); a[y, x + 1] = ix('t3')
            a[y + 1, x + 1] = pal.shift_index(int(a[y + 1, x + 1]), -1)


# ---------------------------------------------------------------- water
def water(a, X, Z, cx_fn, w_fn, ground, seed=4):
    """A river flowing toward the viewer: base tone by depth (deep near, sky-pale far), the west bank's shade on
    the water, the east bank's sunlit mud face, the west bank's shaded one. Returns the water mask."""
    rxc = cx_fn(Z)
    hw = w_fn(Z) / 2
    wob = .25 * wnoise(X, Z, 7.0, seed) + .1 * wnoise(X, Z, 2.0, seed + 1)
    u = (X - rxc)                         # + east of the centre line
    left = -hw + wob
    right = hw + wob * .8
    wet = ground & (u > left) & (u < right)
    wet = cpx.clean(wet, 3)
    # the banks: a mud face either side, in true width (0.5 m), lit on the east bank (it faces the sun)
    px_m = P.F / np.where(np.isfinite(Z), Z, 1e9)
    bankW = ground & ~wet & (u > left - .55) & (u <= left + .02)
    bankE = ground & ~wet & (u < right + .7) & (u >= right - .02)
    a[bankW] = ix('d2')
    a[bankW & (u < left - .3)] = ix('d3')
    a[bankE] = ix('d4')
    a[bankE & (u > right + .35)] = ix('d5')
    # the water: deep a3 near, a4 mid, a5 then a6 far where it mirrors the sky
    t = np.full(X.shape, ix('a4'), np.uint8)
    t[Z < 24] = ix('a3')
    t[Z > 70] = ix('a5')
    t[Z > 220] = ix('a6')
    chan = np.abs(u - wob * .4) < hw * .35
    t[chan & (Z < 60)] = ix('a3')
    t[chan & (Z >= 60) & (Z < 200)] = ix('a4')
    # the west bank throws its shade onto the water (sun from the west)
    shade = (u - left) < .7
    t[shade] = cpx.lut(-1)[t[shade]]
    a[wet] = t[wet]
    # the east bank's lit lip where it meets the water
    lipE = wet & nb(bankE, 1, 0, False)
    a[lipE] = ix('a6')
    return wet, u, hw


def ripples(a, wet, rng, u=None, hw=None):
    """Flow marks: short lit strokes with a dark stroke under them, length and spacing scaled by depth; a few
    long sky glints on the far water."""
    Hh, Ww = a.shape
    ys, xs = np.nonzero(wet)
    if not len(xs):
        return
    dist_in = ndimage.distance_transform_edt(wet)
    pts = vpoisson(rng, xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, 34,
                   ok=lambda x, y: wet[int(y), int(x)] and dist_in[int(y), int(x)] > 2 + 3 * rel(y), min_d=7)
    for (x, y) in pts:
        x, y = int(x), int(y)
        r = rel(y)
        L = max(3, int(round(rng.choice((6, 8, 10, 13)) * r)))
        if r < .3 and rng.random() < .5:
            continue
        v = int(a[y, x])
        hi = pal.shift_index(v, 2)
        lo = pal.shift_index(v, -1)
        for i in range(L):
            if 0 <= x + i < Ww and wet[y, x + i]:
                a[y, x + i] = hi if (i > 0 and i < L - 1) or L <= 3 else pal.shift_index(v, 1)
                if r > .25 and y + 1 < Hh and wet[y + 1, x + i] and 0 < i < L - 1:
                    a[y + 1, x + i] = lo


# ---------------------------------------------------------------- fields
def field(a, poly_px, kind, X, Z, rng, ground, rows='z', spacing=.7, seed=0):
    """A field seen in perspective: its ground quad projected, rows running with the depth (they converge on the
    vanishing point) or across it, drawn as 1 px staircase lines that stay connected; rows closer than 3 px are
    dropped and the field goes flat. Wheat near the viewer stands up: its near edge is a wall of stalks."""
    m = cpx.poly_mask(P.W, P.H, poly_px) & ground
    if not m.any():
        return m
    base, lit, dark, deep = {
        'wheat': ('h4', 'h5', 'h3', 'h2'), 'wheat2': ('h3', 'h4', 'h2', 'h1'),
        'crop': ('g6', 'g8', 'g4', 'g3'), 'crop2': ('g7', 'g8', 'g5', 'g4'),
        'plough': ('d3', 'd5', 'd2', 'd1'),
    }[kind]
    a[m] = ix(base)
    px_m = P.F / np.where(np.isfinite(Z), Z, 1e9)
    yy, xx = np.mgrid[0:P.H, 0:P.W]
    if kind.startswith('wheat'):
        _wheat(a, m, X, Z, rng, base, lit, dark, deep, seed)
        return m
    if rows == 'z':
        ph = (X / spacing) % 1.0
        sp_px = spacing * px_m
        slope = np.abs((xx + .5 - P.CX) / np.maximum(1, yy + .5 - P.YH))
        run = np.maximum(1.0, slope)
        on = (ph * sp_px < run) & (sp_px >= 3.0)
        on2 = ((1 - ph) * sp_px < run) & (sp_px >= 5.0)          # the lit side of each furrow
        a[m & on] = ix(dark)
        a[m & on2 & ~on] = ix(lit)
    else:
        foot = Z * Z / (P.F * P.HC)
        ph = (Z / spacing) % 1.0
        sp_px = spacing / np.maximum(foot, 1e-6)
        on = (ph * sp_px < 1.0) & (sp_px >= 3.0)
        on2 = ((ph * sp_px >= 1.0) & (ph * sp_px < 2.0)) & (sp_px >= 5.0)
        a[m & on] = ix(dark)
        a[m & on2] = ix(lit)
    # far fields: one soft band of tone so they are not flat cards
    far = m & (Z > 90)
    n = wnoise(X, Z, 30, seed + 5, fade=False)
    a[far & (n > .5)] = ix(lit)
    # a darker margin row along the field's far edge (the next furrow's shade), its near edge lit
    top = m & ~nb(m, 0, -1, False)
    a[top] = ix(dark)
    if kind.startswith('wheat'):
        _wheat_wall(a, m, rng, lit, base, dark, deep)
    return m


def _wheat(a, m, X, Z, rng, base, lit, dark, deep, seed):
    """Standing grain: the wind lays it in long bands across the field (crests a step lit, troughs a step dark,
    stretched along X), ears drawn as short strokes near the viewer (a lit head over its own shade), and the near
    edge a wall of stalks. Far off only the bands remain."""
    n = wnoise(X * .45, Z * 1.7, 5.0, seed + 40) + .4 * wnoise(X * .6, Z * 2.2, 2.2, seed + 41)
    a[m & (n > .5)] = ix(lit)
    a[m & (n < -.55)] = ix(dark)
    from pxworld.terrain import majority
    sub = a.copy()
    majority(sub, [ix(lit), ix(base), ix(dark)], passes=2, size=3)
    a[m] = sub[m]
    ys, xs = np.nonzero(m)
    if not len(xs):
        return
    pts = vpoisson(rng, xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, 6.5, ok=lambda x, y: m[int(y), int(x)], min_d=3)
    Hh, Ww = a.shape
    for (x, y) in pts:
        x, y = int(x), int(y)
        r = rel(y)
        if r < .18:
            continue
        L = 2 if r < .4 else 3
        v = int(a[y, x])
        top = pal.shift_index(v, 1)
        for k in range(L):
            yy = y - k
            if 0 <= yy < Hh and m[yy, x]:
                a[yy, x] = top if k == L - 1 else pal.shift_index(v, -1)
        if r > .45 and x + 1 < Ww and m[y - L + 1, x + 1]:
            a[y - L + 1, x + 1] = pal.shift_index(v, -1)
    _wheat_wall(a, m, rng, lit, base, dark, deep)


def _wheat_wall(a, m, rng, lit, base, dark, deep):
    """The near edge of a standing crop: stalks rising from the ground line, heads lit on top, the face in its
    own shade; height 0.8 m at the edge's depth. Only where that is 4 px or more."""
    Hh, Ww = a.shape
    bottom = m & ~nb(m, 0, 1, False)
    ys, xs = np.nonzero(bottom)
    R = random.Random(7)
    hs = {}
    for y, x in zip(ys, xs):
        h0 = .8 * P.S_at_y(y + .5)
        if h0 < 4:
            continue
        # stalk heights wander in runs (clumps of grain), never per pixel
        if x - 1 in hs and R.random() < .7:
            h = hs[x - 1] + R.choice((-1, 0, 0, 1))
        else:
            h = int(round(h0 * R.uniform(.85, 1.1)))
        h = int(max(h0 * .75, min(h0 * 1.2, h)))
        hs[x] = h
        stripe = (x * 3 + (x // 4)) % 5
        for k in range(h):
            yy = y - k
            if yy < 0 or not m[yy, x]:
                break
            t = k / h
            if t < .2:
                key = deep
            elif t < .78:
                key = dark if stripe else deep
                if stripe == 2:
                    key = base
            else:
                key = base if stripe in (1, 3) else lit
            a[yy, x] = ix(key)
        # the heads: a lit ear over the line in little groups
        if stripe in (0, 3) and y - h >= 0 and m[y - h, x]:
            a[y - h, x] = ix('h5')
            if y - h - 1 >= 0 and m[y - h - 1, x] and stripe == 0:
                a[y - h - 1, x] = ix(lit)


# ---------------------------------------------------------------- helpers
def proj_quad(X0, X1, Z0, Z1, skew=0.0):
    """A field's corners (a rectangle in metres, sheared by skew metres of X per metre of Z), projected."""
    pts = [(X0 + skew * (Z0 - 30), Z0), (X1 + skew * (Z0 - 30), Z0), (X1 + skew * (Z1 - 30), Z1), (X0 + skew * (Z1 - 30), Z1)]
    return [P.proj(x, z) for (x, z) in pts]
