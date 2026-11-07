"""Riverside Market's inn, by day: the common room as one 1280 x 720 pixel image at grain 1.

Built from the tavern's room kit so the two interiors are one style: shell (plaster, timbers, a window, the plank
floor, the window light), hearth (the chimney breast and its fire), props (counter, shelf, tables, stools, casks, mugs,
jugs) and folk (the background figure behind a counter). Those modules are a snapshot of dirs/ux-tavern, copied into
dirs/ux-town/room/ unchanged and never edited, so this board does not move when that folder does.

New here, on pal ramps, lit from the upper left, inked selout:
  - the bed alcove in the back wall: a box bed, its blanket turned back, a pillow, a curtain tied aside;
  - the board of room keys behind the counter, and bowls on the shelf under it;
  - the stew pot hung over the fire ("A bed, a fire, and a bowl of something hot.");
  - the innkeeper: the tavern kit's figure behind a counter with a new head (a linen coif, no beard) and a moss
    dress, so she is not Pine Crossing's barkeep.

The company are their 104 x 152 ComfyUI board sprites at exactly 1:1 with the kit's ink edge, never redrawn, standing
on the boards in front of the counter, as PxCamp stands them by the fire. The room's scale is the camp's (80 px a metre).

    room, info = render()        room.data_uri(), room.save(path)
    info['keeper'], info['counter'], info['alcove'], info['company'][id] = boxes (x, y, w, h) in screen px
"""
import os
import random
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'room'))
for _p in (os.path.dirname(HERE), os.path.join(os.path.dirname(HERE), 'px-camp')):   # room/tpx.py looks for these one level up
    if _p not in sys.path:
        sys.path.insert(1, _p)

import tpx  # noqa: E402
from tpx import W, H, FLOOR_Y, fy, ix, CLEAR, new, put, get, fill, hline, vline, outline  # noqa: E402
import shell as SH  # noqa: E402
import hearth as HE  # noqa: E402
import props as PR  # noqa: E402
import folk as FK  # noqa: E402
import interior as IN  # noqa: E402  (board_sprite, inked, _alpha_sprite, Room)

# ------------------------------------------------------------------ the room's plan (screen px)
WINDOW = (42, 196, 122, 250)                      # x0, x1, top, sill: the one window, upper left
POSTS = [(0, 18), (220, 238), (466, 484), (684, 702), (852, 870), (1262, 1280)]
BREAST = (260, 446)                               # the chimney breast's face
COUNTER = dict(x0=498, w=170, front=fy(1.6), d=26, h=88)
KEEPER_FOOT = (586, fy(.5) + 6)                 # +6: her apron's hem tucks under the counter's top, no plaster between
ALCOVE = (712, 840, 118)                          # x0, x1, the lintel's underside
FEET = {'roy': (60, 145), 'marcus': (58, 149), 'lilina': (58, 149)}          # px-camp/people.py
COMPANY_AT = {'lilina': (150, 572), 'roy': (276, 600), 'marcus': (404, 578)}


# ------------------------------------------------------------------ the shell, set out for the inn
def frame(a, rng):
    """The tie beam, the sole plate and the posts (shell.frame's pieces, set to this room's bays)."""
    for (x0, x1) in POSTS:
        SH._timber(a, x0, SH.BEAM_Y[1], x1, SH.SOLE_Y[0], rng, True)
    SH._timber(a, 0, SH.BEAM_Y[0], W, SH.BEAM_Y[1], rng, False)
    SH._timber(a, 0, SH.SOLE_Y[0], W, SH.SOLE_Y[1], rng, False)
    pts = []
    for (x0, x1) in POSTS:
        c = (x0 + x1) // 2 - 1
        pts += [(c, SH.BEAM_Y[1] - 9), (c, SH.SOLE_Y[0] + 6)]
    SH._pegs(a, [(x, y) for (x, y) in pts if 0 <= x < W - 1])


def hearth(a):
    """The tavern's hearth, set to this breast's width; no antlers (a pot hangs over the fire instead)."""
    x0, x1 = BREAST
    HE.X0, HE.X1 = x0, x1
    c = (x0 + x1) // 2
    HE.OPEN = (c - 54, c + 54, 208)
    HE.LINTEL = (c - 68, c + 68, 188, 208)
    HE.MANTEL = (c - 78, c + 78, 180, 188)
    HE.antlers = lambda: tpx.Sprite(1, 1, 0, 0)
    return HE.build(a)


