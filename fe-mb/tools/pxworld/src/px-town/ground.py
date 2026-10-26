"""px-town ground: the meadow, the cobbled square and street, the quay flags, the dirt road, the river and its banks.

All in stage px = art px (grain 1). Light from the upper left.
"""
import math
import random

import numpy as np

from pxt import pal, kk, IX, CLEAR, nb, poly, ellipse
from pxworld import terrain as TR


def cobbles(cv, m, seed=3, rows=(5, 5, 6), widths=(7, 8, 8, 9, 10, 11), mortar='d2', warm_share=.08):
    """Cobbles over bool mask m (full canvas): staggered rows of rounded granite setts, each lit along its top and
    dark along its foot and east end; one in a dozen is a warm sandstone sett. Calm enough to sit behind folk."""
    R = random.Random(seed)
    H, W = m.shape
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    sub = cv.ix
    sub[m] = IX(mortar)
    y = y0
    while y < y1:
        rh = R.choice(rows)
        x = x0 - R.randint(0, 9)
        while x < x1:
            w = R.choice(widths)
            ramp, base = 't', 4
            r_ = R.random()
            if r_ < warm_share:
                ramp, base = 'd', 5
            elif r_ < warm_share + .12:
                base = 3
            sh = rh - 1
            for j in range(sh):
                for i in range(w - 1):
                    xx, yy = x + i, y + j
                    if not (0 <= xx < W and 0 <= yy < H) or not m[yy, xx]:
                        continue
                    if (i in (0, w - 2)) and (j in (0, sh - 1)):
                        continue
                    lv = base
                    if j == 0 and i < w - 2:
                        lv = base + 1
                    elif j == sh - 1 or i == w - 2:
                        lv = base - 1
                    sub[yy, xx] = IX(kk(ramp, lv))
            x += w
        y += rh


def loose_setts(cv, m, R, n=40):
    """Where the cobbles give out onto earth: a few setts lying loose past the edge, each with its contact shadow."""
    edge = m & ~nb(m, -1, 0, True)
    ys, xs = np.nonzero(edge)
    for k in R.sample(range(len(xs)), min(n, len(xs))):
        x, y = xs[k] - R.randint(3, 16), ys[k] + R.randint(-2, 2)
        if cv.get(x, y) not in pal.RAMP['d'] or cv.get(x + 5, y + 3) not in pal.RAMP['d']:
            continue
        for (dx, dy, kk_) in ((0, 0, 't5'), (1, 0, 't5'), (2, 0, 't5'), (3, 0, 't4'), (0, 1, 't4'), (1, 1, 't4'),
                              (2, 1, 't4'), (3, 1, 't3'), (0, 2, 't3'), (1, 2, 't3'), (2, 2, 't3'), (3, 2, 't2'),
                              (1, 3, 'd2'), (2, 3, 'd2'), (3, 3, 'd2'), (4, 2, 'd2'), (4, 1, 'd3')):
            cv.put(x + dx, y + dy, kk_)


