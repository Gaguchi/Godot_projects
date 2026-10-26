"""pxworld canvas: an indexed pixel surface (one uint8 palette index per art pixel, 255 = clear).

Everything is drawn straight into palette indices, so there is never a colour that is not in pal.py,
and shading is a move along a ramp (shift), not a blend. Sprites are small Canvases with a foot anchor.
"""
import base64
import io
import math

import numpy as np
from PIL import Image, ImageDraw

from . import pal
from .pal import CLEAR, ix

_LUT = {}


def lut(n, fine=False):
    if (n, fine) not in _LUT:
        _LUT[(n, fine)] = np.array(pal.lut(n, fine), np.uint8)
    return _LUT[(n, fine)]


# ---------------------------------------------------------------- masks: (bool array, x0, y0) in art px
def _draw_mask(bbox, fn):
    x0, y0, x1, y1 = [int(math.floor(v)) for v in bbox[:2]] + [int(math.ceil(v)) for v in bbox[2:]]
    x0 -= 1; y0 -= 1; x1 += 2; y1 += 2
    im = Image.new('1', (max(1, x1 - x0), max(1, y1 - y0)), 0)
    fn(ImageDraw.Draw(im), x0, y0)
    return np.array(im, bool), x0, y0


def poly(pts):
    """Filled polygon, hard pixel edge (no anti-aliasing)."""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return _draw_mask((min(xs), min(ys), max(xs), max(ys)),
                      lambda d, x0, y0: d.polygon([(x - x0, y - y0) for x, y in pts], fill=1))


def line(pts, width=1):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    pad = width
    return _draw_mask((min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad),
                      lambda d, x0, y0: d.line([(x - x0, y - y0) for x, y in pts], fill=1, width=width))


def ellipse(cx, cy, rx, ry, rot=0.0):
    """Filled ellipse sampled at pixel centres (rot in degrees). Clean, symmetric stair-steps."""
    R = max(rx, ry) + 1
    x0, y0 = int(math.floor(cx - R)), int(math.floor(cy - R))
    x1, y1 = int(math.ceil(cx + R)), int(math.ceil(cy + R))
    yy, xx = np.mgrid[y0:y1, x0:x1]
    dx, dy = xx + .5 - cx, yy + .5 - cy
    if rot:
        c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        dx, dy = dx * c + dy * s, -dx * s + dy * c
    m = (dx / max(rx, 1e-6)) ** 2 + (dy / max(ry, 1e-6)) ** 2 <= 1.0
    return m, x0, y0


def disc(cx, cy, r):
    return ellipse(cx, cy, r, r)


def rect(x, y, w, h):
    return np.ones((max(0, h), max(0, w)), bool), int(x), int(y)


def full(w, h):
    return np.ones((h, w), bool), 0, 0


def shifted(m, dx, dy):
    """The same mask, moved."""
    a, x0, y0 = m
    return a, x0 + dx, y0 + dy


def edge(a, dx, dy):
    """Pixels of bool array a whose neighbour at (dx, dy) is outside a."""
    n = np.zeros_like(a)
    H, W = a.shape
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    n[ys, xs] = a[yd, xd]
    return a & ~n


def nb(a, dx, dy, fillv=False):
    """a moved so that out[y, x] = a[y + dy, x + dx]."""
    H, W = a.shape
    out = np.full_like(a, fillv)
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    out[ys, xs] = a[yd, xd]
    return out


def ring(a, conn=4):
    """Pixels just outside bool array a (a must have a 1 px margin)."""
    g = a.copy()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) + (((1, 1), (-1, 1), (1, -1), (-1, -1)) if conn == 8 else ()):
        g |= nb(a, dx, dy)
    return g & ~a


