"""Frontier Camp's larger props at camp scale (78 px per metre across, PxCamp's oblique view, light from the upper
left), each an indexed Sprite with its foot anchor and a selout-style outline in its own ramps' dark steps.

  wagon()        a covered wagon broadside: 3 m bed on two axles, wheels 1.08 m across (0.6 of a person) with iron
                 tyres, felloes, twelve spokes and a hub; the far wheels' rims under the bed; the canvas tilt on
                 five hoops, sagging between them, its top lit, its front pucker open; the tongue resting on the ground
  wheel(r)       a hand-stepped spoked wheel
  crate(), barrel(), fingerpost()
"""
import math
import random

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, K, nb, put, get
from pxworld import build as B

M = 78.0
LIGHT = np.array([-.6, -.7, .4])
LIGHT /= np.linalg.norm(LIGHT)


def _selout(s):
    s2 = s.padded(1)
    B.selout(s2, lit=True)
    return s2


def wheel(r=42, spokes=12, rim=7, hub=8, seed=0, far=False):
    """A spoked wheel seen side-on. Pixels are tested at their centres against the circles, so the rim's runs step
    evenly round the curve. Iron tyre (Slate) outside, wooden felloes, spokes lit on the side facing the light."""
    W = 2 * r + 4
    s = cpx.new(W, W, W // 2, W // 2)
    c = W / 2
    yy, xx = np.mgrid[0:W, 0:W].astype(float) + .5
    d = np.hypot(xx - c, yy - c)
    ang = np.arctan2(yy - c, xx - c)
    lit = np.cos(ang - math.radians(225)) > .35         # the rim's upper-left quarter faces the sun
    shade = np.cos(ang - math.radians(45)) > .45
    tyre = (d <= r) & (d > r - 2.2)
    fel = (d <= r - 2.2) & (d > r - rim)
    t = np.full((W, W), CLEAR, np.uint8)
    if far:
        t[tyre] = ix('t1'); t[fel] = ix('w2')
    else:
        t[tyre] = ix('t3'); t[tyre & lit] = ix('t5'); t[tyre & shade] = ix('t2')
        t[fel] = ix('w4'); t[fel & lit] = ix('w5'); t[fel & shade] = ix('w3')
        # felloe joints
        for k in range(6):
            a0 = 2 * math.pi * k / 6 + .26
            jm = fel & (np.abs(((ang - a0 + math.pi) % (2 * math.pi)) - math.pi) < .035)
            t[jm] = ix('w2')
    # spokes
    for k in range(spokes):
        a0 = 2 * math.pi * k / spokes + .13
        dist = np.abs(np.sin(ang - a0)) * d
        sm = (dist < 1.7) & (np.cos(ang - a0) > 0) & (d < r - rim + .5) & (d > hub - .5)
        if far:
            t[sm] = ix('w2')
        else:
            t[sm] = ix('w4')
            t[sm & (np.sin(ang - a0) * d < -.3)] = ix('w5')
            t[sm & (np.sin(ang - a0) * d > .6)] = ix('w3')
    hb = d <= hub
    if far:
        t[hb] = ix('w1')
    else:
        t[hb] = ix('w3'); t[hb & (d < hub - 2.5)] = ix('t3'); t[(d < 2.2)] = ix('t1')
        t[hb & (d < hub - 2.5) & (xx < c - 1) & (yy < c - 1)] = ix('t5')
    s.ix[:] = t
    m = s.ix != CLEAR
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    # the outline round the outside only, a dark ring
    outer = rg & (d > r - 1)
    s.ix[outer] = ix('t1' if not far else 'w0')
    # the dark gaps between spokes are see-through (clear)
    return s


def wagon(seed=4):
    """Returns (Sprite, info). Anchor = the middle of the bed's footprint on the ground (between the near wheels)."""
    rng = random.Random(seed)
    L = int(3.0 * M)                 # bed length
    D = (8, -26)                     # the wagon's width seen in the oblique (back and a little right)
    bed_bot, bed_top = int(.74 * M), int(1.2 * M)
    tilt_top = int(2.35 * M)
    r = int(1.08 * M / 2)
    padL, padR, padT = 30, 130, 20
    W = padL + L + padR
    H = tilt_top + padT + 20
    s = cpx.new(W, H, padL + L // 2, H - 10)
    gx = s.ay                        # ground row
    x0 = padL
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    # ---- the far wheels (under the bed, offset by D), the undercarriage
    for wx in (x0 + 40, x0 + L - 46):
        fw = wheel(r, far=True)
        s.blit(fw, wx + D[0] - fw.w // 2, gx - r + D[1] - fw.h // 2)
    for x in range(x0 + 34, x0 + L - 30):                       # the reach pole between the axles
        for j in range(6):
            put(s, x, gx - r - 4 + j + D[1] // 2, 'w2' if j < 2 else 'w1')
    # ---- the tongue: from the front axle forward and down to the ground, a crossbar at its end
    fx0, fy0 = x0 + L - 46, gx - r + 2
    fx1, fy1 = x0 + L + 118, gx - 4
    n = int(math.hypot(fx1 - fx0, fy1 - fy0))
    for k in range(n):
        f = k / n
        cx, cy = fx0 + (fx1 - fx0) * f, fy0 + (fy1 - fy0) * f
        for j in range(-3, 4):
            put(s, cx, cy + j, 'w5' if j < -1 else ('w4' if j < 2 else 'w2'))
    for j in range(-14, 15):                                     # the doubletree across its end
        for i in range(4):
            put(s, fx1 - 6 + i + j * .2, fy1 - 2 + j * .25, 'w4' if i < 2 else 'w2')
    # ---- the bed: a box of planks, its near side broadside, its top edge lit; the floor's front showing
    for y in range(gx - bed_top, gx - bed_bot + 1):
        for x in range(x0, x0 + L):
            k = (y - (gx - bed_top))
            plank = k // 9
            v = k % 9
            lv = 4 + (1 if v == 0 else (-1 if v == 8 else 0)) - (plank % 2 == 1) * 0
            if k < 3:
                lv = 6
            put(s, x, y, K('w', lv))
    # the bed's top rail and the uprights (stakes) along its side
    for x in range(x0, x0 + L):
        put(s, x, gx - bed_top, 'w6'); put(s, x, gx - bed_top + 1, 'w5')
    for k in range(6):
        ux = x0 + 6 + int(k * (L - 16) / 5)
        for y in range(gx - bed_top, gx - bed_bot + 1):
            put(s, ux, y, 'w5'); put(s, ux + 1, y, 'w5'); put(s, ux + 2, y, 'w4'); put(s, ux + 3, y, 'w2')
    # iron bands at the corners
    for ux in (x0 + 1, x0 + L - 7):
        for y in range(gx - bed_top + 4, gx - bed_bot - 2):
            for i in range(6):
                put(s, ux + i, y, 't4' if i < 2 else 't3')
    # the bed's end (the front, east) seen at an angle: a narrow face to the right, shaded
    for y in range(gx - bed_top, gx - bed_bot + 1):
        for i in range(D[0]):
            put(s, x0 + L + i, y - int(i * (-D[1]) / D[0]), 'w3' if (y - gx) % 9 else 'w2')
    # ---- the canvas tilt: a half-cylinder of canvas on five hoops, its axis along the bed. A point at angle th round
    # the hoop (0 = the near side at the rail, 90 = the crown) stands R sin(th) above the rail and R (1 - cos th) back
    # in depth; the oblique turns depth into a shift up and right. Tones by the angle: the near side in the middle
    # steps, the shoulder lit, the crown the lightest; a dark band at the rail where the canvas tucks under the rope.
    hoops = [x0 + 6 + int(k * (L - 12) / 4) for k in range(5)]
    Rt = .78 * M
    per_m = (-D[1]) / 1.5                       # oblique px per metre of depth (up)
    per_mx = D[0] / 1.5
    rail = gx - bed_top + 1
    flare = 11
    def sag_at(x):
        best = min(abs(x - hx) for hx in hoops)
        return 3.2 * math.sin(min(1.0, best / ((L - 12) / 8)) * math.pi / 2)
    cols = {}
    for x in range(x0 - flare, x0 + L + flare):
        if x < x0:
            fe = (x0 - x) / flare
        elif x >= x0 + L:
            fe = (x - (x0 + L) + 1) / flare
        else:
            fe = 0.0
        for th_i in range(0, 1040):
            th = math.radians(th_i / 10)
            Rr = Rt * (1 - .04 * fe)
            hgt = Rr * math.sin(th)
            dep = Rt / M * (1 - math.cos(th))
            y = rail - hgt - dep * per_m + (sag_at(min(max(x, x0), x0 + L - 1)) * math.sin(th) ** 6 if fe == 0 else 0)
            xx_ = x + dep * per_mx
            # the flared ends only show their upper part (the bow leans out over the bed's end)
            if fe > 0 and hgt < Rr * fe * 1.05:
                continue
            deg = th_i / 10
            if deg < 7:
                key = 'b2'
            elif deg < 34:
                key = 'b3'
            elif deg < 66:
                key = 'b4'
            else:
                key = 'b5'
            if fe > .55:
                key = 'b3' if x < x0 else 'b2'
            put(s, xx_, y, key)
    # the hoops: a raised band over each, lit on its west lip, shaded east, following the curve
    for hx in hoops:
        for th_i in range(60, 1030, 4):
            th = math.radians(th_i / 10)
            hgt = Rt * math.sin(th)
            dep = Rt / M * (1 - math.cos(th))
            y = rail - hgt - dep * per_m
            xx_ = hx + dep * per_mx
            put(s, xx_ - 1, y, 'b5'); put(s, xx_, y, 'b5' if th_i > 300 else 'b4'); put(s, xx_ + 1, y, 'b2')
    # creases where the canvas sags between hoops: short soft folds on the near side
    for k in range(4):
        cx = (hoops[k] + hoops[k + 1]) // 2
        for (dx, key) in ((-10, 'b4'), (-9, 'b2'), (9, 'b4'), (10, 'b2')):
            for th_i in range(110, 520, 10):
                th = math.radians(th_i / 10)
                hgt = Rt * math.sin(th)
                dep = Rt / M * (1 - math.cos(th))
                put(s, cx + dx + dep * per_mx, rail - hgt - dep * per_m, key)
    # the rope along the rail and the tie-downs at each hoop
    for x in range(x0 - 2, x0 + L + 2):
        put(s, x, rail, 'h3'); put(s, x, rail + 1, 'h1')
    for hx in hoops:
        for j_ in range(7):
            put(s, hx + 2, rail + j_, 'h3' if j_ % 2 else 'h2')
    # the front pucker: the drawn-up opening on the east end, dark inside, the canvas gathered round it
    px_, py_ = x0 + L + 7, int(rail - Rt * .62)
    for j_ in range(-16, 17):
        w_ = int(round(4 * math.sqrt(max(0, 1 - (j_ / 16) ** 2))))
        for i_ in range(-w_, w_ + 1):
            put(s, px_ + i_, py_ + j_, 'w0' if abs(i_) < w_ - 1 else 'w1')
        if j_ % 4 == 0:
            put(s, px_ - w_ - 1, py_ + j_, 'b4'); put(s, px_ + w_ + 1, py_ + j_, 'b2')
    # ---- the near wheels last
    for wx in (x0 + 40, x0 + L - 46):
        nw = wheel(r, seed=wx)
        s.blit(nw, wx - nw.w // 2, gx - r - nw.h // 2)
    s = _selout(s)
    info = dict(wheels=[(x0 + 40 + 1 - (padL + L // 2 + 1), 0), (x0 + L - 46 + 1 - (padL + L // 2 + 1), 0)])
    return s, info


def crate(w=56, h=46, d=(10, -18), seed=0):
    """A plank crate: its front face broadside (horizontal boards, corner battens), its top lit, its west... the
    oblique shows the top and the east end. Anchor = the front face's foot middle."""
    rng = random.Random(seed)
    W, H = w + d[0] + 6, h - d[1] + 6
    s = cpx.new(W, H, 3 + w // 2, H - 4)
    base = H - 4
    x0 = 3
    # the top
    for j in range(-d[1]):
        for i in range(w):
            x = x0 + i + int(j * d[0] / -d[1])
            put(s, x, base - h - j, 'd6' if (i + j // 3) % 14 else 'd5')
    # the east end
    for i in range(d[0]):
        for y in range(base - h - int(i * -d[1] / d[0]), base + 1 - int(i * -d[1] / d[0])):
            put(s, x0 + w + i, y, 'w3' if (y % 9) else 'w2')
    # the front: boards
    for y in range(base - h, base + 1):
        k = y - (base - h)
        v = k % 11
        for i in range(w):
            lv = 5 if v == 0 else (3 if v == 10 else 4)
            put(s, x0 + i, y, K('w', lv))
    for (bx, bw) in ((0, 6), (w - 6, 6)):
        for y in range(base - h, base + 1):
            for i in range(bw):
                put(s, x0 + bx + i, y, 'w5' if i < 2 else ('w4' if i < 4 else 'w2'))
    for (cx, cy) in ((x0 + 3, base - h + 4), (x0 + w - 3, base - h + 4), (x0 + 3, base - 4), (x0 + w - 3, base - 4)):
        put(s, cx, cy, 't2'); put(s, cx - 1, cy - 1, 't5')
    # the diagonal brace
    for t in range(w - 12):
        x = x0 + 6 + t
        y = base - 4 - int(t * (h - 8) / (w - 12))
        put(s, x, y, 'w5'); put(s, x, y + 1, 'w4'); put(s, x, y + 2, 'w2')
    return _selout(s)


def barrel(h=70, w=48, seed=0):
    """A coopered barrel standing: bulging staves (lit west, shaded east), three iron hoops, the head seen from above
    (an ellipse with its boards), a bung. Anchor = foot middle."""
    W, H = w + 6, h + 18
    s = cpx.new(W, H, W // 2, H - 4)
    base = H - 4
    cx = W / 2
    lid = int(w * .26)
    for y in range(base - h, base + 1):
        t = (y - (base - h)) / h
        bul = 1 - .08 * (2 * t - 1) ** 2 * -1 - .08
        half = w / 2 * (1 - .1 * (2 * t - 1) ** 2)
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x + .5 - cx) / half
            lv = 6 if u < -.65 else (5 if u < -.25 else (4 if u < .35 else (3 if u < .75 else 2)))
            put(s, x, y, K('w', lv))
        # staves: seams every 7 px
        for x in range(int(cx - half) + 4, int(cx + half) - 2, 7):
            v = get(s, x, y)
            if v != CLEAR:
                s.ix[y, x] = pal.shift_index(v, -2)
    for ht in (.12, .5, .88):
        y = int(base - h + ht * h)
        half = w / 2 * (1 - .1 * (2 * ht - 1) ** 2)
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x + .5 - cx) / half
            for j in range(4):
                put(s, x, y + j, ('t5' if u < -.3 else ('t4' if u < .4 else 't3')) if j < 3 else 't2')
    # the head: an ellipse seen from above
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    hm = cpx.ell_mask(W, H, cx, base - h, w / 2 * .9, lid / 2, xx, yy)
    s.ix[hm] = ix('d5')
    s.ix[hm & cpx.ell_mask(W, H, cx + 2, base - h + 1, w / 2 * .9 - 2, lid / 2 - 1.5, xx, yy) & (xx > cx - 6)] = ix('d4')
    for k in (-8, 0, 8):
        s.ix[hm & (np.abs(xx - cx - k) < .6)] = ix('d3')
    rim = hm & ~cpx.ell_mask(W, H, cx, base - h, w / 2 * .9 - 2, lid / 2 - 1.5, xx, yy)
    s.ix[rim] = ix('w4')
    s.ix[rim & (yy > base - h)] = ix('w3')
    put(s, cx + 6, base - h * .55, 'w1'); put(s, cx + 7, base - h * .55, 'w1')
    return _selout(s)


def fingerpost(h=176, seed=0):
    """A fingerpost at the fork outside the gate: a squared post, three arms pointing east (north-east, east,
    south-east: the three roads out of camp), each arm a board with a pointed end, its edge lit. No lettering at
    this size, only the painted tick marks of the names."""
    W, H = 110, h + 12
    s = cpx.new(W, H, 14, H - 4)
    base = H - 4
    px0 = 10
    pw = 10
    for y in range(base - h, base + 1):
        for i in range(pw):
            put(s, px0 + i, y, 'w5' if i < 3 else ('w4' if i < 7 else 'w2'))
    for i in range(pw):
        put(s, px0 + i, base - h, 'd6')
        put(s, px0 + i, base - h - 1, 'w4')
    put(s, px0 + 4, base - h - 2, 'w4'); put(s, px0 + 5, base - h - 2, 'w4')
    arms = [(base - h + 14, -9), (base - h + 40, 0), (base - h + 66, 8)]     # (y, rise over its length)
    for (ay, rise) in arms:
        L = 82
        for k in range(L):
            x = px0 + pw - 2 + k
            yc = ay - rise * k / L
            thick = 13
            tip = L - k
            if tip < 8:
                thick = int(13 * tip / 8)
            for j in range(thick):
                y = int(round(yc - thick / 2 + j + (13 - thick) / 2))
                key = 'w6' if j == 0 else ('w5' if j < 4 else ('w4' if j < thick - 2 else 'w2'))
                put(s, x, y, key)
            if 10 < k < L - 14 and k % 5 in (0, 1, 2) and (k // 5) % 3 != 2:
                put(s, x, int(round(yc)), 'w2')          # the painted names, a row of ticks
    # earth heaped at its foot
    for x in range(px0 - 4, px0 + pw + 5):
        put(s, x, base, 'd3'); put(s, x, base - 1, 'd4' if x < px0 + 4 else 'd3')
    return _selout(s)


def tripod_legs(span=150, h=118, seed=0):
    """Three poles lashed at the head over the fire: two splayed either side, seen broadside, one leaning back
    (shorter on screen). Returns (back leg Sprite, front legs Sprite, head (dx, dy) from the anchor). Anchor = the
    middle of the ring on the ground."""
    W, H = span + 16, h + 12
    def pole(s, x0, y0, x1, y1, th=5, tones=('w5', 'w4', 'w2')):
        n = int(max(abs(x1 - x0), abs(y1 - y0)))
        for k in range(n + 1):
            f = k / n
            cx, cy = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
            for j in range(th):
                key = tones[0] if j == 0 else (tones[2] if j == th - 1 else tones[1])
                put(s, cx - th // 2 + j, cy, key)
    back = cpx.new(W, H, W // 2, H - 4)
    front = cpx.new(W, H, W // 2, H - 4)
    hx, hy = back.ax + 4, back.ay - h
    pole(back, back.ax + 10, back.ay - 30, hx, hy, 4, ('w4', 'w3', 'w1'))
    pole(front, front.ax - span // 2, front.ay + 2, hx, hy)
    pole(front, front.ax + span // 2, front.ay - 2, hx + 2, hy)
    for j in range(6):                                  # the lashing at the head
        for i in range(-4, 6):
            put(front, hx + i, hy + 2 + j, 'h3' if (i + j) % 3 else 'h2')
    for s in (back, front):
        m = s.ix != CLEAR
        rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
        s.ix[rg] = ix('w0')
    return back, front, (hx - back.ax + 1, hy - back.ay + 6)


def pot(w=40, h=30):
    """An iron cookpot on a chain: a dark round belly lit on its upper left (Stone ramp's dark end), a rim, a bail
    handle, the chain up to the tripod's head. Anchor = the bail's top."""
    W, H = w + 6, h + 10
    s = cpx.new(W, H, W // 2, 1)
    cx = W / 2
    top = 8
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    belly = cpx.ell_mask(W, H, cx, top + h * .45, w / 2, h * .55, xx, yy) & (yy > top + 2)
    s.ix[belly] = ix('t1')
    s.ix[belly & cpx.ell_mask(W, H, cx - w * .14, top + h * .32, w * .3, h * .26, xx, yy)] = ix('t2')
    s.ix[belly & cpx.ell_mask(W, H, cx - w * .2, top + h * .25, w * .12, h * .1, xx, yy)] = ix('t4')
    for x in range(int(cx - w / 2) + 1, int(cx + w / 2)):
        put(s, x, top + 2, 't3'); put(s, x, top + 3, 't2')
    # the bail: an arc over the rim
    for k in range(0, 181, 4):
        a = math.radians(k)
        put(s, cx + math.cos(a) * (w / 2 - 2), top + 2 - math.sin(a) * 7, 't3')
    m = s.ix != CLEAR
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    s.ix[rg] = ix('t0')
    return s
