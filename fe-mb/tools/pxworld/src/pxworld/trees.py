"""pxworld trees: crowns, pines, trunks and whole forest masses.

crown(r, seed)        a broadleaf crown of 5-8 leaf clumps, each clump lit on its north-west cap and dark on
                      its south-east rim, quantised to the Leaf ramp, selectively outlined, despeckled
pine(h, seed)         a tiered conifer: lit west flank, shaded east flank, a dark band under every tier
tree(r, seed)         crown + trunk as one Sprite (foot anchor at the trunk base)
forest(cv, ...)       a dense mass: dark understory, ground shadow to the SE, trees stamped north to south
All sizes are in art px, so the same call gives HD detail at grain 1 and 16-bit chunkiness at grain 2.
"""
import math
import random

import numpy as np

from . import pal
from .canvas import Sprite, Canvas, poly, ellipse, nb, lut
from .pal import ix

LIGHT = np.array([-.52, -.70, .78])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def crown(r, seed=0, ramp='l', lobes=None, squash=.92, rim=True, tones=None, ball=.5):
    """Broadleaf crown of radius r (art px): leaf clumps, each lit on its NW cap and dark on its SE rim."""
    rng = random.Random(seed)
    pad = 2
    size = int(math.ceil(2 * r * 1.1)) + 2 * pad
    c = size / 2
    L = []
    n1 = lobes or max(5, min(9, int(r * .55) + 4))
    a0 = rng.uniform(0, 2 * math.pi)
    big = r >= 6.5
    rr = (.36, .46) if big else (.42, .54)
    for k in range(n1):
        a = a0 + 2 * math.pi * k / n1 + rng.uniform(-.22, .22)
        d = r * rng.uniform(.5, .6)
        rl = r * rng.uniform(*rr)
        lx, ly = c + math.cos(a) * d, c + math.sin(a) * d * squash
        L.append((lx, ly, rl, -.1 * (ly - c)))
    L.append((c + rng.uniform(-.08, .08) * r, c + .08 * r, r * (.5 if big else .62), .12 * r))
    for k in range(3 if big else 1):
        a = math.radians(rng.uniform(190, 300))
        d = r * rng.uniform(.2, .38)
        L.append((c + math.cos(a) * d, c + math.sin(a) * d, r * rng.uniform(.3, .38), .32 * r))
    yy, xx = np.mgrid[0:size, 0:size].astype(float)
    xx += .5; yy += .5
    best = np.full((size, size), -1e9)
    second = np.full((size, size), -1e9)
    nrm = np.zeros((size, size, 3))
    for (lx, ly, rl, z) in L:
        d2 = (xx - lx) ** 2 + (yy - ly) ** 2
        inside = d2 < rl * rl
        h = np.where(inside, np.sqrt(np.maximum(0, rl * rl - d2)) + z, -1e9)
        m = h > best
        second = np.where(m, best, np.maximum(second, h))
        best[m] = h[m]
        nz = np.sqrt(np.maximum(0, rl * rl - d2)) / rl
        nrm[m, 0] = ((xx - lx) / rl)[m]
        nrm[m, 1] = ((yy - ly) / rl)[m]
        nrm[m, 2] = nz[m]
    inside = best > -1e8
    b_lobe = nrm @ LIGHT
    # the whole crown as one ball: gives the big read (lit NW, shaded SE); the clumps ride on it
    gx, gy = (xx - c) / (r * 1.05), (yy - c) / (r * 1.05)
    gz = np.sqrt(np.maximum(0, 1 - gx * gx - gy * gy))
    b_ball = gx * LIGHT[0] + gy * LIGHT[1] + gz * LIGHT[2]
    b = (1 - ball) * b_lobe + ball * b_ball - .12 * (yy - c) / r
    crease = inside & (second > -1e8) & (best - second < .12 * r)
    b[crease] -= .22                                        # clumps shade the clump below them
    nl = len(pal.RAMP[ramp])
    if tones is None:
        tones = list(range(1, nl)) if big else list(range(2, nl))
    qs = {6: [.08, .3, .56, .8, .94], 5: [.14, .4, .7, .9], 4: [.22, .55, .85], 3: [.3, .75]}[len(tones)]
    vals = b[inside]
    th = [np.quantile(vals, q) for q in qs]
    q = np.zeros((size, size), int)
    for t in th:
        q += (b > t)
    lv = np.array([ix(f'{ramp}{i}') for i in tones], np.uint8)
    s = Sprite(size, size, int(c), int(c + r * .8))
    s.ix[inside] = lv[np.minimum(q, len(lv) - 1)][inside]
    if rim:
        bot = inside & ~nb(inside, 0, 1)
        s.ix[bot] = lut(-1)[s.ix[bot]]
    s.despeckle(2)
    s.outline(f'{ramp}0', conn=4)
    s.despeckle(1)
    return s.trimmed()