# ------------------------------------------------------------------ new pieces
def alcove(a, rng):
    """A box bed in a recess of the back wall: the recess in shade (the left jamb throws its shadow in, the right jamb
    catches the light), a curtain rod, the bed's front board, a slate blanket turned back over a linen sheet, a
    pillow at the lit end, and a moss curtain tied aside at the right."""
    x0, x1, top = ALCOVE
    foot = SH.SOLE_Y[0]
    a[top:foot, x0:x1] = ix('b2')
    a[top:top + 10, x0:x1] = ix('b1')                       # under the lintel
    a[top:foot, x0:x0 + 9] = ix('b1')                       # the left jamb's shadow
    a[top:foot, x1 - 5:x1] = ix('b4')                       # the right jamb, lit
    a[top:foot, x1 - 6] = ix('b3')
    for y in range(top + 14, foot - 4, 13):                  # the recess's back boards
        a[y, x0 + 9:x1 - 6] = ix('b1')
    SH._timber(a, x0 - 8, top - 14, x1 + 8, top, rng, False)
    # the rod
    a[top + 4, x0 + 2:x1 - 2] = ix('w2')
    a[top + 5, x0 + 2:x1 - 2] = ix('w1')
    # the bed: front board, the blanket on top, the sheet turned back, a pillow
    bx0, bx1 = x0 + 4, x1 - 2
    by0, by1 = foot - 44, foot + 8                           # the board runs down over the sole plate
    a[by0:by1, bx0:bx1] = ix('w3')
    for y in range(by0 + 5, by1 - 3, 9):
        a[y, bx0 + 2:bx1 - 2] = ix('w2')
        a[y + 1, bx0 + 2:bx1 - 2] = ix('w4')
    a[by0, bx0:bx1] = ix('w5')
    a[by0 + 1, bx0:bx1] = ix('w4')
    a[by0:by1, bx0] = ix('w4')
    a[by0:by1, bx1 - 1] = ix('w2')
    a[by1 - 1, bx0:bx1] = ix('w1')
    a[by0:by1, bx0 - 1] = ix('w1')
    a[by0:by1, bx1] = ix('w1')
    # the mattress top, seen from above: the blanket over most of it, the sheet folded back at the pillow end
    my0 = by0 - 26
    for y in range(my0, by0):
        for x in range(bx0 + 1, bx1 - 1):
            a[y, x] = ix('s4' if y < my0 + 3 else 's3')
    for x in range(bx0 + 1, bx1 - 1):                       # a woven stripe, and the blanket's front hem
        a[my0 + 11, x] = ix('s2')
        a[my0 + 13, x] = ix('s2')
        a[by0 - 1, x] = ix('s2')
        if (x - bx0) % 14 in (6, 7) and x < bx1 - 4:
            a[by0, x] = ix('s2')                             # the hem droops over the board here and there
            a[by0 + 1, x] = ix('s1')
    for y in range(my0 + 1, by0 - 1):                        # creases, lit on the left
        for (cx_, k) in ((bx0 + 64, 's2'), (bx0 + 92, 's2')):
            xx = cx_ + (y - my0) // 7
            a[y, xx] = ix(k)
            a[y, xx - 1] = ix('s5')
    sx1 = bx0 + 44                                            # the sheet turned back over the blanket
    for y in range(my0, by0):
        for x in range(bx0 + 1, sx1):
            a[y, x] = ix('b5' if y < my0 + 2 else 'b4')
    for y in range(my0, by0):
        a[y, sx1] = ix('b3')
        a[y, sx1 + 1] = ix('s2')
    px0, px1, py0, py1 = bx0 + 6, bx0 + 34, my0 - 8, my0 + 10   # the pillow
    for y in range(py0, py1):
        for x in range(px0, px1):
            u = (x - px0) / (px1 - px0)
            v = (y - py0) / (py1 - py0)
            if (u < .06 or u > .94) and (v < .15 or v > .85):
                continue
            a[y, x] = ix('b5' if (u < .45 and v < .5) else ('b4' if u < .85 else 'b3'))
    for x in range(px0 + 1, px1 - 1):
        a[py0 - 1, x] = ix('b2')
        a[py1, x] = ix('b2')
    for y in range(py0 + 1, py1 - 1):
        a[y, px0 - 1] = ix('b2')
        a[y, px1] = ix('b2')
    a[py0 + 7, px0 + 8:px1 - 8] = ix('b3')                    # the dent where a head has been
    # the curtain at the right, gathered on the rod, tied back, falling to the floor
    cx0, cx1 = x1 - 32, x1 - 6
    tie = top + 76
    for y in range(top + 3, foot + 4):
        if y < tie:
            l, r = cx0 + (tie - y) // 10 - 8, cx1
        else:
            l, r = cx0 - (y - tie) // 6 + 4, cx1
        l = max(x0 + 12, min(cx0 + 2, l))
        for x in range(l, r):
            f = (x - l) % 6
            k = 'm4' if f == 0 else ('m3' if f < 4 else 'm2')
            if x == l:
                k = 'm5'
            a[y, x] = ix(k)
        a[y, l - 1] = ix('m0')
        a[y, r] = ix('m1')
    for x in range(cx0 - 2, cx1):                             # the tie-back
        a[tie, x] = ix('w2')
        a[tie + 1, x] = ix('w1')
    for x in range(cx0 - 8, cx1 + 1):                         # the gathered head on the rod
        if get_ok(a, x, top + 3):
            a[top + 2, x] = ix('m0')
    for y in range(foot, foot + 4):                           # the hem on the boards
        a[y, cx0 - 4:cx1] = np.where(np.arange(cx0 - 4, cx1) % 6 == 0, ix('m4'), ix('m2'))
    a[foot + 4, cx0 - 4:cx1] = ix('m0')
    return dict(box=(x0 - 8, top - 14, x1 - x0 + 16, foot + 8 - (top - 14)))


