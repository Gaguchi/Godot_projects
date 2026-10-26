"""A bedroll laid out on the ground, ready for whoever rests: a canvas pad, a slate wool blanket with its head
end turned back, a rolled pillow, a leather strap undone. Seen from above at the camp's angle, lit from the
upper left. Also a rolled bedroll and a sack, for the tent's side."""
import math
import random

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, K, new, put, get, nb


def _ring_outline(s, m, dark_by_ramp, lit_key=None):
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    src = s.ix.copy()
    for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
        v = nb(src, dx, dy, CLEAR)
        pick = rg & (v != CLEAR) & (s.ix == CLEAR)
        for i in np.unique(v[pick]):
            s.ix[pick & (v == i)] = ix(dark_by_ramp.get(pal.RAMP_OF[i], 'w0'))
    if lit_key:
        upl = rg & (nb(m, 1, 0) | nb(m, 0, 1)) & ~nb(m, -1, 0) & ~nb(m, 0, -1)
        s.ix[upl] = ix(lit_key)


def bedroll(L=124, D=26, seed=2):
    """Anchor = the middle of its front (south) edge on the ground."""
    rng = random.Random(seed)
    W, H = L + 30, D + 26
    s = new(W, H, W // 2, H - 5)
    x0, y1 = 14, H - 5                     # front-left corner on the ground
    y0 = y1 - D                            # back edge
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    # the pad: canvas, a little wider than the blanket, its front edge showing its thickness
    pad = (xx >= x0) & (xx < x0 + L) & (yy >= y0) & (yy < y1)
    for (qx, qy) in ((x0, y0), (x0 + L - 1, y0), (x0, y1 - 1), (x0 + L - 1, y1 - 1)):
        corner = (np.abs(xx - qx) < 4) & (np.abs(yy - qy) < 4)
        pad &= ~(corner & (((xx - (qx + (3.5 if qx == x0 else -3.5))) ** 2 + (yy - (qy + (3.5 if qy == y0 else -3.5))) ** 2) > 12.5)
                 & (((xx - qx) * (1 if qx == x0 else -1) < 3.5) & ((yy - qy) * (1 if qy == y0 else -1) < 3.5)))
    s.ix[pad] = ix('b2')
    s.ix[pad & (yy >= y1 - 3)] = ix('b1')
    s.ix[pad & (yy < y0 + 2)] = ix('b3')
    # the blanket: from a little east of the pillow to the foot, its head end turned back in a lit fold
    bx0, bx1 = x0 + 30, x0 + L - 2
    blk = (xx >= bx0) & (xx < bx1) & (yy >= y0 - 1 + .8 * np.sin(xx * .21)) & (yy < y1 + 1 + 1.4 * np.sin(xx * .33) + .8 * np.sin(xx * .9))
    blk &= ~((xx > bx1 - 4) & ((yy < y0 + 2) | (yy > y1 - 1)))
    blk = cpx.clean(blk, 3)
    s.ix[blk] = ix('s3')
    u = (yy - y0) / D
    s.ix[blk & (u < .25)] = ix('s4')                        # the top surface toward the light
    s.ix[blk & (u > .72)] = ix('s2')                        # the front edge falls away
    s.ix[blk & (yy >= y1 - 3)] = ix('s1')
    # creases: long soft diagonals, each a shade line with a lit lip above it
    for (cx0, cy0, ln, sl) in ((bx0 + 20, y0 + 6, 34, .18), (bx0 + 52, y0 + 14, 30, -.14), (bx0 + 70, y0 + 5, 24, .22), (bx0 + 18, y0 + 17, 22, -.1)):
        for k in range(ln):
            px, py = int(cx0 + k), int(round(cy0 + k * sl + 1.2 * math.sin(k * .3)))
            if blk[py, px] and blk[py - 1, px]:
                s.ix[py, px] = ix('s2')
                if k < ln * .7:
                    s.ix[py - 1, px] = ix('s4') if py - 1 < y0 + D * .5 else ix('s3')
    # an ochre stripe woven across near the foot
    for x in range(bx1 - 20, bx1 - 16):
        for y in range(int(y0) - 2, y1 - 1):
            if blk[y, x]:
                s.ix[y, x] = ix('o3') if y < y1 - 6 else ix('o2')
    # the turned-back head of the blanket: a lit roll lying across
    for y in range(int(y0) - 2, y1 - 1):
        for k in range(6):
            x = bx0 + k + int(.6 * math.sin(y * .5))
            key = 's5' if k < 2 else ('s4' if k < 4 else 's2')
            put(s, x, y, key)
    # the pillow: a canvas roll lying north-south at the head, a strap round it
    pc = (x0 + 15, (y0 + y1) / 2 - 3)
    pil = cpx.ell_mask(W, H, pc[0], pc[1], 12, D * .5, xx, yy)
    s.ix[pil] = ix('b3')
    s.ix[pil & (xx < pc[0] - 4)] = ix('b4')
    s.ix[pil & (xx > pc[0] + 6)] = ix('b2')
    s.ix[pil & (yy > pc[1] + D * .32)] = ix('b1')
    for y in range(int(pc[1] - D * .5), int(pc[1] + D * .5) + 1):
        if pil[y, int(pc[0] + 1)]:
            put(s, pc[0], y, 'w4'); put(s, pc[0] + 1, y, 'w3')
    # the strap, undone, trailing off the front edge
    for k in range(12):
        put(s, bx1 - 8 + k * .5, y1 - 1 + k * .25, 'w3'); put(s, bx1 - 8 + k * .5, y1 + k * .25, 'w2')
    put(s, bx1 - 2, y1 + 3, 't5'); put(s, bx1 - 1, y1 + 3, 't4')
    m = s.ix != CLEAR
    _ring_outline(s, m, {'b': 'd1', 's': 's0', 'w': 'w0', 'o': 'o0', 't': 't0'})
    return s


def sack(w=24, h=28, seed=1):
    """A full grain sack slumped on its base: a round belly that spreads where it sits, a gathered neck tied
    with cord, the mouth's ruffle flopping over. Wheat ramp, lit on its upper west, outline h0. Anchor = base."""
    rng = random.Random(seed)
    W, H = w + 12, h + 10
    s = new(W, H, W // 2, H - 4)
    cx, base = W / 2 - .5, H - 4
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    # belly: an ellipse squashed onto the ground, flattened at the bottom
    bcy = base - h * .36
    belly = cpx.ell_mask(W, H, cx, bcy, w / 2 + .5, h * .4, xx, yy) & (yy <= base)
    belly |= cpx.ell_mask(W, H, cx + .5, base - 2.5, w / 2 + 1.5, 3.2, xx, yy) & (yy <= base)
    # neck, gathered, leaning a little east
    nk = cpx.ell_mask(W, H, cx + 1.5, base - h * .78, w * .2, h * .12, xx, yy)
    ruff = cpx.ell_mask(W, H, cx + 3, base - h * .93, w * .24, h * .09, xx, yy)
    m = belly | nk | ruff
    m = cpx.clean(m, 3)
    gx, gy = (xx - cx) / (w / 2), (yy - bcy) / (h * .4)
    lightv = -.6 * gx - .7 * gy
    tone = np.full((H, W), ix('h3'), np.uint8)
    tone[lightv > .25] = ix('h4')
    tone[lightv > .75] = ix('h5')
    tone[lightv < -.35] = ix('h2')
    tone[yy > base - 2] = ix('h1')
    tone[nk] = ix('h2')
    tone[ruff] = ix('h3')
    tone[ruff & (xx < cx + 2)] = ix('h4')
    # the cord round the neck
    ny = int(round(base - h * .8))
    for x in range(int(cx - 3), int(cx + 7)):
        if m[ny, x]:
            tone[ny, x] = ix('w3')
            if m[ny + 1, x]:
                tone[ny + 1, x] = ix('w2')
    # creases where the cloth bunches toward the neck
    for (x0, y0, dx) in ((cx - 4, base - h * .62, 1), (cx + 4, base - h * .6, -1), (cx - 7, base - h * .35, 1)):
        for k in range(5):
            px, py = int(x0 + dx * k * .6), int(y0 - k * .9)
            if m[py, px]:
                tone[py, px] = pal.shift_index(int(tone[py, px]), -1)
    s.ix[m] = tone[m]
    _ring_outline(s, m, {'h': 'h0', 'w': 'w0'})
    return s


def bedroll2(L=118, D=30, seed=2):
    """A bedroll laid out east-west, ready for whoever rests: a canvas pad with slack edges, a slate wool
    blanket over it with its head corner turned back, a rolled moss-green cloak for a pillow. The top faces
    the sky, lit toward the upper left; the near edge shows the pad's thickness. Anchor = middle of the near
    edge on the ground."""
    rng = random.Random(seed)
    W, H = L + 24, D + 20
    s = new(W, H, W // 2, H - 6)
    x0, y1 = 12, H - 6
    y0 = y1 - D
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5

    def rrect(ax0, ay0, ax1, ay1, r):
        m = (xx >= ax0) & (xx < ax1) & (yy >= ay0) & (yy < ay1)
        for (qx, qy, sx, sy) in ((ax0 + r, ay0 + r, -1, -1), (ax1 - r, ay0 + r, 1, -1), (ax0 + r, ay1 - r, -1, 1), (ax1 - r, ay1 - r, 1, 1)):
            cor = ((xx - qx) * sx > 0) & ((yy - qy) * sy > 0)
            m &= ~(cor & ((xx - qx) ** 2 + (yy - qy) ** 2 > r * r))
        return m
    pad = rrect(x0, y0, x0 + L, y1, 4.5)
    pad &= ~((yy > y1 - 2) & (np.sin(xx * .35) > .5))            # slack along the near edge
    tone = np.full((H, W), ix('b2'), np.uint8)
    tone[yy < y0 + 3] = ix('b3')
    tone[yy > y1 - 4] = ix('b1')
    # the blanket: from past the pillow to the foot, its near edge drooping over the pad's
    bx0 = x0 + 30
    droop = 1.4 + 1.2 * np.sin(xx * .29 + 1) + .7 * np.sin(xx * .83)
    blk = rrect(bx0, y0 - 1, x0 + L - 2, y1 + 1, 4) & (yy < y1 - 1 + droop)
    # the head corner turned back: a triangle of the blanket's lighter underside folded over
    fold = blk & ((xx - bx0) + (yy - y0) * .9 < 24) & (xx >= bx0)
    u = (yy - y0) / D
    bt = np.full((H, W), ix('s3'), np.uint8)
    bt[u < .3] = ix('s4')
    bt[u > .78] = ix('s2')
    bt[yy > y1 - 1] = ix('s1')
    # creases: long soft diagonals, a shade line with a lit lip above
    for (cx0, cy0, ln, sl) in ((bx0 + 30, y0 + 7, 30, .2), (bx0 + 54, y0 + 16, 28, -.16), (bx0 + 66, y0 + 6, 18, .24), (bx0 + 36, y0 + 20, 20, -.08)):
        for k in range(ln):
            px, py = int(cx0 + k), int(round(cy0 + k * sl + 1.1 * math.sin(k * .3)))
            if blk[py, px] and blk[py - 1, px] and not fold[py, px]:
                bt[py, px] = ix('s2')
                if k < ln * .75:
                    bt[py - 1, px] = ix('s4') if u[py - 1, px] < .5 else ix('s3')
    # a woven ochre stripe across the foot
    stripe = blk & (xx >= x0 + L - 22) & (xx < x0 + L - 18)
    bt[stripe] = ix('o3')
    bt[stripe & (u > .75)] = ix('o2')
    # the fold: lit underside, a dark line where it turns
    bt[fold] = ix('s4')
    bt[fold & (((xx - bx0) + (yy - y0) * .9) > 20)] = ix('s5')
    edgef = fold & ~nb(fold, 1, 0)
    bt[edgef] = ix('s2')
    tone[blk] = bt[blk]
    # the pillow: a rolled moss cloak at the head, folds wound round it
    pc = (x0 + 16, y0 + D * .45)
    pil = cpx.ell_mask(W, H, pc[0], pc[1], 13, D * .44, xx, yy)
    pt = np.full((H, W), ix('m3'), np.uint8)
    pt[(xx - pc[0]) * .5 + (yy - pc[1]) < -3] = ix('m4')
    pt[(xx - pc[0]) * .5 + (yy - pc[1]) > 5] = ix('m2')
    for k in (-6, 0, 6):
        band = pil & (np.abs((xx - pc[0]) - k - (yy - pc[1]) * .25) < .7)
        pt[band] = ix('m2')
    tone[pil] = pt[pil]
    m = pad | blk | pil
    s.ix[m] = tone[m]
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    src = s.ix.copy()
    for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
        v = nb(src, dx, dy, CLEAR)
        pick = rg & (v != CLEAR) & (s.ix == CLEAR)
        for i in np.unique(v[pick]):
            s.ix[pick & (v == i)] = ix({'b': 'd1', 's': 's0', 'm': 'm0', 'o': 'o0'}.get(pal.RAMP_OF[i], 'w0'))
    return s


def rolled(L=66, D=22, seed=2):
    """A bedroll rolled and strapped, lying east-west: slate wool wound inside a canvas cover, its west end
    showing the spiral of the layers, two leather straps with iron buckles. Lit along the top like the logs.
    Anchor = the middle of its underside on the ground."""
    W, H = L + 12, D + 10
    s = new(W, H, W // 2, H - 4)
    top = H - 4 - D
    cy = top + D / 2
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    rx = D * .3
    x0, x1 = 4 + rx, 4 + L - D * .25
    body = (xx >= x0) & (xx <= x1) & (yy >= top) & (yy <= top + D)
    body |= cpx.ell_mask(W, H, x1, cy, D * .25, D / 2, xx, yy)
    # soft: the canvas sags a pixel between the straps
    sag = (yy < top + 1.2) & (((xx > x0 + 4) & (xx < x0 + 18)) | ((xx > x0 + 32) & (xx < x1 - 6)))
    body &= ~sag
    v = (yy - cy) / (D / 2)
    tone = np.full((H, W), ix('b3'), np.uint8)
    tone[v < -.3] = ix('b4')
    tone[v < -.75] = ix('b5')
    tone[v > .3] = ix('b2')
    tone[v > .72] = ix('b1')
    s.ix[body] = tone[body]
    # soft creases along the canvas
    for (cx0, cyy, ln) in ((x0 + 6, cy - 3, 10), (x0 + 22, cy + 2, 8), (x0 + 38, cy - 2, 12)):
        for k in range(ln):
            if body[int(cyy), int(cx0 + k)]:
                s.ix[int(cyy), int(cx0 + k)] = pal.shift_index(int(s.ix[int(cyy), int(cx0 + k)]), -1)
    # two leather straps with buckles
    for sx in (x0 + 20, x0 + 46):
        for y in range(top - 1, top + D + 1):
            for i in range(4):
                if body[min(H - 1, max(0, y)), int(sx + i)] or (y in (top - 1, top + D) and i in (1, 2)):
                    key = 'w4' if i == 0 else ('w3' if i < 3 else 'w2')
                    if v[min(H - 1, max(0, y)), 0] < -.5 and i < 2:
                        key = 'w5'
                    put(s, sx + i, y, key)
        put(s, sx + 1, cy - 1, 't5'); put(s, sx + 2, cy - 1, 't4'); put(s, sx + 1, cy + 1, 't3'); put(s, sx + 2, cy + 1, 't2')
        put(s, sx + 1, cy, 't4'); put(s, sx + 2, cy, 't3')
    # the west end: the spiral of wool and canvas layers
    ex = 4 + rx
    face = cpx.ell_mask(W, H, ex, cy, rx, D / 2, xx, yy)
    s.ix[face] = ix('b3')
    ang = np.arctan2((yy - cy) / (D / 2), (xx - ex) / rx)
    rad = np.sqrt(((xx - ex) / rx) ** 2 + ((yy - cy) / (D / 2)) ** 2)
    # the rolled layers: slate wool between canvas, wound as one line from the core out (not rings)
    s.ix[face] = ix('s3')
    s.ix[face & (yy < cy - 1) & (xx < ex)] = ix('s4')
    spiral = face & (np.mod(rad * 1.9 - ang / (2 * np.pi), 1) < .22) & (rad > .18)
    s.ix[spiral] = ix('b3')
    s.ix[spiral & (yy > cy + 1)] = ix('b2')
    m = s.ix != CLEAR
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    src = s.ix.copy()
    for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
        vv = nb(src, dx, dy, CLEAR)
        pick = rg & (vv != CLEAR) & (s.ix == CLEAR)
        for i in np.unique(vv[pick]):
            s.ix[pick & (vv == i)] = ix({'b': 'd1', 's': 's0', 'w': 'w0', 't': 't0'}.get(pal.RAMP_OF[i], 'w0'))
    return s


if __name__ == '__main__':
    from PIL import Image
    W, H = 260, 70
    a = np.full((H, W), ix('d4'), np.uint8)
    for sp, x in ((rolled(), 80), (sack(), 200)):
        m = sp.ix != CLEAR
        y = H - 6 - sp.ay
        a[y:y + sp.h, x - sp.ax:x - sp.ax + sp.w][m] = sp.ix[m]
    Image.fromarray(cpx.to_rgba(a), 'RGBA').resize((W * 4, H * 4), Image.NEAREST).save('t/bed4x.png')
