"""The company at 1:1: the 104 x 152 board sprites, never scaled.

Each sprite gets the kit's ink edge exactly as the board's f64-ol1 filter draws it (alpha >= 0.4, dilated by
1 px, filled k0, under the sprite). Shadows are hard and one ramp step down: a contact patch under the feet and
the figure's own silhouette thrown along the ground by the same sun as every prop.

Lilina sits: her sprite is cut at the waist and set down onto the log by the drop a seat takes, her staff is
kept whole and planted beside her feet, and a wool blanket (drawn here, Oxblood ramp with a Bone stripe) lies
over her lap and falls to the ground, covering the cut."""
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage

import cpx
from cpx import pal, ix, CLEAR, K, nb
from pxworld.canvas import Sprite

ROOT = os.path.dirname(os.path.dirname(cpx.HERE))
UP = os.path.join(ROOT, 'assets', 'up')
K0 = tuple(int(pal.HEX[ix('k0')][i:i + 2], 16) for i in (1, 3, 5))

# foot anchor of each sprite (x, y) in its 104 x 152 box: between the feet, on the ground line
FEET = {'board_roy': (60, 145), 'board_marcus': (58, 149), 'board_lilina': (58, 149)}


def load(key):
    a = np.array(Image.open(os.path.join(UP, key + '.png')).convert('RGBA'))
    if key == 'board_lilina':
        a = strip_baked_shadow(a)
    return a


def strip_baked_shadow(a, y0=134):
    """Lilina's board sprite carries a soft tan ground ellipse round her hem (and a faint dark one under her shoe).
    Inked by the kit's edge it reads as a black-rimmed disc, so it goes: in the bottom rows, tan low-saturation or
    faint pixels outside the robe's own extent on that row, and everything faint under the hem. The scene throws
    its own hard contact shadow instead."""
    a = a.copy()
    rgb = a[:, :, :3].astype(int)
    r, g, b, al = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2], a[:, :, 3].astype(int)
    mean = rgb.mean(2)
    sat = rgb.max(2) - rgb.min(2)
    blue = (b > r + 8) & (al > 60)
    gold = (r - b > 70) & (r > 140) & (al > 60)
    bright = (mean > 196) & (al > 60)
    staff = np.zeros(al.shape, bool)
    staff[:, 12:33] = (mean[:, 12:33] < 110) & (al[:, 12:33] > 150) & (sat[:, 12:33] < 60)
    robe = blue | gold | bright
    H, W = al.shape
    tan = (sat < 62) & (mean > 92) & (mean < 190) & (r > b + 12) & ~robe
    for y in range(y0, H):
        xs = np.nonzero(robe[y])[0]
        if len(xs):
            xl, xr = xs.min(), xs.max()
            out = np.ones(W, bool)
            out[xl:xr + 1] = False
            kill = tan[y] & out & ~staff[y]
        else:
            kill = (al[y] > 0) & ~staff[y]
            # keep the shoe: dark, opaque, near the middle
            shoe = (mean[y] < 80) & (al[y] > 180)
            shoe[:40] = False
            shoe[80:] = False
            kill &= ~shoe
        a[y, kill, 3] = 0
        faint = (al[y] < 90) & ~staff[y]
        a[y, faint, 3] = 0
    return a


def inked(a):
    """The kit's f64-ol1: a 1 px k0 edge under everything at alpha >= 0.4, dilated 3 x 3."""
    m = a[:, :, 3] >= 102
    d = ndimage.binary_dilation(m, np.ones((3, 3), bool))
    H, W = m.shape
    out = np.zeros((H, W, 4), np.uint8)
    out[d] = (*K0, 255)
    # SourceGraphic over the ink
    al = a[:, :, 3:4].astype(float) / 255
    out_rgb = out[:, :, :3].astype(float) * (1 - al) + a[:, :, :3].astype(float) * al
    out_a = np.maximum(out[:, :, 3].astype(float), a[:, :, 3].astype(float))
    # where there is no ink under a faint pixel, keep the faint pixel as it is (it composites over the scene)
    res = np.zeros_like(out)
    res[:, :, :3] = np.where(d[:, :, None], out_rgb, a[:, :, :3]).astype(np.uint8)
    res[:, :, 3] = np.where(d, 255, a[:, :, 3]).astype(np.uint8)
    return res


def silhouette(a, thr=102):
    return a[:, :, 3] >= thr


