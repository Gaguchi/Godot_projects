"""Hyb64 ("Filigree"): the 64-bit tier's pixel kit.

One screen px = one art px. Everything here is drawn pixel by pixel into a Raster and emitted as
crisp SVG runs: window frames (carved walnut moulding, brass corner caps, inner keyline),
ornament rules, 24 px icons shaded in 4-5 tones, and sprite numerals rasterised from a book face
then shaded like FFT/Tactics Ogre damage digits.
All SVG ids are prefixed h64- so the boards can share a page with other directions.
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import json
import math
import re

import numpy as np
from scipy import ndimage

OUT = ROOT + '/out/boards'
HERE = ROOT + '/src/hyb-64'
SCOPE = 'dir-hyb64'
_blobs = json.load(open(ROOT + '/assets/blobs.json'))


def B(key):
    return '/_blob/' + _blobs[key]


# ---------------------------------------------------------------- palette: seven earthy ramps, 40 tones
RAMPS = [
    ('Ink', [('k0', '#110d0a'), ('k1', '#1b1510')]),
    ('Walnut', [('w0', '#211810'), ('w1', '#2b2017'), ('w2', '#372a1f'), ('w3', '#4a3828'), ('w4', '#5e4733'), ('w5', '#785a3e'), ('w6', '#94724e')]),
    ('Ochre', [('o0', '#3a2710'), ('o1', '#664518'), ('o2', '#936626'), ('o3', '#bf8c38'), ('o4', '#dcb156'), ('o5', '#f0d488'), ('o6', '#fcf1c8')]),
    ('Moss', [('m0', '#1c2714'), ('m1', '#2c3c21'), ('m2', '#43582c'), ('m3', '#64783b'), ('m4', '#8e9a55'), ('m5', '#b9bd84')]),
    ('Slate', [('s0', '#18212c'), ('s1', '#2b3c4e'), ('s2', '#4a6986'), ('s3', '#6e8faa'), ('s4', '#9cbbcf'), ('s5', '#d3e3eb')]),
    ('Oxblood', [('x0', '#2a0e0c'), ('x1', '#4b1916'), ('x2', '#772922'), ('x3', '#a23a2d'), ('x4', '#cd624a'), ('x5', '#ea997b')]),
    ('Bone', [('b0', '#6b6359'), ('b1', '#908676'), ('b2', '#b5a686'), ('b3', '#d5c8a7'), ('b4', '#ede1c4'), ('b5', '#faf5e6')]),
]
C = {k: v for _, r in RAMPS for k, v in r}
RAMP = {name: [k for k, _ in r] for name, r in RAMPS}
FONTS = ('https://fonts.googleapis.com/css2?family=Jacquard+24'
         '&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap')
TTF = {
    'serif900': HERE + '/ttf/Source_Serif_4_wght_900.ttf',
    'serif700': HERE + '/ttf/Source_Serif_4_wght_700.ttf',
    'fira800': HERE + '/ttf/Fira_Sans_Condensed_wght_800.ttf',
}


def col(c):
    if c in C:
        return C[c]
    if c == 'k':
        return C['k0']
    return c


# ---------------------------------------------------------------- raster (1 art px = 1 screen px)
class Raster:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y][x]
        return None

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.set(i, j, c)

    def hline(self, x0, x1, y, c):
        for i in range(x0, x1 + 1):
            self.set(i, y, c)

    def vline(self, x, y0, y1, c):
        for j in range(y0, y1 + 1):
            self.set(x, j, c)

    def stamp(self, rows, x, y, fx=False, fy=False, recolor=None, keymap=None):
        rows = list(rows)
        if fy:
            rows = rows[::-1]
        for j, row in enumerate(rows):
            if fx:
                row = row[::-1]
            for i, ch in enumerate(row):
                if ch in '. ':
                    continue
                if keymap and ch in keymap:
                    ch = keymap[ch]
                if recolor and ch in recolor:
                    ch = recolor[ch]
                self.set(x + i, y + j, ch)

    def blit(self, other, x, y):
        for j in range(other.h):
            for i in range(other.w):
                c = other.px[j][i]
                if c is not None:
                    self.set(x + i, y + j, c)

    def paths(self):
        runs = {}
        for y in range(self.h):
            row = self.px[y]
            x = 0
            while x < self.w:
                c = row[x]
                if c is None:
                    x += 1
                    continue
                x0 = x
                while x < self.w and row[x] == c:
                    x += 1
                runs.setdefault(c, []).append(f'M{x0} {y}h{x - x0}v1h-{x - x0}z')
        out = []
        for c, rs in runs.items():
            if c.startswith('sh'):           # hard shadow, ink at a fixed opacity: sh50 -> .50
                out.append(f'<path fill="{C["k0"]}" fill-opacity=".{c[2:]}" d="{"".join(rs)}"/>')
            else:
                out.append(f'<path fill="{col(c)}" d="{"".join(rs)}"/>')
        return ''.join(out)

    def svg(self, x=0, y=0, cls='', style='', extra=''):
        return (f'<svg class="abs {cls}" style="left:{x}px;top:{y}px;{style}" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}" shape-rendering="crispEdges">{self.paths()}{extra}</svg>')

    def inline(self, style=''):
        return (f'<svg style="display:inline-block;vertical-align:middle;{style}" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}" shape-rendering="crispEdges">{self.paths()}</svg>')


def from_rows(rows, keymap=None):
    h = len(rows)
    w = max(len(r) for r in rows)
    r = Raster(w, h)
    r.stamp(rows, 0, 0, keymap=keymap)
    return r


def flipx(rows):
    return [r[::-1] for r in rows]


def flipy(rows):
    return list(rows)[::-1]


# ---------------------------------------------------------------- ornaments (hand-placed)
# digits 0..6 = Ochre ramp (brass), k = ink. Light from the top-left.
BR = {str(i): f'o{i}' for i in range(7)}
# brass corner cap, top-left. It sits over the frame's corner and throws a small curl inward.
CORNER = [
    "kkkkkkkkkkkk......",
    "k55555554443k.....",
    "k56665544332k.kk..",
    "k56k44kk3321kk43k.",
    "k5k6k4k21kkk.k31k.",
    "k54k4k211k....kk..",
    "k5kk2k1k..........",
    "k54k1k0k..........",
    "k543kkk...........",
    "k443k.............",
    "k432k.............",
    "k332k.............",
    ".k21kk............",
    ".k31k.............",
    "..kk..............",
    "..................",
]
# a smaller cap for tags, cards and portraits
CORNER_S = [
    "kkkkkkk..",
    "k555443k.",
    "k5k4kk2k.",
    "k5k6k1k..",
    "k4k1kk...",
    "k43k.....",
    "k32k.....",
    ".kk......",
]
RIVET = [".k.", "k5k", ".k."]
# ornament rule: a brass lozenge with two short bars, centred on a 1 px rule
LOZENGE = [
    "....k....",
    "...k5k...",
    "..k564k..",
    "kk54443kk",
    "..k432k..",
    "...k2k...",
    "....k....",
]


# ---------------------------------------------------------------- window frames
WOOD_TL = ['w6', 'w5', 'w4', 'w2']     # rings 1..4 on the top and left (convex moulding, lit from top-left)
WOOD_BR = ['w1', 'w2', 'w3', 'w5']     # rings 1..4 on the bottom and right
BRASS_TL = ['o5', 'o4', 'o3', 'o1']
BRASS_BR = ['o0', 'o1', 'o2', 'o4']


def _ring(r, i, w, h, ctl, cbr, chamfer=0):
    """Ring i (inset i) coloured ctl on top+left, cbr on bottom+right; the TR/BL corner pixels split."""
    x0, y0, x1, y1 = i, i, w - 1 - i, h - 1 - i
    for x in range(x0 + chamfer, x1 + 1 - chamfer):
        r.set(x, y0, ctl)
        r.set(x, y1, cbr)
    for y in range(y0 + chamfer, y1 + 1 - chamfer):
        r.set(x0, y, ctl)
        r.set(x1, y, cbr)
    if not chamfer:
        r.set(x1, y0, ctl if ctl == cbr else ctl)
        r.set(x0, y1, cbr)


def frame(w, h, kind='win', corners=True, shadow=2, keyline=True):
    """A window frame as a raster of (w + shadow) x (h + shadow).
    kind: win (walnut moulding), lit (brass moulding: hovered or chosen), card, tag, plate (portrait)."""
    R = Raster(w + shadow, h + shadow)
    if shadow:
        for d in range(1, shadow + 1):
            for x in range(d + 1, w + d):
                R.set(x, h - 1 + d, 'sh55')
            for y in range(d + 1, h + d):
                R.set(w - 1 + d, y, 'sh55')
    tl, br = (BRASS_TL, BRASS_BR) if kind == 'lit' else (WOOD_TL, WOOD_BR)
    if kind in ('win', 'lit'):
        _ring(R, 0, w, h, 'k0', 'k0', chamfer=1)
        for i in range(4):
            _ring(R, i + 1, w, h, tl[i], br[i])
        _ring(R, 5, w, h, 'k0', 'k0')
        _ring(R, 6, w, h, 'w0', 'w2')          # the panel is recessed: a shadow row under the lit moulding
        if keyline:
            kl = 'o4' if kind == 'lit' else 'o1'
            kh = 'o5' if kind == 'lit' else 'o2'
            keyline_reentrant(R, 9, 9, w - 10, h - 10, kh, kl, 5)
        if corners:
            stamp_corner(R, w, h, 'L', lit=kind == 'lit')
    elif kind in ('card', 'cardlit'):
        tl, br = (BRASS_TL, BRASS_BR) if kind == 'cardlit' else (WOOD_TL, WOOD_BR)
        _ring(R, 0, w, h, 'k0', 'k0', chamfer=1)
        _ring(R, 1, w, h, tl[0], br[0])
        _ring(R, 2, w, h, tl[1], br[1])
        _ring(R, 3, w, h, tl[3], br[3])
        _ring(R, 4, w, h, 'k0', 'k0')
        _ring(R, 5, w, h, 'w0', 'w2')
        if keyline:
            kl, kh = ('o4', 'o5') if kind == 'cardlit' else ('o1', 'o2')
            keyline_reentrant(R, 7, 7, w - 8, h - 8, kh, kl, 3)
        if corners:
            stamp_corner(R, w, h, 'S', lit=kind == 'cardlit')
    elif kind in ('tag', 'taglit'):
        _ring(R, 0, w, h, 'k0', 'k0', chamfer=1)
        if kind == 'taglit':
            _ring(R, 1, w, h, 'o5', 'o1')
            _ring(R, 2, w, h, 'o3', 'o2')
        else:
            _ring(R, 1, w, h, 'w5', 'w1')
            _ring(R, 2, w, h, 'w3', 'w2')
        _ring(R, 3, w, h, 'k0', 'k0')
    elif kind == 'plate':   # portrait niche: ink, brass lip, ink
        _ring(R, 0, w, h, 'k0', 'k0')
        _ring(R, 1, w, h, 'o4', 'o1')
        _ring(R, 2, w, h, 'o2', 'o3')
        _ring(R, 3, w, h, 'k0', 'k0')
    elif kind == 'platelit':
        _ring(R, 0, w, h, 'k0', 'k0')
        _ring(R, 1, w, h, 'o6', 'o3')
        _ring(R, 2, w, h, 'o4', 'o5')
        _ring(R, 3, w, h, 'k0', 'k0')
    elif kind == 'well':    # a recessed slot (bars, gem sockets): dark lip on top-left, light on bottom-right
        _ring(R, 0, w, h, 'w0', 'w4')
        _ring(R, 1, w, h, 'k0', 'k0')
    return R


def keyline_reentrant(R, x0, y0, x1, y1, kh, kl, n):
    """A 1 px brass inlay with re-entrant (notched) corners, as on a carved or tooled panel.
    Top and left runs take the lit tone kh, bottom and right the darker kl; a dot sits in each notch."""
    for x in range(x0 + n, x1 - n + 1):
        R.set(x, y0, kh); R.set(x, y1, kl)
    for y in range(y0 + n, y1 - n + 1):
        R.set(x0, y, kh); R.set(x1, y, kl)
    for d in range(0, n + 1):
        R.set(x0 + n, y0 + d, kh); R.set(x0 + d, y0 + n, kh)          # TL notch
        R.set(x1 - n, y0 + d, kh); R.set(x1 - d, y0 + n, kl)          # TR notch
        R.set(x0 + n, y1 - d, kh); R.set(x0 + d, y1 - n, kl)          # BL notch
        R.set(x1 - n, y1 - d, kl); R.set(x1 - d, y1 - n, kl)          # BR notch
    m = n // 2
    for (x, y, c) in ((x0 + m, y0 + m, kh), (x1 - m, y0 + m, kh), (x0 + m, y1 - m, kl), (x1 - m, y1 - m, kl)):
        R.set(x, y, c)


def corner_parts(size='L'):
    """Brass corner cap in top-left local coords: a square boss with a rivet, and a strap along each edge."""
    parts = []
    if size == 'L':
        plate = {(x, y) for x in range(1, 9) for y in range(1, 9)} - {(8, 8)}
        top = {(x, y) for x in range(10, 16) for y in range(1, 5)} | {(16, 2), (16, 3)}
        left = {(x, y) for y in range(10, 16) for x in range(1, 5)} | {(2, 16), (3, 16)}
        rivet = (4, 4)
    else:
        plate = {(x, y) for x in range(1, 6) for y in range(1, 6)} - {(5, 5)}
        top = {(x, y) for x in range(7, 10) for y in range(1, 3)} | {(10, 1)}
        left = {(x, y) for y in range(7, 10) for x in range(1, 3)} | {(1, 10)}
        rivet = (2, 2)
    return [plate, top, left], rivet, size


def stamp_corner(R, w, h, size='L', lit=False):
    parts, rv, _ = corner_parts(size)
    S = {'L': 18, 'S': 12}[size]

    def tf(p, o):
        x, y = p
        if o in ('TR', 'BR'):
            x = w - 1 - x
        if o in ('BL', 'BR'):
            y = h - 1 - y
        return x, y
    hi = ['o3', 'o4', 'o5', 'o6'] if not lit else ['o4', 'o5', 'o6', 'o6']
    for o in ('TL', 'TR', 'BL', 'BR'):
        sp = [{tf(p, o) for p in part} for part in parts]
        allp = set().union(*sp)
        # ink outline (4-connected) around the whole cap
        for (x, y) in allp:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in allp and 0 <= q[0] < w and 0 <= q[1] < h:
                    R.set(q[0], q[1], 'k0')
        for part in sp:
            ys = [p[1] for p in part]
            ymid = (min(ys) + max(ys)) / 2
            for (x, y) in part:
                if (x, y - 1) not in part:
                    k = hi[2]
                elif (x - 1, y) not in part:
                    k = hi[2]
                elif (x, y + 1) not in part:
                    k = 'o1'
                elif (x + 1, y) not in part:
                    k = 'o2'
                else:
                    k = hi[1] if y <= ymid else hi[0]
                R.set(x, y, k)
            tlp = min(part, key=lambda p: p[0] + p[1])
            R.set(tlp[0], tlp[1], hi[3])
        # rivet: a dark ring with a lit dome
        cx, cy = tf(rv, o)
        sx = 1 if o in ('TL', 'BL') else -1
        sy = 1 if o in ('TL', 'TR') else -1
        if size == 'L':
            x0, y0 = min(cx, cx + sx), min(cy, cy + sy)
            for dx in range(-1, 3):
                for dy in range(-1, 3):
                    if dx in (-1, 2) or dy in (-1, 2):
                        if not (dx in (-1, 2) and dy in (-1, 2)):
                            R.set(x0 + dx, y0 + dy, 'o0')
            R.set(x0, y0, 'o6'); R.set(x0 + 1, y0, 'o4'); R.set(x0, y0 + 1, 'o4'); R.set(x0 + 1, y0 + 1, 'o2')
        else:
            R.set(cx, cy, 'o6')
            R.set(cx + 1, cy, 'o1'); R.set(cx, cy + 1, 'o1')


def _shade_flip(km):
    """Bottom corners face away from the light: shift the brass ramp two tones darker."""
    out = {}
    for k, v in km.items():
        i = int(v[1])
        out[k] = f'o{max(0, i - 2)}'
    return out


FILL = {
    'win': ('#2b2017', 'rgba(255,232,196,.028)'),
    'lit': ('#2e2218', 'rgba(255,232,196,.03)'),
    'card': ('#2f2319', 'rgba(255,232,196,.028)'),
    'cardlit': ('#33261a', 'rgba(255,232,196,.032)'),
    'tag': ('#372a1f', 'rgba(255,232,196,.03)'),
    'taglit': ('#3d2e1f', 'rgba(255,232,196,.03)'),
}


def _tonal(ih):
    """The panel's tonal shift: the top third a shade warmer, met by a 1 px checker band (no gradient)."""
    if ih < 40:
        return ''
    t = int(ih * .34)
    return (f'<div class="abs" style="left:0;top:0;right:0;height:{t}px;background:rgba(255,226,180,.022)"></div>'
            f'<div class="abs" style="left:0;top:{t}px;right:0;height:4px;background-image:repeating-conic-gradient(rgba(255,226,180,.022) 0 25%,transparent 0 50%);background-size:2px 2px"></div>')


