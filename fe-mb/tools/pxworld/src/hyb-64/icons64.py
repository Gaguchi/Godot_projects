"""24 px icons shaded in 4-5 tones (procedural masks, hand-placed details), plus hand-drawn cursors."""
import math
import numpy as np
from px64 import (Icon, Raster, cover, circle, ellipse, poly, rect_, union, minus, outline, from_rows, flipx, flipy, BR)

OCH = ['o1', 'o2', 'o3', 'o4', 'o5']
OCH6 = ['o0', 'o1', 'o2', 'o3', 'o4', 'o5']
OX = ['x1', 'x2', 'x3', 'x4', 'x5']
SL = ['s1', 's2', 's3', 's4', 's5']
SL5 = ['s0', 's1', 's2', 's3', 's4']
WD = ['w3', 'w4', 'w5', 'w6', 'b2']
CLOTH = ['w4', 'w5', 'w6', 'b2', 'b3']
BN = ['b0', 'b1', 'b2', 'b3', 'b4']
ST = ['o3', 'o4', 'o5', 'o6']


def star_pts(cx, cy, ro, ri, n, rot=-math.pi / 2):
    pts = []
    for i in range(n * 2):
        a = rot + math.pi * i / n
        r = ro if i % 2 == 0 else ri
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def sun(s=24):
    c = s / 2
    I = Icon(s, s)
    rays = cover(poly(star_pts(c, c, s * .47, s * .27, 8, -math.pi / 2)), s, s)
    I.layer(rays, ['o2', 'o3', 'o4', 'o5'], R=1.5, glint=False)
    I.layer(cover(circle(c, c, s * .27), s, s), ['o2', 'o3', 'o4', 'o5', 'o6'], R=3.2, inner_line='o1')
    return I.raster()


def coin(s=24):
    I = Icon(s, s)
    # a second coin behind, lower left, so the gold reads as a purse not a button
    I.layer(cover(ellipse(8, 15.5, 6.5, 6.5), s, s), ['o1', 'o2', 'o3', 'o4'], R=2.2, glint=False)
    I.layer(cover(circle(13.5, 11, 8.6), s, s), OCH6, R=2.6, inner_line='o0')
    face = cover(circle(13.5, 11, 5.6), s, s)
    rim = outline(face) & cover(circle(13.5, 11, 8.6), s, s)
    for j, i in zip(*np.nonzero(rim)):
        I.keys[j, i] = 'o2' if (i + j) < 26 else 'o4'
    # stamped mark: a small tower
    I.stamp(["k.k.k", "kkkkk", ".k2k.", ".k2k.", "kkkkk"], 11, 8, keymap={'k': 'o1', '2': 'o3'})
    I.put(10, 5, 'o6')
    return I.raster()


def ration(s=24):
    I = Icon(s, s)
    body = cover(ellipse(12, 15.5, 8.2, 7.2), s, s)
    neck = cover(poly([(8.5, 9.5), (15.5, 9.5), (14, 5), (10, 5)]), s, s)
    I.layer(body | neck, CLOTH, R=3.2)
    # mouth of the sack, folded cloth
    I.layer(cover(poly([(7.5, 5.5), (16.5, 5.5), (15, 2.2), (12, 3.6), (9, 2.2)]), s, s), ['w4', 'w5', 'w6', 'b2'], R=1.4, inner_line='w3', glint=False)
    # the tie: a rope band and a knot
    for i in range(8, 16):
        I.put(i, 8, 'o2' if i % 2 else 'o3')
        I.put(i, 9, 'o1')
    I.stamp(["k3k", "323", ".2."], 15, 7, keymap={'k': 'o1', '3': 'o3', '2': 'o2'})
    # a seam and a patch, so it reads as cloth
    for j in range(13, 20):
        if j % 2:
            I.put(9, j, 'w4')
    return I.raster()


def potion(s=24):
    I = Icon(s, s)
    glass = cover(circle(12, 15.2, 7.6), s, s) | cover(rect_(9.6, 6.5, 14.4, 11), s, s)
    I.layer(glass, ['s2', 's3', 's4', 's5'], R=2.4, glint=False)
    liquid = cover(circle(12, 15.2, 6.4), s, s) & cover(rect_(0, 12.2, 24, 24), s, s)
    sh = __import__('px64').shade(liquid, OX, R=3)
    for j, i in zip(*np.nonzero(liquid)):
        I.keys[j, i] = sh[j, i]
    # meniscus line
    for i in range(7, 18):
        if liquid[12, i]:
            I.keys[12, i] = 'x5'
    # cork and lip
    I.layer(cover(rect_(9, 2.2, 15, 6.4), s, s), ['w3', 'w4', 'w5', 'w6'], R=1.6, inner_line='w2', glint=False)
    for i in range(9, 15):
        I.put(i, 6, 'b3' if i < 12 else 'b2')
    # highlight on the glass
    for (x, y) in ((7, 13), (7, 14), (8, 12), (8, 15), (9, 11)):
        I.put(x, y, 's5')
    I.put(14, 18, 'x5')
    return I.raster()


