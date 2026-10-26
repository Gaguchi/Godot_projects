"""The region window's overview: the whole country, north up, at about 1:17, as 1x pixel art in the Filigree kit's
seven ramps only (Ink, Walnut, Ochre, Moss, Slate, Oxblood, Bone).

    cv, marks = overview(w, h)    -> pxworld Canvas, and stage-free marks in overview px:
                                     marks['camp'] (the company's pin goes here), marks['throne'],
                                     marks['labels'] = {region: (x, y)} centres for the HTML labels

Every pixel takes the region of the nearest place (so each region is the land its places hold), the Borderlands
also hold the whole of the main view; region borders are a 1 px line one step down the darker region's ramp.
Thornwood is stippled with tiny pines in clumps, Ashfall with burnt ridge strokes, the Borderlands with the main
view's own field squares; a small N marks north. marks['labels'] also holds 'Borderlands' (under the pin).
The river runs north to south through the Borderlands' east, every road is a 1 px track, the Iron Throne is a
small black keep with an oxblood banner."""
import math
import os
import random
import sys
import zlib

import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(os.path.abspath(__file__))
while not os.path.isdir(os.path.join(DIRS, 'pxworld')):      # the scratchpad's dirs/ folder
    DIRS = os.path.dirname(DIRS)
for _p in (HERE, DIRS):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import world_b as WB                                   # noqa: E402
from pxworld.canvas import Canvas                      # noqa: E402
from pxworld.pal import ix                             # noqa: E402

FILL = {'borderlands': ('m3', 'm4', 'm2'), 'thornwood': ('m1', 'm2', 'm0'), 'ashfall': ('b0', 'b1', 'w3')}
REG_ID = {'borderlands': 0, 'thornwood': 1, 'ashfall': 2}


def frame_of(w, h, pad=0):
    xs = [p[0] for p in WB.P.values()] + [0, 1280]
    ys = [p[1] for p in WB.P.values()] + [0, 720]
    x0, x1 = min(xs) - 120, max(xs) + 120
    y0, y1 = min(ys) - 120, max(ys) + 120
    s = max((x1 - x0) / w, (y1 - y0) / h)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return s, cx, cy


