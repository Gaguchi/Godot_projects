"""The big country's heartland, the Borderlands at four times the area, as one 2560 x 1440 grain-1 pixel canvas.
A generalised copy of dirs/px-open-b/world_b.py: the same kit, the same 1x grain and the same recipes, laid out
for a world of any size and drawn whole (a window is a crop of it, so the map screen and the country board can
never disagree).

    import world_big as WB
    cv, info = WB.render(company=True)       # the whole heartland, 2560 x 1440 (company: True | False | (x, y))
    win = WB.window(cv, x0, y0, 1280, 720)   # any window of it, a Canvas
    # layout: land.P / land.NODE / land.roads() / land.hops(); WB.road_paths() {(a, b): polyline};
    #         WB.CROSSINGS (bridges and fords); WB.EXIT_SIGNS (+ 'board_box' after render); info['fords']

Frame: world px, the heartland is [0, 2560] x [0, 1440], the camp at (1280, 720). Roads out to the wild run on
past the edge toward their wild place.
"""
import math
import os
import random
import sys
import zlib
from collections import defaultdict

import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
while not os.path.isdir(os.path.join(DIRS, 'pxworld')):
    DIRS = os.path.dirname(DIRS)
for _p in (HERE, DIRS):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import land as LD                                                            # noqa: E402
import geo                                                                   # noqa: E402
import bits                                                                  # noqa: E402
import ashland as AL                                                         # noqa: E402
import sites as ST                                                           # noqa: E402
from pxworld import pal, terrain as TR, trees as TS, places as PL, folk as FK, build as BD, props as PR   # noqa: E402
from pxworld.canvas import Canvas, ellipse                                   # noqa: E402

W, H = LD.HEART_WH
P, NODE, NAMES = LD.P, LD.NODE, LD.NAMES


def _seed(name):
    return zlib.crc32(name.encode())


def drawn(k):
    """Drawn in the heartland on day 1 (Daren's Camp stays hidden until found)."""
    return NODE[k]['region'] == 'borderlands' and not NODE[k].get('hidden')


HEART_KEYS = [k for k in P if drawn(k)]

# ================================================================ water and its crossings
river_pts = geo.sample_catmull(LD.RIVER + [(2236, 1640)], 18)
brook_pts = geo.sample_catmull(LD.BROOK, 18)


def river_x(y):
    return LD.course_x(river_pts, y)


def brook_x(y):
    return LD.course_x(brook_pts, y)


def brook_y(x):
    """The brook's centre row at column x on its westward run (x < 900)."""
    return min((q for q in brook_pts if q[1] > 1050), key=lambda q: abs(q[0] - x))[1]


# bridges: deck ends ('west', 'east') in world px along the bridge's axis
_OM = P['old_mill_crossing']
MILL_W, MILL_E = (_OM[0] - 12, _OM[1] + 6), (_OM[0] + 29, _OM[1] + 6)
_BB = P['broken_bridge']
_BBX = river_x(_BB[1])
BB_W, BB_E = (_BBX - 29, _BB[1] - 1.5), (_BBX + 22, _BB[1] - 18.5)
BB_AX = (3 / math.hypot(3, 1), -1 / math.hypot(3, 1))


def _timber(name, y, course, L):
    cx = (brook_x if course == 'brook' else river_x)(y)
    x0 = int(round(cx - L / 2))
    return dict(kind='timber', x0=x0, y=y, L=L, course=course, west=(x0, y - 2), east=(x0 + L, y - 2), axis=(1.0, 0.0))


def _stone(name, y, L):
    cx = river_x(y)
    x0 = int(round(cx - L / 2))
    return dict(kind='stone', x0=x0, y=y, L=L, course='river', west=(x0, y - 3), east=(x0 + L, y - 3), axis=(1.0, 0.0))


BRIDGES = {
    'old_mill_crossing': dict(kind='mill', west=MILL_W, east=MILL_E, axis=(1.0, 0.0)),
    'broken_bridge': dict(kind='broken', west=BB_W, east=BB_E, axis=BB_AX),
    'plank_bridge': _timber('plank_bridge', 336, 'brook', 32),
    'west_road_bridge': _timber('west_road_bridge', 640, 'brook', 32),     # the camp's west road, no place
    'toll_bridge': _stone('toll_bridge', 906, 52),
}
# roads that cross a bridge on their way (the bridge is not either end)
VIA_BRIDGE = {('frontier_camp', 'traders_rest'): 'west_road_bridge',
              ('beekeepers_croft', 'traders_rest'): 'west_road_bridge'}
# fords: the place (or the road) and the flow there; a road to a ford place ends at its point in the water,
# arriving square to the flow
FORDS = {
    'stony_ford': dict(at=(river_x(290), 290), flow=(.12, .99), across=(1.0, 0.0)),
    'sheep_ford': dict(at=(420, brook_y(420)), flow=(-.99, .1), across=(0.0, 1.0)),
    'ash_ford': dict(at=(130, brook_y(130)), flow=(-.99, .1), across=(0.0, 1.0)),
}
P['stony_ford'] = FORDS['stony_ford']['at']
P['sheep_ford'] = FORDS['sheep_ford']['at']
P['ash_ford'] = FORDS['ash_ford']['at']
# the mill's own ford: Lowfield's road wades the brook beside Brook Mill
MILL_FORD = (P['brook_mill'][0] - 14, brook_y(P['brook_mill'][0] - 14))
# where the roads to a cave end: the apron before its south-facing mouth (B's offsets, at the same 1x scale)
DOOR = {'bandit_hideout': (P['bandit_hideout'][0] + 2, P['bandit_hideout'][1] + 31),
        'smugglers_cave': (P['smugglers_cave'][0] + 1, P['smugglers_cave'][1] + 21)}
