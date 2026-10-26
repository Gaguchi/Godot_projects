"""Broadleaf trees at camp scale (a crown 150-260 px across), drawn the way pxworld draws its small ones (lit as
one ball from the north-west, clumps laid darkest first, Leaf ramp, l0 outline) but with leaf texture that holds
up at this size: every clump has a scalloped edge of small leaf lobes, a lit crescent of leaf marks on its sunny
shoulder and a shaded rim on its lower right. Trunks are Walnut with fissured bark and flaring roots."""
import math
import random

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, K, new, put, get, nb

LIGHT = np.array([-.5, -.72, .62])
LIGHT /= np.linalg.norm(LIGHT)
LEAF = pal.RAMP['l']          # l0..l6


def crown(rx, ry, seed=0, lift=0, density=1.0):
    """Returns (Sprite, mask). Anchor = crown centre.
    1. clumps: domes of 16-30 px, Poisson spaced, a ring of them at the rim for the bumpy outline;
    2. light: the normal of the tallest dome at each pixel, blended with the whole crown as one ball (lit NW);
    3. leaves: the light is sampled into small leaf cells (5-6 px), each cell one tone, laid darkest first, so
       every tone boundary is a scalloped run of leaves rather than a smooth curve;
    4. the sunniest leaves carry a pixel of the top tone; the underside darkens; l0 outline, l1 where lit."""
    from scipy import ndimage
    rng = random.Random(seed)
    nrng = np.random.RandomState(seed)
    pad = 16
    W, H = int(2 * rx + 2 * pad), int(2 * ry + 2 * pad)
    s = new(W, H, W // 2, H // 2)
    cx, cy = W / 2, H / 2
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    sp = 36 / density
    pts = cpx.poisson(rng, cx - rx, cy - ry, cx + rx, cy + ry, sp, 3000,
                      ok=lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < .8)
    ne = int(2 * math.pi * math.sqrt((rx * rx + ry * ry) / 2) / (sp * .8))
    a0 = rng.uniform(0, 6.28)
    for k in range(ne):
        a = a0 + 2 * math.pi * k / ne + rng.uniform(-.1, .1)
        d = rng.uniform(.82, .94)
        pts.append((cx + math.cos(a) * rx * d, cy + math.sin(a) * ry * d))
    best = np.full((H, W), -1e9)
    nrm = np.zeros((H, W, 3))
    for (x, y) in pts:
        r = sp * rng.uniform(.62, .82)
        d2 = (xx - x) ** 2 + ((yy - y) / .9) ** 2
        inside = d2 < r * r
        hgt = np.sqrt(np.maximum(0, r * r - d2)) + .25 * r * (1 - ((y - cy) / ry))   # upper clumps sit higher
        mm = inside & (hgt > best)
        best[mm] = hgt[mm]
        nz = np.sqrt(np.maximum(0, r * r - d2)) / r
        nrm[mm, 0] = ((xx - x) / r)[mm]
        nrm[mm, 1] = ((yy - y) / r)[mm]
        nrm[mm, 2] = nz[mm]
    sil = best > -1e8
    sil = ndimage.binary_fill_holes(sil)
    gx, gy = (xx - cx) / rx, (yy - cy) / ry
    gz = np.sqrt(np.maximum(0, 1 - gx * gx - gy * gy))
    bball = gx * LIGHT[0] + gy * LIGHT[1] + gz * LIGHT[2] - .15 * gy
    b = .5 * (nrm @ LIGHT) + .6 * bball
    vals = b[sil]
    levels = [LEAF[min(6, i + lift)] for i in (1, 2, 3, 4, 5)]
    th = np.quantile(vals, [.16, .4, .66, .88])
    q = np.zeros((H, W), int)
    for t_ in th:
        q += b > t_
    # smooth clump tones first, cleaned so no tone is a lone pixel
    from pxworld.terrain import majority
    tone = np.array(levels, np.uint8)[np.minimum(q, 4)]
    tone[~sil] = levels[0]
    majority(tone, levels, passes=2, size=5)
    qq = np.zeros((H, W), int)
    for i, lv in enumerate(levels):
        qq[tone == lv] = i
    # leaf cells along every tone boundary: each takes the tone at its centre, laid darkest first, so the
    # boundary becomes a run of leaf scallops
    edge = np.zeros((H, W), bool)
    for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
        edge |= (nb(qq, dx, dy, -1) != qq) & sil
    near = ndimage.binary_dilation(edge, np.ones((7, 7), bool)) & sil
    cells = cpx.poisson(rng, cx - rx - 6, cy - ry - 6, cx + rx + 6, cy + ry + 6, 3.4, 30000,
                        ok=lambda x, y: 0 <= int(y) < H and 0 <= int(x) < W and near[int(y), int(x)])
    cl = sorted(((qq[int(y), int(x)], rng.random(), x, y) for (x, y) in cells))
    out = tone.copy()
    for (t_, _, x, y) in cl:
        r1 = rng.uniform(2.4, 3.4)
        x0, x1 = int(x - r1 - 1), int(x + r1 + 2)
        y0, y1 = int(y - r1 - 1), int(y + r1 + 2)
        sub = (xx[y0:y1, x0:x1] - x) ** 2 / (r1 * r1) + (yy[y0:y1, x0:x1] - y) ** 2 / (r1 * r1 * .72) <= 1
        sub &= sil[y0:y1, x0:x1]
        out[y0:y1, x0:x1][sub] = levels[t_]
    tone = out
    # leaf marks inside each tone: a lit dash on the sunny side of the region, a dark one on the shaded side
    marks = cpx.poisson(rng, cx - rx, cy - ry, cx + rx, cy + ry, 8.5, 6000,
                        ok=lambda x, y: 0 <= int(y) < H - 2 and 0 <= int(x) < W - 3 and sil[int(y), int(x)] and not near[int(y), int(x)])
    for (x, y) in marks:
        x, y = int(x), int(y)
        t_ = qq[y, x]
        up = b[y, x] > np.quantile(vals, .5)
        k = min(4, t_ + 1) if up else max(0, t_ - 1)
        if k == t_:
            continue
        shape = rng.choice(((0, 0), (1, 0), (1, -1)), ) if False else rng.choice([[(0, 0), (1, 0), (2, -1)], [(0, 0), (1, -1)], [(0, 0), (1, 0)], [(0, -1), (1, 0), (2, 0)]])
        for (dx, dy) in shape:
            if sil[y + dy, x + dx]:
                tone[y + dy, x + dx] = levels[k]
        if t_ == 4 and rng.random() < .4:
            tone[y - 1, x] = LEAF[6]
    s.ix[sil] = tone[sil]
    # the underside, deepest at the bottom edge and in the lower right
    bot = sil & ~nb(sil, 0, 2) & (yy > cy - ry * .2)
    s.ix[bot] = cpx.lut(-1)[s.ix[bot]]
    s.despeckle(1)
    rg = cpx.ring(np.pad(sil, 1), 4)[1:-1, 1:-1]
    upl = rg & (nb(sil, 1, 0) | nb(sil, 0, 1)) & ~nb(sil, -1, 0) & ~nb(sil, 0, -1)
    s.ix[rg] = ix('l0')
    s.ix[upl & (yy < cy)] = ix('l1')
    return s, sil


def trunk(h, w, seed=0, roots=True, fork=True):
    """A trunk h tall, w wide at the base. Anchor = base centre."""
    rng = random.Random(seed)
    W, H = w * 3 + 20, h + 10
    s = new(W, H, W // 2, H - 4)
    cx = W / 2
    base = H - 4
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    t = (base - yy) / h
    half = w / 2 * (1 - .25 * np.clip(t, 0, 1)) + (np.clip(.12 - t, 0, 1) / .12) ** 2 * w * .55 * roots
    lean = 3 * np.sin(t * 2.2 + seed)
    m = (np.abs(xx - cx - lean) <= half) & (t >= 0) & (t <= 1)
    u = (xx - cx - lean) / np.maximum(half, 1)
    tone = np.full((H, W), ix('w4'), np.uint8)
    tone[u < -.4] = ix('w5')
    tone[u < -.78] = ix('w6')
    tone[u > .25] = ix('w3')
    tone[u > .65] = ix('w2')
    s.ix[m] = tone[m]
    # fissures: long vertical cracks, wandering, a lit lip on the west side of each
    for k in range(int(w / 4)):
        x0 = cx - w / 2 + 3 + k * 4 + rng.uniform(-1, 1)
        y = base - rng.uniform(0, 10)
        x = x0
        while y > base - h + 4:
            seg = rng.uniform(10, 34)
            for j in range(int(seg)):
                py = int(y - j)
                if j % rng.choice((6, 8, 11)) == 0:
                    x += rng.choice((-1, 0, 1)) * .8
                tx = x + 3 * math.sin((base - py) / h * 2.2 + seed)
                tx = tx * (1 - .25 * (base - py) / h) + cx * .25 * (base - py) / h
                px = int(round(tx))
                if m[py, px] and m[py, px - 1] and m[py, px + 1]:
                    s.ix[py, px] = pal.shift_index(int(tone[py, px]), -2)
                    if tone[py, px - 1] in (ix('w4'), ix('w3')):
                        s.ix[py, px - 1] = pal.shift_index(int(tone[py, px - 1]), 1)
            y -= seg + rng.uniform(3, 8)
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    s.ix[rg] = ix('w0')
    return s, m


def tree(rx=110, ry=96, h=150, w=34, seed=0, lift=0):
    """A whole tree: trunk, two limbs into the crown, the crown. Returns (Sprite anchored at the trunk base,
    crown-centre offset, silhouette mask)."""
    tr, tm = trunk(h + int(ry * .5), w, seed)
    cr, cm = crown(rx, ry, seed, lift)
    W = max(cr.w, tr.w)
    H = h + int(ry * 1.0) + cr.h // 2 + 12
    s = new(W, H, W // 2, H - 4)
    # the crown's centre sits h above the base
    ccx, ccy = s.ax, s.ay - h - int(ry * .35)
    s.blit(tr, s.ax - tr.ax, s.ay - tr.ay)
    # limbs: two branches forking up into the crown, visible in its lower gaps
    for (dx, k) in ((-1, .6), (1, .8)):
        for j in range(int(ry * .7)):
            px = s.ax + dx * j * k * .9
            py = s.ay - h + 6 - j
            for i in range(-2, 3):
                put(s, px + i, py, 'w0' if abs(i) == 2 else ('w5' if i < 0 else 'w3'))
    s.blit(cr, ccx - cr.ax, ccy - cr.ay)
    return s, (ccx - s.ax, ccy - s.ay)


def bush(rx, ry, seed=0, lift=1):
    """A low shrub: a few clumps of different sizes, flat where it meets the ground, darker at its foot.
    Anchor = middle of its foot."""
    rng = random.Random(seed)
    parts = []
    n = rng.choice((3, 4))
    for k in range(n):
        f = (k / (n - 1) - .5) if n > 1 else 0
        r1 = rx * rng.uniform(.5, .66)
        parts.append((f * rx * .9, -ry * rng.uniform(.4, .7) * (1.15 - abs(f)), r1, r1 * ry / rx * 1.1))
    W, H = int(2 * rx + 40), int(2 * ry + 30)
    s = new(W, H, W // 2, H - 6)
    for (dx, dy, r1, r2) in sorted(parts, key=lambda p: -p[1]):
        cr, cm = crown(r1, r2, rng.randint(0, 9999), lift=lift, density=2.3)
        s.blit(cr, int(s.ax + dx - cr.ax), int(s.ay + dy - cr.ay))
    # sit it on the ground: nothing below the foot line, a dark band along the foot
    s.ix[s.ay + 1:, :] = CLEAR
    m = s.ix != CLEAR
    foot = m & ~nb(m, 0, 3)
    s.ix[foot] = cpx.lut(-1)[s.ix[foot]]
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1] & (s.ix == CLEAR)
    s.ix[rg] = ix('l0')
    return s.trimmed()


if __name__ == '__main__':
    from PIL import Image
    sp, off = tree(seed=4)
    bg = np.full((sp.h + 10, sp.w + 10), ix('g5'), np.uint8)
    m = sp.ix != CLEAR
    bg[5:5 + sp.h, 5:5 + sp.w][m] = sp.ix[m]
    im = Image.fromarray(cpx.to_rgba(bg), 'RGBA')
    im.save('t/bigtree.png')
    im.crop((40, 40, 200, 160)).resize((640, 480), Image.NEAREST).save('t/bigtree_z4.png')
    print(sp.w, sp.h)
