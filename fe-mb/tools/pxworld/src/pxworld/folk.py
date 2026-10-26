"""pxworld folk: the company as map minis, and its standard. Hand-drawn, one sprite per grain.

figure(who, g)     who = 'roy' (The Foundling: red hair, gold armour, blue scarf and cape, sword)
                         'marcus' (Bagrat "Oak": white hair, red cloak, steel plate, sword)
                         'lilina' (Lilina: pale blue hair, blue robe with gold trim, staff and orb)
standard(g)        the company standard: a red banner, a white chevron, a woad band at the top
company(cv, x, y, g)   all three under the standard, with ground shadows; (x, y) = the group's foot
"""
from .canvas import Sprite, ellipse
from .pal import ix

K = {'k': 'k0'}
# ---------------------------------------------------------------- grain 1 (1 art px = 1 screen px)
ROY_1 = [
    "........kk.k....",
    ".......kHkkHk...",
    ".....kkHhHkHhk..",
    "....kHhhHHhHHHk.",
    "...kHhHHHHHHHqk.",
    "...kHHHqHHHHqHqk",
    "...kHqHHffHHqqqk",
    "...kqHffffffHqqk",
    "...kqfefffefFqk.",
    "....kffffffffk..",
    "....kkfffFFFkk..",
    "...kgGkBBBBkGgk.",
    "..kgGGGBbbBGGGyk",
    "..kGGGykLLLLkyGk",
    ".kcGGykLLlLLkyyk",
    ".kfkkkLLLLLLkfk.",
    ".kSkckGGGGGGkck.",
    ".kSkckPPPpPPkck.",
    ".kSkckPPpkPPkck.",
    ".kSkckPPpkPPpkk.",
    ".kskkkGGgkGGgk..",
    "..k..kGGykGGyk..",
    ".....kGyykGyyk..",
    ".....koookoook..",
    ".....kkkkkkkkk..",
]
ROY_KM = {'c': 's1', 'H': 'x4', 'h': 'x5', 'q': 'x3', 'f': 'f3', 'F': 'f2', 'e': 'k1', 'g': 'o5', 'G': 'o4', 'y': 'o2',
          'B': 's2', 'b': 's3', 'L': 'w5', 'l': 'w4', 'P': 'w3', 'p': 'w2', 'S': 't6', 's': 't4', 'o': 'w1', 'k': 'k0'}

MARCUS_1 = [
    ".....kkkkk......",
    "....kWWWwWk.....",
    "...kWWWWwwWk....",
    "..kWWWwwWWWvk...",
    "..kWWffffffWvk..",
    "..kWfefffefWvk..",
    "..kWfffffffWvk..",
    "..kWvkfFFfkvvk..",
    ".krrkRRRRRRkRdk.",
    "krRRkaAAAAzkRRdk",
    "krRkaAAAAAzzkRdk",
    "kRRkAAAAAAzzkRdk",
    "kRRkzAAAAzzzkRdk",
    "kRdkfkZZZZkfkRdk",
    "kRdkkAAzAAzkkSdk",
    "kRdkAAzkAAzkkSdk",
    "kRdkAAzkAAzk.Sdk",
    "kRDkAAzkAAzk.sDk",
    ".kDkaAzkaAzk.kk.",
    "..kkaAzkaAzk....",
    "...kZZZkZZZk....",
    "...kkkkkkkkk....",
]
MARCUS_KM = {'W': 'b5', 'w': 'b4', 'v': 'b2', 'f': 'f3', 'F': 'f2', 'e': 'k1', 'R': 'x3', 'r': 'x4', 'd': 'x2', 'D': 'x1',
             'a': 't6', 'A': 't5', 'z': 't3', 'Z': 't2', 'S': 't6', 's': 't4', 'k': 'k0'}

LILINA_1 = [
    "..kk....kkkk....",
    ".kOok.kkiiIIk...",
    ".kooOkkiiiIIjk..",
    "..kkkiIIiIIIjjk.",
    "...wkIIffffIIjk.",
    "...wkIfefffejjk.",
    "...wkIffffffjjk.",
    "...wkIjfFFfjJjk.",
    "...wkkTuCCuTkJk.",
    "..kfuuuuCCuuuukk",
    "...wkuuuCCcuuuk.",
    "...wkuuuCCcuuuk.",
    "...wkuuCCCcuuuuk",
    "...wkuuCCCcuuuuk",
    "...wkuuCCCcuuuuk",
    "...wkuuCCCccuuuk",
    "...wkuCCCCccuuuk",
    "...wkTTTTTTTTTTk",
    "...w.kkkkkkkkkk.",
]
LILINA_KM = {'J': 's2', 'I': 's4', 'i': 's5', 'j': 's3', 'f': 'f3', 'F': 'f2', 'e': 'k1', 'u': 's1', 'U': 's0', 'T': 'o4',
             'C': 'b5', 'c': 'b3', 'w': 'w5', 'O': 's5', 'o': 's3', 'k': 'k0'}

