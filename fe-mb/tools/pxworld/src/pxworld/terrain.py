"""pxworld terrain: ground painters that work on a whole Canvas, in art px.

grass()    meadow ground: a base tone with soft half-step patches (clean edges, never per-pixel noise)
hills()    a height field lit from the north-west, quantised into lit / shade bands with a foot line
patch()    trampled dirt under a place; the grass rim shades its north-west lip
road()     a dirt track: shadowed north lip, a lit grass lip on the far side, a few pebbles
river()    water in channel / mid / shallow bands that wander; the west bank's shadow on the water;
           mud and sand banks of varying width
ripples()  flow streaks along the current
field()    a patchwork field: furrow stripes at a clean pixel slope
tufts(), flowers(), stones(), reeds()   hand-placed detail, Poisson spaced, coloured from the ground under it
Every painter takes g (the grain: 1 or 2 screen px per art px) to pick its pixel recipe.
"""
import math
import random

import numpy as np
from scipy import ndimage

from . import pal
from .canvas import Canvas, Sprite, poly, ellipse, nb, edge, lut
from .pal import ix

GROUND = ('g', 'd', 'h')


def ids_of(ramps):
    return [i for r in ramps for i in pal.RAMP[r]]


# ---------------------------------------------------------------- fields of numbers
def smooth_noise(w, h, cell, seed, octaves=2):
    """Low-frequency value noise in [-1, 1]: broad shapes only."""
    rng = np.random.RandomState(seed)
    out = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        c = max(2, cell / (2 ** o))
        gw, gh = int(w / c) + 4, int(h / c) + 4
        gr = rng.uniform(-1, 1, (gh, gw))
        z = ndimage.zoom(gr, ((h + 3 * c) / gh, (w + 3 * c) / gw), order=3)[:h, :w]
        out += z * amp
        tot += amp
        amp *= .45
    out /= tot
    return np.clip(out / (np.abs(out).max() + 1e-9), -1, 1)


def noise1(seed, scale, n=4):
    """A smooth 1-D function of arclength in about [-1, 1]."""
    rng = random.Random(seed)
    terms = [(rng.uniform(.6, 1.0) / (k + 1), scale / (k + 1) * rng.uniform(.8, 1.25), rng.uniform(0, 6.283)) for k in range(n)]
    tot = sum(a for a, _, _ in terms)
    return lambda t: sum(a * np.sin(2 * np.pi * t / lam + ph) for a, lam, ph in terms) / tot


def seg_field(pts, x0, y0, x1, y1):
    """Distance from every pixel centre in the box to polyline pts, the side (+1 = right of travel)
    and the arclength position along the line."""
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(float)
    xx += .5; yy += .5
    best = np.full(xx.shape, 1e9)
    side = np.zeros(xx.shape)
    along = np.zeros(xx.shape)
    run = 0.0
    for i in range(len(pts) - 1):
        ax, ay = pts[i]; bx, by = pts[i + 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9
        L = math.sqrt(L2)
        t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / L2, 0, 1)
        px, py = ax + t * dx, ay + t * dy
        d = np.hypot(xx - px, yy - py)
        m = d < best
        best[m] = d[m]
        cr = dx * (yy - ay) - dy * (xx - ax)
        side[m] = np.sign(cr[m])
        along[m] = run + t[m] * L
        run += L
    return best, side, along


def bbox(pts, pad):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return int(min(xs) - pad), int(min(ys) - pad), int(max(xs) + pad) + 1, int(max(ys) + pad) + 1


def clip_box(cv, x0, y0, x1, y1):
    return max(0, x0), max(0, y0), min(cv.w, x1), min(cv.h, y1)


def majority(a, ids, passes=1, size=3):
    """Smooth the borders between the given palette ids with a majority vote (keeps edges clean)."""
    for _ in range(passes):
        counts = np.stack([ndimage.uniform_filter((a == i).astype(float), size, mode='nearest') for i in ids])
        win = np.array(ids, np.uint8)[counts.argmax(0)]
        sel = np.isin(a, ids)
        a[sel] = win[sel]
    return a