def flags(cv, m, seed=5, ch=7, bw=(10, 18)):
    """Large quay flagstones: long slabs in courses, lit lip top-left, dark joints."""
    R = random.Random(seed)
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    cv.ix[m] = IX('t2')
    y = y0
    row = 0
    while y < y1:
        x = x0 - (R.randint(4, 9) if row % 2 else R.randint(0, 3))
        while x < x1:
            w = R.randint(*bw)
            base = 4 + R.choice((0, 0, 0, 1, -1))
            for j in range(ch - 1):
                for i in range(w - 1):
                    xx, yy = x + i, y + j
                    if 0 <= xx < cv.w and 0 <= yy < cv.h and m[yy, xx]:
                        lv = base
                        if j == 0 or i == 0:
                            lv = base + 1
                        if j == ch - 2 or i == w - 2:
                            lv = base - 1
                        cv.ix[yy, xx] = IX(kk('t', lv))
            if R.random() < .2:     # a crack across a slab
                cx = x + R.randint(3, max(4, w - 4))
                for j in range(1, ch - 2):
                    if 0 <= cx + (j // 2) < cv.w and 0 <= y + j < cv.h and m[y + j, cx + j // 2]:
                        cv.ix[y + j, cx + j // 2] = IX('t2')
            x += w
        y += ch
        row += 1


def mask_poly(cv, pts):
    a, x0, y0 = poly(pts)
    M = np.zeros((cv.h, cv.w), bool)
    cs, ls = cv._clip(a, x0, y0)
    if cs is not None:
        M[cs] = a[ls]
    return M


def bank_line(y, x0, amp, seed, period=90.0):
    """A gently wandering bank: x as a smooth function of y, rounded to whole pixels."""
    R = random.Random(seed)
    ph = [R.uniform(0, 6.28) for _ in range(3)]
    return x0 + amp * (.6 * math.sin(y / period * 6.28 + ph[0]) + .3 * math.sin(y / (period * .53) * 6.28 + ph[1])
                       + .1 * math.sin(y / (period * .27) * 6.28 + ph[2]))


def river(cv, wx0, ex_fn, y0=0, y1=None, seed=4):
    """Water from the quay edge wx0 (straight) to the east bank ex_fn(y). Returns the water mask.
    Bands: the quay's shadow on the west, the open channel, sunlit shallows toward the east bank."""
    y1 = y1 or cv.h
    W = np.zeros((cv.h, cv.w), bool)
    for y in range(y0, y1):
        ex = int(round(ex_fn(y)))
        for x in range(wx0, ex):
            W[y, x] = True
            d_w = x - wx0
            d_e = ex - 1 - x
            k = 'a3'
            if d_w < 2:
                k = 'a1'
            elif d_w < 7:
                k = 'a2'
            elif d_e < 3:
                k = 'a5'
            elif d_e < 9:
                k = 'a4'
            cv.ix[y, x] = IX(k)
    # the open channel: a slow meander of deeper water, cleaned to smooth edges
    R = random.Random(seed)
    for y in range(y0, y1):
        ex = ex_fn(y)
        mid = wx0 + (ex - wx0) * (.42 + .08 * math.sin(y / 70 + 1.3))
        half = (ex - wx0) * (.12 + .03 * math.sin(y / 40 + .4))
        for x in range(int(mid - half), int(mid + half)):
            if W[y, x] and cv.ix[y, x] == IX('a3'):
                cv.ix[y, x] = IX('a2')
    return W


def ripples(cv, W, x0, x1, y0, y1, R, n=70, avoid=None):
    """Flow streaks along the current (north to south): a light core with darker tails, 4-9 px long."""
    for _ in range(n):
        x = R.randint(x0, x1)
        y = R.randint(y0, y1)
        ln = R.choice((4, 5, 6, 7, 9))
        if avoid is not None and avoid(x, y):
            continue
        ok = all(0 <= y + j < cv.h and W[y + j, x] for j in range(ln))
        if not ok:
            continue
        here = cv.ix[y, x]
        if here not in (IX('a2'), IX('a3'), IX('a4')):
            continue
        hi = {IX('a2'): 'a4', IX('a3'): 'a5', IX('a4'): 'a6'}[here]
        for j in range(ln):
            k = hi if 0 < j < ln - 1 else pal.KEYS[pal.shift_index(here, 1)]
            cv.put(x, y + j, k)
        if ln >= 6 and R.random() < .5 and W[y + 2, x + 1]:
            cv.put(x + 1, y + 2, pal.KEYS[pal.shift_index(here, 1)])
            cv.put(x + 1, y + 3, pal.KEYS[pal.shift_index(here, 1)])


def east_bank(cv, ex_fn, y0, y1):
    """The natural east bank: wet mud at the waterline, a strip of sand, damp grass beyond (in shade-free daylight)."""
    for y in range(y0, y1):
        ex = int(round(ex_fn(y)))
        for i, k in enumerate(('d2', 'd3', 'd5', 'd5', 'd4')):
            cv.put(ex + i, y, k)
        g = cv.get(ex + 5, y)
        if g in pal.RAMP['g']:
            cv.put(ex + 5, y, pal.KEYS[pal.shift_index(g, -1, fine=True)])


def grass_edge_tufts(cv, m, R, n=60, only=('t', 'd')):
    """Grass blades creeping over the edge of a paved mask from the meadow side."""
    edge = m & ~nb(m, 0, -1, True)
    ys, xs = np.nonzero(edge)
    if not len(xs):
        return
    for k in R.sample(range(len(xs)), min(n, len(xs))):
        x, y = xs[k], ys[k]
        for (dx, dy, kk_) in ((0, 0, 'g4'), (1, 0, 'g3'), (0, 1, 'g3'), (2, 0, 'g4'), (-1, 0, 'g6')):
            if R.random() < .7 and m[min(y + dy, m.shape[0] - 1), min(max(x + dx, 0), m.shape[1] - 1)]:
                cv.put(x + dx, y + dy, kk_)