def window(x, y, w, h, inner='', kind='win', corners=True, keyline=True, shadow=2, cls='', style=''):
    """Absolutely positioned window: dithered fill, pixel frame, then content (positioned from the window's 0,0)."""
    inset = {'win': 6, 'lit': 6, 'card': 5, 'cardlit': 5, 'tag': 3, 'taglit': 3}[kind]
    base, dot = FILL[kind]
    fr = frame(w, h, kind, corners=corners, shadow=shadow, keyline=keyline)
    return (f'<div class="abs win-c {cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{style}">'
            f'<div class="abs fill" style="left:{inset}px;top:{inset}px;right:{inset}px;bottom:{inset}px;background-color:{base};'
            f'background-image:repeating-conic-gradient({dot} 0 25%,transparent 0 50%);background-size:2px 2px">{_tonal(h - 2 * inset)}</div>'
            f'{fr.svg(0, 0)}{inner}</div>')


def rule(x, y, w, orn=True, tone='o2'):
    """Ornament rule: a carved groove (dark over light) with a brass lozenge in the middle."""
    R = Raster(w, 7)
    for i in range(w):
        R.set(i, 3, 'w0')
        R.set(i, 4, 'w3')
    R.set(0, 3, None); R.set(w - 1, 4, None)
    if orn:
        R.stamp(LOZENGE, w // 2 - 4, 0, keymap=BR)
        for dx in (-12, 11):
            R.stamp(RIVET, w // 2 + dx, 2, keymap=BR)
    return R.svg(x, y - 3)


def groove(x, y, w):
    R = Raster(w, 2)
    for i in range(w):
        R.set(i, 0, 'w0'); R.set(i, 1, 'w3')
    return R.svg(x, y)


# ---------------------------------------------------------------- procedural shading for icons
def _grid(w, h, ss=4):
    ys, xs = np.mgrid[0:h * ss, 0:w * ss]
    return (xs + .5) / ss, (ys + .5) / ss, ss


def cover(fn, w, h, ss=4, thresh=.5):
    X, Y, s = _grid(w, h, ss)
    m = fn(X, Y).astype(float)
    cov = m.reshape(h, s, w, s).mean(axis=(1, 3))
    return cov >= thresh


def circle(cx, cy, r):
    return lambda X, Y: (X - cx) ** 2 + (Y - cy) ** 2 <= r * r


def ellipse(cx, cy, rx, ry):
    return lambda X, Y: ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1


def poly(pts):
    P = np.array(pts, float)

    def fn(X, Y):
        inside = np.zeros_like(X, bool)
        n = len(P)
        j = n - 1
        for i in range(n):
            xi, yi = P[i]
            xj, yj = P[j]
            cond = ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi + 1e-9) + xi)
            inside ^= cond
            j = i
        return inside
    return fn


