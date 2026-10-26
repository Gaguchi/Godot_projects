"""Cottages for the title's far bank, built as real boxes with gable roofs and projected through persp's camera.

Each face is a plane, so every pixel is traced back to the point on the face it shows (a ray-plane hit) and
textured in metres there: plaster with timber framing, coursed stone or boards on the walls; tile courses, slate
rows or thatch strokes on the roof; a door 1 x 1.9 m, windows 0.7 x 0.8 m with shutters; a plinth; a chimney. Lines
never go under 1 px, details drop out where they would. The camera sits west of and below the ridges, so it sees a
house's south wall, its west wall and one roof slope: the south slope of an east-west ridge, the west slope of a
north-south one. Light from the upper left: west faces lit, south faces mid, roof slopes facing up lit a step, the
eaves' underside dark with a hard shadow line on the wall. Outlined in each part's own darkest step (selout).
"""
import math
import random

import numpy as np

import cpx
import persp as P
from cpx import pal, ix, CLEAR, nb
from pxworld.canvas import Sprite

WALLS = {
    'plaster': dict(lit='b5', mid='b4', dark='b3', frame=None),
    'timber': dict(lit='b5', mid='b4', dark='b3', frame=('w2', 'w3')),
    'stone': dict(lit='t5', mid='t4', dark='t3', frame=None),
}
ROOFS = {
    'tile': dict(ramp='r', lit=5, mid=4, dark=2, kind='tile'),
    'tile2': dict(ramp='r', lit=4, mid=3, dark=1, kind='tile'),
    'thatch': dict(ramp='h', lit=5, mid=4, dark=2, kind='thatch'),
    'slate': dict(ramp='s', lit=3, mid=2, dark=1, kind='slate'),
}


def _rays(xx, yy):
    """Ray directions per pixel: a point at depth t lies at X = t*rx, h = HC - t*ry."""
    return (xx - P.CX) / P.F, (yy - P.YH) / P.F


