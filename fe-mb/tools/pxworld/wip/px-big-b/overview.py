"""The region window's overview of the big country: the whole of it, north up, at about 1:31, as 1x pixel art in
the Filigree kit's seven ramps only (Ink, Walnut, Ochre, Moss, Slate, Oxblood, Bone). A copy of
dirs/px-open-b/overview.py, generalised to the big frame and given the view frame.

    cv, marks = overview(w, h, view=(x0, y0, 1280, 720))
        marks['camp'] (the company's pin), marks['throne'], marks['labels'] = {region: (x, y)},
        marks['view'] = (x0, y0, x1, y1) of the brass frame in overview px, marks['T'] = world -> overview

Every pixel takes the region of the nearest place, the heartland's rectangle is the Borderlands; region borders
are a 1 px line in the darker region's darkest tone. Thornwood is stippled with tiny pines in clumps, Ashfall
with burnt ridge strokes, the Borderlands with field squares; the river and the brook run through; every road is
a 1 px track; the Iron Throne is a small black keep with an oxblood banner; a small N marks north.
"""
import math
import os
import random
import sys
import zlib

import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
while not os.path.isdir(os.path.join(DIRS, 'pxworld')):
    DIRS = os.path.dirname(DIRS)
for _p in (HERE, DIRS):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import land as LD                                      # noqa: E402
from pxworld.canvas import Canvas                      # noqa: E402
from pxworld.pal import ix                             # noqa: E402

FILL = {'borderlands': ('m3', 'm4', 'm2'), 'thornwood': ('m1', 'm2', 'm0'), 'ashfall': ('b0', 'b1', 'w3')}
REG_ID = {'borderlands': 0, 'thornwood': 1, 'ashfall': 2}


def frame_of(w, h):
    xs = [p[0] for p in LD.P.values()]
    ys = [p[1] for p in LD.P.values()]
    x0, x1 = min(xs) - 60, max(xs) + 60
    y0, y1 = min(ys) - 60, max(ys) + 60
    s = max((x1 - x0) / w, (y1 - y0) / h)
    return s, (x0 + x1) / 2, (y0 + y1) / 2


