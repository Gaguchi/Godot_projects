"""ux-tavern helpers: the tavern interior's projection, its y-sorted stage, and small drawing helpers.

Built on px-camp's cpx (imported, not copied) and pxworld's palette, so every pixel is a pal ramp index.

The projection is the camp's: orthographic 3/4, in true scale to the 104 x 152 board sprites at 1:1.
    a height of 1 m  = 80 screen px        (a person is about 140 px)
    a floor depth of 1 m = 40 screen px    (the floor recedes up the screen)
    the back wall meets the floor at y = FLOOR_Y; a point d metres in front of it stands at y = FLOOR_Y + 40 d
Light comes from the upper left (the windows are in the back wall's left end): tops are lit, fronts are the middle
step, right sides and undersides the dark steps, cast shadows fall down-right as the floor one ramp step darker."""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
SP = os.path.dirname(DIRS)
for p in (DIRS, os.path.join(DIRS, 'px-camp')):
    if p not in sys.path:
        sys.path.insert(0, p)

import cpx                                                   # noqa: E402  (px-camp's helpers)
from cpx import pal, ix, CLEAR, K, new, put, get, nb        # noqa: E402,F401
from pxworld.canvas import Sprite, ring                      # noqa: E402,F401

W, H = 1280, 720
FLOOR_Y = 300            # the back wall's foot
PXM = 80                 # px per metre of height
DPM = 40                 # px per metre of floor depth
# the short ambient shadow every object throws (per px of height above the floor)
SX, SY = .30, .13
# the window light: a point of a window z px above the floor lands on the floor (z*LX, z*LY) further on
LX, LY = .50, .78


def fy(d):
    """Screen y of the floor d metres in front of the back wall."""
    return int(round(FLOOR_Y + DPM * d))


def lut(n):
    return cpx.lut(n)


def shift(a, m, n):
    """Move the pixels of index array a under bool mask m n steps along their own ramps."""
    a[m] = cpx.lut(n)[a[m]]


def outline(s, dark=None, lit=None):
    """Ring the sprite's silhouette in the darkest step of each neighbour's own ramp (selout); `dark` overrides per
    ramp letter, `lit` gives the up-left facing ring a lighter step per ramp letter."""
    return cpx.selout(s, lit=lit, dark=dark)


def mask_rect(Wd, Hd, x0, y0, x1, y1):
    m = np.zeros((Hd, Wd), bool)
    m[max(0, int(y0)):max(0, int(y1)), max(0, int(x0)):max(0, int(x1))] = True
    return m


def hline(s, x0, x1, y, key):
    for x in range(int(x0), int(x1) + 1):
        put(s, x, y, key)


def vline(s, x, y0, y1, key):
    for y in range(int(y0), int(y1) + 1):
        put(s, x, y, key)


def fill(s, x0, y0, x1, y1, key):
    """Fill [x0, x1) x [y0, y1) of sprite s."""
    s.ix[max(0, int(y0)):max(0, int(y1)), max(0, int(x0)):max(0, int(x1))] = ix(key)


class Stage:
    """y-sorted drawing over a full-stage index array: indexed sprites and RGBA people. Shadows are thrown onto the
    floor (and the lower wall) first, as the surface one ramp step darker, with a hard edge."""

    def __init__(self, base):
        self.g = base
        self.shadow = np.zeros(base.shape, bool)
        self.items = []

    def throw(self, m, x0=0, y0=0):
        h, w = m.shape
        X0, Y0 = max(0, x0), max(0, y0)
        X1, Y1 = min(W, x0 + w), min(H, y0 + h)
        if X1 <= X0 or Y1 <= Y0:
            return
        self.shadow[Y0:Y1, X0:X1] |= m[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]

    def throw_sprite(self, spr, fx, fy_, sx=SX, sy=SY, zcap=None, flip=False, contact=True):
        """Throw a standing sprite's silhouette along the floor: a pixel z px above the foot line lands at
        (x + z*sx, foot + z*sy). zcap clamps the height (a thing against the wall throws no long shadow up it)."""
        from scipy import ndimage
        a = (spr.ix[:, ::-1] if flip else spr.ix) != CLEAR
        ax = (spr.w - 1 - spr.ax) if flip else spr.ax
        ys, xs = np.nonzero(a)
        if not len(xs):
            return
        z = np.maximum(0, spr.ay - ys).astype(float)
        if zcap is not None:
            z = np.minimum(z, zcap)
        px = np.round(fx - ax + xs + z * sx).astype(int)
        py = np.round(fy_ + z * sy).astype(int)
        ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
        m = np.zeros((H, W), bool)
        m[py[ok], px[ok]] = True
        m = ndimage.binary_closing(m, np.ones((3, 3), bool))
        self.shadow |= m
        if contact:
            low = ys >= spr.ay - 2
            fxs = np.round(fx - ax + xs[low]).astype(int)
            for dy in (1, 2):
                yy_ = int(fy_ + dy)
                if not 0 <= yy_ < H:
                    continue
                for dx in (0, 1, 2):
                    ok2 = (fxs + dx >= 0) & (fxs + dx < W)
                    self.shadow[yy_, (fxs + dx)[ok2]] = True

    def throw_poly(self, pts):
        self.shadow |= cpx.poly_mask(W, H, pts)

    def throw_rect(self, x0, y0, x1, y1):
        self.shadow[max(0, y0):max(0, y1), max(0, x0):max(0, x1)] = True

    def throw_ell(self, cx, cy, rx, ry):
        self.shadow |= cpx.ell_mask(W, H, cx, cy, rx, ry)

    def add(self, spr, fx, fy_, z=None, flip=False):
        self.items.append((fy_ if z is None else z, 'ix', spr, int(round(fx)), int(round(fy_)), flip))

    def add_rgba(self, a, x, y, z):
        self.items.append((z, 'rgba', a, int(x), int(y), False))

    def floor_index(self, shadow_ramps=('d', 'w', 'b', 't', 'o')):
        """The base with the shadows laid in (index array), before any sprite."""
        g = self.g.copy()
        sh = self.shadow & np.isin(g, cpx.ids(shadow_ramps))
        g[sh] = cpx.lut(-1)[g[sh]]
        return g

    def render(self, shadow_ramps=('d', 'w', 'b', 't', 'o')):
        from PIL import Image
        g = self.floor_index(shadow_ramps)
        out = Image.fromarray(cpx.to_rgba(g), 'RGBA')
        for (z, kind, spr, x, y, flip) in sorted(self.items, key=lambda t: t[0]):
            if kind == 'ix':
                a = spr.ix[:, ::-1] if flip else spr.ix
                ax = (spr.w - 1 - spr.ax) if flip else spr.ax
                im = Image.fromarray(cpx.to_rgba(a), 'RGBA')
                im.putalpha(Image.fromarray(((a != CLEAR) * 255).astype(np.uint8)))
                paste(out, im, x - ax, y - spr.ay)
            else:
                paste(out, Image.fromarray(spr, 'RGBA'), x, y)
        return out


def paste(out, im, x, y):
    """alpha_composite with negative offsets allowed."""
    cx0, cy0 = max(0, -x), max(0, -y)
    if cx0 >= im.width or cy0 >= im.height:
        return
    im = im.crop((cx0, cy0, im.width, im.height))
    out.alpha_composite(im, (max(0, x), max(0, y)))