for _k, _b in BRIDGES.items():
    if _k in P:
        pass

# ================================================================ road geometry
# roads that run through waypoints (world px): a Catmull-Rom spline from a through them to b
VIA = {
    ('traders_rest', 'bandit_hideout'): [(800, 650), (700, 700), (636, 742)],
    ('bandit_hideout', 'borderland_shrine'): [(546, 760), (506, 730), (420, 640)],
    ('rodericks_camp', 'smugglers_cave'): [(2440, 900), (2420, 1010), (2400, 1086)],
    ('broken_bridge', 'smugglers_cave'): [(2260, 1150), (2320, 1100)],
    ('bandit_hideout', 'drovers_camp'): [(560, 790), (500, 860)],
    ('bandit_hideout', 'boundary_stone'): [(530, 770), (420, 780)],
}
BEND_MAX = 14


def _bend(a, b):
    return ((_seed(a + '|' + b) % (2 * BEND_MAX + 1)) - BEND_MAX) * .8


def _curve(s, e, name, k=1.0):
    """A country road from s to e: a cubic that either bows one way or swings in a gentle S (chosen from the
    road's name), never more than 30 px off the straight line."""
    h = _seed(name)
    L = math.dist(s, e) or 1
    nx, ny = -(e[1] - s[1]) / L, (e[0] - s[0]) / L
    mag = min(30.0, (.05 + (h % 7) * .013) * L) * k
    s1 = 1 if (h >> 3) & 1 else -1
    s2 = s1 if (h >> 4) % 5 < 3 else -s1
    c1 = (s[0] + (e[0] - s[0]) / 3 + nx * mag * s1, s[1] + (e[1] - s[1]) / 3 + ny * mag * s1)
    c2 = (s[0] + 2 * (e[0] - s[0]) / 3 + nx * mag * s2, s[1] + 2 * (e[1] - s[1]) / 3 + ny * mag * s2)
    n = max(20, int(L / 4))
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u ** 3 * s[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * e[0],
                    u ** 3 * s[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * e[1]))
    return out


def _spline(pts):
    return geo.sample_catmull(pts, 24)


def _end_of(k, other):
    """Where a road from `other` arrives at place k: its door, its bridge head, its ford, or its point."""
    if k in DOOR:
        return DOOR[k], None
    if k in BRIDGES and k in P:
        b = BRIDGES[k]
        o = P[other] if other in P else other
        side = 'west' if o[0] < (b['west'][0] + b['east'][0]) / 2 else 'east'
        if k == 'broken_bridge' and other == 'ashfall_trail':
            side = 'west'
        return b[side], (b, side)
    if k in FORDS:
        return FORDS[k]['at'], ('ford', FORDS[k])
    return P[k], None


def _approach(end, how, other_pt):
    """The last stretch into an end: square onto a bridge's deck along its axis, square across the flow into a
    ford. Returns (near, [end points])."""
    if how is None:
        return None, [end]
    if how[0] == 'ford':
        f = how[1]
        ax = f['across']
        sgn = 1 if (other_pt[0] - end[0]) * ax[0] + (other_pt[1] - end[1]) * ax[1] > 0 else -1
        near = (end[0] + sgn * ax[0] * 26, end[1] + sgn * ax[1] * 26)
        mid = (end[0] + sgn * ax[0] * 13, end[1] + sgn * ax[1] * 13)
        return near, [mid, end]
    b, side = how
    ax = b['axis']
    sgn = -1 if side == 'west' else 1
    near = (end[0] + sgn * ax[0] * 10, end[1] + sgn * ax[1] * 10)
    onto = (end[0] - sgn * ax[0] * 4, end[1] - sgn * ax[1] * 4)
    return near, [end, onto]


def _clip_out(A, B):
    """The point where the line A->B leaves the heartland, carried 40 px past the edge."""
    dx, dy = B[0] - A[0], B[1] - A[1]
    ts = []
    for (lo, hi, a0, d) in ((0, W, A[0], dx), (0, H, A[1], dy)):
        if d > 0:
            ts.append((hi - a0) / d)
        elif d < 0:
            ts.append((lo - a0) / d)
    t = min(ts)
    L = math.hypot(dx, dy)
    t2 = t + 40 / L
    return (A[0] + dx * t2, A[1] + dy * t2)


def road_paths():
    """{(a, b): polyline in world px} for every road with an end in the heartland (Daren's roads included; the
    renderer leaves out what is hidden). A road from the heartland to the wild runs on 40 px past the edge."""
    out = {}
    for a, b, _t in LD.roads():
        ina, inb = NODE[a]['region'] == 'borderlands', NODE[b]['region'] == 'borderlands'
        if not (ina or inb):
            continue
        if not ina:
            a, b = b, a
        key = (a, b)
        out[key] = _road(a, b, wild=not inb)
    return out


