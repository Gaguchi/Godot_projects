"""px-camp helpers: camp-scale pixel drawing on top of pxworld (indexed Canvas, pal ramps only).

The camp is drawn at 1 art px = 1 screen px, in true scale to the 104 x 152 board sprites (a person is about 140 px
tall). Light comes from the upper left (north-west) on every object; cast shadows fall to the lower right as the
ground one ramp step darker, with a hard edge."""
import math
import os
import random
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
sys.path.insert(0, DIRS)
from pxworld import pal                                       # noqa: E402
from pxworld.canvas import Canvas, Sprite, nb, ring, lut      # noqa: E402
from pxworld.pal import ix, CLEAR                             # noqa: E402

GROUND = ('g', 'd', 'h')
# the sun: a point at height z above ground point (x, y) throws its shadow to (x + z*SX, y + z*SY)
SX, SY = .42, .17


def R(letter):
    return pal.RAMP[letter]


def K(letter, i):
    """Index of ramp letter at level i, clamped."""
    r = pal.RAMP[letter]
    return r[max(0, min(len(r) - 1, i))]


def ids(ramps):
    return [i for r in ramps for i in pal.RAMP[r]]


def shift_arr(a, n, fine=False):
    """Move every index in array a n steps along its own ramp."""
    return lut(n, fine)[a]


# ---------------------------------------------------------------- full-canvas masks (H x W bool)
def grid(W, H):
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    return xx + .5, yy + .5


def poly_mask(W, H, pts):
    from PIL import Image, ImageDraw
    im = Image.new('1', (W, H), 0)
    ImageDraw.Draw(im).polygon([(float(x), float(y)) for x, y in pts], fill=1)
    return np.array(im, bool)


def ell_mask(W, H, cx, cy, rx, ry, xx=None, yy=None):
    if xx is None:
        xx, yy = grid(W, H)
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1


def seg_dist(xx, yy, pts):
    """Distance from every pixel centre to polyline pts, and the arclength along it."""
    best = np.full(xx.shape, 1e9)
    along = np.zeros(xx.shape)
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
        run += math.sqrt(L2)
    return best, along


def catmull(pts, n=12):
    """Sample a Catmull-Rom spline through pts."""
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


def wobble(seed, scale, n=4):
    rng = random.Random(seed)
    terms = [(rng.uniform(.6, 1.0) / (k + 1), scale / (k + 1) * rng.uniform(.8, 1.25), rng.uniform(0, 6.283)) for k in range(n)]
    tot = sum(a for a, _, _ in terms)
    return lambda t: sum(a * np.sin(2 * np.pi * t / lam + ph) for a, lam, ph in terms) / tot


def smooth_noise(W, H, cell, seed):
    from scipy import ndimage
    rng = np.random.RandomState(seed)
    gw, gh = int(W / cell) + 4, int(H / cell) + 4
    gr = rng.uniform(-1, 1, (gh, gw))
    z = ndimage.zoom(gr, ((H + 3 * cell) / gh, (W + 3 * cell) / gw), order=3)[:H, :W]
    return z / (np.abs(z).max() + 1e-9)


def clean(m, k=3):
    """Open then close a mask: no single-pixel spurs or holes on a drawn edge."""
    from scipy import ndimage
    st = np.ones((k, k), bool)
    return ndimage.binary_closing(ndimage.binary_opening(m, st), st)


def poisson(rng, x0, y0, x1, y1, mind, tries, ok=None):
    pts = []
    cell = mind / math.sqrt(2)
    gw, gh = int((x1 - x0) / cell) + 1, int((y1 - y0) / cell) + 1
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


# ---------------------------------------------------------------- sprite helpers
def new(w, h, ax=None, ay=None):
    return Sprite(int(w), int(h), ax, ay)


def selout(s, lit=None, dark=None, conn=4, top_key=None):
    """Selective outline: the ring just outside the silhouette takes the darkest step of the neighbouring
    pixel's own ramp (dark), and on the edge facing the light (top and left) one step lighter (lit) if given.
    dark / lit may be dicts {ramp letter: key} to override per ramp."""
    m = s.mask()
    big = np.zeros((s.h + 2, s.w + 2), bool)
    big[1:-1, 1:-1] = m
    r = ring(big, conn)[1:-1, 1:-1]
    src = s.ix.copy()
    out = s.ix
    # neighbour colour: prefer the pixel above/left/right/below in that order
    for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
        v = nb(src, dx, dy, CLEAR)
        pick = r & (v != CLEAR) & (out == CLEAR)
        for i in np.unique(v[pick]):
            letter = pal.RAMP_OF[i]
            dk = (dark or {}).get(letter, f'{letter}0')
            sel = pick & (v == i)
            out[sel] = ix(dk)
            if lit and letter in lit:
                # this ring pixel sits up-left of the shape: the edge facing the light
                facing = sel & (nb(m, 1, 0) | nb(m, 0, 1)) & ~nb(m, -1, 0) & ~nb(m, 0, -1)
                out[facing] = ix(lit[letter])
    return s


def put(s, x, y, key):
    x, y = int(x), int(y)
    if 0 <= x < s.w and 0 <= y < s.h:
        s.ix[y, x] = ix(key) if not isinstance(key, (int, np.integer)) else key


def get(s, x, y):
    x, y = int(x), int(y)
    if 0 <= x < s.w and 0 <= y < s.h:
        return int(s.ix[y, x])
    return CLEAR


def line(s, x0, y0, x1, y1, key, only=None):
    """Bresenham line; only(index) -> bool restricts which pixels it may paint over."""
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        if only is None or only(get(s, x0, y0)):
            put(s, x0, y0, key)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x0 += sx
        if e2 <= dx:
            err += dx; y0 += sy


def to_rgba(ixarr):
    """uint8 index array -> RGBA uint8 array (255 = clear)."""
    lut_ = np.zeros((256, 4), np.uint8)
    for i, h in enumerate(pal.HEX):
        lut_[i] = (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
    return lut_[ixarr]