# ---------------------------------------------------------------- ground
def grass(cv, seed=1, g=1, base='g5', dark='g4', sun='g6', cell=170, cut=.3):
    """Meadow: a base tone with broad half-step patches of shade and sun. g=2 adds a checker seam."""
    W, H = cv.w, cv.h
    n = smooth_noise(W, H, cell / g, seed, 2)
    n2 = smooth_noise(W, H, cell * .55 / g, seed + 7, 1)
    a = np.full((H, W), ix(base), np.uint8)
    a[n + .25 * n2 < -cut] = ix(dark)
    a[(n + .3 * n2) > cut] = ix(sun)
    majority(a, [ix(dark), ix(base), ix(sun)], passes=3, size=5 if g == 1 else 3)
    if g == 2:
        yy, xx = np.mgrid[0:H, 0:W]
        chk = (xx + yy) % 2 == 0
        for hi, lo in ((sun, base), (base, dark)):
            A = a == ix(hi)
            seam = A & (nb(a, 0, 1) == ix(lo)) & chk
            a[seam] = ix(lo)
    cv.ix[:] = a
    return n


def hills(cv, hl, g=1, ramps=('g',)):
    """hl = [(cx, cy, rx, ry, rot_deg, kind)] in art px; kind 'mound' (a soft swell) or 'ridge' (a real rise).
    Each hill is lit as a low dome from the north-west: a sunlit crescent on its NW flank, a shaded crescent on
    its SE flank, deepest at the foot, where a ridge also gets a solid 1 px contour. Grass half-steps only, so a
    hill is a change of light on the meadow, not a new colour. Returns the ridge mask (for crest rocks)."""
    W, H = cv.w, cv.h
    on = np.isin(cv.ix, ids_of(ramps))
    a = cv.ix
    L = np.array([-.55, -.7, .45]); L /= np.linalg.norm(L)
    ridge_all = np.zeros((H, W), bool)
    for kind in ('mound', 'ridge'):
        hf = np.zeros((H, W))
        for (cx, cy, rx, ry, rot, kd) in hl:
            if kd != kind:
                continue
            pad = int(max(rx, ry)) + 3
            x0, y0, x1, y1 = max(0, int(cx - pad)), max(0, int(cy - pad)), min(W, int(cx + pad)), min(H, int(cy + pad))
            yy, xx = np.mgrid[y0:y1, x0:x1].astype(float)
            c, s_ = math.cos(math.radians(rot)), math.sin(math.radians(rot))
            dx, dy = xx + .5 - cx, yy + .5 - cy
            u, v = (dx * c + dy * s_) / rx, (-dx * s_ + dy * c) / ry
            r2 = u * u + v * v
            ht = (1.0 if kind == 'ridge' else .55) * min(rx, ry)
            bump = np.clip(1 - r2, 0, None) ** .85 * ht
            hf[y0:y1, x0:x1] = hf[y0:y1, x0:x1] + bump if kind == 'ridge' else np.maximum(hf[y0:y1, x0:x1], bump)
        if not hf.any():
            continue
        hs = ndimage.gaussian_filter(hf, 1.0)
        gy, gx = np.gradient(hs)
        n = np.stack([-gx, -gy, np.ones_like(gx)], -1)
        n /= np.linalg.norm(n, axis=-1, keepdims=True)
        b = n @ L - L[2]                     # 0 on the flat
        region = hf > 0
        if kind == 'ridge':
            bands = [(b > .2, 2), ((b > .07) & (b <= .2), 1), ((b < -.07) & (b >= -.2), -1), ((b < -.2) & (b >= -.38), -2), (b < -.38, -3)]
        else:
            bands = [(b > .09, 1), (b < -.09, -1)]
        q = np.zeros((H, W), np.int8)
        for m, k in bands:
            q[m & region] = k
        # clean the band shapes: a 5x5 vote at grain 1, 3x3 at grain 2
        q2 = q.copy()
        for _ in range(2):
            best = None
            ks = sorted(set(k for _, k in bands) | {0})
            cnt = np.stack([ndimage.uniform_filter((q2 == k).astype(float), 5 if g == 1 else 3) for k in ks])
            q2 = np.array(ks, np.int8)[cnt.argmax(0)]
        q2[~region] = 0
        for k in set(k for _, k in bands):
            mm = (q2 == k) & on
            a[mm] = lut(k, True)[a[mm]]
        if kind == 'ridge':
            # the foot: a solid contour where the shaded flank meets the flat
            reg = ndimage.binary_opening(hf > .04 * hf.max(), np.ones((3, 3)))
            foot_m = reg & (~nb(reg, 1, 0) | ~nb(reg, 0, 1)) & (q2 < 0) & on
            a[foot_m] = lut(-2, True)[a[foot_m]]
            ridge_all |= region & (q2 >= 0) & (hf > .55 * ht)
    return ridge_all


