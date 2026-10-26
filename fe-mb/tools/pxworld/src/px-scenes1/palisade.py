"""Frontier Camp's stockade at camp scale (people about 140 px, 78 px per metre across, PxCamp's oblique view).

A stake is a split log 0.24-0.3 m thick and 2.1-2.4 m tall, sharpened to a point: Walnut bark lit on its west edge,
shaded east, fissures and the odd knot; the point's two cut faces show pale wood (Dirt ramp), lit on the west. We
see the stockade from inside, so two rails run along its inner face at a third and two thirds of its height, lashed
to every stake with hemp; raking props lean against it now and then; an earth bank is heaped along its foot.
The gate: two heavy posts, a lintel across their heads, one planked leaf swung open against the wall.
Every piece returns an indexed Sprite with its foot anchor, outlined w0 (w1 on the edges facing the light)."""
import math
import random

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, K, nb, put, get

S_M = 78.0          # px per metre, across


def stake(h, w, seed=0, point=None):
    """One sharpened split stake, h px tall (to its point), w px thick. Anchor = foot middle."""
    rng = random.Random(seed)
    pt = point or int(w * rng.uniform(.95, 1.25))
    W, H = w + 4, h + 4
    s = cpx.new(W, H, W // 2, H - 3)
    base = H - 3
    x0 = 2
    tip_dx = rng.choice((-1, 0, 0, 1))
    for y in range(base - h, base + 1):
        k = base - y                                   # height above the foot
        if k > h - pt:
            # the point: a two-faced cut narrowing to the tip
            f = (h - k) / pt                           # 0 at the tip, 1 at the point's foot
            half = w / 2 * f
            cx = x0 + w / 2 + tip_dx * (1 - f)
            xa, xb = int(round(cx - half)), int(round(cx + half))
            for x in range(xa, max(xa + 1, xb)):
                u = (x + .5 - cx) / max(.5, half)
                put(s, x, y, 'd6' if u < -.2 else ('d5' if u < .3 else 'd4'))
            continue
        for i in range(w):
            u = i / max(1, w - 1)
            if u < .18:
                key = 'w6'
            elif u < .42:
                key = 'w5'
            elif u < .7:
                key = 'w4'
            elif u < .88:
                key = 'w3'
            else:
                key = 'w2'
            put(s, x0 + i, y, key)
    # bark fissures: long vertical cracks that wander, a lit lip on the west of each
    for f in range(max(1, w // 6)):
        x = x0 + 3 + f * 6 + rng.randint(-1, 1)
        y = base - rng.randint(2, 10)
        while y > base - h + pt + 2:
            seg = rng.randint(10, 30)
            for j in range(seg):
                yy = y - j
                if yy <= base - h + pt + 1:
                    break
                if j % rng.choice((7, 9)) == 0:
                    x += rng.choice((-1, 0, 1))
                    x = max(x0 + 2, min(x0 + w - 3, x))
                v = get(s, x, yy)
                if v != CLEAR:
                    s.ix[yy, x] = pal.shift_index(v, -2)
                    lv = get(s, x - 1, yy)
                    if lv != CLEAR and lv in (ix('w4'), ix('w3')):
                        s.ix[yy, x - 1] = pal.shift_index(lv, 1)
            y -= seg + rng.randint(4, 9)
    # a knot
    if rng.random() < .55:
        ky = base - rng.randint(int(h * .2), int(h * .7))
        kx = x0 + rng.randint(3, max(4, w - 5))
        for (dx, dy, k_) in ((0, 0, 'w1'), (1, 0, 'w2'), (0, 1, 'w2'), (1, 1, 'w2'), (-1, 0, 'w5'), (0, -1, 'w5'), (1, -1, 'w4')):
            put(s, kx + dx, ky + dy, k_)
    # the foot darkens where earth splashes it
    for x in range(x0, x0 + w):
        for j in range(rng.randint(3, 6)):
            v = get(s, x, base - j)
            if v != CLEAR:
                s.ix[base - j, x] = pal.shift_index(v, -1)
    _outline(s)
    return s


def _outline(s):
    m = s.ix != CLEAR
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    upl = rg & (nb(m, 1, 0) | nb(m, 0, 1)) & ~nb(m, -1, 0) & ~nb(m, 0, -1)
    s.ix[rg] = ix('w0')
    s.ix[upl] = ix('w1')


def rail_run(x0, x1, y_at, th=11, seed=0):
    """A rail (a peeled pole) laid along the inner face from x0 to x1, its centre at y_at(x). Lit on top, shaded
    under, outlined w0. Returns (Sprite in stage coords at its top-left, y foot for sorting)."""
    rng = random.Random(seed)
    xs = range(int(x0), int(x1))
    ys = [y_at(x) for x in xs]
    top, bot = int(min(ys) - th), int(max(ys) + th)
    W, H = int(x1 - x0) + 4, bot - top + 4
    s = cpx.new(W, H, 0, 0)
    for i, x in enumerate(xs):
        cy = ys[i] - top + 2
        for j in range(th):
            v = j / (th - 1)
            key = 'd6' if v < .2 else ('d5' if v < .45 else ('d4' if v < .75 else 'd3'))
            put(s, i + 2, int(round(cy - th / 2 + j)), key)
    # bark left on in patches
    for _ in range(int(W / 30)):
        px = rng.randint(4, W - 12)
        L = rng.randint(6, 18)
        for i in range(L):
            x = px + i
            if x - 2 >= len(ys):
                break
            cy = ys[min(len(ys) - 1, x - 2)] - top + 2
            for j in range(int(th * .55), th):
                put(s, x, int(round(cy - th / 2 + j)), 'w3' if j < th - 2 else 'w2')
    _outline(s)
    return s, (int(x0) - 2, top - 2)


def lashing(s_stage_put, x, y, w=8):
    pass


def gate_post(h, w, seed=0):
    """A heavy squared gate post: lit west face, shaded east face, a pale cap; iron straps (Slate) near its top."""
    rng = random.Random(seed)
    W, H = w + 4, h + 4
    s = cpx.new(W, H, W // 2, H - 3)
    base = H - 3
    for y in range(base - h, base + 1):
        for i in range(w):
            u = i / (w - 1)
            key = 'w5' if u < .35 else ('w4' if u < .6 else ('w3' if u < .85 else 'w2'))
            if y < base - h + 4:
                key = 'd6' if u < .5 else 'd5'          # the sawn top
            put(s, 2 + i, y, key)
    for k in range(3):                                  # grain lines
        x = 2 + int(w * (.25 + .25 * k))
        for y in range(base - h + 6, base - 4):
            if (y * 3 + k * 7) % 23 > 3:
                v = get(s, x, y)
                s.ix[y, x] = pal.shift_index(v, -1)
    for yy in (base - h + 22, base - h + 30):          # two iron straps
        for i in range(w):
            put(s, 2 + i, yy, 't4' if i < w * .4 else 't3')
            put(s, 2 + i, yy + 1, 't2')
        put(s, 2 + int(w * .3), yy, 't6')
    _outline(s)
    return s


def lintel(L, th=16, seed=0):
    """The beam across the gate posts' heads, seen from inside: a squared timber, lit top, pegged at both ends."""
    W, H = L + 4, th + 4
    s = cpx.new(W, H, W // 2, H - 3)
    for x in range(L):
        for j in range(th):
            v = j / (th - 1)
            key = 'w6' if v < .15 else ('w5' if v < .4 else ('w4' if v < .78 else 'w2'))
            if x < 4:
                key = 'd5' if j < th - 3 else 'd4'      # the sawn end
            put(s, 2 + x, 2 + j, key)
    rng = random.Random(seed)
    for k in range(3):
        y = 2 + int(th * (.35 + .2 * k))
        x = 6
        while x < L - 4:
            ln = rng.randint(12, 40)
            for i in range(ln):
                if x + i < L:
                    v = get(s, 2 + x + i, y)
                    s.ix[y, 2 + x + i] = pal.shift_index(v, -1)
            x += ln + rng.randint(8, 20)
    for px_ in (12, L - 14):
        for (dx, dy, k_) in ((0, 0, 'w1'), (1, 0, 'w2'), (0, 1, 'w2'), (1, 1, 'w3')):
            put(s, 2 + px_ + dx, 2 + th // 2 + dy, k_)
    _outline(s)
    return s


def gate_leaf(w, h, seed=0):
    """A planked gate leaf standing open against the inside of the wall: vertical boards, two ledges and a brace
    (a Z), pegged; lit on its west boards. Anchor = foot middle."""
    rng = random.Random(seed)
    W, H = w + 4, h + 4
    s = cpx.new(W, H, W // 2, H - 3)
    base = H - 3
    x = 0
    while x < w:
        pw = min(w - x, rng.choice((15, 16, 17, 18)))
        L = 4 + rng.choice((0, 0, -1))
        top = base - h + rng.randint(0, 3)
        for i in range(pw):
            for y in range(top, base + 1):
                lv = L + (1 if i == 0 else (-2 if i == pw - 1 else 0))
                put(s, 2 + x + i, y, K('w', lv))
        gx = x + rng.randint(3, max(4, pw - 4))
        y = top + 4
        while y < base - 3:
            ln = rng.randint(8, 24)
            for j in range(ln):
                if y + j < base:
                    put(s, 2 + gx, y + j, K('w', L - 1))
            y += ln + rng.randint(6, 14)
        x += pw
    # ledges and the brace
    for ly in (base - int(h * .18), base - int(h * .78)):
        for i in range(w):
            for j in range(10):
                put(s, 2 + i, ly + j, 'w5' if j < 2 else ('w4' if j < 8 else 'w2'))
    y0, y1 = base - int(h * .78) + 10, base - int(h * .18)
    for t in range(0, 101):
        f = t / 100
        cx = 2 + int(w * .08 + (w * .84) * f)
        cy = int(y1 - (y1 - y0) * f)
        for i in range(-5, 6):
            put(s, cx + i, cy, 'w5' if i < -2 else ('w4' if i < 3 else 'w3'))
    for ly in (base - int(h * .18), base - int(h * .78)):
        for px_ in range(10, w - 6, 18):
            put(s, 2 + px_, ly + 4, 'w1'); put(s, 2 + px_ + 1, ly + 4, 'w2'); put(s, 2 + px_, ly + 5, 'w2')
    _outline(s)
    return s


def prop_pole(L, ang_deg, th=12, seed=0):
    """A raking prop: a pole leaning from the ground up against the wall at ang_deg from the ground, filled as one
    solid shape (no holes along the slant), lit on its upper edge, a sawn pale end at the top, bark fissures along it.
    Anchor = its foot on the ground."""
    rng = random.Random(seed)
    a = math.radians(ang_deg)
    ux, uy = math.cos(a), -math.sin(a)            # along the pole, up the screen
    nx, ny = -uy, ux                              # across it
    W = int(abs(ux) * L + th * 2 + 8)
    H = int(abs(uy) * L + th * 2 + 8)
    s = cpx.new(W, H, th + 3, H - th - 3)
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    t = (xx - s.ax) * ux + (yy - s.ay) * uy       # along
    n = (xx - s.ax) * nx + (yy - s.ay) * ny       # across (+ = lower right side)
    m = (t >= 0) & (t <= L) & (np.abs(n) <= th / 2)
    v = (n + th / 2) / th
    tone = np.where(v < .28, ix('w5'), np.where(v < .7, ix('w4'), ix('w3'))).astype(np.uint8)
    s.ix[m] = tone[m]
    # fissures along it
    for k in range(int(L / 14)):
        t0 = rng.uniform(4, L - 16)
        off = rng.choice((-.15, .1, .25)) * th
        for j in range(rng.randint(6, 12)):
            q = (int(s.ax + (t0 + j) * ux + off * nx), int(s.ay + (t0 + j) * uy + off * ny))
            if 0 <= q[0] < W and 0 <= q[1] < H and m[q[1], q[0]]:
                s.ix[q[1], q[0]] = pal.shift_index(int(s.ix[q[1], q[0]]), -2)
    end = m & (t > L - 3)
    s.ix[end] = ix('d5')
    _outline(s)
    return s