def flame(s=24, core=True):
    I = Icon(s, s)
    sc = s / 24
    outer = cover(poly([(12 * sc, 1.5 * sc), (16.5 * sc, 7 * sc), (19 * sc, 12 * sc), (19.5 * sc, 16 * sc), (17.5 * sc, 20 * sc), (13.5 * sc, 22.6 * sc), (9.5 * sc, 22.4 * sc),
                            (5.6 * sc, 19.6 * sc), (4.4 * sc, 15.2 * sc), (5.6 * sc, 10.6 * sc), (7.4 * sc, 13 * sc), (8.6 * sc, 8 * sc)]), s, s)
    I.layer(outer, ['x1', 'x2', 'x3', 'x4', 'x5'], R=3.0 * sc, glint=False)
    mid = cover(poly([(12.6 * sc, 7 * sc), (16 * sc, 12.5 * sc), (16.6 * sc, 16.5 * sc), (14.6 * sc, 20 * sc), (11.6 * sc, 21 * sc), (8.6 * sc, 19.6 * sc), (7.6 * sc, 16.2 * sc), (9.4 * sc, 12.4 * sc), (10.6 * sc, 14.4 * sc)]), s, s)
    I.layer(mid, ['x3', 'o3', 'o4', 'o5'], R=2.4 * sc, glint=False)
    if core:
        inner = cover(ellipse(12.4 * sc, 17.6 * sc, 2.6 * sc, 3.2 * sc), s, s)
        I.layer(inner, ['o4', 'o5', 'o6'], R=1.6 * sc, glint=False)
    return I.raster()


def burst(s=24):
    I = Icon(s, s)
    c = s / 2
    I.layer(cover(poly(star_pts(c, c, s * .49, s * .2, 8, -math.pi / 2)), s, s), ['x2', 'x3', 'x4', 'o3', 'o4'], R=1.8 * s / 24, glint=False)
    I.layer(cover(poly(star_pts(c, c, s * .33, s * .15, 8, -math.pi / 2 + math.pi / 8)), s, s), ['o3', 'o4', 'o5', 'o6'], R=1.4 * s / 24, glint=False)
    I.layer(cover(circle(c, c, s * .12), s, s), ['o5', 'o6'], R=1, glint=False)
    return I.raster()


def shield(s=24):
    I = Icon(s, s)
    sc = s / 24
    outer = cover(poly([(3.5 * sc, 3 * sc), (20.5 * sc, 3 * sc), (20.5 * sc, 11 * sc), (18.8 * sc, 16 * sc), (15 * sc, 20 * sc), (12 * sc, 22.4 * sc), (9 * sc, 20 * sc), (5.2 * sc, 16 * sc), (3.5 * sc, 11 * sc)]), s, s)
    I.layer(outer, ['o1', 'o2', 'o3', 'o4', 'o5'], R=1.6 * sc, glint=False)
    inner = cover(poly([(6 * sc, 5.5 * sc), (18 * sc, 5.5 * sc), (18 * sc, 11 * sc), (16.6 * sc, 15 * sc), (13.6 * sc, 18.2 * sc), (12 * sc, 19.4 * sc), (10.4 * sc, 18.2 * sc), (7.4 * sc, 15 * sc), (6 * sc, 11 * sc)]), s, s)
    I.layer(inner, SL5, R=3.6 * sc, inner_line='o0')
    # a pale chevron across the field
    for i in range(int(7 * sc), int(17.6 * sc)):
        d = abs(i - 12 * sc)
        y = int(round(9 * sc + d * .7))
        if inner[y, i]:
            I.keys[y, i] = 's4'
            if inner[y + 1, i]:
                I.keys[y + 1, i] = 's3'
    return I.raster()


def orb(s=24):
    """Arcane Burst: a blue orb in a brass ring, like the one on Lilina's staff."""
    I = Icon(s, s)
    c = s / 2
    ring = cover(circle(c, c, s * .46), s, s) & ~cover(circle(c, c, s * .33), s, s)
    I.layer(ring, ['o1', 'o2', 'o3', 'o4', 'o5'], R=1.6 * s / 24, glint=False)
    I.layer(cover(circle(c, c, s * .33), s, s), ['s0', 's1', 's2', 's3', 's4', 's5'], R=3.6 * s / 24, inner_line='o0')
    # four prongs holding the orb
    for a in (0, 1, 2, 3):
        ang = -math.pi / 4 + a * math.pi / 2
        x, y = int(round(c + math.cos(ang) * s * .36 - .5)), int(round(c + math.sin(ang) * s * .36 - .5))
        I.put(x, y, 'o4' if a in (2, 3) else 'o2')
    # a pale swirl inside
    cx = cy = c - .5
    for t in np.linspace(0, 1.6 * math.pi, 22):
        r = s * (.06 + .1 * t / 5)
        x, y = int(round(cx + math.cos(t + 2.4) * r)), int(round(cy + math.sin(t + 2.4) * r))
        I.put(x, y, 's5' if t < 2.5 else 's4')
    return I.raster()