def patch(cv, cx, cy, rx, ry, seed, g=1, base='d4'):
    """Trampled dirt under a place: a blob with a gently wobbling edge."""
    rng = np.random.RandomState(seed)
    x0, y0 = int(cx - rx - 4), int(cy - ry - 4)
    x1, y1 = int(cx + rx + 5), int(cy + ry + 5)
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(float)
    ang = np.arctan2(yy + .5 - cy, xx + .5 - cx)
    wob = np.zeros_like(ang)
    for k, amp in ((2, .06), (3, .06), (5, .04)):
        wob += amp * np.sin(k * ang + rng.uniform(0, 6.28))
    r = np.hypot((xx + .5 - cx) / rx, (yy + .5 - cy) / ry)
    m = r < 1 + wob
    if g == 1:
        m = ndimage.binary_opening(m, np.ones((3, 3)))
    cs, ls = cv._clip(m, x0, y0)
    if cs is None:
        return None
    sub = cv.ix[cs]
    mm = m[ls]
    was = sub.copy()
    sub[mm] = ix(base)
    b = ix(base)
    # the lip nearest the north-west sits in the grass's shadow; the far rim is sunlit dust
    sh = mm & (~nb(mm, 0, -1) | ~nb(mm, -1, 0))
    sub[sh] = pal.shift_index(b, -1)
    lit = mm & ~nb(mm, 0, 1) & ~sh
    sub[lit] = pal.shift_index(b, 1)
    # the grass just beyond the far rim catches the sun
    out = ~mm & nb(mm, 0, -1) & np.isin(was, pal.RAMP['g'])
    sub[out] = lut(1, True)[was[out]]
    # wear: pebbles (a lit pixel over a dark one) and short scuffs, sparse
    r = random.Random(seed)
    inner = mm & ~sh & ~lit
    ys, xs = np.nonzero(inner)
    n = int(len(xs) * (.012 if g == 1 else .02))
    for k in r.sample(range(len(xs)), min(n, len(xs))) if len(xs) else []:
        px, py = xs[k], ys[k]
        if py + 1 < mm.shape[0] and inner[py + 1, px]:
            if r.random() < .6:
                sub[py, px] = pal.shift_index(b, 1)
                sub[py + 1, px] = pal.shift_index(b, -1)
            elif g == 1 and px + 2 < mm.shape[1] and inner[py, px + 2]:
                sub[py, px:px + 3] = pal.shift_index(b, -1)
    # green tufts creeping over the rim
    rim = mm & ~nb(mm, 0, 1)
    ys, xs = np.nonzero(rim | sh)
    for k in r.sample(range(len(xs)), min(len(xs), int(len(xs) * (.16 if g == 1 else .1)))) if len(xs) else []:
        px, py = xs[k], ys[k]
        tuft = (["+.+", "121"] if g == 1 else ["+1"]) if r.random() < .5 else (["+.", "12"] if g == 1 else ["1"])
        for j, row in enumerate(tuft):
            for i, ch in enumerate(row):
                yy, xx = py - len(tuft) + 1 + j, px - 1 + i
                if ch != '.' and 0 <= yy < mm.shape[0] and 0 <= xx < mm.shape[1]:
                    sub[yy, xx] = ix({'1': 'g3', '2': 'g2', '+': 'g7'}[ch])
    return m, x0, y0