def clumps(r, seed=0, ramp='l', lift=0, squash=.94, density=1.0, sun=(.3, .52, .74, .9), ink=True):
    """Broadleaf crown built from leaf clumps, the way a pixel artist builds one.
    The crown is lit as one ball from the north-west; every clump takes the tone of the light where it sits,
    and clumps are laid darkest first, so each lit clump's edge is a clean arc over the shade below it:
    the scalloped light edge that reads as leaves. lift raises every tone (a sunnier tree)."""
    rng = random.Random(seed)
    pad = 2
    size = int(math.ceil(2 * r * 1.08)) + 2 * pad
    c = size / 2
    R = pal.RAMP[ramp]
    nl = len(R)
    yy, xx = np.mgrid[0:size, 0:size].astype(float)
    xx += .5; yy += .5
    # silhouette: a core plus a ring of edge lobes (the bumpy outline)
    sil = (xx - c) ** 2 + ((yy - c) / squash) ** 2 < (r * .8) ** 2
    ne = max(5, min(11, int(r * .8) + 3))
    a0 = rng.uniform(0, 6.283)
    for k in range(ne):
        a = a0 + 6.283 * k / ne + rng.uniform(-.2, .2)
        rl = r * rng.uniform(.3, .4) if r >= 6 else r * rng.uniform(.42, .5)
        d = r - rl
        lx, ly = c + math.cos(a) * d, c + math.sin(a) * d * squash
        sil |= (xx - lx) ** 2 + (yy - ly) ** 2 < rl * rl
    # light on the whole crown as a ball
    gx, gy = (xx - c) / r, (yy - c) / r
    gz = np.sqrt(np.maximum(0, 1 - gx * gx - gy * gy))
    ball = gx * LIGHT[0] + gy * LIGHT[1] + gz * LIGHT[2] - .1 * gy
    # clumps: Poisson-spaced centres inside the crown
    sp = max(1.6, r * (.42 if r >= 7 else .66)) / density
    if r < 7:
        sun = (.34, .64, .9)        # small crowns: fewer, bigger clumps and one tone less
    pts = []
    for _ in range(900):
        x, y = rng.uniform(c - r, c + r), rng.uniform(c - r, c + r)
        if (x - c) ** 2 + ((y - c) / squash) ** 2 > (r * .92) ** 2:
            continue
        if all((x - q[0]) ** 2 + (y - q[1]) ** 2 >= sp * sp for q in pts):
            pts.append((x, y))
    vals = ball[sil]
    th = [np.quantile(vals, q) for q in sun]
    def tone_at(x, y):
        bx, by = (x - c) / r, (y - c) / r
        bz = math.sqrt(max(0, 1 - bx * bx - by * by))
        v = bx * LIGHT[0] + by * LIGHT[1] + bz * LIGHT[2] - .1 * by
        return sum(v > t for t in th)          # 0 .. len(th)
    base = (2 if r >= 7 else 3) + lift      # small crowns sit a tone sunnier: fewer tones, so lift the floor
    s = Sprite(size, size, int(c), int(c + r * .8))
    s.ix[sil] = R[min(nl - 1, base)]
    cl = []
    for (x, y) in pts:
        t = tone_at(x, y)
        rl = sp * rng.uniform(.62, .78) * (1.08 if t >= 2 else 1)
        cl.append((t, y, x, rl))
    cl.sort()
    for (t, y, x, rl) in cl:
        m = sil & ((xx - x) ** 2 + ((yy - y) / .92) ** 2 < rl * rl)
        lvl = min(nl - 1, base + t)
        s.ix[m] = R[lvl]
        if t >= len(th) - 1 and lvl + 1 < nl:
            # the sunniest clumps carry a highlight crescent on their north-west shoulder
            nx, ny = (xx - x) / rl, (yy - y) / rl
            hi = m & (-(nx * .6 + ny * .8) > .45) & (nx * nx + ny * ny > .2)
            s.ix[hi] = R[lvl + 1]
    # the underside: a dark rim along the bottom of the crown, deepest at the south-east
    bot = sil & ~nb(sil, 0, 1)
    s.ix[bot] = R[max(1, base - 1)]
    bot2 = sil & ~nb(sil, 0, 2) & ~bot & (gx > -.2) & (gy > .3)
    s.ix[bot2] = R[max(1, base - 1)]
    s.despeckle(2)
    if ink:
        s.outline(f'{ramp}0', conn=4)
    else:
        # no ink: the crown's own rim, one step darker, separates it inside a mass
        rim = sil & (~nb(sil, 1, 0) | ~nb(sil, 0, 1))
        inner = sil & ~rim & (~nb(sil, 0, 2) | ~nb(sil, 2, 0)) & ((xx - c) + (yy - c) > -r * .2)
        s.ix[inner] = R[max(1, base - 1)]
        s.ix[rim] = R[max(1, base - 2)]
        s.ix[rim & ((xx - c) + (yy - c) < -r * .4)] = R[max(1, base - 1)]
    s.despeckle(1)
    return s.trimmed()


