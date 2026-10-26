"""The title's stone bridge: a humpbacked two-arch bridge square across the river, drawn from its own geometry.

The river flows toward the viewer, so the bridge runs left to right and we see its near (downstream) face broadside:
the parapet rising over the hump, the string course at deck level, coursed spandrels, two segmental arches with a
ring of voussoirs, the pier between them with its pointed cutwater standing out into the flow, an abutment on each
bank. Above the near parapet shows a sliver of the far parapet's inner face; at the west head, where the near
parapet ends, the deck and the road come into view. Through each arch you see the shaded water under the bridge, the
pier's inner wall, and over them the sunlit river beyond. Its reflection lies broken on the water in front.

Everything is computed per stage pixel through persp's camera, so the bridge is in true perspective at its depth,
and every block, joint and course is sized in metres. Light from the upper left: copings and the string course's top
lit, the face in the middle tones, west faces lit, east faces and undersides dark. Stone ramp only, outlined t1/t2.
"""
import math
import random

import numpy as np

import cpx
import persp as P
import title_plan as TP
from cpx import pal, ix, CLEAR, nb
from pxworld.canvas import Sprite

WL = -0.15                    # the water level, metres (the banks are low here)
HUMP_END, HUMP_TOP = 0.18, 2.35
PARA = 0.78                   # parapet height above the deck
COPE = 0.14                   # the coping's thickness
ARCHES = [(6.75, 10.35), (11.55, 15.15)]     # springing points (X)
SPRING = WL + .25
RISE = 1.45
PIER = (10.35, 11.55)
RING = .42                    # voussoir depth


def deck_h(X):
    """The deck's height along the bridge: a hump, flat ends."""
    m = (TP.BX0 + TP.BX1) / 2
    half = (TP.BX1 - TP.BX0) / 2
    u = np.clip((np.asarray(X, float) - m) / half, -1, 1)
    return HUMP_END + (HUMP_TOP - HUMP_END) * (1 - u * u) ** .9


def arch_top(X):
    """Height of the arch soffit at X (or -inf outside an arch): segmental arches."""
    X = np.asarray(X, float)
    out = np.full(X.shape, -np.inf)
    for (a0, a1) in ARCHES:
        half = (a1 - a0) / 2
        mid = a0 + half
        R = (half * half + RISE * RISE) / (2 * RISE)
        dx = np.abs(X - mid)
        inside = dx < half
        h = SPRING + RISE - (R - np.sqrt(np.maximum(0, R * R - dx * dx)))
        out[inside] = h[inside]
    return out


