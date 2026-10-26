"""The tavern's shell: the timber-framed, plastered back wall with its two windows on the left, the plank floor, and
the window light lying across the boards. Everything is painted straight into one 1280 x 720 index array.

Wall: plaster on the Bone ramp (b3, the high wall b2), timbers on the Walnut ramp (w3 with w2 grain, a w4 lit edge
up-left, w1 keyline and a b2 shadow line on the plaster under and right of each timber). Floor: planks on the Dirt
ramp (d4, d3 grain and knots, d2 seams and butt joints, nail heads), 10 px a board. Light: each window throws its
own shape onto the boards one ramp step up, the mullions and transom leaving dark bars in it."""
import random

import numpy as np

import tpx
from tpx import W, H, FLOOR_Y, ix, K, LX, LY

BEAM_Y = (40, 58)                   # the tie beam across the top of the wall
SOLE_Y = (FLOOR_Y - 14, FLOOR_Y)    # the sole plate the wall stands on
# the two windows on the upper left: (x0, x1, top, sill)
WINDOWS = [(52, 200, 100, 236), (262, 410, 100, 236)]
POSTS = [(0, 18), (222, 240), (440, 458), (880, 898), (1262, 1280)]
CHIMNEY = (646, 874)                # the stone chimney breast (drawn as a prop, in front of the wall)