# ---------------------------------------------------------------- tracks
def road(cv, pts, hw, g=1, base='d4', pebbles=0.0, seed=0, lip=True, not_on=None, ruts=True):
    """A dirt road of half-width hw along polyline pts (art px). Returns its full-canvas mask."""
    x0, y0, x1, y1 = clip_box(cv, *bbox(pts, hw + 3))
    if x1 <= x0 or y1 <= y0:
        return None
    d, side, along = seg_field(pts, x0, y0, x1, y1)
    m = d <= hw
    sub = cv.ix[y0:y1, x0:x1]
    if not_on is not None:
        m &= ~not_on[y0:y1, x0:x1]
    was = sub.copy()
    b = ix(base)
    onroad = np.isin(was, ids_of(('d',)))
    sub[m & ~onroad] = b
    sub[m & onroad] = np.maximum(sub[m & onroad], 0)  # keep a patch's own shading where the road runs in
    newm = m & ~onroad
    sh = newm & (~nb(m, 0, -1, True) | ~nb(m, -1, 0, True))
    sub[sh] = pal.shift_index(b, -1)
    if g == 1:
        sh2 = newm & ~nb(m, 0, -1, True) & ~nb(m, -1, 0, True)
        sub[sh2] = pal.shift_index(b, -2)
    if lip:
        out = ~m & nb(m, 0, -1, False) & np.isin(was, pal.RAMP['g'])
        sub[out] = lut(1, True)[was[out]]
    if ruts and g == 1 and hw >= 2.8:
        # two wheel ruts either side of the crown of the road, worn in short runs
        rut = newm & ~sh & (np.abs(d - 1.55) < .42) & ((along % 9) < 6.5)
        sub[rut] = pal.shift_index(b, -1)
    if pebbles:
        rng = random.Random(seed)
        ys, xs = np.nonzero(newm & ~sh)
        for k in (rng.sample(range(len(xs)), int(len(xs) * pebbles)) if len(xs) else []):
            x, y = xs[k], ys[k]
            if y + 1 < sub.shape[0] and newm[y + 1, x] and not sh[y + 1, x]:
                sub[y, x] = pal.shift_index(b, 1)
                sub[y + 1, x] = pal.shift_index(b, -1)
    full_m = np.zeros((cv.h, cv.w), bool)
    full_m[y0:y1, x0:x1] = m
    return full_m


def river(cv, pts, hw, g=1, seed=3):
    """The river. pts run north to south. Returns a dict: water, bank (full-canvas masks), and the local
    distance / side / arclength fields with their box, for ripples and reeds."""
    pad = hw * 1.8 + 8
    x0, y0, x1, y1 = clip_box(cv, *bbox(pts, pad))
    d, side, along = seg_field(pts, x0, y0, x1, y1)
    west = side > 0                            # heading south, the right hand is the west bank
    sgn = np.where(west, 1.0, -1.0)
    s = sgn * d                                # signed: + west, - east
    L = along.max() + 1
    wid = noise1(seed, 160 / g)(along)         # the river breathes
    wid2 = noise1(seed + 1, 90 / g)(along)
    chan = noise1(seed + 2, 120 / g)(along)
    hwv = hw * (1 + .1 * wid)
    sub = cv.ix[y0:y1, x0:x1]
    was = sub.copy()
    mud_w = (2.0 + .9 * wid2) / g ** .6
    sand_w = (2.4 + 1.8 * np.maximum(0, -sgn * chan) + .8 * wid) / g ** .6   # sand bars where the channel swings away
    water = d <= hwv
    mud = ~water & (d <= hwv + mud_w)
    sand = ~water & ~mud & (d <= hwv + mud_w + sand_w)
    damp = ~water & ~mud & ~sand & (d <= hwv + mud_w + sand_w + 2.2 / g)
    sub[sand & ~west] = ix('d5')
    sub[sand & west] = ix('d4')
    sub[mud & ~west] = ix('d3')
    sub[mud & west] = ix('d2')
    gr = np.isin(was, pal.RAMP['g'])
    dm = damp & gr
    sub[dm] = lut(-1, True)[was[dm]]
    # water bands: a channel that wanders, the west bank's shadow, sunlit shallows on the east
    t = d / hwv
    off = (s / hwv) - .28 * chan                # position across, relative to the wandering channel
    sub[water] = ix('a3')
    sub[water & (np.abs(off) < .36)] = ix('a2')
    sub[water & west & (t > .64)] = ix('a2')
    sub[water & west & (t > .86)] = ix('a1')
    sub[water & ~west & (t > .7)] = ix('a4')
    sub[water & ~west & (t > .9)] = ix('a5')
    ids = [ix(k) for k in ('a1', 'a2', 'a3', 'a4', 'a5')]
    w2 = sub.copy()
    majority(w2, ids, 2)
    sub[water] = w2[water]
    # bank edges cleaned too
    bids = [ix(k) for k in ('d2', 'd3', 'd4', 'd5')]
    b2 = sub.copy()
    majority(b2, bids, 1)
    sub[mud | sand] = b2[mud | sand]
    rd = {'water': np.zeros((cv.h, cv.w), bool), 'bank': np.zeros((cv.h, cv.w), bool), 'box': (x0, y0, x1, y1),
          'd': d, 'side': side, 'along': along, 'hw': hwv, 'outer': hwv + mud_w + sand_w}
    rd['water'][y0:y1, x0:x1] = water
    rd['bank'][y0:y1, x0:x1] = mud | sand
    return rd


