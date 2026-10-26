"""Filigree kit, pixel core: palette, the art-pixel Raster, window frames, ornaments, icon shading, cast digits.

1 art px = 1 screen px. Everything is placed pixel by pixel into a Raster and emitted as crisp SVG runs.
Cleaned up from dirs/hyb-64/px64.py. Screen scripts import `kit`, not this module.
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import json
import math

import numpy as np
from scipy import ndimage

OUT = ROOT + '/out/boards'
HERE = ROOT + '/src/kit64'
TTF_DIR = ROOT + '/src/hyb-64/ttf'
_blobs = json.load(open(ROOT + '/assets/blobs.json'))


def B(key):
    """The /_blob/<id> url of an asset from the BRIEF table, e.g. B('face_roy')."""
    return '/_blob/' + _blobs[key]


# ---------------------------------------------------------------- palette: seven earthy ramps, dark -> light
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
BR = {str(i): f'o{i}' for i in range(7)}          # digits in hand-drawn rows -> brass tones


def col(c):
    """Palette key (or raw colour) -> hex."""
    if c in C:
        return C[c]
    if c == 'k':
        return C['k0']
    return c


def rgba(key, a):
    """Palette key at alpha a, as a CSS rgba()."""
    h = C[key]
    return f'rgba({int(h[1:3], 16)},{int(h[3:5], 16)},{int(h[5:7], 16)},{a})'


# ---------------------------------------------------------------- raster
class Raster:
    """An art-pixel canvas of palette keys. `sh55` style keys are ink at a fixed opacity (hard shadows)."""

    def __init__(self, w, h):
        """A blank canvas."""
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def set(self, x, y, c):
        """Set one pixel (ignores out-of-range)."""
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def get(self, x, y):
        """Read one pixel (None outside)."""
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y][x]
        return None

    def rect(self, x, y, w, h, c):
        """Fill a rectangle."""
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.set(i, j, c)

    def hline(self, x0, x1, y, c):
        """A horizontal line, inclusive."""
        for i in range(x0, x1 + 1):
            self.set(i, y, c)

    def vline(self, x, y0, y1, c):
        """A vertical line, inclusive."""
        for j in range(y0, y1 + 1):
            self.set(x, j, c)

    def stamp(self, rows, x, y, fx=False, fy=False, keymap=None):
        """Stamp hand-drawn rows at (x, y), optionally mirrored, with keys renamed."""
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
                self.set(x + i, y + j, ch)

    def blit(self, other, x, y):
        """Copy another raster on at (x, y), skipping clear pixels."""
        for j in range(other.h):
            for i in range(other.w):
                c = other.px[j][i]
                if c is not None:
                    self.set(x + i, y + j, c)

    def recolor(self, fn):
        """A copy with every key passed through fn(key) -> key."""
        r = Raster(self.w, self.h)
        for j in range(self.h):
            for i in range(self.w):
                c = self.px[j][i]
                if c is not None:
                    r.px[j][i] = fn(c)
        return r

    def paths(self):
        """One SVG path per key. Horizontal runs that repeat on the rows below merge into one rectangle."""
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
                runs.setdefault(c, {}).setdefault(y, []).append((x0, x - x0))
        out = []
        for c, rows in runs.items():
            rects = []
            active = {}
            for y in range(self.h + 1):
                cur = set(rows.get(y, ()))
                for key in list(active):
                    if key not in cur:
                        y0 = active.pop(key)
                        rects.append((key[0], y0, key[1], y - y0))
                for key in cur:
                    if key not in active:
                        active[key] = y
            d = ''.join(f'M{x0} {y0}h{w}v{h}h-{w}z' for x0, y0, w, h in rects)
            if c.startswith('sh'):
                out.append(f'<path fill="{C["k0"]}" fill-opacity=".{c[2:]}" d="{d}"/>')
            else:
                out.append(f'<path fill="{col(c)}" d="{d}"/>')
        return ''.join(out)

    def svg(self, x=0, y=0, cls='', style='', scale=1):
        """Absolutely positioned at (x, y). scale=2 doubles every art pixel (silhouettes only)."""
        return (f'<svg class="abs {cls}" style="left:{x}px;top:{y}px;{style}" width="{self.w * scale}" height="{self.h * scale}" '
                f'viewBox="0 0 {self.w} {self.h}" shape-rendering="crispEdges">{self.paths()}</svg>')

    def inline(self, style='', scale=1):
        """Inline, vertically centred on the text line."""
        return (f'<svg style="display:inline-block;vertical-align:middle;{style}" width="{self.w * scale}" height="{self.h * scale}" '
                f'viewBox="0 0 {self.w} {self.h}" shape-rendering="crispEdges">{self.paths()}</svg>')

    def data_uri(self):
        """As a data: url, for CSS backgrounds and border-images."""
        s = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" '
             f'shape-rendering="crispEdges">{self.paths()}</svg>')
        return "url(\"data:image/svg+xml," + s.replace('#', '%23').replace('"', "'").replace('<', '%3C').replace('>', '%3E') + "\")"


def from_rows(rows, keymap=None):
    """A raster from hand-drawn rows of keys (. or space = clear); keymap renames keys."""
    h = len(rows)
    w = max(len(r) for r in rows)
    r = Raster(w, h)
    r.stamp(rows, 0, 0, keymap=keymap)
    return r


# ---------------------------------------------------------------- ornaments
RIVET = [".k.", "k5k", ".k."]
LOZENGE = [
    "....k....",
    "...k5k...",
    "..k564k..",
    "kk54443kk",
    "..k432k..",
    "...k2k...",
    "....k....",
]
WOOD_TL = ['w6', 'w5', 'w4', 'w2']     # moulding rings 1..4, top and left (lit from the north-west)
WOOD_BR = ['w1', 'w2', 'w3', 'w5']     # rings 1..4, bottom and right
BRASS_TL = ['o5', 'o4', 'o3', 'o1']
BRASS_BR = ['o0', 'o1', 'o2', 'o4']


def _ring(r, i, w, h, ctl, cbr, chamfer=0):
    """Ring at inset i: ctl on top + left, cbr on bottom + right."""
    x0, y0, x1, y1 = i, i, w - 1 - i, h - 1 - i
    for x in range(x0 + chamfer, x1 + 1 - chamfer):
        r.set(x, y0, ctl)
        r.set(x, y1, cbr)
    for y in range(y0 + chamfer, y1 + 1 - chamfer):
        r.set(x0, y, ctl)
        r.set(x1, y, cbr)
    if not chamfer:
        r.set(x1, y0, ctl)
        r.set(x0, y1, cbr)


def keyline(R, x0, y0, x1, y1, kh, kl, n):
    """A 1 px brass inlay with notched (re-entrant) corners and a dot in each notch."""
    for x in range(x0 + n, x1 - n + 1):
        R.set(x, y0, kh); R.set(x, y1, kl)
    for y in range(y0 + n, y1 - n + 1):
        R.set(x0, y, kh); R.set(x1, y, kl)
    for d in range(0, n + 1):
        R.set(x0 + n, y0 + d, kh); R.set(x0 + d, y0 + n, kh)
        R.set(x1 - n, y0 + d, kh); R.set(x1 - d, y0 + n, kl)
        R.set(x0 + n, y1 - d, kh); R.set(x0 + d, y1 - n, kl)
        R.set(x1 - n, y1 - d, kl); R.set(x1 - d, y1 - n, kl)
    m = n // 2
    for (x, y, c) in ((x0 + m, y0 + m, kh), (x1 - m, y0 + m, kh), (x0 + m, y1 - m, kl), (x1 - m, y1 - m, kl)):
        R.set(x, y, c)


def _corner_parts(size='L'):
    """The cap pieces (boss, top strap, left strap) and the rivet point, in top-left local coords."""
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
    return [plate, top, left], rivet


def stamp_corners(R, w, h, size='L', lit=False):
    """Brass corner caps (a boss with a rivet and a short strap along each edge) on all four corners."""
    parts, rv = _corner_parts(size)
    hi = ['o3', 'o4', 'o5', 'o6'] if not lit else ['o4', 'o5', 'o6', 'o6']

    def tf(p, o):
        x, y = p
        if o in ('TR', 'BR'):
            x = w - 1 - x
        if o in ('BL', 'BR'):
            y = h - 1 - y
        return x, y
    for o in ('TL', 'TR', 'BL', 'BR'):
        sp = [{tf(p, o) for p in part} for part in parts]
        allp = set().union(*sp)
        for (x, y) in allp:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in allp and 0 <= q[0] < w and 0 <= q[1] < h:
                    R.set(q[0], q[1], 'k0')
        for part in sp:
            ys = [p[1] for p in part]
            ymid = (min(ys) + max(ys)) / 2
            for (x, y) in part:
                if (x, y - 1) not in part or (x - 1, y) not in part:
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
        cx, cy = tf(rv, o)
        sx = 1 if o in ('TL', 'BL') else -1
        sy = 1 if o in ('TL', 'TR') else -1
        if size == 'L':
            x0, y0 = min(cx, cx + sx), min(cy, cy + sy)
            for dx in range(-1, 3):
                for dy in range(-1, 3):
                    if (dx in (-1, 2) or dy in (-1, 2)) and not (dx in (-1, 2) and dy in (-1, 2)):
                        R.set(x0 + dx, y0 + dy, 'o0')
            R.set(x0, y0, 'o6'); R.set(x0 + 1, y0, 'o4'); R.set(x0, y0 + 1, 'o4'); R.set(x0 + 1, y0 + 1, 'o2')
        else:
            R.set(cx, cy, 'o6')
            R.set(cx + 1, cy, 'o1'); R.set(cx, cy + 1, 'o1')


def frame(w, h, kind='win', corners=True, shadow=2, keyline_on=True):
    """A frame raster of (w + shadow) x (h + shadow).
    kind: win | lit (window, brass moulding), card | cardlit, tag | taglit, plate | platelit (face niche), well (recess)."""
    R = Raster(w + shadow, h + shadow)
    if shadow:
        for d in range(1, shadow + 1):
            for x in range(d + 1, w + d):
                R.set(x, h - 1 + d, 'sh55')
            for y in range(d + 1, h + d):
                R.set(w - 1 + d, y, 'sh55')
    if kind in ('win', 'lit'):
        tl, br = (BRASS_TL, BRASS_BR) if kind == 'lit' else (WOOD_TL, WOOD_BR)
        _ring(R, 0, w, h, 'k0', 'k0', chamfer=1)
        for i in range(4):
            _ring(R, i + 1, w, h, tl[i], br[i])
        _ring(R, 5, w, h, 'k0', 'k0')
        _ring(R, 6, w, h, 'w0', 'w2')
        if keyline_on:
            kh, kl = ('o5', 'o4') if kind == 'lit' else ('o2', 'o1')
            keyline(R, 9, 9, w - 10, h - 10, kh, kl, 5)
        if corners:
            stamp_corners(R, w, h, 'L', lit=kind == 'lit')
    elif kind in ('card', 'cardlit'):
        tl, br = (BRASS_TL, BRASS_BR) if kind == 'cardlit' else (WOOD_TL, WOOD_BR)
        _ring(R, 0, w, h, 'k0', 'k0', chamfer=1)
        _ring(R, 1, w, h, tl[0], br[0])
        _ring(R, 2, w, h, tl[1], br[1])
        _ring(R, 3, w, h, tl[3], br[3])
        _ring(R, 4, w, h, 'k0', 'k0')
        _ring(R, 5, w, h, 'w0', 'w2')
        if keyline_on:
            kh, kl = ('o5', 'o4') if kind == 'cardlit' else ('o2', 'o1')
            keyline(R, 7, 7, w - 8, h - 8, kh, kl, 3)
        if corners:
            stamp_corners(R, w, h, 'S', lit=kind == 'cardlit')
    elif kind in ('tag', 'taglit'):
        _ring(R, 0, w, h, 'k0', 'k0', chamfer=1)
        if kind == 'taglit':
            _ring(R, 1, w, h, 'o5', 'o1'); _ring(R, 2, w, h, 'o3', 'o2')
        else:
            _ring(R, 1, w, h, 'w5', 'w1'); _ring(R, 2, w, h, 'w3', 'w2')
        _ring(R, 3, w, h, 'k0', 'k0')
    elif kind == 'plate':
        _ring(R, 0, w, h, 'k0', 'k0'); _ring(R, 1, w, h, 'o4', 'o1'); _ring(R, 2, w, h, 'o2', 'o3'); _ring(R, 3, w, h, 'k0', 'k0')
    elif kind == 'platelit':
        _ring(R, 0, w, h, 'k0', 'k0'); _ring(R, 1, w, h, 'o6', 'o3'); _ring(R, 2, w, h, 'o4', 'o5'); _ring(R, 3, w, h, 'k0', 'k0')
    elif kind == 'well':
        _ring(R, 0, w, h, 'w0', 'w4'); _ring(R, 1, w, h, 'k0', 'k0')
    return R


FILL = {   # panel base colour and the faint 1 px dither laid over it
    'win': ('#2b2017', 'rgba(255,232,196,.028)'), 'lit': ('#2e2218', 'rgba(255,232,196,.03)'),
    'card': ('#2f2319', 'rgba(255,232,196,.028)'), 'cardlit': ('#33261a', 'rgba(255,232,196,.032)'),
    'tag': ('#372a1f', 'rgba(255,232,196,.03)'), 'taglit': ('#3d2e1f', 'rgba(255,232,196,.03)'),
}
INSET = {'win': 6, 'lit': 6, 'card': 5, 'cardlit': 5, 'tag': 3, 'taglit': 3}


def dither_css(base, dot):
    """CSS for a base colour with a faint 1 px checker laid over it."""
    return f'background-color:{base};background-image:repeating-conic-gradient({dot} 0 25%,transparent 0 50%);background-size:2px 2px'


def _tonal(ih):
    """The panel's tonal shift: the top third a shade warmer, met by a 1 px checker band (no gradient)."""
    if ih < 40:
        return ''
    t = int(ih * .34)
    return (f'<div class="abs" style="left:0;top:0;right:0;height:{t}px;background:rgba(255,226,180,.022)"></div>'
            f'<div class="abs" style="left:0;top:{t}px;right:0;height:4px;background-image:repeating-conic-gradient(rgba(255,226,180,.022) 0 25%,transparent 0 50%);background-size:2px 2px"></div>')