def _road(a, b, wild=False):
    key = (a, b)
    rkey = (b, a)
    if wild:
        A, how_a = _end_of(a, b)
        B = _clip_out(P[a], P[b])
        nearA, tailA = _approach(A, how_a, B)
        body = [nearA] if nearA else []
        pts_ = list(reversed(tailA)) + body
        return pts_[:-1] + _curve(pts_[-1], B, a + '|' + b)
    if key in VIA_BRIDGE or rkey in VIA_BRIDGE:
        br = BRIDGES[VIA_BRIDGE.get(key) or VIA_BRIDGE[rkey]]
        A, B = P[a], P[b]
        e1, e2 = (br['west'], br['east']) if A[0] < B[0] else (br['east'], br['west'])
        s1 = -1 if e1 is br['west'] else 1
        n1 = (e1[0] + s1 * 10, e1[1])
        n2 = (e2[0] - s1 * 10, e2[1])
        p1 = geo.quad_pts(A, n1, geo.quad(A, n1, _bend(a, b) * .5), 40)
        p2 = geo.quad_pts(n2, B, geo.quad(n2, B, _bend(b, a) * .5), 40)
        return p1 + [e1, e2] + p2
    A, how_a = _end_of(a, b)
    B, how_b = _end_of(b, a)
    if a == 'brook_mill' or b == 'brook_mill':
        other = b if a == 'brook_mill' else a
        if other == 'lowfield':                                  # wades the brook at the mill's ford
            f = dict(across=(0.0, 1.0))
            M = P['brook_mill']
            pts = [(MILL_FORD[0], MILL_FORD[1] - 14), (MILL_FORD[0], MILL_FORD[1]), (MILL_FORD[0], MILL_FORD[1] + 14),
                   (MILL_FORD[0] + 4, MILL_FORD[1] + 30)]
            path = [M] + pts
            Q = P[other]
            path += geo.quad_pts(pts[-1], Q, geo.quad(pts[-1], Q, _bend(a, b)), 50)[1:]
            return path if a == 'brook_mill' else path[::-1]
    nearA, tailA = _approach(A, how_a, B)
    nearB, tailB = _approach(B, how_b, A)
    s = nearA or A
    e = nearB or B
    via = VIA.get(key) or (VIA[rkey][::-1] if rkey in VIA else None)
    if via:
        core = _spline([s] + via + [e])
    else:
        core = _curve(s, e, a + '|' + b)
    head = list(reversed(tailA)) if nearA else []
    tail = tailB if nearB else []
    return head + core + tail


# ================================================================ the ground: scenery laid out by rule (seeded)
def _poly_blob(cx, cy, rx, ry, rng, n=7, rot=0.0):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-.2, .2)
        r = rng.uniform(.78, 1.12)
        x, y = math.cos(a) * rx * r, math.sin(a) * ry * r
        c, s_ = math.cos(rot), math.sin(rot)
        pts.append((cx + x * c - y * s_, cy + x * s_ + y * c))
    return pts


def _quad_field(cx, cy, w, h, rng):
    """A field as a slightly turned, slightly sheared quad (PxOpenB's fields: about 70 x 55)."""
    rot = math.radians(rng.uniform(-9, 9))
    sh = rng.uniform(-.12, .12)
    c, s_ = math.cos(rot), math.sin(rot)
    out = []
    for (u, v) in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
        u2 = u + sh * v
        out.append((int(round(cx + u2 * c - v * s_)), int(round(cy + u2 * s_ + v * c))))
    return out


FIELD_KINDS = [('wheat', (1, 3)), ('wheat2', (3, -1)), ('crop', (0, 1)), ('crop2', (1, 0)), ('plough', (-1, 3))]

# ridges under the places that stand on a rise; (place, dx, dy, rx, ry, rot)
RIDGES = [('watchtower_ridge', 10, -10, 76, 34, 6, 'ridge'), ('north_ridge_path', 6, -39, 92, 30, -4, 'ridge'),
          ('bandit_hideout', -4, -14, 70, 34, -8, 'ridge'), ('smugglers_cave', 10, -4, 84, 46, -6, 'ridge'),
          ('beacon_hill', 0, -6, 64, 30, 4, 'ridge'), ('cairn_hill', 0, -10, 60, 26, -6, 'ridge'),
          ('gallows_hill', 0, -6, 56, 26, 8, 'ridge'), ('smoke_hill', 0, -6, 58, 26, -4, 'ridge'),
          ('south_watch', 0, -4, 62, 28, 4, 'ridge'), ('barley_hill_farm', -10, -20, 70, 28, -6, 'ridge'),
          ('old_barrow', 0, -30, 40, 18, 0, 'ridge'), ('standing_stones', 0, -34, 46, 20, 0, 'mound')]


def _mask_poly(pts):
    from pxworld.canvas import poly as mpoly
    m, x0, y0 = mpoly(pts)
    full = np.zeros((H, W), bool)
    xs, ys = slice(max(0, x0), min(W, x0 + m.shape[1])), slice(max(0, y0), min(H, y0 + m.shape[0]))
    if xs.stop > xs.start and ys.stop > ys.start:
        full[ys, xs] = m[ys.start - y0:ys.stop - y0, xs.start - x0:xs.stop - x0]
    return full


