"""The region window's overview for variant A: the whole country as a 1x pixel map, north up, in the kit's ramps.

Drawn from country_a's positions (the ones world.json would get), so it cannot flatter the layout: the Borderlands'
meadow round the company's pin, Thornwood's dark woods in a horseshoe round it (north-east, east, south and
south-west), Ashfall's burnt hills south of the woods, the Iron Throne's keep at Ashfall's far end, due south.
Each region is drawn as a land mass with a selout coast in its own darkest step, a lit north-west rim and a shaded
south-east rim; Thornwood carries drawn crowns, Ashfall drawn ridges, the Borderlands the board's own fields.
Roads one pixel wide, the river in slate. Light from the north-west. An N mark top right.

render(w, h) -> (Raster, T, info) where T maps a stage point to overview px.
"""
import os
import sys

import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
for p in (os.path.join(os.path.dirname(HERE), 'hyb-64'), HERE):
    if p not in sys.path:
        sys.path.insert(0, p)
import px64 as P                 # noqa: E402
from px64 import Raster          # noqa: E402
from paint import sample_catmull  # noqa: E402
import country_a as CA           # noqa: E402
import layout_a as LA            # noqa: E402

TONES = {   # region -> (shade, base, lit, selout ink: the region's own darkest step)
    'borderlands': ('m3', 'm4', 'm5', 'm1'),
    'thornwood': ('m1', 'm2', 'm3', 'm0'),
    'ashfall': ('w4', 'w5', 'w6', 'w2'),
}
REACH = {'borderlands': 150, 'thornwood': 118, 'ashfall': 118}
TUFT = [".44..", "4333.", "33311", ".111."]           # a Thornwood crown: lit top-left, shaded foot
RIDGE = ["..6..", ".664.", "66433"]                  # an Ashfall ridge: lit north-west flank, shaded south-east
KEEP = [   # the Iron Throne, 9 x 11: a keep in the stone (bone) ramp, selout b0, an oxblood banner
    "...xx....",
    "...xxx...",
    "...k.....",
    ".k.k.k.k.",
    ".kkkkkkk.",
    ".k43332k.",
    ".k3k3k2k.",
    ".k33322k.",
    ".k3k3k2k.",
    ".k33221k.",
    ".kkkkkkk.",
]
N_MARK = ["..5..", ".555.", "5.5.5", ".....", "5...5", "55..5", "5.5.5", "5..55", "5...5"]
PIN = ["..kkk..", ".k565k.", "k56654k", "k56543k", ".k443k.", "..k3k..", "..k2k..", "..k1k..", "...k..."]