def ripples(cv, rd, pts, g=1, seed=5, every=12):
    """Flow streaks in the open water, laid along the current: a light core with darker tails."""
    rng = random.Random(seed)
    x0, y0, x1, y1 = rd['box']
    d, hwv = rd['d'], rd['hw']
    L = poly_len(pts)
    n = int(L / (every / g))
    for k in range(n):
        s = (k + rng.uniform(-.35, .35)) * every / g
        off = rng.choice((-1, 1)) * rng.uniform(.15, .55)
        ln = rng.choice((3, 4, 5, 6, 7)) if g == 1 else rng.choice((2, 3, 3))
        p, tan = _at(pts, s)
        nx, ny = tan[1], -tan[0]
        loc = (int(p[1] - y0), int(p[0] - x0))
        if not (0 <= loc[0] < d.shape[0] and 0 <= loc[1] < d.shape[1]):
            continue
        hw_here = hwv[loc]
        cx, cy = p[0] + nx * off * hw_here, p[1] + ny * off * hw_here
        for j in range(ln):
            x = int(math.floor(cx + tan[0] * (j - ln / 2)))
            y = int(math.floor(cy + tan[1] * (j - ln / 2)))
            if cv.get(x, y) in (ix('a2'), ix('a3')):
                cv.put(x, y, 'a5' if (g == 1 and 0 < j < ln - 1) else 'a4')


def _at(pts, s):
    run = 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        L = math.dist(a, b)
        if run + L >= s or i == len(pts) - 2:
            t = 0 if L == 0 else max(0, min(1, (s - run) / L))
            tx, ty = (b[0] - a[0]) / (L or 1), (b[1] - a[1]) / (L or 1)
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), (tx, ty)
        run += L
    return pts[-1], (0, 1)


def point_at(pts, s):
    return _at(pts, s)


