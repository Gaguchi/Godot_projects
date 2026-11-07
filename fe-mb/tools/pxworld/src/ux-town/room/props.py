"""The tavern's furniture at 1:1 with the board sprites (80 px a metre of height, 40 px a metre of floor depth).

Every piece is an indexed Sprite on pal ramps, its anchor the middle of its front foot line, so the stage y-sorts it
by where it meets the floor. Light from the upper left: tops lit, fronts the middle step, right ends and undersides
dark, outlines in each part's own darkest step (selout).
  table(w, d, h)      a plank-topped table: lit boards, a front edge, an apron, four legs (the back two in shade)
  bench(w)            a long low bench on two trestle ends
  stool()             a three-legged stool
  barrel()            an upright cask: bulging staves lit on the left, three iron hoops, a lid of boards
  keg_end(r)          a cask on its side seen end on: head boards, a hoop, a brass tap
  counter(w)          the bar: a front of upright boards, a lit top with a worn lip, a kick board
  shelf(w, items)     a wall shelf on two brackets, with tankards, jugs and bottles standing on it
  notice_board()      the board of notices: a frame, boards, pinned papers, one with a sketched face, a seal
  desk()              the bounty desk: a writing table with a ledger, ink, a quill, a strongbox and a hand bell
  shackles()          irons hanging from a peg
  mug(kind)           a tankard (pewter) or a wooden cup"""
import math
import random

import numpy as np

import tpx
from tpx import ix, CLEAR, new, put, get, nb, fill, hline, vline, outline