def render(w, h, pad=4, north_pad=218):
    world = CA.load_world()
    reg_of = {n['id']: n['regionId'] for n in world['nodes']}
    pos = {k: v for k, v in CA.positions().items() if k != 'darens_camp'}
    edges = [(e['from'], e['to']) for e in world['edges'] if 'darens_camp' not in (e['from'], e['to'])]
    x0 = min(p[0] - REACH[reg_of[k]] for k, p in pos.items())
    x1 = max(p[0] + REACH[reg_of[k]] for k, p in pos.items())
    y0 = min(p[1] - REACH[reg_of[k]] for k, p in pos.items()) - north_pad   # room north, so the camp's pin sits
    y1 = max(p[1] + REACH[reg_of[k]] for k, p in pos.items())               # a third of the way down, off the rim
    s = min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0))
    ox = pad + ((w - 2 * pad) - (x1 - x0) * s) / 2
    oy = pad + ((h - 2 * pad) - (y1 - y0) * s) / 2

    def T(p):
        return (ox + (p[0] - x0) * s, oy + (p[1] - y0) * s)
    yy, xx = np.mgrid[0:h, 0:w].astype(float) + .5
    best = np.full((h, w), 1e9)
    reg = np.full((h, w), 'borderlands', object)
    for k, p in pos.items():
        X, Y = T(p)
        d = np.hypot(xx - X, yy - Y) * 118 / REACH[reg_of[k]]
        m = d < best
        best[m], reg[m] = d[m], reg_of[k]
    for a, b in edges:                       # each region swells along its own roads
        if reg_of[a] != reg_of[b]:
            continue
        A, B = T(pos[a]), T(pos[b])
        dx, dy = B[0] - A[0], B[1] - A[1]
        L2 = dx * dx + dy * dy or 1
        t = np.clip(((xx - A[0]) * dx + (yy - A[1]) * dy) / L2, 0, 1)
        d = (np.hypot(xx - (A[0] + t * dx), yy - (A[1] + t * dy)) + 1.5) * 118 / REACH[reg_of[a]]
        m = d < best
        best[m], reg[m] = d[m], reg_of[a]
    land = best < 118 * s * .92
    land = ndimage.binary_closing(land, np.ones((3, 3)), iterations=2)
    land = ndimage.binary_fill_holes(land)
    land = ndimage.binary_opening(land, np.ones((3, 3)))
    for _ in range(2):                       # majority-clean the region labels so the seams run smooth
        votes = {r: ndimage.uniform_filter((reg == r).astype(float), 5) for r in TONES}
        reg = np.array(list(TONES))[np.argmax(np.stack([votes[r] for r in TONES]), 0)].astype(object)
    reg[~land] = None

    def at(i, j):
        return reg[j, i] if 0 <= i < w and 0 <= j < h else None
    R = Raster(w, h)
    for j in range(h):
        for i in range(w):
            r = reg[j, i]
            if r is None:
                continue
            sh, base, lit, ink = TONES[r]
            k = base
            if any(q is None for q in (at(i - 1, j), at(i + 1, j), at(i, j - 1), at(i, j + 1))):
                k = ink                                     # the coast: selout in the region's own darkest step
            elif at(i, j - 1) is None or at(i - 1, j) is None or at(i, j - 2) is None or at(i - 2, j) is None:
                k = lit                                     # the lit north-west rim inside the coast
            elif at(i, j + 2) is None or at(i + 2, j) is None:
                k = sh                                      # the shaded south-east rim
            R.set(i, j, k)
    # seams between regions, one pixel, in the darker region's ink, on the darker side
    for j in range(h - 1):
        for i in range(w - 1):
            r1 = reg[j, i]
            if r1 is None:
                continue
            for (di, dj) in ((1, 0), (0, 1)):
                r2 = reg[j + dj, i + di]
                if r2 is not None and r1 != r2:
                    dark = 'thornwood' if 'thornwood' in (r1, r2) else 'ashfall'
                    if r1 == dark:
                        R.set(i, j, TONES[dark][3])
                    else:
                        R.set(i + di, j + dj, TONES[dark][3])

    def inside(i0, j0, rows, r, margin=1):
        for j in range(-margin, len(rows) + margin):
            for i in range(-margin, len(rows[0]) + margin):
                if at(i0 + i, j0 + j) != r:
                    return False
        return True
    # Thornwood: crowns on a staggered 5 px grid, each nudged a pixel by a fixed hash so no row lines up
    for j in range(0, h, 5):
        for i in range((j // 5) % 2 * 3, w, 6):
            jx = ((i * 7 + j * 13) % 3) - 1
            if inside(i + jx, j, TUFT, 'thornwood', 0):
                R.stamp(TUFT, i + jx, j, keymap={'4': 'm4', '3': 'm3', '1': 'm1'})
    # Ashfall: ridges on a wide stagger
    for j in range(0, h, 6):
        for i in range((j // 6) % 2 * 5, w, 10):
            if inside(i, j, RIDGE, 'ashfall'):
                R.stamp(RIDGE, i, j, keymap={'6': 'w6', '4': 'w4', '3': 'w3'})
    # the Borderlands: the board's own fields, each a tiny striped patch where it lies
    for poly_pts, kind in LA.FIELDS:
        cx = sum(p[0] for p in poly_pts) / len(poly_pts)
        cy = sum(p[1] for p in poly_pts) / len(poly_pts)
        X, Y = T((cx, cy))
        X, Y = int(X) - 1, int(Y) - 1
        if inside(X, Y, ["...", "..."], 'borderlands', 0):
            st = 'b3' if 'wheat' in kind else ('w5' if kind == 'plough' else 'm5')
            R.stamp(["aaa", "bbb"], X, Y, keymap={'a': st, 'b': 'm3'})

    def line(A, B, key):
        n = int(max(abs(B[0] - A[0]), abs(B[1] - A[1]))) + 1
        for q in range(n + 1):
            t = q / n
            X, Y = int(A[0] + (B[0] - A[0]) * t), int(A[1] + (B[1] - A[1]) * t)
            if 0 <= X < w and 0 <= Y < h and reg[Y, X] is not None:
                R.set(X, Y, key(X, Y) if callable(key) else key)
    ROAD = {'borderlands': 'b2', 'thornwood': 'm4', 'ashfall': 'b2'}
    for a, b in edges:
        line(T(pos[a]), T(pos[b]), lambda X, Y: ROAD[reg[Y, X]])
    rp = sample_catmull(LA.RIVER, 10)
    for i in range(len(rp) - 1):
        line(T(rp[i]), T(rp[i + 1]), 's3')
    tx, ty = T(pos['the_iron_throne'])
    R.stamp(KEEP, int(tx) - 4, int(ty) - 9, keymap={'4': 'b3', '3': 'b2', '2': 'b1', '1': 'b0', 'x': 'x3', 'k': 'b0'})
    cx, cy = T(pos['frontier_camp'])
    R.stamp(PIN, int(cx) - 3, int(cy) - 8, keymap=dict(P.BR, k='k0'))
    R.stamp(N_MARK, w - 10, 4, keymap={'5': 'b3'})
    info = dict(T=T, reg=reg, throne=(tx, ty), camp=(cx, cy), scale=s)
    return R, T, info


LABELS = [   # (text, x, top, cls, anchor) in overview px, each on or touching its own land
    ('Borderlands', 70, 66, 'bone', 'c'),
    ('Thornwood', 94, 92, 'bone', 'l'),
    ('Ashfall', 119, 118, 'bone', 'l'),
    ('Iron Throne', 81, 141, 'straw', 'r'),
]


if __name__ == '__main__':
    R, T, info = render(172, 160)
    print({k: v for k, v in info.items() if k not in ('reg', 'T')})
    reg = info['reg']
    for r in ('borderlands', 'thornwood', 'ashfall'):
        ys, xs = np.nonzero(reg == r)
        print(r, 'x', xs.min(), xs.max(), 'y', ys.min(), ys.max(), 'mean', int(xs.mean()), int(ys.mean()))
    from PIL import Image
    im = Image.new('RGB', (172, 160), (43, 32, 23))
    px = im.load()
    for j in range(R.h):
        for i in range(R.w):
            c = R.px[j][i]
            if c is not None:
                hx = P.C[c] if c in P.C else '#ff00ff'
                px[i, j] = tuple(int(hx[k:k + 2], 16) for k in (1, 3, 5))
    im.resize((172 * 4, 160 * 4), Image.NEAREST).save(os.path.join(HERE, 't', 'overview_a.png'))
