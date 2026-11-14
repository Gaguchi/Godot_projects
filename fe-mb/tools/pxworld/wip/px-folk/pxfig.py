"""pxfig: draw a character as real pixel art, in code and by hand, with no image model.

    from pxfig import Fig
    f = Fig(104, 152, PALETTE)                 # PALETTE: {'coat2': '#6a6965', ...}; one name per colour
    m = f.poly([(30, 42), (28, 56), ...])      # a mask (bool array); also f.blob(), f.ellipse(), f.stroke()
    f.form(m, ['coat0', 'coat1', 'coat2', 'coat3'], hi=2, sh=4)   # flat fill + a lit band top-left, a shaded band bottom-right
    f.pixels(41, 11, ROWS, LEGEND)             # a hand-placed pixel map: the face, the hands
    f.outline('ink')                           # the 1 px contour
    f.save('out/bagrat.png'); f.save('out/bagrat@4.png', zoom=4)

Two ways of drawing, each for what it is good at. MASSES (a coat, a shield, a boot) are shapes: a closed curve through
a few points, filled flat, then shaded in hard bands from one light (top-left), never a gradient. DETAIL (a face, a
hand, a buckle) is placed pixel by pixel from a small map of letters, because at this size a face is forty pixels
and every one is a decision. Nothing is anti-aliased, nothing is scaled, and every colour is a named palette entry.

The loop it is built for: draw, save at 4x, LOOK at it, fix what reads wrong, draw again.
"""
import math

import numpy as np
from PIL import Image, ImageDraw


def spline(pts, n=10, closed=True):
    """A smooth curve through the points (Catmull-Rom), as a dense polyline: organic outlines, not polygons."""
    P = list(pts)
    out = []
    k = len(P)
    rng = range(k) if closed else range(k - 1)
    for i in rng:
        p0 = P[(i - 1) % k] if closed or i > 0 else P[i]
        p1, p2 = P[i], P[(i + 1) % k]
        p3 = P[(i + 2) % k] if closed or i + 2 < k else P[min(i + 1, k - 1)]
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out.append((
                .5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
            ))
    if not closed:
        out.append(P[-1])
    return out