def cast_shadow(sil, fx, fy, ground_y=None):
    """Throw a silhouette (bool, sprite-local, foot at (fx, fy) local) along the ground.
    Returns (bool mask, x0, y0) in sprite-local coordinates offset so the foot is at (0, 0)."""
    ys, xs = np.nonzero(sil)
    z = np.maximum(0, fy - ys)
    sx = xs - fx + z * cpx.SX
    sy = z * cpx.SY
    pts_x = np.round(sx).astype(int)
    pts_y = np.round(sy).astype(int)
    x0, y0 = pts_x.min() - 2, pts_y.min() - 2
    W, H = pts_x.max() - x0 + 3, pts_y.max() - y0 + 3
    m = np.zeros((H, W), bool)
    m[pts_y - y0, pts_x - x0] = True
    m = ndimage.binary_closing(m, np.ones((3, 3), bool))
    m = ndimage.binary_opening(m, np.ones((2, 2), bool))
    return m, x0, y0


# ---------------------------------------------------------------- Lilina, seated
def blanket(seed=3):
    """A madder wool blanket over a seated lap, seen from the front and a little above: the waist edge dips
    between the hips, the lap runs forward to two knees (the widest point up top, lit on their caps), a hard
    shadow under them, then the drape falls to the ground in folds and pools. Light from the upper left.
    Indexed Sprite; anchor = the middle of its foot."""
    # half-widths per row from the waist (row 0) to the hem
    prof = [23, 25, 26, 27, 28, 28, 29, 30, 31, 32, 33, 33, 33, 32, 31, 30, 30, 30, 31, 31, 32, 32, 33, 33, 34,
            34, 35, 35, 36, 36, 37, 37, 38, 38, 39, 39, 40, 40, 40]
    n = len(prof)
    W, H = 2 * max(prof) + 10, n + 8
    s = cpx.new(W, H, W // 2, n + 2)
    cx = W / 2 - .5
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    m = np.zeros((H, W), bool)
    top0 = 1
    for r, hw in enumerate(prof):
        y = r + top0
        m[y, int(round(cx - hw)):int(round(cx + hw + 1))] = True
    # the waist edge dips between the hips (a U), the knees part a little at the front
    dip = top0 + 4.0 * np.clip(1 - ((xx - cx) / 20) ** 2, 0, 1)
    m &= ~(yy < dip)
    m &= ~((np.abs(xx - cx) < 1.6) & (yy > top0 + 9) & (yy < top0 + 14))
    # the hem pools in soft waves; a corner hangs lower on the east side
    for x in range(W):
        cut = int(round(1.4 + 1.3 * math.sin(x * .55) + .8 * math.sin(x * 1.3 + 1)))
        if x > cx + 24:
            cut -= 2
        for k in range(max(0, cut)):
            m[n + top0 - 1 - k, x] = False
    for x in range(int(cx + 26), int(cx + 41)):
        for k in range(0, 3 - (x - int(cx + 26)) // 5):
            if n + top0 + k < H:
                m[n + top0 + k, x] = True
    m = cpx.clean(m, 3)
    r_ = yy - top0
    u = (xx - cx) / 38
    tone = np.full((H, W), ix('x2'), np.uint8)
    lap = r_ < 10
    tone[lap] = ix('x3')
    tone[lap & (u < -.2)] = ix('x4')
    tone[lap & (u > .5)] = ix('x2')
    # the knees: rounded caps lit on their upper west
    for kx, lit in ((-14, 'x4'), (14, 'x3')):
        cap = cpx.ell_mask(W, H, cx + kx, top0 + 10.5, 15, 4.8, xx, yy)
        tone[cap] = ix(lit)
        hi_ = cpx.ell_mask(W, H, cx + kx - 5, top0 + 9.5, 6, 1.6, xx, yy)
        tone[hi_] = ix('x5') if kx < 0 else ix('x4')
    # the shadow tucked under the knees, then the drape: west side lit, east in shade
    tone[(r_ >= 14) & (r_ < 17)] = ix('x1')
    tone[(r_ >= 14) & (r_ < 17) & (u < -.55)] = ix('x2')
    drape = r_ >= 17
    tone[drape & (u < -.5)] = ix('x3')
    tone[drape & (u > .45)] = ix('x1')
    # folds falling from the knees: a shade wedge with a lit lip on its west side
    for fx_, w0 in ((-27, 1), (-17, 2), (-6, 2), (5, 3), (17, 2), (28, 2)):
        for y in range(int(top0 + 17), int(top0 + n)):
            tt = (y - top0 - 17) / (n - 17)
            ww = int(round(w0 * tt + .7))
            x = int(round(cx + fx_ * (1 + tt * .18)))
            for j in range(ww):
                if m[y, x + j]:
                    tone[y, x + j] = pal.shift_index(int(tone[y, x + j]), -1)
            if m[y, x - 1]:
                tone[y, x - 1] = pal.shift_index(int(tone[y, x - 1]), 1)
    # the waist edge turned over: lit
    edge = m & ~nb(m, 0, -1)
    tone[edge] = ix('x4')
    tone[m & nb(edge, 0, -1) & ~edge] = ix('x3')
    # a bone stripe woven in above the hem, and a thin one under it
    for (y0, y1) in ((n - 8, n - 5), (n - 3, n - 2)):
        band = (r_ >= y0 + .5 * np.sin(xx * .45)) & (r_ < y1 + .5 * np.sin(xx * .45))
        tone[band] = ix('b2')
        tone[band & (u < .1)] = ix('b3')
        tone[band & (u > .6)] = ix('b1')
    s.ix[m] = tone[m]
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    upl = rg & (nb(m, 1, 0) | nb(m, 0, 1)) & ~nb(m, -1, 0) & ~nb(m, 0, -1)
    s.ix[rg] = ix('x0')
    s.ix[upl] = ix('x1')
    return s


def lap_hand(rgba):
    """Her left hand and its gold cuff, lifted from the sprite (already dropped into the seat box) so it can lie
    on the blanket: the hand's rows and columns only, the blue sleeve around it left out."""
    out = np.zeros_like(rgba)
    y0, y1, x0, x1 = 40 + 69, 40 + 86, 76, 92
    out[y0:y1, x0:x1] = rgba[y0:y1, x0:x1]
    r, g, b = out[:, :, 0].astype(int), out[:, :, 1].astype(int), out[:, :, 2].astype(int)
    blue = (b > r + 25) & (b > g)
    out[blue, 3] = 0
    out[out[:, :, 3] < 120, 3] = 0
    return out


def shoes():
    """Her two soft leather shoes peeking out under the hem."""
    rows = [
        ".kkkkk....kkkkk.",
        "k5544kk..k5544kk",
        "k44332k..k44332k",
        ".kkkkk....kkkkk.",
    ]
    return Sprite.ascii(rows, {'k': 'w0', '5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2'}, ax=8, ay=3)


def seated_lilina(drop=40, cut=77, staff_foot=None, blanket_dy=0):
    """Returns (rgba sprite, foot (x, y) in it, blanket Sprite, blanket foot (x, y) in the same box,
    silhouette for the shadow). The box is the 104 x 152 sprite box extended down by the drop."""
    a = load('board_lilina')
    H0, W0 = a.shape[:2]
    H = H0 + drop
    out = np.zeros((H, W0, 4), np.uint8)
    body = a.copy()
    body[cut:, :, 3] = 0                                   # everything under the waist goes
    # keep the staff whole: the shaft runs down the sprite's left, x 14..31 below the hand
    staff = a.copy()
    keep = np.zeros(a.shape[:2], bool)
    keep[cut:, 12:33] = True
    staff[~keep, 3] = 0
    # the baked ground shadow under the robe is not staff: drop faint, warm pixels in the bottom rows
    faint = (staff[:, :, 3] < 200)
    staff[faint & (np.arange(H0)[:, None] > 136), 3] = 0
    out[drop:drop + H0][body[:, :, 3] > 0] = body[body[:, :, 3] > 0]
    sm = staff[:, :, 3] > 0
    out[drop:drop + H0][sm] = staff[sm]
    foot = (58, 149 - 0)                                    # the log's ground line (where she would stand)
    sf = staff_foot if staff_foot is not None else foot[1] + 12
    out[sf + 1:, :, 3] = 0
    # the staff's foot rests on the ground: a 2 px butt
    return out, foot, sf


def seated_parts(drop=40):
    rgba, foot, sf = seated_lilina(drop)
    bl = blanket()
    return rgba, foot, bl, sf


if __name__ == '__main__':
    rgba, foot, bl, sf = seated_parts()
    H, W = rgba.shape[:2]
    canvas = np.zeros((H + 20, W + 40, 4), np.uint8)
    canvas[:, :] = (*[int(pal.HEX[ix('d4')][i:i + 2], 16) for i in (1, 3, 5)], 255)
    im = Image.fromarray(canvas, 'RGBA')
    im.alpha_composite(Image.fromarray(inked(rgba), 'RGBA'), (20, 0))
    b = Image.fromarray(cpx.to_rgba(bl.ix), 'RGBA')
    im.alpha_composite(b, (20 + foot[0] - bl.ax + 2, foot[1] + 11 - bl.ay))
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save('t/seated4x.png')