def build(seed=8):
    """Returns (Sprite in stage coords cropped to the bridge, foot y, info, near-face index map for the
    reflection)."""
    rng = random.Random(seed)
    W, H = P.W, P.H
    Zn, Zf = TP.BZ, TP.BZ + TP.BD
    sn, sf = P.F / Zn, P.F / Zf
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    a = np.full((H, W), CLEAR, np.uint8)

    def Y(h, s=sn):
        return P.YH + (P.HC - h) * s

    Xn = (xx - P.CX) / sn                  # world X on the near face plane for each column
    Xf = (xx - P.CX) / sf
    hn = P.HC - (yy - P.YH) / sn           # world height on the near face plane for each row
    hf = P.HC - (yy - P.YH) / sf
    on_n = (Xn >= TP.BX0) & (Xn <= TP.BX1)
    on_f = (Xf >= TP.BX0) & (Xf <= TP.BX1)
    dn = deck_h(Xn)
    df = deck_h(Xf)
    # ---------------------------------------------------------------- the far parapet's inner face and coping
    far_face = on_f & (hf <= df + PARA) & (hf >= df)
    a[far_face] = ix('t3')
    a[far_face & (hf > df + PARA - COPE * 1.4)] = ix('t5')
    a[far_face & (hf > df + PARA - COPE * .5)] = ix('t6')
    # its stones: joints every 0.55 m along the face, a course line at mid height
    jf = ((Xf - TP.BX0) / .55) % 1.0
    a[far_face & (jf * .55 * sf < 1) & (hf < df + PARA - COPE * 1.4)] = ix('t2')
    a[far_face & (np.abs(hf - (df + PARA * .45)) * sf < .5)] = ix('t2')
    # ---------------------------------------------------------------- the deck, seen past the near parapet's west end
    # deck pixels: rows between the far parapet foot and the near face's deck line, a road of packed earth on setts
    deck = (hf < df) & (hn > dn) & ((Xf >= TP.BX0) | (Xn >= TP.BX0)) & (Xn <= TP.BX1) & ~far_face
    # Z of the deck under each pixel (along the line of sight to the deck height): approximate with the mid plane
    a[deck] = ix('d4')
    a[deck & ((xx.astype(int) * 7 + yy.astype(int) * 3) % 13 == 0)] = ix('d5')
    a[deck & (np.abs(hf - df) * sf < 1.2)] = ix('d3')        # the far parapet's shadow along the deck
    # ---------------------------------------------------------------- the near face
    top_n = dn + PARA
    face = on_n & (hn <= top_n) & (hn >= WL)
    at = arch_top(Xn)
    hole = face & (hn < at) & (hn >= WL)
    wall = face & ~hole
    # coursed stone, blocks in metres: courses 0.32 m, blocks 0.45-0.85 m, staggered
    ch = .32
    course = np.floor((hn - WL) / ch).astype(int)
    off = (course % 2) * .37
    bx = np.zeros_like(Xn)
    # block index along each course: irregular widths from a per-course random sequence
    edges = {}
    for c in range(-2, 16):
        r = random.Random(seed * 100 + c)
        x = TP.BX0 - r.uniform(0, .6)
        es = []
        while x < TP.BX1 + 1:
            es.append(x)
            x += r.uniform(.45, .85)
        edges[c] = np.array(es)
    tone = np.full((H, W), ix('t4'), np.uint8)
    rows_px = (hn - WL) / ch - course                   # 0 at the course's foot, 1 at its top
    ys_, xs_ = np.nonzero(wall)
    for (y, x) in zip(ys_, xs_):
        c = course[y, x]
        es = edges.get(int(c))
        if es is None:
            continue
        X = Xn[y, x]
        k = np.searchsorted(es, X) - 1
        x0e, x1e = es[k], es[k + 1]
        u = (X - x0e) * sn                               # px into the block
        wpx = (x1e - x0e) * sn
        v = rows_px[y, x] * ch * sn                      # px above the course's foot
        hpx = ch * sn
        rr = random.Random((int(c) * 977 + int(k) * 131 + seed) & 0xffffff)
        base = 4 if rr.random() > .16 else 3
        if u < 1 or v < 1:
            t = 2                                        # mortar
        elif v > hpx - 2:
            t = base + 1                                 # the block's lit top
        elif u > wpx - 2 or v < 2:
            t = base - 1                                 # its shaded east end and foot
        else:
            t = base
        tone[y, x] = pal.RAMP['t'][t]
    a[wall] = tone[wall]
    # chips: a few blocks lose a corner
    for _ in range(40):
        x = rng.randint(int(P.CX + TP.BX0 * sn) + 4, int(P.CX + TP.BX1 * sn) - 4)
        y = rng.randint(int(Y(top_n.max() if False else HUMP_TOP + PARA)), int(Y(WL)) - 2)
        if wall[y, x] and a[y, x] in (ix('t4'), ix('t5')) and wall[y + 1, x] and wall[y, x + 1]:
            a[y, x] = ix('t2'); a[y, x + 1] = ix('t3')
    # the string course at deck level: a projecting band, lit on top, a hard shadow under it
    sc = on_n & wall & (np.abs(hn - (dn - .02)) * sn < 1.0)
    a[sc] = ix('t5')
    a[on_n & wall & (np.abs(hn - (dn - .02 - 1.5 / sn)) * sn < .5)] = ix('t3')
    # the parapet's coping, lit, jointed
    cope = on_n & (hn <= top_n) & (hn > top_n - COPE)
    a[cope] = ix('t6')
    a[on_n & (hn <= top_n - COPE) & (hn > top_n - COPE - .05)] = ix('t3')
    jc = ((Xn - TP.BX0) / .7) % 1.0
    a[cope & (jc * .7 * sn < 1)] = ix('t4')
    # voussoirs round each arch: wedges radiating from the arch's centre, lit on the west haunch
    for (a0, a1) in ARCHES:
        half = (a1 - a0) / 2
        mid = a0 + half
        R = (half * half + RISE * RISE) / (2 * RISE)
        cyh = SPRING + RISE - R
        dx = Xn - mid
        dy = hn - cyh
        rr_ = np.hypot(dx, dy)
        ring = wall & (rr_ >= R) & (rr_ < R + RING) & (np.abs(dx) < half + RING) & (hn > SPRING)
        ang = np.arctan2(dy, dx)
        nv = 15
        seg = (ang / math.pi * nv) % 1.0
        arc_px = R * math.pi / nv * sn
        tt = np.where(dx < 0, 5, 4)
        tt = np.where(dx > half * .55, 3, tt)
        rt = np.full((H, W), 0)
        rt = tt
        a[ring] = np.array(pal.RAMP['t'], np.uint8)[np.clip(rt, 0, 6)][ring]
        joint = ring & (seg * arc_px < 1.0)
        a[joint] = ix('t2')
        outer = ring & (rr_ > R + RING - 1.2 / sn)
        a[outer] = ix('t2')
        inner = ring & (rr_ < R + .9 / sn)
        a[inner & (dx < 0)] = ix('t6')
        a[inner & (dx >= 0)] = ix('t3')
        key = ring & (np.abs(dx) < .16) & (dy > 0)
        a[key] = ix('t5')
        a[key & (np.abs(dx) * sn > 2.5)] = ix('t2')
    # ---------------------------------------------------------------- through the arches
    # a line of sight through the near opening at height h meets the water at Z_hit; beyond the far face it is the
    # sunlit river, under the bridge the shaded water; the pier's (or abutment's) inner wall cuts in from the right
    Zhit = Zn * (P.HC - WL) / np.maximum(.01, P.HC - hn)
    beyond = hole & (Zhit > Zf)
    under = hole & ~beyond
    a[beyond] = ix('a4')
    a[under] = ix('a1')
    a[under & (Zhit < Zn + 1.3)] = ix('a2')            # daylight reaching in under the near ring
    # the inner wall on the right of each opening (lines of sight bend toward +X with depth)
    for (a0, a1) in ARCHES:
        Xin = a1                                        # the opening's east side: pier or east abutment
        seen = hole & (Xn > Xin * Zn / Zf) & (Xn < a1)
        # depth where the line of sight meets the plane X = Xin
        Zw = Xin * Zn / np.maximum(1e-3, Xn)
        hw = P.HC - (P.HC - hn) * Zw / Zn
        cv = ((hw - WL) / .32) % 1.0
        w_ = seen & (hw >= WL) & (hw < arch_top(np.full_like(hw, Xin - .01)) + 10)
        a[w_] = ix('t1')
        a[w_ & (cv * .32 * (P.F / np.maximum(Zw, 1)) < 1) & (hw > WL + .5)] = ix('t2')
        a[w_ & (hw < WL + .3)] = ix('t0')
    # sky-pale glints on the river seen through the arches
    for (x, y) in cpx.poisson(rng, P.CX + TP.BX0 * sn, Y(SPRING + RISE), P.CX + TP.BX1 * sn, Y(WL), 9, 300):
        x, y = int(x), int(y)
        if beyond[y, x] and beyond[y, x + 3] and beyond[y, x - 1]:
            for i in range(rng.choice((3, 4, 5))):
                if beyond[y, x + i]:
                    a[y, x + i] = ix('a6')
    # ---------------------------------------------------------------- the cutwater: a pointed buttress on the pier
    # its two faces run from the pier's sides to a point 0.9 m downstream (toward us). Seen from the west, the west
    # face is wide and lit, the east face a narrow dark strip; a pyramid cap rises over the springing to a point.
    pm = (PIER[0] + PIER[1]) / 2
    Zp = Zn - .9
    sp_ = P.F / Zp
    xl = int(round(P.CX + PIER[0] * sn))
    xr = int(round(P.CX + PIER[1] * sn))
    # the point projects close to the east edge; set it a little east of the middle so both faces read
    tip_x = int(round(xl + (xr - xl) * .62))
    cut_top = SPRING + .5
    y_top = int(round(Y(cut_top, sp_)))
    y_foot = int(round(Y(WL, sp_)))
    for y in range(y_top, y_foot + 1):
        hh2 = P.HC - (y + .5 - P.YH) / sp_
        cv = ((hh2 - WL) / .32) % 1.0 * .32 * sp_
        for x in range(xl, xr + 1):
            if x < tip_x:
                k = 't5' if cv > 1 else 't3'
                if x == tip_x - 1:
                    k = 't6'
            elif x == tip_x:
                k = 't4'
            else:
                k = 't3' if cv > 1 else 't2'
            a[y, x] = ix(k)
    cap_h = int(round(.55 * sp_))
    for j in range(cap_h):
        y = y_top - 1 - j
        f = j / cap_h
        x0c = int(round(xl + (tip_x - xl) * f))
        x1c = int(round(xr - (xr - tip_x) * f))
        for x in range(x0c, x1c + 1):
            a[y, x] = ix('t6' if x < tip_x else ('t5' if x == tip_x else 't3'))
        if x0c <= x1c:
            a[y, x0c] = ix('t6')
    # the current parts round its point: a lit wake either side, running toward us
    info_wake = (tip_x, y_foot)
    # ---------------------------------------------------------------- the end posts: squat square piers at each end
    for Xe, side in ((TP.BX0, 1), (TP.BX1, -1)):
        for (Zp_, which) in ((Zf, 'far'), (Zn, 'near')):
            s_ = P.F / Zp_
            x0 = P.CX + (Xe if side > 0 else Xe - .5) * s_
            x1 = x0 + .5 * s_
            hb = deck_h(Xe) - .1
            ht = deck_h(Xe) + PARA + .32
            for y in range(int(Y(ht, s_)), int(Y(hb, s_)) + 1):
                hh = P.HC - (y + .5 - P.YH) / s_
                for x in range(int(round(x0)), int(round(x1))):
                    if not (0 <= x < W):
                        continue
                    u = (x - x0) / max(1, x1 - x0)
                    if hh > ht - .12:
                        k = 't6' if u < .7 else 't5'       # the cap, catching the sun
                    elif hh > ht - .18:
                        k = 't3'
                    else:
                        k = 't5' if u < .3 else ('t4' if u < .75 else 't3')
                        if ((hh - hb) / .3) % 1.0 * .3 * s_ < 1:
                            k = 't2'
                    a[y, x] = ix(k)
    # ---------------------------------------------------------------- the waterline: wet stone, weed
    wl_y = int(round(Y(WL)))
    for x in range(W):
        if a[wl_y - 1, x] in pal.RAMP['t']:
            a[wl_y - 1, x] = ix('t1')
            if a[wl_y - 2, x] in pal.RAMP['t']:
                a[wl_y - 2, x] = pal.shift_index(int(a[wl_y - 2, x]), -1)
    for x in range(int(P.CX + TP.BX0 * sn), int(P.CX + TP.BX1 * sn), 7):
        if rng.random() < .55 and a[wl_y - 3, x] in pal.RAMP['t'] and a[wl_y - 3, x + 4] in pal.RAMP['t']:
            for i, k in enumerate(('m2', 'm3', 'm4', 'm3', 'm2')):
                a[wl_y - 2, x + i] = ix(k)
            a[wl_y - 3, x + 1] = ix('m4'); a[wl_y - 3, x + 2] = ix('m3')
    # moss on the abutments where they meet the banks
    for Xe in (TP.BX0 + .2, TP.BX1 - 1.2):
        x0 = int(P.CX + Xe * sn)
        yb = int(Y(deck_h(Xe) - .05))
        for i in range(0, int(1.0 * sn), 3):
            for j in range(rng.randint(1, 4)):
                if a[yb - j, x0 + i] in pal.RAMP['t']:
                    a[yb - j, x0 + i] = ix('m3' if j else 'm2')
    # ---------------------------------------------------------------- the abutments run down into the banks
    # below deck level at each end the face meets the ground: cut the face at the bank's line
    bank_h = 0.0
    for (x0w, x1w) in ((TP.BX0, ARCHES[0][0] - .05), (ARCHES[1][1] + .05, TP.BX1)):
        cut = on_n & (Xn >= x0w) & (Xn <= x1w) & (hn < bank_h - .02)
        a[cut] = CLEAR
    # ---------------------------------------------------------------- outline (selout) in the stone ramp's dark steps
    m = a != CLEAR
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    src = a.copy()
    for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
        v = nb(src, dx, dy, CLEAR)
        pick = rg & (v != CLEAR) & (a == CLEAR)
        a[pick] = np.where(np.isin(v[pick], pal.RAMP['a']), ix('a0'), np.where(dy == 1 or dx == 1, ix('t2'), ix('t1')))
    # but not along the waterline or into the banks (the face goes on below them)
    ys, xs = np.nonzero(a != CLEAR)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    S = Sprite(x1 - x0, y1 - y0, 0, 0)
    S.ix[:] = a[y0:y1, x0:x1]
    foot = int(round(Y(WL)))
    S.ax, S.ay = 0, foot - y0
    info = dict(x0=int(x0), y0=int(y0), foot=foot, wl_y=wl_y, wake=info_wake, west_head=(P.CX + TP.BX0 * sn, Y(deck_h(TP.BX0))),
                east_head=(P.CX + TP.BX1 * sn, Y(deck_h(TP.BX1))), sn=sn)
    return S, info