def house(X0, Z0, w, d, hw, ridge='ew', roof='tile', wall='plaster', pitch=1.0, seed=0, chimney=True, door=True):
    """A house whose south-west ground corner is (X0, Z0), w metres along X, d along Z, walls hw tall, a gable
    roof of the given pitch (rise per run). Returns (Sprite in stage coords, foot y for sorting, info)."""
    rng = random.Random(seed)
    WL = WALLS[wall]
    RF = ROOFS[roof]
    ov = .35                                   # eave overhang
    X1, Z1 = X0 + w, Z0 + d
    # bounding box in stage px
    corners = []
    span = (w if ridge == 'ns' else d) / 2
    hr = hw + span * pitch                     # ridge height
    for X in (X0 - ov, X1 + ov):
        for Z in (Z0 - ov, Z1 + ov):
            for h in (0, hr + 1.6):
                corners.append(P.proj(X, Z, h))
    xs = [c[0] for c in corners]; ys = [c[1] for c in corners]
    bx0, bx1 = int(min(xs)) - 3, int(max(xs)) + 4
    by0, by1 = int(min(ys)) - 3, int(max(ys)) + 4
    Wb, Hb = bx1 - bx0, by1 - by0
    yy, xx = np.mgrid[by0:by1, bx0:bx1].astype(float) + .5
    rx, ry = _rays(xx, yy)
    a = np.full((Hb, Wb), CLEAR, np.uint8)
    depth = np.full((Hb, Wb), np.inf)
    s_ref = P.F / (Z0 + d / 2)                 # px per metre, for line widths

    def px(m):
        return m * s_ref

    def paint(mask, t, tone):
        sel = mask & (t < depth)
        a[sel] = tone[sel] if isinstance(tone, np.ndarray) else ix(tone)
        depth[sel] = t[sel]

    # ---------------------------------------------------------------- the south wall (plane Z = Z0), with the gable for 'ns'
    t = np.full((Hb, Wb), Z0)
    X = t * rx
    h = P.HC - t * ry
    if ridge == 'ew':
        mS = (X >= X0) & (X <= X1) & (h >= 0) & (h <= hw)
    else:
        mid = (X0 + X1) / 2
        mS = (X >= X0) & (X <= X1) & (h >= 0) & (h <= hw + (w / 2 - np.abs(X - mid)) * pitch)
    tone = _wall_tex(WL, X - X0, h, w, hw, 'mid', s_ref, rng, ridge == 'ns', pitch)
    paint(mS, t, tone)
    _openings(a, mS, X - X0, h, w, hw, s_ref, rng, door=door, face='S')
    # ---------------------------------------------------------------- the west wall (plane X = X0), lit
    with np.errstate(divide='ignore', invalid='ignore'):
        t = np.where(rx > 1e-6, X0 / rx, np.inf)
    Z = t
    h = P.HC - t * ry
    if ridge == 'ew':
        mid = (Z0 + Z1) / 2
        mW = (Z >= Z0) & (Z <= Z1) & (h >= 0) & (h <= hw + (d / 2 - np.abs(Z - mid)) * pitch)
    else:
        mW = (Z >= Z0) & (Z <= Z1) & (h >= 0) & (h <= hw)
    if X0 > 0:
        tone = _wall_tex(WL, Z - Z0, h, d, hw, 'lit', s_ref, rng, ridge == 'ew', pitch)
        paint(mW, t, tone)
        _openings(a, mW & (t <= depth), Z - Z0, h, d, hw, s_ref, rng, door=False, face='W')
    # ---------------------------------------------------------------- the roof slope we see
    k = pitch
    if ridge == 'ew':
        # south slope: h = hw + (Z - (Z0 - ov)) * k  for Z in [Z0 - ov, mid]
        zs = Z0 - ov
        zr = (Z0 + Z1) / 2
        hs = hw - ov * k
        t = (P.HC - hs + zs * k) / (ry + k)
        Z = t
        X = t * rx
        h = P.HC - t * ry
        mR = (Z >= zs) & (Z <= zr) & (X >= X0 - ov) & (X <= X1 + ov) & (t > 0)
        u = X - (X0 - ov)                       # along the ridge
        v = (zr - Z) * math.hypot(1, k)         # down the slope from the ridge
        tone = _roof_tex(RF, u, v, (zr - zs) * math.hypot(1, k), s_ref, rng, 'mid')
        paint(mR, t, tone)
        eave = mR & (v > (zr - zs) * math.hypot(1, k) - max(1.2 / s_ref, .12))
        a[eave] = ix(f"{RF['ramp']}{RF['dark']}")
        ridge_line = mR & (v < max(1.0 / s_ref, .1))
        a[ridge_line] = ix(f"{RF['ramp']}{min(len(pal.RAMP[RF['ramp']]) - 1, RF['lit'] + 1)}")
        # the west verge: the roof's edge over the gable, a lit barge board
        verge = mR & (u < max(1.1 / s_ref, .12))
        a[verge] = ix('w4' if RF['kind'] != 'thatch' else 'h3')
    else:
        # west slope: h = hw + (X - (X0 - ov)) * k for X in [X0 - ov, mid]
        xs_ = X0 - ov
        xr = (X0 + X1) / 2
        hs = hw - ov * k
        with np.errstate(divide='ignore', invalid='ignore'):
            t = (P.HC - hs + xs_ * k) / (ry + k * rx)
        X = t * rx
        Z = t
        h = P.HC - t * ry
        mR = (X >= xs_) & (X <= xr) & (Z >= Z0 - ov) & (Z <= Z1 + ov) & (t > 0)
        u = Z - (Z0 - ov)
        v = (xr - X) * math.hypot(1, k)
        tone = _roof_tex(RF, u, v, (xr - xs_) * math.hypot(1, k), s_ref, rng, 'lit')
        paint(mR, t, tone)
        eave = mR & (v > (xr - xs_) * math.hypot(1, k) - max(1.2 / s_ref, .12))
        a[eave] = ix(f"{RF['ramp']}{RF['dark']}")
        front = mR & (u < max(1.1 / s_ref, .12))
        a[front] = ix('w4' if RF['kind'] != 'thatch' else 'h3')
        ridge_line = mR & (v < max(1.0 / s_ref, .1))
        a[ridge_line] = ix(f"{RF['ramp']}{RF['mid']}")
    # the eave's shadow on the wall under it: a hard dark band one step down
    sh = (a != CLEAR) & ~mR & nb(mR, 0, -1, False)
    for _ in range(max(1, int(round(.25 * s_ref)))):
        a[sh] = cpx.lut(-1)[a[sh]]
        sh = (a != CLEAR) & ~mR & nb(sh, 0, -1, False)
    # ---------------------------------------------------------------- the chimney: a stone stack standing on the ridge
    chim = None
    if chimney:
        if ridge == 'ew':
            cxw, czw = X0 + w * (.78 if seed % 2 else .22), (Z0 + Z1) / 2
        else:
            cxw, czw = (X0 + X1) / 2, Z0 + d * .7
        x0c, y0c = P.proj(cxw - .3, czw, hr + .75)
        x1c, y1c = P.proj(cxw + .3, czw, hr - .4)
        cw = max(3, int(round(x1c - x0c)))
        X0p, Y0p, Y1p = int(round(x0c)) - bx0, int(round(y0c)) - by0, int(round(y1c)) - by0
        for y in range(Y0p, Y1p):
            for i in range(cw):
                k_ = 't5' if i < cw * .4 else ('t4' if i < cw - 1 else 't3')
                if y == Y0p:
                    k_ = 't2'
                elif y == Y0p + 1:
                    k_ = 't6' if i < cw - 1 else 't4'
                elif y == Y0p + 2:
                    k_ = 't3'
                if 0 <= y < Hb and 0 <= X0p + i < Wb:
                    a[y, X0p + i] = ix(k_)
        chim = (bx0 + X0p + cw // 2, by0 + Y0p - 1)
    # ---------------------------------------------------------------- outline
    S = Sprite(Wb + 2, Hb + 2, 0, 0)
    S.ix[1:-1, 1:-1] = a
    _selout(S)
    foot = P.proj(X0, Z0)[1]
    S.ax, S.ay = 1 + int(round(P.proj(X0, Z0)[0])) - bx0, int(round(foot)) - by0 + 1
    return S, dict(chimney=chim, box=(bx0, by0, Wb, Hb), foot=foot)


def _selout(S):
    from pxworld import build as B
    B.selout(S, lit=True)


def _wall_tex(WL, u, h, L, hw, face, s, rng, gable, pitch):
    """Wall tones in metres: plaster (a lit band under the eaves breaks into stains near the plinth), timber
    framing (posts every 1.2 m, a rail at mid height, braces), or coursed stone; a stone plinth 0.35 m."""
    lit = WL['lit'] if face == 'lit' else WL['mid']
    mid = WL['mid'] if face == 'lit' else WL['dark']
    t = np.full(u.shape, ix(lit), np.uint8)
    if WL['frame'] is None and WL['lit'].startswith('t'):
        # coursed stone: 0.3 m courses, blocks 0.4-0.8 m
        c = np.floor(h / .3)
        off = (c % 2) * .31
        bj = ((u + off) / .55) % 1.0
        cv = (h / .3) % 1.0
        line_px = 1.0 / max(s, 1)
        t[(cv * .3 < line_px * 1.0) & (s * .3 >= 2.4)] = ix(mid)
        t[(bj * .55 < line_px) & (s * .3 >= 2.4) & (cv * .3 >= line_px)] = ix(mid)
    elif WL['frame'] is not None:
        fr_lit, fr_dk = WL['frame']
        lw = max(1.0 / s, .14)
        post = ((u + .02) % 1.25) < lw
        rail = np.abs(h - hw * .5) < lw / 2
        sill = np.abs(h - (hw - .08)) < lw / 2
        t[post | rail | sill] = ix(fr_dk if face != 'lit' else fr_lit)
        # braces from each corner post
        for (x0, sgn) in ((0, 1), (L, -1)):
            br = np.abs((u - x0) * sgn - (h - .4) * .8) < lw * .9
            br &= (h > .4) & (h < hw * .5) & ((u - x0) * sgn > 0) & ((u - x0) * sgn < .9)
            t[br] = ix(fr_dk if face != 'lit' else fr_lit)
    else:
        # plaster: lime-washed, a weathered band a step down along its foot above the plinth
        t[(h < .62) & (h >= .35)] = ix(mid)
    # the plinth
    t[h < .35] = ix('t4' if face == 'lit' else 't3')
    t[(h < .35) & (h > .3)] = ix('t5')
    if gable:
        # the gable triangle above the wall plate: boards for timber, plaster otherwise; a dark plate line
        t[np.abs(h - hw) < max(.6 / s, .07)] = ix('w2')
    return t


def _roof_tex(RF, u, v, Lv, s, rng, face):
    ramp = RF['ramp']
    lit = RF['lit'] if face == 'lit' else RF['lit'] - 1
    base = RF['mid'] if face == 'lit' else RF['mid'] - 1 + 1
    t = np.full(u.shape, ix(f'{ramp}{base}'), np.uint8)
    if RF['kind'] == 'tile':
        ch = .32
        row = np.floor(v / ch)
        rv = (v / ch) % 1.0
        off = (row % 2) * .14
        tj = ((u + off) / .28) % 1.0
        if s * ch >= 3:
            t[rv * ch * s < 1.0] = ix(f'{ramp}{lit}')
            t[(rv * ch * s > ch * s - 1.0)] = ix(f'{ramp}{RF["dark"] + 1}')
            t[(tj * .28 * s < 1.0) & (s * .28 >= 4)] = ix(f'{ramp}{RF["dark"] + 1}')
    elif RF['kind'] == 'slate':
        ch = .25
        rv = (v / ch) % 1.0
        row = np.floor(v / ch)
        tj = ((u + (row % 2) * .15) / .3) % 1.0
        if s * ch >= 3:
            t[rv * ch * s > ch * s - 1.0] = ix(f'{ramp}{RF["dark"]}')
            t[(tj * .3 * s < 1.0) & (s * .3 >= 4)] = ix(f'{ramp}{RF["dark"]}')
            t[rv * ch * s < 1.0] = ix(f'{ramp}{lit}')
    else:
        # thatch: strokes down the slope, a lit lip and a shaded band at each layer's foot
        band = .6
        rv = (v / band) % 1.0
        n = np.sin(u * 23.0) + np.sin(u * 9.7 + 1.3)
        if s * band >= 4:
            t[(rv > .78) & (n > -.4)] = ix(f'{ramp}{RF["dark"] + 1}')
            t[(rv < .2) & (n > .3)] = ix(f'{ramp}{lit}')
        strokes = (np.sin(u * 31.0 + v * 2.0) > .8) & (s >= 8)
        t[strokes & (rv > .25) & (rv < .7)] = ix(f'{ramp}{base - 1}')
    return t


def _openings(a, m, u, h, L, hw, s, rng, door=True, face='S'):
    """A door and windows on a wall face, in metres; only where they come out at least 3 px."""
    if s * .7 < 3:
        return
    n_win = max(1, int(L / 2.6))
    xs = [L * (k + .5) / n_win for k in range(n_win)]
    if door and face == 'S':
        dx = L * (.32 if L > 5 else .5)
        dm = m & (np.abs(u - dx) < .5) & (h > .05) & (h < 1.9)
        a[dm] = ix('w2')
        a[dm & (np.abs(u - dx + .42) < .08)] = ix('w4')
        a[dm & (h > 1.75)] = ix('w1')
        xs = [x for x in xs if abs(x - dx) > 1.1] or ([L * .78] if L > 3.5 else [])
    wy0, wy1 = hw * .42, hw * .42 + .8
    for wx in xs:
        wm = m & (np.abs(u - wx) < .35) & (h > wy0) & (h < wy1)
        a[wm] = ix('s1')
        a[wm & (h > wy1 - max(1.0 / s, .1))] = ix('s0')
        a[wm & (np.abs(u - wx) < max(.5 / s, .04))] = ix('w3')
        a[wm & (np.abs(h - (wy0 + wy1) / 2) < max(.5 / s, .04))] = ix('w3')
        glint = wm & (u < wx - .1) & (h > (wy0 + wy1) / 2 + .1) & (h < wy1 - .15)
        a[glint] = ix('s3')
        sill = m & (np.abs(u - wx) < .45) & (h > wy0 - max(1.2 / s, .1)) & (h <= wy0)
        a[sill] = ix('w5')
        if s * .3 >= 3:
            for sgn in (-1, 1):
                sh = m & (np.abs(u - (wx + sgn * .52)) < .16) & (h > wy0) & (h < wy1)
                a[sh] = ix('m3' if face == 'W' else 'm2')
