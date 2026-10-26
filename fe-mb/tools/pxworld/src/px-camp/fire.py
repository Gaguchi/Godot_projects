"""The fire: a ring of fieldstones, an ash bed, three split logs burning in a cross, a flame in five tones,
a little smoke. Stones: three tones (t5 lit, t4, t3) over a t2 underside, outlined t1 on the lit side and t0 on
the shaded side, each with a hard contact shadow. The flame has no glow: it is paint, not light."""
import math
import random

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, K, new, put, get, nb

LIGHT = np.array([-.55, -.62, .56])
LIGHT /= np.linalg.norm(LIGHT)


def stone(w, h, seed, soot=0.0, moss=False):
    """A fieldstone w x h: a squarish pillow, lit from the upper left. soot (0..1) darkens its upper half
    (the side that faces the fire, for the back of the ring)."""
    rng = random.Random(seed)
    W, H = w + 4, h + 4
    s = new(W, H, W // 2, H - 3)
    cx, cy = W / 2, H / 2 + .3
    rx, ry = w / 2, h / 2
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    ang = np.arctan2(yy - cy, xx - cx)
    wob = 1 + .08 * np.sin(2 * ang + rng.uniform(0, 6)) + .06 * np.sin(3 * ang + rng.uniform(0, 6)) + .03 * np.sin(5 * ang + rng.uniform(0, 6))
    p = rng.uniform(1.8, 3.4)
    q = (np.abs((xx - cx) / rx) ** p + np.abs((yy - cy) / ry) ** p) ** (1 / p) / wob
    m = q <= 1
    z = np.sqrt(np.clip(1 - q ** 2, 0, 1)) * (1.0 - .35 * (yy - cy) / ry)
    gy, gx = np.gradient(z)
    nrm = np.stack([-gx * 2.4, -gy * 2.4, np.ones_like(z)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    b = nrm @ LIGHT
    # a flat top facet catches the most light
    b += .12 * (q < .55) * (yy < cy)
    t = np.full(m.shape, ix('t4'), np.uint8)
    lo, hi = np.quantile(b[m], .3), np.quantile(b[m], .7)
    t[b > hi] = ix('t5')
    t[b < lo] = ix('t3')
    under = m & ~nb(m, 0, 2) & (yy > cy)
    t[under] = ix('t2')
    s.ix[m] = t[m]
    if soot:
        top = m & (yy < cy + ry * (soot - .6))
        s.ix[top] = lut1(s.ix[top], -1)
    # a chip: a short dark crack with a lit pixel over it
    if rng.random() < .7:
        x0 = int(cx + rng.uniform(-rx * .4, rx * .3)); y0 = int(cy + rng.uniform(-ry * .2, ry * .3))
        for k in range(rng.choice((2, 3, 4))):
            if m[y0 + k // 2, x0 + k]:
                s.ix[y0 + k // 2, x0 + k] = ix('t2')
                if m[y0 + k // 2 - 1, x0 + k]:
                    s.ix[y0 + k // 2 - 1, x0 + k] = ix('t5') if k == 0 else s.ix[y0 + k // 2 - 1, x0 + k]
    if moss:
        mm = m & ~nb(m, 0, 3) & (xx < cx + rx * .2)
        s.ix[mm & (yy > cy + ry * .3)] = ix('m3')
        s.ix[mm & (yy > cy + ry * .55)] = ix('m2')
    # outline: t1 where it faces the light, t0 elsewhere
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    upl = rg & (nb(m, 1, 0) | nb(m, 0, 1)) & ~nb(m, -1, 0) & ~nb(m, 0, -1)
    s.ix[rg] = ix('t0')
    s.ix[upl] = ix('t1')
    return s


def lut1(a, n):
    return cpx.lut(n)[a]


# ---------------------------------------------------------------- logs in the fire
def burning_log(L, th, ang, seed, cut_out=True):
    """A split log lying at angle ang (deg), its outer end cut (rings), its inner end charred and glowing."""
    rng = random.Random(seed)
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    W = int(abs(ux) * L + th * 2 + 8); H = int(abs(uy) * L + th * 2 + 8)
    s = new(W, H, W // 2, H // 2)
    cx, cy = W / 2, H / 2
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    t = (xx - cx) * ux + (yy - cy) * uy                 # along the log
    n = -(xx - cx) * uy + (yy - cy) * ux                # across it (+ = down-ish)
    m = (np.abs(t) <= L / 2) & (np.abs(n) <= th / 2)
    v = n / (th / 2)
    tone = np.full(m.shape, ix('w4'), np.uint8)
    tone[v < -.35] = ix('w5')
    tone[v < -.75] = ix('w6')
    tone[v > .35] = ix('w3')
    tone[v > .75] = ix('w2')
    s.ix[m] = tone[m]
    # bark furrows along the log
    for k in range(int(L / 5)):
        t0 = rng.uniform(-L / 2 + 4, L / 2 - 8)
        vv = rng.choice((-.4, -.1, .2, .5))
        for j in range(rng.choice((3, 5, 7))):
            px, py = cx + (t0 + j) * ux - vv * th / 2 * uy, cy + (t0 + j) * uy + vv * th / 2 * ux
            if m[int(py), int(px)]:
                s.ix[int(py), int(px)] = lut1(np.array([s.ix[int(py), int(px)]]), -1)[0]
    # the inner end charred: black with glowing cracks
    inner = m & (t > L / 2 - L * .32)
    s.ix[inner] = ix('w0')
    s.ix[inner & (v < -.3)] = ix('w1')
    glow = inner & (np.abs(np.sin(t * .9 + n * .5)) < .2) & (t > L / 2 - L * .26)
    s.ix[glow] = ix('x3')
    s.ix[inner & (t > L / 2 - 3)] = ix('x4')
    # the outer end: a cut face with rings
    if cut_out:
        ex, ey = cx - L / 2 * ux, cy - L / 2 * uy
        face = cpx.ell_mask(W, H, ex, ey, max(2.5, th * .36), th / 2 + .4, xx, yy)
        s.ix[face] = ix('d5')
        s.ix[face & cpx.ell_mask(W, H, ex, ey, th * .22, th * .32, xx, yy)] = ix('d4')
        s.ix[face & cpx.ell_mask(W, H, ex, ey, th * .1, th * .14, xx, yy)] = ix('d3')
        s.ix[face & (yy < ey - th * .25) & (xx < ex)] = ix('d6')
    rg = cpx.ring(np.pad(s.ix != CLEAR, 1), 4)[1:-1, 1:-1]
    s.ix[rg] = ix('w0')
    return s


# ---------------------------------------------------------------- the flame
FLAME = [(-22, 0), (-25, -7), (-26, -14), (-25, -20), (-23, -26), (-21, -23), (-19, -27), (-18, -33), (-16, -38),
         (-14, -44), (-11, -38), (-9, -33), (-7, -39), (-5, -46), (-3, -53), (-1, -59), (2, -66), (4, -58), (6, -50),
         (8, -44), (10, -39), (12, -44), (14, -49), (16, -43), (18, -36), (19, -31), (22, -34), (24, -27), (25, -19),
         (25, -11), (24, -5), (22, 0)]


def flame(seed=2):
    """A cookfire flame in five tones: x3 outer, x4, o4, o5, o6 heart, outlined x1. The silhouette is hand-set
    (three tongues and two small side tips); each inner tone is the same shape drawn smaller toward the base,
    so the tips line up. Licks break off above the tips; a few sparks rise."""
    W, H = 86, 112
    s = new(W, H, W // 2, H - 5)
    bx, by = W / 2, H - 5
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    for (sc_x, sc_y, k, dy) in ((1, 1, 'x3', 0), (.8, .8, 'x4', 0), (.6, .62, 'o4', 0), (.42, .44, 'o5', 0), (.24, .25, 'o6', 0)):
        pts = [(bx + x * 1.22 * sc_x + (1 - sc_x) * 1.5, by + y * 1.24 * sc_y + dy) for x, y in FLAME]
        m = cpx.poly_mask(W, H, pts)
        s.ix[m] = ix(k)
    # licks breaking off above the three tips
    for (lx, ly, lh, lw) in ((bx + 3, by - 92, 7, 2.0), (bx - 17, by - 64, 5, 1.6), (bx + 18, by - 70, 5, 1.4)):
        for j in range(lh):
            tt = (j + .5) / lh                        # 0 at the tip, 1 at the foot: a teardrop, point up
            hw = lw * (tt ** .9) * (1.15 - tt * .45)
            for x in range(int(round(lx - hw)), int(round(lx + hw)) + 1):
                put(s, x, ly + j, 'x3')
        put(s, lx, ly + lh - 2, 'x4')
        put(s, lx, ly + lh - 3, 'x4')
    body = s.ix != CLEAR
    rg = cpx.ring(np.pad(body, 1), 4)[1:-1, 1:-1]
    s.ix[rg & (yy < by - 1)] = ix('x1')
    for (sx, sy, k) in ((bx + 24, by - 80, 'o5'), (bx - 8, by - 98, 'o6'), (bx + 13, by - 104, 'o5'), (bx + 32, by - 54, 'o5'), (bx - 25, by - 74, 'o4')):
        put(s, sx, sy, k)
        put(s, sx, sy + 1, 'x3')
    return s


def smoke(n=6, seed=1, lean=-1):
    """A little smoke: soft, lumpy puffs rising from the flame's tip, swelling and drifting with the wind, the
    highest breaking up. Stone ramp's pale greys: t6 lit cap, t5 body, t4 under. No outline, no alpha.
    Anchor = where it leaves the flame."""
    rng = random.Random(seed)
    W, H = 80, 120
    ax = W - 16 if lean < 0 else 16
    s = new(W, H, ax, H - 2)
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    x, y = float(ax), H - 5.0
    for k in range(n):
        r = 2.4 + k * 1.15
        x += lean * (2.0 + k * 1.1) + 1.6 * math.sin(k * 1.9 + seed)
        y -= 7 + k * 2.8
        # a lumpy puff: two or three overlapping lobes
        m = cpx.ell_mask(W, H, x, y, r * 1.1, r * .8, xx, yy)
        m |= cpx.ell_mask(W, H, x - lean * r * .7, y + r * .3, r * .7, r * .55, xx, yy)
        if k % 2:
            m |= cpx.ell_mask(W, H, x + lean * r * .5, y - r * .45, r * .6, r * .5, xx, yy)
        if k >= n - 2:
            m &= ~cpx.ell_mask(W, H, x + r * .3, y + r * .35, r * .82, r * .6, xx, yy)
        cap = m & cpx.ell_mask(W, H, x - r * .3, y - r * .38, r * .78, r * .5, xx, yy)
        under = m & ~nb(m, 0, -1) & ~cap
        s.ix[m] = ix('t5')
        s.ix[cap] = ix('t6')
        s.ix[under] = ix('t4')
    return s


def fire_ring(rx=56, ry=23, seed=4):
    """Everything inside and on the ring as (sprite, foot_dx, foot_dy, layer) parts around the ring's
    centre: back stones, ash bed, logs, flame, front stones. Also the stones' shadow ellipses."""
    rng = random.Random(seed)
    parts = []
    shadows = []
    n = 13
    stones = []
    for i in range(n):
        a = 2 * math.pi * (i + .5) / n + rng.uniform(-.06, .06)
        x, y = math.cos(a) * rx, math.sin(a) * ry
        kind = rng.random()
        w, h = (rng.randint(19, 23), rng.randint(9, 10)) if kind < .3 else ((rng.randint(13, 15), rng.randint(12, 13)) if kind < .55 else (rng.randint(15, 19), rng.randint(10, 12)))
        stones.append((y, x, w, h, a, rng.randint(0, 9999)))
    # the ash bed
    W, H = 2 * rx + 8, 2 * ry + 8
    bed = new(W, H, W // 2, H // 2)
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    c = (W / 2, H / 2)
    m = cpx.ell_mask(W, H, c[0], c[1], rx - 6, ry - 3, xx, yy)
    bed.ix[m] = ix('t3')
    inner = cpx.ell_mask(W, H, c[0], c[1] + 1, rx - 16, ry - 8, xx, yy)
    bed.ix[inner] = ix('t2')
    core = cpx.ell_mask(W, H, c[0] + 1, c[1] + 1, rx - 28, ry - 13, xx, yy)
    bed.ix[core] = ix('w0')
    # pale ash drifts on the bed, in little worm-like runs
    for _ in range(26):
        x0, y0 = rng.uniform(c[0] - rx + 10, c[0] + rx - 10), rng.uniform(c[1] - ry + 5, c[1] + ry - 5)
        for k in range(rng.choice((2, 3, 4))):
            if m[int(y0), int(x0 + k)] and not core[int(y0), int(x0 + k)]:
                bed.ix[int(y0), int(x0 + k)] = ix('t5') if k == 0 else ix('t4')
    # glowing coals in the core
    for _ in range(14):
        x0, y0 = rng.uniform(c[0] - 18, c[0] + 18), rng.uniform(c[1] - 4, c[1] + 6)
        if core[int(y0), int(x0)]:
            bed.ix[int(y0), int(x0)] = ix('x3')
            if core[int(y0), int(x0) + 1]:
                bed.ix[int(y0), int(x0) + 1] = ix(rng.choice(('x4', 'o4')))
    parts.append((bed, 0, 0, 0))
    for (y, x, w, h, a, sd) in sorted(stones):
        back = math.sin(a) < .05
        st = stone(w, h, sd, soot=.9 if back else 0)
        parts.append((st, x, y + h * .35, 1 if back else 5))
        shadows.append((x + 3, y + h * .35 + 1, w * .55, h * .32))
    # logs in a cross, their burning ends meeting in the middle
    for (ang, L, th, dx, dy, sd, flip) in ((-14, 66, 10, -21, -1, 1, False), (196, 64, 10, 21, -2, 2, False), (-62, 38, 9, -6, -8, 3, False)):
        lg = burning_log(L, th, ang, sd)
        parts.append((lg, dx, dy + lg.h // 2 - lg.ay, 2))
    fl = flame()
    parts.append((fl, 1, 1, 3))
    return parts, shadows


if __name__ == '__main__':
    from PIL import Image
    parts, shadows = fire_ring()
    W, H = 200, 160
    a = np.full((H, W), ix('d4'), np.uint8)
    cxy = (100, 120)
    for (x, y, rx, ry) in shadows:
        m = cpx.ell_mask(W, H, cxy[0] + x, cxy[1] + y, rx, ry)
        a[m] = cpx.lut(-1)[a[m]]
    for (sp, dx, dy, layer) in sorted(parts, key=lambda p: p[3]):
        fx, fy = int(round(cxy[0] + dx)) - sp.ax, int(round(cxy[1] + dy)) - sp.ay
        m = sp.ix != CLEAR
        sub = a[max(0, fy):fy + sp.h, max(0, fx):fx + sp.w]
        mm = m[max(0, -fy):max(0, -fy) + sub.shape[0], max(0, -fx):max(0, -fx) + sub.shape[1]]
        sub[mm] = sp.ix[max(0, -fy):max(0, -fy) + sub.shape[0], max(0, -fx):max(0, -fx) + sub.shape[1]][mm]

    im = Image.fromarray(cpx.to_rgba(a), 'RGBA')
    im.resize((W * 4, H * 4), Image.NEAREST).save('t/fire4x.png')
