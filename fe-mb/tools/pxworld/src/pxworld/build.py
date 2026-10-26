"""pxworld build: the map's buildings and crossings, in the map's 3/4 top-down view, outlined selout-style.

Grain 1 (one art px per screen px). Every builder returns a Sprite whose anchor is its foot on the ground.

  selout(s, lit=True, remap=None)   a 1 px outline in each part's own darkest step; one step lighter on the edges
                                    that face the light (top and left), so nothing is ringed in black
  cottage(w, ridge='ew'|'ns', ...)  a house. 'ew': the long roof slope, ridge line and front wall face the viewer;
                                    'ns': the gable end faces the viewer (two slopes split by the ridge, gable wall
                                    with its door). Two-tone slopes, overhanging eaves with a shadow line, a door,
                                    windows, a plinth, an optional chimney. roof: tile | tile2 | thatch | slate |
                                    shingle | blue; wall: plaster | stone | timber
  lhouse(w, wing_w, ...)            an E-W house with a N-S wing at one end whose gable faces the street
  barn(w, ridge, ...)               a timber barn: board walls, a wide low roof, big double doors
  waterwheel()                      a face-on undershot mill wheel, hand-pixelled (rim, spokes, paddles)
  awning_stall(cloth, goods)        a market stall under a striped awning, scalloped valance, laden counter
  well()                            a stone well with a little shingled roof on two posts and a winch
  timber_bridge(L, deck)            an E-W plank bridge: deck, rails, stringer, piers on cutwaters
  stone_bridge(L, run, ...)         a stone arch bridge rising 1 px per `run` px east, optionally broken
Ground painters (paint straight into a Canvas): cobbles(), yard(), garden(), fence(), ford(), water_shade()
"""
import math
import random

import numpy as np

from . import pal
from .canvas import Canvas, Sprite, nb, ring, ellipse, poly
from .pal import ix, CLEAR

# ---------------------------------------------------------------- selout
# (lit edge, shade edge) per ramp: the darkest steps, never the Ink ramp
OUT = {'r': ('r1', 'r0'), 'h': ('h1', 'h0'), 's': ('s1', 's0'), 'w': ('w1', 'w0'), 'b': ('w2', 'w1'),
       't': ('t2', 't1'), 'd': ('d1', 'd0'), 'o': ('o1', 'o0'), 'x': ('x1', 'x0'), 'm': ('m1', 'm0'),
       'l': ('l1', 'l0'), 'p': ('p1', 'p0'), 'a': ('a1', 'a0'), 'g': ('g1', 'g0'), 'k': ('k1', 'k0'),
       'f': ('f0', 'f0')}


def _table(remap, which):
    t = dict(OUT)
    t.update(remap or {})
    arr = np.full(256, CLEAR, np.uint8)
    for i in range(len(pal.KEYS)):
        arr[i] = ix(t[pal.RAMP_OF[i]][which])
    return arr


def selout(s, lit=True, remap=None, conn=4, holes=True):
    """Outline sprite s (which needs a 1 px clear margin) just outside its silhouette. Each outline pixel takes
    the darkest step of the ramp it borders: the pixel below or right of it first (so a roof's top edge is
    roof-coloured, a wall's foot wall-coloured). Edges facing the light (top, left) get the lighter of the two."""
    m = s.mask()
    if not holes:
        from scipy import ndimage
        m = ndimage.binary_fill_holes(m)
    big = np.zeros((s.h + 2, s.w + 2), bool)
    big[1:-1, 1:-1] = m
    r = ring(big, conn)[1:-1, 1:-1]
    src = s.ix.copy()
    tl, td = _table(remap, 0), _table(remap, 1)
    for (dx, dy, faces_light) in ((0, 1, True), (1, 0, True), (-1, 0, False), (0, -1, False)):
        v = nb(src, dx, dy, CLEAR)
        pick = r & (v != CLEAR) & (s.ix == CLEAR)
        s.ix[pick] = (tl if (lit and faces_light) else td)[v[pick]]
    return s


def K(k):
    return k


# ---------------------------------------------------------------- materials
ROOF = {
    # back slope (lit), its far eave, ridge cap, front slope tile face / course shadow / joint, fascia (eave
    # underside), west and east barge ends; N-S planes: west (lit) a/b, east (shade) a/b
    'tile': dict(back='r5', far='r4', cap='r5', fa='r4', fb='r3', jt='r3', fas='r1', we='r4', ee='r2',
                 wa='r5', wb='r4', ea='r3', eb='r2', val='r2'),
    'tile2': dict(back='r4', far='r3', cap='r4', fa='r3', fb='r2', jt='r2', fas='r1', we='r3', ee='r1',
                  wa='r4', wb='r3', ea='r2', eb='r1', val='r1'),
    'thatch': dict(back='h5', far='h4', cap='h5', fa='h4', fb='h3', jt='h2', fas='h1', we='h4', ee='h2',
                   wa='h5', wb='h4', ea='h3', eb='h2', val='h2'),
    'slate': dict(back='t5', far='t4', cap='t5', fa='t4', fb='t3', jt='t3', fas='t1', we='t4', ee='t2',
                  wa='t5', wb='t4', ea='t3', eb='t2', val='t2'),
    'blue': dict(back='s4', far='s3', cap='s4', fa='s3', fb='s2', jt='s2', fas='s1', we='s3', ee='s1',
                 wa='s4', wb='s3', ea='s2', eb='s1', val='s1'),
    'shingle': dict(back='w6', far='w5', cap='w6', fa='w5', fb='w4', jt='w3', fas='w2', we='w5', ee='w3',
                    wa='w6', wb='w5', ea='w4', eb='w3', val='w3'),
}
WALL = {
    'plaster': dict(face='b4', shade='b3', lit='b5', frame='w3', plinth='t3', joint='t2', remap={'b': ('w2', 'w1')}),
    'stone': dict(face='t4', shade='t3', lit='t5', frame='t3', plinth='t3', joint='t2', remap=None),
    'timber': dict(face='w4', shade='w3', lit='w5', frame='w2', plinth='t3', joint='t2', remap=None),
    'boards': dict(face='w5', shade='w3', lit='w6', frame='w3', plinth='t3', joint='t2', remap=None),
}


def _put(s, x, y, k):
    if 0 <= x < s.w and 0 <= y < s.h:
        s.ix[y, x] = ix(k)


def _get(s, x, y):
    if 0 <= x < s.w and 0 <= y < s.h:
        return int(s.ix[y, x])
    return CLEAR


def _key(i):
    return pal.KEYS[i]


# ---------------------------------------------------------------- wall details
def _window(s, x, y, wall, shutters=False):
    """A 2x2 casement: dark glass, a glint top-left, a lit sill below."""
    _put(s, x, y, 's3'); _put(s, x + 1, y, 's1')
    _put(s, x, y + 1, 's1'); _put(s, x + 1, y + 1, 's0')
    if wall == 'plaster':
        _put(s, x, y + 2, 'b5'); _put(s, x + 1, y + 2, 'b5')
    if shutters:
        _put(s, x - 1, y, 'x2'); _put(s, x - 1, y + 1, 'x2')
        _put(s, x + 2, y, 'x2'); _put(s, x + 2, y + 1, 'x1')


def _door(s, x, y_foot, dw, dh):
    """A plank door standing on the plinth: shadowed head, boards, a darker edge on the hinge side."""
    for j in range(dh):
        for i in range(dw):
            k = 'w2'
            if j == 0:
                k = 'w0'
            elif i == dw - 1 and dw > 1:
                k = 'w1'
            _put(s, x + i, y_foot - dh + j, k)


