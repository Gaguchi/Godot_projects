"""px-scenes2 shared helpers: the dungeon, the throne and the last road as 1x pixel scenes.

IMPORT THIS FIRST in every px-scenes2 module. It extends pxworld's palette, in this process only (pal.py is not
edited), with one ramp the brief asks for and the existing ramps cannot give:

  Vault  'v'   cool blue-grey living rock and iron-grey ashlar, 8 steps dark -> light, hue-shifted (the shadows lean
               blue, the lights lean grey-green). Stone 't' stays the warm grey of dressed flags, so a cave floor
               and its rock, or a courtyard and its keep, never melt into one grey.

Also here: a y-sorting Stage (indexed sprites + RGBA people, shadows thrown onto the ground first), copied from
px-camp/scene.py; the board sprites at 1:1 (people.py, copied unchanged); and a few mask helpers."""
import os
import random
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
ROOT = os.path.dirname(DIRS)
sys.path.insert(0, HERE)
sys.path.insert(0, DIRS)

from pxworld import pal                      # noqa: E402
from pxworld import canvas as _canvas        # noqa: E402

VAULT = ['#14161c', '#22262f', '#333a45', '#48515c', '#5f6a74', '#7b8790', '#9ca7ad', '#c4cccb']


def _extend(letter, cols):
    if letter in pal.RAMP:
        return
    pal.RAMP[letter] = []
    for i, hx in enumerate(cols):
        pal.RAMP[letter].append(len(pal.KEYS))
        pal.IDX[f'{letter}{i}'] = len(pal.KEYS)
        pal.KEYS.append(f'{letter}{i}')
        pal.HEX.append(hx)
        pal.RAMP_OF.append(letter)
        pal.LEVEL.append(i)
    pal.RAMPS.append(('Vault', letter, cols))
    assert len(pal.KEYS) < 255
    _canvas._LUT.clear()


_extend('v', VAULT)
try:                                         # pxworld.build's selout table needs an entry for every ramp
    from pxworld import build as _build
    _build.OUT.setdefault('v', ('v2', 'v1'))
except Exception:                            # noqa: BLE001
    pass

import cpx                                   # noqa: E402  (px-camp helpers, copied unchanged)
from cpx import ix, CLEAR, nb, new, put, get  # noqa: E402,F401
from PIL import Image                        # noqa: E402
from scipy import ndimage                    # noqa: E402

W, H = 1280, 720


def kk(ramp, lvl):
    n = len(pal.RAMP[ramp])
    return f'{ramp}{max(0, min(n - 1, int(lvl)))}'


def lvl(i):
    return pal.LEVEL[int(i)]


def ramp_of(i):
    return pal.RAMP_OF[int(i)]


def shift_where(a, m, n, ramps=None, fine=False):
    """Move the pixels of index array a under bool mask m n steps along their own ramps."""
    sel = m & (a != CLEAR)
    if ramps:
        sel &= np.isin(a, cpx.ids(ramps))
    a[sel] = cpx.lut(n, fine)[a[sel]]


def to_png_uri(im):
    import base64
    import io
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def world_img(uri, w=W, h=H):
    return (f'<img class="abs" alt="" style="left:0;top:0;width:{w}px;height:{h}px;image-rendering:pixelated" '
            f'width="{w}" height="{h}" src="{uri}">')


def zoom(im, box, z, path):
    """A NEAREST crop for QA: box = (x, y, w, h)."""
    x, y, w, h = box
    im.crop((x, y, x + w, y + h)).resize((w * z, h * z), Image.NEAREST).save(path)


# ---------------------------------------------------------------- the y-sorted stage (from px-camp/scene.py)
class Stage:
    """y-sorted drawing: indexed sprites and RGBA people, shadows thrown onto the ground first.
    ground_ramps: the ramps a shadow may darken."""

    def __init__(self, ground, ground_ramps=('g', 'd'), sx=cpx.SX, sy=cpx.SY):
        self.g = ground
        self.H, self.W = ground.shape
        self.shadow = np.zeros(ground.shape, bool)
        self.items = []
        self.ground_ramps = ground_ramps
        self.sx, self.sy = sx, sy

    def throw(self, m, x0=0, y0=0):
        h, w = m.shape
        X0, Y0 = max(0, x0), max(0, y0)
        X1, Y1 = min(self.W, x0 + w), min(self.H, y0 + h)
        if X1 <= X0 or Y1 <= Y0:
            return
        self.shadow[Y0:Y1, X0:X1] |= m[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]

    def throw_sprite(self, spr, fx, fy, flip=False, zcap=None, squash=1.0, contact=True):
        """A standing sprite's silhouette laid along the ground by the sun: a pixel z above the foot line lands at
        (x + z*SX, foot + z*SY). zcap clamps the height (things that lean back)."""
        a = (spr.ix[:, ::-1] if flip else spr.ix) != CLEAR
        ax = (spr.w - 1 - spr.ax) if flip else spr.ax
        ys, xs = np.nonzero(a)
        if not len(xs):
            return
        z = np.maximum(0, spr.ay - ys).astype(float)
        if zcap is not None:
            z = np.minimum(z, zcap)
        z *= squash
        px = np.round(fx - ax + xs + z * self.sx).astype(int)
        py = np.round(fy + z * self.sy).astype(int)
        ok = (px >= 0) & (px < self.W) & (py >= 0) & (py < self.H)
        m = np.zeros((self.H, self.W), bool)
        m[py[ok], px[ok]] = True
        m = ndimage.binary_closing(m, np.ones((3, 3), bool))
        self.shadow |= m
        if contact:
            low = ys >= spr.ay - 3
            fxs = np.round(fx - ax + xs[low]).astype(int)
            for dy in (1, 2):
                for dx in (0, 1, 2):
                    yy_ = int(fy) + dy
                    if not (0 <= yy_ < self.H):
                        continue
                    ok2 = (fxs + dx >= 0) & (fxs + dx < self.W) & (0 <= yy_ < self.H)
                    self.shadow[yy_, (fxs + dx)[ok2]] = True

    def throw_ell(self, cx, cy, rx, ry):
        self.shadow |= cpx.ell_mask(self.W, self.H, cx, cy, rx, ry)

    def throw_poly(self, pts):
        self.shadow |= cpx.poly_mask(self.W, self.H, pts)

    def add(self, spr, fx, fy, z=None, flip=False):
        self.items.append((fy if z is None else z, 'ix', spr, int(round(fx)), int(round(fy)), flip))

    def add_rgba(self, a, x, y, z):
        self.items.append((z, 'rgba', a, int(x), int(y), False))

    def ground_index(self):
        g = self.g.copy()
        sh = self.shadow & np.isin(g, cpx.ids(self.ground_ramps))
        g[sh] = cpx.lut(-1)[g[sh]]
        return g

    def render(self):
        g = self.ground_index()
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


def person(st, key, fx, fy, flip=False, z=None, shadow=True):
    """A board sprite at 1:1, inked like the board's f64-ol1, its shadow thrown by the same sun as the props."""
    import people as PP
    a = PP.load(key)
    if flip:
        a = a[:, ::-1].copy()
    fxl, fyl = PP.FEET.get(key, (52, 149))
    if flip:
        fxl = a.shape[1] - 1 - fxl
    if shadow:
        sil = PP.silhouette(a)
        m, x0, y0 = PP.cast_shadow(sil, fxl, fyl)
        st.throw(m, fx + x0, fy + y0)
        st.throw_ell(fx + 3, fy + 1, 22, 6)
    st.add_rgba(PP.inked(a), fx - fxl, fy - fyl, fy if z is None else z)
