"""The hearth: a chimney breast of coursed stone standing proud of the back wall, a timber lintel over the firebox,
the mantel shelf on it, a small fire on iron dogs, ash and embers, and the hearthstone on the floor in front.

Stone: each block a t4 face (some t3, some t5), lit on its top row and left column (t5), dark under (t2), set in t2
mortar; soot creeps up from the firebox (blocks a step down). The flame is paint, five tones and no glow (the camp's
flame, drawn smaller). Painted into the room's base array; the fire is part of the wall, so it is never y-sorted."""
import math
import random

import numpy as np

import tpx
from tpx import ix, CLEAR, FLOOR_Y, W, H
import fire as FI                                 # px-camp's fire (logs), imported

X0, X1 = 646, 874               # the breast's face
FRONT = FLOOR_Y + 20            # its foot, half a metre proud of the wall
OPEN = (690, 830, 208)          # the firebox: x0, x1, the lintel's underside
LINTEL = (674, 846, 188, 208)
MANTEL = (662, 858, 180, 188)


def _stone_face(a, rng, x0, x1, y0, y1, soot_until=None):
    """Coursed blocks with mortar over the rectangle."""
    course_h = [13, 14, 12, 15]
    y = y1
    ci = 0
    while y > y0:
        ch = course_h[ci % 4]
        cy0 = max(y0, y - ch)
        x = x0 - rng.randint(0, 30)
        while x < x1:
            bw = rng.randint(22, 46)
            bx0, bx1 = max(x0, x), min(x1, x + bw)
            if bx1 - bx0 >= 3:
                r = rng.random()
                # fieldstone: mostly grey, some warm sandstone, a few darker
                face = 't4' if r < .26 else ('d3' if r < .38 else 't3')
                up = tpx.pal.KEYS[tpx.pal.shift_index(ix(face), 1)]
                dn = tpx.pal.KEYS[tpx.pal.shift_index(ix(face), -1)]
                a[cy0:y, bx0:bx1] = ix(face)
                a[cy0, bx0 + 1:bx1 - 1] = ix(up)                      # the lit top arris
                a[cy0 + 1:y - 2, bx0] = ix(up) if rng.random() < .5 else ix(face)
                a[y - 2, bx0 + 1:bx1 - 1] = ix(dn)
                a[cy0:y, bx1 - 1] = ix('t2')
                a[y - 1, bx0:bx1] = ix('t2')
                # rounded corners: the mortar takes the corner pixel
                a[cy0, bx0] = ix('t2')
                a[y - 2, bx1 - 2] = ix(dn)
                # a chip or a dressing mark
                if bx1 - bx0 > 12 and rng.random() < .55:
                    cx_, cy_ = rng.randint(bx0 + 3, bx1 - 6), rng.randint(cy0 + 3, max(cy0 + 3, y - 5))
                    a[cy_, cx_:cx_ + 3] = ix('t2')
                    a[cy_ - 1, cx_ + 1] = ix('t5')
            x += bw
        y = cy0
        ci += 1
    if soot_until is not None:
        # soot licks up the face from the firebox mouth: a ragged tongue a step darker, only just over the lintel
        sx0, sx1, sy = soot_until
        cxs = (sx0 + sx1) / 2
        for xx in range(x0, x1):
            u = (xx - cxs) / ((sx1 - sx0) * .5)
            if abs(u) >= 1:
                continue
            top = sy - int(round((26 + 6 * math.sin(xx * .31) + 4 * math.sin(xx * .83)) * (1 - u * u)))
            for yy in range(max(y0, top), sy + 1):
                a[yy, xx] = tpx.cpx.lut(-1)[a[yy, xx]]