def _grain(s, x0, y0, x1, y1, key, rng, n=None, horiz=True, step=.05):
    """Grain streaks inside a rectangle, one px wide, stepping a pixel now and then."""
    n = n or max(1, ((x1 - x0) * (y1 - y0)) // 120)
    for _ in range(n):
        if horiz:
            x, y = rng.randint(x0, max(x0, x1 - 6)), rng.randint(y0, max(y0, y1 - 1))
            for j in range(rng.randint(5, max(6, (x1 - x0) // 2))):
                if x0 <= x + j < x1 and y0 <= y < y1 and s.ix[y, x + j] != CLEAR:
                    s.ix[y, x + j] = ix(key)
                if rng.random() < step:
                    y = max(y0, min(y1 - 1, y + rng.choice((-1, 1))))
        else:
            x, y = rng.randint(x0, max(x0, x1 - 1)), rng.randint(y0, max(y0, y1 - 6))
            for j in range(rng.randint(5, max(6, (y1 - y0) // 2))):
                if x0 <= x < x1 and y0 <= y + j < y1 and s.ix[y + j, x] != CLEAR:
                    s.ix[y + j, x] = ix(key)
                if rng.random() < step:
                    x = max(x0, min(x1 - 1, x + rng.choice((-1, 1))))


# ---------------------------------------------------------------- tables and seats
def table(w=120, d=28, h=60, seed=1, ramp='w', tone=5):
    """A plank-topped table w px long, its top d px deep on screen, standing h px tall."""
    rng = random.Random(seed)
    m = 2
    s = new(w + 2 * m, d + h + 2 * m, (w + 2 * m) // 2, d + h + m - 1)
    L = lambda i: f'{ramp}{max(0, min(6, i))}'
    x0, x1 = m, m + w
    ty0, ty1 = m, m + d                       # the top face
    ey1 = ty1 + 5                             # the top's front edge
    foot = m + d + h - 1                      # the front legs' foot row
    # legs: the back pair first (in shade, their feet d px higher), then the front pair
    for lx in (x0 + 8, x1 - 15):
        fill(s, lx, ey1, lx + 6, foot - d + 1, L(tone - 3))
    for lx in (x0 + 3, x1 - 10):
        fill(s, lx, ey1, lx + 7, foot + 1, L(tone - 2))
        vline(s, lx, ey1, foot, L(tone - 1))
        vline(s, lx + 6, ey1, foot, L(tone - 3))
    # the apron under the top, set back a little from the ends
    fill(s, x0 + 3, ey1, x1 - 3, ey1 + 6, L(tone - 2))
    hline(s, x0 + 3, x1 - 4, ey1 + 5, L(tone - 3))
    # the top: boards along its length, lit
    fill(s, x0, ty0, x1, ty1, L(tone))
    for by in range(ty0 + 7, ty1 - 1, 7):
        hline(s, x0, x1 - 1, by, L(tone - 1))
    _grain(s, x0 + 1, ty0 + 1, x1 - 1, ty1, L(tone - 1), rng, n=(w * d) // 160)
    hline(s, x0, x1 - 1, ty0, L(tone + 1))
    # the front edge of the top: its lip catches the light, its face the middle step
    fill(s, x0, ty1, x1, ey1, L(tone - 1))
    hline(s, x0, x1 - 1, ty1, L(tone + 1))
    vline(s, x1 - 1, ty0, ey1 - 1, L(tone - 2))
    outline(s)
    return s


def bench(w=200, seed=2, ramp='w', tone=5):
    """A long bench: a seat board 14 px deep, 36 px off the floor, on two trestle ends."""
    rng = random.Random(seed)
    m, d, h = 2, 14, 36
    s = new(w + 2 * m, d + h + 2 * m, (w + 2 * m) // 2, d + h + m - 1)
    L = lambda i: f'{ramp}{max(0, min(6, i))}'
    x0, x1 = m, m + w
    foot = m + d + h - 1
    for lx in (x0 + 10, x1 - 20):
        fill(s, lx, m + d, lx + 9, foot + 1, L(tone - 2))
        vline(s, lx, m + d, foot, L(tone - 1))
        vline(s, lx + 8, m + d, foot, L(tone - 3))
        fill(s, lx - 2, foot - 3, lx + 11, foot + 1, L(tone - 2))           # the foot of the trestle
        hline(s, lx - 2, lx + 10, foot - 3, L(tone - 1))
    fill(s, x0, m, x1, m + d, L(tone))
    _grain(s, x0 + 1, m + 1, x1 - 1, m + d, L(tone - 1), rng, n=w // 14)
    hline(s, x0, x1 - 1, m, L(tone + 1))
    fill(s, x0, m + d, x1, m + d + 4, L(tone - 1))
    hline(s, x0, x1 - 1, m + d, L(tone + 1))
    outline(s)
    return s


def stool(seed=3, ramp='w', tone=5):
    """A three-legged stool: a round seat seen from above, three splayed legs."""
    m = 2
    W_, H_ = 34 + 2 * m, 46 + 2 * m
    s = new(W_, H_, W_ // 2, H_ - m - 1)
    L = lambda i: f'{ramp}{max(0, min(6, i))}'
    cx = W_ / 2
    foot = H_ - m - 1
    for (xa, xb, k) in ((cx - 4, cx - 13, tone - 2), (cx + 4, cx + 13, tone - 3), (cx, cx + 1, tone - 3)):
        for y in range(m + 12, foot + 1):
            t = (y - m - 12) / (foot - m - 12)
            x = int(round(xa + (xb - xa) * t))
            for dx in range(3):
                put(s, x + dx, y, L(k + (1 if dx == 0 else 0)))
    yy, xx = np.mgrid[0:H_, 0:W_].astype(float) + .5
    seat = tpx.cpx.ell_mask(W_, H_, cx, m + 7, 16, 7, xx, yy)
    s.ix[seat] = ix(L(tone))
    s.ix[seat & ~tpx.cpx.ell_mask(W_, H_, cx + 1, m + 6, 15, 6, xx, yy)] = ix(L(tone - 1))
    s.ix[seat & tpx.cpx.ell_mask(W_, H_, cx - 5, m + 5, 7, 3, xx, yy)] = ix(L(tone + 1))
    rim = tpx.cpx.ell_mask(W_, H_, cx, m + 10, 16, 5, xx, yy) & ~seat
    s.ix[rim] = ix(L(tone - 2))
    outline(s)
    return s


# ---------------------------------------------------------------- casks
def barrel(seed=4, w=44, h=66):
    """An upright cask: staves bulge, lit on the left; three iron hoops follow the curve; a lid of boards."""
    rng = random.Random(seed)
    m = 2
    lid = 12
    W_, H_ = w + 6 + 2 * m, h + lid + 2 * m
    s = new(W_, H_, W_ // 2, H_ - m - 1)
    cx = W_ / 2
    top = m + lid // 2
    bot = H_ - m - 1
    rx_lid = w / 2
    for y in range(top, bot + 1):
        t = (y - top) / (bot - top)
        hw = rx_lid + 3 * math.sin(math.pi * t)
        for x in range(int(math.floor(cx - hw)), int(math.ceil(cx + hw))):
            u = (x + .5 - (cx - hw)) / (2 * hw)
            k = 'd5' if u < .18 else ('d4' if u < .52 else ('d3' if u < .8 else 'd2'))
            put(s, x, y, k)
        # stave seams, curving with the bulge
        for f in (-.66, -.33, 0, .33, .66):
            x = int(round(cx + f * hw))
            if get(s, x, y) != CLEAR:
                put(s, x, y, tpx.pal.shift_index(get(s, x, y), -1))
    # hoops: an arc that sags toward the middle (we look down on them)
    for (t0, hk) in ((.1, 4), (.36, 3), (.82, 4)):
        yc = top + t0 * (bot - top)
        for x in range(int(cx - rx_lid - 3), int(cx + rx_lid + 4)):
            t = (yc - top) / (bot - top)
            hw = rx_lid + 3 * math.sin(math.pi * t)
            v = (x + .5 - cx) / hw
            if abs(v) > 1:
                continue
            y = int(round(yc + 2.2 * math.sqrt(max(0, 1 - v * v))))
            u = (v + 1) / 2
            for j in range(hk):
                if get(s, x, y + j) != CLEAR:
                    put(s, x, y + j, 't4' if (j == 0 and u < .6) else ('t3' if u < .55 else 't2'))
    # the lid: an ellipse of boards, its rim a step darker, lit on the upper left
    yy, xx = np.mgrid[0:H_, 0:W_].astype(float) + .5
    L_ = tpx.cpx.ell_mask(W_, H_, cx, top, rx_lid, lid / 2, xx, yy)
    s.ix[L_] = ix('d4')
    inner = tpx.cpx.ell_mask(W_, H_, cx, top + .5, rx_lid - 3, lid / 2 - 2, xx, yy)
    s.ix[inner] = ix('d5')
    s.ix[inner & (xx > cx + 4)] = ix('d4')
    for bx in range(int(cx - rx_lid + 9), int(cx + rx_lid - 4), 9):
        col = inner[:, bx]
        s.ix[col, bx] = ix('d3')
    s.ix[L_ & ~tpx.cpx.ell_mask(W_, H_, cx, top - .5, rx_lid - 1, lid / 2 - 1, xx, yy) & (yy > top)] = ix('t3')
    outline(s, dark={'d': 'd1'})
    return s


def keg_end(r=20, seed=5, body=15):
    """A cask on its side, its head to the room: the curve of its body runs back over the head (we look down on it),
    staves and a hoop on it; the head's boards, its hoop ring lit on the upper left, a brass tap low on the head; the
    cradle block it lies in. Anchor: the cradle's foot."""
    m = 2
    W_ = 2 * r + 2 * m + 8
    H_ = 2 * r + 2 * m + body + 6
    s = new(W_, H_, W_ // 2, H_ - m - 1)
    cx, cy = W_ / 2, m + r + .5 + body
    yy, xx = np.mgrid[0:H_, 0:W_].astype(float) + .5
    # the body seen from above, running back from the head
    back = (np.abs(xx - cx) < r - .5) & (yy > m + r * .35) & (yy < cy)
    back |= tpx.cpx.ell_mask(W_, H_, cx, m + r * .35 + 3, r - .5, 4, xx, yy)
    s.ix[back] = ix('d4')
    s.ix[back & (xx < cx - r * .45)] = ix('d5')
    s.ix[back & (xx > cx + r * .5)] = ix('d3')
    for bx in range(int(cx - r + 6), int(cx + r - 3), 6):
        s.ix[back[:, bx], bx] = ix('d3')
    for hy in (int(m + r * .35 + 5), int(cy - body * .45)):
        rowm = back[hy:hy + 3]
        s.ix[hy:hy + 3][rowm] = ix('t3')
        s.ix[hy][back[hy]] = ix('t4')
    outer = tpx.cpx.ell_mask(W_, H_, cx, cy, r, r, xx, yy)
    head = tpx.cpx.ell_mask(W_, H_, cx, cy, r - 4, r - 4, xx, yy)
    s.ix[outer] = ix('t3')
    s.ix[outer & ((xx - cx) + (yy - cy) < -r * .5)] = ix('t4')
    s.ix[outer & ((xx - cx) + (yy - cy) > r * .6)] = ix('t2')
    s.ix[head] = ix('d4')
    s.ix[head & ((xx - cx) + (yy - cy) < -r * .55)] = ix('d5')
    s.ix[head & ((xx - cx) + (yy - cy) > r * .45)] = ix('d3')
    for bx in range(int(cx - r + 8), int(cx + r - 4), 7):
        s.ix[head[:, bx], bx] = ix('d3')
    # the tap: a brass spout and its key
    tx, ty = int(cx), int(cy + r * .45)
    for (dx, dy, k) in ((-2, 0, 'o4'), (-1, 0, 'o4'), (0, 0, 'o3'), (1, 0, 'o3'), (-1, 1, 'o3'), (0, 1, 'o2'),
                        (-1, 2, 'o3'), (0, 2, 'o2'), (-1, 3, 'o2'), (0, -1, 'o5'), (0, -2, 'o4'), (-1, -2, 'o5'), (1, -2, 'o3')):
        put(s, tx + dx, ty + dy, k)
    # the cradle: a wedge of oak under the cask either side
    for (wx0, wx1) in ((cx - r + 2, cx - r * .35), (cx + r * .35, cx + r - 2)):
        for y in range(int(cy + r * .72), H_ - m):
            for x in range(int(wx0), int(wx1)):
                if s.ix[y, x] == CLEAR:
                    s.ix[y, x] = ix('w3') if x < (wx0 + wx1) / 2 else ix('w2')
        hline(s, int(wx0), int(wx1) - 1, H_ - m - 1, 'w1')
    outline(s, dark={'d': 'd1'})
    return s




# ---------------------------------------------------------------- the bar
def counter(w=380, d=26, h=88, seed=6):
    """The bar: a front of upright boards (w3, seams w2, lit left edges w4), a lit top (w5) whose front lip is worn
    pale (w6) by elbows, and a dark kick board along the floor."""
    rng = random.Random(seed)
    m = 2
    s = new(w + 2 * m, d + h + 2 * m, (w + 2 * m) // 2, d + h + m - 1)
    x0, x1 = m, m + w
    ty0, ty1 = m, m + d
    foot = m + d + h - 1
    fill(s, x0, ty1, x1, foot + 1, 'w3')
    for bx in range(x0, x1, 16):
        vline(s, bx, ty1 + 6, foot - 8, 'w2')
        vline(s, bx + 1, ty1 + 6, foot - 8, 'w4')
    _grain(s, x0, ty1 + 6, x1, foot - 8, 'w2', rng, n=w // 5, horiz=False, step=.03)
    # a rail of moulding under the top, and the kick board
    fill(s, x0, ty1 + 5, x1, ty1 + 9, 'w4')
    hline(s, x0, x1 - 1, ty1 + 8, 'w2')
    fill(s, x0, foot - 8, x1, foot + 1, 'w2')
    hline(s, x0, x1 - 1, foot - 8, 'w4')
    # the top
    fill(s, x0, ty0, x1, ty1, 'w5')
    _grain(s, x0, ty0 + 1, x1, ty1, 'w4', rng, n=w // 6)
    for by in range(ty0 + 9, ty1 - 2, 9):
        hline(s, x0, x1 - 1, by, 'w4')
    hline(s, x0, x1 - 1, ty0, 'w6')
    fill(s, x0, ty1, x1, ty1 + 5, 'w4')
    hline(s, x0, x1 - 1, ty1, 'w6')
    # wet rings and wear where the mugs stand
    for _ in range(5):
        cx_, cy_ = rng.randint(x0 + 20, x1 - 20), rng.randint(ty0 + 5, ty1 - 6)
        for a_ in range(0, 360, 30):
            px_ = int(round(cx_ + 5 * math.cos(math.radians(a_))))
            py_ = int(round(cy_ + 2 * math.sin(math.radians(a_))))
            if get(s, px_, py_) == ix('w5'):
                put(s, px_, py_, 'w4')
    outline(s)
    return s


def back_counter(w=130, h=64, seed=12):
    """The low cupboard against the wall behind the bar, its top a cradle for the casks: two doors, a lit top."""
    rng = random.Random(seed)
    m = 2
    d = 14
    s = new(w + 2 * m, d + h + 2 * m, (w + 2 * m) // 2, d + h + m - 1)
    x0, x1 = m, m + w
    fill(s, x0, m + d, x1, m + d + h, 'w3')
    for (dx0, dx1) in ((x0 + 6, x0 + w // 2 - 3), (x0 + w // 2 + 3, x1 - 6)):
        fill(s, dx0, m + d + 8, dx1, m + d + h - 6, 'w2')
        hline(s, dx0, dx1 - 1, m + d + 8, 'w1')
        vline(s, dx0, m + d + 8, m + d + h - 7, 'w1')
        hline(s, dx0, dx1 - 1, m + d + h - 7, 'w4')
        vline(s, dx1 - 1, m + d + 8, m + d + h - 7, 'w4')
    _grain(s, x0, m + d, x1, m + d + h, 'w2', rng, n=w // 8, horiz=False)
    fill(s, x0, m, x1, m + d, 'w4')
    hline(s, x0, x1 - 1, m, 'w5')
    fill(s, x0, m + d, x1, m + d + 3, 'w4')
    hline(s, x0, x1 - 1, m + d, 'w5')
    outline(s)
    return s


def mug(kind='pewter'):
    """A tankard (pewter, lid hinge and handle) or a wooden cup (staves and a hoop). Anchor: its foot."""
    if kind == 'pewter':
        rows = [
            ".abbbbba..",
            "abccccbbaa",
            "abcddccba.a",
            "abcddccbaa.a",
            "abcddccba..a",
            "abccdccba.a.",
            "abcccccbaa..",
            "abbbbbbba...",
            ".aaaaaaa....",
        ]
        km = {'a': 't1', 'b': 't3', 'c': 't4', 'd': 't5'}
    else:
        rows = [
            ".aaaaaaa..",
            "abbbcbbba.",
            "abccbccbaa",
            "addddddda.a",
            "abccbccba.a",
            "abccbccbaa.",
            "addddddda..",
            ".aaaaaaa...",
        ]
        km = {'a': 'w1', 'b': 'd3', 'c': 'd4', 'd': 't3'}
    return tpx.Sprite.ascii(rows, km, ax=4, ay=len(rows) - 1)


def jug(seed=1):
    rows = [
        "...aaa....",
        "..abcba...",
        "..abcba.a.",
        ".abccdba.a",
        "abccddcba.a",
        "abccdddcba.a",
        "abcccdccbaa.",
        "abcccccbba..",
        ".abbbbbba...",
        "..aaaaaa....",
    ]
    km = {'a': 'x1', 'b': 'x2', 'c': 'x3', 'd': 'x4'} if seed % 2 else {'a': 'd1', 'b': 'd3', 'c': 'd4', 'd': 'd5'}
    return tpx.Sprite.ascii(rows, km, ax=5, ay=len(rows) - 1)


def bottle(kind='green'):
    rows = [
        "..aa..",
        "..ba..",
        "..ba..",
        ".abca.",
        "abccda",
        "abccda",
        "abccca",
        "abccca",
        "abccca",
        ".aaaa.",
    ]
    km = {'green': {'a': 'm0', 'b': 'm2', 'c': 'm2', 'd': 'm4'},
          'brown': {'a': 'w0', 'b': 'w3', 'c': 'w3', 'd': 'w5'},
          'clear': {'a': 's1', 'b': 's3', 'c': 's3', 'd': 's5'}}[kind]
    s = tpx.Sprite.ascii(rows, km, ax=3, ay=len(rows) - 1)
    put(s, 2, 4, km['d'])
    put(s, 2, 5, 'b5' if kind != 'brown' else 'w6')
    return s


def shelf(w=180, items=(), seed=7):
    """A wall shelf: a board on two brackets, with things standing on it. items: list of (sprite, x)."""
    m = 2
    s = new(w + 2 * m, 40, (w + 2 * m) // 2, 39)
    by = 22
    fill(s, m, by, m + w, by + 4, 'w4')
    hline(s, m, m + w - 1, by, 'w6')
    hline(s, m, m + w - 1, by + 3, 'w2')
    for bx in (m + 12, m + w - 18):
        for k in range(10):
            hline(s, bx, bx + max(1, 7 - k * 7 // 10), by + 4 + k, 'w3')
            put(s, bx, by + 4 + k, 'w4')
    for (sp, x) in items:
        s.blit(sp, m + x - sp.ax, by - sp.ay - 1)
    outline(s)
    return s


# ---------------------------------------------------------------- the bounty desk and its board
def notice_board(seed=8, w=150, h=100):
    """The board of notices: a framed board, papers pinned over each other, one with a sketched face and a seal."""
    rng = random.Random(seed)
    m = 2
    s = new(w + 2 * m, h + 2 * m, (w + 2 * m) // 2, h + 2 * m - 1)
    x0, y0, x1, y1 = m, m, m + w, m + h
    fill(s, x0, y0, x1, y1, 'w2')                      # the frame
    fill(s, x0 + 6, y0 + 6, x1 - 6, y1 - 6, 'w4')      # the boards behind
    for by in range(y0 + 6 + 15, y1 - 6, 15):
        hline(s, x0 + 6, x1 - 7, by, 'w3')
    hline(s, x0, x1 - 1, y0, 'w3')
    vline(s, x0, y0, y1 - 1, 'w3')
    hline(s, x0 + 6, x1 - 7, y0 + 6, 'w2')
    vline(s, x0 + 6, y0 + 6, y1 - 7, 'w2')
    papers = [(x0 + 12, y0 + 12, 34, 42, 'face'), (x0 + 52, y0 + 10, 38, 30, 'text'), (x0 + 96, y0 + 14, 42, 36, 'seal'),
              (x0 + 50, y0 + 46, 30, 40, 'text'), (x0 + 86, y0 + 54, 46, 30, 'text'), (x0 + 16, y0 + 60, 26, 28, 'text')]
    for (px_, py_, pw, ph_, kind) in papers:
        fill(s, px_, py_, px_ + pw, py_ + ph_, 'b4')
        hline(s, px_, px_ + pw - 1, py_, 'b5')
        vline(s, px_, py_, py_ + ph_ - 1, 'b5')
        vline(s, px_ + pw - 1, py_ + 1, py_ + ph_ - 1, 'b2')
        hline(s, px_ + 1, px_ + pw - 1, py_ + ph_ - 1, 'b2')
        # its shadow on the boards
        vline(s, px_ + pw, py_ + 2, py_ + ph_, 'w2')
        hline(s, px_ + 2, px_ + pw, py_ + ph_, 'w2')
        # a curled lower corner
        put(s, px_ + pw - 1, py_ + ph_ - 1, 'w4')
        put(s, px_ + pw - 2, py_ + ph_ - 1, 'b3')
        put(s, px_ + pw - 1, py_ + ph_ - 2, 'b3')
        if kind == 'face':
            # a sketched head: a hood, two eyes, a jaw, then lines of writing under it
            cx_, cy_ = px_ + pw // 2, py_ + 14
            for a_ in range(0, 360, 12):
                put(s, int(round(cx_ + 7 * math.cos(math.radians(a_)))), int(round(cy_ + 8 * math.sin(math.radians(a_)))), 'b1')
            put(s, cx_ - 3, cy_ - 1, 'w1'); put(s, cx_ + 2, cy_ - 1, 'w1')
            hline(s, cx_ - 2, cx_ + 1, cy_ + 4, 'b1')
            for ly in range(py_ + 27, py_ + ph_ - 3, 4):
                hline(s, px_ + 5, px_ + pw - 6 - rng.randint(0, 6), ly, 'b1')
            hline(s, px_ + 7, px_ + pw - 8, py_ + 3, 'x3')     # a red heading stroke
        else:
            for ly in range(py_ + 5, py_ + ph_ - 3, 4):
                x_ = px_ + 4
                while x_ < px_ + pw - 6:
                    run = rng.randint(3, 9)
                    hline(s, x_, min(px_ + pw - 5, x_ + run), ly, 'b2')
                    x_ += run + 2
            if kind == 'seal':
                cx_, cy_ = px_ + pw - 10, py_ + ph_ - 9
                for (dx, dy, k) in ((0, 0, 'x3'), (1, 0, 'x3'), (-1, 0, 'x2'), (0, 1, 'x2'), (1, 1, 'x2'), (0, -1, 'x4'),
                                    (1, -1, 'x3'), (-1, -1, 'x3'), (-1, 1, 'x1'), (2, 0, 'x2'), (2, -1, 'x3')):
                    put(s, cx_ + dx, cy_ + dy, k)
        # the pin
        put(s, px_ + pw // 2, py_ + 2, 'o4')
        put(s, px_ + pw // 2 + 1, py_ + 3, 'o2')
    outline(s)
    return s


def desk(seed=9):
    """The bounty desk: a writing table with an open ledger, an inkwell and quill, a strongbox, a hand bell."""
    rng = random.Random(seed)
    s = table(150, 26, 62, seed=seed, tone=4)
    # an open ledger: two pages and a red cover's edge, lines of names
    lx, ly = 18, 6
    fill(s, lx, ly, lx + 46, ly + 16, 'x2')
    fill(s, lx + 2, ly + 1, lx + 23, ly + 14, 'b4')
    fill(s, lx + 24, ly + 1, lx + 44, ly + 14, 'b5')
    vline(s, lx + 23, ly + 1, ly + 14, 'b2')
    for yy in range(ly + 3, ly + 13, 3):
        hline(s, lx + 4, lx + 20 - rng.randint(0, 5), yy, 'b2')
        hline(s, lx + 26, lx + 41 - rng.randint(0, 6), yy, 'b3')
    hline(s, lx, lx + 45, ly + 16, 'x1')
    # the inkwell and a quill standing in it
    ix_, iy_ = 76, 12
    fill(s, ix_, iy_, ix_ + 6, iy_ + 6, 'k0')
    put(s, ix_ + 1, iy_ + 1, 's3')
    hline(s, ix_, ix_ + 5, iy_ + 6, 'k1')
    for k in range(12):
        put(s, ix_ + 3 + k // 3, iy_ - k, 'b5' if k > 3 else 'b3')
        if k > 5:
            put(s, ix_ + 4 + k // 3, iy_ - k, 'b4')
    # the strongbox: iron-bound, a brass lock, sitting at the right end
    bx, by = 104, -6
    fill(s, bx, by + 6, bx + 30, by + 26, 'w2')
    fill(s, bx, by + 2, bx + 30, by + 8, 'w3')
    hline(s, bx, bx + 29, by + 2, 'w4')
    for vx in (bx + 4, bx + 25):
        vline(s, vx, by + 2, by + 25, 't3')
    hline(s, bx, bx + 29, by + 8, 't2')
    fill(s, bx + 13, by + 11, bx + 17, by + 16, 'o3')
    put(s, bx + 14, by + 11, 'o5')
    put(s, bx + 15, by + 14, 'k0')
    # a hand bell
    for (dx, dy, k) in ((0, 0, 'o2'), (1, 0, 'o3'), (2, 0, 'o3'), (3, 0, 'o2'), (-1, 0, 'o1'), (4, 0, 'o1'),
                        (0, -1, 'o4'), (1, -1, 'o4'), (2, -1, 'o3'), (3, -1, 'o2'), (1, -2, 'o4'), (2, -2, 'o3'),
                        (1, -3, 'w3'), (2, -3, 'w2'), (1, -4, 'w3'), (2, -4, 'w2'), (1, -5, 'w4')):
        put(s, 90 + dx, 20 + dy, k)
    outline(s)
    return s


def dog(seed=13):
    """A brown dog asleep on the boards, curled nose to tail: a domed back lit on the upper left, the head laid on
    the forepaws at the front, a dark ear, a pale muzzle, the tail curled round under the head. Anchor: its belly."""
    m = 2
    W_, H_ = 54 + 2 * m, 26 + 2 * m
    s = new(W_, H_, W_ // 2, H_ - m - 1)
    yy, xx = np.mgrid[0:H_, 0:W_].astype(float) + .5
    cx, cy = W_ / 2 + 3, H_ / 2 + 1
    body = tpx.cpx.ell_mask(W_, H_, cx, cy, 22, 10, xx, yy)
    s.ix[body] = ix('w4')
    s.ix[body & ((xx - cx) / 22 + (yy - cy) / 10 * 1.2 < -.45)] = ix('w5')
    s.ix[body & ((xx - cx) / 22 + (yy - cy) / 10 * 1.2 < -1.0)] = ix('w6')
    s.ix[body & ((yy - cy) > 5)] = ix('w3')
    s.ix[body & ((xx - cx) > 14) & ((yy - cy) > 0)] = ix('w2')
    # the haunch: a curve of shade where the hind leg folds
    hx, hy = cx + 9, cy + 1
    for a_ in range(200, 330, 8):
        put(s, int(round(hx + 8 * np.cos(np.radians(a_)))), int(round(hy + 6 * np.sin(np.radians(a_)))), 'w3')
    # the tail curled along the front of the body
    for k in range(18):
        x = int(round(cx + 16 - k * 1.6))
        y = int(round(cy + 8 + 1.6 * np.sin(k / 17 * np.pi)))
        put(s, x, y, 'w5' if k > 12 else 'w4')
        put(s, x, y + 1, 'w2')
    # the head on the forepaws, at the front left
    hc = (cx - 17, cy + 4)
    head = tpx.cpx.ell_mask(W_, H_, hc[0], hc[1], 8, 5.5, xx, yy)
    s.ix[head] = ix('w4')
    s.ix[head & ((xx - hc[0]) + (yy - hc[1]) < -3)] = ix('w5')
    muz = tpx.cpx.ell_mask(W_, H_, hc[0] - 6, hc[1] + 2, 4, 3, xx, yy)
    s.ix[muz] = ix('d5')
    s.ix[muz & (yy > hc[1] + 3)] = ix('d4')
    put(s, hc[0] - 9, hc[1] + 2, 'k0')                     # the nose
    hline(s, int(hc[0] - 4), int(hc[0] - 1), int(hc[1] - 1), 'w1')   # the shut eye
    for (dx, dy) in ((1, -5), (2, -5), (2, -4), (3, -4), (3, -3), (4, -3), (1, -4), (2, -3), (4, -2), (5, -2)):
        put(s, hc[0] + dx, hc[1] + dy, 'w2')               # the ear, laid back
    # forepaws under the chin
    for px_ in (hc[0] - 4, hc[0] + 2):
        hline(s, int(px_), int(px_) + 4, int(hc[1] + 5), 'd4')
        hline(s, int(px_), int(px_) + 4, int(hc[1] + 6), 'w3')
    outline(s, dark={'d': 'w0'})
    return s


def shackles():
    """A pair of irons on a short chain, hanging from a peg."""
    rows = [
        "....pp....",
        "....pq....",
        "....a.....",
        "...a.a....",
        "....a.....",
        "...a.a....",
        "....a.....",
        "..aaaaa...",
        ".ab...ba..",
        "ab.....ba.",
        "ab.....ba.",
        ".ab...ba..",
        "..abbba...",
        "...aaa....",
    ]
    s = tpx.Sprite.ascii(rows, {'a': 't2', 'b': 't4', 'p': 'w3', 'q': 'w1'}, ax=4, ay=0)
    return s
