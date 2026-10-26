"""px-town props at town scale (folk ~42 px tall): stalls, the well, a handcart, barrels, crates, sacks, a trestle
table and bench, a rowing boat, a bollard, a barrel of blades. Every one lit from the upper left, inked with selout,
anchored at its foot (the ground point it stands on)."""
import math
import random

import numpy as np

from pxt import Sprite, kk, pal, IX, CLEAR, selout, stone_face, planks_v, planks_h, beam_v, beam_h
from bld_more import awning, light, dark, BOTTLE


def put_rows(s, x, y, rows, km):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in '. ':
                s.put(x + i, y + j, km[ch])


# ------------------------------------------------------------------ barrels, crates, sacks
def barrel(h=20, w=15, lid=True):
    """An upright barrel: bulging staves lit on the west, two iron hoops, the lid seen from above."""
    s = Sprite(w + 2, h + 2, (w + 2) // 2, h)
    c = w / 2
    for y in range(h):
        t = y / (h - 1)
        bulge = 1 if .2 < t < .8 else 0
        x0 = 1 - bulge
        x1 = w - 1 + bulge
        for x in range(x0, x1 + 1):
            f = (x - x0) / max(1, x1 - x0)
            lv = 6 if f < .18 else (5 if f < .45 else (4 if f < .75 else 3))
            if (x - x0) % 4 == 3 and 2 < y < h - 1:
                lv -= 1                       # the stave joints
            s.put(x + 1, y + 1, kk('w', lv))
        for hy in (int(h * .22), int(h * .74)):
            if y in (hy, hy + 1):
                for x in range(x0, x1 + 1):
                    f = (x - x0) / max(1, x1 - x0)
                    s.put(x + 1, y + 1, 't5' if (y == hy and f < .4) else ('t3' if y == hy else 't2'))
    if lid:
        for x in range(2, w):
            s.put(x + 1, 1, 'w5'); s.put(x + 1, 2, 'w4' if x % 4 else 'w3')
        s.put(2, 1, 'w6'); s.put(w - 1 + 1, 2, 'w3')
        for x in range(1, w):
            s.put(x + 1, 3, 'w2')
    selout(s)
    return s


def crate(w=16, h=14, top=5, seed=0):
    """A slatted crate: its lid in the light, a plank front with a diagonal brace between corner posts."""
    s = Sprite(w + 2, h + 2, (w + 2) // 2, h)
    for y in range(top):
        for x in range(w):
            s.put(x + 1, y + 1, 'w6' if y == 0 else ('w5' if y < top - 1 else 'w4'))
        if 0 < y < top - 1:
            s.put(1 + w // 2, y + 1, 'w4')
    planks_h(s, 1, top + 1, w, h - top, base=4, ph=3, seed=seed)
    for y in range(top + 1, h + 1):
        s.put(1, y, 'w5'); s.put(2, y, 'w4'); s.put(w - 1, y, 'w3'); s.put(w, y, 'w2')
    n = h - top - 1
    for i in range(3, w - 3):
        y = top + 1 + int((i - 3) * n / max(1, w - 7))
        s.put(i + 1, y, 'w3')
        s.put(i + 1, y + 1, 'w2') if y + 1 <= h else None
    selout(s)
    return s


def sack(w=12, h=11, tone=('b5', 'b4', 'b3', 'b2')):
    s = Sprite(w + 2, h + 2, (w + 2) // 2, h)
    for y in range(h):
        t = y / (h - 1)
        half = (w / 2) * (.45 + .55 * math.sin(min(1, t * 1.4) * math.pi / 2)) if t < .85 else (w / 2) * (1 - (t - .85) * .8)
        for x in range(w):
            dx = x + .5 - w / 2
            if abs(dx) <= half:
                f = (dx + half) / max(1, 2 * half)
                k = tone[0] if (f < .3 and y > 2) else (tone[1] if f < .65 else tone[2])
                if y == h - 1:
                    k = tone[3]
                s.put(x + 1, y + 1, k)
    for x in range(w // 2 - 2, w // 2 + 2):        # the tie
        s.put(x + 1, 3, 'w3')
    s.put(w // 2 + 1, 1, tone[1]); s.put(w // 2, 1, tone[0])
    selout(s)
    return s


# ------------------------------------------------------------------ a market stall
PRODUCE = {
    'apples': ([".aa.aa.aa.", "aAaaAaaAaa", "aaaaaaaaaa"], {'a': 'x3', 'A': 'x5'}),
    'greens': ([".gg..gg..g", "gGgggGggGg", "gggggggggg"], {'g': 'l3', 'G': 'l5'}),
    'bread': (["..hhh..hhh", ".hHHHhhHHh", "hhhhhhhhhh"], {'h': 'h2', 'H': 'h4'}),
    'pots': ([".dd..dd...", "dDDd.DDd.d", "dddd.ddd.d"], {'d': 'r2', 'D': 'r4'}),
    'cloth': (["ssssbbbbxx", "sSssbBbbxX", "ssssbbbbxx"], {'s': 's2', 'S': 's4', 'b': 'b3', 'B': 'b5', 'x': 'x2', 'X': 'x4'}),
}


def stall(w=62, cloth=('b5', 'x3'), shade=('b4', 'x2'), goods=('apples', 'greens'), seed=0):
    """A market stall: a striped awning on four posts, a trestle counter with produce in shallow crates on it,
    a basket and a crate stowed under it."""
    R = random.Random(seed)
    H = 52
    s = Sprite(w + 10, H + 4, (w + 10) // 2, H + 1)
    o = 4
    # back posts (seen above the counter, behind it)
    for px in (o + 4, o + w - 6):
        beam_v(s, px, 12, 34, base=3, tw=2)
    # the counter: lit top, plank front
    ct = 30
    for x in range(o, o + w):
        s.put(x, ct, 'w6'); s.put(x, ct + 1, 'w5'); s.put(x, ct + 2, 'w5'); s.put(x, ct + 3, 'w4')
    planks_v(s, o + 1, ct + 4, w - 2, 9, base=4, pw=6, seed=seed, knots=False)
    for x in range(o, o + w):
        s.put(x, ct + 13, 'w2')
    # goods on the counter in shallow trays
    gx = o + 3
    for gi, g in enumerate(goods):
        rows, km = PRODUCE[g]
        for x in range(gx - 1, gx + 12):
            s.put(x, ct - 1, 'w3'); s.put(x, ct, 'w4')
        put_rows(s, gx, ct - 4, rows, km)
        gx += 15
    # legs under the counter and a stowed basket
    for lx in (o + 2, o + w - 4):
        beam_v(s, lx, ct + 14, H, base=3, tw=2)
    bx = o + 10 + R.randint(0, 10)
    put_rows(s, bx, H - 6, ["hhhhhhhhh", "HhHhHhHhH", "hHhHhHhHh", "HhHhHhHhH", "hhhhhhhhh", ".hhhhhhh."],
             {'h': 'h2', 'H': 'h3'})
    # front posts, full height
    for px in (o, o + w - 2):
        beam_v(s, px, 12, H, base=4, tw=2)
    # the awning, over everything
    awning(s, o - 1, o + w, 2, 10, stripes=cloth, shade=shade, sw=7)
    selout(s, over={'b': 'w1'})
    return s


# ------------------------------------------------------------------ the well
def well():
    """The market well: a round coursed-stone curb (lit west, shaded east) around dark water, a timber frame with a
    winch and rope, a little shingled roof, a bucket on the rim."""
    W, H = 44, 58
    s = Sprite(W, H, W // 2, H - 2)
    cx = W / 2
    rx, ry = 17, 6
    top = 34                                 # the curb's top centre row
    side = 13                                # the drum's height
    # the drum
    for y in range(top, top + side + 1):
        for x in range(W):
            dx = x + .5 - cx
            if abs(dx) <= rx:
                f = (dx + rx) / (2 * rx)
                lv = 5 if f < .28 else (4 if f < .62 else (3 if f < .86 else 2))
                if (y - top) % 5 == 4:
                    lv -= 1
                elif ((x // 6) + ((y - top) // 5)) % 2 == 0 and x % 6 == 0:
                    lv -= 1
                s.put(x, y + int(ry * math.sqrt(max(0, 1 - (dx / rx) ** 2))), kk('t', lv))
    # the curb's top: a ring of stones seen from above
    for y in range(top - ry - 1, top + ry + 2):
        for x in range(W):
            dx, dy = x + .5 - cx, y + .5 - top
            r_out = (dx / rx) ** 2 + (dy / ry) ** 2
            r_in = (dx / (rx - 4)) ** 2 + (dy / (ry - 2)) ** 2
            if r_out <= 1 and r_in > 1:
                ang = math.atan2(dy * rx / ry, dx)
                seg = int((ang + math.pi) / (2 * math.pi) * 14)
                lv = 5 if dy < 0 or dx < -rx * .3 else 4
                if dy < -1 and dx < 0:
                    lv = 6
                s.put(x, y, kk('t', lv))
                a2 = (ang + math.pi) / (2 * math.pi) * 14
                if abs(a2 - round(a2)) < .09:
                    s.put(x, y, 't3')
            elif r_in <= 1:
                s.put(x, y, 'a1' if dy < .5 else 'a2')
    # the frame: two posts, a cross beam with the winch, a shingled roof
    for px in (int(cx - rx + 2), int(cx + rx - 4)):
        beam_v(s, px, 8, top + 1, base=4, tw=3)
    beam_h(s, int(cx - rx + 2), int(cx + rx - 2), 14, base=3, th=3)
    for x in range(int(cx - 6), int(cx + 6)):     # the winch drum, rope wound on it
        s.put(x, 17, 'w5'); s.put(x, 18, 'b3' if x % 2 else 'b2'); s.put(x, 19, 'w3')
    for y in range(20, top - 2):
        s.put(int(cx), y, 'b3')
    for y in range(0, 10):                        # the roof: two slopes, west lit
        half = 4 + y * 2
        for x in range(int(cx - half), int(cx + half) + 1):
            if 0 <= x < W:
                s.put(x, y, 'w6' if x < cx else 'w3')
                if y % 3 == 2:
                    s.put(x, y, 'w5' if x < cx else 'w2')
    for y in range(0, 10):
        s.put(int(cx), y, 'w6')
    # a bucket on the rim
    put_rows(s, int(cx + rx - 10), top - 6, [".tttt.", "tWWWWt", "wwwwww", "TTTTTT", "wwwwww", ".wwww."],
             {'t': 't3', 'W': 'w6', 'w': 'w4', 'T': 't3'})
    selout(s)
    return s


# ------------------------------------------------------------------ a handcart
def wheel(r=10, hub=2, spokes=8):
    """A spoked wheel seen side-on: a hand-stepped rim two px thick with an iron tyre, lit on its upper left, eight
    spokes on clean 45-degree lines, open between them (only the rim is inked)."""
    d = 2 * r + 1
    s = Sprite(d + 2, d + 2, r + 1, d)
    c = r + .5
    rim = set()
    for y in range(d):
        for x in range(d):
            dx, dy = x + .5 - c, y + .5 - c
            q = math.hypot(dx, dy)
            if r - 2.2 <= q <= r + .3:
                lit = (dx + dy) < -r * .4
                k = 'w6' if lit else ('w4' if (dx + dy) > r * .4 else 'w5')
                if q > r - .9:
                    k = 't5' if lit else 't3'
                s.put(x + 1, y + 1, k)
                rim.add((x + 1, y + 1))
    for k in range(spokes):
        dxs, dys = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)][k]
        for t in range(hub, r - 1):
            x, y = int(c - .5) + dxs * t, int(c - .5) + dys * t
            if math.hypot(x + .5 - c, y + .5 - c) < r - 1.6:
                s.put(x + 1, y + 1, 'w6' if (dxs + dys) <= 0 else 'w5')
    for y in range(-hub, hub + 1):
        for x in range(-hub, hub + 1):
            if x * x + y * y <= hub * hub + 1:
                s.put(int(c) + x + 1, int(c) + y + 1, 'w6' if x + y < 0 else 'w3')
    inner = s.ix.copy()
    selout(s)
    # keep the ink outside the rim only: the gaps between the spokes stay open
    for y in range(s.h):
        for x in range(s.w):
            if inner[y, x] == CLEAR and math.hypot(x - 1 + .5 - c, y - 1 + .5 - c) < r - 2.2:
                s.ix[y, x] = CLEAR
    return s


def handcart(load=True, seed=0):
    """A two-wheeled handcart resting on its legs, shafts to the west: a plank bed with side boards, sacks and a
    barrel on it, the near wheel side-on."""
    W, H = 70, 44
    s = Sprite(W, H, 40, H - 2)
    by = 24
    # shafts down to the ground on the west
    for i in range(22):
        x = 2 + i
        y = by + 6 + (21 - i) // 4
        s.put(x, y, 'w5'); s.put(x, y + 1, 'w3')
    # the bed: side board then the bed face
    planks_h(s, 20, by, 46, 9, base=4, ph=3, seed=seed)
    for x in range(20, 66):
        s.put(x, by - 1, 'w6')
    for (px) in (20, 42, 64):
        beam_v(s, px, by - 1, by + 8, base=3, tw=2)
    # the load
    if load:
        sk = sack(13, 12)
        s.blit(sk, 24, by - 13)
        s.blit(sack(12, 11, ('b4', 'b3', 'b2', 'b1')), 36, by - 12)
        br = barrel(15, 12)
        s.blit(br, 49, by - 16)
    # the leg at the back and the wheel
    beam_v(s, 62, by + 9, H - 3, base=3, tw=2)
    wh = wheel(10)
    s.blit(wh, 30, by - 4)
    selout(s)
    return s


# ------------------------------------------------------------------ outside the tavern, on the quay, at the shop
def trestle(w=40):
    """A trestle table with two tankards and a bench before it."""
    s = Sprite(w + 4, 26, (w + 4) // 2, 24)
    for x in range(1, w + 1):
        s.put(x, 6, 'w6'); s.put(x, 7, 'w5'); s.put(x, 8, 'w5'); s.put(x, 9, 'w3')
    for lx in (4, w - 4):
        for y in range(10, 20):
            s.put(lx, y, 'w4'); s.put(lx + 1, y, 'w2')
    for (tx) in (8, 24):
        put_rows(s, tx, 0, [".bbb..", "bbbbb.", "WwwWvh", "WwwWvh", "TTTTt.", "WwwWv."],
                 {'b': 'b5', 'W': 'w6', 'w': 'w5', 'v': 'w3', 'h': 'w4', 'T': 't4', 't': 't3'})
    for x in range(3, w - 1):               # the bench in front
        s.put(x, 17, 'w6'); s.put(x, 18, 'w5'); s.put(x, 19, 'w3')
    for lx in (6, w - 6):
        for y in range(20, 24):
            s.put(lx, y, 'w4'); s.put(lx + 1, y, 'w2')
    selout(s)
    return s


def blades_barrel():
    """A barrel stood full of blades: sword hilts and a spear shaft over the rim."""
    b = barrel(17, 15)
    s = Sprite(b.w + 6, b.h + 16, (b.w + 6) // 2, b.h + 15)
    s.blit(b, 3, 16)
    # hilts and a spear, upright, behind the rim
    for (x, top, kind) in ((6, 6, 'sword'), (10, 2, 'spear'), (14, 7, 'sword'), (17, 9, 'sword')):
        if kind == 'spear':
            for y in range(top + 4, 19):
                s.put(x, y, 'w5'); s.put(x + 1, y, 'w3')
            put_rows(s, x - 1, top, [".t.", "ttT", "tTT", ".T."], {'t': 't6', 'T': 't4'})
        else:
            for y in range(top + 3, 18):
                s.put(x, y, 'w2')
            s.put(x - 1, top + 3, 'o4'); s.put(x, top + 3, 'o5'); s.put(x + 1, top + 3, 'o3')
            s.put(x, top + 2, 'o4'); s.put(x, top + 1, 'o3')
    selout(s)
    return s


def boat(L=50, B=18):
    """A rowing boat moored along the quay, bow to the north, seen from above: a lit west gunwale, plank strakes,
    two thwarts, a little bilge water."""
    s = Sprite(B + 4, L + 4, (B + 4) // 2, L + 1)
    c = B / 2
    for y in range(L):
        t = (y + .5) / L
        half = c * math.sin(math.pi * min(1, t * 1.06)) ** .55
        for x in range(B):
            dx = x + .5 - c
            if abs(dx) <= half:
                inner = abs(dx) <= half - 2.2
                if not inner:
                    k = 'w5' if dx < 0 else 'w2'
                    if abs(dx) > half - 1:
                        k = 'w6' if dx < 0 else 'w1'
                else:
                    k = 'w3' if int((dx + c)) % 4 else 'w2'
                    if dx < -half * .4:
                        k = 'w4' if int((dx + c)) % 4 else 'w3'
                s.put(x + 2, y + 2, k)
    for ty in (int(L * .35), int(L * .62)):
        for x in range(B):
            if s.get(x + 2, ty + 2) in (IX('w2'), IX('w3'), IX('w4')):
                s.put(x + 2, ty + 2, 'w5'); s.put(x + 2, ty + 3, 'w2')
    for y in range(int(L * .72), int(L * .84)):
        for x in range(int(c) - 2, int(c) + 3):
            if s.get(x + 2, y + 2) in (IX('w2'), IX('w3'), IX('w4')):
                s.put(x + 2, y + 2, 'a3')
    selout(s)
    return s


def bollard():
    s = Sprite(9, 12, 4, 10)
    put_rows(s, 1, 0, [".ttt.", "tTTtt", "TTtts", "tTtts", "tTtts", "tTtts", "tTtts", "sssss"],
             {'t': 't4', 'T': 't5', 's': 't2'})
    for i, k in enumerate(('b3', 'b2', 'b3')):
        s.put(1 + i, 4, k)
    selout(s)
    return s


def rope_coil():
    s = Sprite(14, 8, 7, 6)
    put_rows(s, 1, 0, ["..bbbbbbb..", ".bBbbbbbBb.", "bBb.....bBb", "bBb..a..bbb", ".bbbbbbbbb.", "..ccccccc.."],
             {'b': 'b3', 'B': 'b5', 'c': 'b2', 'a': 'w2'})
    selout(s)
    return s


def trough(w=34):
    """A stone horse trough: the rim in the light, water in it, a coursed face."""
    s = Sprite(w + 2, 16, (w + 2) // 2, 14)
    for x in range(1, w + 1):
        s.put(x, 1, 't6'); s.put(x, 2, 't5')
        s.put(x, 7, 't5')
    for y in range(3, 7):
        s.put(1, y, 't6'); s.put(2, y, 't5'); s.put(w, y, 't4'); s.put(w - 1, y, 't4')
        for x in range(3, w - 1):
            s.put(x, y, 'a2' if y == 3 else ('a4' if (x + y) % 9 == 0 else 'a3'))
    stone_face(s, 1, 8, w, 6, seed=3, ch=6, bw=(8, 12), chips=0, vary=0)
    selout(s)
    return s


def hen():
    """A hen, side-on, pecking: a bone body lit on its back, a red comb, a straw beak and legs."""
    s = Sprite(12, 10, 6, 8)
    put_rows(s, 1, 0, ["..r.....", ".bBb....", "hbBBb..b", ".bbBBBbB", "..bbbbbb", "...bbbb.", "...y.y..", "...y.y.."],
             {'r': 'x4', 'b': 'b3', 'B': 'b5', 'h': 'o4', 'y': 'o3'})
    selout(s, over={'b': 'w1'})
    return s


def dog():
    """A dun cur lying in the shade by the tavern door, head up."""
    s = Sprite(20, 12, 10, 10)
    put_rows(s, 1, 0, ["..dd...........", ".dDDd..........", "dDDDdd.........", ".dddDDDDDDDDd..",
                       "..dDDDDDDDDDDd.", "..ddddddddddddd", "...e.e....e..e."],
             {'d': 'd3', 'D': 'd5', 'e': 'd2'})
    selout(s)
    return s
