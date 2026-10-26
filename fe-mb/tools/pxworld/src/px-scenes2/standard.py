"""The company's standard at camp scale, the same banner the map shows over Frontier Camp: a slate band at the
head, an oxblood field, a bone chevron. Here it hangs from a crossbar on an ash pole planted by the tent, the cloth
falling in vertical folds (lit on the west face of each), a swallowtail cut at the foot, a spear point on top."""
import math

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, new, put, nb


def standard(pole=216, fw=46, fh=64):
    W, H = fw + 20, pole + 12
    s = new(W, H, 5, H - 3)
    px = 5
    base = H - 3
    top = base - pole
    # the pole: lit west edge, ink either side, a spear point and a crossbar
    for y in range(top + 6, base + 1):
        put(s, px - 2, y, 'w0'); put(s, px - 1, y, 'd6' if y % 9 else 'd5'); put(s, px, y, 'd5'); put(s, px + 1, y, 'd4'); put(s, px + 2, y, 'w0')
    head = ["..k..", ".k6k.", ".k5k.", "k654k", "k543k", ".k3k.", "kkkkk"]
    for j, row in enumerate(head):
        for i, ch in enumerate(row):
            if ch != '.':
                put(s, px - 2 + i, top + j, {'k': 't0', '6': 't6', '5': 't5', '4': 't4', '3': 't3'}[ch])
    cy = top + 12
    for x in range(px - 3, px + fw + 6):
        put(s, x, cy - 1, 'w0'); put(s, x, cy, 'w5'); put(s, x, cy + 1, 'w3'); put(s, x, cy + 2, 'w0')
    for x in (px - 4, px + fw + 6):
        for y in range(cy - 1, cy + 3):
            put(s, x, y, 'w0')
    # the banner
    x0, y0 = px + 4, cy + 3
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    lx, ly = xx - x0, yy - y0
    tail = fh - 12 + np.abs(lx - fw / 2) * (12 / (fw / 2))          # swallowtail: the foot cut in a V
    m = (lx >= 0) & (lx < fw) & (ly >= 0) & (ly < tail)
    m &= ~((lx < 1) & (ly > fh * .5)) & ~((lx > fw - 2) & (ly > fh * .55))
    tone = np.full((H, W), ix('x3'), np.uint8)
    band = ly < 10
    tone[band] = ix('s3')
    tone[band & (ly < 2)] = ix('s4')
    tone[band & (ly > 8)] = ix('s2')
    # the chevron, point up
    cx = fw / 2
    d = ly - (fh * .34 + np.abs(lx - cx) * .55)
    chev = (d > -4) & (d < 4) & ~band
    tone[chev] = ix('b4')
    tone[chev & (d > 2)] = ix('b3')
    # folds: the cloth hangs in four soft folds, each lit on its west face and shaded on its east
    ph = np.mod((lx + 2.6 * np.sin(lx * .23 + .5)) / (fw / 3.3), 1)
    lit = (ph < .32) & ~band
    shade = (ph > .7) & ~band
    tone[lit & ~chev] = ix('x4')
    tone[lit & chev] = ix('b5')
    tone[shade & ~chev] = ix('x2')
    tone[shade & chev] = ix('b2')
    tone[band & lit] = ix('s4')
    tone[band & shade] = ix('s2')
    s.ix[m] = tone[m]
    # the tabs it hangs by, over the crossbar
    for k in range(5):
        tx = int(x0 + 2 + k * (fw - 5) / 4)
        for i in range(3):
            put(s, tx + i, cy - 1, 's3'); put(s, tx + i, cy + 2, 's2')
    mm = m.copy()
    rg = cpx.ring(np.pad(mm, 1), 4)[1:-1, 1:-1] & (s.ix == CLEAR)
    src = s.ix.copy()
    for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
        v = nb(src, dx, dy, CLEAR)
        pick = rg & (v != CLEAR) & (s.ix == CLEAR) & np.isin(v, cpx.ids(('x', 's', 'b')))
        for i in np.unique(v[pick]):
            s.ix[pick & (v == i)] = ix({'x': 'x0', 's': 's0', 'b': 'x0'}[pal.RAMP_OF[i]])
    return s


if __name__ == '__main__':
    from PIL import Image
    sp = standard()
    bg = np.full((sp.h, sp.w + 10), ix('g5'), np.uint8)
    m = sp.ix != CLEAR
    bg[:, :sp.w][m] = sp.ix[m]
    Image.fromarray(cpx.to_rgba(bg), 'RGBA').resize(((sp.w + 10) * 3, sp.h * 3), Image.NEAREST).save('t/standard3x.png')