def _wall_face(s, x0, y0, w, h, wall, seed, top_shadow=True):
    """A wall face w x h at (x0, y0): its top row in the eave's shadow, a plinth row at the foot."""
    W = WALL[wall]
    rng = random.Random(seed)
    for j in range(h):
        for i in range(w):
            k = W['face']
            if j == 0 and top_shadow:
                k = W['shade']
            elif j == h - 1:
                k = W['plinth'] if (i + 1) % 4 else W['joint']
            elif wall == 'stone':
                # coursed blocks: a mortar line every 2 rows, staggered joints, each block's top lit
                row = j - 1
                u = (i + (row // 2) * 2) % 4
                if row % 2 == 1:
                    k = W['shade']
                elif u == 3:
                    k = W['shade']
                elif u < 2:
                    k = W['lit']
            elif wall == 'timber':
                k = 'w4' if i % 2 == 0 else 'w3'
                if j == 1 and i % 2 == 0:
                    k = 'w5'
            elif wall == 'boards':
                k = 'w5' if i % 3 else 'w4'
                if j == 1:
                    k = 'w4' if i % 3 else 'w3'
            _put(s, x0 + i, y0 + j, k)
    if wall == 'plaster' and w >= 9:
        # corner posts and the sill beam of the timber frame
        for j in range(1, h - 1):
            _put(s, x0, y0 + j, W['frame'])
            _put(s, x0 + w - 1, y0 + j, W['frame'])
        for i in range(w):
            if _get(s, x0 + i, y0 + h - 2) == ix(W['face']):
                pass


def _roof_ew(S, ox, oy, RW, yr, yf, roof, seed=0):
    """An E-W gabled roof: far eave, lit back slope, ridge cap with its shadow line, front slope in courses
    (tiles: staggered joints; thatch: vertical straw strokes), the fascia under the front eave."""
    R = ROOF[roof]
    for x in range(RW):
        for y in range(oy, yf + 1):
            if y == oy:
                k = R['far']
            elif y < yr:
                k = R['back']
            elif y == yr:
                k = R['cap']
                if roof == 'thatch':
                    k = R['cap'] if x % 2 else R['back']
                elif 1 < x < RW - 2 and x % 3 == 1:
                    k = R['far']                       # ridge tile joints
            elif y == yr + 1:
                k = R['val']                           # the shadow under the ridge cap
            elif y == yf:
                k = R['fas']
            else:
                j = y - yr - 2
                if roof == 'thatch':
                    band = j // 2
                    k = R['fb'] if (x + band * 2 + seed) % 3 == 0 else R['fa']
                else:
                    if j % 2 == 0:
                        k = R['jt'] if (x + (j // 2) * 2 + seed) % 4 == 0 else R['fa']
                    else:
                        k = R['fb']
            if x == 0 and oy < y < yf and y != yr + 1:
                k = R['we']
            if x == RW - 1 and oy < y < yf:
                k = R['ee']
            _put(S, ox + x, y, k)


def _ragged_eave(S, ox, y, RW, roof):
    """Thatch hangs over the eave in a ragged fringe, its shadow on the wall."""
    if roof != 'thatch':
        return
    for x in range(1, RW - 1):
        if x % 2 == 0:
            _put(S, ox + x, y, ROOF[roof]['jt'])


# ---------------------------------------------------------------- doors for barns
def _barn_door(S, x, foot, dw, dh, open_=False):
    """Double plank doors: two leaves split down the middle, a lit board on each, a dark head."""
    for j in range(dh):
        for i in range(dw):
            k = 'w2'
            if j == 0:
                k = 'w0'
            elif open_:
                k = 'w0' if j < 2 else 'w1'
            elif i == dw // 2 and dw % 2 == 1:
                k = 'w0'
            elif i in (0, dw - 1):
                k = 'w1'
            elif (i - j) % (dw // 2 + 1) == 0 and i < dw // 2 or (i + j) % (dw // 2 + 1) == 0 and i > dw // 2:
                k = 'w3'                               # the diagonal braces
            _put(S, x + i, foot - dh + j, k)


# ---------------------------------------------------------------- the two house bodies, drawn into a sprite
def _ew(S, ox, oy, w, d, h, roof, wall, seed=0, door='auto', windows=None, chimney=None, back=False,
        shutters=False):
    """Draw an E-W house with its roof's far eave at row oy and its west roof edge at column ox."""
    rng = random.Random(seed)
    RW = w + 2
    rb = max(2, int(round(d * .3)))
    rf = d - rb - 2
    yr = oy + rb
    yf = yr + rf + 1
    _roof_ew(S, ox, oy, RW, yr, yf, roof, seed)
    wy = yf + 1
    _wall_face(S, ox + 1, wy, w, h, wall, seed)
    _ragged_eave(S, ox, wy, RW, roof)
    foot = wy + h - 1
    doors = []
    if door and not back:
        if door == 'barn':
            dw = 5 if w >= 14 else 4
            dh = min(h - 1, 5)
            dx = ox + 1 + (w - dw) // 2
            _barn_door(S, dx, foot, dw, dh)
            doors.append((dx, dw))
        else:
            dw = 2 if w >= 10 else 1
            dh = min(h - 2, 4)
            dx = ox + 1 + (w // 2 - dw // 2 + rng.choice((-2, -1, 1, 2)) if door == 'auto' else door)
            dx = max(ox + 2, min(ox + w - dw - 1, dx))
            _door(S, dx, foot, dw, dh)
            doors.append((dx, dw))
    nwin = windows if windows is not None else (2 if w >= 13 else 1)
    if h >= 5 and nwin:
        wyy = wy + 1 + (1 if h >= 6 else 0)
        spots = []
        if doors:
            dx, dw = doors[0]
            left = list(range(ox + 3, dx - 3))
            right = list(range(dx + dw + 2, ox + w - 2))
            if left:
                spots.append(left[len(left) // 2])
            if right and (nwin >= 2 or not left):
                spots.append(right[len(right) // 2])
            if nwin >= 3 and len(left) > 6:
                spots = [left[1], left[-2]] + spots[1:]
        else:
            n = max(1, nwin)
            for i in range(n):
                spots.append(ox + 1 + int(round((i + 1) * w / (n + 1))) - 1)
        for sx in spots[:max(1, nwin)]:
            _window(S, sx, wyy, wall, shutters)
    cpos = None
    if chimney:
        cx = ox + (RW - 5 if chimney == 'e' else 3)
        for y in range(oy - 3, yr):
            _put(S, cx, y, 't5'); _put(S, cx + 1, y, 't3')
        _put(S, cx, oy - 3, 't6'); _put(S, cx + 1, oy - 3, 't4')
        _put(S, cx, oy - 1, 't4'); _put(S, cx + 1, oy - 1, 't2')
        cpos = (cx, oy - 4)
    return dict(yr=yr, yf=yf, foot=foot, wy=wy, RW=RW, chimney=cpos, doors=doors)


def _ns(S, ox, oy, w, L, h, roof, wall, seed=0, door='auto', windows=None, chimney=None, back=False,
        shutters=False, pitch=1, valley=False):
    """Draw a N-S (gable to the viewer) house with the roof's apex at row oy and its west eave at column ox."""
    R = ROOF[roof]
    Wl = WALL[wall]
    RW = w + 2
    c = RW // 2
    Rr = c if pitch == 1 else (c + 1) // 2

    def yt(i):
        dist = abs(i - c)
        return dist if pitch == 1 else (dist + 1) // 2

    base = oy + Rr + L + h
    for i in range(RW):
        y0 = oy + yt(i)
        for j in range(L):
            if i < c:
                k = R['wa'] if (c - i) % 2 == 1 else R['wb']
                if roof == 'thatch':
                    k = R['wb'] if (j % 3 == 1 and (i + j // 3) % 4 < 3) else R['wa']
            elif i == c:
                k = R['cap']
            else:
                k = R['ea'] if (i - c) % 2 == 1 else R['eb']
                if roof == 'thatch':
                    k = R['eb'] if (j % 3 == 1 and (i + j // 3) % 4 < 3) else R['ea']
            if j == 0 and i != c:
                k = R['val'] if valley else (R['far'] if i < c else R['eb'])
            _put(S, ox + i, y0 + j, k)
        _put(S, ox + i, y0 + L, R['jt'] if i <= c else R['fas'])      # the front bargeboards
    for j in range(1, L):
        _put(S, ox + c + 1, oy + yt(c + 1) + j, R['eb'])             # the ridge's shaded flank
    for i in range(1, RW - 1):
        ytop = oy + yt(i) + L + 1
        for y in range(ytop, base + 1):
            k = Wl['face']
            if y == ytop:
                k = Wl['shade']
            elif y == base:
                k = Wl['plinth'] if i % 4 else Wl['joint']
            elif wall == 'timber':
                k = 'w4' if i % 2 == 0 else 'w3'
                if y == ytop + 1 and i % 2 == 0:
                    k = 'w5'
            elif wall == 'boards':
                k = 'w5' if i % 3 else 'w4'
            elif wall == 'stone':
                row = base - 1 - y
                u = (i + (row // 2) * 2) % 4
                if row % 2 == 1:
                    k = Wl['shade']
                elif u == 3:
                    k = Wl['shade']
                elif u < 2:
                    k = Wl['lit']
            _put(S, ox + i, y, k)
    if roof == 'thatch':
        for i in range(1, RW - 1):
            if i % 2 == 0:
                _put(S, ox + i, oy + yt(i) + L + 1, R['jt'])
    eave = oy + yt(1) + L + 1
    if wall == 'plaster':
        for i in range(1, RW - 1):
            if _get(S, ox + i, eave + 1) != CLEAR:
                _put(S, ox + i, eave + 1, Wl['frame'])
        for y in range(eave + 1, base):
            _put(S, ox + 1, y, Wl['frame']); _put(S, ox + RW - 2, y, Wl['frame'])
    if Rr >= 3:
        _put(S, ox + c, oy + Rr + L - 1 + (1 if pitch == 2 else 0), 'w1')
    sp = []
    if door and not back:
        if door == 'barn':
            dw = 5 if w >= 13 else 3
            dh = min(base - eave - 1, 5)
            _barn_door(S, ox + c - dw // 2, base, dw, dh)
        else:
            dw = 2 if w >= 9 else 1
            dh = min(base - eave - 2, 4)
            off = 0 if door == 'auto' else door
            _door(S, ox + c - (dw // 2) + off, base, dw, dh)
            if w >= 11 and windows != 0:
                sp = [ox + 3, ox + RW - 5]
    elif windows != 0:
        sp = [ox + c - 1]
    wy = eave + 2
    if base - wy >= 3:
        for sx in sp:
            _window(S, sx, wy, wall, shutters)
    cpos = None
    if chimney:
        cx = ox + (c + 2 if chimney == 'e' else c - 3)
        yc = oy + yt(cx - ox) + 1
        for y in range(yc - 3, yc + 2):
            _put(S, cx, y, 't5'); _put(S, cx + 1, y, 't3')
        _put(S, cx, yc - 3, 't6'); _put(S, cx + 1, yc - 3, 't4')
        cpos = (cx, yc - 4)
    return dict(base=base, c=c, eave=eave, RW=RW, chimney=cpos, Rr=Rr)


def _finish(S, ax, ay, chim, remap):
    selout(S, remap=remap)
    S.ax, S.ay = ax, ay
    T = S.trimmed()
    T.chimney = (chim[0] - ax + 1, chim[1] - ay) if chim else None    # smoke start, relative to the foot
    return T


# ---------------------------------------------------------------- the public builders
def cottage(w=14, ridge='ew', roof='tile', wall='plaster', d=None, h=None, chimney=None, door='auto',
            windows=None, seed=0, back=False, shutters=False, pitch=1):
    """A house in 3/4 view, w wall px wide (the roof overhangs 1 px each side).
    ridge 'ew': far eave, lit back slope, ridge cap + its shadow, front slope in courses, eave fascia, front
    wall with door and windows on a stone plinth. d = roof rows on screen (default 9).
    ridge 'ns': the gable end to the viewer: lit west slope, ridge, shaded east slope, bargeboards over the
    gable wall. w odd keeps the apex one pixel. d = roof length on screen (default 8). pitch 1 = 1:1, 2 = 2:1.
    door: 'auto' | 'barn' | an x offset | None. chimney: None | 'w' | 'e'. back=True draws the rear wall of a
    house fronting a street to its north (windows, no door). Foot = middle of the front wall's base.
    The sprite carries .chimney = (dx, dy) of the smoke start from the foot, or None."""
    h = h or (6 if ridge == 'ew' else 5)
    RW = w + 2
    if ridge == 'ew':
        d = d or 9
        S = Sprite(RW + 2, 4 + d + h + 2)
        info = _ew(S, 1, 4, w, d, h, roof, wall, seed, door, windows, chimney, back, shutters)
        return _finish(S, 1 + RW // 2, info['foot'], info['chimney'], WALL[wall]['remap'])
    L = d or 8
    c = RW // 2
    Rr = c if pitch == 1 else (c + 1) // 2
    S = Sprite(RW + 2, 4 + Rr + L + h + 3)
    info = _ns(S, 1, 4, w, L, h, roof, wall, seed, door, windows, chimney, back, shutters, pitch)
    return _finish(S, 1 + c, info['base'], info['chimney'], WALL[wall]['remap'])


def lhouse(w=16, wing_w=9, side='e', proj=3, roof='tile', wall='plaster', d=9, h=6, chimney=None, seed=0,
           wing_roof=None, wing_wall=None):
    """An E-W house with a N-S wing at its east or west end whose gable comes forward toward the street by
    `proj` px. The wing's roof rises out of the main roof's front slope (a valley line marks the join).
    Foot = middle of the main front wall's base."""
    RW = w + 2
    S = Sprite(RW + 4, 4 + d + h + proj + 8)
    ox, oy = 2, 4
    info = _ew(S, ox, oy, w, d, h, roof, wall, seed, door=None, windows=0, chimney=chimney)
    yr, yf, foot = info['yr'], info['yf'], info['foot']
    ww = wing_w if wing_w % 2 else wing_w + 1
    WRW = ww + 2
    c = WRW // 2
    L = max(3, (yf - yr) + proj - c + 1)
    wx = ox + (RW - WRW if side == 'e' else 0)
    _ns(S, wx, yr, ww, L, h, wing_roof or roof, wing_wall or wall, seed + 1, door=None, windows=None,
        back=True, valley=True)
    # the door and a window on the main front, in the bay beside the wing
    bay0, bay1 = (ox + 2, wx - 1) if side == 'e' else (wx + WRW + 1, ox + RW - 2)
    if bay1 - bay0 >= 4:
        dx = bay0 + (bay1 - bay0) // 2 - 1 + (1 if side == 'e' else -1)
        _door(S, dx, foot, 2, min(h - 2, 4))
        wxs = dx - 4 if side == 'e' else dx + 4
        if bay0 + 1 <= wxs <= bay1 - 2 and bay1 - bay0 >= 8:
            _window(S, wxs, info['wy'] + 2, wall)
    return _finish(S, ox + RW // 2, foot, info['chimney'], WALL[wall]['remap'])


def barn(w=17, ridge='ns', roof='thatch', d=9, h=7, seed=0):
    """A timber barn: board walls, a low wide roof (2:1 when the gable faces the street), big double doors."""
    if ridge == 'ns':
        return cottage(w, 'ns', roof, 'boards', d=d, h=h, door='barn', seed=seed, pitch=2, windows=0)
    return cottage(w, 'ew', roof, 'boards', d=d, h=h, door='barn', seed=seed, windows=0)


# ---------------------------------------------------------------- market and yard pieces
AWN = {'red': ('x4', 'x3', 'x2'), 'blue': ('s4', 's3', 's2'), 'ochre': ('o4', 'o3', 'o2'), 'green': ('m4', 'm3', 'm2')}
GOODS = {'apples': ('x4', 'x3', 'l4'), 'cloth': ('s4', 'o4', 'x4'), 'bread': ('h4', 'h3', 'o5'),
         'pots': ('r4', 'r3', 't4'), 'greens': ('l5', 'l4', 'h4'), 'fish': ('t5', 's4', 't4')}


def awning_stall(cloth='red', goods='apples', w=11):
    """A market stall seen from above and the south: a striped awning sloping toward the street (bands down the
    slope, cloth and bone), a scalloped valance, two posts, a counter heaped with goods. Foot = counter base."""
    A1, A2, A3 = AWN[cloth]
    g1, g2, g3 = GOODS[goods]
    H = 10
    S = Sprite(w + 2, H + 2)
    ox, oy = 1, 1
    for y in range(4):                       # the awning: 4 rows, lit at the back
        for x in range(w):
            band = (x // 2) % 2 == 0
            if y < 2:
                k = A1 if band else 'b5'
            else:
                k = A2 if band else 'b4'
            _put(S, ox + x, oy + y, k)
    for x in range(w):                       # the valance, scalloped: a tab under every band
        if x % 2 == 0:
            _put(S, ox + x, oy + 4, A3 if (x // 2) % 2 == 0 else 'b3')
    for y in range(5, H - 1):                # posts
        _put(S, ox + 1, oy + y, 'w4'); _put(S, ox + w - 2, oy + y, 'w3')
    for x in range(1, w - 1):                # counter top, counter front
        _put(S, ox + x, oy + 6, 'w5')
        _put(S, ox + x, oy + 7, 'w4' if x % 3 else 'w3')
        _put(S, ox + x, oy + 8, 'w3')
    for x in range(2, w - 2):                # the goods heaped on the counter
        k = (g1, g2, g1, g3)[(x * 3) % 4]
        _put(S, ox + x, oy + 5, k)
        if x % 3 == 0:
            _put(S, ox + x, oy + 6, g2)
    selout(S, remap={'b': ('b1', 'w1')})
    S.ax, S.ay = ox + w // 2, oy + 8
    return S.trimmed()


WELL = [
    "..rRRRr..",
    ".rRRRRRr.",
    "rrrrrrrrr",
    ".p..k..q.",
    ".p..k..q.",
    "tTTTTTTTs",
    "TaaaaaaaS",
    "tTTTTTTTs",
    ".tTtTtTs.",
]


def well():
    """The market well: a coursed stone ring, dark water, a winch rope under a little shingled roof."""
    km = {'r': 'w4', 'R': 'w6', 'p': 'w4', 'q': 'w2', 'k': 'b2', 't': 't4', 'T': 't5', 's': 't3', 'S': 't3',
          'a': 'a1'}
    S = Sprite(11, len(WELL) + 2)
    for y, row in enumerate(WELL):
        for x, ch in enumerate(row):
            if ch != '.':
                _put(S, 1 + x, 1 + y, km[ch])
    _put(S, 2, 7, 't6')
    selout(S)
    S.ax, S.ay = 5, len(WELL)
    return S.trimmed()


def cobbles(cv, m, x0, y0, tones=('t5', 't4', 't3', 't2')):
    """Pave bool mask m (placed at x0, y0) with cobbles: setts 3 px wide and 2 rows tall in staggered courses,
    each lit on its top-left pixel, set in darker mortar. The north and west lips of the paving sit in shadow,
    the south kerb catches the light."""
    lit, face, mortar, dark = [ix(k) for k in tones]
    H, W = m.shape
    for j in range(H):
        for i in range(W):
            if not m[j, i]:
                continue
            X, Y = x0 + i, y0 + j
            course = Y // 3
            u = (X + course * 2) % 4
            v = Y % 3
            if v == 2 or u == 3:
                k = mortar
            elif v == 0 and u < 2:
                k = lit
            else:
                k = face
            if 0 <= X < cv.w and 0 <= Y < cv.h:
                cv.ix[Y, X] = k
    e_n = m & ~nb(m, 0, -1, False)
    e_w = m & ~nb(m, -1, 0, False)
    e_s = m & ~nb(m, 0, 1, False)
    for (msk, k) in ((e_s, lit), (e_n | e_w, dark)):
        ys, xs = np.nonzero(msk)
        for yy, xx in zip(ys, xs):
            if 0 <= x0 + xx < cv.w and 0 <= y0 + yy < cv.h:
                cv.ix[y0 + yy, x0 + xx] = k


def yard(cv, x, y, w, h, base='d4', seed=0, pebbles=True):
    """A small packed-earth yard, corners cut; its north and west lips in shadow, a lit south lip."""
    m = np.ones((h, w), bool)
    m[0, 0] = m[0, -1] = m[-1, 0] = m[-1, -1] = False
    b = ix(base)
    for j in range(h):
        for i in range(w):
            if m[j, i]:
                cv.put(x + i, y + j, base)
    e_n = m & (~nb(m, 0, -1, False) | ~nb(m, -1, 0, False))
    e_s = m & ~nb(m, 0, 1, False) & ~e_n
    for (msk, n) in ((e_n, -1), (e_s, 1)):
        ys, xs = np.nonzero(msk)
        for yy, xx in zip(ys, xs):
            cv.put(x + xx, y + yy, pal.KEYS[pal.shift_index(b, n)])
    if pebbles and w > 5 and h > 5:
        rng = random.Random(seed)
        for _ in range(max(1, w * h // 40)):
            px, py = x + rng.randint(2, w - 3), y + rng.randint(2, h - 4)
            cv.put(px, py, pal.KEYS[pal.shift_index(b, 1)])
            cv.put(px, py + 1, pal.KEYS[pal.shift_index(b, -1)])
    return m


def garden(cv, x, y, w, h, crop='greens'):
    """A kitchen garden: E-W rows of plants on dark tilled soil, each plant lit on its top pixel."""
    plant = {'greens': ('l5', 'l4', 'l3'), 'cabbage': ('m5', 'm4', 'm3'), 'beans': ('l6', 'l4', 'l3'),
             'flowers': ('x5', 'l4', 'l3')}[crop]
    for j in range(h):
        for i in range(w):
            cv.put(x + i, y + j, 'd4' if j % 3 != 2 else 'd3')
        if j % 3 == 0 and j + 1 < h:
            for i in range((j // 3) % 2, w - 1, 3):
                top = plant[0]
                if crop == 'flowers' and (i // 3 + j // 3) % 3 == 2:
                    top = 'o5'
                cv.put(x + i, y + j, top)
                cv.put(x + i + 1, y + j, plant[1])
                cv.put(x + i, y + j + 1, plant[1])
                cv.put(x + i + 1, y + j + 1, plant[2])


GROUNDS = None


def _ground_ids():
    global GROUNDS
    if GROUNDS is None:
        GROUNDS = set(i for r in ('g', 'd', 'h') for i in pal.RAMP[r])
    return GROUNDS


def fence(cv, a, b, post=3, shadow=True):
    """A post-and-rail fence along an axis-aligned run a -> b (art px, the ground line). Posts are lit on top,
    the rail rides one pixel above the ground, and the fence throws a hard shadow one step down to the SE."""
    (x0, y0), (x1, y1) = a, b
    gr = _ground_ids()
    if y0 == y1:
        xs = list(range(min(x0, x1), max(x0, x1) + 1))
        if shadow:
            for x in xs:
                v = cv.get(x + 1, y0 + 1)
                if v in gr:
                    cv.ix[y0 + 1, x + 1] = pal.shift_index(v, -1)
        for x in xs:
            if (x - xs[0]) % post == 0 or x == xs[-1]:
                cv.put(x, y0 - 2, 'w5'); cv.put(x, y0 - 1, 'w3'); cv.put(x, y0, 'w2')
            else:
                cv.put(x, y0 - 1, 'w4')
    else:
        ys = list(range(min(y0, y1), max(y0, y1) + 1))
        if shadow:
            for y in ys:
                v = cv.get(x0 + 1, y)
                if v in gr:
                    cv.ix[y, x0 + 1] = pal.shift_index(v, -1)
        for y in ys:
            if (y - ys[0]) % post == 0 or y == ys[-1]:
                cv.put(x0, y - 2, 'w5'); cv.put(x0, y - 1, 'w3'); cv.put(x0, y, 'w2')
            else:
                cv.put(x0, y - 1, 'w4')


def fence_ring(cv, x0, y0, x1, y1, gaps=(), post=3):
    """Fence a rectangle (ground lines), leaving gaps: a list of ('n'|'s'|'e'|'w', from, to) spans."""
    def cut(side, lo, hi):
        spans = [(lo, hi)]
        for (s_, a_, b_) in gaps:
            if s_ != side:
                continue
            out = []
            for (p, q) in spans:
                if b_ < p or a_ > q:
                    out.append((p, q))
                else:
                    if a_ - 1 >= p:
                        out.append((p, a_ - 1))
                    if b_ + 1 <= q:
                        out.append((b_ + 1, q))
            spans = out
        return spans
    for (p, q) in cut('n', x0, x1):
        fence(cv, (p, y0), (q, y0), post)
    for (p, q) in cut('w', y0, y1):
        fence(cv, (x0, p), (x0, q), post)
    for (p, q) in cut('e', y0, y1):
        fence(cv, (x1, p), (x1, q), post)
    for (p, q) in cut('s', x0, x1):
        fence(cv, (p, y1), (q, y1), post)


# ---------------------------------------------------------------- the mill wheel
def waterwheel(r=6.5, paddles=12, seed=0):
    """A face-on undershot wheel: a rim lit on its upper-left arc, paddle boards standing out from the rim,
    eight spokes to a hub. The rim's steps are chosen by hand for r = 6.5 (runs 5-2-1-1-2-5 down each side);
    other radii fall back to a sampled ring. Foot = the bottom of the rim (the river surface hides the rest)."""
    if abs(r - 6.5) < .01:
        RIM = [
            "....#####....",
            "..##.....##..",
            ".#.........#.",
            ".#.........#.",
            "#...........#",
            "#...........#",
            "#...........#",
            "#...........#",
            "#...........#",
            ".#.........#.",
            ".#.........#.",
            "..##.....##..",
            "....#####....",
        ]
        n = 13
        rim = np.array([[ch == '#' for ch in row] for row in RIM])
    else:
        n = int(2 * r + 1)
        yy, xx = np.mgrid[0:n, 0:n] + .5
        d = np.hypot(xx - n / 2, yy - n / 2)
        rim = (d <= r) & (d > r - 1.2)
    pad = 3
    S = Sprite(n + 2 * pad, n + 2 * pad)
    c = (n + 2 * pad) / 2
    # paddles: short boards pointing out from the rim, two pixels long
    for k in range(paddles):
        a = 2 * math.pi * k / paddles + math.pi / paddles
        for rr in (r + .9, r + 1.9):
            x = int(math.floor(c + math.cos(a) * rr))
            y = int(math.floor(c + math.sin(a) * rr))
            lit = math.cos(a) * -.6 + math.sin(a) * -.8 > 0
            _put(S, x, y, 'w4' if lit else 'w3')
    # the rim, its arc lit to the upper left
    ys, xs = np.nonzero(rim)
    for y, x in zip(ys, xs):
        X, Y = x + pad, y + pad
        a = math.atan2(Y + .5 - c, X + .5 - c)
        b = math.cos(a) * -.6 + math.sin(a) * -.8
        _put(S, X, Y, 'w6' if b > .55 else ('w5' if b > -.2 else ('w4' if b > -.7 else 'w3')))
    # spokes, one pixel wide, from the hub to the rim
    ci = int(c)
    for k in range(8):
        a = math.pi * k / 4
        ex, ey = int(round(c - .5 + math.cos(a) * (r - 1.6))), int(round(c - .5 + math.sin(a) * (r - 1.6)))
        x0, y0 = ci, ci
        dx, dy = abs(ex - x0), -abs(ey - y0)
        sx, sy = (1 if x0 < ex else -1), (1 if y0 < ey else -1)
        err = dx + dy
        while True:
            if _get(S, x0, y0) == CLEAR:
                lit = math.cos(a) * -.6 + math.sin(a) * -.8 > -.1
                _put(S, x0, y0, 'w4' if lit else 'w3')
            if x0 == ex and y0 == ey:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy
    ci = int(c)
    for (dx, dy, k) in ((-1, -1, 'w5'), (0, -1, 'w4'), (-1, 0, 'w4'), (0, 0, 'w2')):
        _put(S, ci + dx, ci + dy, k)
    selout(S, holes=False)
    S.ax, S.ay = ci, pad + n - 1
    return S


# ---------------------------------------------------------------- bridges
def timber_bridge(L, deck=5, piers=(), abut=(4, 4), pier_h=4, seed=0):
    """An E-W plank bridge L px long: the deck's planks laid across it (N-S) with seams and knots, a rail on
    each side on posts, the stringer under the south edge, trestle piers standing in the river with foam
    at their feet, and stone abutments at both ends. piers = column offsets of each pier pair.
    Anchor = (0, the deck's south edge row). The road runs straight onto both ends (no outline there)."""
    rng = random.Random(seed)
    top = 3
    H = top + deck + 3 + pier_h + 3
    S = Sprite(L + 2, H)
    ox = 1
    yN = top                                   # the deck's north edge row
    yS = yN + deck - 1                         # its south edge row
    # north rail (behind the deck): post tops above a continuous rail
    for x in range(L):
        X = ox + x
        _put(S, X, yN - 1, 'w4')
        if x % 5 == 2:
            _put(S, X, yN - 2, 'w5')
    # the deck: planks two columns wide, a darker seam between, knots here and there
    knots = set()
    for x in range(L):
        if x % 3 == 0 and rng.random() < .45:
            knots.add((x + 1, rng.randint(1, deck - 2)))
    for x in range(L):
        for y in range(deck):
            k = 'w4' if x % 3 == 2 else 'w5'
            if y == 0 and x % 3 != 2:
                k = 'w6'
            if (x, y) in knots:
                k = 'w3'
            _put(S, ox + x, yN + y, k)
    # south rail (in front): a lit rail on the deck's last row but one, posts down to the stringer
    for x in range(L):
        X = ox + x
        _put(S, X, yS - 1, 'w6')
        if x % 5 == 2:
            _put(S, X, yS, 'w3')
    # the stringer: the beam face under the south edge, in shade
    for x in range(L):
        _put(S, ox + x, yS + 1, 'w3' if x % 6 else 'w2')
        _put(S, ox + x, yS + 2, 'w2')
    # piers: pairs of posts down to the water, a cross-brace between, foam where they stand
    yb = yS + 3
    for p in piers:
        for (i, k) in ((0, 'w4'), (1, 'w2'), (3, 'w4'), (4, 'w2')):
            for y in range(pier_h):
                _put(S, ox + p + i, yb + y, k)
        _put(S, ox + p + 2, yb + 1, 'w3')
    # abutments: coursed stone under each end of the deck, moss at the foot
    for (x0, w_) in ((0, abut[0]), (L - abut[1], abut[1])):
        for x in range(x0, x0 + w_):
            for y in range(pier_h + 2):
                k = 't4'
                if y % 2 == 1:
                    k = 't3'
                elif (x + (y // 2) * 2) % 3 == 0:
                    k = 't5'
                if y == pier_h + 1:
                    k = 'm3' if x % 2 else 'm4'
                _put(S, ox + x, yS + 1 + y, k)
    selout(S)
    # let the road run onto the deck: no outline across the deck's ends
    for y in range(yN - 2, yS + 2):
        for X in (0, L + 1):
            v = _get(S, X, y)
            if v != CLEAR and pal.RAMP_OF[v] in ('w', 't'):
                S.ix[y, X] = CLEAR
    S.ax, S.ay = ox, yS
    S.deck = (yN - yS, 0)                      # deck rows relative to the anchor: north .. south
    S.water_row = yb + pier_h - yS             # rows below the anchor where the piers meet the water
    return S


def stone_bridge(L, run=3, deck=4, face=6, arches=(), abut=(6, 6), broken=None, seed=0):
    """A stone arch bridge L columns long whose deck rises 1 px every `run` px toward the east (run=0: level).
    Per column, top to bottom: the north parapet's coping and inner face, the deck (the road's own dirt, with
    ruts), the south coping, then the south face: parapet face, a lit string course, coursed spandrel blocks
    with arch openings over dark water, voussoirs lit round each arch. arches = [(x0, x1, rise)] column spans.
    Abutments at both ends run down to the bank with moss at the foot. broken = (b0, b1): the span between
    these columns has fallen; both stumps end in a jagged, stepped break, and the east stump shows its broken
    core (it faces the viewer a little). Anchor = (0, the west end's south coping row)."""
    rng = random.Random(seed)

    def t(x):
        return -(x // run) if run else 0

    tmin = t(L - 1)
    top = 2 - tmin
    rows = 2 + deck + 1 + face + 3
    spring_row = 3 + deck + face
    H = top + rows + 3
    S = Sprite(L + 2, H)
    ox = 1
    broken_cols = set()
    jag = {}
    if broken:
        b0, b1 = broken
        # per-row overhang of each stump past its break column: a stepped masonry fracture
        west = [-2, -1, 0, 1, 0, -1, 1, 0, -1, -2, -2, -3, -4, -5, -6]
        east = [-1, 0, 1, 0, -1, 0, -1, 0, 1, -1, -2, -3, -3, -4, -5]
        for y in range(rows):
            jag[y] = (b0 + west[min(y, len(west) - 1)], b1 - east[min(y, len(east) - 1)])
    arch_at = {}
    for (a0, a1, ar) in arches:
        half = (a1 - a0) / 2
        mid = a0 + half
        for x in range(a0, a1):
            u = (x + .5 - mid) / half
            arch_at[x] = int(round(ar * math.sqrt(max(0.0, 1 - u * u)))) if abs(u) < 1 else 0
    spring = 2 + deck + 1 + face            # the row where arches spring (= the water line)
    for x in range(L):
        X = ox + x
        y0 = top + t(x)
        for r_ in range(rows):
            if broken and jag[r_][0] <= x < jag[r_][1]:
                continue
            y = y0 + r_
            k = None
            if r_ == 0:
                k = 't6' if x % 4 else 't5'                # north coping, its stones jointed
            elif r_ == 1:
                k = 't3'                                   # its inner face, in shade
            elif r_ < 2 + deck:
                j = r_ - 2
                k = 'd4'
                if j == 0:
                    k = 'd3'                               # the parapet's shadow on the road
                elif j in (1, deck - 1) and (x + seed) % 5 < 3:
                    k = 'd3'                               # ruts
                elif (x * 7 + j * 3 + seed) % 11 == 0:
                    k = 'd5'
            elif r_ == 2 + deck:
                k = 't6' if x % 4 else 't5'                # south coping, its stones jointed
            else:
                f = r_ - (3 + deck)                        # rows down the south face
                d = arch_at.get(x, 0)
                is_abut = x < abut[0] or x >= L - abut[1]
                if f > face:
                    if not is_abut:
                        continue                           # below the water line: the river
                    k = 'm4' if (x + f) % 2 else 'm3'      # moss where the abutment meets the bank
                elif f == face:
                    if is_abut:
                        k = 'm3' if x % 3 else 't3'
                    elif d:
                        continue
                    else:
                        k = 't2'                           # the pier's wet foot
                elif f == 0:
                    k = 't3' if x % 4 else 't2'            # parapet face, in shade
                elif f == 1:
                    k = 't4'                               # string course: a ledge, a little light on it
                elif d and f >= face - d:
                    k = 't1' if f == face - d else ('a2' if f == face - 1 else 'a1')
                elif d and f == face - d - 1:
                    k = 't5' if x % 2 else 't4'            # voussoirs round the opening
                else:
                    blk = f - 2
                    if blk % 2 == 1:
                        k = 't2'                           # mortar course
                    else:
                        u = (x + (blk // 2) * 2) % 4
                        k = 't2' if u == 0 else ('t4' if u == 1 else 't3')
            if k:
                _put(S, X, y, k)
    if broken:
        # the east stump's broken end faces the viewer a little: show its rubble core, lighter where fresh
        for r_ in range(rows):
            xe = jag[r_][1]
            if xe < L and _get(S, ox + xe, top + t(xe) + r_) != CLEAR:
                v = _get(S, ox + xe, top + t(xe) + r_)
                if pal.RAMP_OF[v] == 't':
                    _put(S, ox + xe, top + t(xe) + r_, 't5' if r_ % 3 else 't2')
                elif pal.RAMP_OF[v] == 'd':
                    _put(S, ox + xe, top + t(xe) + r_, 't3')
    selout(S)
    for r_ in range(1, 2 + deck):
        for X, x in ((0, 0), (L + 1, L - 1)):
            y = top + t(x) + r_
            v = _get(S, X, y)
            if v != CLEAR:
                S.ix[y, X] = CLEAR
    S.ax, S.ay = ox, top + 2 + deck
    S.spring = spring - (2 + deck)                 # rows from the anchor down to the water line
    S.run = run
    return S


# ---------------------------------------------------------------- fords and the water under bridges
def ford(cv, water, path, width=7, flow=(0.0, 1.0), seed=0):
    """A ford where a road wades the river: along path (art px polyline) and inside the water mask, the water
    shoals to light shallows over a gravel bed, a line of stepping stones crosses on the road's axis, each with
    foam piled on its upstream side and a short wake below; the deep channel either side stays dark."""
    rng = random.Random(seed)
    H, W = water.shape
    pts = []
    for i in range(len(path) - 1):
        (ax, ay), (bx, by) = path[i], path[i + 1]
        n = max(1, int(math.hypot(bx - ax, by - ay)))
        for k in range(n):
            pts.append((ax + (bx - ax) * k / n, ay + (by - ay) * k / n))
    pts.append(path[-1])
    hw = width / 2
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, x1 = int(min(xs) - hw - 2), int(max(xs) + hw + 3)
    y0, y1 = int(min(ys) - hw - 2), int(max(ys) + hw + 3)
    P = np.array(pts)
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            if not water[y, x]:
                continue
            d = np.min(np.hypot(P[:, 0] - x - .5, P[:, 1] - y - .5))
            if d <= hw:
                k = 'a5'
                if d > hw - 1.2:
                    k = 'a4'                            # the shelf where the shallows drop away
                elif (x + 2 * y) % 7 == 0:
                    k = 'a6'                            # light on the gravel bed
                cv.put(x, y, k)
    # stepping stones on the road's axis, every 4 px, inside the water
    fx, fy = flow
    L = len(pts)
    for i in range(2, L - 2, 4):
        px, py = pts[i]
        X, Y = int(px), int(py)
        if not (0 <= Y < H and 0 <= X < W and water[Y, X]):
            continue
        for (dx, dy) in ((0, -1), (1, -1)):
            if 0 <= Y + dy < H and 0 <= X + dx < W and water[Y + dy, X + dx]:
                cv.put(X + dx, Y + dy, 'a7' if dx == 0 else 'a6')
        for k in (1, 2):
            wx, wy = int(round(X + fx * (k + 1.5))), int(round(Y + fy * (k + 1.5)))
            if 0 <= wy < H and 0 <= wx < W and water[wy, wx]:
                cv.put(wx, wy, 'a6')
        cv.put(X, Y, 't5'); cv.put(X + 1, Y, 't4')
        cv.put(X, Y + 1, 't3'); cv.put(X + 1, Y + 1, 't2')


def water_shade(cv, water, m, x0, y0, n=-1):
    """Shade the water under mask m (at x0, y0) n steps: a bridge's hard shadow on the river."""
    a = m.copy()
    H, W = a.shape
    for j in range(H):
        for i in range(W):
            if a[j, i]:
                X, Y = x0 + i, y0 + j
                if 0 <= X < cv.w and 0 <= Y < cv.h and water[Y, X]:
                    v = cv.get(X, Y)
                    if pal.RAMP_OF[v] == 'a':
                        cv.ix[Y, X] = pal.shift_index(v, n)


# ---------------------------------------------------------------- small yard props, hand-pixelled
def _ascii(rows, km, ax=None, ay=None, remap=None):
    S = Sprite(max(len(r) for r in rows) + 2, len(rows) + 2)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                _put(S, 1 + x, 1 + y, km[ch])
    selout(S, remap=remap)
    S.ax = 1 + (ax if ax is not None else (len(rows[0]) // 2))
    S.ay = 1 + (ay if ay is not None else len(rows) - 1)
    return S.trimmed()


def woodpile():
    """Split logs stacked end-on against a wall: each end lit on its upper-left, the stack's rings in shade."""
    return _ascii([
        "...ab...",
        "..abcd..",
        ".abcdab.",
        "abcdabcd",
        "cdcdcdcd",
    ], {'a': 'w6', 'b': 'w5', 'c': 'w4', 'd': 'w3'})


def crate():
    return _ascii([
        "6666",
        "4334",
        "3443",
        "4334",
    ], {'6': 'w6', '4': 'w4', '3': 'w3'})


def handcart():
    """A two-wheeled hand cart, its shafts down on the ground."""
    return _ascii([
        ".66665..",
        "644443..",
        "433332w.",
        ".kk..kk.",
        ".kk..kk.",
    ], {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2', 'w': 'w4', 'k': 'w2'})


def trough():
    return _ascii([
        "655556",
        "4aaaa4",
        "333333",
    ], {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', 'a': 'a4'})


def fingerpost(arms='we'):
    """A finger-post at map scale: a slim post, its arms pointing down the roads, lit on their top edges.
    arms: a string of 'w' / 'e' (one arm each, top to bottom)."""
    rows = ["..k.."]
    for a in arms:
        if a == 'e':
            rows += ["..655", "..443"]
        else:
            rows += ["556..", "344.."]
    rows += ["..4..", "..3..", "..3..", "..2.."]
    W = max(len(r) for r in rows)
    rows = [r.ljust(W, '.') for r in rows]
    km = {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2', 'k': 'w5'}
    S = Sprite(W + 4, len(rows) + 2)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                _put(S, 2 + x, 1 + y, km[ch])
    selout(S)
    S.ax, S.ay = 4, len(rows)
    return S.trimmed()


WELL2 = [
    ".p.....q.",
    ".pkkkkkq.",
    ".p..r..q.",
    ".tTTTTTs.",
    "tTaaaaaTs",
    "tTaaAaaTs",
    ".tssssss.",
]


def well2():
    """An open well: a round coursed-stone curb, dark water in it, a winch beam on two posts, the rope down."""
    km = {'p': 'w5', 'q': 'w3', 'k': 'w4', 'r': 'b2', 't': 't4', 'T': 't5', 's': 't3', 'a': 'a1', 'A': 'a3'}
    S = Sprite(11, len(WELL2) + 2)
    for y, row in enumerate(WELL2):
        for x, ch in enumerate(row):
            if ch != '.':
                _put(S, 1 + x, 1 + y, km[ch])
    _put(S, 2, 5, 't6')
    selout(S)
    S.ax, S.ay = 5, len(WELL2)
    return S.trimmed()


def masonry(w=4, h=3, tilt=0, seed=0):
    """A fallen dressed block: a lit top face, a shaded front with a mortar edge, tilted by `tilt` px per side
    (the top face's far edge steps by one pixel). Selout in the stone's own darks."""
    S = Sprite(w + 4, h + 4)
    for x in range(w):
        lift = 0 if tilt == 0 else ((x * abs(tilt)) // w if tilt > 0 else ((w - 1 - x) * abs(tilt)) // w)
        y0 = 1 + lift
        _put(S, 2 + x, y0, 't5' if x < w - 1 else 't4')
        for j in range(1, h):
            _put(S, 2 + x, y0 + j, 't3' if j < h - 1 else 't2')
        if x == w - 1:
            for j in range(1, h):
                _put(S, 2 + x, y0 + j, 't2')
    selout(S)
    S.ax, S.ay = 2 + w // 2, 1 + h + (abs(tilt) if tilt else 0) - 1
    return S.trimmed()


# ---------------------------------------------------------------- re-inking the older props
def reink(s, inks=('k0', 'k1'), remap=None, keep_fill=True):
    """Turn a sprite inked in the Ink ramp into a selout sprite, in place: every ink pixel on the silhouette
    takes the darkest step of the ramp it borders (lighter on the lit top and left), and ink lines inside the
    sprite (seams, frames) take a darker step of their neighbours' ramp. Thick ink fills (a doorway, a cave
    mouth) are left as the dark they are. Returns s."""
    a = s.ix
    ink_ids = [ix(k) for k in inks]
    ink = np.isin(a, ink_ids)
    clear = a == CLEAR
    H, W = a.shape
    padc = np.ones((H + 2, W + 2), bool)
    padc[1:-1, 1:-1] = clear
    touches_clear = np.zeros_like(ink)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        touches_clear |= padc[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx]
    solid = ~clear & ~ink
    n_solid = np.zeros(a.shape, int)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n_solid += nb(solid, dx, dy, False)
    target = ink & (touches_clear | (n_solid >= 2) | (not keep_fill))
    tl, td = _table(remap, 0), _table(remap, 1)
    done = np.zeros_like(ink)
    for _ in range(3):                  # corners and runs of ink take their colour from converted neighbours
        src = a.copy()
        for (dx, dy, lit) in ((0, 1, True), (1, 0, True), (-1, 0, False), (0, -1, False)):
            v = nb(src, dx, dy, CLEAR)
            ok = target & ~done & (v != CLEAR) & ~np.isin(v, ink_ids)
            a[ok] = (tl if lit else td)[v[ok]]
            done |= ok
    return s


def R(sc, s, remap=None):
    """reink at grain 1 only (the grain-2 board keeps its look)."""
    return reink(s, remap=remap) if sc.g == 1 else s


def flour_sacks():
    """Three full sacks leaning together by a door, tied at the neck."""
    return _ascii([
        ".b...b..",
        "454.454.",
        "4443444.",
        "3433343.",
        ".33333..",
    ], {'b': 'b1', '5': 'b4', '4': 'b3', '3': 'b2'})


# ---------------------------------------------------------------- stone towers and walls
def _drum_tone(x, w):
    """A drum lit from the west: a lit band a little in from the west rim, mid, then shade to the east rim."""
    f = (x + .5) / w
    if f < .1:
        return 4
    if f < .42:
        return 5 if not (.18 < f < .32) else 6
    if f < .64:
        return 4
    if f < .86:
        return 3
    return 2


def stone_tower(w=14, h=28, slits=2, door=True, moss=True, seed=0):
    """A round stone tower in 3/4 view: a drum of coursed blocks (2-row courses, staggered joints, each
    block's top edge catching the light), lit from the west; a battered foot with moss; arrow slits; an
    arched door; on top, the wall-walk seen from above (the far parapet's lit inner face, the shadowed floor)
    behind a crenellated near parapet. Foot = base centre."""
    rng = random.Random(seed)
    cap = max(4, int(round(w * .3)))         # rows of the top seen from above
    S = Sprite(w + 6, h + cap + 6)
    ox, oy = 3, 2 + cap                      # oy = the body's top row
    # the body
    for y in range(h):
        bat = 1 if y >= h - 3 else 0
        for x in range(-bat, w + bat):
            t = _drum_tone(x + bat, w + 2 * bat)
            course, r = y // 3, y % 3
            if r == 2:
                t = max(1, t - 1)            # mortar course
            elif (x + course * 2) % 5 == 4:
                t = max(1, t - 1)            # vertical joint, staggered
            elif r == 0 and t >= 3:
                t = min(6, t + 1) if (x + course * 2) % 5 in (0, 1) else t
            _put(S, ox + x, oy + y, f't{t}')
    # the top, seen from above: an ellipse cap; the far parapet's inner face lit, the floor in shadow
    cx = (w - 1) / 2
    for j in range(cap):
        for x in range(w):
            u = (x - cx) / (w / 2)
            edge = cap * (1 - math.sqrt(max(0, 1 - u * u)))      # the far rim, high in the middle
            y = oy - cap + j
            if j >= edge:
                if j <= edge + 1:
                    k = 't5' if u < .3 else 't4'                 # the far parapet's inner face
                else:
                    k = 't2'                                     # the wall-walk floor, in its own shadow
                _put(S, ox + x, y, k)
    # the near parapet: merlons standing over the floor, lit tops
    for x in range(w):
        t = _drum_tone(x, w)
        _put(S, ox + x, oy, f't{t}')
        if ((x + 1) // 2) % 2 == 0:
            _put(S, ox + x, oy - 2, f't{min(6, t + 1)}')          # the merlon's lit top
            _put(S, ox + x, oy - 1, f't{t}')
    # slits and the door
    for i in range(slits):
        sx = ox + int(w * (.38 if i == 0 else .62))
        sy = oy + int(h * (.25 + .3 * i))
        for j in range(3):
            _put(S, sx, sy + j, 't1')
    if door:
        dx = ox + w // 2 - 1
        for j in range(4):
            for i in range(2):
                _put(S, dx + i, oy + h - 1 - j, 'w1' if j < 3 else 'w0')
        _put(S, dx - 1, oy + h - 4, 't5'); _put(S, dx + 2, oy + h - 4, 't3')       # the arch stones
    if moss:
        for x in range(-1, w + 1):
            if (x * 7 + seed) % 5 < 2:
                _put(S, ox + x, oy + h - 1, 'm3' if x % 2 else 'm4')
    selout(S)
    S.ax, S.ay = ox + w // 2, oy + h - 1
    return S.trimmed()


def coursed(S, x0, y0, w, h, tones=(5, 4, 3), course=3, seed=0, moss_row=None):
    """Fill a wall face with coursed blocks: courses `course` rows tall (the last row mortar), joints staggered,
    block tops catching the light; tones = (west third, middle, east third) of the face."""
    for j in range(h):
        for i in range(w):
            t = tones[0] if i < w * .34 else (tones[1] if i < w * .68 else tones[2])
            c, r = j // course, j % course
            if r == course - 1:
                t -= 1
            elif (i + c * 3) % 6 == 5:
                t -= 1
            elif r == 0 and (i + c * 3) % 6 in (0, 1, 2):
                t = min(6, t + 1)
            _put(S, x0 + i, y0 + j, f't{max(1, t)}')
    if moss_row is not None:
        for i in range(w):
            if (i * 5 + seed) % 7 < 3:
                _put(S, x0 + i, y0 + moss_row, 'm3' if i % 2 else 'm4')


def stake_arc(rx, ry, h, front, gap=None):
    """Half a palisade ring (front or back) as one sprite: sharpened stakes 3 px wide shoulder to shoulder,
    each lit on its west face with a lit point, darker toward the east of the ring; selout in the wood's own
    darks. Anchor = the ring's centre."""
    W, H = int(2 * rx) + 8, int(2 * ry) + h + 8
    S = Sprite(W, H, W // 2, int(ry) + h + 3)
    cx, cy = W // 2, int(ry) + h + 3
    cols = {}
    n = int(8 * (rx + ry))
    for i in range(n):
        a = 2 * math.pi * i / n
        if gap and abs(((a - gap[0] + math.pi) % (2 * math.pi)) - math.pi) < gap[1]:
            continue
        if (math.sin(a) >= 0) != front:
            continue
        x = int(round(cx + math.cos(a) * rx))
        y = int(round(cy + math.sin(a) * ry))
        if x not in cols or (front and y > cols[x][0]) or (not front and y < cols[x][0]):
            cols[x] = (y, math.cos(a))
    for x, (yb, east) in sorted(cols.items()):
        c = x % 3
        shade = 1 if east > .5 else 0
        body = (['d5', 'd4', 'd3'] if not shade else ['d4', 'd3', 'd2'])[c]
        top = yb - h + (0 if c == 1 else 1)
        for y in range(top, yb + 1):
            k = body
            if y == yb:
                k = 'd2'                                   # the foot, where the stake goes into the earth
            elif y == top:
                k = 'd6' if c == 1 and not shade else ('d5' if c == 1 else body)
            _put(S, x, y, k)
    selout(S)
    return S


def board_sign(bw=90, bh=23, ph=44):
    """The big finger-board to Thornwood: three planks with grain lines and knots, the east end cut to a point,
    a lit top edge, on a squared post. Foot = the post's base."""
    S = Sprite(bw + 6, ph + 6)
    px = 6
    for j in range(ph):
        _put(S, px, 2 + j, 'w5'); _put(S, px + 1, 2 + j, 'w4'); _put(S, px + 2, 2 + j, 'w2')
    tip = 10
    rng = random.Random(3)
    knots = [(rng.randint(6, bw - 20), rng.randint(2, bh - 3)) for _ in range(5)]
    seams = (bh // 3, 2 * bh // 3)
    for j in range(bh):
        for i in range(bw):
            mid = (bh - 1) / 2
            if i > bw - 1 - tip and abs(j - mid) > (bw - 1 - i) * (bh / 2) / tip:
                continue
            k = 'w4'
            plank = 0 if j < seams[0] else (1 if j < seams[1] else 2)
            if j == 0:
                k = 'w6'
            elif j in seams:
                k = 'w2'                                    # the seam between planks
            elif j - 1 in seams or j == 1:
                k = 'w5'                                    # each plank's lit top edge
            elif j + 1 in seams or j == bh - 1:
                k = 'w3'
            elif (i * 3 + j * 11 + plank * 7) % 23 == 0:
                k = 'w3'                                    # a run of grain
            if (j % 7 == 3) and (i + plank * 13) % 17 < 6 and k == 'w4':
                k = 'w3'                                    # grain lines along the plank
            _put(S, 1 + i, 1 + j, k)
    for (kx, ky) in knots:
        if ky not in seams and ky - 1 not in seams:
            _put(S, 1 + kx, 1 + ky, 'w2'); _put(S, 2 + kx, 1 + ky, 'w3'); _put(S, 1 + kx, ky, 'w5')
    for (nx, ny) in ((px - 1, seams[0] // 2 + 1), (px - 1, bh - 3)):
        _put(S, 1 + nx, 1 + ny, 't5')                       # the nail heads
    selout(S)
    S.ax, S.ay = px, ph + 1
    return S


# ---------------------------------------------------------------- the wild places' pieces
def fallen_oak(L=40, th=7):
    """An oak lying east-west where it fell: bark in long furrows along the trunk, lit along its top, the
    underside in shade; the torn-up root plate on edge at the west end, roots sticking out of the earth;
    a snapped branch stub. Foot = the trunk's west end on the ground."""
    S = Sprite(L + 16, th + 18)
    ox, oy = 9, 9
    for i in range(L):
        taper = 1 if i > L * .7 else 0
        top = oy + taper
        for j in range(th - taper):
            if j == 0:
                k = 'w5'
                if (i * 5) % 7 < 3:
                    k = 'w6'
            elif j == 1:
                k = 'w5' if (i + 3) % 6 else 'w4'
            elif j < th - taper - 2:
                k = 'w4'
                if (i + j * 4) % 9 < 4 and j % 2 == 0:
                    k = 'w3'                                  # bark furrows running along the trunk
            elif j < th - taper - 1:
                k = 'w3'
            else:
                k = 'w2'
            _put(S, ox + i, top + j, k)
    # the cut-off crown end: a few broken limb ends
    for (dx, dy) in ((L, 1), (L, 3), (L + 1, 2)):
        _put(S, ox + dx, oy + dy, 'w4')
    # a snapped branch stub, standing up off the top of the trunk
    for (dx, dy, k) in ((14, -1, 'w5'), (14, -2, 'w5'), (15, -2, 'w4'), (15, -3, 'w5'), (16, -3, 'w4')):
        _put(S, ox + dx, oy + dy, k)
    # the root plate: earth on edge, lit to the upper left, roots out of it
    for j in range(-6, th + 5):
        for i in range(-4, 2):
            u, v = (i + 1.5) / 3.2, (j - th / 2 + .5) / 8.2
            if u * u + v * v <= 1:
                k = 'd4' if (i < -1 and j < th / 2) else ('d3' if j < th else 'd2')
                if (i * 3 + j * 5) % 11 == 0:
                    k = 'd5'                                  # a clod catching the light
                _put(S, ox + i, oy + j, k)
    for (dx, dy) in ((-5, -5), (-6, -1), (-5, 4), (-4, 9), (0, -7), (-2, 11), (1, 10)):
        _put(S, ox + dx, oy + dy, 'w3')
    for (dx, dy) in ((-6, -6), (-7, -1), (-6, 5)):
        _put(S, ox + dx, oy + dy, 'w2')
    selout(S)
    S.ax, S.ay = ox, oy + th
    return S.trimmed()


CART_ON_SIDE = [
    "...........f.....f.....",
    "..rrrrrr...a....a......",
    ".rRhhhhRr..a...a.......",
    ".rRhHHhRr.a...a........",
    "..rrrrrr..a..a.........",
    "TTTTTTTTTTTTTTTTTTTT...",
    "65556555655565556555...",
    "65556555655565556555...",
    "54445444544454445444...",
    "54445444544454445444...",
    "33333333333333333333...",
]


def cart_on_side():
    """The ambushed cart, tipped on its side across the road: its floor boards face us, the upper wheel lies
    flat on top of it seen from above (rim, spokes, hub), arrows stand in the boards."""
    km = {'T': 'w6', '6': 'w5', '5': 'w4', '4': 'w3', '3': 'w2', 'r': 'w4', 'R': 'w3', 'h': 'w5', 'H': 'w2',
          'a': 'w5', 'f': 'b5'}
    return _ascii(CART_ON_SIDE, km, ax=9, ay=len(CART_ON_SIDE) - 1)


DEAD_OX = [
    "..............bb.",
    "...........ddd.b.",
    "..66666665d5444d.",
    ".6655555554d44dd.",
    "665554444443d3d..",
    "5544444333332d...",
    ".43333322222d....",
    "..3.3...3.3......",
]


def dead_ox():
    """The draught ox, down on its side by the cart: a dun hide lit along its back, its head with a pale horn,
    legs out."""
    km = {'6': 'd6', '5': 'd5', '4': 'd4', '3': 'd3', '2': 'd2', 'd': 'd3', 'b': 'b4'}
    return _ascii(DEAD_OX, km, ax=7, ay=len(DEAD_OX) - 1)