def overview(w=156, h=104, view=(640, 360, 1280, 720)):
    s, cx, cy = frame_of(w, h)
    T = lambda p: ((p[0] - cx) / s + w / 2, (p[1] - cy) / s + h / 2)
    cv = Canvas(w, h)
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    best = np.full((h, w), 1e9)
    reg = np.zeros((h, w), np.uint8)
    for k, p in LD.P.items():
        if LD.NODE[k].get('hidden'):
            continue
        X, Y = T(p)
        d = (xx + .5 - X) ** 2 + (yy + .5 - Y) ** 2
        m = d < best
        best[m] = d[m]
        reg[m] = REG_ID[LD.NODE[k]['region']]
    hx0, hy0 = T((0, 0))
    hx1, hy1 = T(LD.HEART_WH)
    reg[(xx >= hx0) & (xx < hx1) & (yy >= hy0) & (yy < hy1)] = 0
    for _ in range(2):
        cnt = np.stack([ndimage.uniform_filter((reg == r).astype(float), 5) for r in range(3)])
        reg = cnt.argmax(0).astype(np.uint8)
    reg[(xx >= hx0) & (xx < hx1) & (yy >= hy0) & (yy < hy1)] = 0
    names = {v: k for k, v in REG_ID.items()}
    for r in range(3):
        base, lit, dark = FILL[names[r]]
        cv.ix[reg == r] = ix(base)
    for r in range(3):
        base, lit, dark = FILL[names[r]]
        m = reg == r
        lip_nw = m & ~np.roll(m, 1, 0) | m & ~np.roll(m, 1, 1)
        cv.ix[lip_nw & m] = ix(lit)
    PINE = [(1, 0, 'm3'), (0, 1, 'm3'), (1, 1, 'm2'), (2, 1, 'm0'), (1, 2, 'm0')]
    RIDGE = [(0, 2, 'b3'), (1, 1, 'b3'), (2, 0, 'b2'), (1, 2, 'w2'), (2, 1, 'w2')]
    rng = random.Random(zlib.crc32(b'overview-big'))
    clumps = [(rng.uniform(0, w), rng.uniform(0, h)) for _ in range(26)]
    taken = np.zeros((h, w), bool)

    def fits(X, Y, r, dx0=-1, dx1=4, dy0=-1, dy1=3):
        return (all(0 <= X + dx < w and 0 <= Y + dy < h and reg[Y + dy, X + dx] == r for dx in (dx0, dx1) for dy in (dy0, dy1))
                and not taken[max(0, Y - 1):Y + 4, max(0, X - 1):X + 4].any())
    for _ in range(3200):
        X, Y = rng.randrange(1, w - 4), rng.randrange(1, h - 4)
        r = reg[Y, X]
        if r == 1:
            if min(math.hypot(X - cx_, (Y - cy_) * 1.3) for cx_, cy_ in clumps) > 9 or not fits(X, Y, 1):
                continue
            for (dx, dy, k) in PINE:
                cv.put(X + dx, Y + dy, k)
            taken[Y:Y + 3, X:X + 3] = True
        elif r == 2 and rng.random() < .25 and fits(X, Y, 2, -2, 5, -2, 4):
            for (dx, dy, k) in RIDGE:
                cv.put(X + dx, Y + dy, k)
            taken[Y - 1:Y + 5, X - 2:X + 6] = True
    # field squares in the Borderlands
    for _ in range(60):
        X, Y = int(rng.uniform(hx0 + 3, hx1 - 4)), int(rng.uniform(hy0 + 3, hy1 - 4))
        if reg[Y, X] == 0 and not taken[Y - 1:Y + 3, X - 1:X + 3].any() and rng.random() < .5:
            lit, dk = (('o4', 'o3') if rng.random() < .5 else ('m5', 'm4'))
            cv.put(X, Y, lit); cv.put(X + 1, Y, lit); cv.put(X, Y + 1, dk); cv.put(X + 1, Y + 1, dk)
            taken[Y - 1:Y + 3, X - 1:X + 3] = True
    border = (reg != np.roll(reg, 1, 0)) | (reg != np.roll(reg, 1, 1))
    border[0, :] = False
    border[:, 0] = False
    for j, i in zip(*np.nonzero(border)):
        pair = {int(reg[j, i]), int(reg[j - 1, i]), int(reg[j, i - 1])}
        cv.ix[j, i] = ix('m0' if 1 in pair else 'w2')
    for a, b, *_ in LD.roads():
        if LD.NODE[a].get('hidden') or LD.NODE[b].get('hidden'):
            continue
        (x0, y0), (x1, y1) = T(LD.P[a]), T(LD.P[b])
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for t in range(n + 1):
            X = int(round(x0 + (x1 - x0) * t / n)); Y = int(round(y0 + (y1 - y0) * t / n))
            if 0 <= X < w and 0 <= Y < h:
                cv.put(X, Y, 'w5' if reg[Y, X] == 0 else ('w4' if reg[Y, X] == 2 else 'w3'))
    for course in (LD.RIVER_FAR, LD.BROOK_FAR):
        for (x, y) in LD.spline(course, 60):
            X, Y = T((x, y))
            X, Y = int(X), int(Y)
            if 0 <= X < w - 1 and 0 <= Y < h:
                cv.put(X, Y, 's3')
                if course is LD.RIVER_FAR:
                    cv.put(X + 1, Y, 's2')
    for k, p in LD.P.items():
        if LD.NODE[k].get('hidden') or k in ('frontier_camp', 'the_iron_throne'):
            continue
        X, Y = T(p)
        X, Y = int(X), int(Y)
        if 0 <= X < w and 0 <= Y < h:
            cv.put(X, Y, 'w1')
    KEEP = ["...x..", "...xx.", "...x..", "k.k.k.", "kkkkk.", "k1k1k.", "k111k.", "k1k1k.", "kkkkk."]
    km = {'k': 'k0', '1': 'k1', 'x': 'x3'}
    tx, ty = T(LD.P['the_iron_throne'])
    tx, ty = int(tx), int(ty)
    for j, row in enumerate(KEEP):
        for i, ch in enumerate(row):
            if ch != '.':
                cv.put(tx - 2 + i, ty - 8 + j, km[ch])
    # the view frame: the part of the country on the screen, a 1 px brass line with a dark keyline outside it
    vx0, vy0 = T((view[0], view[1]))
    vx1, vy1 = T((view[0] + view[2], view[1] + view[3]))
    vx0, vy0, vx1, vy1 = int(round(vx0)), int(round(vy0)), int(round(vx1)), int(round(vy1))
    for X in range(vx0 - 1, vx1 + 2):
        for Y in (vy0 - 1, vy1 + 1):
            cv.put(X, Y, 'k0')
    for Y in range(vy0 - 1, vy1 + 2):
        for X in (vx0 - 1, vx1 + 1):
            cv.put(X, Y, 'k0')
    for X in range(vx0, vx1 + 1):
        cv.put(X, vy0, 'o5'); cv.put(X, vy1, 'o3')
    for Y in range(vy0, vy1 + 1):
        cv.put(vx0, Y, 'o5'); cv.put(vx1, Y, 'o3')
    NM = ["k...k", "kk..k", "k.k.k", "k..kk", "k...k", ".....", "..k..", ".kkk."]
    for j, row in enumerate(NM):
        for i, ch in enumerate(row):
            if ch == 'k':
                for (dx, dy) in ((1, 0), (0, 1), (1, 1)):
                    if cv.get(w - 9 + i + dx, 3 + j + dy) not in (ix('b5'),):
                        cv.put(w - 9 + i + dx, 3 + j + dy, 'k0')
    for j, row in enumerate(NM):
        for i, ch in enumerate(row):
            if ch == 'k':
                cv.put(w - 9 + i, 3 + j, 'b5')
    cxm, cym = T(LD.CAMP)
    marks = {'camp': (cxm, cym), 'throne': (tx, ty), 'scale': s, 'view': (vx0, vy0, vx1, vy1), 'T': T,
             'labels': {'Thornwood': T((1500, -640)), 'Ashfall': T((-900, 760)), 'Iron Throne': T(LD.P['the_iron_throne']),
                        'Borderlands': T((1280, 1260))}}
    return cv, marks


if __name__ == '__main__':
    cv, marks = overview()
    cv.save(os.path.join(HERE, 't', 'overview.png'), zoom=4)
    print({k: v for k, v in marks.items() if k != 'T'})