def pine_small(h, seed=0, ramp='p'):
    """A small conifer (h <= 14 art px) built from whole-pixel tiers, the 16-bit way: each tier widens one
    pixel a row, lit on its west flank, with a dark band under its east half where the next tier overhangs."""
    rng = random.Random(seed)
    tiers = 3 if h >= 11 else 2
    body = h - 1                                   # one row of trunk
    per = [body // tiers + (1 if i < body % tiers else 0) for i in range(tiers)]
    rows = []                                      # (half-width, tier, row-in-tier, rows-in-tier)
    start = 0
    for t, n in enumerate(per):
        for r in range(n):
            hw = start + r
            if t == 0:
                hw = (r + 1) // 2 if n > 2 else r
            rows.append((hw, t, r, n))
        start = max(1, rows[-1][0] - 1)
    W = 2 * max(r[0] for r in rows) + 3
    c = W // 2
    s = Sprite(W, h + 1, c, h - 1)
    for y, (hw, t, r, n) in enumerate(rows):
        last = r == n - 1
        for dx in range(-hw, hw + 1):
            if dx < 0 and dx <= -hw // 2 - (0 if hw > 1 else 1):
                k = 4
                if dx == -hw and r == 1 and len(pal.RAMP[ramp]) > 5:
                    k = 5
            elif dx <= 0:
                k = 3
            else:
                k = 2
            if last and dx > 0:
                k = 1
            s.put(c + dx, y, f'{ramp}{k}')
    s.put(c, h - 1, 'w3')
    s.outline(f'{ramp}0', conn=4)
    s = s.trimmed()
    s.cy = int(s.h * .5)
    return s


def pine(h, seed=0, ramp='p', w=None):
    """Conifer h art px tall (trunk included). Small ones use pine_small's whole-pixel tiers."""
    if h <= 14:
        return pine_small(h, seed, ramp)
    rng = random.Random(seed)
    w = w or max(5, int(h * .62))
    tiers = max(2, min(6, h // 5))
    hc = h - max(1, h // 8)              # canopy rows; the trunk shows below
    W = w + 4
    s = Sprite(W, h + 2, W // 2, h)
    c = W / 2 - .5
    th = hc / tiers
    jit = [rng.uniform(-.35, .35) for _ in range(tiers)]
    for y in range(hc):
        t = (y + .5) / hc
        tier = min(tiers - 1, int(y / th))
        f = ((y - tier * th) + .5) / th
        hw = (w / 2) * (.2 + .8 * ((tier + 1) / tiers)) * (.45 + .55 * f)
        if y == 0:
            hw = .5
        for x in range(W):
            dx = x - c
            lim = hw + (jit[tier] if dx > 0 else -jit[tier] * .5)
            if abs(dx) <= lim:
                rel = dx / max(lim, .5)
                if f > .82 and abs(dx) > .5:
                    k = 1                                   # the dark band under the branches
                elif rel < -.25:
                    k = 4 if f < .6 or rel > -.7 else 3
                elif rel < .35:
                    k = 3 if rel < 0 else 2
                else:
                    k = 2
                if rel < -.6 and f > .45 and f <= .82:
                    k = 5 if len(pal.RAMP[ramp]) > 5 else 4  # the lit branch tip on the west side
                s.ix[y, x] = ix(f'{ramp}{k}')
    # trunk
    tx = int(round(c))
    for y in range(hc, h):
        s.ix[y, tx] = ix('w3')
        if w >= 9:
            s.ix[y, tx + 1] = ix('w1')
    s.despeckle(1)
    s.outline(f'{ramp}0', conn=4)
    s = s.trimmed()
    s.cy = int(s.h * .5)
    return s


def tree(r, seed=0, ramp='l', trunk=None, style='clumps', lift=0, ink=True):
    """A lone broadleaf: crown over a short trunk. Foot anchor = trunk base."""
    cr = clumps(r, seed, ramp, lift=lift, ink=ink) if style == 'clumps' else crown(r, seed, ramp)
    th = trunk if trunk is not None else max(2, int(r * .45))
    tw = 2 if r >= 6 else 1
    W, H = cr.w, cr.h + th
    s = Sprite(W, H, W // 2, H - 1)
    tx = W // 2 - (tw // 2)
    for y in range(cr.h - 3, H):
        for i in range(tw):
            s.ix[y, tx + i] = ix('w4' if i == 0 else 'w2')
        s.ix[y, tx - 1] = ix('w0')
        s.ix[y, tx + tw] = ix('w0')
    s.ix[H - 1, tx - 1:tx + tw + 1] = ix('w0')
    s.blit(cr, 0, 0)
    s.cy = cr.h // 2
    return s


def shadow_ellipse(cv, x, y, r, n=-2, ramps=('g', 'd', 'h'), g=1):
    """A tree's ground shadow, thrown to the south-east."""
    cv.shift(ellipse(x + r * .55, y + r * .2, r * 1.05, r * .62), n, ramps)


def forest(cv, pts, rng, rmin, rmax, kind='leaf', g=1, shadow=True, trunks=True, under=True, scene=None):
    """A forest mass. pts are crown centres (art px). Order of work: every ground shadow (thrown SE), then a
    dark understory under the crowns (the forest floor seen through gaps), then trees north to south."""
    ground = ('g', 'd', 'h')
    items = []
    for (x, y) in pts:
        r = rng.uniform(rmin, rmax)
        items.append((y, x, r, rng.randint(0, 10 ** 6)))
    items.sort()
    if shadow:
        for (y, x, r, sd) in items:
            if kind == 'leaf':
                cv.shift(ellipse(x + r * .5, y + r * .55, r * 1.05, r * .8), -1, ground)
            else:
                cv.shift(ellipse(x + r * .45, y + r * .7, r * .7, r * .55), -1, ground)
    if under:
        lv = 'l1' if kind == 'leaf' else 'p1'
        for (y, x, r, sd) in items:
            cv.fill(ellipse(x, y, r * .82, r * .72), lv, where=lambda a: np.isin(a, [i for k in ground for i in pal.RAMP[k]]))
    for (y, x, r, sd) in items:
        if kind == 'leaf':
            sp = tree(r, sd, 'l', trunk=max(2, int(r * .4)) if trunks else 0, lift=1 if sd % 4 == 0 else 0, ink=(g == 1))
        else:
            sp = pine(int(r * 2.3), sd, 'p')
        if scene is not None:
            scene.add(sp, x, y + (sp.h - 1 - sp.cy))
        else:
            cv.stamp(sp, x, y + (sp.h - 1 - sp.cy))
    return items


_BUSH = {}


def bush(r, seed, ramp='l', lift=1):
    key = (round(r * 2) / 2, seed % 10, ramp, lift)
    if key not in _BUSH:
        _BUSH[key] = clumps(key[0], seed % 10 + 100, ramp, lift=lift)
    return _BUSH[key]


def hedge(cv, a, b, rng, g=1, r=(2.6, 3.5), gap=5.2):
    """A hedgerow from a to b (art px): a chain of small bushes, each throwing its shadow to the south-east."""
    L = math.dist(a, b)
    n = max(1, int(L / (gap / g)))
    pts = []
    for k in range(n + 1):
        t = k / n
        x = a[0] + (b[0] - a[0]) * t + rng.uniform(-.5, .5) / g
        y = a[1] + (b[1] - a[1]) * t + rng.uniform(-.5, .5) / g
        pts.append((x, y, rng.uniform(*r) / g, rng.randint(0, 999)))
    for (x, y, rr, sd) in pts:
        cv.shift(ellipse(x + rr * .7, y + rr * .75, rr * 1.15, rr * .8), -1, ('g', 'd', 'h'))
    return pts


def stamp_bushes(cv, pts, ramp='l', lift=1):
    for (x, y, rr, sd) in sorted(pts, key=lambda p: p[1]):
        sp = bush(rr, sd, ramp, lift)
        cv.stamp(sp, x, y + (sp.h - 1) // 2)