# ---------------------------------------------------------------- the surface
class Canvas:
    def __init__(self, w, h, fill=CLEAR):
        self.w, self.h = int(w), int(h)
        self.ix = np.full((self.h, self.w), fill if isinstance(fill, int) else ix(fill), np.uint8)

    # -- clipping helper: local array a at (x0, y0) -> (canvas slice, local slice)
    def _clip(self, a, x0, y0):
        h, w = a.shape
        cx0, cy0 = max(0, x0), max(0, y0)
        cx1, cy1 = min(self.w, x0 + w), min(self.h, y0 + h)
        if cx1 <= cx0 or cy1 <= cy0:
            return None, None
        return (slice(cy0, cy1), slice(cx0, cx1)), (slice(cy0 - y0, cy1 - y0), slice(cx0 - x0, cx1 - x0))

    def view(self, m):
        """(canvas index view, local mask) for mask m, or (None, None) when off-canvas."""
        a, x0, y0 = m
        cs, ls = self._clip(a, x0, y0)
        if cs is None:
            return None, None
        return cs, a[ls]

    def fill(self, m, key, where=None):
        """Paint mask m with one palette key. where(sub_ix) -> bool restricts it (e.g. only grass)."""
        cs, a = self.view(m)
        if cs is None:
            return
        sub = self.ix[cs]
        sel = a if where is None else a & where(sub)
        sub[sel] = ix(key)

    def shift(self, m, n, ramps=None, where=None, fine=False):
        """Move pixels under m n steps along their own ramps (negative = into shadow)."""
        cs, a = self.view(m)
        if cs is None:
            return
        sub = self.ix[cs]
        sel = a & (sub != CLEAR)
        if ramps:
            sel &= np.isin(sub, [i for r in ramps for i in pal.RAMP[r]])
        if where is not None:
            sel &= where(sub)
        sub[sel] = lut(n, fine)[sub[sel]]

    def put(self, x, y, key):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.ix[int(y), int(x)] = ix(key)

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return int(self.ix[int(y), int(x)])
        return CLEAR

    def hline(self, x0, x1, y, key):
        for x in range(int(x0), int(x1) + 1):
            self.put(x, y, key)

    def vline(self, x, y0, y1, key):
        for y in range(int(y0), int(y1) + 1):
            self.put(x, y, key)

    def rect(self, x, y, w, h, key):
        self.fill(rect(x, y, w, h), key)

    def blit(self, spr, x, y, flip=False):
        """Copy sprite spr with its top-left at (x, y); clear pixels are skipped."""
        a = spr.ix[:, ::-1] if flip else spr.ix
        cs, ls = self._clip(a, int(x), int(y))
        if cs is None:
            return
        src = a[ls]
        dst = self.ix[cs]
        m = src != CLEAR
        dst[m] = src[m]

    def stamp(self, spr, fx, fy, flip=False):
        """Place sprite spr with its foot anchor at (fx, fy)."""
        ax = (spr.w - 1 - spr.ax) if flip else spr.ax
        self.blit(spr, int(round(fx)) - ax, int(round(fy)) - spr.ay, flip)

    def shadow_of(self, spr, fx, fy, dx, dy, n=-2, ramps=None, flip=False):
        """Drop spr's silhouette as a ground shadow, moved by (dx, dy) from where spr would stamp."""
        a = (spr.ix[:, ::-1] if flip else spr.ix) != CLEAR
        ax = (spr.w - 1 - spr.ax) if flip else spr.ax
        self.shift((a, int(round(fx)) - ax + dx, int(round(fy)) - spr.ay + dy), n, ramps)

    # -- pixel primitives (all hard-edged)
    def line_px(self, x0, y0, x1, y1, key):
        """Bresenham line, one pixel wide."""
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.put(x0, y0, key)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def poly_fill(self, pts, key):
        self.fill(poly(pts), key)

    def ell_fill(self, cx, cy, rx, ry, key, rot=0.0):
        self.fill(ellipse(cx, cy, rx, ry, rot), key)

    def ell_shade(self, cx, cy, rx, ry, tones, light=(-.55, -.75, .7), rot=0.0, cut=None, only=None):
        """Fill an ellipse lit as a dome: tones dark -> light, chosen by the surface's facing to the light.
        cut = thresholds (len(tones) - 1), default evenly spaced."""
        a, x0, y0 = ellipse(cx, cy, rx, ry, rot)
        h, w = a.shape
        yy, xx = np.mgrid[y0:y0 + h, x0:x0 + w].astype(float)
        nx, ny = (xx + .5 - cx) / max(rx, .5), (yy + .5 - cy) / max(ry, .5)
        nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
        L = np.array(light, float); L /= np.linalg.norm(L)
        b = nx * L[0] + ny * L[1] + nz * L[2]
        n = len(tones)
        cut = cut or [(-.2 + 1.1 * (i + 1) / n) for i in range(n - 1)]
        q = np.zeros(a.shape, int)
        for t in cut:
            q += b > t
        lv = np.array([ix(t) for t in tones], np.uint8)
        cs, ls = self._clip(a, x0, y0)
        if cs is None:
            return
        sub = self.ix[cs]
        m = a[ls]
        if only is not None:
            m = m & only(sub)
        sub[m] = lv[q[ls]][m]

    def mask(self):
        return self.ix != CLEAR

    def is_ramp(self, letters):
        ids = [i for r in letters for i in pal.RAMP[r]]
        return np.isin(self.ix, ids)

    # -- clean-up passes
    def despeckle(self, passes=1, keep=()):
        """Remove orphan pixels: a pixel none of whose 4 neighbours share its colour, while 3+ of them agree."""
        keep_ids = [ix(k) for k in keep]
        for _ in range(passes):
            a = self.ix
            n = [nb(a, 1, 0, CLEAR), nb(a, -1, 0, CLEAR), nb(a, 0, 1, CLEAR), nb(a, 0, -1, CLEAR)]
            lonely = (n[0] != a) & (n[1] != a) & (n[2] != a) & (n[3] != a) & (a != CLEAR)
            if keep_ids:
                lonely &= ~np.isin(a, keep_ids)
            best = np.full_like(a, CLEAR)
            cnt = np.zeros(a.shape, np.int8)
            for i in range(4):
                c = sum((n[i] == n[j]).astype(np.int8) for j in range(4))
                better = (c > cnt) & (n[i] != CLEAR)
                best[better] = n[i][better]
                cnt[better] = c[better]
            fix = lonely & (cnt >= 3)
            a[fix] = best[fix]

    def outline(self, key='k0', conn=4, auto=False, skip_up=False):
        """Ink the pixels just outside the silhouette. auto=True uses the darkest tone of the neighbour's ramp."""
        m = self.mask()
        big = np.zeros((self.h + 2, self.w + 2), bool)
        big[1:-1, 1:-1] = m
        r = ring(big, conn)[1:-1, 1:-1]
        if skip_up:      # leave the lit top edge un-inked (selective outline)
            r &= ~nb(m, 0, 1)
        if auto:
            src = self.ix.copy()
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                v = nb(src, dx, dy, CLEAR)
                pick = r & (v != CLEAR) & (self.ix == CLEAR)
                dark = np.array([pal.RAMP[pal.RAMP_OF[i]][0] if i != CLEAR else CLEAR for i in range(256)], np.uint8)
                self.ix[pick] = dark[v[pick]]
        else:
            self.ix[r] = ix(key)

    # -- output
    def image(self, bg=None):
        """PIL 'P' image (index 255 = transparent unless bg is given)."""
        a = self.ix.copy()
        if bg is not None:
            a[a == CLEAR] = ix(bg)
        im = Image.fromarray(a, 'P')
        im.putpalette(pal.flat_palette())
        if bg is None:
            im.info['transparency'] = CLEAR
        return im

    def png_bytes(self, bg=None):
        buf = io.BytesIO()
        im = self.image(bg)
        if bg is None:
            im.save(buf, 'PNG', optimize=True, transparency=CLEAR)
        else:
            im.save(buf, 'PNG', optimize=True)
        return buf.getvalue()

    def save(self, path, bg=None, zoom=1):
        im = self.image(bg).convert('RGBA')
        if zoom != 1:
            im = im.resize((self.w * zoom, self.h * zoom), Image.NEAREST)
        im.save(path)

    def data_uri(self, bg=None):
        return 'data:image/png;base64,' + base64.b64encode(self.png_bytes(bg)).decode()

    def crop(self, x, y, w, h):
        c = Canvas(w, h)
        c.blit(_Wrap(self.ix[max(0, y):y + h, max(0, x):x + w]), max(0, -x), max(0, -y))
        return c


