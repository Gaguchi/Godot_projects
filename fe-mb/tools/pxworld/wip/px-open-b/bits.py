"""New grain-1 pieces for the open map, drawn the pxworld way (selout in each part's own darks, lit from the
upper left, hard cast shadows), on top of pxworld's primitives. Nothing here edits pxworld.

  stake_arc_gaps(rx, ry, h, front, gaps)   half a palisade ring with several gates, a taller post either side
  camp4(sc, x, y, gaps)                    Frontier Camp with a gate on every road out
  shrine()                                 Borderland Shrine: a weathered saint on a coursed plinth, coppers in a
                                           bowl and dried flowers at her feet
  watchtower(sc, x, y, gaps)               Watchtower Ridge with a gate on every road in
  broken_bridge(sc, x, y)                  Broken Bridge on its piers, the fallen span as drowned chunks
  ember(cv, x, y)                          a coal alight in the ash
  edge_sign(bw, bh, ph, tip)               a finger-board pointing 'e' or 'w' (or a plain board) on a squared post
  snag(h, seed) / stump(seed)              a fire-killed tree, a burnt stump (Ashfall)
"""
import math
import os
import random
import sys

import numpy as np

DIRS = os.path.dirname(os.path.abspath(__file__))
while not os.path.isdir(os.path.join(DIRS, 'pxworld')):      # the scratchpad's dirs/ folder
    DIRS = os.path.dirname(DIRS)
if DIRS not in sys.path:
    sys.path.insert(0, DIRS)
from pxworld import pal, props as PR, build as BD                 # noqa: E402
from pxworld.canvas import Sprite, ellipse                         # noqa: E402

_put, _get, selout = BD._put, BD._get, BD.selout
GROUND = ('g', 'd', 'h')


# ---------------------------------------------------------------- Frontier Camp, gated every way
def _in_gap(a, gaps):
    return any(abs(((a - g0 + math.pi) % (2 * math.pi)) - math.pi) < hw for g0, hw in gaps)