def swords(s=24):
    I = Icon(s, s)
    for flip in (False, True):
        m = np.zeros((s, s), bool)
        for t in np.linspace(0, 1, 60):
            x = 4 + t * 14
            y = 4 + t * 14
            if flip:
                x = s - 1 - x
            m[int(y), int(x)] = True
            m[int(y), min(s - 1, int(x) + 1)] = True
        blade = m.copy()
        blade[16:, :] = False
        I.layer(blade, ['b1', 'b2', 'b3', 'b5'], R=1, glint=False)
    for flip in (False, True):
        gx = 15 if not flip else 6
        I.stamp(["kk..", ".kk.", "..kk"] if not flip else ["..kk", ".kk.", "kk.."], gx, 14, keymap={'k': 'o3'})
        hx = 18 if not flip else 4
        I.stamp(["w", "w", "o"], hx, 18, keymap={'w': 'w5', 'o': 'o4'})
    return I.raster()


def padlock(s=16):
    I = Icon(s, s)
    sh = cover(circle(8, 6.5, 4.6), s, s) & ~cover(circle(8, 6.5, 2.6), s, s) & cover(rect_(0, 0, 16, 8), s, s)
    I.layer(sh, ['b0', 'b1', 'b2', 'b3'], R=1, glint=False)
    I.layer(cover(rect_(3, 7.5, 13, 14.5), s, s), ['o1', 'o2', 'o3', 'o4', 'o5'], R=2)
    I.stamp(["k", "k", "k"], 7, 10, keymap={'k': 'o0'})
    I.stamp(["k"], 8, 10, keymap={'k': 'o0'})
    return I.raster()


# ---------------------------------------------------------------- hand-drawn bits
# AP gem: an amber cabochon in a brass bezel. digits = Ochre ramp.
GEM = [
    "....kkkkkk....",
    "..kk433332kk..",
    ".k4466555432k.",
    ".k46655554321k"[:14],
    "k456554444321k",
    "k455444433221k"[:14],
    "k454444333221k"[:14],
    "k444443332211k"[:14],
    "k344433322110k"[:14],
    "k334333221110k"[:14],
    ".k3332221110k.",
    ".k2222111100k.",
    "..kk111000kk..",
    "....kkkkkk....",
]
GEM_EMPTY = [
    "....kkkkkk....",
    "..kkwwwwwwkk..",
    ".kwwvvvvvvwwk.",
    ".kwvvvvvvvvwk.",
    "kwvvvvvvvvvvwk",
    "kwvvvvvvvvvvwk",
    "kwvvvvvvvvvvwk",
    "kwvvvvvvvvvvwk",
    "kwvvvvvvvvvvwk",
    "kwvvvvvvvvvvxk",
    ".kwvvvvvvvvxk.",
    ".kxwvvvvvvxxk.",
    "..kkxxxxxxkk..",
    "....kkkkkk....",
]


def gem20(state='full'):
    """A 20 px amber cabochon in a brass bezel. state: full | spend (the aimed card will spend it)"""
    import px64 as P
    s = 20
    I = Icon(s, s)
    I.layer(cover(circle(10, 10, 9.4), s, s), ['o0', 'o1', 'o2', 'o3', 'o4'], R=1.6, glint=False)
    I.layer(cover(circle(10, 10, 6.9), s, s), ['x1', 'x2', 'o2', 'o3', 'o4', 'o5'], R=4.2, inner_line='o0', glint=False)
    for (x, y, c) in ((7, 6, 'o6'), (8, 6, 'o6'), (7, 7, 'o6'), (6, 8, 'o5'), (12, 14, 'o4'), (13, 13, 'o4')):
        I.put(x, y, c)
    r = I.raster()
    if state != 'spend':
        R = Raster(26, 26)
        R.blit(r, 3, 3)
        return R
    R = Raster(26, 26)
    for j in range(26):
        for i in range(26):
            d = math.hypot(i + .5 - 13, j + .5 - 13)
            if 11.2 <= d < 12.4:
                R.set(i, j, 'b5' if (i + j) < 26 else 'b3')
            elif 12.4 <= d < 13.4 or 10.4 <= d < 11.2:
                R.set(i, j, 'k0')
    R.blit(r, 3, 3)
    return R