# ---------------------------------------------------------------- grain 2 (1 art px = 2 screen px)
ROY_2 = [
    "...k.k...",
    "..kHkHk..",
    ".kHhHHqk.",
    ".kqfffqk.",
    ".kefefFk.",
    "kgkfFkgk.",
    "kGGBbGGyk",
    "kSkLLLkyk",
    "kSkGGGkBk",
    "kSkPkPkBk",
    "kskGkGkk.",
    ".kkokok..",
    "..kkkkk..",
]
MARCUS_2 = [
    "..kkkk...",
    ".kWWwWk..",
    ".kWfffvk.",
    ".kefefvk.",
    ".kWfFfvk.",
    "krRkkRdk.",
    "kRaAAzRdk",
    "kRkAAzkSk",
    "kRkZZZkSk",
    "kdkAkAkSk",
    ".kkAkAkk.",
    "..kZkZk..",
    "..kkkkk..",
]
LILINA_2 = [
    "k...kkk..",
    "Ok.kIiIk.",
    "k.kIiIIjk",
    "w.kffffjk",
    "w.kefefjk",
    "w.kIfFIjk",
    "wkTuCCuTk",
    "fuuuCcuuk",
    "wkuuCcuuk",
    "wkuuCcuuuk",
    "wkTTTTTTTk",
    "w.kkkkkkk.",
]

STANDARD_1 = [
    "kkkkkkkkkkkkkkk",
    "kbbbbbbbbbbbbBk",
    "kBBBBBBBBBBBBBk",
    "kkkkkkkkkkkkkkk",
    "krrrrrrRRRRRRdk",
    "krrrrrrWRRRRRdk",
    "krrrrrWWWRRRRdk",
    "krrrrWWdWWRRRdk",
    "krrrWWdRRWWRRdk",
    "krrWWdRRRRWWRdk",
    "krrWdRRRRRRWRdk",
    "krRRRRRRRRRRRdk",
    "krRRRRRRRRRRRdk",
    "kRRRRdkkRRRRddk",
    "kRRRdk..kRRRdk.",
    "kRRdk....kRRdk.",
    "kRdk......kRdk.",
    "kkk........kkk.",
]
STANDARD_2 = [
    "kkkkkkkk",
    "kbbbbbBk",
    "kkkkkkkk",
    "krrWrRdk",
    "krWdWRdk",
    "kWdRRWdk",
    "krRRRRdk",
    "kRdkkRdk",
    "kdk..kdk",
    "kk....kk",
]
STD_KM = {'b': 's3', 'B': 's2', 'r': 'x4', 'R': 'x3', 'd': 'x2', 'W': 'b5', 'k': 'k0'}

FIGS = {1: {'roy': (ROY_1, ROY_KM), 'marcus': (MARCUS_1, MARCUS_KM), 'lilina': (LILINA_1, LILINA_KM)},
        2: {'roy': (ROY_2, ROY_KM), 'marcus': (MARCUS_2, MARCUS_KM), 'lilina': (LILINA_2, LILINA_KM)}}


def figure(who, g=1):
    rows, km = FIGS[g][who]
    s = Sprite.ascii(rows, km)
    # the foot anchor is the bottom row's middle
    return s


def standard(g=1, pole=None):
    """Pole and banner as one Sprite; foot = the pole's base."""
    rows = STANDARD_1 if g == 1 else STANDARD_2
    fl = Sprite.ascii(rows, STD_KM)
    pole = pole or (48 if g == 1 else 22)
    W = fl.w + 2
    H = pole + 3
    s = Sprite(W, H, 1, H - 1)
    # the pole: a lit west edge, ink either side, a spear point
    for y in range(3, H):
        s.put(1, y, 'w5' if y < H - 1 else 'w3')
        s.put(0, y, 'k0'); s.put(2, y, 'k0')
        if g == 1 and y > 4:
            s.put(1, y, 'w5' if y % 7 else 'w4')
    s.put(1, 0, 'k0'); s.put(1, 1, 't6'); s.put(0, 2, 'k0'); s.put(1, 2, 't4'); s.put(2, 2, 'k0')
    if g == 1:
        s.put(0, 1, 'k0'); s.put(2, 1, 'k0')
    s.blit(fl, 2, 3 if g == 1 else 3)
    return s


def company(cv, x, y, g=1, order=('marcus', 'roy', 'lilina')):
    """Stamp the three under the standard straight onto a canvas, with ground shadows. (x, y) = the
    middle figure's foot, in art px. On a busy scene, use company_items() with a Scene instead."""
    items = company_items(g, order)
    for spr, dx, dy in items:
        cv.shift(ellipse(x + dx + 1, y + dy + 1, 5 / g + 1, 2 / g + .5), -1, ('g', 'd', 'h'))
    for spr, dx, dy in sorted(items, key=lambda t: t[2]):
        cv.stamp(spr, x + dx, y + dy)


def company_items(g=1, order=('marcus', 'roy', 'lilina')):
    """The company as (sprite, dx, dy) parts relative to the group's foot, for a y-sorting Scene."""
    gap = 15 if g == 1 else 8
    out = [(standard(g), gap // 2 + (1 if g == 1 else 0), -(6 if g == 1 else 3))]
    for (dx, dy), who in zip([(-gap, -1), (0, 1), (gap, -1)], order):
        out.append((figure(who, g), dx, dy))
    return out