def stake_arc_gaps(rx, ry, h, front, gaps=()):
    """BD.stake_arc with a list of gates (angle, half-width in radians). The stake either side of each gate
    stands two pixels taller: the gatepost."""
    W, H = int(2 * rx) + 8, int(2 * ry) + h + 10
    S = Sprite(W, H, W // 2, int(ry) + h + 5)
    cx, cy = W // 2, int(ry) + h + 5
    cols = {}
    n = int(8 * (rx + ry))
    for i in range(n):
        a = 2 * math.pi * i / n
        if _in_gap(a, gaps):
            continue
        if (math.sin(a) >= 0) != front:
            continue
        x = int(round(cx + math.cos(a) * rx))
        y = int(round(cy + math.sin(a) * ry))
        post = _in_gap(a - 2 * math.pi / n * 3, gaps) or _in_gap(a + 2 * math.pi / n * 3, gaps)
        if x not in cols or (front and y > cols[x][0]) or (not front and y < cols[x][0]):
            cols[x] = (y, math.cos(a), post or (x in cols and cols[x][2]))
    for x, (yb, east, post) in sorted(cols.items()):
        c = x % 3
        shade = 1 if east > .5 else 0
        body = (['d5', 'd4', 'd3'] if not shade else ['d4', 'd3', 'd2'])[c]
        top = yb - h + (0 if c == 1 else 1) - (2 if post else 0)
        for y in range(top, yb + 1):
            k = body
            if y == yb:
                k = 'd2'
            elif y == top:
                k = 'd6' if c == 1 and not shade else ('d5' if c == 1 else body)
            _put(S, x, y, k)
    selout(S)
    return S


def gate_angles(centre, rx, ry, paths, hw=.3):
    """The angle (ellipse parameter) at which each road polyline leaves the ring round centre."""
    out = []
    cx, cy = centre
    for pts in paths:
        for (x, y) in pts:
            u, v = (x - cx) / rx, (y - cy) / ry
            if u * u + v * v >= 1.0:
                out.append((math.atan2(v, u) % (2 * math.pi), hw))
                break
    return out


def camp4(sc, x, y, gaps):
    """Frontier Camp: the stake ring with a gate on every road out, three tents round a trodden yard where
    the roads meet, the cookfire on the south-east side. The company is drawn by the map (world_b.render)."""
    rx, ry = 40, 25
    back = stake_arc_gaps(rx, ry, 8, False, gaps)
    front = stake_arc_gaps(rx, ry, 8, True, gaps)
    sc.add(back, x, y + 3, z=-ry - 1)
    sc.add(front, x, y + 3, z=ry + 1)
    sc.cv.shift(ellipse(x + 2, y + 5, rx + 2, ry + 1.5), -1, GROUND, where=lambda a: ~np.isin(a, pal.RAMP['d']))
    sc.add(BD.R(sc, PR.ridge_tent(22, 13, 'canvas')), x - 21, y - 6, shadow='house')
    sc.add(BD.R(sc, PR.ridge_tent(18, 11, 'canvas')), x + 19, y - 9, shadow='house')
    sc.add(BD.R(sc, PR.ridge_tent(16, 10, 'tan')), x - 25, y + 14, shadow='house')
    f = BD.R(sc, PR.fire(1))
    fx, fy = x + 22, y + 13
    sc.add(f, fx, fy)
    sc.later(lambda cv: PR.smoke(cv, int(fx), int(fy - f.h), 1))
    sc.add(BD.woodpile(), x + 31, y + 7, shadow='house')


# ---------------------------------------------------------------- Borderland Shrine
# a wayside shrine. 6..1 = the Stone ramp light..dark (the saint and her plinth); m/M = moss; o/O = the coppers in
# their bowl; f/F = dried flowers. Lit from the upper left: her head, left shoulder and the robe's left fall catch
# the light, the right side of the robe steps down into shade; the plinth is wider than she is
SHRINE = [
    "......565......",
    ".....56654.....",
    ".....65543.....",
    "......442......",
    "....5665433....",
    "...566554433...",
    "...665.54.33...",
    "...665544332...",
    "....65544332...",
    "....65544332...",
    "...6655443322..",
    "..666554443332.",
    "..6665544433322",
    ".22222222222221",
    ".66666655554443",
    ".54445444544332",
    ".32223222322221",
    ".mM5444544433Mm",
    "OoO.........fF.",
]
SHRINE_KM = {'6': 't6', '5': 't5', '4': 't4', '3': 't3', '2': 't2', '1': 't1', 'm': 'm3', 'M': 'm2',
             'o': 'o4', 'O': 'o2', 'f': 'h3', 'F': 'x4'}


def shrine():
    """Borderland Shrine, a roadside shrine: a coursed stone pillar under a gabled cap, the worn saint standing in
    its dark niche, moss at the foot, a bowl of coppers and dried flowers on the step. About the height of a person
    at map scale. Foot = the step's middle."""
    S = Sprite(len(SHRINE[0]) + 2, len(SHRINE) + 2)
    for j, row in enumerate(SHRINE):
        for i, ch in enumerate(row):
            if ch != '.':
                _put(S, 1 + i, 1 + j, SHRINE_KM[ch])
    selout(S)
    S.ax, S.ay = 8, len(SHRINE)
    return S.trimmed()


# ---------------------------------------------------------------- the edge signs
def edge_sign(bw=110, bh=23, ph=44, tip='e', post=None):
    """BD.board_sign with its point on either end (or none): three planks with grain and knots, a lit top
    edge, on a squared post lit on its west face. The map writes the name on the board. Foot = the post's base
    (post = its x inside the board; a plain board stands on two posts, the other at 6 or bw - 8)."""
    S = Sprite(bw + 8, ph + 6)
    ox = 1
    px = (6 if tip != 'w' else bw - 8) if post is None else post
    posts = [px] if tip else sorted({px, 6 if px > 12 else bw - 8})
    for p_ in posts:
        for j in range(ph):
            _put(S, ox + p_ - 1, 2 + j, 'w5'); _put(S, ox + p_, 2 + j, 'w4'); _put(S, ox + p_ + 1, 2 + j, 'w2')
    tl = 10
    rng = random.Random(3)
    knots = [(rng.randint(16, bw - 20), rng.randint(2, bh - 3)) for _ in range(5)]
    seams = (bh // 3, 2 * bh // 3)
    mid = (bh - 1) / 2
    for j in range(bh):
        for i in range(bw):
            if tip == 'e' and i > bw - 1 - tl and abs(j - mid) > (bw - 1 - i) * (bh / 2) / tl:
                continue
            if tip == 'w' and i < tl and abs(j - mid) > i * (bh / 2) / tl:
                continue
            k = 'w4'
            plank = 0 if j < seams[0] else (1 if j < seams[1] else 2)
            if j == 0:
                k = 'w6'
            elif j in seams:
                k = 'w2'
            elif j - 1 in seams or j == 1:
                k = 'w5'
            elif j + 1 in seams or j == bh - 1:
                k = 'w3'
            elif (i * 3 + j * 11 + plank * 7) % 23 == 0:
                k = 'w3'
            if (j % 7 == 3) and (i + plank * 13) % 17 < 6 and k == 'w4':
                k = 'w3'
            _put(S, ox + i, 1 + j, k)
    for (kx, ky) in knots:
        if ky not in seams and ky - 1 not in seams:
            _put(S, ox + kx, 1 + ky, 'w2'); _put(S, ox + kx + 1, 1 + ky, 'w3'); _put(S, ox + kx, ky, 'w5')
    for p_ in posts:
        for ny in (seams[0] // 2 + 1, bh - 3):
            _put(S, ox + p_, 1 + ny, 't5')                 # the nail heads
    selout(S)
    S.ax, S.ay = ox + px, ph + 1
    S.board = (ox, 1, bw, bh)                              # the board's box inside the sprite, for the text
    return S


# ---------------------------------------------------------------- Ashfall: what the fire left
def snag(h=14, seed=0, lean=0):
    """A fire-killed tree: a charred trunk (lit edge, shaded edge), a split top, two or three bare limbs
    reaching out and up. Selout in the wood's own darks. Foot = the trunk's base."""
    rng = random.Random(seed)
    W = 15
    S = Sprite(W, h + 3)
    cx = W // 2
    top = 2
    for y in range(top, h + 2):
        t = (y - top) / max(1, h - 1)
        x = cx + int(round(lean * (1 - t)))
        thick = 2 if t > .25 else 1
        _put(S, x, y, 'w3' if thick == 2 else 'w2')
        if thick == 2:
            _put(S, x + 1, y, 'w1')
        if y == h + 1:
            _put(S, x - 1, y, 'w2'); _put(S, x + 2, y, 'w1')      # the flare of the roots
    # the split, burnt-off top
    _put(S, cx - 1, top - 1, 'w2'); _put(S, cx + 1, top, 'k1')
    limbs = rng.sample([(-1, .35), (1, .45), (-1, .6), (1, .25)], 3 if h >= 12 else 2)
    for side, at in limbs:
        y0 = top + int(at * h)
        x0 = cx + int(round(lean * (1 - at))) + (0 if side < 0 else 1)
        L = rng.randint(3, 5)
        for k in range(1, L + 1):
            _put(S, x0 + side * k, y0 - (k + 1) // 2, 'w3' if side < 0 else 'w2')
        _put(S, x0 + side * L, y0 - (L + 1) // 2 - 1, 'w2')        # a twig turned up at the end
    selout(S, remap={'w': ('w1', 'w0'), 'k': ('k1', 'k0')})
    S.ax, S.ay = cx, h + 1
    S.cy = S.h // 2
    return S.trimmed()


def stump(seed=0):
    """A burnt stump: a lit ring of the cut on top, char down the side."""
    rows = [".545.", "54335", "32221", ".211."]
    km = {'5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2', '1': 'w1'}
    S = Sprite(8, 7)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                _put(S, 1 + i, 1 + j, km[ch])
    if seed % 2:
        _put(S, 2, 3, 'k1')
    selout(S)
    S.ax, S.ay = 3, 4
    return S.trimmed()


def charred(s):
    """The same sprite burnt: every wood and earth tone two steps down its own ramp (a fire-blackened log)."""
    from pxworld.canvas import lut
    out = Sprite(s.w, s.h, s.ax, s.ay)
    out.ix = lut(-2)[s.ix]
    return out


# ---------------------------------------------------------------- Watchtower Ridge, gated on every road
def watchtower(sc, x, y, gaps):
    """pxworld.places.watchtower with a gate in the stake ring wherever a road comes in (gaps from gate_angles
    round (x, y + 5), rx 26, ry 15)."""
    back = stake_arc_gaps(26, 15, 8, False, gaps)
    front = stake_arc_gaps(26, 15, 8, True, gaps)
    sc.add(back, x, y + 5, z=-16)
    sc.add(front, x, y + 5, z=16)
    sc.cv.shift(ellipse(x + 2, y + 7, 28, 16.5), -1, GROUND, where=lambda a: ~np.isin(a, pal.RAMP['d']))
    t = BD.stone_tower(14, 28, seed=2)
    tx, ty = x - 3, y + 3
    sc.add(t, tx, ty, shadow='house')
    fl = BD.R(sc, PR.flag(1, ('m3', 'b4'), h=12))
    sc.add(fl, tx - 1, ty - t.h + 3, z=t.h + 1)
    sc.add(BD.cottage(9, 'ns', 'shingle', 'boards', d=6, h=5, seed=3), x + 15, y + 10, shadow='house')
    sc.add(BD.woodpile(), x + 6, y + 13, shadow='house')


# ---------------------------------------------------------------- Broken Bridge, on its piers
def broken_bridge(sc, x, y):
    """Broken Bridge: pxworld's stone bridge across the flow on the road's axis (rising 1 px in 3 to the east),
    its middle span fallen. Each stump ends over a coursed stone pier standing in the water (a wet foot, foam
    where the current breaks on it); the fallen span lies as three irregular chunks of different sizes just
    downstream of the gap and off the deck line, half under the water, the middle of the gap left as open water.
    x is the river's centre at row y. Same frame as pxworld.places.broken_bridge."""
    ox = 0 if abs(x - 956) < 4 else int(round(x - 956))
    oy = int(round(y - 580))
    cv = sc.cv
    water = getattr(sc, 'water', None)
    L = 52
    b0, b1 = 22, 33                                       # the fallen span's columns
    br = BD.stone_bridge(L, 3, deck=4, face=6, arches=[(9, 17, 3), (38, 46, 3)], abut=(8, 6),
                         broken=(b0 + 3, b1 - 2), seed=4)
    bx, by = 927 + ox, 581 + oy

    def yc(c):                                            # the south coping row of column c
        return by - c // 3
    if water is not None:
        for c in range(L):
            if b0 - 1 <= c < b1 + 1:
                continue
            yw = by + 7 - c // 3
            for j in range(2):
                X, Y = bx + c + 1, yw + j
                if 0 <= Y < cv.h and 0 <= X < cv.w and water[Y, X]:
                    cv.ix[Y, X] = pal.shift_index(cv.get(X, Y), -1)
    sc.add(br, bx, by, z=-3)
    piers = [(17, 22), (b1 - 1, b1 + 4)]

    def wet(X, Y):
        return water is None or (0 <= Y < cv.h and 0 <= X < cv.w and water[Y, X])

    def pier(cv):
        for (c0, c1) in piers:
            for c in range(c0, c1):
                X = bx + 1 + c
                top = yc(c) + 3
                for yy in range(top, yc(c) + 10):
                    f = yy - top
                    if yy >= yc(c) + 8:
                        k = 't2' if (c + f) % 2 else 't1'                 # the wet foot
                    elif f % 2 == 1:
                        k = 't2'                                          # mortar course
                    else:
                        u = (c + (f // 2) * 2) % 4
                        k = 't2' if u == 0 else ('t4' if u == 1 else 't3')
                    if c == c0:
                        k = 't5' if yy < yc(c) + 8 else 't3'              # the pier's lit west arris
                    elif c == c1 - 1:
                        k = 't1'
                    cv.put(X, yy, k)
                for dy in (10,):                                          # foam where the current breaks
                    if wet(X, yc(c) + dy):
                        cv.put(X, yc(c) + dy, 'a7' if c % 3 else 'a6')
            for (dx, dy) in ((-1, 9), (c1 - c0, 9), (-2, 11), (c1 - c0 + 1, 11)):
                X, Y = bx + 1 + c0 + dx, yc(c0) + dy
                if wet(X, Y):
                    cv.put(X, Y, 'a6')
    # the fallen span: three chunks of different sizes, half drowned, downstream of the gap, off the deck line
    chunks = [(bx + 1 + b0 + 2, yc(b0) + 13, ['.5554.', '544433', '433222']),
              (bx + 1 + b1 - 4, yc(b1 - 4) + 11, ['.65.', '5432']),
              (bx + 1 + b0 + 6, yc(b0 + 6) + 17, ['.54', '432'])]

    def rubble(cv):
        for (X0, Y0, rows) in chunks:
            h_, w_ = len(rows), len(rows[0])
            for j, row in enumerate(rows):
                for i, ch in enumerate(row):
                    if ch != '.':
                        cv.put(X0 + i, Y0 + j, 't' + ch)
            # selout in the stone's own darkest step round the part above the water
            for j, row in enumerate(rows):
                for i, ch in enumerate(row):
                    if ch == '.':
                        continue
                    for (dx, dy) in ((-1, 0), (1, 0), (0, -1)):
                        ii, jj = i + dx, j + dy
                        inside = 0 <= ii < w_ and 0 <= jj < h_ and rows[jj][ii] != '.'
                        if not inside and pal.RAMP_OF[cv.get(X0 + ii, Y0 + jj)] == 'a':
                            cv.put(X0 + ii, Y0 + jj, 't1')
            # the water closes over its foot: a foam line where it goes under, a short wake downstream
            for i in range(-1, w_ + 1):
                if wet(X0 + i, Y0 + h_):
                    cv.put(X0 + i, Y0 + h_, 'a7' if i % 2 else 'a6')
            for k_ in (1, 2):
                for XX in (X0 - 1 - k_ // 2, X0 + w_ + k_ // 2):
                    YY = Y0 + h_ + k_
                    if wet(XX, YY):
                        cv.put(XX, YY, 'a5')
    sc.later(pier)
    sc.later(rubble)


def ember(cv, x, y):
    """A coal still alight in the ash: 2 x 2, lit corner, a 1 px charred rim."""
    for (dx, dy) in ((-1, 0), (2, 0), (-1, 1), (2, 1), (0, -1), (1, -1), (0, 2), (1, 2)):
        cv.put(x + dx, y + dy, 'w1')
    cv.put(x, y, 'o5'); cv.put(x + 1, y, 'x4'); cv.put(x, y + 1, 'x4'); cv.put(x + 1, y + 1, 'x3')