def rect_(x0, y0, x1, y1):
    return lambda X, Y: (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1)


def union(*fs):
    return lambda X, Y: np.logical_or.reduce([f(X, Y) for f in fs])


def minus(a, b):
    return lambda X, Y: a(X, Y) & ~b(X, Y)


def shade(mask, ramp, R=3.0, light=(-1.0, -1.25, 1.35), bias=0.0, gain=1.0, glint=True):
    """Dome-shade a boolean mask into ramp keys (dark -> light). Returns an array of keys (or None)."""
    D = ndimage.distance_transform_edt(mask)
    t = np.clip(D / R, 0, 1)
    hgt = np.sqrt(np.clip(1 - (1 - t) ** 2, 0, 1)) * R
    hgt = ndimage.gaussian_filter(hgt, .6) * mask
    gy, gx = np.gradient(hgt)
    nz = np.ones_like(hgt)
    n = np.sqrt(gx ** 2 + gy ** 2 + nz ** 2)
    L = np.array(light) / np.linalg.norm(light)
    lam = (-gx * L[0] - gy * L[1] + nz * L[2]) / n
    N = len(ramp)
    v = (lam - 0.05 + bias) / 0.95 * gain
    idx = np.clip(np.round(v * (N - 1)), 0, N - 1).astype(int)
    out = np.empty(mask.shape, object)
    out[:] = None
    for j, i in zip(*np.nonzero(mask)):
        out[j, i] = ramp[idx[j, i]]
    if glint:
        cand = np.where(mask, lam, -9)
        j, i = np.unravel_index(np.argmax(cand), cand.shape)
        out[j, i] = ramp[-1]
    return out