class _Wrap:
    def __init__(self, a):
        self.ix = a


class Sprite(Canvas):
    """A small Canvas with a foot anchor (ax, ay): the ground point it stands on. Default: bottom centre."""

    def __init__(self, w, h, ax=None, ay=None):
        super().__init__(w, h)
        self.ax = (w // 2) if ax is None else ax
        self.ay = (h - 1) if ay is None else ay

    @classmethod
    def ascii(cls, rows, keymap, ax=None, ay=None):
        """Build from strings; '.' and ' ' are clear, every other char is looked up in keymap."""
        rows = [r for r in rows]
        h, w = len(rows), max(len(r) for r in rows)
        s = cls(w, h, ax, ay)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in '. ':
                    continue
                s.ix[y, x] = ix(keymap[ch])
        return s

    def padded(self, p=1):
        s = Sprite(self.w + 2 * p, self.h + 2 * p, self.ax + p, self.ay + p)
        s.ix[p:p + self.h, p:p + self.w] = self.ix
        return s

    def trimmed(self):
        m = self.mask()
        if not m.any():
            return self
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        s = Sprite(x1 - x0, y1 - y0, self.ax - x0, self.ay - y0)
        s.ix = self.ix[y0:y1, x0:x1].copy()
        return s

    def flipped(self):
        s = Sprite(self.w, self.h, self.w - 1 - self.ax, self.ay)
        s.ix = self.ix[:, ::-1].copy()
        return s

    def recolor(self, mapping):
        """Swap keys: {'x3': 's3', ...}."""
        s = Sprite(self.w, self.h, self.ax, self.ay)
        s.ix = self.ix.copy()
        for a, b in mapping.items():
            s.ix[self.ix == ix(a)] = ix(b)
        return s


def compose(*parts, ax=None, ay=None):
    """Merge (sprite, x, y) parts (top-left offsets, later on top) into one Sprite."""
    x0 = min(x for _, x, _ in parts); y0 = min(y for _, _, y in parts)
    x1 = max(x + s.w for s, x, _ in parts); y1 = max(y + s.h for s, _, y in parts)
    out = Sprite(x1 - x0, y1 - y0, (ax - x0) if ax is not None else None, (ay - y0) if ay is not None else None)
    for s, x, y in parts:
        out.blit(s, x - x0, y - y0)
    return out