def panel(x, y, w, h, inner='', kind='win', corners=True, keyline_on=True, shadow=2, cls='', style=''):
    """A positioned framed panel: dithered fill, pixel frame, then `inner` (positioned from the panel's 0,0)."""
    inset = INSET[kind]
    base, dot = FILL[kind]
    fr = frame(w, h, kind, corners=corners, shadow=shadow, keyline_on=keyline_on)
    return (f'<div class="abs win {cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{style}">'
            f'<div class="abs" style="left:{inset}px;top:{inset}px;right:{inset}px;bottom:{inset}px;{dither_css(base, dot)}">{_tonal(h - 2 * inset)}</div>'
            f'{fr.svg(0, 0)}{inner}</div>')


def rule_raster(w, orn=True):
    """The ornament rule as a raster, 7 px tall, the groove on rows 3-4."""
    R = Raster(w, 7)
    for i in range(w):
        R.set(i, 3, 'w0')
        R.set(i, 4, 'w3')
    R.set(0, 3, None); R.set(w - 1, 4, None)
    if orn:
        R.stamp(LOZENGE, w // 2 - 4, 0, keymap=BR)
        for dx in (-12, 11):
            R.stamp(RIVET, w // 2 + dx, 2, keymap=BR)
    return R


def groove_raster(w):
    """The 2 px groove as a raster."""
    R = Raster(w, 2)
    for i in range(w):
        R.set(i, 0, 'w0'); R.set(i, 1, 'w3')
    return R


# ---------------------------------------------------------------- bracket cursor ("what you point at")
BRK = [
    "kkkkkkkkkkkkk",
    "k6655555444kk",
    "k65kkkkkkkkk.",
    "k54k.........",
    "k54k.........",
    "k54k.........",
    "k43k.........",
    "k43k.........",
    "k43k.........",
    "k32k.........",
    "k32k.........",
    "kkkk.........",
    ".k...........",
]
BRK_S = [
    "kkkkkkkk",
    "k66554kk",
    "k5kkkkk.",
    "k4k.....",
    "k4k.....",
    "k3k.....",
    "kkk.....",
]
_BK_LIT = {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o2'}
_BK_DK = {'6': 'o4', '5': 'o4', '4': 'o3', '3': 'o2', '2': 'o1'}


def bracket_corner(pos, small=False):
    """One bracket corner raster: pos in TL TR BL BR."""
    rows = BRK_S if small else BRK
    fx, fy = pos in ('TR', 'BR'), pos in ('BL', 'BR')
    r = Raster(len(rows[0]), len(rows))
    r.stamp(rows, 0, 0, fx=fx, fy=fy, keymap=_BK_DK if fy else _BK_LIT)
    return r


def brackets_raster(w, h, small=False):
    """All four bracket corners on a w x h raster."""
    R = Raster(w, h)
    for pos in ('TL', 'TR', 'BL', 'BR'):
        c = bracket_corner(pos, small)
        R.blit(c, 0 if pos in ('TL', 'BL') else w - c.w, 0 if pos in ('TL', 'TR') else h - c.h)
    return R


# ---------------------------------------------------------------- procedural shading for icons
def _grid(w, h, ss=4):
    """Supersampled pixel-centre coordinates for coverage tests."""
    ys, xs = np.mgrid[0:h * ss, 0:w * ss]
    return (xs + .5) / ss, (ys + .5) / ss, ss


def cover(fn, w, h, ss=4, thresh=.5):
    """Rasterise a shape function to a boolean coverage mask at 1x (4x supersampled)."""
    X, Y, s = _grid(w, h, ss)
    m = fn(X, Y).astype(float)
    cov = m.reshape(h, s, w, s).mean(axis=(1, 3))
    return cov >= thresh


def circle(cx, cy, r):
    """Shape function: a disc."""
    return lambda X, Y: (X - cx) ** 2 + (Y - cy) ** 2 <= r * r


def ellipse(cx, cy, rx, ry):
    """Shape function: an ellipse."""
    return lambda X, Y: ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1


def poly(pts):
    """Shape function: a polygon (even-odd)."""
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
    """Shape function: an axis-aligned rectangle."""
    return lambda X, Y: (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1)


def seg(x0, y0, x1, y1, r):
    """A capsule (thick line) from (x0,y0) to (x1,y1) with radius r."""
    def fn(X, Y):
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy + 1e-9
        t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
        px, py = x0 + t * dx, y0 + t * dy
        return (X - px) ** 2 + (Y - py) ** 2 <= r * r
    return fn


def union(*fs):
    """Shape function: the union of several."""
    return lambda X, Y: np.logical_or.reduce([f(X, Y) for f in fs])


def minus(a, b):
    """Shape function: a minus b."""
    return lambda X, Y: a(X, Y) & ~b(X, Y)


def shade(mask, ramp, R=3.0, light=(-1.0, -1.25, 1.35), bias=0.0, gain=1.0, glint=True):
    """Dome-shade a boolean mask into ramp keys (dark -> light)."""
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
    if glint and mask.any():
        cand = np.where(mask, lam, -9)
        j, i = np.unravel_index(np.argmax(cand), cand.shape)
        out[j, i] = ramp[-1]
    return out


def outline(mask, conn=4):
    """The pixels just outside a mask (4- or 8-connected)."""
    st = ndimage.generate_binary_structure(2, 1 if conn == 4 else 2)
    return ndimage.binary_dilation(mask, st) & ~mask


class Icon:
    """Layered pixel icon: each layer is a mask + ramp; the whole is outlined in ink."""

    def __init__(self, w=24, h=24):
        """A blank canvas."""
        self.w, self.h = w, h
        self.keys = np.empty((h, w), object)
        self.keys[:] = None
        self.solid = np.zeros((h, w), bool)

    def m(self, fn):
        """Coverage mask of a shape function at this icon's size."""
        return cover(fn, self.w, self.h)

    def layer(self, mask, ramp, R=3.0, inner_line=None, **kw):
        """Add a shaded layer (mask + ramp); inner_line separates it from what it covers."""
        if not isinstance(mask, np.ndarray):
            mask = self.m(mask)
        sh = shade(mask, ramp, R=R, **kw)
        if inner_line:
            ol = outline(mask) & self.solid
            for j, i in zip(*np.nonzero(ol)):
                self.keys[j, i] = inner_line
        for j, i in zip(*np.nonzero(mask)):
            self.keys[j, i] = sh[j, i]
        self.solid |= mask
        return self

    def flat(self, mask, key):
        """Add a flat single-key layer."""
        if not isinstance(mask, np.ndarray):
            mask = self.m(mask)
        for j, i in zip(*np.nonzero(mask)):
            self.keys[j, i] = key
        self.solid |= mask
        return self

    def put(self, x, y, k):
        """Set one pixel and mark it solid."""
        if 0 <= x < self.w and 0 <= y < self.h:
            self.keys[y, x] = k
            self.solid[y, x] = True
        return self

    def stamp(self, rows, x, y, keymap=None):
        """Stamp hand-drawn rows at (x, y), optionally mirrored, with keys renamed."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in '. ':
                    continue
                self.put(x + i, y + j, keymap.get(ch, ch) if keymap else ch)
        return self

    def raster(self, ink='k0', conn=4):
        """Flatten to a Raster with the ink outline grown around the solid shape."""
        r = Raster(self.w, self.h)
        ol = outline(self.solid, conn)
        for j, i in zip(*np.nonzero(ol)):
            r.set(int(i), int(j), ink)
        for j in range(self.h):
            for i in range(self.w):
                if self.keys[j, i] is not None:
                    r.set(i, j, self.keys[j, i])
        return r


# ---------------------------------------------------------------- cast digits
_font_cache = {}
TTF = {'serif900': TTF_DIR + '/Source_Serif_4_wght_900.ttf', 'serif700': TTF_DIR + '/Source_Serif_4_wght_700.ttf'}
DIGIT_TONES = {   # (body, lit top edge): two tones, so a digit never reads as gradient text
    'Oxblood': ('x3', 'x5'), 'Ochre': ('o4', 'o6'), 'Bone': ('b3', 'b5'), 'Slate': ('s3', 's5'), 'Moss': ('m3', 'm5'), 'Dim': ('w4', 'w6'),
}


def _font(name, size):
    """A cached PIL font for the cast digits."""
    from PIL import ImageFont
    k = (name, size)
    if k not in _font_cache:
        _font_cache[k] = ImageFont.truetype(TTF[name], size)
    return _font_cache[k]


def numeral(text, size, ramp='Oxblood', face='serif900', track=2, drop=1, thresh=110):
    """Rasterise text in the book face at 1x, threshold to 1-bit, then cast it: one body tone, a lit top edge,
    an ink outline and a hard drop. Glyphs are packed by their inked width plus `track` px."""
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
    a = np.concatenate(pieces, axis=1)
    ys, xs = np.nonzero(a)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    m = np.pad(a, 2)
    h, w = m.shape
    body, lit = DIGIT_TONES[ramp]
    out = Raster(w + drop, h + drop)
    ol = outline(m, 8)
    if drop:
        dm = np.zeros((h + drop, w + drop), bool)
        dm[drop:, drop:] = m | ol
        for j, i in zip(*np.nonzero(dm)):
            out.set(int(i), int(j), 'k0')
    for j, i in zip(*np.nonzero(ol)):
        out.set(int(i), int(j), 'k0')
    for j, i in zip(*np.nonzero(m)):
        out.set(int(i), int(j), lit if not m[j - 1, i] else body)
    return out


def text_w(s, size=16, weight=700):
    """Rough pixel width of a Source Serif 4 string (PIL metrics; the browser may differ by a few px)."""
    f = _font('serif700' if weight >= 650 else 'serif700', size)
    return int(round(f.getlength(s) * (1.0 if weight >= 650 else .96)))