def outline(mask, conn=4):
    st = ndimage.generate_binary_structure(2, 1 if conn == 4 else 2)
    return ndimage.binary_dilation(mask, st) & ~mask


class Icon:
    """Layered pixel icon: each layer is a mask + ramp, outlined in ink (outer) or a dark tone (inner)."""

    def __init__(self, w=24, h=24):
        self.w, self.h = w, h
        self.keys = np.empty((h, w), object)
        self.keys[:] = None
        self.solid = np.zeros((h, w), bool)

    def layer(self, mask, ramp, R=3.0, inner_line=None, **kw):
        sh = shade(mask, ramp, R=R, **kw)
        if inner_line:   # separate this layer from what it sits on with a dark line
            ol = outline(mask) & self.solid
            for j, i in zip(*np.nonzero(ol)):
                self.keys[j, i] = inner_line
        for j, i in zip(*np.nonzero(mask)):
            self.keys[j, i] = sh[j, i]
        self.solid |= mask
        return self

    def put(self, x, y, k):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.keys[y, x] = k
            self.solid[y, x] = True

    def stamp(self, rows, x, y, keymap=None):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in '. ':
                    continue
                self.put(x + i, y + j, keymap.get(ch, ch) if keymap else ch)
        return self

    def raster(self, ink='k0', conn=4):
        r = Raster(self.w, self.h)
        ol = outline(self.solid, conn)
        for j, i in zip(*np.nonzero(ol)):
            r.set(int(i), int(j), ink)
        for j in range(self.h):
            for i in range(self.w):
                if self.keys[j, i] is not None:
                    r.set(i, j, self.keys[j, i])
        return r