def poly_len(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


# ---------------------------------------------------------------- fields
STRIPES = {
    'wheat': ('h4', 'h3', 'h3', 'h2'),
    'wheat2': ('h5', 'h4', 'h3', 'h3'),
    'crop': ('g8', 'g7', 'g7', 'g5'),
    'crop2': ('g7', 'g6', 'g6', 'g4'),
    'plough': ('d4', 'd3', 'd3', 'd2'),
}


def field(cv, pts, kind, vec=(1, 3), width=4, g=1, stripes=None):
    """A field: polygon pts filled with furrow stripes. vec is an integer direction (a, b): the stripes are the
    lines a*x + b*y = const, so small integers keep every stripe a clean pixel slope."""
    m, x0, y0 = poly(pts)
    cs, ls = cv._clip(m, x0, y0)
    if cs is None:
        return None
    mm = m[ls]
    yy, xx = np.mgrid[cs[0], cs[1]]
    a, b = vec
    tones = stripes or STRIPES[kind]
    step = max(1, int(round(width * math.hypot(a, b) / len(tones))))
    if g == 2:
        step = 2 if max(abs(a), abs(b)) == 2 else max(1, width // 2)
    u = a * xx + b * yy
    k = ((u // step) % len(tones)).astype(int)
    lut_t = np.array([ix(t) for t in tones], np.uint8)
    sub = cv.ix[cs]
    sub[mm] = lut_t[k[mm]]
    e_n = mm & (~nb(mm, 0, -1, False) | ~nb(mm, -1, 0, False))
    sub[e_n] = lut(-1)[sub[e_n]]
    e_s = mm & (~nb(mm, 0, 1, False) | ~nb(mm, 1, 0, False)) & ~e_n
    sub[e_s] = lut(1)[sub[e_s]]
    full_m = np.zeros((cv.h, cv.w), bool)
    full_m[cs] = mm
    return full_m


# ---------------------------------------------------------------- small hand-placed detail
def poisson(rng, x0, y0, x1, y1, mind, tries, ok=None):
    pts = []
    cell = mind / math.sqrt(2)
    grid = {}
    for _ in range(tries):
        p = (rng.uniform(x0, x1), rng.uniform(y0, y1))
        if ok and not ok(p):
            continue
        gx, gy = int(p[0] / cell), int(p[1] / cell)
        bad = False
        for i in range(gx - 2, gx + 3):
            for j in range(gy - 2, gy + 3):
                q = grid.get((i, j))
                if q and (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < mind * mind:
                    bad = True
                    break
            if bad:
                break
        if not bad:
            grid[(gx, gy)] = p
            pts.append(p)
    return pts


def clustered(rng, centres, per, spread, ok=None):
    """Points gathered round centres (a Gaussian spray), so detail comes in clumps, not wallpaper."""
    out = []
    for (cx, cy) in centres:
        n = rng.randint(per[0], per[1])
        for _ in range(n):
            p = (rng.gauss(cx, spread), rng.gauss(cy, spread * .7))
            if ok is None or ok(p):
                out.append(p)
    return out


# grass tufts: '1' = blade (ground one step down), '2' = root (two down), '+' = sunlit tip (one step up)
TUFTS_1 = [
    ["+.+..", "1+1+.", "21211"],
    [".+..+", "+1.+1", "1211."],
    ["+..+.+", "1+.1+1", "21.211"],
    [".+.", "+1+", "121"],
    ["+.+", "1.1"],
    [".+.+.", "+1+1+", "12121"],
]
TUFTS_2 = [
    ["+.+", "121"],
    [".+", "+1"],
    ["+.+.", "1+11"],
]


def tufts(cv, rng, pts, g=1, only=('g',)):
    """Grass tufts coloured from the ground under them, so they sit in any patch or shadow."""
    lib = TUFTS_1 if g == 1 else TUFTS_2
    ok_ids = set(ids_of(only))
    for (x, y) in pts:
        t = rng.choice(lib)
        if rng.random() < .5:
            t = [r[::-1] for r in t]
        x0, y0 = int(x) - len(t[0]) // 2, int(y) - len(t) + 1
        if any(cv.get(x0 + i, y0 + j) not in ok_ids for j, r in enumerate(t) for i, ch in enumerate(r) if ch != '.'):
            continue
        for j, r in enumerate(t):
            for i, ch in enumerate(r):
                if ch == '.':
                    continue
                c = cv.get(x0 + i, y0 + j)
                n = {'1': -1, '2': -2, '+': 1}[ch]
                cv.ix[y0 + j, x0 + i] = pal.shift_index(c, n)


FLOWERS = {'bone': ('b5', 'b3'), 'straw': ('o5', 'o3'), 'rose': ('x5', 'x4'), 'sky': ('s5', 's4')}


def flowers(cv, rng, pts, kinds=('bone', 'straw', 'bone', 'rose'), g=1):
    """Tiny flower sprigs in little clusters: a lit head over a shaded pixel of the ground."""
    ok_ids = set(pal.RAMP['g'])
    for (x, y) in pts:
        hi, lo = FLOWERS[rng.choice(kinds)]
        for k in range(rng.choice((2, 3, 3, 4)) if g == 1 else rng.choice((1, 2))):
            px, py = int(x + rng.randint(-3, 3) // g), int(y + rng.randint(-2, 2) // g)
            if cv.get(px, py) in ok_ids and cv.get(px, py + 1) in ok_ids and cv.get(px + 1, py) in ok_ids:
                cv.put(px, py, hi)
                cv.ix[py + 1, px] = pal.shift_index(cv.get(px, py + 1), -1)


def stones(cv, rng, pts, g=1):
    """Field stones, lit top-left, with a ground shadow to the south-east."""
    for (x, y) in pts:
        x, y = int(x), int(y)
        if g == 2:
            shape = ["43"]
        elif rng.random() < .5:
            shape = ["53", "32"]
        else:
            shape = [".54.", "5432", ".32."]
        for j, r in enumerate(shape):
            for i, ch in enumerate(r):
                if ch != '.':
                    cx, cy = x + i + 1, y + j + 1
                    if 0 <= cx < cv.w and 0 <= cy < cv.h:
                        cv.ix[cy, cx] = pal.shift_index(cv.get(cx, cy), -1)
        for j, r in enumerate(shape):
            for i, ch in enumerate(r):
                if ch != '.':
                    cv.put(x + i, y + j, 't' + ch)


REED_1 = [
    ["..d.....", "..1..d..", ".+1..1.+", ".11.+1.1", "1.1.11.1", "1211211."],
    [".d....", ".1..+.", "+1..1.", "11.+1.", "1211.1"],
    ["...d..", "+..1..", "1.+1.+", "1.11.1", "121211"],
]
REED_2 = [
    [".d.", "+1.", "121"],
    ["d.+", "1.1", "121"],
]


def reeds(cv, rng, pts, g=1):
    """Reed beds at the water's edge: blades from the Leaf ramp, sunlit tips, a cattail head here and there."""
    lib = REED_1 if g == 1 else REED_2
    km = {'1': 'l3', '2': 'l2', '+': 'l5', 'd': 'd1'}
    for (x, y) in pts:
        t = rng.choice(lib)
        if rng.random() < .5:
            t = [r[::-1] for r in t]
        x0, y0 = int(x) - len(t[0]) // 2, int(y) - len(t) + 1
        for j, r in enumerate(t):
            for i, ch in enumerate(r):
                if ch != '.':
                    cv.put(x0 + i, y0 + j, km[ch])


def river_rock(cv, x, y, g=1, flow=(0, 1)):
    """A boulder standing in the current: lit top, foam piled on its upstream face, a V of wake below."""
    x, y = int(x), int(y)
    if g == 1:
        rock = [".kkk.", "k654k", "k543k", ".kkk."]
        foam = [(-1, -1), (0, -2), (1, -2), (2, -2), (3, -2), (4, -1)]
        wake = [(-1, 4), (-2, 5), (-3, 6), (5, 4), (6, 5), (7, 6), (-2, 8), (7, 8)]
    else:
        rock = ["kk", "54", "kk"]
        foam = [(0, -1), (1, -1)]
        wake = [(-1, 3), (2, 3), (-1, 5), (2, 5)]
    for (dx, dy) in wake:
        if cv.get(x + dx, y + dy) in pal.RAMP['a']:
            cv.put(x + dx, y + dy, 'a5')
    for (dx, dy) in foam:
        if cv.get(x + dx, y + dy) in pal.RAMP['a']:
            cv.put(x + dx, y + dy, 'a7' if g == 1 else 'a6')
    for j, row in enumerate(rock):
        for i, ch in enumerate(row):
            if ch != '.':
                cv.put(x + i, y + j, 'k0' if ch == 'k' else 't' + ch)
