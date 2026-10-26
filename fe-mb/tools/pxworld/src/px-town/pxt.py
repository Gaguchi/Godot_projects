"""px-town primitives: hand-pixel recipes for the town's large-scale pieces, drawn into pxworld Sprites.

Every recipe paints palette keys from pxworld.pal (no new ramps), lit from the upper left:
lit faces = the ramp's light step, side faces = the middle step, undersides and contact lines = the dark step.
Objects are inked with selout (the darkest step of their own ramp) by `selout()`.
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import math
import random
import sys

sys.path.insert(0, ROOT + '/src')

import numpy as np  # noqa: E402

from pxworld import pal  # noqa: E402
from pxworld.canvas import Canvas, Sprite, poly, ellipse, rect, nb  # noqa: E402

CLEAR = pal.CLEAR
IX = pal.ix


def kk(ramp, lvl):
    """The key of level lvl on ramp, clamped: kk('t', 9) -> 't6'."""
    n = len(pal.RAMP[ramp])
    return f'{ramp}{max(0, min(n - 1, int(lvl)))}'


def dark(key, n=1):
    return pal.KEYS[pal.shift_index(IX(key), -n, fine=True)]


def light(key, n=1):
    return pal.KEYS[pal.shift_index(IX(key), n, fine=True)]


# ------------------------------------------------------------------ outline
def selout(s, conn=4, over=None):
    """Ink the pixels just outside s's silhouette with the darkest step of the neighbouring pixel's own ramp.
    over = {ramp: key} swaps the ink for ramps whose darkest step is too light (plaster, skin)."""
    over = over or {}
    m = s.ix != CLEAR
    H, W = m.shape
    ring = np.zeros_like(m)
    src = s.ix.copy()
    darkest = np.array([IX(over.get(pal.RAMP_OF[i], f'{pal.RAMP_OF[i]}0')) if i < len(pal.KEYS) else CLEAR
                        for i in range(256)], np.uint8)
    dirs = ((0, -1), (-1, 0), (1, 0), (0, 1)) + (((1, 1), (-1, 1), (1, -1), (-1, -1)) if conn == 8 else ())
    for dx, dy in dirs:
        v = nb(src, dx, dy, CLEAR)
        pick = (~m) & (v != CLEAR) & (s.ix == CLEAR)
        s.ix[pick] = darkest[v[pick]]
    return s


def padded(s, p):
    o = Sprite(s.w + 2 * p, s.h + 2 * p, s.ax + p, s.ay + p)
    o.ix[p:p + s.h, p:p + s.w] = s.ix
    return o


# ------------------------------------------------------------------ hand-stepped curves
def arch_mask(w, h):
    """A doorway: straight jambs under a semicircular head, sampled at pixel centres (symmetric steps).
    Returns bool[h, w]."""
    m = np.zeros((h, w), bool)
    r = w / 2
    for j in range(h):
        for i in range(w):
            dx = i + .5 - r
            dy = j + .5 - r
            if j + .5 >= r or dx * dx + dy * dy <= r * r + .25:
                m[j, i] = True
    return m


def seg_arch_mask(w, h, rise):
    """A segmental (flat) arch opening: jambs under an arc rising `rise` px. bool[h, w]."""
    m = np.zeros((h, w), bool)
    half = w / 2
    R = (half * half + rise * rise) / (2 * rise)
    for i in range(w):
        dx = abs(i + .5 - half)
        top = rise - (math.sqrt(max(0.0, R * R - dx * dx)) - (R - rise))
        for j in range(h):
            m[j, i] = j + .5 >= top
    return m


def run_profile(m):
    """Debug: the top edge of a mask as runs, to check 1-2-3 stepping."""
    tops = [int(np.argmax(m[:, i])) if m[:, i].any() else -1 for i in range(m.shape[1])]
    return tops


# ------------------------------------------------------------------ textures
def stone_face(s, x0, y0, w, h, ramp='t', base=4, ch=6, bw=(9, 16), seed=0, mortar=None, chips=.14, vary=.12, clip=None):
    """Coursed stone: blocks ch-1 tall in staggered courses. Each block: a lit top row, a dark foot and east end,
    the mortar a step darker still. vary = the share of blocks one step darker (weathered)."""
    R = random.Random(seed)
    mort = mortar or kk(ramp, base - 2)
    for yy in range(y0, y0 + h):
        for xx in range(x0, x0 + w):
            if clip is None or clip(xx, yy):
                s.put(xx, yy, mort)
    y = y0
    row = 0
    while y < y0 + h:
        hh = min(ch, y0 + h - y)
        if hh < 3:
            break
        x = x0 - (R.randint(bw[0] // 2, bw[1] // 2 + 2) if row % 2 else R.randint(0, 3))
        while x < x0 + w:
            bwid = R.randint(*bw)
            L = base - (1 if (vary and R.random() < vary and bwid > 6) else 0)
            bx0, bx1 = x, x + bwid - 2          # last column is mortar
            for j in range(hh - 1):
                for i in range(bx0, bx1 + 1):
                    if i < x0 or i >= x0 + w:
                        continue
                    if clip is not None and not clip(i, y + j):
                        continue
                    lv = L
                    if j == 0 and i < bx1:
                        lv = L + 1
                    elif j == hh - 2 or i == bx1:
                        lv = L - 1
                    s.put(i, y + j, kk(ramp, lv))
            if chips and R.random() < chips:
                cx = bx1 - 1 if R.random() < .5 else bx0
                cy = y + hh - 2
                if x0 <= cx < x0 + w:
                    s.put(cx, cy, mort)
            x += bwid
        y += hh
        row += 1


MOSS = [["...44...", "..43332.", ".4333322", "43332221"],
        ["..44..", ".43332", "433221"],
        ["..4...", ".4332.", "433322"],
        [".44.", "4332"]]


def moss(s, x, y, R, n=1):
    """Moss mounds at the foot of a wall: lit top-left, dark foot. (x, y) = foot row."""
    for _ in range(n):
        t = R.choice(MOSS)
        for j, row in enumerate(t):
            for i, ch in enumerate(row):
                if ch != '.':
                    s.put(x + i, y - len(t) + 1 + j, f'm{ch}')


def planks_v(s, x0, y0, w, h, ramp='w', base=4, pw=5, seed=0, knots=True, clip=None):
    """Vertical boards: each plank lit on its left px, a dark seam on its right; a little grain and the odd knot."""
    R = random.Random(seed)
    x = x0
    while x < x0 + w:
        p = min(pw + R.choice((0, 0, 1, -1)), x0 + w - x)
        L = base + R.choice((0, 0, 0, -1))
        for j in range(h):
            for i in range(p):
                xx, yy = x + i, y0 + j
                if clip is not None and not clip(xx, yy):
                    continue
                lv = L
                if i == 0:
                    lv = L + 1
                if i == p - 1:
                    lv = L - 2
                s.put(xx, yy, kk(ramp, lv))
        # grain: a broken dark line down the plank
        if p >= 4:
            gx = x + R.randint(1, p - 3)
            y = y0 + R.randint(0, 4)
            while y < y0 + h - 1:
                ln = R.randint(3, 7)
                for j in range(ln):
                    if y + j < y0 + h and (clip is None or clip(gx, y + j)):
                        s.put(gx, y + j, kk(ramp, L - 1))
                y += ln + R.randint(3, 8)
        if knots and p >= 4 and h > 10 and R.random() < .4:
            ky = y0 + R.randint(3, h - 4)
            kx = x + R.randint(1, p - 3)
            if clip is None or clip(kx, ky):
                s.put(kx, ky, kk(ramp, L - 2)); s.put(kx + 1, ky, kk(ramp, L - 1)); s.put(kx, ky - 1, kk(ramp, L + 1))
        x += p


def planks_h(s, x0, y0, w, h, ramp='w', base=4, ph=4, seed=0):
    """Horizontal boards (a cart bed, a crate face): lit top row, dark seam at the bottom, staggered butt joints."""
    R = random.Random(seed)
    y = y0
    while y < y0 + h:
        p = min(ph, y0 + h - y)
        for j in range(p):
            lv = base + (1 if j == 0 else (-2 if j == p - 1 else 0))
            for i in range(w):
                s.put(x0 + i, y + j, kk(ramp, lv))
        jx = x0 + R.randint(4, max(5, w - 4))
        if w > 12:
            for j in range(p - 1):
                s.put(jx, y + j, kk(ramp, base - 2))
        y += p


def beam_h(s, x0, x1, y, ramp='w', base=3, th=3):
    """A horizontal timber th px tall: lit top, dark under-edge."""
    for j in range(th):
        lv = base + 1 if j == 0 else (base - 1 if j == th - 1 else base)
        s.hline(x0, x1, y + j, kk(ramp, lv))


def beam_v(s, x, y0, y1, ramp='w', base=3, tw=3):
    for i in range(tw):
        lv = base + 1 if i == 0 else (base - 1 if i == tw - 1 else base)
        s.vline(x + i, y0, y1, kk(ramp, lv))


def brace(s, x0, y0, x1, y1, ramp='w', base=3, tw=3):
    """A diagonal timber brace, tw px thick, lit along its upper edge."""
    n = max(abs(x1 - x0), abs(y1 - y0))
    for t in range(n + 1):
        x = round(x0 + (x1 - x0) * t / n)
        y = round(y0 + (y1 - y0) * t / n)
        for k in range(tw):
            lv = base + 1 if k == 0 else (base - 1 if k == tw - 1 else base)
            s.put(x, y + k, kk(ramp, lv))


def window_px(s, x, y, w=14, h=16, frame='w', shutter=None, cross=True, sill=True):
    """A small window: a walnut frame, dark glass with a sky glint top-left, a mullion cross, a lit sill.
    shutter = a ramp letter for painted shutters either side (5 px)."""
    # frame
    for j in range(h):
        for i in range(w):
            edge = i in (0, w - 1) or j in (0, h - 1)
            s.put(x + i, y + j, kk(frame, 2) if edge else 's1')
    for i in range(1, w - 1):
        s.put(x + i, y + 1, 's0')            # the head casts its shadow into the glass
    # glint: a short diagonal of sky
    for k in range(3):
        s.put(x + 2 + k, y + 2 + 2 - k, 's3')
        if k < 2:
            s.put(x + 2 + k, y + 3 + 2 - k, 's2')
    if cross:
        mx = x + w // 2
        for j in range(1, h - 1):
            s.put(mx, y + j, kk(frame, 3))
        for i in range(1, w - 1):
            s.put(x + i, y + h // 2, kk(frame, 3))
        s.put(mx, y + h // 2, kk(frame, 4))
    if sill:
        for i in range(-1, w + 1):
            s.put(x + i, y + h, kk(frame, 5) if i < w else kk(frame, 3))
            s.put(x + i, y + h + 1, kk(frame, 2))
    if shutter:
        for side in (-1, 1):
            sx0 = x - 6 if side < 0 else x + w + 1
            for j in range(h):
                for i in range(5):
                    lv = 3
                    if i == 0:
                        lv = 4
                    if i == 4:
                        lv = 2
                    if j in (2, h - 3):
                        lv = 2 if i not in (0,) else 3
                    s.put(sx0 + i, y + j, kk(shutter, lv))
            s.put(sx0 + (4 if side < 0 else 0), y + h // 2, 't2')   # the catch


def ground_shadow(cv, spr, fx, fy, dx, dy, ramps=('g', 'd', 't', 'h')):
    """A hard cast shadow: spr's silhouette moved (dx, dy), every ground pixel under it one step down its ramp."""
    a = spr.ix != CLEAR
    cv.shift((a, int(fx) - spr.ax + dx, int(fy) - spr.ay + dy), -1, ramps)