def _timber(a, x0, y0, x1, y1, rng, vertical):
    """A flush timber: w3 face, w2 grain along its length, knots and a check, a w4 lit edge on its top and left, a w2
    dark edge on its bottom and right, a w1 keyline round it, and a b2 shadow line on the plaster below and right."""
    a[y0:y1, x0:x1] = ix('w3')
    L = (y1 - y0) if vertical else (x1 - x0)
    T = (x1 - x0) if vertical else (y1 - y0)
    # grain: long lines that wander by a pixel now and then
    for k in range(max(2, T // 4)):
        off = rng.randint(2, T - 3)
        pos = rng.randint(0, 6)
        while pos < L - 4:
            run = rng.randint(12, 46)
            for j in range(pos, min(L - 2, pos + run)):
                if vertical:
                    a[y0 + j, x0 + off] = ix('w2')
                else:
                    a[y0 + off, x0 + j] = ix('w2')
            pos += run + rng.randint(4, 22)
            off = max(2, min(T - 3, off + rng.choice((-1, 0, 0, 1))))
    # knots
    for _ in range(max(1, L // 90)):
        c = rng.randint(6, L - 8)
        o = rng.randint(3, max(3, T - 5))
        for (dx, dy, k) in ((0, 0, 'w1'), (1, 0, 'w1'), (-1, 0, 'w2'), (2, 0, 'w2'), (0, -1, 'w2'), (1, 1, 'w2')):
            if vertical:
                yy, xx = y0 + c + dx, x0 + o + dy
            else:
                yy, xx = y0 + o + dy, x0 + c + dx
            if y0 < yy < y1 - 1 and x0 < xx < x1 - 1:
                a[yy, xx] = ix(k)
    # edges
    a[y0, x0:x1] = ix('w4')
    a[y0:y1, x0] = ix('w4')
    a[y1 - 1, x0:x1] = ix('w2')
    a[y0:y1, x1 - 1] = ix('w2')
    # keyline + the shadow line it throws on the plaster
    if y1 < H and x1 < W:
        sl = a[y1, x0 + 1:x1 + 1]
        sl[np.isin(sl, tpx.cpx.ids('b'))] = ix('b2')
        sc = a[y0 + 1:y1 + 1, x1]
        sc[np.isin(sc, tpx.cpx.ids('b'))] = ix('b2')


def _pegs(a, pts):
    for (x, y) in pts:
        a[y, x] = ix('w1')
        a[y, x + 1] = ix('w2')
        a[y + 1, x] = ix('w2')


def plaster(a, rng):
    """The plaster between the timbers: b3, the high wall above the beam b2; hairline cracks and a few chips."""
    a[:FLOOR_Y] = ix('b3')
    a[:BEAM_Y[0]] = ix('b2')
    # trowel strokes: long, faint, slightly arched sweeps a step lighter, and their dragged edge a step darker
    for _ in range(34):
        x, y = rng.randint(0, W - 30), rng.randint(BEAM_Y[1] + 4, SOLE_Y[0] - 6)
        L = rng.randint(14, 44)
        bow = rng.uniform(-3, 3)
        for j in range(L):
            yy = int(round(y + bow * np.sin(np.pi * j / L)))
            if 0 <= x + j < W and a[yy, x + j] == ix('b3'):
                a[yy, x + j] = ix('b4')
                if j % 9 == 4 and a[yy + 1, x + j] == ix('b3'):
                    a[yy + 1, x + j] = ix('b2')
    # the lowest course of plaster is scuffed by benches and boots: a ragged b2 band over the sole plate
    for x in range(W):
        h_ = 3 + int(2 * np.sin(x * .07) + 1.5 * np.sin(x * .19 + 1) + rng.choice((0, 0, 1)))
        col = a[SOLE_Y[0] - h_:SOLE_Y[0], x]
        col[col == ix('b3')] = ix('b2')
    # the high wall above the beam: studs, plaster between in shade
    for x0 in range(28, W - 14, 124):
        a[:BEAM_Y[0], x0:x0 + 14] = ix('w2')
        a[:BEAM_Y[0], x0] = ix('w3')
        a[:BEAM_Y[0], x0 + 13] = ix('w1')
        for y in range(3, BEAM_Y[0] - 3, 11):
            a[y, x0 + 6] = ix('w1')
    # hairline cracks: short wandering runs, darker step
    for _ in range(16):
        x, y = rng.randint(20, W - 20), rng.randint(BEAM_Y[1] + 6, SOLE_Y[0] - 10)
        for k in range(rng.randint(5, 14)):
            if a[y, x] == ix('b3'):
                a[y, x] = ix('b2')
            x += rng.choice((1, 1, 0))
            y += rng.choice((1, 0, -1)) if k % 2 else 1
            if not (0 < x < W - 1 and BEAM_Y[1] < y < SOLE_Y[0]):
                break
    # chips: a small worn patch, its upper-left lip in shade and its lower-right lip catching the light
    for _ in range(9):
        x, y = rng.randint(30, W - 40), rng.randint(BEAM_Y[1] + 14, SOLE_Y[0] - 16)
        w, h = rng.randint(4, 9), rng.randint(2, 4)
        blk = a[y:y + h, x:x + w]
        if (blk == ix('b3')).all():
            blk[:] = ix('b2')
            a[y + h, x + 1:x + w + 1][a[y + h, x + 1:x + w + 1] == ix('b3')] = ix('b4')
            # lath showing through the deepest chips
            if w > 6:
                a[y + 1, x + 1:x + w - 1] = ix('w4')


def frame(a, rng):
    """The tie beam, the sole plate, the posts, a rail and two braces."""
    for (x0, x1) in POSTS:
        _timber(a, x0, BEAM_Y[1], x1, SOLE_Y[0], rng, True)
    # the rail under the notice board and the braces either side of the chimney bay
    _timber(a, 458, 238, 646, 252, rng, False)
    # a 1:1 brace: a 12 px band running down-left from the beam to the post beside the chimney
    xa, xb = 898, 1040
    for k in range(0, xb - xa - 2):
        y = BEAM_Y[1] + k
        if y >= 188:
            break
        for t in range(-1, 12):
            xx = xb - k - t
            if xa <= xx < W:
                a[y, xx] = ix('b2') if t < 0 else (ix('w2') if t <= 1 else (ix('w4') if t == 11 else ix('w3')))
    _timber(a, 0, BEAM_Y[0], W, BEAM_Y[1], rng, False)
    _timber(a, 0, SOLE_Y[0], W, SOLE_Y[1], rng, False)
    # pegs at the joints
    pts = []
    for (x0, x1) in POSTS:
        c = (x0 + x1) // 2 - 1
        pts += [(c, BEAM_Y[1] - 9), (c, SOLE_Y[0] + 6)]
    _pegs(a, [(x, y) for (x, y) in pts if 0 <= x < W - 1])


def window(a, x0, x1, top, sill, rng):
    """A two-light window with a transom: timber frame, leaded panes of pale sky with pine tops beyond, a lit sill."""
    fw = 6
    # the frame
    a[top:sill, x0:x1] = ix('w3')
    # glazing areas: two lights, a transom a third of the way down
    mid = (x0 + x1) // 2
    tr = top + (sill - top) // 3
    lights = [(x0 + fw, tr + 3, mid - 3, sill - fw), (mid + 3, tr + 3, x1 - fw, sill - fw),
              (x0 + fw, top + fw, mid - 3, tr - 3), (mid + 3, top + fw, x1 - fw, tr - 3)]
    for (gx0, gy0, gx1, gy1) in lights:
        # outside: sky, then the pine tops of the crossing, a pale hill line
        for y in range(gy0, gy1):
            a[y, gx0:gx1] = ix('s5')
        lower = gy0 > tr
        hill = sill - 40
        for x in range(gx0, gx1 if lower else gx0):
            hy = int(hill + 3 * np.sin((x + top) * .05) + 2 * np.sin(x * .13))
            a[max(gy0, hy):gy1, x] = ix('s4')
        # pines: little stepped triangles, darker toward the bottom
        for px_ in (range(gx0 - 6, gx1 + 6, 9) if lower else ()):
            h_ = 10 + (px_ * 7) % 9
            base = gy1
            for j in range(h_):
                hw = j // 2
                y = base - h_ + j
                if gy0 <= y < gy1:
                    for x in range(px_ - hw, px_ + hw + 1):
                        if gx0 <= x < gx1:
                            a[y, x] = ix('p3') if x < px_ else ix('p2')
        # the leading: small panes, cames in the darker step of the glass
        pw, ph = 16, 20
        for x in range(gx0 + pw, gx1 - 4, pw):
            col = a[gy0:gy1, x]
            col[np.isin(col, tpx.cpx.ids('s'))] = ix('s3')
            col[np.isin(col, tpx.cpx.ids('p'))] = ix('p1')
        for y in range(gy0 + ph, gy1 - 4, ph):
            r_ = a[y, gx0:gx1]
            r_[np.isin(r_, tpx.cpx.ids('s'))] = ix('s3')
            r_[np.isin(r_, tpx.cpx.ids('p'))] = ix('p1')
        # a few old panes a shade bluer, a diagonal glint on others
        for x in range(gx0, gx1 - 6, pw):
            for y in range(gy0, gy1 - 6, ph):
                r = rng.random()
                if r < .2:
                    for k in range(3):
                        if x + 3 + k < gx1 and y + 6 - k > gy0:
                            a[y + 6 - k, x + 3 + k] = ix('b5')
        # the frame's inner keyline
        a[gy0 - 1, gx0 - 1:gx1 + 1] = ix('w1')
        a[gy0 - 1:gy1 + 1, gx0 - 1] = ix('w1')
        a[gy1, gx0 - 1:gx1 + 1] = ix('w4')
        a[gy0 - 1:gy1 + 1, gx1] = ix('w4')
    # frame edges: lit top and left, dark bottom and right; mullion and transom grain
    a[top, x0:x1] = ix('w4')
    a[top:sill, x0] = ix('w4')
    a[top:sill, x1 - 1] = ix('w1')
    for y in range(top + 2, sill - 2, 7):
        a[y, mid - 1] = ix('w2')
    a[tr - 2, x0 + fw:x1 - fw] = ix('w4')
    a[tr + 2, x0 + fw:x1 - fw] = ix('w2')
    # the sill: a lit board standing proud, its front edge in shade, its shadow on the plaster under it
    a[sill:sill + 4, x0 - 6:x1 + 6] = ix('w5')
    a[sill, x0 - 6:x1 + 6] = ix('w6')
    a[sill + 4:sill + 8, x0 - 6:x1 + 6] = ix('w3')
    a[sill + 8, x0 - 6:x1 + 6] = ix('w1')
    sh = a[sill + 9:sill + 11, x0 - 4:x1 + 8]
    sh[np.isin(sh, tpx.cpx.ids('b'))] = ix('b2')
    # keyline round the whole window, its shadow on the plaster right of it
    a[top - 1, x0 - 1:x1 + 1] = ix('w1')
    a[top - 1:sill, x0 - 1] = ix('w1')
    a[top - 1:sill, x1] = ix('w1')
    sc = a[top + 1:sill, x1 + 1:x1 + 3]
    sc[np.isin(sc, tpx.cpx.ids('b'))] = ix('b2')
    return dict(glass=lights, mid=mid, transom=tr, frame=fw)


def floor(a, rng):
    """Planks running across the room, 9 to 12 px a board: a d3 seam over each with short d2 gaps where the boards
    have shrunk, the near lip catching the light, staggered butt joints with a nail either side, d3 grain streaks
    that step a pixel now and then, knots. Some boards are busier with grain, so the floor is never one flat tone."""
    y0 = FLOOR_Y
    while y0 < H:
        ph = rng.choice((9, 10, 10, 11, 12))
        y1 = min(H, y0 + ph)
        a[y0:y1] = ix('d4')
        a[y0] = ix('d3')
        # shrinkage gaps: short d2 runs in the seam
        x = rng.randint(0, 80)
        while x < W:
            run = rng.randint(6, 40)
            a[y0, x:x + run] = ix('d2')
            x += run + rng.randint(40, 220)
        if y0 + 1 < H:
            x = rng.randint(0, 40)
            while x < W:
                run = rng.randint(10, 60)
                a[y0 + 1, x:x + run] = ix('d5')
                x += run + rng.randint(40, 160)
        busy = rng.random()
        n = int(W / (26 if busy < .3 else 44))
        for _ in range(n):
            x = rng.randint(0, W - 10)
            y = rng.randint(y0 + 2, max(y0 + 2, y1 - 2))
            for j in range(rng.randint(8, 46)):
                if 0 <= x + j < W and y < H:
                    a[y, x + j] = ix('d3')
                if rng.random() < .06:
                    y = max(y0 + 2, min(y1 - 2, y + rng.choice((-1, 1))))
        for _ in range(rng.choice((0, 0, 1, 1, 2))):
            x = rng.randint(4, W - 8)
            y = rng.randint(y0 + 3, max(y0 + 3, y1 - 4))
            if y + 1 < H:
                a[y, x:x + 3] = ix('d2')
                a[y + 1, x + 1] = ix('d2')
                a[y - 1, x - 1:x + 4] = ix('d3')
                a[y + 1, x - 1] = ix('d3')
                a[y + 1, x + 3] = ix('d3')
        x = rng.randint(-260, 0)
        while True:
            x += rng.randint(190, 380)
            if x >= W:
                break
            a[y0 + 1:y1, x] = ix('d2')
            if x + 1 < W and rng.random() < .5:
                a[y0 + 1:y1, x + 1] = ix('d5')
            for nx in (x - 3, x + 4):
                if 0 <= nx < W and y0 + ph // 2 < H:
                    a[y0 + ph // 2, nx] = ix('t2')
        y0 = y1


def window_light(win_info, blockers=None):
    """The light each window throws on the boards: a point of the window z px above the floor lands z*LX right and
    z*LY down from the wall's foot. Returns a bool mask of the lit floor, mullion and transom bars left dark."""
    m = np.zeros((H, W), bool)
    for (x0, x1, top, sill), inf in win_info:
        for (gx0, gy0, gx1, gy1) in inf['glass']:
            z0, z1 = FLOOR_Y - gy1, FLOOR_Y - gy0           # heights of the light's bottom and top
            pts = [(gx0 + z0 * LX, FLOOR_Y + z0 * LY), (gx1 + z0 * LX, FLOOR_Y + z0 * LY),
                   (gx1 + z1 * LX, FLOOR_Y + z1 * LY), (gx0 + z1 * LX, FLOOR_Y + z1 * LY)]
            m |= tpx.cpx.poly_mask(W, H, pts)
    m[:FLOOR_Y + 2] = False
    if blockers is not None:
        m &= ~blockers
    return m


def build(seed=6):
    """The bare room as an index array, plus the windows' geometry."""
    rng = random.Random(seed)
    a = np.zeros((H, W), np.uint8)
    plaster(a, rng)
    frame(a, rng)
    wins = []
    for (x0, x1, top, sill) in WINDOWS:
        wins.append(((x0, x1, top, sill), window(a, x0, x1, top, sill, rng)))
    floor(a, rng)
    return a, dict(windows=wins)