def reflect(ground, S, info, water_mask, seed=3):
    """Mirror the bridge's near face about the waterline onto the water in front of it, mapped down into the Water
    ramp (stone light -> a4, dark -> a1), broken into rows by the current."""
    rng = random.Random(seed)
    wl = info['wl_y']
    x0, y0 = info['x0'], info['y0']
    lut = {}
    for i in pal.RAMP['t']:
        lut[i] = ix({0: 'a1', 1: 'a1', 2: 'a2', 3: 'a2', 4: 'a3', 5: 'a3', 6: 'a4'}[pal.LEVEL[i]])
    for i in pal.RAMP['a']:
        lut[i] = ix('a2') if pal.LEVEL[i] >= 3 else ix('a1')
    for i in pal.RAMP['m']:
        lut[i] = ix('a1')
    for i in pal.RAMP['d']:
        lut[i] = ix('a2')
    Hh, Ww = ground.shape
    depth = wl - y0
    for k in range(1, depth):
        y = wl + k + 1
        sy = wl - k - y0
        if y >= Hh or sy < 0:
            break
        keep = 1.0 - (k / depth) * .75                     # the image thins out away from the bridge
        shift = int(round(2 * math.sin(k * .7 + 1.3) + (k / 30)))
        row = S.ix[sy]
        i = 0
        while i < S.w:
            run = rng.randint(6, 26)
            gap = rng.random() > keep
            if not gap:
                for ii in range(i, min(S.w, i + run)):
                    v = int(row[ii])
                    if v == CLEAR or v not in lut:
                        continue
                    X = x0 + ii + shift
                    if 0 <= X < Ww and water_mask[y, X]:
                        ground[y, X] = lut[v]
            i += run + (rng.randint(1, 4) if gap else 0)
    # the wake off the cutwater: two lit lines spreading toward us
    tx, ty = info['wake']
    for k in range(2, 26):
        for sgn in (-1, 1):
            X = tx + sgn * (1 + k // 2)
            Y_ = ty + k
            if 0 <= Y_ < Hh and 0 <= X < Ww and water_mask[Y_, X] and k % 4 != 3:
                ground[Y_, X] = ix('a6' if k < 12 else 'a5')
