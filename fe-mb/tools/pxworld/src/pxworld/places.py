"""pxworld places: every map location as pixel sprites, plus the Scene that y-sorts them with trees.

Scene(cv, g)                 collects sprites with their feet; shadows go down first, sprites north to south
  .add(spr, fx, fy, shadow='house'|'round'|None)
  .tree(x, y, r) / .rock(x, y, r)
  .draw()
Builders, all taking (scene, x, y) in ART px for the place's centre:
  camp_palisade (Frontier Camp)   camp (Trader's Rest, Roderick's Camp)   market (Riverside Market)
  town (South Junction, Pine Crossing)   watchtower   fortress   cave (Smuggler's Cave)   hideout (Bandit Hideout)
  wreck (South Road Ambush)   mill (Old Mill Crossing)   broken_bridge   cairn (North Ridge Path)   farm
  thornwood_sign
"""
import math
import random

import numpy as np

from . import pal, props as PR, trees as TS, folk as FK, build as BD
from .canvas import Canvas, Sprite, ellipse, poly, nb, lut
from .pal import ix

GROUND = ('g', 'd', 'h')


class Scene:
    def __init__(self, cv, g=1, seed=7, ink_leaves=None):
        self.cv, self.g = cv, g
        self.ink_leaves = (g == 2) if ink_leaves is None else ink_leaves
        self.items = []
        self.after = []
        self.rng = random.Random(seed)

    def add(self, spr, fx, fy, shadow=None, flip=False, z=0.0):
        """z nudges only the draw order (positive = later), never the position."""
        self.items.append((fy + z, fx, fy, spr, shadow, flip))
        return spr

    def tree(self, x, y, r, seed=None, lift=0):
        sp = TS.tree(r, self.rng.randint(0, 10 ** 6) if seed is None else seed)
        self.add(sp, x, y + (sp.h - 1 - sp.cy), shadow=('tree', r))

    def rock(self, x, y, r, seed=None):
        sp = PR.rock(r, self.rng.randint(0, 999) if seed is None else seed, g=self.g)
        if getattr(self, 'reink', False):
            BD.reink(sp)
        self.add(sp, x, y, shadow='house')

    def later(self, fn):
        self.after.append(fn)

    def draw(self):
        cv, g = self.cv, self.g
        GR = getattr(self, 'ground', GROUND)
        for (_, x, y, spr, shadow, flip) in self.items:
            if shadow == 'house':
                a = (spr.ix[:, ::-1] if flip else spr.ix) != pal.CLEAR
                ax = (spr.w - 1 - spr.ax) if flip else spr.ax
                cv.shift((a, int(round(x)) - ax + max(1, 3 // g), int(round(y)) - spr.ay + max(1, 2 // g)), -1, GR)
            elif shadow == 'round':
                cv.shift(ellipse(x + spr.w * .25, y + .5, spr.w * .55, max(1.5, spr.w * .22)), -1, GROUND)
            elif isinstance(shadow, tuple) and shadow[0] == 'tree':
                r = shadow[1]
                cy = y - (spr.h - 1 - spr.cy)
                cv.shift(ellipse(x + r * .5, cy + r * .55, r * 1.05, r * .8), -1, GROUND)
            elif isinstance(shadow, tuple) and shadow[0] == 'ell':
                _, dx, dy, rx, ry = shadow
                cv.shift(ellipse(x + dx, y + dy, rx, ry), -1, GROUND)
        for (_, x, y, spr, shadow, flip) in sorted(self.items, key=lambda t: (t[0], t[1])):
            cv.stamp(spr, x, y, flip)
        if self.ink_leaves:
            # one ink line round every mass of leaves where it meets open ground (crowns inside stay un-inked)
            leaf = np.isin(cv.ix, pal.RAMP['l'][1:])
            ground = np.isin(cv.ix, [i for r in GROUND for i in pal.RAMP[r]])
            edge = ground & (nb(leaf, 0, 1) | nb(leaf, 0, -1) | nb(leaf, 1, 0) | nb(leaf, -1, 0))
            cv.ix[edge] = ix('l0')
        for fn in self.after:
            fn(cv)


def arch(w, h):
    """A doorway or cave mouth: straight sides under a round head."""
    m = np.zeros((h, w), bool)
    r = w / 2
    for j in range(h):
        for i in range(w):
            dx = i + .5 - r
            if j + .5 >= r or dx * dx + (j + .5 - r) ** 2 <= r * r:
                m[j, i] = True
    return m


def G(g, a, b):
    """Pick a value for grain 1 or 2."""
    return a if g == 1 else b


# ---------------------------------------------------------------- camps
def palisade_arc(rx, ry, h, g, front, gap=None):
    """One half of a stake ring as a single Sprite: stakes shoulder to shoulder, each lit on its west side,
    sharpened tops that alternate in height, the face darkening toward the east. Anchor = ring centre."""
    W, H = int(2 * rx) + 6, int(2 * ry) + h + 6
    s = Sprite(W, H, W // 2, int(ry) + h + 2)
    cx, cy = W // 2, int(ry) + h + 2
    sw = 3 if g == 1 else 2                       # stake width
    samples = []
    n = int(4 * (rx + ry) * 4)
    for i in range(n):
        a = 2 * math.pi * i / n
        if gap and abs(((a - gap[0] + math.pi) % (2 * math.pi)) - math.pi) < gap[1]:
            continue
        if (math.sin(a) >= 0) != front:
            continue
        x = cx + math.cos(a) * rx
        y = cy + math.sin(a) * ry
        samples.append((y, x, a))
    samples.sort()
    for (y, x, a) in samples:
        xi, yi = int(round(x)), int(round(y))
        col = xi % sw
        east = math.cos(a)
        if g == 1:
            tone = ['d2', 'd5', 'd4'][col]
            if east > .55:
                tone = ['d1', 'd4', 'd3'][col]
            tip = 1 if col == 1 else 0
        else:
            tone = ['d4', 'd3'][col] if east < .5 else ['d3', 'd2'][col]
            tip = 1 if col == 0 else 0
        top = yi - h - tip
        for yy in range(top, yi + 1):
            k = tone
            if yy == yi:
                k = 'd1'
            if yy == top:
                k = ('d5' if col == 0 else 'd4') if g == 2 else ('k0' if col != 1 else 'd6')
            s.put(xi, yy, k)
        if g == 1:
            s.put(xi, top - 1, 'k0')
    # ink the outer silhouette
    s.outline('k0')
    return s


def _palisade_old(sc, x, y, rx, ry, gap=None):
    """A ring of sharpened stakes: the back arc sorts behind whatever stands inside, the front arc in front."""
    g = sc.g
    h = G(g, 8, 4)
    back = palisade_arc(rx, ry, h, g, False, gap)
    front = palisade_arc(rx, ry, h, g, True, gap)
    sc.add(back, x, y, z=-ry - 1)
    sc.add(front, x, y, z=ry + 1)
    sc.cv.shift(ellipse(x + G(g, 2, 1), y + G(g, 2, 1), rx + G(g, 2, 1), ry + G(g, 1.5, 1)), -1, GROUND,
                where=lambda a: ~np.isin(a, pal.RAMP['d']))


def _camp_palisade_old(sc, x, y):
    """Frontier Camp: a stake ring with its gate to the east, three tents and a cookfire. The company stands
    by the gate under the standard (drawn by the map, so other screens can reuse the camp without them)."""
    g = sc.g
    _palisade_old(sc, x, y + G(g, 3, 1.5), G(g, 40, 20), G(g, 25, 12.5), gap=(0.1, .55))
    sc.add(PR.tent(g, 'canvas', big=True, stripe='red'), x - G(g, 20, 10), y - G(g, 6, 3), shadow='house')
    sc.add(PR.tent(g, 'canvas', stripe='blue'), x + G(g, 2, 1), y - G(g, 14, 7), shadow='house')
    sc.add(PR.tent(g, 'tan'), x - G(g, 26, 13), y + G(g, 12, 6), shadow='house')
    f = PR.fire(g)
    fx, fy = x - G(g, 16, 8), y + G(g, 13, 6)
    sc.add(f, fx, fy)
    sc.later(lambda cv: PR.smoke(cv, int(fx), int(fy - f.h), g))


def _camp_old(sc, x, y, kind='traders'):
    g = sc.g
    if kind == 'traders':
        sc.add(PR.tent(g, 'canvas'), x - G(g, 12, 6), y + G(g, 2, 1), shadow='house')
        sc.add(PR.tent(g, 'tan'), x + G(g, 4, 2), y - G(g, 9, 4), shadow='house')
        sc.add(PR.wagon(g), x + G(g, 14, 7), y + G(g, 9, 5), shadow='house')
        f = PR.fire(g)
        fx, fy = x - G(g, 2, 1), y + G(g, 13, 6)
        sc.add(f, fx, fy)
        sc.later(lambda cv: PR.smoke(cv, int(fx), int(fy - f.h), g))
        sc.add(PR.barrel(g), x + G(g, 24, 12), y + G(g, 1, 0), shadow='house')
        sc.add(PR.sack(g), x + G(g, 3, 2), y + G(g, 4, 2))
    else:   # Roderick's Camp: soldiers' tents in a row, a fire, his olive-and-ochre flag
        sc.add(PR.tent(g, 'tan'), x - G(g, 14, 7), y + G(g, 2, 1), shadow='house')
        sc.add(PR.tent(g, 'tan'), x + G(g, 6, 3), y - G(g, 7, 3), shadow='house')
        sc.add(PR.tent(g, 'canvas'), x - G(g, 2, 1), y + G(g, 14, 7), shadow='house')
        f = PR.fire(g)
        fx, fy = x + G(g, 14, 7), y + G(g, 10, 5)
        sc.add(f, fx, fy)
        sc.later(lambda cv: PR.smoke(cv, int(fx), int(fy - f.h), g))
        sc.add(PR.flag(g, ('m3', 'o4')), x - G(g, 28, 14), y + G(g, 6, 3), shadow='round')


# ---------------------------------------------------------------- settlements
def _market_old(sc, x, y):
    """Riverside Market: a paved square with three stalls (madder, woad, ochre), houses around it."""
    g = sc.g
    cv = sc.cv
    # the square: stone flags in a grid, lit top-left
    w, h = G(g, 34, 17), G(g, 18, 9)
    x0, y0 = int(x - w / 2), int(y - h / 2 + G(g, 0, 0))
    for j in range(h):
        for i in range(w):
            k = 't4'
            if g == 1:
                if j % 4 == 3 or (i + (j // 4) * 3) % 6 == 5:
                    k = 't3'
                elif (i + j) % 11 == 0:
                    k = 't5'
            else:
                if (i + j * 2) % 5 == 4:
                    k = 't3'
            cv.put(x0 + i, y0 + j, k)
    for i in range(w):
        cv.put(x0 + i, y0 - 1, 't2')
        cv.put(x0 + i, y0 + h, 't5' if g == 1 else 't4')
    for j in range(h):
        cv.put(x0 - 1, y0 + j, 't2')
        cv.put(x0 + w, y0 + j, 't3')
    houses = [(-30, -12, 18, 'tile'), (-6, -22, 20, 'tile'), (20, -14, 16, 'tile2'), (36, 4, 14, 'tile2'),
              (-30, 16, 16, 'tile2'), (12, 24, 18, 'tile'), (-44, 2, 12, 'thatch')]
    for i, (dx, dy, ww, rf) in enumerate(houses):
        sp = PR.house(max(6, ww // g), G(g, 10, 5), G(g, 6, 3), rf, g=g, seed=i, chimney=(i in (1, 5)))
        hx, hy = x + dx / g, y + dy / g
        sc.add(sp, hx, hy, shadow='house')
        if sp.chimney and g == 1:
            cx, cy = sp.chimney
            sc.later(lambda cv, hx=hx, hy=hy, cx=cx, cy=cy: PR.smoke(cv, int(hx + cx), int(hy + cy), g, n=7))
    for i, (dx, cl) in enumerate([(-10, 'red'), (0, 'blue'), (10, 'tan')]):
        sp = PR.stall(g, cl)
        sc.add(sp, x + dx / g, y + G(g, 4, 2), shadow='house')
    sc.add(PR.barrel(g), x + G(g, 15, 8), y + G(g, 6, 3))
    sc.add(PR.sack(g), x - G(g, 15, 8), y + G(g, 6, 3))


def town(sc, x, y, layout, roofs, sign=False):
    g = sc.g
    for i, (dx, dy, ww) in enumerate(layout):
        rf = roofs[i % len(roofs)]
        sp = PR.house(max(6, ww // g), G(g, 10, 5), G(g, 6, 3), rf, g=g, seed=i + 7, chimney=(i == 1))
        hx, hy = x + dx / g, y + dy / g
        sc.add(sp, hx, hy, shadow='house')
        if sp.chimney and g == 1:
            cx, cy = sp.chimney
            sc.later(lambda cv, hx=hx, hy=hy, cx=cx, cy=cy: PR.smoke(cv, int(hx + cx), int(hy + cy), g, n=7))
    if sign:
        sc.add(PR.signpost(g), x - G(g, 2, 1), y + G(g, 5, 3), shadow='round')


def _watchtower_old(sc, x, y):
    g = sc.g
    _palisade_old(sc, x, y + G(g, 5, 2.5), G(g, 26, 13), G(g, 15, 7.5), gap=(1.6, .5))
    t = PR.tower(G(g, 14, 7), G(g, 28, 14), g)
    tx, ty = x - G(g, 3, 1), y + G(g, 3, 1)
    sc.add(t, tx, ty, shadow='house')
    fl = PR.flag(g, ('m3', 'b4'), h=G(g, 12, 6))
    sc.add(fl, tx - G(g, 1, 0), ty - t.h + G(g, 3, 2), z=t.h + 1)
    sc.add(PR.house(G(g, 11, 6), G(g, 8, 4), G(g, 5, 3), 'shingle', 'timber', g=g, seed=3), x + G(g, 16, 8), y + G(g, 10, 5), shadow='house')


def _fortress_old(sc, x, y):
    """Border Fortress: a walled yard, a front curtain wall with its gate, two front towers and a tall keep
    behind, the garrison's slate-and-bone banner over it. Two wall sprites so the keep sorts between them."""
    g = sc.g
    W = G(g, 66, 34)
    D = G(g, 26, 13)        # depth of the walled yard
    wh = G(g, 9, 5)         # front wall face height
    ww = G(g, 3, 2)         # wall thickness seen from above
    front_y = y + G(g, 16, 8)
    yard_top = front_y - wh - D
    # back: the yard, the back wall's walk and face, the side walls' tops
    bk = Sprite(W + 4, D + ww + 6, (W + 4) // 2, ww + 2)
    ox, oy = 2, ww + 2
    for j in range(D):
        for i in range(W):
            k = 'd4' if (i * 2 + j * 5) % 13 else 'd3'
            if j < G(g, 3, 2):
                k = 'd2'                      # the back wall's shadow on the yard
            bk.put(ox + i, oy + j, k)
    for i in range(W):
        for j in range(ww):
            bk.put(ox + i, oy - ww + j, 't5' if j == 0 else 't4')
        if i % G(g, 4, 2) < G(g, 2, 1):
            bk.put(ox + i, oy - ww - 1, 't5')
    for j in range(-ww, D):
        for i in range(ww):
            bk.put(ox + i, oy + j, 't6' if i == 0 and g == 1 else 't5')
            bk.put(ox + W - 1 - i, oy + j, 't3' if i == 0 else 't4')
    bk.outline('k0')
    sc.add(bk, x, yard_top, shadow=None)
    # front: the curtain wall's face, lit to the west, darker east; merlons; the gate
    fr = Sprite(W + 4, wh + 5, (W + 4) // 2, wh + 2)
    ox, oy = 2, 3
    for j in range(wh):
        for i in range(W):
            k = 't5' if i < W * .35 else ('t4' if i < W * .7 else 't3')
            if g == 1 and j % 4 == 3:
                k = {'t5': 't4', 't4': 't3', 't3': 't2'}[k]
            if j == wh - 1:
                k = 't3' if i < W * .5 else 't2'
            fr.put(ox + i, oy + j, k)
    for i in range(W):
        fr.put(ox + i, oy - 1, 't5' if i < W * .5 else 't4')
        if i % G(g, 4, 2) < G(g, 2, 1):
            fr.put(ox + i, oy - 2, 't6' if (i < W * .5 and g == 1) else 't5')
    gw, gh = G(g, 10, 5), G(g, 7, 4)
    gx = ox + W // 2 - gw // 2
    am = arch(gw, gh)
    for j in range(gh):
        for i in range(gw):
            if am[j, i]:
                k = 'k1'
                if g == 1 and i % 2 == 1 and j > 1:
                    k = 'w2'                  # the portcullis
                fr.put(gx + i, oy + wh - gh + j, k)
    fr.outline('k0')
    sc.add(fr, x, front_y, shadow='house')
    keep = PR.tower(G(g, 20, 10), G(g, 30, 15), g)
    ky = yard_top + G(g, 14, 7)
    sc.add(keep, x + G(g, 2, 1), ky, shadow='house')
    for dx in (-W / 2 + G(g, 3, 2), W / 2 - G(g, 3, 2)):
        t = PR.tower(G(g, 12, 6), G(g, 18, 9), g, slit=True, door=False)
        sc.add(t, x + dx, front_y + G(g, 2, 1), shadow='house')
    fl = PR.flag(g, ('s2', 'b4'), h=G(g, 14, 7))
    sc.add(fl, x + G(g, 2, 1), ky - keep.h + G(g, 4, 2), z=keep.h + 1)


# ---------------------------------------------------------------- the wild places
def _cave_old(sc, x, y):
    """Smuggler's Cave: a rock outcrop on the hill's flank, its mouth barred with iron and padlocked."""
    g = sc.g
    if g == 1:
        W, H = 86, 48
        pts = [(4, 44), (2, 30), (12, 16), (30, 4), (50, 0), (70, 8), (84, 24), (82, 44)]
        fx, fy = 38, 44
    else:
        W, H = 44, 25
        pts = [(2, 23), (1, 15), (6, 8), (15, 2), (25, 0), (35, 4), (42, 12), (41, 23)]
        fx, fy = 19, 23
    s = PR.outcrop(W, H, pts, seed=5)
    # moss on the crown of the rock
    rng = random.Random(4)
    m = s.mask()
    top = m & ~nb(m, 0, -1)
    ys, xs = np.nonzero(top)
    for xx, yy in zip(xs, ys):
        if xx < W * .7 and rng.random() < .7:
            s.put(xx, yy + 1, 'l4' if rng.random() < .5 else 'l3')
            if rng.random() < .5:
                s.put(xx, yy + 2, 'l3')
    # the mouth: a dark arch, iron bars, a crossbar, a padlock
    mw, mh = G(g, 22, 11), G(g, 22, 11)
    mx0, my0 = fx - mw // 2, fy - mh
    am = arch(mw, mh)
    bar = G(g, 5, 3)
    for j in range(mh):
        for i in range(mw):
            if not am[j, i]:
                continue
            k = 'k0'
            if i % bar == 2 and 0 < i < mw - 1:
                k = 't5' if j < mh * .6 else 't4'
            elif j == mh // 2 and 0 < i < mw - 1:
                k = 't4'
            s.put(mx0 + i, my0 + j, k)
    if g == 1:
        lx, ly = fx - 3, fy - mh // 2 + 1
        for (i, j, k) in [(1, 0, 'o4'), (2, 0, 'o4'), (3, 0, 'o4'), (0, 1, 'o4'), (4, 1, 'o4'),
                          (0, 2, 'o5'), (1, 2, 'o5'), (2, 2, 'o4'), (3, 2, 'o4'), (4, 2, 'o3'),
                          (0, 3, 'o4'), (1, 3, 'o4'), (2, 3, 'k0'), (3, 3, 'o3'), (4, 3, 'o2'),
                          (0, 4, 'o3'), (1, 4, 'o3'), (2, 4, 'o2'), (3, 4, 'o2'), (4, 4, 'o2')]:
            s.put(lx + i, ly + j, k)
    else:
        s.put(fx, fy - mh // 2, 'o4'); s.put(fx - 1, fy - mh // 2, 'o4')
    s.ax, s.ay = fx, fy
    sc.add(s, x, y + G(g, 12, 6), shadow='house')
    sc.rock(x - G(g, 38, 19), y + G(g, 12, 6), G(g, 6, 3))
    sc.rock(x + G(g, 44, 22), y + G(g, 15, 7), G(g, 5.5, 3))


def _hideout_old(sc, x, y):
    """Bandit Hideout: a cave mouth behind a fallen oak, a fire pit with the ash still warm."""
    g = sc.g
    if g == 1:
        W, H = 54, 30
        pts = [(2, 28), (0, 18), (10, 6), (24, 0), (38, 2), (50, 12), (52, 28)]
        fx, fy = 26, 28
    else:
        W, H = 28, 16
        pts = [(1, 15), (0, 10), (5, 3), (12, 0), (19, 1), (26, 6), (27, 15)]
        fx, fy = 13, 15
    s = PR.outcrop(W, H, pts, seed=11)
    rng = random.Random(9)
    m = s.mask()
    top = m & ~nb(m, 0, -1)
    for xx, yy in zip(*np.nonzero(top)[::-1]):
        if rng.random() < .65:
            s.put(xx, yy + 1, 'l4' if rng.random() < .5 else 'l3')
    mw, mh = G(g, 18, 9), G(g, 15, 8)
    am = arch(mw, mh)
    for j in range(mh):
        for i in range(mw):
            if am[j, i]:
                s.put(fx - mw // 2 + i, fy - mh + j, 'k0')
    # the tripline across the mouth
    if g == 1:
        for i in range(mw):
            s.put(fx - mw // 2 + i, fy - 5 + (i // 9), 'b2')
    s.ax, s.ay = fx, fy
    sc.add(s, x, y + G(g, 6, 3), shadow='house')
    # the fallen oak: a thick trunk lying east-west in front, its root plate torn up at the west end,
    # its crown still in leaf at the east end
    tl, th = G(g, 40, 20), G(g, 7, 4)
    t = Sprite(tl + 12, th + 12, 0, 0)
    for i in range(tl):
        yo = 4 + int(round(-i * G(g, 3, 1) / tl))
        for j in range(th):
            if j == 0:
                k = 'w6'
            elif j == 1 and g == 1:
                k = 'w5'
            elif j < th - 2:
                k = 'w4' if (g == 1 and (i + 2 * j) % 9 == 0) else 'w5'
            elif j < th - 1:
                k = 'w3'
            else:
                k = 'w2'
            t.put(6 + i, yo + j, k)
    # the root plate: a disc of earth on edge with root ends sticking out
    rr = G(g, 6, 3)
    for j in range(-rr, rr + 1):
        for i in range(-rr // 2, rr // 2 + 1):
            if (i / (rr / 2 + .5)) ** 2 + (j / (rr + .5)) ** 2 <= 1:
                t.put(4 + i, 4 + th // 2 + j, 'd2' if i < 0 else 'd3')
    if g == 1:
        for (i, j) in ((-4, -6), (-5, -2), (-4, 3), (-3, 7), (1, -7), (1, 7)):
            t.put(4 + i, 4 + th // 2 + j, 'w3')
    t.outline('k0')
    t = t.trimmed()
    t.ax, t.ay = 0, t.h - 1
    sc.add(t, x - G(g, 26, 13), y + G(g, 15, 8), shadow='house')
    crown = TS.clumps(G(g, 8, 4), 77)
    sc.add(crown, x + G(g, 20, 10), y + G(g, 16, 8), shadow=('ell', 2, 1, G(g, 8, 4), G(g, 4, 2)))
    # fire pit: ring of stones, ash, one ember, a thin wisp
    px, py = x + G(g, 2, 1), y + G(g, 21, 10)
    pit = Sprite(G(g, 11, 6), G(g, 6, 3), G(g, 5, 3), G(g, 5, 2))
    if g == 1:
        rows = [".ttttttt..", "tt.....ttt", "t.aaaaa..t", "t.aaeaa..t", "tt.....tt.", ".ttttttt.."]
        rows = [".tTtTtTt.", "tT.....Tt", "T.aaAaa.T", "t.aeAaa.t", "tT.....Tt", ".tTtTtTt."]
        pit = Sprite.ascii(rows, {'t': 't4', 'T': 't3', 'a': 't2', 'A': 't3', 'e': 'x4'})
    else:
        pit = Sprite.ascii(["tTt", "Tet", "tTt"], {'t': 't4', 'T': 't3', 'e': 'x4'})
    pit.ax, pit.ay = pit.w // 2, pit.h - 1
    sc.add(pit, px, py)
    sc.later(lambda cv: PR.smoke(cv, int(px), int(py - pit.h), g, n=G(g, 7, 4)))


def _wreck_old(sc, x, y):
    """South Road Ambush: a cart on its side, a dead ox, arrows standing in the boards, flour spilled."""
    g = sc.g
    if g == 1:
        rows = [
            "........k.................",
            ".......kbk.......k........",
            "........k...kk..kbk....k..",
            "........k..kbk...k....kbk.",
            "........k...k....k.....k..",
            "......kkkkkkkkkkkkkkkkkkk.",
            "..kk..k66666666666665555k.",
            ".kwwk.k55545555545555555k.",
            "..kwwkk44444444444444444k.",
            "...kwwk55545555545554555k.",
            "....kwk44444444444444444k.",
            ".....kkk3kkkkkkk3kkkkkkkk.",
            "......kWWWWk..............",
            ".....kWkWWkWk.............",
            ".....kWWkkWWk.............",
            ".....kWkWWkWk.............",
            "......kWWWWk..............",
            ".......kkkk...............",
        ]
        km = {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', 'w': 'w5', 'W': 'w3', 'b': 'b5', 'k': 'k0'}
        cart = Sprite.ascii(rows, km)
        cart.ax, cart.ay = 10, 17
        sc.add(cart, x - 6, y + 6, shadow='house')
        o = Sprite.ascii([
            "...............bb.",
            "..kkkkkkkkk...kbk.",
            ".k665555554kkk5kb.",
            "k66555555443k54k..",
            "k65554444433k43k..",
            "k5544443333332kk..",
            ".kk44433332222k...",
            "...kkkkkkkkkkk....",
        ], {'6': 'd6', '5': 'd5', '4': 'd4', '3': 'd3', '2': 'd2', 'k': 'k0', 'b': 'b4'})
        o.ax, o.ay = 8, 7
        sc.add(o, x + 18, y + 8, shadow='house')
        for (dx, dy) in ((-17, 7), (2, 11)):
            sc.add(PR.sack(1), x + dx, y + dy)
        # spilled flour, pale on the dirt
        sc.later(lambda cv: [cv.put(x + 4 + i, y + 12 + (i % 2), 'b5') for i in range(5)])
    else:
        rows = [
            "....b...b...",
            "...kak.kak..",
            "kk.kkkkkkkk.",
            "kwkk6665555k",
            ".kwk4444444k",
            "..kkkWWWkkkk",
            "....kWkWk...",
            "....kWWWk...",
            ".....kkk....",
        ]
        km = {'6': 'w6', '5': 'w5', '4': 'w4', 'W': 'w3', 'w': 'w5', 'b': 'b5', 'a': 'k1', 'k': 'k0'}
        cart = Sprite.ascii(rows, km)
        cart.ax, cart.ay = 6, 8
        sc.add(cart, x - 3, y + 3, shadow='house')
        o = Sprite.ascii([
            "........b",
            ".kkkkkkkb",
            "k6555543k",
            "k5444332k",
            ".kkkkkkk.",
        ], {'6': 'd6', '5': 'd5', '4': 'd4', '3': 'd3', '2': 'd2', 'k': 'k0', 'b': 'b4'})
        o.ax, o.ay = 4, 4
        sc.add(o, x + 9, y + 4, shadow='house')
        sc.add(PR.sack(2), x - 10, y + 4)


def _mill_old(sc, x, y, river_x):
    """Old Mill Crossing: a thatched mill on the west bank, its wheel in the race, a plank bridge over."""
    g = sc.g
    h = PR.house(G(g, 16, 8), G(g, 11, 6), G(g, 8, 4), 'thatch', 'timber', g=g, seed=2, chimney=False)
    sc.add(h, x - G(g, 12, 6), y + G(g, 4, 2), shadow='house')
    # the wheel, face-on: a rim, spokes, paddles
    R = G(g, 8, 4)
    sz = 2 * R + 3
    wh = Sprite(sz, sz, sz // 2, sz - 2)
    c = sz / 2 - .5
    for j in range(sz):
        for i in range(sz):
            d = math.hypot(i - c, j - c)
            if R - 1.3 <= d <= R + .2:
                wh.put(i, j, 'w5' if (i - c) + (j - c) < 0 else 'w3')
            elif d < R - 1.3:
                a = math.atan2(j - c, i - c)
                if g == 1 and min(abs((a * 6 / math.pi) % 2 - 1) for _ in [0]) > .82 and d > 1:
                    wh.put(i, j, 'w4')
                elif d < 1.2:
                    wh.put(i, j, 'w2')
    wh.outline('k0')
    sc.add(wh, x + G(g, 5, 3), y + G(g, 8, 4), shadow=None)
    # plank bridge across the river
    bx0, bx1 = river_x - G(g, 16, 8), river_x + G(g, 18, 9)
    by = y - G(g, 5, 3)
    bw = bx1 - bx0
    b = Sprite(int(bw) + 2, G(g, 7, 4) + 2, 0, 0)
    for i in range(int(bw)):
        for j in range(G(g, 5, 3)):
            k = 'w6' if j == 0 else ('w5' if j < G(g, 4, 2) else 'w3')
            if g == 1 and i % 3 == 2 and 0 < j < 4:
                k = 'w4'
            b.put(1 + i, 1 + j, k)
        if i % G(g, 8, 4) == 0:
            for j in range(G(g, 5, 3), G(g, 7, 4)):
                b.put(1 + i, 1 + j, 'w2')
    b.outline('k0')
    b.ax, b.ay = 0, b.h - 1
    sc.add(b, bx0, by + b.h // 2, shadow=('ell', bw / 2, 2, bw / 2, G(g, 2, 1)), z=-G(g, 6, 3))


def bridge_span(L, rise, g, west):
    """A stone span L long (art px), rising by `rise` toward its far end: a lit deck, parapet stones, the
    south face with an arch over the water, and a broken, jagged end."""
    dh = G(g, 4, 2)            # deck (seen from above)
    fh = G(g, 6, 3)            # south face
    W, H = L + 4, dh + fh + abs(rise) + 6
    s = Sprite(W, H, 0, 0)
    base = 3 + max(0, -rise)
    bites = [0, 2, 3, 1, 2, 4, 3, 1, 2, 3] if g == 1 else [0, 1, 2, 1, 2]
    for i in range(L):
        yo = base + int(round(rise * i / max(1, L - 1)))
        far = (L - 1 - i) if west else i                 # distance from the broken end
        bite = bites[(i * 3) % len(bites)] if far < 3 else 0
        for j in range(dh + fh):
            if far < 2 and j < bites[j % len(bites)] + (2 - far):
                continue
            if j == 0:
                k = 't6' if g == 1 else 't5'
            elif j < dh:
                k = 't5' if g == 1 and j == 1 else 't4'
            else:
                k = 't3' if (j - dh) < fh - 1 else 't2'
                if g == 1 and (j - dh) == 1 and i % 4 == 0:
                    k = 't2'
            s.put(2 + i, yo + j, k)
        # parapet stones along the north edge of the deck
        if g == 1 and i % 3 != 2 and far >= 2:
            s.put(2 + i, yo - 1, 't5')
    # the arch under the span, where the water shows through
    aw = max(3, L // 2)
    ax0 = 2 + (L - aw) // 2 if west else 2 + (L - aw) // 2
    for i in range(aw):
        yo = base + int(round(rise * (ax0 - 2 + i) / max(1, L - 1)))
        r = abs(i - (aw - 1) / 2) / (aw / 2)
        top = int(round(dh + fh * .35 + (fh * .55) * (r ** 2)))
        for j in range(top, dh + fh):
            s.put(ax0 + i, yo + j, 'a1' if j > top else 'k1')
    s.outline('k0')
    s = s.trimmed()
    return s


def _broken_bridge_old(sc, x, y):
    """Broken Bridge: a stone span reaches out from each bank; the middle has fallen in; planks drift."""
    g = sc.g
    L = G(g, 26, 13)
    w = bridge_span(L, G(g, -3, -1), g, True)
    w.ax, w.ay = 0, w.h - 1
    sc.add(w, x - G(g, 34, 17), y + G(g, 6, 3), shadow=('ell', L / 2, 2, L / 2, G(g, 2, 1)))
    e = bridge_span(L, G(g, -3, -1), g, False)
    e.ax, e.ay = 0, e.h - 1
    sc.add(e, x + G(g, 9, 5), y + G(g, 2, 1), shadow=('ell', L / 2, 2, L / 2, G(g, 2, 1)))
    # fallen blocks in the gap and two drifting planks
    sc.rock(x - G(g, 2, 1), y + G(g, 4, 2), G(g, 3.4, 1.8), seed=5)
    sc.rock(x + G(g, 4, 2), y + G(g, 8, 4), G(g, 2.6, 1.5), seed=8)

    def planks(cv):
        for (px, py, n) in ((x - G(g, 8, 4), y + G(g, 14, 7), G(g, 7, 3)), (x + G(g, 6, 3), y + G(g, 19, 9), G(g, 6, 3))):
            for i in range(n):
                cv.put(int(px + i), int(py + (i // 4 if g == 1 else 0)), 'w5')
                cv.put(int(px + i), int(py + 1 + (i // 4 if g == 1 else 0)), 'w2')
    sc.later(planks)


def _cairn_old(sc, x, y):
    """North Ridge Path: a cairn of stacked stones and a finger-post."""
    g = sc.g
    for (dx, dy, r) in [(-4, 3, 5), (3, 2, 4.5), (-1, -3, 4), (0, -7, 3)]:
        sc.rock(x + dx / g, y + dy / g, r / g, seed=int(dx * 7 + dy))
    sc.add(PR.signpost(g), x + G(g, 12, 6), y + G(g, 5, 3), shadow='round')


def _farm_old(sc, x, y, i=0):
    """A farmstead: a cottage, a barn, a haystack, a short fence line."""
    g = sc.g
    sc.add(PR.house(G(g, 13, 7), G(g, 9, 5), G(g, 5, 3), 'tile', g=g, seed=40 + i), x - G(g, 8, 4), y + G(g, 2, 1), shadow='house')
    sc.add(PR.house(G(g, 17, 9), G(g, 11, 6), G(g, 7, 4), 'shingle', 'timber', g=g, seed=50 + i), x + G(g, 10, 5), y - G(g, 3, 1), shadow='house')
    sc.add(PR.haystack(g), x + G(g, 4, 2), y + G(g, 10, 5), shadow='house')
    # fence: posts with a rail
    def fence(cv, x=x, y=y):
        y0 = int(y + G(g, 14, 7))
        for i in range(-G(g, 20, 10), G(g, 22, 11)):
            xx = int(x + i)
            if i % G(g, 4, 3) == 0:
                cv.put(xx, y0 - 1, 'w5'); cv.put(xx, y0, 'w3')
            else:
                cv.put(xx, y0 - 1, 'w4')
    sc.later(fence)


def _thornwood_sign_old(sc, x, y):
    """The big finger-post to Thornwood on the east road; the map writes the word on its board."""
    g = sc.g
    bw, bh = G(g, 90, 45), G(g, 23, 12)
    ph = G(g, 44, 22)
    s = Sprite(bw + 4, ph + 4, 0, 0)
    px = G(g, 6, 3)
    for j in range(ph):
        s.put(px, 2 + j, 'w5' if j < ph - 1 else 'w3')
        s.put(px + 1, 2 + j, 'w3')
        if g == 1:
            s.put(px + 2, 2 + j, 'w2')
    tip = G(g, 10, 5)
    for j in range(bh):
        for i in range(bw):
            mid = (bh - 1) / 2
            if i > bw - 1 - tip and abs(j - mid) > (bw - 1 - i) * (bh / 2) / tip:
                continue
            k = 'w5' if j < 2 else ('w4' if j < bh - 2 else 'w3')
            if j == 0:
                k = 'w6'
            if g == 1 and j in (7, 15) and 2 < i < bw - tip:
                k = 'w3'
            s.put(1 + i, 1 + j, k)
    s.put(px, bh // 2 + 1, 't5')
    s.outline('k0')
    s.ax, s.ay = px, ph + 1
    sc.add(s, x, y, shadow='house')


# ================================================================ grain 1: settlements laid out on their streets
# A plan is a list of items in stage px (the map's own coordinates at grain 1), shifted by the place's offset
# from its canonical position, so the same plan works wherever the place is drawn.
#   ('ew' | 'ns', fx, fy, kw)      a cottage (build.cottage) standing on its foot, with ground shadow
#   ('L', fx, fy, kw)              an L-house (build.lhouse);  ('barn', fx, fy, kw)  a barn (build.barn)
#   ('stall', fx, fy, cloth, goods)   ('well', fx, fy)   ('prop', fx, fy, name)   ('tree', x, y, r)
#   ('square', pts)                cobbled paving inside a polygon
#   ('yard', x, y, w, h)  ('garden', x, y, w, h, crop)  ('path', x, y, w, h)  ground painted at once
#   ('fence', x0, y0, x1, y1)      an axis-aligned fence run;  ('ring', x0, y0, x1, y1, gaps)  a fenced plot
def _prop(name):
    return {'barrel': lambda: PR.barrel(1), 'sack': lambda: PR.sack(1), 'hay': lambda: PR.haystack(1),
            'woodpile': BD.woodpile, 'crate': BD.crate, 'cart': BD.handcart, 'sign': BD.fingerpost,
            'trough': BD.trough}[name]()


def lay(sc, plan, ox=0, oy=0):
    cv = sc.cv
    ox, oy = int(round(ox)), int(round(oy))
    for it in plan:
        k = it[0]
        if k in ('ew', 'ns', 'L', 'barn'):
            _, fx, fy, kw = it
            if k == 'L':
                sp = BD.lhouse(**kw)
            elif k == 'barn':
                sp = BD.barn(**kw)
            else:
                sp = BD.cottage(ridge=k, **kw)
            X, Y = fx + ox, fy + oy
            sc.add(sp, X, Y, shadow='house')
            if sp.chimney:
                cx, cy = sp.chimney
                sc.later(lambda cv, X=X, Y=Y, cx=cx, cy=cy: PR.smoke(cv, int(X + cx), int(Y + cy), 1, n=8))
        elif k == 'stall':
            _, fx, fy, cloth, goods = it
            sc.add(BD.awning_stall(cloth, goods), fx + ox, fy + oy, shadow='house')
        elif k == 'well':
            sc.add(BD.well2(), it[1] + ox, it[2] + oy, shadow='house')
        elif k == 'prop':
            sp = _prop(it[3])
            sc.add(sp, it[1] + ox, it[2] + oy, shadow='house')
        elif k == 'tree':
            sc.tree(it[1] + ox, it[2] + oy, it[3])
        elif k == 'bush':
            sp = TS.bush(it[3], it[4] if len(it) > 4 else 3, lift=1)
            sc.add(sp, it[1] + ox, it[2] + oy + (sp.h - 1) // 2, shadow=('ell', it[3] * .7, 1, it[3] * 1.1, it[3] * .6))
        elif k == 'square':
            pts = [(x + ox, y + oy) for x, y in it[1]]
            m, x0, y0 = poly(pts)
            BD.cobbles(cv, m, x0, y0)
        elif k == 'yard':
            _, x, y, w, h = it[:5]
            BD.yard(cv, x + ox, y + oy, w, h, seed=x * 7 + y)
        elif k == 'path':
            _, x, y, w, h = it
            for j in range(h):
                for i in range(w):
                    cv.put(x + ox + i, y + oy + j, 'd4' if i < w - 1 or w == 1 else 'd3')
        elif k == 'garden':
            _, x, y, w, h, crop = it
            BD.garden(cv, x + ox, y + oy, w, h, crop)
        elif k == 'fence':
            _, x0, y0, x1, y1 = it
            BD.fence(cv, (x0 + ox, y0 + oy), (x1 + ox, y1 + oy))
        elif k == 'ring':
            _, x0, y0, x1, y1, gaps = it
            BD.fence_ring(cv, x0 + ox, y0 + oy, x1 + ox, y1 + oy, gaps)


# ---------------------------------------------------------------- Riverside Market
MARKET_AT = (660, 400)
MARKET = [
    # the cobbled square where the three roads meet
    ('square', [(641, 390), (679, 390), (684, 395), (685, 414), (681, 419), (642, 419), (637, 415), (637, 394)]),
    # north side, backing onto the field hedge: the inn (an L-house, its gable on the square), a gable house
    ('L', 653, 388, dict(w=22, wing_w=11, side='e', proj=3, roof='tile', chimney='w', seed=21)),
    ('ns', 630, 393, dict(w=11, roof='tile2', seed=22, chimney='e')),
    ('ew', 609, 398, dict(w=19, roof='thatch', d=9, h=5, windows=3, seed=23)),
    ('yard', 599, 399, 22, 4), ('yard', 624, 394, 13, 5),
    # north-east, between the mill road and the hideout road
    ('ns', 694, 404, dict(w=11, roof='tile', seed=24)),
    ('ew', 715, 401, dict(w=14, roof='slate', seed=25, chimney='e')),
    ('ns', 712, 383, dict(w=9, roof='tile2', d=7, seed=26)),
    ('ew', 680, 374, dict(w=10, roof='tile', d=8, h=5, seed=27)),
    ('yard', 687, 405, 14, 3), ('yard', 706, 402, 18, 4),
    # south side, their backs to the square: rear walls, windows
    ('ew', 648, 435, dict(w=15, roof='tile2', back=True, seed=28)),
    ('ns', 666, 436, dict(w=11, roof='tile', back=True, seed=29)),
    ('ew', 686, 434, dict(w=15, roof='tile', back=True, seed=30, chimney='w')),
    # south-west, below the camp road: a cottage with its kitchen garden
    ('ew', 627, 428, dict(w=12, roof='thatch', back=True, seed=31)),
    ('garden', 603, 415, 11, 8, 'greens'), ('ring', 602, 414, 614, 424, [('n', 606, 609)]),
    # the market: three stalls on the south half of the square, the well in its middle
    ('well', 659, 405),
    ('stall', 648, 417, 'red', 'apples'), ('stall', 662, 418, 'blue', 'cloth'), ('stall', 676, 417, 'ochre', 'bread'),
    ('prop', 642, 405, 'barrel'), ('prop', 681, 401, 'crate'), ('prop', 670, 402, 'sack'),
]


def market(sc, x, y):
    """Riverside Market, the biggest town on the map: a cobbled square where the camp road, the mill road and
    the hideout road meet, with three stalls under striped awnings and a well; the inn and a dozen houses front
    the square and the roads, in both orientations, with yards and a fenced kitchen garden."""
    if sc.g != 1:
        return _market_old(sc, x, y)
    lay(sc, MARKET, x - MARKET_AT[0], y - MARKET_AT[1])


# ---------------------------------------------------------------- South Junction
JUNCTION_AT = (820, 540)
JUNCTION = [
    ('ew', 806, 530, dict(w=13, roof='tile', seed=41, chimney='w')),
    ('ns', 805, 509, dict(w=11, roof='tile2', seed=42)),
    ('ns', 832, 527, dict(w=11, roof='tile', seed=43)),
    ('ew', 853, 524, dict(w=15, roof='thatch', seed=44, chimney='e')),
    ('ew', 831, 508, dict(w=12, roof='tile2', d=8, seed=45)),
    ('ew', 806, 561, dict(w=14, roof='tile2', back=True, seed=46)),
    ('ns', 868, 556, dict(w=11, roof='tile', seed=47)),
    ('yard', 798, 531, 16, 4), ('yard', 845, 525, 18, 3),
    ('garden', 824, 553, 11, 8, 'cabbage'), ('fence', 823, 562, 835, 562), ('fence', 835, 553, 835, 562),
    ('prop', 826, 546, 'sign'),
]


def south_junction(sc, x, y):
    """South Junction: a crossroads hamlet. Houses front all four roads, a fenced garden in the south corner,
    the finger-post on the corner where the roads part."""
    lay(sc, JUNCTION, x - JUNCTION_AT[0], y - JUNCTION_AT[1])


# ---------------------------------------------------------------- Pine Crossing
PINE_AT = (1076, 410)
PINE = [
    ('ns', 1072, 399, dict(w=11, roof='shingle', wall='timber', seed=61)),
    ('ew', 1093, 395, dict(w=15, roof='shingle', seed=62, chimney='e')),
    ('ew', 1113, 388, dict(w=12, roof='tile2', d=8, seed=63)),
    ('ns', 1088, 432, dict(w=11, roof='shingle', back=True, seed=64)),
    ('ew', 1106, 434, dict(w=14, roof='tile2', back=True, seed=65)),
    ('barn', 1056, 400, dict(w=15, ridge='ew', roof='shingle', d=8, h=6, seed=66)),
    ('yard', 1064, 400, 22, 3),
    ('prop', 1047, 402, 'woodpile'),
]


def pine_crossing(sc, x, y):
    """Pine Crossing: a timber hamlet where four roads cross in the pines: shingled roofs, a log barn,
    a woodpile."""
    lay(sc, PINE, x - PINE_AT[0], y - PINE_AT[1])


# ---------------------------------------------------------------- farmsteads
FARM_PLANS = {
    0: [('ew', 570, 427, dict(w=14, roof='thatch', seed=80, chimney='e')),
        ('barn', 597, 430, dict(w=15, ridge='ns', roof='thatch', d=8, h=6, seed=81)),
        ('yard', 562, 428, 46, 5), ('prop', 583, 431, 'hay'),
        ('garden', 554, 414, 9, 7, 'beans')],
    1: [('ns', 352, 318, dict(w=11, roof='tile', seed=82)),
        ('barn', 370, 330, dict(w=17, ridge='ew', roof='thatch', d=8, h=6, seed=83)),
        ('yard', 345, 319, 36, 4), ('prop', 361, 333, 'hay')],
    2: [('ew', 898, 655, dict(w=14, roof='tile', seed=84)),
        ('barn', 916, 660, dict(w=13, ridge='ns', roof='shingle', d=8, h=6, seed=85)),
        ('yard', 890, 656, 34, 5), ('prop', 908, 663, 'hay')],
    3: [('yard', 702, 418, 40, 18),
        ('ew', 712, 432, dict(w=13, roof='thatch', seed=86)),
        ('barn', 731, 434, dict(w=13, ridge='ns', roof='shingle', d=7, h=6, seed=87))],
    4: [('ns', 262, 446, dict(w=11, roof='thatch', seed=88, chimney='w')),
        ('barn', 284, 448, dict(w=17, ridge='ew', roof='shingle', d=8, h=7, seed=89)),
        ('yard', 254, 447, 42, 5), ('prop', 273, 452, 'hay'),
        ('ring', 276, 456, 300, 468, [('n', 280, 283)]), ('prop', 293, 466, 'trough'), ('prop', 284, 466, 'hay'),
        ('garden', 240, 436, 9, 9, 'cabbage')],
    5: [('ew', 188, 330, dict(w=15, roof='tile2', seed=90, chimney='w')),
        ('barn', 210, 333, dict(w=13, ridge='ns', roof='thatch', d=8, h=6, seed=91)),
        ('yard', 180, 331, 40, 4), ('prop', 199, 336, 'hay'),
        ('garden', 176, 336, 10, 6, 'greens')],
}


def farm(sc, x, y, i=0):
    """A farmstead: a cottage and a barn facing a shared yard, a haystack, a kitchen garden or a paddock."""
    if sc.g != 1:
        return _farm_old(sc, x, y, i)
    import world_map as WM
    fx, fy = WM.FARMS[i]
    lay(sc, FARM_PLANS[i % len(FARM_PLANS)], x - fx, y - fy)


# ---------------------------------------------------------------- the crossings
def mill(sc, x, y, river_x):
    """Old Mill Crossing: a timber bridge on two trestle piers spans the river bank to bank along the road; the
    stone-and-thatch mill stands on the west bank above it, its wheel turning in the river at its east end."""
    if sc.g != 1:
        return _mill_old(sc, x, y, river_x)
    ox, oy = int(round(x - 812)), int(round(y - 298))
    cv = sc.cv
    water = getattr(sc, 'water', None)
    bx, yS = 801 + ox, 306 + oy
    br = BD.timber_bridge(38, deck=5, piers=(11, 22), abut=(5, 5), pier_h=4, seed=3)
    if water is not None:
        # the water under the deck is in deep shadow; the bridge throws a short shadow downstream (SE)
        m = np.ones((4, 38), bool)
        BD.water_shade(cv, water, m, bx, yS + 3, -2)
        m2 = np.ones((2, 38), bool)
        BD.water_shade(cv, water, m2, bx + 2, yS + 7, -1)
    sc.add(br, bx, yS, z=-2)
    # the mill: stone ground floor, thatch, its east end at the water's edge
    mh = BD.cottage(18, 'ew', 'thatch', 'stone', d=9, h=7, seed=12, door=4, windows=1)
    mx, my = 799 + ox, 296 + oy
    sc.add(mh, mx, my, shadow='house')
    if mh.chimney:
        cx, cy = mh.chimney
        sc.later(lambda cv: PR.smoke(cv, int(mx + cx), int(my + cy), 1, n=9))
    # the wheel, face-on at the mill's east end, its lower third under the water
    wl = 297 + oy                                      # the water line at the wheel
    wh = BD.waterwheel()
    wx = 818 + ox
    cut = wh.ay - 4                                    # the sprite row that sits on the water line
    for j in range(cut + 1, wh.h):
        wh.ix[j, :] = pal.CLEAR
    sc.add(wh, wx, wl + (wh.ay - cut), z=1)
    def foam(cv, wx=wx, wl=wl):
        for i in range(-7, 8):
            X = wx + i
            if water is None or water[wl + 1, X]:
                cv.put(X, wl + 1, 'a7' if i % 3 else 'a6')
            if abs(i) < 6 and (i % 2 == 0) and (water is None or water[wl + 2, X]):
                cv.put(X + 1, wl + 2, 'a6')
    sc.later(foam)
    # the mill yard: a cart of sacks by the door
    BD.yard(cv, 788 + ox, 297 + oy, 20, 4, seed=5, pebbles=False)
    sc.add(BD.flour_sacks(), 793 + ox, 300 + oy, shadow='house')


def broken_bridge(sc, x, y):
    """Broken Bridge: a three-arch stone bridge laid across the flow on the road's axis (rising 1 px every 3 px
    to the east, at right angles to the river). Its middle span has fallen: the two stumps stand aligned on
    their piers, abutments on the banks, and the fallen masonry breaks the water between them."""
    if sc.g != 1:
        return _broken_bridge_old(sc, x, y)
    ox = 0 if abs(x - 956) < 4 else int(round(x - 956))     # x is the river's centre at this row
    oy = int(round(y - 580))
    cv = sc.cv
    water = getattr(sc, 'water', None)
    L = 52
    br = BD.stone_bridge(L, 3, deck=4, face=6, arches=[(9, 19, 3), (22, 34, 3), (37, 46, 3)], abut=(8, 6),
                         broken=(23, 33), seed=4)
    bx, by = 927 + ox, 581 + oy
    if water is not None:
        # the bridge's hard shadow on the water, thrown a little downstream of its south face
        for c in range(L):
            yw = by + 7 - c // 3
            for j in range(2):
                X, Y = bx + c + 1, yw + j
                if 0 <= Y < cv.h and 0 <= X < cv.w and water[Y, X] and not (23 <= c < 33):
                    v = cv.get(X, Y)
                    cv.ix[Y, X] = pal.shift_index(v, -1)
    sc.add(br, bx, by, z=-3)
    # the fallen span: dressed blocks standing in the current, foam on their upstream faces, short wakes
    blocks = [(951, 582, 5, 3, 1), (957, 578, 4, 3, -1), (946, 585, 3, 2, 0), (962, 576, 3, 2, 1)]
    for (rx, ry, w_, h_, tl) in blocks:
        sc.add(BD.masonry(w_, h_, tl), rx + ox, ry + oy)

    def foam(cv):
        for (rx, ry, w_, h_, tl) in blocks:
            X, Y = int(rx + ox), int(ry + oy)
            top = Y - h_ - abs(tl) - 1
            for i in range(-w_ // 2, w_ // 2 + 1):
                if water is None or water[top, X + i]:
                    cv.put(X + i, top, 'a6')
            for k_ in (1, 2, 3):
                for side in (-(w_ // 2) - 1, w_ - w_ // 2):
                    XX, YY = X + side + k_ // 2, Y + k_
                    if (water is None or water[YY, XX]) and pal.RAMP_OF[cv.get(XX, YY)] == 'a':
                        cv.put(XX, YY, 'a5' if k_ > 1 else 'a6')
    sc.later(foam)


# ================================================================ grain 1: the audited places
def palisade(sc, x, y, rx, ry, gap=None):
    """A ring of sharpened stakes: the back arc sorts behind whatever stands inside, the front arc in front."""
    if sc.g != 1:
        return _palisade_old(sc, x, y, rx, ry, gap)
    back = BD.stake_arc(rx, ry, 8, False, gap)
    front = BD.stake_arc(rx, ry, 8, True, gap)
    sc.add(back, x, y, z=-ry - 1)
    sc.add(front, x, y, z=ry + 1)
    sc.cv.shift(ellipse(x + 2, y + 2, rx + 2, ry + 1.5), -1, GROUND, where=lambda a: ~np.isin(a, pal.RAMP['d']))


def camp_palisade(sc, x, y):
    """Frontier Camp: a stake ring with its gate to the east, three tents and a cookfire. The company stands
    by the gate under the standard (drawn by the map, so other screens can reuse the camp without them)."""
    if sc.g != 1:
        return _camp_palisade_old(sc, x, y)
    palisade(sc, x, y + 3, 40, 25, gap=(0.1, .55))
    sc.add(BD.R(sc, PR.ridge_tent(22, 13, 'canvas')), x - 19, y - 5, shadow='house')
    sc.add(BD.R(sc, PR.ridge_tent(18, 11, 'canvas')), x + 3, y - 13, shadow='house')
    sc.add(BD.R(sc, PR.ridge_tent(16, 10, 'tan')), x - 27, y + 13, shadow='house')
    f = BD.R(sc, PR.fire(1))
    fx, fy = x - 16, y + 13
    sc.add(f, fx, fy)
    sc.later(lambda cv: PR.smoke(cv, int(fx), int(fy - f.h), 1))


def camp(sc, x, y, kind='traders'):
    if sc.g != 1:
        return _camp_old(sc, x, y, kind)
    if kind == 'traders':
        sc.add(BD.R(sc, PR.ridge_tent(18, 11, 'canvas')), x - 12, y + 2, shadow='house')
        sc.add(BD.R(sc, PR.ridge_tent(16, 10, 'tan')), x + 4, y - 9, shadow='house')
        sc.add(BD.R(sc, PR.wagon(1)), x + 14, y + 9, shadow='house')
        f = BD.R(sc, PR.fire(1))
        fx, fy = x - 2, y + 13
        sc.add(f, fx, fy)
        sc.later(lambda cv: PR.smoke(cv, int(fx), int(fy - f.h), 1))
        sc.add(BD.R(sc, PR.barrel(1)), x + 24, y + 1, shadow='house')
        sc.add(BD.flour_sacks(), x + 3, y + 4, shadow='house')
    else:   # Roderick's Camp: soldiers' tents in a row, a fire, his olive-and-ochre flag
        sc.add(BD.R(sc, PR.ridge_tent(18, 11, 'tan')), x - 14, y + 2, shadow='house')
        sc.add(BD.R(sc, PR.ridge_tent(16, 10, 'tan')), x + 6, y - 7, shadow='house')
        sc.add(BD.R(sc, PR.ridge_tent(16, 10, 'canvas')), x - 2, y + 14, shadow='house')
        f = BD.R(sc, PR.fire(1))
        fx, fy = x + 14, y + 10
        sc.add(f, fx, fy)
        sc.later(lambda cv: PR.smoke(cv, int(fx), int(fy - f.h), 1))
        sc.add(BD.R(sc, PR.flag(1, ('m3', 'o4'))), x - 28, y + 6, shadow='round')


def watchtower(sc, x, y):
    """Watchtower Ridge: a round stone tower inside a stake ring, its banner up, a timber guardhouse."""
    if sc.g != 1:
        return _watchtower_old(sc, x, y)
    palisade(sc, x, y + 5, 26, 15, gap=(1.6, .5))
    t = BD.stone_tower(14, 28, seed=2)
    tx, ty = x - 3, y + 3
    sc.add(t, tx, ty, shadow='house')
    fl = BD.R(sc, PR.flag(1, ('m3', 'b4'), h=12))
    sc.add(fl, tx - 1, ty - t.h + 3, z=t.h + 1)
    sc.add(BD.cottage(9, 'ns', 'shingle', 'boards', d=6, h=5, seed=3), x + 15, y + 10, shadow='house')
    sc.add(BD.woodpile(), x + 6, y + 13, shadow='house')


def fortress(sc, x, y):
    """Border Fortress: a walled yard; the front curtain wall of coursed stone with its gate and portcullis,
    a crenellated wall-walk, two round front towers and the tall keep behind, the garrison's banner over it."""
    if sc.g != 1:
        return _fortress_old(sc, x, y)
    W, D, wh, ww = 66, 26, 9, 3
    front_y = y + 16
    yard_top = front_y - wh - D
    # back: the yard (packed earth, a worn track from the gate to the keep), the back and side walls
    bk = Sprite(W + 4, D + ww + 6, (W + 4) // 2, ww + 2)
    ox, oy = 2, ww + 2
    for j in range(D):
        for i in range(W):
            k = 'd4'
            if j < 3:
                k = 'd2' if j < 2 else 'd3'                 # the back wall's shadow on the yard
            elif abs(i - W // 2) < 3 and j > 8:
                k = 'd5' if abs(i - W // 2) < 2 else 'd4'   # the track from the gate
            elif j > 4 and (i + 3 * (j // 5)) % 17 == 0 and j % 5 < 2:
                k = 'd3'                                    # a cart rut, two pixels long
            bk.put(ox + i, oy + j, k)
    for i in range(W):                                       # the back wall: its walk and merlons
        for j in range(ww):
            bk.put(ox + i, oy - ww + j, 't5' if j == 0 else ('t4' if j == 1 else 't3'))
        if (i // 2) % 2 == 0:
            bk.put(ox + i, oy - ww - 1, 't5')
    for j in range(-ww, D):                                  # the side walls' walks
        for i in range(ww):
            bk.put(ox + i, oy + j, 't6' if i == 0 else 't5')
            bk.put(ox + W - 1 - i, oy + j, 't3' if i == 0 else 't4')
    BD.selout(bk)
    sc.add(bk, x, yard_top)
    # front: the curtain wall's face in coursed blocks, lit to the west; the wall-walk and merlons; the gate
    fr = Sprite(W + 4, wh + 6, (W + 4) // 2, wh + 3)
    ox, oy = 2, 4
    BD.coursed(fr, ox, oy, W, wh, tones=(5, 4, 3), course=3, moss_row=wh - 1)
    for i in range(W):
        fr.put(ox + i, oy - 1, 't6' if i < W * .5 else 't5')          # the wall-walk's lit edge
        if (i // 2) % 2 == 0:
            fr.put(ox + i, oy - 2, 't6' if i < W * .5 else 't5')      # merlons
            fr.put(ox + i, oy - 3, 't5' if i < W * .5 else 't4')
    gw, gh = 10, 7
    gx = ox + W // 2 - gw // 2
    am = arch(gw, gh)
    for j in range(gh):
        for i in range(gw):
            if am[j, i]:
                k = 'w0' if (i % 2 == 0 or j < 2) else 't1'               # the portcullis bars in the dark
                if i % 2 == 1 and j >= 2:
                    k = 'w2'
                fr.put(gx + i, oy + wh - gh + j, k)
    for j in range(gh):                                              # the gate's voussoirs
        if am[j, 0]:
            fr.put(gx - 1, oy + wh - gh + j, 't5')
            fr.put(gx + gw, oy + wh - gh + j, 't3')
    BD.selout(fr)
    sc.add(fr, x, front_y, shadow='house')
    keep = BD.stone_tower(20, 30, slits=2, door=False, seed=7)
    ky = yard_top + 14
    sc.add(keep, x + 2, ky, shadow='house')
    for i, dx in enumerate((-W / 2 + 3, W / 2 - 3)):
        t = BD.stone_tower(12, 18, slits=1, door=False, seed=11 + i)
        sc.add(t, x + dx, front_y + 2, shadow='house')
    fl = BD.R(sc, PR.flag(1, ('s2', 'b4'), h=14))
    sc.add(fl, x + 2, ky - keep.h + 6, z=keep.h + 1)


def cave(sc, x, y):
    """Smuggler's Cave: a rock outcrop on the hill's flank, its mouth barred with iron and padlocked."""
    if sc.g != 1:
        return _cave_old(sc, x, y)
    n0 = len(sc.items)
    _cave_old(sc, x, y)
    for i in range(n0, len(sc.items)):
        it = sc.items[i]
        BD.reink(it[3], remap={'l': ('l2', 'l1')})


def hideout(sc, x, y):
    """Bandit Hideout: a cave mouth behind a fallen oak, a fire pit with the ash still warm."""
    if sc.g != 1:
        return _hideout_old(sc, x, y)
    W, H = 54, 30
    pts = [(2, 28), (0, 18), (10, 6), (24, 0), (38, 2), (50, 12), (52, 28)]
    fx, fy = 26, 28
    s = PR.outcrop(W, H, pts, seed=11)
    m = s.mask()
    top = m & ~nb(m, 0, -1)
    for xx, yy in zip(*np.nonzero(top)[::-1]):
        if (xx // 3) % 3 != 2:                        # moss in clumps along the crown, not speckle
            s.put(xx, yy + 1, 'l4' if (xx // 3) % 2 else 'l3')
    mw, mh = 18, 15
    am = arch(mw, mh)
    for j in range(mh):
        for i in range(mw):
            if am[j, i]:
                s.put(fx - mw // 2 + i, fy - mh + j, 't0' if j > 2 else 't1')
    for i in range(mw):
        s.put(fx - mw // 2 + i, fy - 5 + (i // 9), 'b2')        # the tripline across the mouth
    BD.reink(s, remap={'l': ('l2', 'l1')})
    s.ax, s.ay = fx, fy
    sc.add(s, x, y + 6, shadow='house')
    oak = BD.fallen_oak(40, 7)
    sc.add(oak, x - 22, y + 16, shadow='house')
    crown = TS.clumps(8, 77)
    sc.add(crown, x + 20, y + 16, shadow=('ell', 2, 1, 8, 4))
    px, py = x + 2, y + 21
    pit = Sprite.ascii([".tTtTtTt.", "tT.....Tt", "T.aaAaa.T", "t.aeAaa.t", "tT.....Tt", ".tTtTtTt."],
                       {'t': 't4', 'T': 't3', 'a': 't2', 'A': 't3', 'e': 'x4'})
    pit.ax, pit.ay = pit.w // 2, pit.h - 1
    sc.add(pit, px, py)
    sc.later(lambda cv: PR.smoke(cv, int(px), int(py - pit.h), 1, n=7))


def wreck(sc, x, y):
    """South Road Ambush: the cart tipped on its side across the road, the ox down beside it, arrows in the
    boards, the flour sacks split and spilled."""
    if sc.g != 1:
        return _wreck_old(sc, x, y)
    sc.add(BD.cart_on_side(), x - 6, y + 6, shadow='house')
    sc.add(BD.dead_ox(), x + 16, y + 9, shadow='house')
    sc.add(BD.flour_sacks(), x - 17, y + 8, shadow='house')
    sc.later(lambda cv: [cv.put(x + 2 + i, y + 9 + (i % 2), 'b5') for i in range(6) if i % 3 != 2])


def cairn(sc, x, y):
    """North Ridge Path: a cairn of stacked stones and a finger-post."""
    if sc.g != 1:
        return _cairn_old(sc, x, y)
    for (dx, dy, r) in [(-4, 3, 5), (3, 2, 4.5), (-1, -3, 4), (0, -7, 3)]:
        rk = BD.reink(PR.rock(r, int(dx * 7 + dy), g=1))
        sc.add(rk, x + dx, y + dy, shadow='house')
    sc.add(BD.fingerpost('ew'), x + 12, y + 5, shadow='house')


def thornwood_sign(sc, x, y):
    """The big finger-board to Thornwood on the east road; the map writes the word on its board."""
    if sc.g != 1:
        return _thornwood_sign_old(sc, x, y)
    sc.add(BD.board_sign(90, 23, 44), x, y, shadow='house')
