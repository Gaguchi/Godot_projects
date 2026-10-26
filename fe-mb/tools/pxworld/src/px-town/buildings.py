"""px-town buildings: the inn, the shop and the tavern of Riverside Market, at town scale (folk ~42 px tall).

Each builder returns a Sprite whose anchor is the middle of its front wall's foot, plus a dict of points
(door, sign, chimney) relative to the wall's bottom-left. Light from the upper left: north roof slopes and west faces
are lit, south faces take the middle step, undersides and contact lines the dark step. Inked with selout.
"""
import random

import numpy as np

from pxt import (Sprite, CLEAR, IX, kk, pal, selout, stone_face, moss, planks_v, planks_h, beam_h, beam_v, brace,
                 window_px, arch_mask, seg_arch_mask)


def ascii_stamp(s, x, y, rows, km):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in '. ':
                s.put(x + i, y + j, km[ch])


def shift_rect(s, x, y, w, h, n=-1, ramps=None):
    """Move pixels in a box n steps down their own ramp (a hard shadow inside a sprite)."""
    a = np.ones((h, w), bool)
    s.shift((a, x, y), n, ramps)


# ------------------------------------------------------------------ signs
BED = [
    "hh................",
    "HH................",
    "HHPPPP............",
    "HHPPPPpbbbbbbbbbFF",
    "HHpppBBBBBBBBBBBFF",
    "HHsssssssssssssbFF",
    "HHffffffffffffffFF",
    "HH..............FF",
]
BED_KM = {'h': 'w6', 'H': 'w4', 'P': 'b5', 'p': 'b3', 'b': 'x5', 'B': 'x4', 's': 'b2', 'f': 'w3', 'F': 'w4'}

TANKARD = [
    "..b5b5b.....",
    ".b55555b....",
    "b5555555b...",
    "c5555555c...",
    "WwwWwwWwv.hh",
    "TTTTTTTTt.vh",
    "WwwWwwWwv..h",
    "WwwWwwWwv..h",
    "WwwWwwWwv.hh",
    "TTTTTTTTthh.",
    "WwwWwwWwv...",
    "dddddddde...",
]
TANKARD_KM = {'5': 'b5', 'b': 'b4', 'c': 'b3', 'W': 'w6', 'w': 'w5', 'v': 'w3', 'T': 't5', 't': 't3', 'h': 'w4',
              'd': 'w2', 'e': 'w1'}

ARMS2 = [  # a sword held point-down before a heater shield
    ".........ii.........",
    ".........HH.........",
    "......GGGGGGGG......",
    "...oooooSSsooooo....",
    "...oBBBBSSsBBBbo....",
    "...oBBBBSSsBBBbo....",
    "...oBBBBSSsBBBbo....",
    "...oBBBBSSsBBBbo....",
    "...oBBBBSSsBBBbo....",
    "....oBBBSSsBBbo.....",
    "....oBBBSSsBBbo.....",
    ".....oBBSSsBbo......",
    "......oBSSsbo.......",
    ".......oSSso........",
    "........SSs.........",
    ".........S..........",
]
ARMS2_KM = {'i': 'o5', 'H': 'w4', 'G': 'o4', 'o': 'o4', 'B': 's4', 'b': 's3', 'S': 't6', 's': 't4'}

ARMS = [   # a round shield with a sword behind it, blade up
    ".........S......",
    "........SB......",
    ".......SBb......",
    "...ooo.SBo......",
    "..oOOOoSBoo.....",
    ".oOOOOOSBooo....",
    ".oOOOggSBgoo....",
    "oOOOgGGSBGgoo...",
    "oOOOgGGSBGgoo...",
    "oOOOOggSBgooo...",
    ".oOOOOOSBooo....",
    ".oOOOOxxxXoo....",
    "..oOOoxXXxo.....",
    "...oooxHHxi.....",
    ".......HH.......",
    ".......KK.......",
]
ARMS_KM = {'S': 't6', 'B': 't4', 'b': 't3', 'O': 's4', 'o': 's3', 'g': 'o5', 'G': 'o4', 'x': 'o4', 'X': 'o3',
           'H': 'w4', 'K': 'o4', 'i': 's2'}


