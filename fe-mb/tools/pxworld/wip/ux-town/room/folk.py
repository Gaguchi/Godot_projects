"""The tavern's folk without art, at the room's own scale (a person about 140 px tall), drawn the way px-town draws
its townsfolk: flat fills stepped down their own ramps, light from the upper left, a selout outline in each part's
darkest step. They stay in the background and never come close: the barkeep shows only above his counter, the
patrons sit with their backs to the room.

  barkeep()            the keeper behind his bar, from the chest up: bald, a big beard, a madder shirt with the
                       sleeves rolled, a linen apron, polishing a tankard. Anchor: his feet's line, 140 px under
                       the top of his head (the counter hides everything below its top).
  patron(kind, seed)   a drinker seated on a bench, back to the room. Anchor: the bench's top under him.
"""
import random

import numpy as np

import tpx
from tpx import ix, CLEAR, new, put, get, nb, fill, hline, vline, outline

HEAD = [
    ".....oooooooo......",
    "...ooSSSSSSsso.....",
    "..oSSWSSSSSSssqo...",
    ".oSSWSSSSSSSsssqo..",
    ".oSSSSSSSSSsssqqo..",
    ".oSSSSSSSSssssqqo..",
    ".osbbbSSsbbbssqqo..",
    "osSsekSSSkesssqqqo.",
    "osSsSSSnnSSsssqqqo.",
    ".osSSSSnnqSsssqqo..",
    ".oHHSSSsqqssHHjjo..",
    ".oHHHHhhhhhhHjjjo..",
    ".JHHHHhhhhhhhjjjJ..",
    ".JHHHhhhhhhhhjjjJ..",
    "..JHHhhhhhhhhjjJ...",
    "..JHhhhhhhhhhjjJ...",
    "...JHhhhhhhhjjJ....",
    "....JJhhhhhhjJ.....",
    "......JJJJJJJ......",
]
HEAD_KM = {'o': 'f0', 'S': 'f3', 'W': 'f3', 's': 'f2', 'q': 'f1', 'b': 'w1', 'e': 'k0', 'k': 'b4', 'n': 'f3',
           'H': 'w4', 'h': 'w3', 'j': 'w2', 'J': 'w1'}


