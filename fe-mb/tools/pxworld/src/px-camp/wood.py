"""Wood at camp scale: a felled log to sit on, a chopping stump with the axe in it, a stack of split firewood.

Bark is the Walnut ramp, lit along the top (w6 lip, w5), mid w4, shaded w3 and w2 under, outlined w0; it shows
furrows broken into plates, each with a lit lip, and knots. Cut ends are the Dirt ramp's pale end (d5 face,
d6 sapwood rim where the light falls, d4 rings, a d3 pith and check crack) inside a ring of bark."""
import math
import random

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, K, new, put, get, nb


def _outline(s, dark='w0', lit=None):
    m = s.ix != CLEAR
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    s.ix[rg] = ix(dark)
    if lit:
        upl = rg & (nb(m, 1, 0) | nb(m, 0, 1)) & ~nb(m, -1, 0) & ~nb(m, 0, -1)
        s.ix[upl] = ix(lit)


def cut_face(s, cx, cy, rx, ry, seed=0, bark=2):
    """A sawn end: bark ring, sapwood rim lit at the upper left, rings, pith, a check crack."""
    rng = random.Random(seed)
    H, W = s.h, s.w
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    outer = cpx.ell_mask(W, H, cx, cy, rx, ry, xx, yy)
    face = cpx.ell_mask(W, H, cx, cy, max(1, rx - bark * .6), max(1, ry - bark), xx, yy)
    s.ix[outer] = ix('w3')
    s.ix[outer & (yy > cy + ry * .3)] = ix('w2')
    s.ix[face] = ix('d5')
    lit = face & ~cpx.ell_mask(W, H, cx + rx * .2, cy + ry * .2, rx - bark * .6, ry - bark, xx, yy)
    s.ix[lit] = ix('d6')
    for f in (.68, .4):
        rg = face & cpx.ell_mask(W, H, cx + .3, cy + .3, rx * f, ry * f, xx, yy) & ~cpx.ell_mask(W, H, cx + .3, cy + .3, rx * f - 1, ry * f - 1, xx, yy)
        s.ix[rg] = ix('d4')
    put(s, cx, cy, 'd3')
    if ry >= 6:
        ang = rng.uniform(-1.2, -.3)
        for k in range(int(ry * .8)):
            px, py = cx + math.cos(ang) * k * rx / ry, cy + math.sin(ang) * k
            if face[int(py), int(px)]:
                put(s, px, py, 'd3')


