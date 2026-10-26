"""The company's ridge tent at camp scale (about 2x a person's height overall).

Seen from the south and above, like the people: the front gable stands square to the viewer with its doorway,
and the ridge runs straight back (a touch east), so both roof slopes show above the gable's edges: the west slope
in sun, the east slope in shade. Canvas is the Bone ramp; the outline is a warm dark (Dirt d1) with the lighter
b1 on the edges that face the light. Drawn detail: folds hanging from the apex, vertical seams, a doubled hem
scalloped between its pegs and splashed with mud, a doorway with one flap rolled and tied, the ridge sagging
between its poles, slope seams, a sewn patch, the uprights' tops and the ridge pole standing proud, guy ropes
in hemp to wooden pegs."""
import math
import random

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, K, new, put, get, line, nb


def _lin(p, q):
    """Signed distance field helper: returns f(xx, yy) = distance from line p->q, + to its left."""
    d = np.array(q, float) - np.array(p, float)
    n = np.array([d[1], -d[0]]) / np.linalg.norm(d)
    return lambda xx, yy: (xx - p[0]) * n[0] + (yy - p[1]) * n[1]


def tent(Wg=240, Hg=184, D=(14, -60), seed=3):
    """Returns (sprite, info). Sprite foot anchor = the middle of the gable's base; info has the ground
    footprint, the shadow polygon and the peg points, relative to the anchor."""
    rng = random.Random(seed)
    padL, padR, padT, padB = 64, 70, 22, 26
    SW = padL + Wg + max(0, D[0]) + padR
    SH = padT + (-D[1]) + Hg + padB
    ox, oy = padL, padT + (-D[1]) + Hg            # FL
    s = new(SW, SH, ox + Wg // 2, oy)
    yy, xx = np.mgrid[0:SH, 0:SW].astype(float) + .5
    FL = np.array([ox, oy], float)
    FR = FL + (Wg, 0)
    A = FL + (Wg * .5, -Hg)
    Dv = np.array(D, float)
    B = A + Dv
    FLb, FRb = FL + Dv, FR + Dv

    def bow(p, q, amt, n=20):
        """Points along p->q bowed inward (toward the tent's middle) by amt px at mid-span: the canvas sag."""
        p, q = np.array(p, float), np.array(q, float)
        d = q - p
        nrm = np.array([-d[1], d[0]]) / np.linalg.norm(d)
        c = (FL + FR + A) / 3
        if np.dot(c - (p + q) / 2, nrm) < 0:
            nrm = -nrm
        return [p + d * t + nrm * amt * math.sin(math.pi * t) for t in np.linspace(0, 1, n)]

    gl = bow(FL, A, 2.5)                 # the gable's west edge, sagging in a little
    gr = bow(A, FR, 2.5)
    hem = [FR + (FL - FR) * t + (0, -2.2 * abs(math.sin(math.pi * t * 3))) for t in np.linspace(0, 1, 36)]
    m_g = cpx.poly_mask(SW, SH, [tuple(p) for p in gl + gr[1:] + hem[1:]])
    ridge = [A + Dv * t + (0, 3.0 * math.sin(math.pi * t)) for t in np.linspace(0, 1, 16)]
    m_w = cpx.poly_mask(SW, SH, [tuple(FL), tuple(FLb)] + [tuple(p) for p in ridge[::-1]] + [tuple(p) for p in gl[::-1]]) & ~m_g
    m_e = cpx.poly_mask(SW, SH, [tuple(p) for p in ridge] + [tuple(FRb), tuple(FR)] + [tuple(p) for p in gr[::-1]]) & ~m_g & ~m_w

    # ------------------------------------------------ the west slope: in sun
    fW = _lin(FL, A)                     # distance from the gable's west edge
    s.ix[m_w] = ix('b4')
    # where along the slope, front (0) to back (1)
    dW = np.abs(fW(xx, yy))
    span = np.abs(_lin(FL, A)(FLb[0], FLb[1]))
    tw = np.clip(dW / span, 0, 1)
    s.ix[m_w & (tw > .3) & (tw < .7) & (_lin(FLb, B)(xx, yy) * np.sign(_lin(FLb, B)(FL[0], FL[1])) > 6)] = ix('b3')   # the sag
    s.ix[m_w & (np.abs(_lin(A, B)(xx, yy)) < 2.2)] = ix('b5')                         # the ridge catches the sun
    s.ix[m_w & (np.abs(tw - .5) < .03) & (_lin(FLb, B)(xx, yy) * np.sign(_lin(FLb, B)(FL[0], FL[1])) > 3)] = ix('b2')  # the seam
    # ------------------------------------------------ the east slope: in shade
    s.ix[m_e] = ix('b2')
    fE = _lin(A, FR)
    dE = np.abs(fE(xx, yy))
    spanE = np.abs(fE(FRb[0], FRb[1]))
    te = np.clip(dE / spanE, 0, 1)
    edgeE = np.abs(_lin(B, FRb)(xx, yy))
    s.ix[m_e & (te > .28) & (te < .72) & (edgeE > 5)] = ix('b1')                   # the sag between the poles
    s.ix[m_e & (np.abs(te - .5) < .025) & (edgeE > 3)] = ix('b0')                 # the seam
    s.ix[m_e & (np.abs(te - .54) < .02) & (edgeE > 6) & (te > .5)] = ix('b2')
    s.ix[m_e & (np.abs(_lin(A, B)(xx, yy)) < 1.6)] = ix('b3')                       # the ridge's lit lip
    for (k0, k1, off) in ((6, 40, .18), (10, 52, .36), (8, 34, .62), (12, 46, .8)):
        p0 = B + (FRb - B) * off
        dirn = (A + (FR - A) * off) - p0
        dirn = dirn / np.linalg.norm(dirn)
        for k in range(k0, k1):
            q = p0 + dirn * k
            if m_e[int(q[1]), int(q[0])]:
                put(s, q[0], q[1], 'b1' if get(s, q[0], q[1]) == ix('b2') else 'b0')
                if m_e[int(q[1]) - 1, int(q[0])] and (k - k0) < (k1 - k0) * .6:
                    put(s, q[0], q[1] - 1, 'b3')
    for (k0, k1, off) in ((6, 30, .3), (8, 40, .7)):
        p0 = B + (FLb - B) * off
        dirn = (A + (FL - A) * off) - p0
        dirn = dirn / np.linalg.norm(dirn)
        for k in range(k0, k1):
            q = p0 + dirn * k
            if m_w[int(q[1]), int(q[0])]:
                put(s, q[0], q[1], 'b3')
                if m_w[int(q[1]) - 1, int(q[0])]:
                    put(s, q[0], q[1] - 1, 'b5')
    # the eaves along the ground: a dark doubled hem
    s.ix[m_e & (edgeE < 3)] = ix('b1')
    s.ix[m_e & (edgeE < 1.2)] = ix('b0')

    # ------------------------------------------------ the gable: square to us, mid tone, lit on its west edge
    s.ix[m_g] = ix('b3')
    gW = np.abs(_lin(FL, A)(xx, yy))
    gE = np.abs(_lin(A, FR)(xx, yy))
    s.ix[m_g & (gW < 4)] = ix('b4')
    s.ix[m_g & (gE < 7) & (yy > A[1] + 26)] = ix('b2')
    # folds hanging from the apex: each a narrow wedge of shade with a lit wedge on its west side
    folds = [(-.50, 30, 150, 2.0), (-.30, 20, 120, 1.6), (-.14, 60, 112, 1.3), (.20, 40, 128, 1.5), (.36, 24, 140, 2.0), (.50, 50, 118, 1.6)]
    for (ang, L0, L1, wmax) in folds:
        dx, dy = math.sin(ang), math.cos(ang)
        for k in range(L0, L1):
            f = (k - L0) / (L1 - L0)
            w = wmax * math.sin(math.pi * min(1, f * 1.15)) + .4
            px, py = A[0] + dx * k, A[1] + 3 + dy * k
            for j in range(int(round(w))):
                q = (px + j, py)
                if m_g[int(q[1]), int(q[0])] and get(s, *q) in (ix('b3'), ix('b4'), ix('b2')):
                    put(s, q[0], q[1], 'b2')
            for j in range(1, int(round(w)) + 1):
                q = (px - j, py)
                if m_g[int(q[1]), int(q[0])] and get(s, *q) == ix('b3') and f < .8:
                    put(s, q[0], q[1], 'b4')
    # vertical seams, a dark stitch with a lit lap on its west side
    for fx in (.17, .33, .67, .83):
        x = int(FL[0] + Wg * fx)
        for y in range(int(A[1]) + 4, int(oy) - 6):
            if m_g[y, x - 2] and m_g[y, x + 2]:
                put(s, x, y, 'b2')
                if get(s, x - 1, y) == ix('b3'):
                    put(s, x - 1, y, 'b4')
    # the hem: a doubled band, scalloped between its pegs, mud-splashed along the foot
    hb = m_g & (yy > oy - 11)
    s.ix[hb] = ix('b2')
    s.ix[m_g & (yy > oy - 11) & (yy < oy - 9.5)] = ix('b4')
    splash = m_g & (yy > oy - 6 + 1.6 * np.sin(xx * .41) + 1.2 * np.sin(xx * 1.13 + 1))
    s.ix[splash] = ix('d4')
    s.ix[splash & (yy > oy - 2.5)] = ix('d3')

    # ------------------------------------------------ the doorway: dark inside, the left flap rolled and tied
    cx = A[0] + 2
    top = A[1] + Hg * .36
    dwb = Wg * .15
    door_pts = [(cx - 1, top), (cx + 2, top), (cx + dwb, oy - 2), (cx - dwb * .7, oy - 2)]
    door = cpx.poly_mask(SW, SH, door_pts) & m_g
    s.ix[door] = ix('w1')
    s.ix[door & (yy < top + 22)] = ix('w0')
    s.ix[door & (yy > oy - 26)] = ix('w2')
    for y in range(int(top + 6), int(oy - 2)):
        if door[y, int(cx)]:
            put(s, cx - 1, y, 'w4'); put(s, cx, y, 'w3'); put(s, cx + 1, y, 'w0')   # the front upright, inside
    roll = cpx.ell_mask(SW, SH, cx + 16, oy - 9, 13, 6) & door
    s.ix[roll] = ix('s2')
    s.ix[roll & (yy < oy - 12)] = ix('s3')
    s.ix[roll & (yy > oy - 6)] = ix('s1')
    # the jambs: a lit lip on the left, a dark lap on the right
    s.ix[nb(door & ~nb(door, -1, 0), 1, 0) & m_g & ~door] = ix('b4')
    s.ix[nb(door & ~nb(door, 1, 0), -1, 0) & m_g & ~door] = ix('b1')
    # the right flap hangs loose over the doorway's east side
    flap = cpx.poly_mask(SW, SH, [(cx + 3, top + 3), (cx + dwb + 2, oy - 2), (cx + dwb - 13, oy - 2), (cx + 5, top + 30)]) & m_g
    s.ix[flap] = ix('b2')
    s.ix[flap & (xx < cx + 7 + (yy - top) * .16)] = ix('b3')
    s.ix[flap & ~nb(flap, -1, 0)] = ix('b1')
    s.ix[flap & (yy > oy - 6)] = ix('d4')
    # the left flap: rolled and tied, a fat bundle down the west jamb
    for i in range(int(oy - top - 30)):
        y = oy - 4 - i
        x = cx - dwb * .7 - 3 + i * ((dwb * .7) / (oy - top)) - 2
        w = 7 + 2.0 * math.sin(i * .45) ** 2
        for k in range(int(w)):
            put(s, x + k - 1, y, 'b4' if k < 2 else ('b3' if k < w - 3 else 'b2'))
        put(s, x - 2, y, 'b1')
        put(s, x + int(w) - 1, y, 'b1')
    for ty_ in (oy - 20, oy - 52):
        tx_ = cx - dwb * .7 - 3 + (oy - 4 - ty_) * ((dwb * .7) / (oy - top)) - 4
        for k in range(11):
            put(s, tx_ + k, ty_, 'h3'); put(s, tx_ + k, ty_ + 1, 'h1')

    # ------------------------------------------------ outline: warm dark, lighter b1 on edges facing the sun
    body = m_g | m_w | m_e
    rg = cpx.ring(np.pad(body, 1), 4)[1:-1, 1:-1]
    upl = rg & (nb(body, 1, 0) | nb(body, 0, 1)) & ~nb(body, -1, 0) & ~nb(body, 0, -1)
    s.ix[rg] = ix('d1')
    s.ix[upl & (yy < oy - 6)] = ix('b1')
    # the gable's edges against the slopes: a dark fold line (the canvas turns the corner)
    ge = m_g & ~(nb(m_g, 1, 0) & nb(m_g, -1, 0) & nb(m_g, 0, -1)) & (yy < oy - 3)
    s.ix[ge & (gW < 2)] = ix('b2')
    s.ix[ge & (gE < 2)] = ix('b1')

    # ------------------------------------------------ poles: the uprights' tops and the ridge pole's ends
    def upright(p, h):
        x0, y0 = int(round(p[0])), int(round(p[1]))
        for y in range(y0 - h, y0 + 2):
            put(s, x0 - 2, y, 'w0'); put(s, x0 - 1, y, 'w5'); put(s, x0, y, 'w4'); put(s, x0 + 1, y, 'w2'); put(s, x0 + 2, y, 'w0')
        for x in range(x0 - 2, x0 + 3):
            put(s, x, y0 - h - 1, 'w0')
        put(s, x0 - 1, y0 - h, 'd5'); put(s, x0, y0 - h, 'd4')
    upright(B, 14)
    # the ridge pole's cut end, proud of the front gable just under the upright's top
    END = [".kkk.", "k654k", "k5d4k", "k443k", ".kkk."]
    for j, r in enumerate(END):
        for i, ch in enumerate(r):
            if ch != '.':
                put(s, A[0] - 2 + i, A[1] - 1 + j, {'k': 'w0', '6': 'd6', '5': 'd5', '4': 'd4', '3': 'd3', 'd': 'd3'}[ch])

    # ------------------------------------------------ guy ropes and pegs
    pegs = []
    def rope(x0, y0, x1, y1, sagpx=2):
        L = int(max(abs(x1 - x0), abs(y1 - y0)))
        prev = None
        for k in range(L + 1):
            t = k / L
            q = (int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t + sagpx * math.sin(math.pi * t))))
            if q != prev:
                put(s, q[0], q[1], 'h3' if not body[q[1], q[0]] else 'h2')
            prev = q
        pegs.append((int(round(x1)), int(round(y1))))
    for t in (.45,):                                             # side lines off the eaves, mid-length
        pW = FL + Dv * t + (A - FL) * .1
        pE = FR + Dv * t + (A - FR) * .1
        rope(pW[0], pW[1], pW[0] - 44, pW[1] + 18, 1)
        rope(pE[0], pE[1], pE[0] + 48, pE[1] + 18, 1)
        for (q, sx) in ((pW, -1), (pE, 1)):
            put(s, q[0], q[1], 'h1'); put(s, q[0] - sx, q[1], 'b1')
    rope(B[0] + 3, B[1] - 11, FRb[0] + 56, FRb[1] + 8, 3)       # back upright off to the east
    rope(B[0] - 3, B[1] - 11, FLb[0] - 44, FLb[1] + 6, 3)       # and to the west
    for (px, py) in pegs:
        for j in range(-7, 2):
            put(s, px - 2, py + j, 'w0'); put(s, px - 1, py + j, 'w5' if j < -4 else 'w4'); put(s, px, py + j, 'w3'); put(s, px + 1, py + j, 'w0')
        for x in range(px - 2, px + 2):
            put(s, x, py - 8, 'w0')
        put(s, px - 1, py - 7, 'd5'); put(s, px, py - 7, 'd4')
    # hem pegs through the loops along the foot of the gable and the eaves
    for t in (0, 1 / 3, 2 / 3, 1):
        px, py = FR[0] + (FL[0] - FR[0]) * t, oy + 1
        for j in range(-2, 3):
            put(s, px - 1, py + j, 'w0'); put(s, px, py + j, 'w4'); put(s, px + 1, py + j, 'w0')

    def rel(p):
        return (float(p[0] - s.ax), float(p[1] - s.ay))
    Hb = Hg + 16
    gA = (FL + FR) / 2
    sh = [rel(FL), rel(FR), rel(FRb)]
    shadow = [rel(FL), rel(gA + (cpx.SX * Hb, cpx.SY * Hb)), rel(gA + Dv + (cpx.SX * Hb, cpx.SY * Hb)), rel(FRb), rel(FR)]
    return s, dict(footprint=[rel(FL), rel(FR), rel(FRb), rel(FLb)], shadow=shadow,
                   pegs=[(px - s.ax, py - s.ay) for px, py in pegs], door=(float(cx - s.ax), 0.0),
                   apex=rel(A), back=rel(B))


if __name__ == '__main__':
    from PIL import Image
    s, info = tent()
    bg = np.full((s.h, s.w), ix('g5'), np.uint8)
    m = s.ix != CLEAR
    bg[m] = s.ix[m]
    im = Image.fromarray(cpx.to_rgba(bg), 'RGBA')
    im.save('t/tent.png')
    im.resize((s.w * 3, s.h * 3), Image.NEAREST).save('t/tent3x.png')
    print(s.w, s.h, info['apex'], info['back'])
