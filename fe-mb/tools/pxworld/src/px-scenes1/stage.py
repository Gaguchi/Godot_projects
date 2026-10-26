"""The y-sorted stage both scenes draw on (PxCamp's Stage, widened): indexed sprites and the RGBA board sprites,
every cast shadow thrown onto the ground first as one mask, then the ground under it moved one ramp step down
(grass, dirt, wheat, water and stone all shade along their own ramps), hard-edged."""
import random

import numpy as np
from PIL import Image
from scipy import ndimage

import cpx
import people as PP
from cpx import pal, ix, CLEAR, ell_mask, poisson

SHADE_RAMPS = ('g', 'd', 'h', 'a', 't')


class Stage:
    def __init__(self, ground, W=1280, H=720):
        self.g = ground
        self.W, self.H = W, H
        self.shadow = np.zeros(ground.shape, bool)
        self.items = []

    def throw(self, m, x0=0, y0=0):
        h, w = m.shape
        X0, Y0 = max(0, x0), max(0, y0)
        X1, Y1 = min(self.W, x0 + w), min(self.H, y0 + h)
        if X1 <= X0 or Y1 <= Y0:
            return
        self.shadow[Y0:Y1, X0:X1] |= m[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]

    def throw_sprite(self, spr, fx, fy, flip=False, zcap=None, squash=1.0, dapple=0, contact=True, sx=None, sy=None):
        """A standing sprite's silhouette laid along the ground by the sun: a pixel z above the foot line lands at
        (x + z*SX, foot + z*SY)."""
        SX = cpx.SX if sx is None else sx
        SY = cpx.SY if sy is None else sy
        W, H = self.W, self.H
        a = (spr.ix[:, ::-1] if flip else spr.ix) != CLEAR
        ax = (spr.w - 1 - spr.ax) if flip else spr.ax
        ys, xs = np.nonzero(a)
        if not len(xs):
            return
        z = np.maximum(0, spr.ay - ys).astype(float)
        if zcap is not None:
            z = np.minimum(z, zcap)
        z *= squash
        px = np.round(fx - ax + xs + z * SX).astype(int)
        py = np.round(fy + z * SY).astype(int)
        ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
        m = np.zeros((H, W), bool)
        m[py[ok], px[ok]] = True
        m = ndimage.binary_closing(m, np.ones((3, 3), bool))
        if dapple:
            rng = random.Random(dapple)
            ys2, xs2 = np.nonzero(m)
            if len(xs2):
                x0_, x1_, y0_, y1_ = xs2.min(), xs2.max(), ys2.min(), ys2.max()
                inner = ndimage.binary_erosion(m, np.ones((7, 7), bool))
                edge_ = m & ~ndimage.binary_erosion(m, np.ones((3, 3), bool))
                eys, exs = np.nonzero(edge_)
                for k in range(0, len(exs), 9):
                    r1 = rng.uniform(3, 6)
                    e = ell_mask(W, H, exs[k] + rng.uniform(-1, 1), eys[k], r1, r1 * .45)
                    if rng.random() < .5:
                        m |= e
                    else:
                        m &= ~(e & ~inner)
                for (fx_, fy_) in poisson(rng, x0_, y0_, x1_, y1_, 16, 400):
                    if inner[int(fy_), int(fx_)]:
                        r1 = rng.uniform(1.8, 3.6)
                        m &= ~ell_mask(W, H, fx_, fy_, r1, r1 * .5)
        self.shadow |= m
        if contact:
            foot = np.zeros((H, W), bool)
            low = ys >= spr.ay - 3
            fxs = np.round(fx - ax + xs[low]).astype(int)
            for dy in (1, 2):
                for dx in (0, 1, 2):
                    yy_ = int(fy) + dy
                    ok2 = (fxs + dx >= 0) & (fxs + dx < W) & (0 <= yy_ < H)
                    foot[yy_, (fxs + dx)[ok2]] = True
            self.shadow |= foot

    def throw_ell(self, cx, cy, rx, ry):
        self.shadow |= ell_mask(self.W, self.H, cx, cy, rx, ry)

    def throw_poly(self, pts):
        self.shadow |= cpx.poly_mask(self.W, self.H, pts)

    def add(self, spr, fx, fy, z=None, flip=False):
        self.items.append((fy if z is None else z, 'ix', spr, int(round(fx)), int(round(fy)), flip))

    def add_rgba(self, a, x, y, z):
        self.items.append((z, 'rgba', a, int(x), int(y), False))

    def person(self, key, fx, fy, flip=False, z=None, contact_r=22):
        a = PP.load(key)
        if flip:
            a = a[:, ::-1].copy()
        fxl, fyl = PP.FEET[key]
        if flip:
            fxl = a.shape[1] - 1 - fxl
        sil = PP.silhouette(a)
        m, x0, y0 = PP.cast_shadow(sil, fxl, fyl)
        self.throw(m, fx + x0, fy + y0)
        self.throw_ell(fx + 3, fy + 1, contact_r, 6)
        self.add_rgba(PP.inked(a), fx - fxl, fy - fyl, fy if z is None else z)

    def render(self, extra_shade=None):
        g = self.g.copy()
        sh = self.shadow & np.isin(g, cpx.ids(SHADE_RAMPS))
        g[sh] = cpx.lut(-1)[g[sh]]
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
    cx0, cy0 = max(0, -x), max(0, -y)
    if cx0 >= im.width or cy0 >= im.height:
        return
    im = im.crop((cx0, cy0, im.width, im.height))
    out.alpha_composite(im, (max(0, x), max(0, y)))