# ---------------------------------------------------------------- sprite numerals
_font_cache = {}


def _font(name, size):
    from PIL import ImageFont
    k = (name, size)
    if k not in _font_cache:
        _font_cache[k] = ImageFont.truetype(TTF[name], size)
    return _font_cache[k]


def numeral(text, size, ramp='Oxblood', face='serif900', track=2, ink='k0', drop=1, thresh=110, outline_conn=8):
    """Rasterise text in a book face at 1x, threshold to 1-bit, then shade it as a sprite:
    tone bands top to bottom, a lit top edge, an ink outline and a hard drop.
    Glyphs are packed by their inked width plus `track` px, so 11 sits tight like a hand-set sprite."""
    from PIL import Image, ImageDraw
    f = _font(face, size)
    asc, desc = f.getmetrics()
    H = asc + desc + 4
    cols = []
    for ch in text:
        if ch == ' ':
            cols.append(np.zeros((H, max(2, int(size * .22))), bool))
            continue
        im = Image.new('L', (size * 2, H), 0)
        ImageDraw.Draw(im).text((size // 2, 2), ch, font=f, fill=255)
        g = np.array(im) >= thresh
        xs = np.nonzero(g.any(axis=0))[0]
        cols.append(g[:, xs.min():xs.max() + 1])
    pieces = []
    for i, c in enumerate(cols):
        pieces.append(c)
        if i < len(cols) - 1:
            pieces.append(np.zeros((H, track), bool))
    strip_arr = np.concatenate(pieces, axis=1)
    a = strip_arr
    ys, xs = np.nonzero(a)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    m = np.pad(a, 2)
    h, w = m.shape
    tones = RAMP[ramp]
    top, bot = 2, h - 3
    out = Raster(w + drop, h + drop)
    ol = outline(m, outline_conn)
    if drop:
        dm = np.zeros((h + drop, w + drop), bool)
        dm[drop:, drop:] = m | ol
        for j, i in zip(*np.nonzero(dm)):
            out.set(int(i), int(j), ink)
    for j, i in zip(*np.nonzero(ol)):
        out.set(int(i), int(j), ink)
    n = len(tones)
    for j, i in zip(*np.nonzero(m)):
        # two body tones split at mid-height, a lit top edge and a dark foot: shading, not a gradient
        k = tones[n - 2] if j < (top + bot) / 2 else tones[n - 3]
        if not m[j - 1, i]:
            k = tones[n - 1]
        elif not m[j + 1, i] or not m[j, i + 1]:
            k = tones[max(0, n - 5)]
        out.set(int(i), int(j), k)
    return out


# ---------------------------------------------------------------- css
def css_base(extra=''):
    s = SCOPE
    k = C['k0']
    ol1 = ','.join(f'{dx}px {dy}px 0 {k}' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)))
    ol1d = ol1 + f',1px 2px 0 {k},0 2px 0 {k},2px 2px 0 rgba(17,13,10,.6)'
    return f"""
body{{margin:0}}
.{s}{{position:relative;overflow:hidden;font-family:'Source Serif 4',serif;font-optical-sizing:auto;font-variant-numeric:lining-nums tabular-nums;
  color:{C['b4']};background:{C['m3']};will-change:transform;-webkit-user-select:none;user-select:none;cursor:default}}
.{s} *{{box-sizing:border-box;margin:0;padding:0}}
.{s} .abs{{position:absolute}}
.{s} .bl{{font-family:'Jacquard 24',serif;font-size:24px;line-height:24px;font-weight:400;letter-spacing:0}}
.{s} .bl48{{font-family:'Jacquard 24',serif;font-size:48px;line-height:48px;font-weight:400}}
.{s} .s13{{font-size:13px;line-height:16px;font-weight:600}}
.{s} .s14{{font-size:14px;line-height:18px;font-weight:600}}
.{s} .s15{{font-size:15px;line-height:19px;font-weight:600}}
.{s} .s16{{font-size:16px;line-height:20px;font-weight:700}}
.{s} .s18{{font-size:18px;line-height:22px;font-weight:700}}
.{s} .s20{{font-size:20px;line-height:24px;font-weight:700}}
.{s} .lt{{font-weight:400}}
.{s} .sc{{font-variant-caps:all-small-caps;letter-spacing:.06em}}
.{s} .bone{{color:{C['b4']}}} .{s} .dim{{color:{C['b2']}}} .{s} .faint{{color:{C['b1']}}} .{s} .ochre{{color:{C['o3']}}} .{s} .straw{{color:{C['o5']}}}
.{s} .rust{{color:{C['x4']}}} .{s} .rill{{color:{C['s4']}}} .{s} .meadow{{color:{C['m4']}}} .{s} .ink{{color:{k}}}
.{s} .nowrap{{white-space:nowrap}}
.{s} .ol1{{text-shadow:{ol1}}}
.{s} .ol1d{{text-shadow:{ol1d}}}
.{s} .sh1{{text-shadow:1px 1px 0 {k}}}
.{s} .win-c{{text-shadow:1px 1px 0 rgba(17,13,10,.85)}}
.{s} .key{{display:inline-block;position:relative;font-size:13px;line-height:15px;font-weight:700;color:{C['w1']};
  background:{C['b3']};padding:1px 6px 2px;margin:0 2px;vertical-align:1px;
  box-shadow:inset 1px 1px 0 0 {C['b5']},inset -1px -1px 0 0 {C['b1']},inset 0 -2px 0 0 {C['b1']},0 0 0 1px {k},1px 2px 0 1px rgba(17,13,10,.55)}}
{extra}
"""


def numerals_off(html):
    return html


def wrap(title, body_html, css, w, h):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="{FONTS}">
<style>
{css}
</style>
</helmet>
<div class="{SCOPE}" style="width:{w}px;height:{h}px;position:relative;overflow:hidden">
{body_html}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""


def write(name, html):
    p = f'{OUT}/{name}.dc.html'
    with open(p, 'w', encoding='utf-8') as fh:
        fh.write(html)
    return p