def barkeep():
    """The keeper of Pine Crossing's tavern, from the chest up, polishing a tankard. Anchor: his feet's line."""
    Wd, Hd = 56, 66
    s = new(Wd, Hd, Wd // 2, 140)               # the anchor is his feet, far below the counter's top
    cx = Wd // 2
    prof = {13: 7, 14: 10, 15: 13, 16: 15, 17: 17, 18: 18, 19: 19}
    for y in range(13, Hd):
        hw = prof.get(y, 20 if y < 44 else 19)
        for x in range(cx - hw, cx + hw):
            u = (x - (cx - hw)) / (2 * hw)
            put(s, x, y, 'x3' if u < .24 else ('x2' if u < .8 else 'x1'))
    # the crease where each arm hangs against the body, and the rolled cuffs at the elbows
    for y in range(26, 44):
        put(s, cx - 13, y, 'x1')
        put(s, cx + 12, y, 'x0')
    for (x0, x1) in ((cx - 20, cx - 13), (cx + 12, cx + 20)):
        fill(s, x0, 41, x1, 45, 'b3')
        hline(s, x0, x1 - 1, 41, 'b4')
    # forearms: from the cuffs in toward his belly, where the hands meet
    for k, y in enumerate(range(45, 56)):
        for x in range(cx - 19 + k, cx - 12 + k):
            put(s, x, y, 'f3' if x < cx - 16 + k else 'f2')
        for x in range(cx + 11 - k, cx + 19 - k):
            put(s, x, y, 'f2' if x < cx + 16 - k else 'f1')
    # the apron: a linen bib from under the beard, its straps, the waist band
    for y in range(19, Hd):
        hw = 8 if y < 40 else 11
        for x in range(cx - hw, cx + hw):
            u = (x - (cx - hw)) / (2 * hw)
            if not (45 <= y < 56 and abs(x - cx) > 6):
                put(s, x, y, 'b5' if u < .2 else ('b4' if u < .76 else 'b3'))
    for y in range(13, 19):
        put(s, cx - 8, y, 'b4')
        put(s, cx + 7, y, 'b3')
    fill(s, cx - 11, 40, cx + 11, 43, 'b3')
    hline(s, cx - 11, cx + 10, 40, 'b4')
    for y in range(23, 40, 6):
        put(s, cx - 2, y, 'b3')
    # the tankard in his left hand: a pewter cylinder lit on the left, a lid with a thumb-piece, a handle
    tx, ty = cx - 10, 46
    fill(s, tx, ty + 2, tx + 10, ty + 14, 't4')
    vline(s, tx, ty + 2, ty + 13, 't5')
    vline(s, tx + 1, ty + 2, ty + 13, 't5')
    vline(s, tx + 8, ty + 2, ty + 13, 't3')
    vline(s, tx + 9, ty + 2, ty + 13, 't2')
    hline(s, tx, tx + 9, ty + 5, 't3')
    hline(s, tx, tx + 9, ty + 11, 't3')
    fill(s, tx - 1, ty, tx + 11, ty + 2, 't3')
    hline(s, tx - 1, tx + 10, ty, 't5')
    put(s, tx + 10, ty - 1, 't4')
    put(s, tx + 11, ty - 2, 't5')
    for (dx, dy) in ((10, 4), (11, 4), (12, 5), (12, 6), (12, 7), (12, 8), (12, 9), (11, 10), (10, 10)):
        put(s, tx + dx, ty + dy, 't3')
    for (dx, dy) in ((-1, 6), (-1, 7), (-1, 8), (-2, 7), (0, 9), (-1, 10)):
        put(s, tx + dx, ty + dy, 'f3')                 # fingers round it
    # the cloth in his right hand, rubbing its rim
    for (dx, dy, k) in ((13, 6, 'b5'), (14, 6, 'b4'), (15, 6, 'b4'), (13, 7, 'b4'), (14, 7, 'b4'), (15, 7, 'b3'), (16, 7, 'b3'),
                        (14, 8, 'b4'), (15, 8, 'b3'), (16, 8, 'b3'), (14, 9, 'b3'), (15, 9, 'b2'), (15, 10, 'b3'), (14, 5, 'b5'),
                        (15, 5, 'b5'), (16, 6, 'f2'), (17, 6, 'f2'), (17, 7, 'f1')):
        put(s, tx + dx, ty + dy, k)
    hd = tpx.Sprite.ascii(HEAD, HEAD_KM)
    s.blit(hd, cx - 9, 0)
    outline(s, dark={'x': 'x0', 'b': 'b1', 'f': 'f0', 't': 't1'})
    return s


TUNICS = {'moss': 'm', 'slate': 's', 'oxblood': 'x', 'walnut': 'w'}


def patron(kind='moss', seed=1, hair='w', hood=False, w=40):
    """A drinker on a bench, his back to the room: hair (or a hood) over a nape, sloping shoulders, the tunic falling
    in folds with a seam down the back, the arms forward to the table, a belt, the seat of his breeches."""
    rng = random.Random(seed)
    r = TUNICS.get(kind, kind)
    n = len(tpx.pal.RAMP[r])
    tone = lambda i: f'{r}{max(0, min(n - 1, i))}'
    base = 3 if r in ('m', 's', 'x') else 4
    Wd, Hd = w + 12, 86
    s = new(Wd, Hd, Wd // 2, Hd - 1)
    cx = Wd // 2
    seat = Hd - 8                  # the bench's top under him
    top = 26                       # the top of his shoulders
    waist = seat - 10

    def half(y):
        if y < top + 7:
            return 6 + (w / 2 - 6) * ((y - top + 1) / 8) ** .55
        t = (y - top - 7) / (waist - top - 7)
        return w / 2 - 3 * t

    # breeches: only the seat shows above the bench, a little narrower than the shoulders
    for y in range(waist, seat + 1):
        hw = w // 2 - 2
        for x in range(cx - hw, cx + hw):
            u = (x - (cx - hw)) / (2 * hw)
            put(s, x, y, 'w4' if u < .2 else ('w3' if u < .8 else 'w2'))
    # the tunic: a sloping shoulder line, the back tapering a little to the belt
    for y in range(top, waist):
        hw = half(y)
        for x in range(int(round(cx - hw)), int(round(cx + hw))):
            u = (x + .5 - (cx - hw)) / (2 * hw)
            put(s, x, y, tone(base + 1) if u < .22 else (tone(base) if u < .74 else tone(base - 1)))
    # the arms against the body: a shade crease from each armpit
    for y in range(top + 10, waist - 2):
        put(s, int(round(cx - half(y))) + 5, y, tone(base - 1))
        put(s, int(round(cx + half(y))) - 6, y, tone(base - 2))
    # folds: continuous shade lines that wander, a lit lip west of each; the back seam
    for fx_ in (-6, 3, 9):
        x = cx + fx_
        for y in range(top + 9, waist - 1):
            if y % 7 == 0:
                x += rng.choice((0, 1, -1, 0))
            if get(s, x, y) != CLEAR:
                put(s, x, y, tpx.pal.KEYS[tpx.pal.shift_index(get(s, x, y), -1)])
                if get(s, x - 1, y) != CLEAR and y > top + 12:
                    put(s, x - 1, y, tpx.pal.KEYS[tpx.pal.shift_index(get(s, x - 1, y), 1)])
    for y in range(top + 6, waist):
        put(s, cx - 1, y, tone(base - 1))
    # the belt
    bx0, bx1 = int(cx - half(waist - 1)), int(cx + half(waist - 1))
    fill(s, bx0, waist - 3, bx1, waist, 'w1')
    hline(s, bx0, bx1 - 1, waist - 3, 'w2')
    yy, xx = np.mgrid[0:Hd, 0:Wd].astype(float) + .5
    hc = top - 12
    if hood:
        # a hood: a soft peak over the crown, the cowl falling onto the shoulders, lit on the left
        hood_m = tpx.cpx.ell_mask(Wd, Hd, cx - .5, hc, 10, 12, xx, yy)
        hood_m |= (np.abs(xx - cx + .5) < 9 + (yy - hc) * .55) & (yy > hc) & (yy < top + 7)
        s.ix[hood_m] = ix(tone(base))
        s.ix[hood_m & (xx < cx - 4)] = ix(tone(base + 1))
        s.ix[hood_m & (xx > cx + 4)] = ix(tone(base - 1))
        for y in range(hc - 4, top + 6):
            put(s, cx + 1, y, tone(base - 1))
            if y > hc + 6:
                put(s, cx - 6, y, tone(base - 1))
    else:
        fill(s, cx - 4, top - 4, cx + 4, top + 2, 'f2')
        vline(s, cx + 3, top - 4, top + 1, 'f1')
        head = tpx.cpx.ell_mask(Wd, Hd, cx - .5, hc, 8.5, 10, xx, yy)
        hk = {'w': ('w4', 'w3', 'w2'), 'd': ('d5', 'd4', 'd3'), 'h': ('h4', 'h3', 'h2'), 'k': ('w2', 'w1', 'w0'),
              'b': ('b3', 'b2', 'b1')}[hair]
        s.ix[head] = ix(hk[1])
        s.ix[head & ((xx - cx) + (yy - hc) * .6 < -4)] = ix(hk[0])
        s.ix[head & ((xx - cx) - (yy - hc) * .3 > 4)] = ix(hk[2])
        for k in range(5):
            x0 = cx - 5 + k * 2 + rng.randint(0, 1)
            for y in range(hc - 5 + rng.randint(0, 2), hc + 9):
                if head[y, x0]:
                    s.ix[y, x0] = ix(hk[2] if k > 2 else hk[1])
        for (ex, k) in ((cx - 9, 'f3'), (cx + 8, 'f1')):
            put(s, ex, hc + 1, k)
            put(s, ex, hc + 2, k)
            put(s, ex, hc + 3, 'f2')
    outline(s, dark={'f': 'f0', 'w': 'w0'})
    return s