def shear_shadow(cv, spr, fx, fy, lean=.5, drop=.18, ramps=('g', 'd', 't', 'h'), base_rows=0):
    """A cast shadow for a standing thing lit from the upper left: its silhouette sheared to the east and squashed onto
    the ground behind its foot (light from the NW throws shadows to the SE). One step down, hard edge."""
    a = spr.ix != CLEAR
    H, W = a.shape
    x0, y0 = int(fx) - spr.ax, int(fy) - spr.ay
    out = np.zeros((cv.h, cv.w), bool)
    ys, xs = np.nonzero(a)
    for yy, xx in zip(ys, xs):
        up = spr.ay - yy                      # height above the foot
        sx = x0 + xx + int(round(up * lean))
        sy = int(fy) - int(round(up * drop)) + (yy - spr.ay if up <= base_rows else 0)
        if 0 <= sx < cv.w and 0 <= sy < cv.h:
            out[sy, sx] = True
    # close pinholes
    out = out | (nb(out, -1, 0) & nb(out, 1, 0))
    cv.shift((out, 0, 0), -1, ramps)


def smoke_puffs(cv, x, y, R, n=6, lean=3, step=6):
    """Chimney smoke as small hard-edged puffs rising and drifting east, thinning out: bone tones, no blur."""
    PUFF = [["..55..", ".5544.", "554443", ".4433."],
            [".55.", "5443", ".43."],
            [".5.", "543"]]
    for k in range(n):
        t = PUFF[0] if k < 1 else (PUFF[1] if k < 3 else PUFF[2])
        px, py = x + int(k * lean * .9) + (1 if k % 2 else 0), y - 5 - k * step
        if py < 1:
            break
        for j, row in enumerate(t):
            for i, ch in enumerate(row):
                if ch != '.':
                    key = {'5': 'b5', '4': 'b4', '3': 'b3'}[ch]
                    if k >= 4:
                        key = {'5': 'b4', '4': 'b3', '3': 'b3'}[ch]
                    cv.put(px + i, py + j, key)