def gem(state='full'):
    """state: full | spend (will be spent by the aimed card) | empty"""
    rows = [r.ljust(14, '.')[:14] for r in GEM]
    km = {str(i): f'o{i}' for i in range(7)}
    if state == 'empty':
        return from_rows(GEM_EMPTY, {'w': 'w3', 'v': 'w1', 'x': 'w4'})
    r = from_rows(rows, km)
    # a glint
    r.set(4, 3, 'o6'); r.set(5, 3, 'o6'); r.set(4, 4, 'o6')
    if state == 'spend':
        R = Raster(18, 18)
        # a bone ring marks the gems this card will spend
        for j in range(18):
            for i in range(18):
                d = math.hypot(i - 8.5, j - 8.5)
                if 8.0 <= d < 9.0:
                    R.set(i, j, 'b5')
                elif 9.0 <= d < 9.9:
                    R.set(i, j, 'k0')
        R.blit(r, 2, 2)
        return R
    return r


# side glyphs: square = ours, diamond = theirs (shape, not just colour)
SQ = ["kkkkkkkkk", "k4444443k", "k4333332k", "k4322212k", "k4322212k", "k4322212k", "k4311112k", "k3222222k", "kkkkkkkkk"]
SQ_KM = {'4': 's5', '3': 's4', '2': 's3', '1': 's2'}
SQ_ACT_KM = {'4': 'o6', '3': 'o5', '2': 'o4', '1': 'o3'}
DIA = ["....k....", "...k4k...", "..k432k..", ".k43321k.", "k4332211k", ".k32211k.", "..k211k..", "...k1k...", "....k...."]
DIA_KM = {'4': 'x5', '3': 'x4', '2': 'x3', '1': 'x2'}


def side_glyph(side, act=False):
    if side == 'ally':
        return from_rows(SQ, SQ_ACT_KM if act else SQ_KM)
    return from_rows(DIA, DIA_KM)


# the acting marker: a brass arrow pointing down
ARROW = [
    "kkkkkkkkkkkkk",
    "k55555555544k",
    "kk555555443kk",
    ".k45554433k..",
    ".kk544432kk..",
    "..k443321k...",
    "..kk3321kk...",
    "...k3221k....",
    "...kk21kk....",
    "....k21k.....",
    "....kk1k.....",
    ".....kk......",
]
ARROW = [r.ljust(13, '.') for r in ARROW]


def arrow_down():
    return from_rows(ARROW, BR)


# east-pointing arrowhead for the hovered road
ARROW_E = [
    "kk.......",
    "k5kk.....",
    "k455kk...",
    "k44455kk.",
    "k3334444k",
    "k22233kk.",
    "k211kk...",
    "k1kk.....",
    "kk.......",
]


def arrow_e():
    """A brass arrowhead pointing east, 12 x 15, lit from the top-left."""
    I = Icon(12, 15)
    I.layer(cover(poly([(1, 1), (11.4, 7.5), (1, 14)]), 12, 15), ['o1', 'o2', 'o3', 'o4', 'o5'], R=2.2, glint=False)
    I.put(2, 3, 'o6'); I.put(2, 4, 'o6'); I.put(3, 4, 'o6')
    return I.raster()


# FFT's gauntlet: the tactics cursor, a gloved hand pointing right-down
HAND = [
    "......kkkk..........",
    ".....k5554k.........",
    ".....k5443k.........",
    "..kkkk5432kkkkkkk...",
    ".k5554k4432555544k..",
    "k555544k43344444432k",
    "k5444443k3333333321k",
    "k5444443333kkkkkkkk.",
    "k4443333332k5543k...",
    "k4433333322kkkkk....",
    "k443333322k43k......",
    ".k3333222kkkkk......",
    ".k33222211k32k......",
    "..kk21111kkkk.......",
    "....kkkkk...........",
]


def hand():
    km = {'5': 'b5', '4': 'b4', '3': 'b3', '2': 'b2', '1': 'b1'}
    return from_rows([r.ljust(20, '.') for r in HAND], km)


# cursor bracket corner: a 2 px brass angle with an ink edge
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


def brackets(x0, y0, x1, y1):
    """Four bracket corners around the box (x0,y0)-(x1,y1) as one raster positioned at (x0, y0)."""
    w, h = x1 - x0, y1 - y0
    R = Raster(w, h)
    km = {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o2'}
    kd = {'6': 'o4', '5': 'o4', '4': 'o3', '3': 'o2', '2': 'o1'}
    n = len(BRK)
    R.stamp(BRK, 0, 0, keymap=km)
    R.stamp(BRK, w - n, 0, fx=True, keymap=km)
    R.stamp(BRK, 0, h - n, fy=True, keymap=kd)
    R.stamp(BRK, w - n, h - n, fx=True, fy=True, keymap=kd)
    return R