def log_seat(L=150, D=30, seed=0, knots=2, stub=True):
    """A felled log lying east-west, its west end sawn. Foot anchor = the middle of its underside."""
    rng = random.Random(seed)
    rx = max(4, int(D * .3))
    W, H = L + 6, D + 16
    s = new(W, H, W // 2, H - 4)
    top = H - 4 - D
    cy = top + D / 2
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    x0, x1 = 3 + rx, 3 + L - D * .22
    body = (xx >= x0) & (xx <= x1) & (yy >= top) & (yy <= top + D)
    body |= cpx.ell_mask(W, H, x1, cy, D * .22, D / 2, xx, yy)
    # a slight unevenness along the top: the trunk is not a pipe
    wav = 1.2 * np.sin(xx * .07 + seed) + .8 * np.sin(xx * .19 + 2 * seed)
    body &= ~((yy < top + 1.4 + wav) & (xx > x0 + 6))
    v = (yy - cy) / (D / 2)
    tone = np.full((H, W), ix('w4'), np.uint8)
    tone[v < -.25] = ix('w5')
    tone[v < -.72] = ix('w6')
    tone[v > .3] = ix('w3')
    tone[v > .72] = ix('w2')
    s.ix[body] = tone[body]
    # bark: long fissures running with the log, each wandering a pixel up or down as it goes, now and then
    # forking; the plate above each fissure catches a lit lip on the sunny upper half
    for row in np.arange(-.62, .9, .25):
        y = cy + row * D / 2 + rng.uniform(-.8, .8)
        x = x0 + rng.uniform(1, 8)
        while x < x1 - 4:
            seg = rng.uniform(18, 52)
            yj = 0.0
            for k in range(int(seg)):
                px = int(x + k)
                if px >= W - 1:
                    break
                if k % rng.choice((7, 9, 13)) == 0:
                    yj += rng.choice((-1, 0, 0, 1))
                    yj = max(-1, min(1, yj))
                py = int(round(y + yj))
                if not (body[py, px] and body[py - 1, px] and body[py + 1, px]):
                    continue
                s.ix[py, px] = pal.shift_index(int(s.ix[py, px]), -2)
                if row < .25 and k % 5 != 4:
                    s.ix[py - 1, px] = pal.shift_index(int(tone[py - 1, px]), 1)
            if rng.random() < .35:
                # a fork: a short fissure splitting off downward
                fx = x + seg * rng.uniform(.3, .7)
                for k in range(rng.randint(5, 10)):
                    px, py = int(fx + k), int(round(y + 1 + k * .25))
                    if px < W - 1 and py < H - 1 and body[py, px] and body[py + 1, px]:
                        s.ix[py, px] = pal.shift_index(int(tone[py, px]), -2)
            x += seg + rng.uniform(2, 5)
    # knots
    for _ in range(knots):
        kx, ky = rng.uniform(x0 + 20, x1 - 20), cy + rng.uniform(-D * .25, D * .15)
        m = cpx.ell_mask(W, H, kx, ky, 4.2, 3.2, xx, yy) & body
        s.ix[m] = ix('w2')
        s.ix[m & cpx.ell_mask(W, H, kx - .8, ky - .8, 2.6, 1.8, xx, yy)] = ix('w5')
        s.ix[m & cpx.ell_mask(W, H, kx + .4, ky + .4, 1.4, 1.0, xx, yy)] = ix('w1')
    # a sawn-off branch stub standing up from the top
    if stub:
        bx = int(x0 + (x1 - x0) * rng.uniform(.6, .75))
        for y in range(top - 5, top + 3):
            for i in range(7):
                key = 'w5' if i < 2 else ('w4' if i < 5 else 'w3')
                put(s, bx + i, y, key)
        sw = new(1, 1)
        cut_face(s, bx + 3.5, top - 5, 3.6, 2.2, seed + 5, bark=1)
    # the sawn west end
    cut_face(s, 3 + rx, cy, rx, D / 2, seed, bark=2)
    _outline(s, 'w0', 'w1')
    return s


def stump(r=19, h=18, seed=2, axe=True):
    """A chopping stump: a short trunk with a ringed top face, the axe bitten into it."""
    W, H = 2 * r + 34, h + r + 54
    s = new(W, H, r + 4, H - 6)
    cx = r + 4
    top = H - 6 - h
    ry = r * .45
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    side = (np.abs(xx - cx) <= r) & (yy >= top) & (yy <= top + h)
    side |= cpx.ell_mask(W, H, cx, top + h, r, ry, xx, yy)
    u = (xx - cx) / r
    tone = np.full((H, W), ix('w4'), np.uint8)
    tone[u < -.45] = ix('w5')
    tone[u > .35] = ix('w3')
    tone[u > .75] = ix('w2')
    s.ix[side] = tone[side]
    # vertical bark furrows
    rng = random.Random(seed)
    for x in range(int(cx - r + 3), int(cx + r - 1), 4):
        y0 = top + rng.randint(2, 6)
        for y in range(y0, int(top + h + ry * .7) - rng.randint(1, 5)):
            if side[y, x]:
                s.ix[y, x] = pal.shift_index(int(s.ix[y, x]), -2)
    # roots flaring into the ground: three humps that run out from the foot
    for (ang, L) in ((-1, 9), (1, 8), (.25, 5)):
        bx = cx + ang * r * .85
        for k in range(L):
            yb = top + h + ry * .55 - k * .55
            hw = (L - k) / L * 3.2 + .6
            for i in range(-int(hw), int(hw) + 1):
                put(s, bx + ang * k * .9 + i, yb, 'w4' if i < 0 else 'w3')
    # the top face: rings, a check crack, chop marks
    cut_face(s, cx, top, r, ry, seed, bark=2)
    for k in range(6):
        put(s, cx - 10 + k, top - 1 + (k % 2), 'd4')
    _outline(s, 'w0', 'w1')
    if axe:
        # the head bitten into the face, the haft leaning back to the north-east
        hx, hy = cx + 2, top
        head = ["....kkk.", "..kk665k", ".k666544k", "k6665444k", "k6654433k", "k654433k.", ".k4433k..", "..kk3k...", "....k...."]
        for j, row in enumerate(head):
            for i, ch in enumerate(row):
                if ch != '.':
                    put(s, hx - 5 + i, hy - 8 + j, {'k': 't0', '6': 't6', '5': 't5', '4': 't4', '3': 't3'}[ch])
        for k in range(44):
            px, py = hx + 4 + k * .58, hy - 7 - k
            put(s, px - 1, py, 'w0'); put(s, px, py, 'd6'); put(s, px + 1, py, 'd5'); put(s, px + 2, py, 'd4'); put(s, px + 3, py, 'w0')
        ex, ey = hx + 4 + 44 * .58, hy - 51
        for i in range(-1, 4):
            put(s, ex + i, ey, 'w0')
    return s


def firewood(seed=4, rows=(5, 4, 3)):
    """Split firewood stacked between two stakes, ends to us: each piece a split wedge or a round, with its
    bark on the outer arc."""
    rng = random.Random(seed)
    pw, ph = 15, 13
    W = rows[0] * pw + 20
    H = len(rows) * (ph - 2) + 40
    s = new(W, H, W // 2, H - 4)
    base = H - 4
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    for ri, n in enumerate(rows):
        y = base - ph / 2 - ri * (ph - 2)
        x0 = 10 + (rows[0] - n) * pw / 2
        for k in range(n):
            cx = x0 + k * pw + pw / 2 + rng.uniform(-1, 1)
            cy = y + rng.uniform(-.8, .8)
            r1, r2 = pw / 2 + .2, ph / 2
            m = cpx.ell_mask(W, H, cx, cy, r1, r2, xx, yy)
            split = rng.random()
            if split < .65:
                # a split wedge: one straight edge where the round was cleaved
                a = rng.uniform(0, 6.28)
                nx, ny = math.cos(a), math.sin(a)
                m &= ((xx - cx) * nx + (yy - cy) * ny) < r2 * .45
            # the end grain
            s.ix[m] = ix('d5')
            inner = m & ~cpx.ell_mask(W, H, cx + 1.2, cy + 1.2, r1 - 1, r2 - 1, xx, yy)
            s.ix[inner] = ix('d6')
            bark = m & ~cpx.ell_mask(W, H, cx, cy, r1 - 1.6, r2 - 1.6, xx, yy)
            s.ix[bark] = ix('w3')
            s.ix[bark & (yy > cy + 1)] = ix('w2')
            ring_ = m & cpx.ell_mask(W, H, cx, cy, r1 * .5, r2 * .5, xx, yy) & ~cpx.ell_mask(W, H, cx, cy, r1 * .5 - 1, r2 * .5 - 1, xx, yy)
            s.ix[ring_] = ix('d4')
            put(s, cx, cy, 'd3')
            e = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1] & (s.ix == CLEAR)
            s.ix[e] = ix('w0')
    # the bark lengths on top running back
    ytop = base - len(rows) * (ph - 2) - 2
    for k in range(rows[-1]):
        cx = 10 + (rows[0] - rows[-1]) * pw / 2 + k * pw + pw / 2
        for j in range(1, 6):
            for i in range(-5, 6):
                if get(s, cx + i, ytop - j + 2) == CLEAR:
                    put(s, cx + i, ytop - j + 2, 'w4' if i < 0 else 'w3')
        for i in range(-5, 6):
            if get(s, cx + i, ytop - 4) == ix('w4') or get(s, cx + i, ytop - 4) == ix('w3'):
                put(s, cx + i, ytop - 4, 'w5')
    # stakes either end
    for sx in (5, W - 6):
        for y in range(base - len(rows) * (ph - 2) - 8, base + 2):
            put(s, sx - 1, y, 'w0'); put(s, sx, y, 'w5'); put(s, sx + 1, y, 'w3'); put(s, sx + 2, y, 'w0')
        put(s, sx, base - len(rows) * (ph - 2) - 9, 'w0'); put(s, sx + 1, base - len(rows) * (ph - 2) - 9, 'w0')
    _outline(s, 'w0')
    return s


if __name__ == '__main__':
    from PIL import Image
    W, H = 420, 130
    a = np.full((H, W), ix('g5'), np.uint8)
    x = 4
    for sp in (log_seat(), stump(), firewood()):
        m = sp.ix != CLEAR
        y = H - 8 - sp.ay
        sub = a[y:y + sp.h, x:x + sp.w]
        sub[m] = sp.ix[m]
        x += sp.w + 8
    Image.fromarray(cpx.to_rgba(a), 'RGBA').resize((W * 3, H * 3), Image.NEAREST).save('t/wood3x.png')