def get_ok(a, x, y):
    return 0 <= x < W and 0 <= y < H


def key_board():
    """The board of room keys: a pegged board, six iron keys on their pegs, a linen tag on each."""
    w, h = 108, 34
    s = new(w + 2, h + 22, (w + 2) // 2, h + 21)
    fill(s, 1, 1, w + 1, h + 1, 'w4')
    for y in range(8, h, 8):
        hline(s, 2, w - 1, y, 'w3')
    hline(s, 1, w, 1, 'w5')
    vline(s, 1, 1, h, 'w5')
    hline(s, 1, w, h, 'w2')
    vline(s, w, 1, h, 'w2')
    for i in range(6):
        kx = 10 + i * 18
        put(s, kx, 10, 'w1'); put(s, kx + 1, 10, 'w1')     # the peg
        put(s, kx, 9, 'w2')
        if i == 2:                                           # one hook stands empty: that room is taken
            continue
        for (dx, dy) in ((-2, 12), (-1, 11), (0, 11), (1, 11), (2, 11), (3, 12), (3, 13), (3, 14), (-2, 13), (-2, 14),
                         (-1, 15), (0, 15), (1, 15), (2, 15)):
            put(s, kx + dx, dy, 't3')                        # the bow
        put(s, kx - 1, 12, 't5'); put(s, kx - 1, 13, 't4')
        for y in range(16, 30):
            put(s, kx, y, 't3'); put(s, kx + 1, y, 't2')     # the shank
        put(s, kx, 16, 't4')
        fill(s, kx + 2, 25, kx + 5, 30, 't3')                # the bit
        put(s, kx + 2, 25, 't4')
        fill(s, kx - 6, 20, kx - 1, 27, 'b4')                # the tag
        hline(s, kx - 6, kx - 2, 20, 'b5')
        vline(s, kx - 2, 21, 26, 'b3')
        put(s, kx - 4, 23, 'w1'); put(s, kx - 4, 24, 'w1')   # its number, a stroke of ink
    outline(s, dark={'t': 't0', 'b': 'b1', 'w': 'w1'})
    return s


def bowl(tone='w'):
    """A turned bowl, 12 px across: a lit rim, a body stepping down its ramp. Anchor: its foot."""
    rows = [".aaaaaaaaaa.",
            "abbbbbbbbccd",
            ".bbbbbbbccd.",
            "..bbbbbccd..",
            "...dddddd..."]
    km = {'a': f'{tone}5', 'b': f'{tone}4', 'c': f'{tone}3', 'd': f'{tone}2'}
    s = tpx.Sprite.ascii(rows, km)
    s.ax, s.ay = 6, 4
    outline(s, dark={tone: f'{tone}1'})
    return s


def stew_pot():
    """The iron pot on its chain over the fire: a round belly lit on its upper left, a rim, a stub of steam."""
    w, h = 34, 30
    s = new(w, h, w // 2, h - 1)
    cx, cy = w // 2 - .5, 18
    yy, xx = np.mgrid[0:h, 0:w].astype(float) + .5
    belly = ((xx - cx) / 14.5) ** 2 + ((yy - cy) / 10.5) ** 2 <= 1
    belly &= yy > 9
    s.ix[belly] = ix('t2')
    s.ix[belly & ((xx - cx) + (yy - cy) * .8 < -6)] = ix('t3')
    s.ix[belly & ((xx - cx) + (yy - cy) * .8 < -11)] = ix('t4')
    s.ix[belly & ((xx - cx) - (yy - cy) * .6 > 7)] = ix('t1')
    fill(s, 2, 8, w - 2, 12, 't3')                          # the rim
    hline(s, 2, w - 3, 8, 't5')
    hline(s, 2, w - 3, 11, 't1')
    fill(s, 5, 6, w - 5, 8, 'h3')                            # the stew showing over the rim
    hline(s, 7, 14, 6, 'h4')
    for (x, y) in ((cx - 9, 3), (cx - 8, 2), (cx - 8, 1), (cx - 7, 0), (cx + 4, 3), (cx + 5, 2)):
        put(s, x, y, 'b5')                                   # a thread of steam
    for (x, y) in ((3, 13), (w - 4, 13)):                    # the lugs
        put(s, x, y, 't3')
    outline(s, dark={'t': 't0', 'h': 'h1', 'b': 'b3'})
    return s


INN_HEAD = [
    "......ccccccc......",
    "....cccCCCCCCdd....",
    "...ccCCCCCCCCCdd...",
    "..cCCCCCCCCCCCCdd..",
    "..cCCrrrrrrrrrCdD..",
    "..cCrSSSSSSSssrdD..",
    "..cCSSSSSSSSsssdD..",
    "..cCsekSSSkesssdD..",
    "..cCSSSSnnSSsssdD..",
    "..cCSSSSnnqSssqdD..",
    "..cCSSSSSSSssqqdD..",
    "...cSSSmmmmsqqqd...",
    "...ccSSSSSssqqdd...",
    "....ccqSSSsqqdd....",
    "......oSssqqo......",
    "......oSssqqo......",
]
INN_HEAD_KM = {'c': 'b5', 'C': 'b4', 'd': 'b3', 'D': 'b2', 'r': 'w3', 'S': 'f3', 's': 'f2', 'q': 'f1', 'e': 'k0',
               'k': 'b4', 'n': 'f3', 'm': 'x2', 'o': 'f0'}


def innkeeper():
    """The innkeeper behind her counter, from the chest up: the tavern kit's figure in a moss dress and linen apron,
    with a linen coif over her hair. Anchor: her feet's line, 140 px under the top of her head."""
    # the body is the kit's (its shirt ramp swapped to moss); the head is new
    s = FK.barkeep()
    m = np.isin(s.ix, tpx.cpx.ids('x'))
    for i in np.unique(s.ix[m]):
        k = tpx.pal.KEYS[i]
        n = int(k[1:])
        s.ix[s.ix == i] = ix(f'm{min(5, n + 1) if n else 0}')
    # clear the bald, bearded head (rows 0..18 of the sprite's head block) and set hers
    cx = s.w // 2
    s.ix[0:19, cx - 10:cx + 11] = CLEAR
    body_top = 13
    prof = {13: 7, 14: 10, 15: 13, 16: 15, 17: 17, 18: 18, 19: 19}
    for y in range(body_top, 19):
        hw = prof[y]
        for x in range(cx - hw, cx + hw):
            u = (x - (cx - hw)) / (2 * hw)
            put(s, x, y, 'm4' if u < .24 else ('m3' if u < .8 else 'm2'))
        put(s, cx - hw - 1, y, 'm0')
        put(s, cx + hw, y, 'm0')
    hline(s, cx - 7, cx + 6, body_top - 1, 'm0')
    for y in range(13, 19):                                  # the apron's straps
        put(s, cx - 8, y, 'b4')
        put(s, cx + 7, y, 'b3')
    hd = tpx.Sprite.ascii(INN_HEAD, INN_HEAD_KM)
    big = new(hd.w + 2, hd.h + 2)
    big.blit(hd, 1, 1)
    outline(big, dark={'b': 'b1', 'f': 'f0', 'w': 'w1', 'x': 'x0'})
    s.blit(big, cx - 10, -1)
    return s


# ------------------------------------------------------------------ the room
def render(seed=8):
    rng = random.Random(seed)
    a = np.zeros((H, W), np.uint8)
    SH.plaster(a, rng)
    frame(a, rng)
    win = SH.window(a, *WINDOW, rng)
    SH.floor(a, rng)
    al = alcove(a, rng)
    hinfo = hearth(a)
    # things fixed to the wall: the key board and the shelf of bowls behind the counter, each with its short shadow
    kb = key_board()
    kx, ky = 583 - kb.w // 2, 124
    IN._shadow_on_wall(a, kb, kx + 3, ky + 3)
    HE._blit(a, kb, kx, ky)
    items = [(bowl(), 10), (bowl(), 24), (bowl(), 38), (PR.jug(1), 62), (PR.jug(2), 80), (bowl(), 104), (bowl(), 118),
             (PR.mug('wood'), 140), (PR.mug('wood'), 154)]
    sp = PR.shelf(166, items)
    IN._shadow_on_wall(a, sp, 500 + 3, 214 - sp.ay + 3)
    HE._blit(a, sp, 500, 214 - sp.ay)
    # the pot over the fire, on a chain from the lintel
    fx_, fire_y = hinfo['fire']
    pot = stew_pot()
    px_, py_ = fx_ + 2, fire_y + 2
    for y in range(208, py_ - pot.h + 10):
        a[y, px_] = ix('t3' if y % 3 else 't1')
        a[y, px_ + 1] = ix('t1')
    HE._blit(a, pot, px_ - pot.ax, py_ - pot.ay)

    light = SH.window_light([(WINDOW, win)])
    a[light] = tpx.cpx.lut(1)[a[light]]
    st = tpx.Stage(a)

    def put_prop(spr, fx, fy_, z=None, shadow=True, zcap=None):
        st.add(spr, fx, fy_, z=z)
        if shadow:
            st.throw_sprite(spr, fx, fy_, zcap=zcap)

    # on the mantel: a jug and two bowls
    my = HE.MANTEL[2]
    for (sp_, x) in ((PR.jug(2), 300), (bowl(), 392), (bowl(), 406)):
        st.add(sp_, x, my - 1, z=HE.FRONT - 1)
    # the counter, the innkeeper behind it, a bowl and a tankard set out on it
    c = COUNTER
    put_prop(PR.counter(c['w'], c['d'], c['h'], seed=14), c['x0'] + c['w'] // 2, c['front'], zcap=24)
    top_y = c['front'] - c['h'] - c['d']
    st.add(innkeeper(), *KEEPER_FOOT)
    st.add(bowl(), 548, top_y + 14, z=c['front'] + .5)
    st.add(PR.mug('pewter'), 628, top_y + 16, z=c['front'] + .5)
    # a cask by the counter's end, a stool before it
    put_prop(PR.barrel(55), 476, fy(1.2))
    put_prop(PR.stool(seed=61), 690, fy(2.4))
    # the tables: one on the boards to the right, one further down under the offer window
    put_prop(PR.table(124, 28, 60, seed=71), 640, fy(7.2))
    st.add(bowl(), 612, fy(7.2) - 60 - 12, z=fy(7.2) + .5)
    st.add(PR.mug('wood'), 664, fy(7.2) - 60 - 10, z=fy(7.2) + .5)
    put_prop(PR.stool(seed=72), 560, fy(7.6))
    put_prop(PR.stool(seed=73), 724, fy(7.0))
    put_prop(PR.bench(200, seed=81), 1060, fy(6.6))
    put_prop(PR.table(220, 32, 60, seed=82), 1060, fy(7.8))
    put_prop(PR.bench(200, seed=83), 1060, fy(8.4))
    for (bx, by, sd) in ((1236, fy(4.4), 91), (1196, fy(4.0), 92)):
        put_prop(PR.barrel(sd), bx, by)
    # the company, at 1:1
    info = dict(alcove=al['box'], hearth=hinfo['box'], company={})
    for sid, (fx, fy_) in COMPANY_AT.items():
        spr = IN.board_sprite(sid)
        ox, oy = FEET[sid]
        x0, y0 = fx - ox, fy_ - oy
        st.add_rgba(IN.inked(spr), x0, y0, fy_)
        st.throw_sprite(IN._alpha_sprite(spr, foot=(ox, oy)), fx, fy_)
        info['company'][sid] = IN._sprite_box(spr, x0, y0)
    kp = innkeeper()
    info['keeper'] = IN._ix_box(kp, *KEEPER_FOOT, clip_y=top_y)
    info['counter'] = (c['x0'], top_y, c['w'], c['front'] - top_y)
    im = st.render()
    return IN.Room(im), info


if __name__ == '__main__':
    room, info = render()
    os.makedirs(os.path.join(HERE, 'z'), exist_ok=True)
    room.save(os.path.join(HERE, 'z', 'innroom.png'))
    room.save(os.path.join(HERE, 'z', 'innroom3.png'), zoom=3)
    print(info)