def scenery(paths, seed=5):
    """The fields, woods, farmsteads and rises of the heartland, placed by rule so every 1280 x 720 has
    PxOpenB's share of each. Returns a dict of lists in world px."""
    rng = random.Random(seed)
    road_pts = np.array([p for v in paths.values() for p in geo.resample(v, 4.0)])
    rtree = cKDTree(road_pts)
    place_pts = np.array([P[k] for k in HEART_KEYS] + [P['darens_camp']])
    ptree = cKDTree(place_pts)
    wpts = np.array(river_pts + brook_pts)
    wtree = cKDTree(wpts)
    zone_m = _mask_poly(LD.ZONES['thornwood']) | _mask_poly(LD.ZONES['ashfall'])
    zone_d = ndimage.distance_transform_edt(~zone_m)
    taken = np.zeros((H, W), bool)

    from pxworld.canvas import poly as mpoly

    def clear(pts, road=12, place=50, water=28, zone=14, pad=6):
        """The polygon's mask (local) if it stands clear of everything, else False."""
        m, x0, y0 = mpoly(pts)
        if x0 - pad < 0 or y0 - pad < 0 or x0 + m.shape[1] + pad > W or y0 + m.shape[0] + pad > H or not m.any():
            return False
        ys, xs = np.nonzero(m)
        if (zone_d[ys + y0, xs + x0] < zone).any():
            return False
        g = np.pad(m, pad)
        g = ndimage.binary_dilation(g, iterations=pad)
        if (g & taken[y0 - pad:y0 + m.shape[0] + pad, x0 - pad:x0 + m.shape[1] + pad]).any():
            return False
        sample = np.stack([xs[::7] + x0, ys[::7] + y0], 1)
        if (rtree.query(sample)[0] < road).any() or (ptree.query(sample)[0] < place).any():
            return False
        if (wtree.query(sample)[0] < water).any():
            return False
        return (m, x0, y0)

    def take(c):
        m, x0, y0 = c
        taken[y0:y0 + m.shape[0], x0:x0 + m.shape[1]] |= m

    # farmsteads first (PL.FARM_PLANS 0..5, each laid relative to its own home point): beside a road
    farms = []
    fp_home = [(586, 432), (318, 322), (872, 650), (716, 452), (270, 448), (196, 330)]
    tries = 0
    want = {0: 9, 1: 7, 2: 8, 3: 6}                 # per quadrant (NW, NE, SW, SE): the hamlets fill the east
    got = {q: 0 for q in want}
    while sum(got.values()) < sum(want.values()) and tries < 12000:
        tries += 1
        i = rng.randrange(len(road_pts))
        rx_, ry_ = road_pts[i]
        ang = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(46, 90)
        x, y = rx_ + math.cos(ang) * d, ry_ + math.sin(ang) * d * .8
        if not (60 < x < W - 60 and 60 < y < H - 60):
            continue
        q = int(x >= W / 2) + 2 * int(y >= H / 2)
        if got[q] >= want[q]:
            continue
        plan = len(farms) % 6
        box = [(x - 32, y - 26), (x + 34, y - 26), (x + 34, y + 14), (x - 32, y + 14)]
        m = clear(box, road=10, place=80, water=30, zone=10, pad=12)
        if m is False:
            continue
        if any(math.dist((x, y), (f[0], f[1])) < 150 for f in farms):
            continue
        take(m)
        farms.append((int(x), int(y), plan))
        got[q] += 1
    # cottages along the roads between the places: two or three houses fronting an east-west stretch
    cottages = []
    order = list(range(0, len(road_pts), 7))
    rng.shuffle(order)
    for i in order:
        if len(cottages) >= 16:
            break
        p = road_pts[i]
        j = min(len(road_pts) - 1, i + 3)
        tx, ty = road_pts[j][0] - road_pts[max(0, i - 3)][0], road_pts[j][1] - road_pts[max(0, i - 3)][1]
        L = math.hypot(tx, ty) or 1
        if L > 40:
            continue                                   # the samples straddle two roads
        tx, ty = tx / L, ty / L
        if abs(ty) > .55:
            continue
        nx, ny = -ty, tx
        if ny > 0:
            nx, ny = -nx, -ny                          # the normal that points north
        if any(math.dist(p, c[:2]) < 260 for c in cottages) or any(math.dist(p, f[:2]) < 120 for f in farms):
            continue
        box = [(p[0] + nx * 8 - tx * 34, p[1] + ny * 8 - ty * 34), (p[0] + nx * 8 + tx * 34, p[1] + ny * 8 + ty * 34),
               (p[0] + nx * 40 + tx * 34, p[1] + ny * 40 + ty * 34), (p[0] + nx * 40 - tx * 34, p[1] + ny * 40 - ty * 34)]
        m = clear(box, road=5, place=110, water=26, zone=10, pad=6)
        if m is False:
            continue
        take(m)
        cottages.append((float(p[0]), float(p[1]), tx, ty, 2 + (i % 2)))
    # fields: patchworks of one to four hedged fields sharing a turn, beside the farmsteads, the farm places and
    # the hamlets; then a few out on their own
    fields = []
    homes = [(f[0], f[1]) for f in farms] + [P[k] for k in HEART_KEYS
                                             if LD.JOB.get(k) in ('farm', 'hamlet', 'croft', 'orchard', 'bees', 'hay')]
    homes += [P[k] for k in ('riverside_market', 'south_junction', 'pine_crossing')]

    def cell(cx, cy, w_, h_, rot):
        c, s_ = math.cos(rot), math.sin(rot)
        return [(int(round(cx + u * c - v * s_)), int(round(cy + u * s_ + v * c)))
                for (u, v) in ((-w_ / 2, -h_ / 2), (w_ / 2, -h_ / 2), (w_ / 2, h_ / 2), (-w_ / 2, h_ / 2))]
    for (hx, hy) in homes:
        for attempt in range(40):
            ang = rng.uniform(0, 2 * math.pi)
            d = rng.uniform(70, 125)
            ox, oy = hx + math.cos(ang) * d, hy + math.sin(ang) * d * .8
            rot = math.radians(rng.uniform(-8, 8))
            nx_, ny_ = rng.choice([(1, 1), (2, 1), (2, 1), (1, 2), (2, 2), (3, 1)])
            cw, ch = rng.uniform(46, 70), rng.uniform(34, 50)
            gap = 8
            cells = []
            c, s_ = math.cos(rot), math.sin(rot)
            for i in range(nx_):
                for j in range(ny_):
                    u, v = (i - (nx_ - 1) / 2) * (cw + gap), (j - (ny_ - 1) / 2) * (ch + gap)
                    cells.append(cell(ox + u * c - v * s_, oy + u * s_ + v * c, cw * rng.uniform(.86, 1.1),
                                      ch * rng.uniform(.86, 1.1), rot))
            ok = [(pts, clear(pts, pad=4)) for pts in cells]
            ok = [(pts, m) for pts, m in ok if m is not False]
            if len(ok) < min(2, len(cells)):
                continue
            last = None
            for pts, m in ok:
                take(m)
                kind, vec = FIELD_KINDS[rng.randrange(len(FIELD_KINDS))]
                if kind == last:
                    kind, vec = FIELD_KINDS[(FIELD_KINDS.index((kind, vec)) + 2) % len(FIELD_KINDS)]
                last = kind
                fields.append((pts, kind, vec))
            break
    for _ in range(300):
        if len(fields) >= 64:
            break
        cx, cy = rng.uniform(80, W - 80), rng.uniform(80, H - 80)
        pts = _quad_field(cx, cy, rng.uniform(52, 84), rng.uniform(38, 58), rng)
        m = clear(pts, place=60)
        if m is False:
            continue
        take(m)
        kind, vec = FIELD_KINDS[rng.randrange(len(FIELD_KINDS))]
        fields.append((pts, kind, vec))
    # broadleaf woods: in the big pockets of open ground the roads, fields and places leave (most of them; the
    # rest stay open meadow)
    G = 4
    obs = np.zeros((H // G, W // G), bool)
    for (x, y) in road_pts:
        if 0 <= x < W and 0 <= y < H:
            obs[int(y) // G, int(x) // G] = True
    obs |= taken[::G, ::G][:H // G, :W // G] | zone_m[::G, ::G][:H // G, :W // G]
    yy, xx = np.mgrid[0:H // G, 0:W // G]
    for (x, y) in list(place_pts) + list(wpts[::3]):
        r = 12 if len(place_pts) else 5
        obs[(yy - y / G) ** 2 + (xx - x / G) ** 2 < r * r] = True
    dt = ndimage.distance_transform_edt(~obs) * G
    woods = []
    for i in range(40):
        j = int(dt.argmax())
        gy, gx = divmod(j, dt.shape[1])
        r = dt[gy, gx]
        if r < 40 or len(woods) >= 24:
            break
        x, y = gx * G, gy * G
        dt[(yy - gy) ** 2 + (xx - gx) ** 2 < ((r + 60) / G) ** 2] = 0
        if rng.random() < .3:
            continue                                         # this pocket stays open meadow
        rx_ = min(r - 12, 125 if len(woods) < 9 else 60)
        ry_ = min(r - 14, rx_ * rng.uniform(.55, .75))
        pts = _poly_blob(x, y, rx_, ry_, rng, n=rng.choice((7, 8, 9)), rot=rng.uniform(-.35, .35))
        m = clear(pts, road=14, place=50, water=20, zone=18, pad=6)
        if m is False:
            pts = _poly_blob(x, y, rx_ * .7, ry_ * .7, rng, n=7, rot=rng.uniform(-.35, .35))
            m = clear(pts, road=14, place=50, water=20, zone=18, pad=6)
            if m is False:
                continue
        take(m)
        woods.append(pts)
    # the meadow's soft rises
    hills = []
    for (k, dx, dy, rx_, ry_, rot, kind) in RIDGES:
        x, y = P[k]
        hills.append((x + dx, y + dy, rx_, ry_, rot, kind))
    for _ in range(600):
        if len(hills) >= 58:
            break
        x, y = rng.uniform(40, W - 40), rng.uniform(40, H - 40)
        if any(math.dist((x, y), (h_[0], h_[1])) < 150 for h_ in hills):
            continue
        hills.append((x, y, rng.uniform(46, 90), rng.uniform(24, 36), 0, 'mound'))
    return dict(farms=farms, fields=fields, woods=woods, hills=hills, fp_home=fp_home, cottages=cottages)


# ================================================================ the signs where the roads leave the heartland
def exit_signs(paths):
    """One board on the verge of every road that leaves the heartland: the region on the board, the place and
    its days in the caption (the boards' words are HTML: gen_boards.py). Each stands 40 to 190 px in from the
    edge, wherever it is clear of every place and of the other boards."""
    out = []
    hops = LD.hops()
    bw, bh = 76, 23
    taken = []
    place_pts = [P[k] for k in HEART_KEYS]

    def edge_d(p):
        return min(p[0], W - p[0], p[1], H - p[1])
    for (a, b), pts in sorted(paths.items()):
        if NODE[b]['region'] == 'borderlands':
            continue
        inside = [p for p in pts if 0 <= p[0] < W and 0 <= p[1] < H]
        if not inside:
            continue
        q_out = inside[-1]
        edge = 'n' if q_out[1] < 60 else ('s' if q_out[1] > H - 60 else ('w' if q_out[0] < 60 else 'e'))
        tip = 'e' if edge == 'e' else ('w' if edge == 'w' else None)
        best = None
        for i in range(len(pts) - 4, 3, -1):
            q = pts[i]
            if not (0 <= q[0] < W and 0 <= q[1] < H):
                continue
            ed = edge_d(q)
            if ed < 22:
                continue
            if ed > 260:
                break
            for (dx, dy, pen) in ((10, -30, 0), (-10 - bw, -30, 0), (-bw / 2, -44, 4), (-bw / 2, 14, 16), (10, 8, 12),
                                  (-10 - bw, 8, 12), (22, -30, 6), (-22 - bw, -30, 6)):
                sx, sy = int(q[0] + dx), int(q[1] + dy)
                box = (sx - 6, sy - 6, sx + bw + 6, sy + bh + 22)
                if box[0] < 4 or box[2] > W - 4 or box[1] < 2 or box[3] > H - 2:
                    continue
                if any(box[0] - 10 < pp[0] < box[2] + 10 and box[1] - 8 < pp[1] < box[3] + 6 for pp in place_pts):
                    continue
                if any(not (box[2] <= t[0] or t[2] <= box[0] or box[3] <= t[1] or t[3] <= box[1]) for t in taken):
                    continue
                if any(sx - 4 <= rp[0] <= sx + bw + 4 and sy - 4 <= rp[1] <= sy + bh + 16 for v in paths.values() for rp in v[::3]):
                    continue
                off = 20 + pen
                ny = 0
                score = abs(ed - 70) + (0 if ny <= 0 else 25) + (off - 20)
                if best is None or score < best[0]:
                    best = (score, sx, sy, box)
        if best is None:
            continue
        _, sx, sy, box = best
        taken.append(box)
        out.append(dict(road=(a, b), to=b, region=NODE[b]['region'].title(), edge=edge, sign=(sx, sy), w=bw, tip=tip,
                        ph=34, days=hops.get(b)))
    return out


# ================================================================ the render
_LAST = {}


def render(company=True, seed=11, skip=()):
    """The whole heartland as one grain-1 Canvas, and info (masks, road polylines, fords, sign boxes)."""
    rng = random.Random(seed)
    cv = Canvas(W, H)
    info = {}
    paths = road_paths()
    hidden = {k for k, n in NODE.items() if n.get('hidden')}
    vis = {k: v for k, v in paths.items() if not (set(k) & hidden)}
    sc_data = scenery(paths)
    info['scenery'] = sc_data
    signs = exit_signs(vis)
    road_samples = np.array([p for v in vis.values() for p in v[::3]])
    rtree = cKDTree(road_samples)
    place_pts = np.array([P[k] for k in HEART_KEYS])
    ptree = cKDTree(place_pts)
    wtree = cKDTree(np.array(river_pts + brook_pts))
    sign_pts = np.array([(s['sign'][0] + s['w'] / 2, s['sign'][1] + 12) for s in signs]) if signs else np.zeros((1, 2)) - 999
    stree = cKDTree(sign_pts)

    def reject(p, rd=13, pd=44, wd=24, sd=40):
        return (rtree.query(p)[0] < rd or ptree.query(p)[0] < pd or wtree.query(p)[0] < wd or stree.query(p)[0] < sd)

    # ---- ground: meadow, its rises, the fields
    TR.grass(cv, seed=4, g=1)
    az = ndimage.binary_dilation(_mask_poly(LD.ZONES['ashfall'])[::4, ::4], iterations=6)
    burnt_hills = [h_ for h_ in sc_data['hills'] if az[int(h_[1]) // 4, int(h_[0]) // 4]]
    TR.hills(cv, [(x, y, rx * 1.05, ry * 1.1, rot, kd) for (x, y, rx, ry, rot, kd) in sc_data['hills']
                  if (x, y, rx, ry, rot, kd) not in burnt_hills], 1)
    fields_any = np.zeros((H, W), bool)
    for pts, kind, vec in sc_data['fields']:
        fm = TR.field(cv, pts, kind, vec, width=4, g=1)
        if fm is not None:
            fields_any |= fm
    # ---- Ashfall's edge: dry grass, then ash and burnt ridges
    ash_zone, ash_core, ash_dry = AL.ground(cv, LD.ZONES['ashfall'], seed=21, scorch_at=58)
    ridges = []
    rr = random.Random(31)
    ys, xs = np.nonzero(ash_core[::8, ::8])
    for _ in range(40):
        if not len(xs):
            break
        j = rr.randrange(len(xs))
        x, y = xs[j] * 8, ys[j] * 8
        if any(math.dist((x, y), (q[0], q[1])) < 110 for q in ridges):
            continue
        ridges.append((x, y, rr.uniform(40, 100), rr.uniform(18, 34), 0, 'mound'))
    AL.ridges(cv, ridges)
    # the places' own rises that stand in the burnt ground get the burnt hills' light too
    AL.ridges(cv, [(x, y, rx * 1.1, ry * 1.15, rot, 'mound') for (x, y, rx, ry, rot, kd) in burnt_hills])
    # ---- trampled ground under the places that have no streets of their own
    for k in HEART_KEYS:
        if k in skip or k in ST.OWN_GROUND or k in FORDS:
            continue
        x, y = P[k]
        big = k in ('frontier_camp', 'border_fortress')
        rx, ry = (40, 26) if big else ((17, 11) if k == 'borderland_shrine' else ST.PATCH.get(LD.JOB.get(k, ''), (28, 19)))
        if rx:
            TR.patch(cv, x, y - 4, rx, ry, seed=_seed(k) % 1000, g=1)
    # ---- the river and the brook
    rd = TR.river(cv, river_pts, LD.RIVER_HW, 1)
    bd = TR.river(cv, brook_pts, LD.BROOK_HW, 1, seed=8)
    water = rd['water'] | bd['water']
    bank = rd['bank'] | bd['bank']
    # ---- roads (never over open water; fords and bridges carry them across)
    road_any = np.zeros((H, W), bool)
    road_px = {}
    for key, fine in vis.items():
        road_px[key] = fine
        m = TR.road(cv, fine, 3.1, 1, pebbles=.02, seed=len(fine), not_on=water)
        if m is not None:
            road_any |= m
    # farm tracks: a narrow dirt track from each farmstead's yard to the nearest road
    tracks = []
    for (x, y, i) in sc_data['farms']:
        hx, hy = sc_data['fp_home'][i]
        yd = next(e for e in PL.FARM_PLANS[i] if e[0] == 'yard')
        f0 = (yd[1] + yd[3] / 2 + x - hx, yd[2] + yd[4] + 2 + y - hy)
        d, j = rtree.query(f0)
        if d < 130:
            q = tuple(road_samples[j])
            tr = geo.quad_pts(f0, q, geo.quad(f0, q, 6), 40)
            m = TR.road(cv, tr, 2.2, 1, pebbles=0, seed=i, not_on=water)
            if m is not None:
                road_any |= m
            tracks.append(tr)
    info['tracks'] = tracks
    TR.ripples(cv, rd, river_pts, 1)
    TR.ripples(cv, bd, brook_pts, 1, seed=9, every=16)
    fords = []
    for key, fine in road_px.items():
        for k in key:
            if k in FORDS:
                BD.ford(cv, water, fine, width=7, flow=FORDS[k]['flow'], seed=_seed(k) % 97)
                fords.append((key, FORDS[k]['at']))
        if 'brook_mill' in key and 'lowfield' in key:
            BD.ford(cv, water, fine, width=6, flow=(-.99, .1), seed=3)
            fords.append((key, MILL_FORD))
    info['fords'] = fords
    for (sy, off) in ((470, 4), (760, -3), (1060, 3), (1320, -2)):
        TR.river_rock(cv, river_x(sy) + off - 2, sy, 1)
    # ---- ground detail
    blocked = water | road_any | fields_any | bank

    def free(p, pad=2):
        x, y = int(p[0]), int(p[1])
        return 0 <= x < W and 0 <= y < H and not blocked[max(0, y - pad):y + pad + 1, max(0, x - pad):x + pad + 1].any()
    centres = TR.poisson(rng, 0, 0, W, H, 46, 12000, free)
    tpts = TR.clustered(rng, centres, (3, 8), 8, free) + TR.poisson(rng, 0, 0, W, H, 34, 8000, free)
    TR.tufts(cv, rng, tpts, 1, only=('g', 'h'))
    TR.flowers(cv, rng, TR.poisson(rng, 0, 0, W, H, 70, 3600, lambda p: free(p) and not ash_zone[int(p[1]), int(p[0])]), g=1)
    TR.stones(cv, rng, TR.poisson(rng, 0, 0, W, H, 90, 2000, free), g=1)
    marks_at, marks_at_centres = AL.cluster_mask(ash_core & ~road_any & ~water, rng, n=80, r=16)
    AL.scars(cv, rng, marks_at, n=200, cinders=False)
    AL.cracks(cv, rng, marks_at, n=300)
    AL.drifts(cv, rng, marks_at, n=260)

    def ash_free(p, pad=2):
        x, y = int(p[0]), int(p[1])
        return free(p, pad) and ash_zone[y, x] and not ash_core[y, x]
    ac = TR.poisson(rng, 0, 0, W, H, 30, 12000, ash_free)
    TR.tufts(cv, rng, TR.clustered(rng, ac, (3, 7), 7, ash_free), 1, only=('t', 'd', 'h'))
    # reeds along the banks, clear of the crossings
    crossings_at = [MILL_W, MILL_E, BB_W, BB_E, MILL_FORD] + [b['west'] for b in BRIDGES.values()] + \
                   [b['east'] for b in BRIDGES.values()] + [f['at'] for f in FORDS.values()]
    reed_pts = []
    for pts_, hw_ in ((river_pts, LD.RIVER_HW), (brook_pts, LD.BROOK_HW)):
        Lr = TR.poly_len(pts_)
        s_ = 0.0
        while s_ < Lr:
            if rng.random() < .45:
                p, tan = TR.point_at(pts_, s_)
                side = rng.choice((-1, 1))
                nx, ny = tan[1] * side, -tan[0] * side
                for kk in range(rng.randint(2, 4)):
                    off = hw_ + rng.uniform(-1.2, 1.5)
                    q = (p[0] + nx * off + tan[0] * kk * 4, p[1] + ny * off + tan[1] * kk * 4 + 1)
                    if min(math.dist(q, c) for c in crossings_at) > 26:
                        reed_pts.append(q)
            s_ += rng.uniform(18, 34)
    TR.reeds(cv, rng, reed_pts, 1)
    # hedgerows on two of every three field edges
    hedge_pts = []
    for poly_pts, kind, vec in sc_data['fields']:
        n = len(poly_pts)
        for i in range(n):
            if (i + n) % 3 == 1:
                continue
            hedge_pts += TS.hedge(cv, poly_pts[i], poly_pts[(i + 1) % n], rng, 1)
    TS.stamp_bushes(cv, hedge_pts)

    # ---- everything that stands up, sorted north to south
    sc = PL.Scene(cv, 1, seed=seed)
    sc.roads, sc.water, sc.road_px, sc.fields = road_any, water, road_px, fields_any
    sc.ground = ('g', 'd', 'h', 't')
    sc.reink = True
    forest_m = np.zeros((H, W), bool)
    wood_m = np.zeros((H, W), bool)
    # Thornwood: pines along the top and down the right-hand side
    tz = _mask_poly(LD.ZONES['thornwood'])
    pine_pts = ST.scatter_mask(tz, 8.5, rng, lambda p: reject(p, 13, 40, 24))
    TS.forest(cv, pine_pts, rng, 8, 11, 'pine', g=1, scene=sc)
    for (x, y) in pine_pts:
        forest_m[max(0, int(y) - 8):max(0, int(y) + 9), max(0, int(x) - 8):max(0, int(x) + 9)] = True
    # the heartland's broadleaf woods
    for poly_pts in sc_data['woods']:
        pts = ST.scatter_mask(_mask_poly(poly_pts), 9, rng, lambda p: reject(p, 13, 46, 24))
        TS.forest(cv, pts, rng, 8, 13, 'leaf', g=1, scene=sc)
        for (x, y) in pts:
            wood_m[max(0, int(y) - 9):int(y) + 10, max(0, int(x) - 9):int(x) + 10] = True
    in_wood = ndimage.binary_dilation(wood_m | tz, iterations=6)
    # lone trees and bushes in the meadow (not in the ash, not in the pines)
    lone = []
    for _ in range(600):
        p = (rng.uniform(40, W - 40), rng.uniform(40, H - 40))
        x, y = int(p[1]), int(p[0])
        if (not reject(p, 14, 50, 26) and not fields_any[x, y] and not ash_zone[x, y] and not in_wood[x, y]):
            lone.append(p)
    for (x, y) in lone[:130]:
        sc.tree(x, y, rng.uniform(7, 10))

    def meadow(p):
        x, y = int(p[0]), int(p[1])
        return (free(p, 3) and not reject(p, 14, 46, 26) and not ash_zone[y, x] and not in_wood[y, x])
    for (x, y) in TR.poisson(rng, 0, 0, W, H, 70, 9000, meadow)[:190]:
        r = rng.uniform(2.8, 4.4)
        sp = TS.bush(r, rng.randint(0, 9), lift=rng.choice((0, 1)))
        sc.add(sp, x, y + (sp.h - 1) // 2, shadow=('ell', r * .7, 1, r * 1.1, r * .6))

    # Ashfall: snags and stumps where the fire went through, grey boulders on the ridges
    def ashy(p):
        x, y = int(p[0]), int(p[1])
        return 0 <= x < W and 0 <= y < H and ash_zone[y, x] and not reject(p, 12, 40, 20)
    stands = [p for p in marks_at_centres if ashy(p)] + TR.poisson(rng, 0, 0, W, H, 70, 9000, ashy)[:50]
    snag_pts = TR.clustered(rng, stands, (3, 6), 9, ashy) + TR.poisson(rng, 0, 0, W, H, 34, 9000, ashy)[:110]
    for i, (x, y) in enumerate(snag_pts):
        if not (0 <= int(y) < H and 0 <= int(x) < W):
            continue
        if ash_core[int(y), int(x)] or rng.random() < .35:
            r_ = rng.random()
            if r_ < .66:
                sc.add(bits.snag(rng.randint(9, 17), seed=i, lean=rng.choice((-1, 0, 0, 1))), x, y, shadow=('ell', 3, 1, 4, 1.6))
            elif r_ < .86:
                sc.add(bits.stump(i), x, y, shadow='house')
            else:
                sc.add(bits.charred(BD.reink(BD.fallen_oak(rng.randint(16, 24), 4))), x, y, shadow='house')
    for (x, y) in TR.poisson(rng, 0, 0, W, H, 60, 4000, ashy)[:60]:
        sc.rock(x, y, rng.uniform(3.5, 6.5))
    for (x, y) in TR.poisson(rng, 0, 0, W, H, 300, 400, lambda p: ashy(p) and ash_core[int(p[1]), int(p[0])])[:5]:
        bits.ember(cv, int(x), int(y))
        sc.later(lambda cv, x=x, y=y: PR.smoke(cv, int(x), int(y) - 1, 1, n=9))
    # ---- the places
    ST.draw_places(sc, [k for k in HEART_KEYS if k not in skip], road_px, BRIDGES, FORDS, dict(
        river_x=river_x, brook_x=brook_x, brook_y=brook_y, mill_ford=MILL_FORD))
    if 'farms' not in skip:
        for (x, y, i) in sc_data['farms']:
            hx, hy = sc_data['fp_home'][i]
            PL.lay(sc, PL.FARM_PLANS[i], x - hx, y - hy)
        for (x, y, tx, ty, n) in sc_data['cottages']:
            ST.roadside(sc, x, y, tx, ty, n, seed=int(x * 7 + y))
    # the edge signs (the boards' words are HTML)
    for e in signs:
        s = bits.edge_sign(e['w'], 23, e['ph'], e['tip'])
        sx, sy = e['sign']
        fx, fy = sx - s.board[0] + s.ax, sy - s.board[1] + s.ay
        sc.add(s, fx, fy, shadow='house')
        e['board_box'] = (sx, sy, s.board[2], s.board[3])
    info['signs'] = signs
    # the company: in the camp yard under the standard
    if company:
        cx, cy = P['frontier_camp']
        fx, fy = (cx + 2, cy + 8) if company is True else company
        for spr, dx, dy in FK.company_items(1):
            sc.add(spr, fx + dx, fy + dy, shadow=('ell', 1, 1, 5, 2))
        info['company'] = (fx, fy)
    sc.draw()
    info.update(water=water, roads=road_any, fields=fields_any, forest=forest_m & ~road_any, wood=wood_m & ~road_any,
                ash=ash_core, dry=ash_dry & ~ash_core, bank=bank, road_px=road_px, paths=paths)
    _LAST.clear()
    _LAST.update(info)
    return cv, info


def window(cv, x0, y0, w=1280, h=720):
    """A window of the heartland as its own Canvas (pixels shared with nothing: a copy)."""
    out = Canvas(w, h)
    out.ix[:] = cv.ix[y0:y0 + h, x0:x0 + w]
    return out


if __name__ == '__main__':
    import time
    t0 = time.time()
    cv, info = render()
    os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
    cv.save(os.path.join(HERE, 't', 'heart.png'))
    print('ok', round(time.time() - t0, 1), 's')