def overview(w=160, h=108):
    s, cx, cy = frame_of(w, h)
    T = lambda p: ((p[0] - cx) / s + w / 2, (p[1] - cy) / s + h / 2)
    cv = Canvas(w, h)
    # regions: nearest place, the main view forced to the Borderlands
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    best = np.full((h, w), 1e9)
    reg = np.zeros((h, w), np.uint8)
    for k, p in WB.P.items():
        if WB.NODE[k].get('hidden'):
            continue
        X, Y = T(p)
        d = (xx + .5 - X) ** 2 + (yy + .5 - Y) ** 2
        m = d < best
        best[m] = d[m]
        reg[m] = REG_ID[WB.NODE[k]['region']]
    # smooth the borders into ground-like curves
    for _ in range(2):
        cnt = np.stack([ndimage.uniform_filter((reg == r).astype(float), 5) for r in range(3)])
        reg = cnt.argmax(0).astype(np.uint8)
    names = {v: k for k, v in REG_ID.items()}
    for r in range(3):
        base, lit, dark = FILL[names[r]]
        cv.ix[reg == r] = ix(base)
    # the light: the north-west lip of every region a tone lighter, the south-east lip darker (a low relief)
    for r in range(3):
        base, lit, dark = FILL[names[r]]
        m = reg == r
        lip_nw = m & ~np.roll(m, 1, 0) | m & ~np.roll(m, 1, 1)
        cv.ix[lip_nw & m] = ix(lit)
    # texture, placed like a map's symbols: pines in Thornwood in clumps with clearings between them, burnt
    # ridges in Ashfall as short diagonal strokes lit on their north-west side
    PINE = [(1, 0, 'm3'), (0, 1, 'm3'), (1, 1, 'm2'), (2, 1, 'm0'), (1, 2, 'm0')]
    RIDGE = [(0, 2, 'b3'), (1, 1, 'b3'), (2, 0, 'b2'), (1, 2, 'w2'), (2, 1, 'w2')]
    rng = random.Random(zlib.crc32(b'overview'))
    clumps = [(rng.uniform(0, w), rng.uniform(0, h)) for _ in range(22)]
    taken = np.zeros((h, w), bool)

    def fits(X, Y, r, dx0=-1, dx1=4, dy0=-1, dy1=3):
        return (all(0 <= X + dx < w and 0 <= Y + dy < h and reg[Y + dy, X + dx] == r for dx in (dx0, dx1) for dy in (dy0, dy1))
                and not taken[max(0, Y - 1):Y + 4, max(0, X - 1):X + 4].any())
    for _ in range(2600):
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
    # field squares in the Borderlands: the main view's own fields, 2 x 2 in ochre (wheat) and moss (crops)
    for pts, kind in WB.FIELDS:
        px = sum(p[0] for p in pts) / len(pts)
        py = sum(p[1] for p in pts) / len(pts)
        X, Y = T((px, py))
        X, Y = int(X), int(Y)
        if 0 <= X < w - 1 and 0 <= Y < h - 1 and reg[Y, X] == 0:
            lit, dk = (('o4', 'o3') if 'wheat' in kind else (('w4', 'w3') if kind == 'plough' else ('m5', 'm4')))
            cv.put(X, Y, lit); cv.put(X + 1, Y, lit); cv.put(X, Y + 1, dk); cv.put(X + 1, Y + 1, dk)
    # region borders: a 1 px line in the darker region's darkest tone
    border = (reg != np.roll(reg, 1, 0)) | (reg != np.roll(reg, 1, 1))
    border[0, :] = False
    border[:, 0] = False
    for j, i in zip(*np.nonzero(border)):
        pair = {int(reg[j, i]), int(reg[j - 1, i]), int(reg[j, i - 1])}
        cv.ix[j, i] = ix('m0' if 1 in pair else 'w2')
    # roads: every visible road as a 1 px track
    for a, b, *_ in WB.b_roads():
        if WB.NODE[a].get('hidden') or WB.NODE[b].get('hidden'):
            continue
        (x0, y0), (x1, y1) = T(WB.P[a]), T(WB.P[b])
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for t in range(n + 1):
            X = int(round(x0 + (x1 - x0) * t / n)); Y = int(round(y0 + (y1 - y0) * t / n))
            if 0 <= X < w and 0 <= Y < h:
                cv.put(X, Y, 'w5' if reg[Y, X] == 0 else ('w4' if reg[Y, X] == 2 else 'w3'))
    # the river: the map's own course, carried on north and south past the view
    rpts = [(925, -420), (930, -200)] + list(WB.RIVER) + [(1070, 900), (1110, 1300)]
    from geo import sample_catmull
    for (x, y) in sample_catmull(rpts, 80):
        X, Y = T((x, y))
        X, Y = int(X), int(Y)
        if 0 <= X < w - 1 and 0 <= Y < h:
            cv.put(X, Y, 's3'); cv.put(X + 1, Y, 's2')
    # places as dots: towns bone, the rest walnut
    for k, p in WB.P.items():
        if WB.NODE[k].get('hidden') or k in ('frontier_camp', 'the_iron_throne'):
            continue
        X, Y = T(p)
        X, Y = int(X), int(Y)
        if 0 <= X < w and 0 <= Y < h:
            cv.put(X, Y, 'w1')
    # the Iron Throne: a small black keep with an oxblood banner
    KEEP = ["...x..", "...xx.", "...x..", "k.k.k.", "kkkkk.", "k1k1k.", "k111k.", "k1k1k.", "kkkkk."]
    km = {'k': 'k0', '1': 'k1', 'x': 'x3'}
    tx, ty = T(WB.P['the_iron_throne'])
    tx, ty = int(tx), int(ty)
    for j, row in enumerate(KEEP):
        for i, ch in enumerate(row):
            if ch != '.':
                cv.put(tx - 2 + i, ty - 8 + j, km[ch])
    # north: a small N over an up-tick in the top-right corner
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
    cxm, cym = T(WB.P['frontier_camp'])
    marks = {'camp': (cxm, cym), 'throne': (tx, ty), 'scale': s,
             'labels': {'Thornwood': T((270, -330)), 'Ashfall': T((-345, 220)), 'Iron Throne': T((-560, 1210)),
                        'Borderlands': (cxm - 4, cym + 11)}}
    return cv, marks


if __name__ == '__main__':
    cv, marks = overview()
    cv.save(os.path.join(HERE, 't', 'overview.png'), zoom=4)
    print(marks)