def moved(m, dx, dy):
    """The mask moved by (dx, dy): out[y, x] = m[y - dy, x - dx]."""
    h, w = m.shape
    out = np.zeros_like(m)
    ys0, ys1 = max(0, dy), min(h, h + dy)
    xs0, xs1 = max(0, dx), min(w, w + dx)
    out[ys0:ys1, xs0:xs1] = m[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
    return out


class Fig:
    def __init__(self, w, h, palette):
        self.w, self.h = w, h
        self.keys = list(palette)
        self.hex = [palette[k] for k in self.keys]
        self.ix = {k: i for i, k in enumerate(self.keys)}
        self.a = np.full((h, w), -1, np.int16)

    # ---------------------------------------------------------------- masks
    def _mask(self, draw):
        im = Image.new('1', (self.w, self.h), 0)
        draw(ImageDraw.Draw(im))
        return np.asarray(im, bool).copy()

    def poly(self, pts):
        return self._mask(lambda d: d.polygon([(round(x), round(y)) for x, y in pts], fill=1))

    def blob(self, pts, n=10):
        """A closed smooth shape through the points."""
        return self.poly(spline(pts, n))

    def ellipse(self, cx, cy, rx, ry):
        return self._mask(lambda d: d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=1))

    def stroke(self, pts, width=1, smooth=False):
        P = spline(pts, 8, closed=False) if smooth else pts
        return self._mask(lambda d: d.line([(round(x), round(y)) for x, y in P], fill=1, width=width))

    def rect(self, x, y, w, h):
        m = np.zeros((self.h, self.w), bool)
        m[max(0, y):y + h, max(0, x):x + w] = True
        return m

    def painted(self):
        return self.a >= 0

    # ---------------------------------------------------------------- paint
    def fill(self, m, key, only=None):
        if only is not None:
            m = m & only
        self.a[m] = self.ix[key]

    def put(self, x, y, key):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x] = self.ix[key]

    def form(self, m, ramp, hi=2, sh=3, core=None, base=None):
        """Fill `m` with a ramp (dark .. light): the middle tone flat, a lit band along the edges that face the
        light (top-left), a shaded band along those that face away, and optionally a `core` shadow mask one step
        down. Hard bands, never a gradient. ramp has 3 to 5 names."""
        n = len(ramp)
        mid = n // 2 if base is None else base
        self.a[m] = self.ix[ramp[mid]]
        if core is not None:
            self.a[m & core] = self.ix[ramp[max(0, mid - 1)]]
        if sh:
            edge = m & ~moved(m, -sh, -sh)                 # (x + sh, y + sh) is outside: this pixel faces away
            self.a[edge] = self.ix[ramp[max(0, mid - 1)]]
            if n >= 4 and sh >= 3:
                deep = m & ~moved(m, -1, -1)
                self.a[deep] = self.ix[ramp[max(0, mid - 2)]]
        if hi:
            lit = m & ~moved(m, hi, hi)                    # (x - hi, y - hi) is outside: this pixel faces the light
            self.a[lit] = self.ix[ramp[min(n - 1, mid + 1)]]
            if n >= 5 and hi >= 2:
                top = m & ~moved(m, 1, 1) & ~moved(m, 0, 1)
                self.a[top] = self.ix[ramp[min(n - 1, mid + 2)]]

    def step(self, m, ramp, by=-1):
        """Move every pixel of `m` that is on `ramp` (dark .. light) `by` steps along it: a wrinkle, a cast shadow,
        a glint, drawn without knowing which tone is under it."""
        idx = [self.ix[k] for k in ramp]
        a = self.a
        out = a.copy()
        for i, v in enumerate(idx):
            out[m & (a == v)] = idx[min(len(idx) - 1, max(0, i + by))]
        self.a = out

    def line(self, pts, key, width=1, smooth=False, only=None):
        m = self.stroke(pts, width, smooth)
        self.fill(m, key, only)

    def pixels(self, x, y, rows, legend, flip=False):
        """A hand-placed pixel map. Each letter is a palette name through `legend`; '.' and ' ' leave what is there."""
        for j, row in enumerate(rows):
            r = row[::-1] if flip else row
            for i, ch in enumerate(r):
                if ch in '. ':
                    continue
                xx, yy = x + i, y + j
                if 0 <= xx < self.w and 0 <= yy < self.h:
                    self.a[yy, xx] = self.ix[legend[ch]]

    def clear(self, m):
        self.a[m] = -1

    def outline(self, key, also=None):
        """A 1 px contour OUTSIDE the painted shape (4-neighbour), so the figure keeps its size."""
        p = self.painted()
        ring = ~p & (moved(p, 1, 0) | moved(p, -1, 0) | moved(p, 0, 1) | moved(p, 0, -1))
        self.a[ring] = self.ix[key]
        return ring

    def inner_lines(self, key_of, pairs=None):
        """Darken the pixel on the LOWER/RIGHT side of every boundary between two different colour families.
        key_of(name) -> the name to use there, or None to leave it. A cheap way to separate overlapping forms."""
        a = self.a
        fam = np.array([-1] + [hash(k.rstrip('0123456789')) % 100000 for k in self.keys])[a + 1]
        out = a.copy()
        for dx, dy in ((1, 0), (0, 1)):
            nb = moved(fam, dx, dy)
            edge = (fam != nb) & (a >= 0) & (moved(a, dx, dy) >= 0)
            ys, xs = np.nonzero(edge)
            for y, x in zip(ys, xs):
                k = key_of(self.keys[a[y, x]])
                if k is not None:
                    out[y, x] = self.ix[k]
        self.a = out

    # ---------------------------------------------------------------- out
    def image(self, zoom=1, bg=None):
        rgba = np.zeros((self.h, self.w, 4), np.uint8)
        for i, hx in enumerate(self.hex):
            rgba[self.a == i] = (int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16), 255)
        im = Image.fromarray(rgba, 'RGBA')
        if zoom != 1:
            im = im.resize((self.w * zoom, self.h * zoom), Image.NEAREST)
        if bg is not None:
            back = Image.new('RGBA', im.size, bg)
            back.alpha_composite(im)
            im = back
        return im

    def save(self, path, zoom=1, bg=None):
        self.image(zoom, bg).save(path)

    def count(self):
        return len({int(v) for v in np.unique(self.a) if v >= 0})

    def text(self, legend=None):
        """The sprite as rows of letters (for reading or hand-editing a region)."""
        chars = legend or {k: chr(33 + i) for i, k in enumerate(self.keys)}
        return [''.join('.' if v < 0 else chars[self.keys[v]] for v in row) for row in self.a]


def reduced(fig, k=2):
    """The figure at 1/k of its size: each k x k block becomes its most common colour. A tie goes to paint over
    nothing, then to the colour that is rarer nearby (a tie is usually a detail worth keeping). Draw the figure
    WITHOUT its outline first and outline the result, or the contour comes out broken. Faces do not survive this:
    place them again by hand at the small size."""
    h, w = fig.h // k, fig.w // k
    out = Fig(w, h, dict(zip(fig.keys, fig.hex)))
    a = fig.a
    for y in range(h):
        for x in range(w):
            blk = a[y * k:(y + 1) * k, x * k:(x + 1) * k].ravel()
            vals, cnt = np.unique(blk, return_counts=True)
            best = cnt.max()
            cand = [int(v) for v, c in zip(vals, cnt) if c == best]
            if len(cand) > 1:
                cand = [v for v in cand if v >= 0] or cand
            if len(cand) > 1:
                near = a[max(0, y * k - k):(y + 2) * k, max(0, x * k - k):(x + 2) * k]
                cand.sort(key=lambda v: int((near == v).sum()))
            out.a[y, x] = cand[0]
    return out


def sheet(figs, zoom=3, bg=(98, 126, 47, 255), gap=12, extra=()):
    """Several sprites side by side on one ground colour, for looking at. `extra` = PIL images to add at the right."""
    ims = [f.image(zoom) if isinstance(f, Fig) else f for f in figs] + list(extra)
    W = sum(i.width for i in ims) + gap * (len(ims) + 1)
    H = max(i.height for i in ims) + 2 * gap
    out = Image.new('RGBA', (W, H), bg)
    x = gap
    for i in ims:
        out.alpha_composite(i.convert('RGBA'), (x, H - gap - i.height))
        x += i.width + gap
    return out