def small_flame(sc=.62, core=True):
    """The camp's cookfire flame (fire.FLAME), drawn at a smaller size for a hearth: five tones, x1 outline.
    core=False banks it: no white-hot core and no sparks, so the fire stays below the room's focal light."""
    W_, H_ = int(86 * sc) + 6, int(112 * sc) + 6
    s = tpx.new(W_, H_, W_ // 2, H_ - 4)
    bx, by = W_ / 2, H_ - 4
    tones = ((1, 1, 'x3'), (.8, .8, 'x4'), (.6, .62, 'o4'), (.42, .44, 'o5'), (.24, .25, 'o6'))
    if not core:
        tones = ((1, 1, 'x2'), (.78, .78, 'x3'), (.54, .56, 'x4'), (.3, .32, 'o4'))
    for (sc_x, sc_y, k) in tones:
        pts = [(bx + x * 1.22 * sc * sc_x + (1 - sc_x) * 1.0, by + y * 1.24 * sc * sc_y) for x, y in FI.FLAME]
        m = tpx.cpx.poly_mask(W_, H_, pts)
        s.ix[m] = ix(k)
    body = s.ix != CLEAR
    rg = tpx.ring(np.pad(body, 1), 4)[1:-1, 1:-1]
    yy = np.arange(H_)[:, None] * np.ones((1, W_))
    s.ix[rg & (yy < by - 1)] = ix('x1')
    for (sx, sy, k) in ((bx + 14, by - 50, 'o5'), (bx - 6, by - 60, 'o6'), (bx + 8, by - 64, 'o5')) if core else ():
        tpx.put(s, sx, sy, k)
        tpx.put(s, sx, sy + 1, 'x3')
    return s


def antlers():
    """A stag's antlers on a shield of oak, above the mantel. Bone tines lit on their upper left."""
    rows = [
        "..a.........a.....................a.........a..",
        ".aba.......aba...................aba.......aba.",
        ".aba..a....aba...................aba....a..aba.",
        "..aba.aba..aba...................aba..aba.aba..",
        "..aba..aba.aba..a...........a....aba.aba..aba..",
        "...aba..abaaba.aba.........aba..abaaba...aba...",
        "...aba...abbbaaba...........aba.abbba...aba....",
        "....aba...abbbba.............abbbba....aba.....",
        "....abba...abbba..............abba....abba.....",
        ".....abba...abba.............abba...abba.......",
        "......abbaa.abba............abba.aabba.........",
        ".......abbbaabba...........abbaabbba...........",
        "........abbbbbba..........abbbbbba.............",
        ".........aabbbbba........abbbbaa...............",
        "...........aabbbba......abbbaa.................",
        ".............aabbbaaaaaabbaa...................",
        "...............aabbbccbbaa.....................",
        ".................accccca.......................",
        "................accddcca.......................",
        "...............acddddddca......................",
        "...............acddeeddca......................",
        "...............acdeeeedca......................",
        "...............acddeeddca......................",
        "................acddddca.......................",
        ".................accccca.......................",
        "..................aaaaa........................",
    ]
    km = {'a': 'b1', 'b': 'b4', 'c': 'w1', 'd': 'w3', 'e': 'w4'}
    s = tpx.Sprite.ascii(rows, km)
    # light the upper-left faces of the tines
    m = s.ix == ix('b4')
    upl = m & ~tpx.nb(m, -1, 0) & ~tpx.nb(m, 0, -1)
    s.ix[upl] = ix('b5')
    shade = m & ~tpx.nb(m, 1, 0)
    s.ix[shade & ~upl] = ix('b3')
    return s


def build(a, seed=11, banked=False):
    """Paint the breast, the firebox, the fire, the mantel and the hearthstone into the base array a."""
    rng = random.Random(seed)
    # the breast's shadow on the plaster to its right, then the face itself
    sh = a[58:FLOOR_Y - 14, X1:X1 + 12]
    sh[np.isin(sh, tpx.cpx.ids('b'))] = ix('b2')
    _stone_face(a, rng, X0, X1, 0, FRONT)
    # the breast's outline: lit on the left, dark on the right
    a[0:FRONT, X0] = ix('t5')
    a[0:FRONT, X0 - 1] = ix('t1')
    a[0:FRONT, X1 - 1] = ix('t1')
    a[0:FRONT, X1] = ix('t0')
    a[FRONT - 1, X0:X1] = ix('t1')
    # the firebox: deep soot, the back courses barely showing, an ash bed, embers
    fx0, fx1, fy0 = OPEN
    a[fy0:FRONT - 1, fx0:fx1] = ix('t1')
    for yy in range(fy0 + 10, FRONT - 6, 12):
        a[yy, fx0 + 4:fx1 - 4] = ix('t0')
        for xx in range(fx0 + 8 + (yy // 12 % 2) * 14, fx1 - 6, 28):
            a[yy - 11:yy, xx] = ix('t0')
    a[fy0:fy0 + 14, fx0:fx1] = ix('t0')
    a[fy0:FRONT - 1, fx0:fx0 + 3] = ix('t2')            # the cheek catching a little light
    bed_y = FRONT - 9
    a[bed_y:FRONT - 1, fx0:fx1] = ix('t2')
    for _ in range(30):
        x_, y_ = rng.randint(fx0 + 6, fx1 - 10), rng.randint(bed_y + 1, FRONT - 3)
        for k in range(rng.choice((2, 3, 4))):
            a[y_, x_ + k] = ix('t4') if k == 0 else ix('t3')
    for _ in range(18):
        x_, y_ = rng.randint(fx0 + 30, fx1 - 30), rng.randint(bed_y, FRONT - 4)
        a[y_, x_] = ix('x3')
        a[y_, x_ + 1] = ix(rng.choice(('x4', 'o4')))
    # the fire: two logs on iron dogs, a flame between them
    cx = (fx0 + fx1) // 2
    for (dx, flip) in ((-34, False), (30, True)):
        for yy in range(bed_y - 16, bed_y + 4):
            a[yy, cx + dx:cx + dx + 3] = ix('t2')
            a[yy, cx + dx] = ix('t3')
        a[bed_y - 18:bed_y - 15, cx + dx - 1:cx + dx + 4] = ix('t3')
        a[bed_y - 19, cx + dx:cx + dx + 3] = ix('t4')
    for (ang, L, th, dx, dy, sd) in ((-6, 58, 9, -6, -6, 1), (188, 54, 9, 8, -12, 2)):
        lg = FI.burning_log(L, th, ang, sd)
        _blit(a, lg, cx + dx - lg.w // 2, bed_y + dy - lg.h // 2)
    fl = small_flame(.4, core=False) if banked else small_flame()
    if banked:
        # a fire burned down: a low tongue over a long bed of embers between the logs
        er = random.Random(seed + 1)
        for _ in range(40):
            x_, y_ = er.randint(cx - 30, cx + 30), er.randint(bed_y - 7, bed_y - 1)
            a[y_, x_] = ix(er.choice(('x2', 'x3', 'x3', 'x4')))
    _blit(a, fl, cx + 2 - fl.ax, bed_y - 6 - fl.ay)
    # the lintel: a heavy oak beam, its underside charred
    lx0, lx1, ly0, ly1 = LINTEL
    a[ly0:ly1, lx0:lx1] = ix('w3')
    for k in range(5):
        yy = ly0 + 3 + k * 3
        x_ = lx0 + rng.randint(0, 20)
        while x_ < lx1 - 4:
            run = rng.randint(14, 50)
            a[yy, x_:min(lx1 - 2, x_ + run)] = ix('w2')
            x_ += run + rng.randint(6, 20)
    a[ly0, lx0:lx1] = ix('w4')
    a[ly0:ly1, lx0] = ix('w4')
    a[ly1 - 3:ly1, lx0:lx1] = ix('w1')
    a[ly1 - 1, lx0:lx1] = ix('k0')
    a[ly0:ly1, lx1 - 1] = ix('w1')
    for (px_, py_) in ((lx0 + 6, ly0 + 9), (lx1 - 8, ly0 + 9)):
        a[py_:py_ + 2, px_:px_ + 2] = ix('w1')
    # the mantel shelf, standing proud: a lit top, a front edge, its shadow on the stone under it
    mx0, mx1, my0, my1 = MANTEL
    a[my0:my1, mx0:mx1] = ix('w4')
    a[my0, mx0:mx1] = ix('w6')
    a[my0 + 1, mx0:mx1] = ix('w5')
    a[my1 - 1, mx0:mx1] = ix('w2')
    a[my0:my1, mx0] = ix('w1')
    a[my0:my1, mx1 - 1] = ix('w1')
    sh = a[ly0:ly0 + 3, lx0:lx1]
    sh[:] = tpx.cpx.lut(-1)[sh]
    # the hearthstone on the floor in front: one long slab, lit top, a front edge, its contact line
    hx0, hx1 = lx0 - 6, lx1 + 6
    a[FRONT:FRONT + 12, hx0:hx1] = ix('t4')
    a[FRONT, hx0:hx1] = ix('t5')
    a[FRONT:FRONT + 12, hx0] = ix('t5')
    for k in range(3):
        xx = rng.randint(hx0 + 20, hx1 - 30)
        a[FRONT + 4 + k * 2, xx:xx + rng.randint(6, 18)] = ix('t3')
    a[FRONT + 12:FRONT + 16, hx0:hx1] = ix('t3')
    a[FRONT + 12, hx0:hx1] = ix('t5')
    a[FRONT + 16, hx0:hx1] = ix('t1')
    a[FRONT:FRONT + 16, hx1 - 1] = ix('t2')
    a[FRONT:FRONT + 17, hx0 - 1] = ix('t1')
    a[FRONT:FRONT + 17, hx1] = ix('t1')
    # its shadow on the boards
    sh = a[FRONT + 17:FRONT + 20, hx0 + 2:hx1 + 3]
    sh[np.isin(sh, tpx.cpx.ids('d'))] = tpx.cpx.lut(-1)[sh[np.isin(sh, tpx.cpx.ids('d'))]]
    # the antlers over the mantel
    an = antlers()
    _blit(a, an, (X0 + X1) // 2 - an.w // 2 - 1, my0 - an.h - 22)
    return dict(box=(X0, 0, X1 - X0, FRONT), fire=(cx, bed_y - 20), mantel=(mx0, my0, mx1 - mx0),
                hearthstone=(hx0, FRONT, hx1 - hx0, 17))


def _blit(a, spr, x, y):
    h_, w_ = spr.ix.shape
    for j in range(h_):
        yy = y + j
        if not 0 <= yy < H:
            continue
        row = spr.ix[j]
        for i in range(w_):
            if row[i] != CLEAR and 0 <= x + i < W:
                a[yy, x + i] = row[i]
