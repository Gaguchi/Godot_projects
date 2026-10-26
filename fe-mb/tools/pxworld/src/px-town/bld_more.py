"""px-town: the shop and the tavern (imported into buildings)."""
import random

from pxt import Sprite, IX, kk, pal, selout, stone_face, moss, planks_v, planks_h, beam_h, beam_v, window_px
from buildings import ascii_stamp, sign_board, hang_sign, hip_roof, ARMS2, ARMS2_KM, TANKARD, TANKARD_KM


def light(key, n=1):
    return pal.KEYS[pal.shift_index(IX(key), n, fine=True)]


def dark(key, n=1):
    return pal.KEYS[pal.shift_index(IX(key), -n, fine=True)]


def rake_y(x, ax, apex_y, run=3, rise=2):
    """The raking edge of a gable: rise rows for every run px from the apex (a clean 2-1-2-1 step)."""
    return apex_y + (abs(x - ax) * rise) // run


BOTTLE = [".c.", "kxk", "xXx", "xxx", "kxk"]
SACK = [".kk.", "k54k", "k543", "kkkk"]
SHIELD = ["..ooo..", ".oOOOo.", "oOOgOOo", "oOgGgOo", "oOOgOOo", ".oOOOo.", "..ooo.."]


def awning(S, x0, x1, y0, depth, stripes=('b5', 's3'), shade=('b4', 's2'), sw=6):
    """A striped canvas awning seen from above the street: the sloping top in the light (widening as it comes
    toward us), a scalloped valance below one step down, the stripes running down the slope."""
    for j in range(depth):
        for x in range(x0 - j // 4, x1 + 1 + j // 4):
            st = ((x - x0) // sw) % 2
            k = stripes[st]
            if j == 0:
                k = light(k)
            S.put(x, y0 + j, k)
    vy = y0 + depth
    xa, xb = x0 - depth // 4, x1 + depth // 4
    for x in range(xa, xb + 1):
        st = ((x - x0) // sw) % 2
        S.put(x, vy, shade[st])
        S.put(x, vy + 1, shade[st])
        p = (x - x0) % sw
        if p not in (0, sw - 1):
            S.put(x, vy + 2, shade[st])
            if 2 <= p <= sw - 3:
                S.put(x, vy + 3, dark(shade[st]))
    return vy + 3


def quoins(S, qx, side, y0, y1, ramp, base, ln=(6, 3)):
    """Long-and-short dressed corner stones up a wall corner."""
    y = y0
    k = 0
    while y + 5 <= y1:
        L = ln[0] if k % 2 == 0 else ln[1]
        x0 = qx if side > 0 else qx + ln[0] - L
        for j in range(5):
            for i in range(L):
                lv = base + 1 if (j == 0 or i == 0) else (base - 1 if (j == 4 or i == L - 1) else base)
                S.put(x0 + i, y + j, kk(ramp, lv))
        S.hline(x0, x0 + L - 1, y + 5, kk(ramp, base - 2))
        y += 6
        k += 1


# ------------------------------------------------------------------ the shop
def shop(seed=33):
    """The shop: gable to the street (ridge north-south), a sandstone ground floor with a wide shopfront under a
    striped awning, a weatherboarded gable with a loft door and hoist, a grey slate roof (west plane lit, east in
    shade), the sword-and-shield on its board."""
    R = random.Random(seed)
    W, P = 148, 14
    yb = 186
    S = Sprite(P + W + P, yb + 5, P + W // 2, yb)
    ax = P + W // 2                     # the ridge's column
    EAVE = 116                          # the eave line at the side walls
    OV = 7                              # the roof's overhang past the walls
    apex = EAVE - ((W // 2 + OV) * 2) // 3
    D = 54                              # how far the roof runs back (up the screen)
    G0 = 138                            # ground floor top
    # ---- the roof planes: in each column, from the back rake down to the front rake
    for x in range(P - OV, P + W + OV):
        yf = rake_y(x, ax, apex)
        yk = yf - D
        west = x < ax
        c = (ax - x) if west else (x - ax)
        for y in range(max(0, yk), yf + 1):
            if west:
                k = ('t3', 't5', 't4', 't4', 't4')[c % 5]
            else:
                k = ('t1', 't3', 't2', 't2', 't2')[c % 5]
            S.put(x, y, k)
        off = ((c // 5) % 2) * 5
        if c % 5 not in (0,):
            for y in range(yk + off + 3, yf - 1, 10):
                S.put(x, y, 't3' if west else 't1')
    for y in range(apex - D, apex + 1):        # the ridge cap
        S.put(ax - 1, y, 't6'); S.put(ax, y, 't5'); S.put(ax + 1, y, 't2')
    # ---- the gable wall: weatherboard
    gx0, gx1 = P, P + W - 1
    clip = lambda x, y: y >= rake_y(x, ax, apex) + 3 and y < G0  # noqa: E731
    planks_v(S, gx0, apex, W, G0 - apex, base=5, pw=6, seed=seed + 1, clip=clip)
    for x in range(P - OV, P + W + OV):        # bargeboards along the rakes, lit on the west
        yf = rake_y(x, ax, apex)
        west = x < ax
        S.put(x, yf + 1, 'w5' if west else 'w3')
        S.put(x, yf + 2, 'w4' if west else 'w2')
        S.put(x, yf + 3, 'w2' if west else 'w1')
        if gx0 <= x <= gx1 and yf + 4 < G0:
            S.put(x, yf + 4, 'w2')
            S.put(x, yf + 5, 'w3')
    for j in range(-6, 2):                     # the finial
        S.put(ax, apex + j, 'w5'); S.put(ax + 1, apex + j, 'w3')
    S.put(ax, apex - 7, 'w6')
    # the loft door and its hoist
    lx, lw, ly, lh = ax - 9, 18, apex + 30, 22
    for y in range(ly - 1, ly + lh + 2):
        for x in range(lx - 1, lx + lw + 1):
            S.put(x, y, 'w2')
    planks_v(S, lx + 1, ly + 1, lw - 2, lh - 1, base=3, pw=4, seed=seed + 4, knots=False)
    for x in range(lx - 2, lx + lw + 2):
        S.put(x, ly - 2, 'w5'); S.put(x, ly + lh + 1, 'w6'); S.put(x, ly + lh + 2, 'w2')
    for y in (ly + 6, ly + lh - 5):
        for x in range(lx + 2, lx + lw - 2):
            S.put(x, y, 't2')
    hb = ly - 9
    for (dx, dy, k) in ((0, 0, 'w5'), (1, 0, 'w4'), (2, 0, 'w3'), (0, 1, 'w4'), (1, 1, 'w3'), (2, 1, 'w2'),
                        (0, 2, 'w3'), (1, 2, 'w2'), (2, 2, 'w1')):
        S.put(ax - 1 + dx, hb + dy, k)
    for (dx, dy, k) in ((0, 3, 't2'), (1, 4, 't4'), (0, 5, 't2'), (1, 5, 't3'), (0, 4, 't3')):
        S.put(ax + dx, hb + dy, k)
    # ---- ground floor: sandstone
    stone_face(S, P, G0, W, yb - G0 + 1, ramp='d', base=5, ch=6, bw=(10, 17), seed=seed + 2, mortar='d3')
    for x in range(P - 1, P + W + 1):          # the sill beam the gable stands on
        S.put(x, G0 - 2, 'w5'); S.put(x, G0 - 1, 'w3'); S.put(x, G0, 'w2')
    for x in range(P, P + W):
        S.put(x, G0 + 1, 'd3')
    quoins(S, P, 1, G0 + 2, yb, 'd', 5)
    quoins(S, P + W - 6, -1, G0 + 2, yb, 'd', 5)
    # the shopfront
    fx0, fx1, fy0, fy1 = P + 12, P + 94, G0 + 18, yb - 14
    for y in range(fy0, fy1 + 1):
        for x in range(fx0, fx1 + 1):
            S.put(x, y, 'w1' if y > fy0 + 3 else 'w0')
    for x in range(fx0 - 2, fx1 + 3):          # a dressed lintel
        S.put(x, fy0 - 2, 'd6'); S.put(x, fy0 - 1, 'd4')
    for sy in (fy0 + 11, fy0 + 21):            # shelves inside
        S.hline(fx0 + 2, fx1 - 2, sy, 'w3')
        S.hline(fx0 + 2, fx1 - 2, sy + 1, 'w0')
    BK = [{'x': 'x4', 'X': 'x5', 'c': 'w4', 'k': 'x2'}, {'x': 's3', 'X': 's5', 'c': 'w4', 'k': 's1'},
          {'x': 'm3', 'X': 'm5', 'c': 'w4', 'k': 'm1'}]
    for i, bx in enumerate(range(fx0 + 4, fx0 + 40, 5)):
        ascii_stamp(S, bx, fy0 + 6, BOTTLE, BK[i % 3])
    for i, bx in enumerate(range(fx0 + 6, fx0 + 30, 6)):
        ascii_stamp(S, bx, fy0 + 16, BOTTLE, BK[(i + 1) % 3])
    ascii_stamp(S, fx0 + 46, fy0 + 4, SHIELD, {'o': 'w2', 'O': 'w4', 'g': 'o4', 'G': 'o5'})
    ascii_stamp(S, fx0 + 56, fy0 + 4, SHIELD, {'o': 's1', 'O': 's3', 'g': 't5', 'G': 't6'})
    for (sx, sy) in ((fx0 + 68, fy0 + 7), (fx0 + 40, fy0 + 17), (fx0 + 64, fy0 + 17)):
        ascii_stamp(S, sx, sy, SACK, {'k': 'h1', '5': 'h5', '4': 'h4', '3': 'h3'})
    cy = fy1 - 4                               # the counter: a let-down shutter
    for x in range(fx0 - 3, fx1 + 4):
        S.put(x, cy, 'w6'); S.put(x, cy + 1, 'w5')
    planks_h(S, fx0 - 3, cy + 2, fx1 - fx0 + 7, 6, base=4, ph=3, seed=seed + 5)
    for x in range(fx0 - 3, fx1 + 4):
        S.put(x, cy + 8, 'w1')
    for i, bx in enumerate((fx0 + 4, fx0 + 9, fx0 + 14)):
        ascii_stamp(S, bx, cy - 5, BOTTLE, BK[i % 3])
    for x in range(fx0 + 24, fx0 + 46):        # a sword laid on the counter
        S.put(x, cy - 1, 't6' if x < fx0 + 40 else 'w4')
        S.put(x, cy - 2, 't5' if x < fx0 + 40 else 'w5')
    for j in range(-4, 1):
        S.put(fx0 + 40, cy + j, 'o4' if j > -4 else 'o5')
    ascii_stamp(S, fx0 + 56, cy - 5, [".hhh.", "hHHHh", "hHHhh", ".ddd."], {'h': 'h3', 'H': 'h5', 'd': 'h1'})
    ascii_stamp(S, fx0 + 66, cy - 5, SACK, {'k': 'h1', '5': 'b5', '4': 'b4', '3': 'b3'})
    awning(S, fx0 - 4, fx1 + 4, G0 + 3, 10)
    for x in range(fx0, fx1 + 1):              # the awning's shadow inside the opening
        S.put(x, fy0, 'w0'); S.put(x, fy0 + 1, 'w0')
    # the door
    DX, DW, DH = P + 112, 22, 40
    dy0 = yb - DH + 1
    for x in range(DX - 3, DX + DW + 3):       # a dressed lintel
        S.put(x, dy0 - 3, 'd6'); S.put(x, dy0 - 2, 'd5'); S.put(x, dy0 - 1, 'd3')
    planks_v(S, DX, dy0, DW, DH, base=3, pw=5, seed=seed + 6)
    for j in range(DH):
        S.put(DX, dy0 + j, 'w1'); S.put(DX + 1, dy0 + j, 'w1')
    for x in range(DX, DX + DW):
        S.put(x, dy0, 'w1')
    for sy in (dy0 + 10, dy0 + 28):
        for x in range(DX + 2, DX + DW - 1):
            S.put(x, sy, 't2')
    S.put(DX + 5, dy0 + 20, 'o4'); S.put(DX + 5, dy0 + 21, 'o2')
    for x in range(DX - 5, DX + DW + 5):
        S.put(x, yb, 'd6' if x < DX + DW + 3 else 'd4'); S.put(x, yb + 1, 'd3')
    # the board: sword and shield, hung over the door from a bracket off the sill beam
    board = sign_board(28, 24, ('w1', 'w1'), ARMS2, ARMS2_KM)
    hang_sign(S, DX - 12, G0 + 1, board, chain=1, bracket=32)
    for mx in (P + 1, P + 100, P + 140):
        moss(S, mx, yb - 1, R)
    selout(S, over={'b': 'w1'})
    S.points = {'door': (DX + DW // 2 - P, yb), 'w': W, 'top': apex - D}
    return S


# ------------------------------------------------------------------ the tavern
def lattice_window(S, x, y, w, h, frame='w'):
    """A leaded window: dark glass crossed by a diamond lattice, a glint, a lit sill."""
    for j in range(h):
        for i in range(w):
            if i in (0, w - 1) or j in (0, h - 1):
                S.put(x + i, y + j, kk(frame, 2))
            else:
                on = ((i + j) % 4 == 0) or ((i - j) % 4 == 0)
                S.put(x + i, y + j, 's2' if on else 's1')
    for i in range(1, w - 1):
        S.put(x + i, y + 1, 's0')
    S.put(x + 2, y + 3, 's4'); S.put(x + 3, y + 2, 's4'); S.put(x + 2, y + 4, 's3')
    for i in range(-1, w + 1):
        S.put(x + i, y + h, kk(frame, 5)); S.put(x + i, y + h + 1, kk(frame, 2))


def tavern(seed=45):
    """The tavern: a long low house under a deep hipped thatch, ridge east-west, close-studded timber over a stone
    sill, leaded windows, a wide door standing half open, the foaming tankard on its board, a stone chimney."""
    R = random.Random(seed)
    W, P = 172, 14
    yb = 190
    S = Sprite(P + W + P, yb + 5, P + W // 2, yb)
    RX0, RX1 = P - 10, P + W + 9
    TOP, RIDGE, EAVE = 26, 44, 100
    HIP = 30
    hip_roof(S, RX0, RX1, TOP, RIDGE, EAVE, HIP, 'thatch', seed=seed)
    # the thatch's thick, rounded eave: cut straw ends
    for x in range(RX0, RX1 + 1):
        for j, k in enumerate(('h3', 'h3', 'h2', 'h2', 'h1')):
            S.put(x, EAVE - 3 + j, pal.KEYS[pal.shift_index(IX(k), -1)])
        if x % 3 == 0:
            S.put(x, EAVE - 2, 'h3'); S.put(x, EAVE - 1, 'h2')
        if x % 3 == 1:
            S.put(x, EAVE, 'h1')
    # the ridge: block-cut, with liggers (hazel spars) pinned along it
    for x in range(RX0 + HIP, RX1 - HIP + 1):
        S.put(x, RIDGE - 2, 'h5'); S.put(x, RIDGE - 1, 'h4'); S.put(x, RIDGE, 'h3'); S.put(x, RIDGE + 1, 'w4' if x % 2 else 'h3')
        p = (x - RX0) % 8
        drop = (0, 1, 2, 3, 3, 2, 1, 0)[p]
        for j in range(drop + 1):
            S.put(x, RIDGE + 2 + j, 'h3' if j < drop else 'h1')
        S.put(x, RIDGE + 3 + drop, 'h0')
        if p == 0:
            S.put(x, RIDGE - 1, 'w3'); S.put(x, RIDGE, 'w2')
    # an eyebrow dormer: the thatch swells over a small window
    ex, ew = P + 98, 32
    by = EAVE - 30
    for i in range(ew):
        t = (i + .5) / ew
        bump = int(round(8 * (1 - (2 * t - 1) ** 2) ** .7))
        for j in range(bump + 2):
            yy = by - bump + j
            S.put(ex + i, yy, 'h4' if j < 2 else 'h3')
        S.put(ex + i, by - bump - 1, 'h1')
        S.put(ex + i, by + 2, 'h0')
    window_px(S, ex + 10, by + 3, 12, 9, cross=True, sill=False)
    for i in range(ew):
        S.put(ex + i, by + 13, 'h1')
    # ---- the walls: close studding over a stone sill
    U0, M, G1 = EAVE + 2, EAVE + 40, yb
    for y in range(U0, G1 - 7):
        S.hline(P, P + W - 1, y, 'b3')
    beam_h(S, P, P + W - 1, U0, base=2, th=3)
    beam_h(S, P - 1, P + W, M, base=3, th=4)           # the bressumer between the floors
    S.hline(P, P + W - 1, M + 4, 'b2')
    for x in range(P, P + W - 2, 12):                  # studs, upper and lower
        beam_v(S, x, U0 + 3, M - 1, base=3, tw=3)
        S.vline(x + 3, U0 + 4, M - 1, 'b2')
        beam_v(S, x, M + 4, G1 - 8, base=3, tw=3)
        S.vline(x + 3, M + 5, G1 - 8, 'b2')
    beam_v(S, P + W - 3, U0 + 3, G1 - 8, base=2, tw=3)
    for y in range(U0 + 3, U0 + 6):                    # the thatch's shadow under the eave
        for x in range(P, P + W):
            S.put(x, y, dark(pal.KEYS[S.get(x, y)]) if S.get(x, y) != pal.CLEAR else 'b2')
    stone_face(S, P - 1, G1 - 7, W + 2, 8, seed=seed + 2, ch=4, bw=(8, 14), chips=0, vary=.2)
    for wx in (P + 16, P + 64, P + 136):
        for y in range(U0 + 8, U0 + 27):
            S.hline(wx - 2, wx + 13, y, 'b3')
        lattice_window(S, wx, U0 + 9, 12, 14)
    for wx in (P + 76, P + 124):
        for y in range(M + 9, M + 33):
            S.hline(wx - 2, wx + 27, y, 'b3')
        lattice_window(S, wx, M + 11, 26, 18)
    # the door: wide, two leaves, one standing open on a dark room
    DX, DW, DH = P + 26, 30, 42
    dy0 = G1 - DH + 1
    for y in range(dy0 - 3, G1 + 1):
        for x in range(DX - 3, DX + DW + 3):
            S.put(x, y, 'w2')
    for x in range(DX - 3, DX + DW + 3):
        S.put(x, dy0 - 3, 'w4'); S.put(x, dy0 - 2, 'w3')
    for y in range(dy0, G1 + 1):
        for x in range(DX, DX + DW):
            S.put(x, y, 'w0' if x >= DX + DW // 2 else 'w1')
    planks_v(S, DX, dy0, DW // 2, DH, base=3, pw=5, seed=seed + 3)
    for x in range(DX + DW // 2, DX + DW // 2 + 4):    # the open leaf, edge-on
        for y in range(dy0, G1 + 1):
            S.put(x, y, 'w4' if x == DX + DW // 2 else ('w3' if x < DX + DW // 2 + 3 else 'w2'))
    for x in range(DX + DW // 2 + 4, DX + DW):          # the floor inside
        S.put(x, G1 - 2, 'w2'); S.put(x, G1 - 1, 'w3')
    for sy in (dy0 + 10, dy0 + 30):
        for x in range(DX + 2, DX + DW // 2 - 1):
            S.put(x, sy, 't2')
    S.put(DX + DW // 2 - 4, dy0 + 21, 'o4')
    for x in range(DX - 5, DX + DW + 5):
        S.put(x, G1, 't5' if x < DX + DW + 3 else 't3'); S.put(x, G1 + 1, 't3')
    # the chimney at the west end, through the thatch
    cx0, cw = P + 12, 14
    stone_face(S, cx0, 6, cw, RIDGE + 10 - 6, seed=seed + 5, ch=5, bw=(5, 9), chips=0, vary=0)
    for y in range(6, RIDGE + 10):
        S.put(cx0, y, 't5'); S.put(cx0 + cw - 1, y, 't3')
    for x in range(cx0 - 1, cx0 + cw + 1):
        S.put(x, 4, 't6' if x < cx0 + cw - 2 else 't4'); S.put(x, 5, 't4'); S.put(x, 6, 't2')
    for x in range(cx0 + 3, cx0 + 10):
        S.put(x, 3, 'k1')
    for x in range(cx0 - 2, cx0 + cw + 2):              # the thatch tucks round its foot
        S.put(x, RIDGE + 10, 'h3' if x < cx0 + cw else 'h1'); S.put(x, RIDGE + 11, 'h1')
    for y in range(RIDGE - 4, RIDGE + 14):
        for x in range(cx0 + cw, cx0 + cw + 6 - max(0, y - RIDGE - 8)):
            if S.get(x, y) in pal.RAMP['h']:
                S.put(x, y, pal.KEYS[pal.shift_index(S.get(x, y), -1)])
    # the tankard on its board, hung from a bracket off the bressumer, east of the door
    board = sign_board(24, 22, ('x2', 'x2'), TANKARD, TANKARD_KM)
    hang_sign(S, DX + DW + 2, M + 5, board, chain=2, bracket=28)
    for mx in (P + 2, P + 70, P + 150):
        moss(S, mx, G1 - 1, R)
    selout(S, over={'b': 'w1'})
    S.points = {'door': (DX + DW // 2 - P, yb), 'w': W, 'chimney': (cx0 + 7 - P, 3), 'top': TOP}
    return S