def sign_board(w, h, field, emblem, km, frame=('w5', 'w4', 'w2')):
    """A painted board in a wooden frame, emblem centred. Returns a Sprite (anchor top centre)."""
    s = Sprite(w, h, w // 2, 0)
    for j in range(h):
        for i in range(w):
            if i in (0, w - 1) or j in (0, h - 1):
                k = frame[2]
            elif i == 1 or j == 1:
                k = frame[0]
            elif i == w - 2 or j == h - 2:
                k = frame[2]
            elif i == 2 or j == 2 or i == w - 3 or j == h - 3:
                k = frame[1]
            else:
                k = field[0] if (j > 3) else field[1]
            s.put(i, j, k)
    ew, eh = len(emblem[0]), len(emblem)
    ascii_stamp(s, (w - ew) // 2, (h - eh) // 2 + (1 if eh < h - 6 else 0), emblem, km)
    selout(s)
    return s


def hang_sign(s, x, y, board, chain=4, bracket=0):
    """Hang a board under (x, y): a wrought bracket running `bracket` px east (0 = straight from a beam), two chains."""
    if bracket:
        for i in range(bracket):
            s.put(x + i, y, 't2')
            s.put(x + i, y - 1, 't3' if i % 5 else 't2')
        # the scroll at the bracket's root
        for (dx, dy) in ((0, 1), (1, 2), (2, 2), (3, 1), (2, 0)):
            s.put(x + dx, y + dy + 1, 't2')
        s.put(x, y + 2, 't1')
    bx = x + (bracket - board.w) // 2 if bracket else x - board.w // 2
    for cx in (bx + 3, bx + board.w - 4):
        for j in range(1, chain + 1):
            s.put(cx, y + j, 't4' if j % 2 else 't2')
    s.blit(board, bx, y + chain + 1)
    return bx, y + chain + 1


# ------------------------------------------------------------------ roofs
def tile_roof(s, x0, x1, y0, y1, seed=0, course=4, tw=(7, 9), ramp='r', base=3):
    """An E-W slope seen from above-south: courses of tiles, each course lit along its top row and dark along its foot,
    butt joints staggered course to course."""
    R = random.Random(seed)
    y = y0
    row = 0
    while y <= y1:
        x = x0 - R.randint(0, 6) - (4 if row % 2 else 0)
        for j in range(course):
            yy = y + j
            if yy > y1:
                break
            lv = base + 1 if j == 0 else (base - 1 if j == course - 1 else base)
            s.hline(x0, x1, yy, kk(ramp, lv))
        while x <= x1:
            w = R.randint(*tw)
            jx = x + w
            if x0 <= jx <= x1:
                for j in range(1, course - 1):
                    if y + j <= y1:
                        s.put(jx, y + j, kk(ramp, base - 1))
                if y <= y1 and jx + 1 <= x1:
                    s.put(jx + 1, y, kk(ramp, base + 2))
            x = jx + 1
        y += course
        row += 1


def thatch(s, x0, x1, y0, y1, seed=0, base=3, ramp='h', band=7):
    """Thatch: bundles laid in courses, drawn as short raking strokes (lit on the left of each bundle,
    dark between), each course's foot a dark line where the next course tucks under."""
    R = random.Random(seed)
    for yy in range(y0, y1 + 1):
        s.hline(x0, x1, yy, kk(ramp, base))
    y = y0
    row = 0
    while y <= y1:
        x = x0 - R.randint(0, 3)
        while x <= x1:
            sw = R.choice((3, 3, 4, 4, 5))
            ln = R.randint(band - 3, band)
            for j in range(ln):
                yy = y + j
                if yy > y1:
                    break
                xx = x + j // 3
                if x0 <= xx <= x1:
                    s.put(xx, yy, kk(ramp, base + 1))
                if x0 <= xx + sw - 1 <= x1 and j > 0:
                    s.put(xx + sw - 1, yy, kk(ramp, base - 1))
            if R.random() < .25 and x0 <= x + 1 <= x1 and y + 1 <= y1:
                s.put(x + 1, y + 1, kk(ramp, base + 2))
            x += sw
        # the course foot
        fy = y + band
        if fy <= y1:
            for xx in range(x0, x1 + 1):
                if R.random() < .86:
                    s.put(xx, fy, kk(ramp, base - 1))
        y += band + 1
        row += 1


def hip_roof(S, x0, x1, top, ridge, eave, hip, kind='tile', seed=0):
    """A hipped roof, ridge east-west, seen from above the street: the north slope and the west hip face the light,
    the south slope takes the middle step, the east hip the shade. Hip and ridge lines are raised (lit over dark).
    kind: tile (Roof ramp) | thatch (Wheat ramp)."""
    R = random.Random(seed)
    ramp = 'r' if kind == 'tile' else 'h'
    tone = {'n': 5, 'w': 4, 's': 3, 'e': 2} if kind == 'tile' else {'n': 4, 'w': 3, 's': 2, 'e': 1}

    def inset(y):
        if y <= ridge:
            return hip * (y - top) / max(1, ridge - top)
        return hip * (eave - y) / max(1, eave - ridge)
    face = {}
    for y in range(top, eave + 1):
        ins = inset(y)
        for x in range(x0, x1 + 1):
            if x - x0 < ins - .01:
                f = 'w'
            elif x1 - x < ins - .01:
                f = 'e'
            elif y < ridge:
                f = 'n'
            elif y == ridge:
                f = 'r'
            else:
                f = 's'
            face[(x, y)] = f
            S.put(x, y, kk(ramp, tone.get(f, 5)))
    # the south slope's texture
    if kind == 'tile':
        tile_roof(S, x0, x1, ridge + 1, eave, seed=seed)
    else:
        thatch(S, x0, x1, ridge + 1, eave, seed=seed, base=2)
    for (x, y), f in face.items():
        if f != 's':
            S.put(x, y, kk(ramp, tone.get(f, 5)))
    # courses on the north slope (horizontal) and the hips (vertical: they run parallel to each hip's eave)
    for (x, y), f in face.items():
        if f == 'n' and (y - top) % 4 == 3:
            S.put(x, y, kk(ramp, tone['n'] - 1))
        elif f == 'w' and (x - x0) % 4 == 3:
            S.put(x, y, kk(ramp, tone['w'] - 1))
        elif f == 'e' and (x1 - x) % 4 == 3:
            S.put(x, y, kk(ramp, tone['e'] - 1))
        elif kind == 'thatch' and f == 'n' and (y - top) % 4 in (0, 1) and (x * 5 + (y - top) // 4 * 3) % 7 == 0:
            S.put(x, y, kk(ramp, tone['n'] + 1))           # bundle ends catching the sun, in courses
        elif kind == 'thatch' and f in ('w', 'e') and (x - x0 if f == 'w' else x1 - x) % 4 == 1 and (y * 3) % 7 < 3:
            S.put(x, y, kk(ramp, tone[f] + 1))             # strokes down each hip course
    # raised hip lines and the ridge cap
    for y in range(top, eave + 1):
        ins = inset(y)
        xw = x0 + int(round(ins))
        xe = x1 - int(round(ins))
        if y != ridge:
            S.put(xw, y, kk(ramp, 5)); S.put(xw + 1, y, kk(ramp, 2) if y > ridge else kk(ramp, 4))
            S.put(xe, y, kk(ramp, 3)); S.put(xe - 1, y, kk(ramp, 1) if y > ridge else kk(ramp, 4))
    for x in range(x0 + hip, x1 - hip + 1):
        S.put(x, ridge - 1, kk(ramp, 5))
        S.put(x, ridge, kk(ramp, 4) if (x - x0) % 9 else kk(ramp, 2))
        S.put(x, ridge + 1, kk(ramp, 2))
    # the eave: the last course's edge, the fascia, the drip
    for x in range(x0, x1 + 1):
        f = face[(x, eave)]
        S.put(x, eave - 1, kk(ramp, 2) if f == 's' else S.get(x, eave - 1) and kk(ramp, tone[f] - 1))
        S.put(x, eave, kk(ramp, 1))
    for y in range(top, eave + 1):
        S.put(x0, y, kk(ramp, 4)); S.put(x1, y, kk(ramp, 1))
    return face


# ------------------------------------------------------------------ the inn
def inn(seed=21):
    """The inn: a long two-storey house with its ridge east-west. Coursed grey stone below, a jettied timber-framed
    upper floor over it, a red tile roof with a dormer and a chimney, a round-arched door, the bed on its board."""
    R = random.Random(seed)
    W = 204
    P = 12
    S = Sprite(P + W + 14, 196, P + W // 2, 191)
    yb = 191
    G0, G1 = 133, yb                # ground floor rows
    U0, U1 = 83, 129                # upper floor rows
    RX0, RX1 = P - 9, P + W + 8     # roof span
    # ---- roof: hipped, tiles
    hip_roof(S, RX0, RX1, 20, 36, 82, 26, 'tile', seed=seed)
    # ---- upper floor: plaster, timber frame, jettied 3 px
    UX0, UX1 = P - 3, P + W + 2
    for y in range(U0, U1 + 1):
        S.hline(UX0, UX1, y, 'b3')
    posts = [UX0, P + 38, P + 86, P + 134, P + 182, UX1 - 3]
    rails = [(U0, 4), (U0 + 30, 3)]
    for (ry, th) in rails:
        beam_h(S, UX0, UX1, ry, base=3, th=th)
        S.hline(UX0, UX1, ry + th, 'b2')               # the rail's shadow on the plaster
    for px in posts:
        beam_v(S, px, U0, U1, base=3, tw=4 if px in (UX0, UX1 - 3) else 3)
        S.vline(px + (4 if px in (UX0, UX1 - 3) else 3), U0 + 4, U1, 'b2')
    # braces in the outer panels
    brace(S, UX0 + 4, U0 + 32, UX0 + 4 + 14, U1 - 2, base=3, tw=3)
    brace(S, UX1 - 4, U0 + 32, UX1 - 4 - 14, U1 - 2, base=3, tw=3)
    # upper windows, green shutters
    for wx in (P + 54, P + 102, P + 150):
        window_px(S, wx, U0 + 9, 14, 16, shutter='m')
    window_px(S, P + 14, U0 + 9, 14, 16, shutter='m')
    # ---- the jetty: a beam with the joist ends showing
    beam_h(S, UX0 - 2, UX1 + 2, U1 + 1, base=3, th=3)
    for jx in range(UX0, UX1, 11):
        S.put(jx, U1 + 2, 'w5'); S.put(jx + 1, U1 + 2, 'w4'); S.put(jx + 1, U1 + 3, 'w2')
    # ---- ground floor: coursed stone
    stone_face(S, P, G0, W, G1 - G0 + 1, seed=seed + 1, ch=6, bw=(10, 18))
    shift_rect(S, P, G0, W, 3, -1)                    # the jetty's shadow
    for x in range(P, P + W):
        S.put(x, G1, kk('t', 2) if S.get(x, G1) != IX('t1') else 't1')
    # quoins: long-and-short dressed stones up both corners
    for (qx, side) in ((P, 1), (P + W - 7, -1)):
        y = G0 + 3
        k = 0
        while y + 5 <= G1:
            ln = 7 if k % 2 == 0 else 4
            x0 = qx if side > 0 else qx + 7 - ln
            for j in range(5):
                for i in range(ln):
                    lv = 5 if (j == 0 or i == 0) else (3 if (j == 4 or i == ln - 1) else 4)
                    S.put(x0 + i, y + j, kk('t', lv))
            S.hline(x0, x0 + ln - 1, y + 5, 't2')
            y += 6
            k += 1
    # door: a round-headed opening, plank leaf, iron straps, a dressed surround
    DX, DW, DH = P + 52, 26, 45
    dy0 = G1 - DH + 1
    am = arch_mask(DW + 6, DH + 3)            # the surround
    for j in range(am.shape[0]):
        for i in range(am.shape[1]):
            if am[j, i]:
                xx, yy = DX - 3 + i, dy0 - 3 + j
                S.put(xx, yy, 't5' if (i + j // 4) % 7 else 't3')
    am2 = arch_mask(DW, DH)
    leaf = lambda x, y: (0 <= x - DX < DW and 0 <= y - dy0 < DH and am2[y - dy0, x - DX])  # noqa: E731
    planks_v(S, DX, dy0, DW, DH, base=3, pw=5, seed=seed + 2, clip=leaf)
    for j in range(DH):            # the reveal: the leaf sits back, shaded under the arch and on its west jamb
        for i in range(DW):
            if am2[j, i] and (j < 2 or i < 2 or (j < DW // 2 + 1 and not am2[max(0, j - 2), i])):
                S.put(DX + i, dy0 + j, 'w1')
    for sy in (dy0 + 16, dy0 + 32):
        for i in range(2, DW - 2):
            if am2[sy - dy0, i]:
                S.put(DX + i, sy, 't2')
                S.put(DX + i, sy + 1, 't1')
        for i in range(4, DW - 3, 6):
            S.put(DX + i, sy, 't4')
    S.put(DX + DW - 6, dy0 + 25, 'o4'); S.put(DX + DW - 6, dy0 + 26, 'o2')     # the ring
    for i in range(-4, DW + 4):                       # the threshold step
        S.put(DX + i, G1, 't5' if i < DW + 2 else 't4')
        S.put(DX + i, G1 + 1, 't3')
    # ground windows: deep stone reveals, a lintel and a sill
    for wx in (P + 16, P + 118, P + 160):
        window_px(S, wx, G0 + 14, 14, 18, frame='w', shutter=None)
        for i in range(-3, 17):
            S.put(wx + i, G0 + 11, 't5'); S.put(wx + i, G0 + 12, 't4'); S.put(wx + i, G0 + 13, 't2')
    # the bed on its board, hung from the jetty right of the door
    board = sign_board(30, 22, ('s2', 's2'), BED, BED_KM)
    hang_sign(S, P + 96, U1 + 4, board, chain=3)
    # ---- the dormer, centred on the south slope over the door bay
    dx0, dw = P + 92, 24
    for y in range(62, 80):
        S.hline(dx0, dx0 + dw - 1, y, 'b3')
    beam_v(S, dx0, 62, 79, base=3, tw=2)
    beam_v(S, dx0 + dw - 2, 62, 79, base=3, tw=2)
    window_px(S, dx0 + 6, 66, 12, 11, cross=True, sill=False)
    apex = (dx0 + dw // 2, 48)
    for y in range(48, 62):
        half = int((y - 48) * (dw / 2 + 3) / 14)
        for x in range(apex[0] - half, apex[0] + half + 1):
            S.put(x, y, 'r4' if x < apex[0] else 'r2')
        S.put(apex[0] - half, y, 'w4'); S.put(apex[0] + half, y, 'w2')
    for x in range(dx0 - 3, dx0 + dw + 3):
        S.put(x, 62, 'r1')
    shift_rect(S, dx0, 63, dw, 2, -1)
    for y in range(49, 80):          # its shadow on the tiles to the east: a sliver under its east rake
        half = int((min(y, 61) - 48) * (dw / 2 + 3) / 14)
        for x in range(apex[0] + half + 1, apex[0] + half + 5):
            if S.get(x, y) in pal.RAMP['r'] and y > 49:
                S.put(x, y, pal.KEYS[pal.shift_index(S.get(x, y), -1)])
    # ---- the chimney, on the ridge toward the east end
    cx0, cw = P + 146, 14
    stone_face(S, cx0, 6, cw, 34, seed=seed + 3, ch=5, bw=(5, 9), chips=0, vary=0)
    for y in range(6, 40):
        S.put(cx0, y, 't5')
        S.put(cx0 + cw - 1, y, 't3')
    for x in range(cx0, cx0 + cw):
        S.put(x, 39, 't2')
    for x in range(cx0 - 1, cx0 + cw + 1):
        S.put(x, 4, 't6' if x < cx0 + cw - 2 else 't4'); S.put(x, 5, 't4'); S.put(x, 6, 't2')
    for x in range(cx0 + 4, cx0 + 10):
        S.put(x, 1, 'r4' if x < cx0 + 7 else 'r3'); S.put(x, 2, 'r3'); S.put(x, 3, 'r2')
    for x in range(cx0 + 5, cx0 + 9):
        S.put(x, 0, 'k1')
    for y in range(30, 46):          # its shadow on the roof, thrown east-south-east from its foot
        x_a = cx0 + cw
        x_b = cx0 + cw + 6 - max(0, (y - 40))
        for x in range(x_a, x_b):
            if S.get(x, y) in pal.RAMP['r']:
                S.put(x, y, pal.KEYS[pal.shift_index(S.get(x, y), -1)])
    # moss at the foot
    for mx in (P + 2, P + 34, P + 84, P + 112, P + 150, P + 186):
        moss(S, mx, G1 - 1, R)
    # the eave's shadow on the upper wall
    shift_rect(S, UX0, U0, UX1 - UX0 + 1, 3, -1, ramps=('b', 'w'))
    selout(S, over={'b': 'w1'})
    S.points = {'door': (DX + DW // 2 - P, G1), 'chimney': (cx0 + 7 - P, 0), 'w': W, 'roof': (RX0 - P, RX1 - P), 'top': 0}
    return S
