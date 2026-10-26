"""Smuggler's Cave as 1x pixel art: a chart of chambers cut into living rock, seen from above in the map's 3/4 view.

The graph, the room centres and the passages' bends are the painted chart's (cave_graph.py, a copy of
f64-places/world_cave.py), so every glyph, plate and bracket of the UI sits where it did.

How the cut is drawn. F is the floor in GROUND coordinates (chambers + passages + the pool basin). The rock stands
HC px above it. In the 3/4 view a point z above the ground draws z px higher, so on screen:
  rock top  = ground rock seen HC px up          R(x, y) = not F(x, y + HC)
  floor     = F and not covered by the rock in front of it
  face      = the rest: the south-facing wall of rock above each floor, HC px tall, drawn in strata
Light from the north-west: the faces on a chamber's west arc (facing south-east) are a step darker, those on its east
arc a step lighter; the rock throws a hard shadow one step down onto the floor along its west and north walls.
The cave is lit evenly: no vignette, nothing darker for being deeper, no glow round the torches.

Materials: living rock in Vault (cool blue-grey, strata and joints drawn), chamber floors laid with flags in Stone,
passages trodden earth in Dirt, the seep pool in Water, cargo in Walnut. Every object is outlined in its own ramp."""
import math
import random
import zlib

import numpy as np
from scipy import ndimage

import pxs
from pxs import pal, ix, CLEAR, nb, new, put, get, kk, W, H, shift_where
import cpx
import cave_graph as G
from pxworld.canvas import Sprite

HC = 9                      # the rock's height on screen: the visible north face
SHX, SHY = 5, 3             # the rock's cast shadow on the floor (to the south-east)
RIDS = list(G.ROOMS)


def pos(rid):
    return G.pos(rid)


# ------------------------------------------------------------------ the ground plan
def chamber_shape(rid):
    """(cx, cy, rx, ry, p, phases) of a chamber in ground coordinates (its visible opening centred on the room)."""
    x, y = pos(rid)
    rng = random.Random(zlib.crc32(rid.encode()) % 9973 + 11)   # crc32, not hash(): str hash() is salted per process
    if rid == 'mouth':
        rx, ry = 40, 23
    elif G.ROOMS[rid] == 'boss':
        rx, ry = 84, 41
    else:
        rx, ry = 47, 31
    return (x, y + HC - 1, rx, ry, rng.uniform(2.1, 2.6), [rng.uniform(0, 6.283) for _ in range(4)])


def chamber_field(xx, yy, shape):
    """< 1 inside: a superellipse whose radius wobbles a little, so no chamber is a stamped ellipse."""
    cx, cy, rx, ry, p, ph = shape
    dx, dy = (xx - cx) / rx, (yy - cy) / ry
    ang = np.arctan2(dy, dx)
    wob = 1 + .06 * np.sin(3 * ang + ph[0]) + .045 * np.sin(5 * ang + ph[1]) + .025 * np.sin(7 * ang + ph[2])
    return (np.abs(dx) ** p + np.abs(dy) ** p) ** (1 / p) / wob


def passage_field(xx, yy, a, b, hw, seed):
    """Signed distance to a passage (< 0 inside): the cubic bend of the chart, wobbled, swelling and pinching."""
    pts = G.edge_pts(a, b, 48)
    pts = [(x, y + HC - 1) for x, y in pts]
    rng = random.Random(seed)
    ph, ph2 = rng.uniform(0, 6.3), rng.uniform(0, 6.3)
    out = []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        j0, j1 = max(i - 1, 0), min(i + 1, n - 1)
        dx, dy = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]
        L = math.hypot(dx, dy) or 1
        t = i / (n - 1)
        wob = 1.6 * math.sin(t * 7.5 + ph) * math.sin(t * math.pi)
        out.append((x - dy / L * wob, y + dx / L * wob))
    d, along = cpx.seg_dist(xx, yy, out)
    tot = sum(math.hypot(out[i + 1][0] - out[i][0], out[i + 1][1] - out[i][1]) for i in range(n - 1))
    t = along / max(tot, 1)
    w = hw * (1 + .14 * np.sin(t * 9 + ph2))
    return d - w


POOL = [(810, 290), (826, 279), (846, 274), (872, 276), (894, 284), (904, 297), (896, 311), (874, 318), (848, 320),
        (826, 316), (812, 305)]


def plan():
    """Ground masks: floor F, the pool basin P (part of F), passages-only Pm, chambers-only Cm, stair S."""
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    Cm = np.zeros((H, W), bool)
    for rid in RIDS + ['mouth']:
        sh = chamber_shape(rid)
        cx, cy, rx, ry = sh[:4]
        y0, y1 = int(max(0, cy - ry * 1.3)), int(min(H, cy + ry * 1.3))
        x0, x1 = int(max(0, cx - rx * 1.3)), int(min(W, cx + rx * 1.3))
        sub = chamber_field(xx[y0:y1, x0:x1], yy[y0:y1, x0:x1], sh) <= 1
        Cm[y0:y1, x0:x1] |= sub
    Pm = np.zeros((H, W), bool)
    for k, (a, b) in enumerate(G.ALL_EDGES):
        hw = 10.5 if a == 'mouth' else 9.5
        (x1, y1), (x2, y2) = pos(a), pos(b)
        bx0, bx1 = int(max(0, min(x1, x2) - 40)), int(min(W, max(x1, x2) + 40))
        by0, by1 = int(max(0, min(y1, y2) - 20)), int(min(H, max(y1, y2) + 30))
        f = passage_field(xx[by0:by1, bx0:bx1], yy[by0:by1, bx0:bx1], a, b, hw, 100 + k)
        Pm[by0:by1, bx0:bx1] |= f <= 0
    # the stair: a straight cut from the mouth up to the turf, 30 px wide
    mx, my = G.MOUTH
    S = (np.abs(xx - mx) <= 15.5) & (yy < my + HC - 8)
    # the seep: a small basin in the rock east of the elite room, its own little cut
    P = cpx.poly_mask(W, H, [(x, y + HC - 2) for x, y in cpx.catmull(POOL + POOL[:1], 6)])
    F = cpx.clean(Cm | Pm, 3) | S | P
    return F, Cm & ~P, Pm & ~Cm & ~P, S, P


# ------------------------------------------------------------------ the rock top: strata, joints, rubble
def cells(spacing, aniso, seed, x0=-24, y0=-24, x1=W + 24, y1=H + 24):
    """Voronoi labels over the stage: cells about `spacing` px across, squashed north-south by `aniso`."""
    from scipy.spatial import cKDTree
    rng = random.Random(seed)
    pts = cpx.poisson(rng, x0, y0, x1, y1, spacing, int((x1 - x0) * (y1 - y0) / spacing ** 2 * 4))
    P = np.array(pts, float)
    P[:, 1] *= aniso
    yy, xx = np.mgrid[0:H, 0:W]
    q = np.stack([xx.ravel() + .5, (yy.ravel() + .5) * aniso], 1)
    _, lab = cKDTree(P).query(q)
    return lab.reshape(H, W)


def edges_of(lab):
    """Bool masks: e = a pixel whose east or south neighbour is another cell (the joint line); after = the pixel
    just east or south of a joint (a cell's north-west lip); before = just north or west of one."""
    e = (lab != nb(lab, 1, 0, -1)) | (lab != nb(lab, 0, 1, -1))
    after = (nb(e, -1, 0, False) | nb(e, 0, -1, False)) & ~e
    before = (nb(e, 1, 0, False) | nb(e, 0, 1, False)) & ~e & ~after
    return e, after, before


def strata_field(seed=7, FH=4, sp=9, aniso=1.6):
    """The rock's beds as seen from above: bands of irregular thickness (18..46 px) running east-west, whose edges
    follow small Voronoi cells so that every edge breaks angularly, as bedded rock weathers. Returns the tone level
    map, the mask of plain bed surface ('flat') and the band index."""
    from scipy.spatial import cKDTree
    rng = random.Random(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    s = yy + 26 * cpx.smooth_noise(W, H, 200, seed + 1) + 8 * cpx.smooth_noise(W, H, 70, seed + 2) + .1 * xx
    edges = [-240.0]
    while edges[-1] < H + 240:
        edges.append(edges[-1] + rng.choice((18, 22, 26, 30, 34, 40, 46)))
    edges = np.array(edges)
    pts = cpx.poisson(random.Random(seed + 3), -24, -24, W + 24, H + 24, sp, int((W + 48) * (H + 48) / sp ** 2 * 4))
    P = np.array(pts, float)
    _, lab = cKDTree(P * [1, aniso]).query(np.stack([xx.ravel(), yy.ravel() * aniso], 1))
    lab = lab.reshape(H, W)
    cx_ = np.clip(P[:, 0].astype(int), 0, W - 1)
    cy_ = np.clip(P[:, 1].astype(int), 0, H - 1)
    B = np.searchsorted(edges, s[cy_, cx_])[lab]
    tone = {}
    for b in np.unique(B):
        r = random.Random(int(b) * 31 + seed)
        tone[int(b)] = r.choice((4, 4, 4, 3, 3, 4))
    lut_ = np.zeros(B.max() + 1, int)
    for b, v_ in tone.items():
        lut_[b] = v_
    t = lut_[B]
    keep = cpx.smooth_noise(W, H, 80, seed + 8) > -.45
    face_row = np.full((H, W), -1)
    for k in range(FH, 0, -1):
        face_row[(nb(B, 0, -k, 10 ** 6) < B) & keep] = FH - k
    up = face_row >= 0
    t[up] = np.select([face_row == 0, face_row == FH - 1, face_row == 1], [6, 1, 2], 3)[up]
    fine = (nb(B, 0, -1, 10 ** 6) < B) & ~keep
    t[fine] = np.maximum(1, t[fine] - 1)
    foot = up & ~nb(up, 0, 1, False)
    sh = nb(foot, 0, -1, False) & ~up
    t[sh] -= 1
    flat = ~up & ~fine & ~sh
    return t, flat, B


def rock_top(a, R, seed=7):
    """The rock top: bedded living rock (strata_field), each step down to the south a little cliff with a lit lip,
    a parting and a dark foot over a hard shadow; on the beds, long cracks that cross them (a groove lit on its
    south-east lip), chips that catch the light and pits that hold shade. Sparse, so the chambers stay loudest."""
    rng = random.Random(seed)
    t, flat, B = strata_field(seed)
    v = np.array([ix(kk('v', k)) for k in range(8)], np.uint8)
    a[R] = v[np.clip(t, 1, 7)][R]
    for _ in range(150):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        ang = math.pi / 2 + rng.uniform(-.7, .7)
        Lc = rng.randint(8, 30)
        seen = set()
        branch = []
        for k in range(Lc):
            if k % 4 == 0:
                ang += rng.uniform(-.5, .5)
            if k == Lc // 2 and rng.random() < .5:
                branch.append((x, y, ang + rng.choice((-1, 1)) * rng.uniform(.7, 1.2), rng.randint(4, 9)))
            x += math.cos(ang)
            y += math.sin(ang)
            px_, py_ = int(x), int(y)
            if (px_, py_) in seen or not (1 <= px_ < W - 1 and 1 <= py_ < H - 1):
                continue
            seen.add((px_, py_))
            if not (R[py_, px_] and flat[py_, px_]):
                continue
            a[py_, px_] = pal.shift_index(int(a[py_, px_]), -2)
            if (px_ + 1, py_) not in seen and R[py_, px_ + 1] and flat[py_, px_ + 1]:
                a[py_, px_ + 1] = pal.shift_index(int(a[py_, px_ + 1]), 1)
        for (bx, by, ba, n_) in branch:
            for k in range(n_):
                bx += math.cos(ba)
                by += math.sin(ba)
                px_, py_ = int(bx), int(by)
                if 1 <= px_ < W - 1 and 1 <= py_ < H - 1 and R[py_, px_] and flat[py_, px_]:
                    a[py_, px_] = pal.shift_index(int(a[py_, px_]), -2)
    CHIP = [["55", "4."], [".5", "54"], ["555", ".4."]]
    PIT = [["22.", ".55"], [".22", "255"], ["22", ".5"]]
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 17, 8000):
        x, y = int(x), int(y)
        sh_ = rng.choice(CHIP if rng.random() < .4 else PIT)
        if y + len(sh_) >= H or x + 3 >= W:
            continue
        if not all(R[y + j, x + i] and flat[y + j, x + i] for j in range(len(sh_)) for i in range(len(sh_[0]))):
            continue
        for j, row in enumerate(sh_):
            for i, ch in enumerate(row):
                if ch != '.':
                    n_ = (1 if ch == '5' else -1) if sh_ in CHIP else (-1 if ch == '2' else 1)
                    a[y + j, x + i] = pal.shift_index(int(a[y + j, x + i]), n_)
    return a


# ------------------------------------------------------------------ the floors
def flags(a, m, seed=5):
    """Chamber floors: irregular flagstones laid by the smugglers, each slab one tone, lit along its north-west lip and
    a step darker along its south-east one, set in dark joints; some slabs cracked, a few lifted out (earth showing)."""
    rng = random.Random(seed)
    lab = cells(9.5, 1.35, seed + 1)
    e, after, before = edges_of(lab)
    hsh = (lab * 2246822519 % 101)
    t = np.where(hsh < 18, 5, np.where(hsh > 90, 3, 4))
    t = np.where(after, t + 1, t)
    t = np.where(before & ~after, t - 1, t)
    key = np.array([ix(kk('t', k)) for k in range(7)], np.uint8)
    out = key[np.clip(t, 2, 6)]
    out[e] = ix('t2')
    missing = hsh == 37
    out[missing & ~e] = ix('d3')
    out[missing & ~e & nb(e, 0, -1, False)] = ix('d2')
    a[m] = out[m]
    # cracks across a few slabs
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 22, 6000):
        x, y = int(x), int(y)
        if not m[y, x] or rng.random() < .5:
            continue
        ang = rng.uniform(0, math.pi)
        for k in range(rng.randint(3, 6)):
            X, Y = int(x + math.cos(ang) * k), int(y + math.sin(ang) * k * .7)
            if 0 <= X < W - 1 and 0 <= Y < H and m[Y, X] and not e[Y, X] and pal.RAMP_OF[a[Y, X]] == 't':
                a[Y, X] = ix('t2')
                if m[Y, X + 1] and not e[Y, X + 1]:
                    a[Y, X + 1] = pal.shift_index(int(a[Y, X + 1]), 1)


def earth(a, m, rng, worn=None):
    """Passage floors: trodden earth, a paler worn track down the middle, ruts and pebbles drawn as shapes."""
    import ground as GR
    a[m] = ix('d4')
    if worn is not None:
        a[m & worn] = ix('d5')
    GR.dirt_texture(a, m, rng, 1.3)
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 13, 9000):
        x, y = int(x), int(y)
        if m[y, x] and m[min(H - 1, y + 3), min(W - 1, x + 4)]:
            r_ = rng.random()
            GR.pebble(a, x, y, rng, big=r_ < .18, ramp='t' if r_ < .6 else 'd', base=0 if r_ < .6 else 1)


# ------------------------------------------------------------------ the faces
def faces(a, face, R, floor, seed=3):
    """The north walls, HC px tall, as layered rock: a lit lip where the top turns down, three beds of varying
    thickness whose partings wander a pixel along the wall, now and then a joint through one or two beds (lit on its
    west side), a dark foot. Tone by facing: west arcs (facing south-east) a step down, east arcs a step up."""
    rng = random.Random(seed)
    run_top = np.zeros((H, W), int)
    run_len = np.zeros((H, W), int)
    for x in range(W):
        col = face[:, x]
        idx = np.nonzero(col)[0]
        if not len(idx):
            continue
        runs = np.split(idx, np.nonzero(np.diff(idx) > 1)[0] + 1)
        for r in runs:
            run_top[r, x] = np.arange(len(r))
            run_len[r, x] = len(r)
    foot = np.zeros((H, W), int)
    fy = np.nonzero(face)[0]
    foot[face] = fy - run_top[face] + run_len[face]
    slope = np.zeros((H, W))
    for dx in (-3, 3):
        f2 = nb(foot, dx, 0, 0)
        ok = face & (f2 > 0)
        slope[ok] += np.sign(dx) * (f2[ok] - foot[ok])
    slope /= 6.0
    base = np.full((H, W), 3)
    base[slope < -.35] = 2
    base[slope > .35] = 4
    base[slope > 1.4] = 5
    # bed partings: two wandering lines down the wall
    p1 = 3 + np.round(cpx.smooth_noise(W, H, 34, seed + 1) * 1.2).astype(int)
    p2 = 6 + np.round(cpx.smooth_noise(W, H, 26, seed + 2) * 1.1).astype(int)
    rt = run_top
    t = base.copy()
    t[(rt >= 1) & (rt < p1)] += 1                    # the top bed, nearest the light
    t[rt > p2] -= 1                                  # the bottom bed, in the floor's shadow
    t[(rt == p1) | (rt == p2)] = base[(rt == p1) | (rt == p2)] - 1
    t[rt == 0] = base[rt == 0] + 2
    t[rt == run_len - 1] = 1
    v = np.array([ix(kk('v', k)) for k in range(8)], np.uint8)
    a[face] = v[np.clip(t, 1, 7)][face]
    # joints: now and then, a crack through one or two beds, lit on its west side
    x = 0
    while x < W - 1:
        x += rng.randint(16, 44)
        if x >= W - 1:
            break
        idx = np.nonzero(face[:, x])[0]
        if not len(idx):
            continue
        for run in np.split(idx, np.nonzero(np.diff(idx) > 1)[0] + 1):
            if len(run) < 7:
                continue
            j0 = rng.choice((1, int(p1[run[0], x]) + 1))
            j1 = min(len(run) - 1, j0 + rng.randint(2, 5))
            for j in range(j0, j1):
                y = run[j]
                a[y, x] = ix('v1')
                if face[y, x - 1]:
                    a[y, x - 1] = pal.shift_index(int(a[y, x - 1]), 1)


# ------------------------------------------------------------------ props
def boulder(r, seed=0, ramp='v', squash=.7):
    """A fallen block of the cave's rock, faceted, lit from the north-west, outlined in its own darkest step."""
    from pxworld import props as PR
    size = int(2 * r + 6)
    c = size / 2
    M = PR.blob_mask(size, size, c, c, r, r * squash, seed, n=7 if r < 4 else 9, jag=.16)
    s = Sprite(size, size, int(c), int(c + r * squash))
    if r < 3:
        yy, xx = np.mgrid[0:size, 0:size]
        t = np.where((yy + xx * .6) < (c * 1.55), ix(f'{ramp}5'), ix(f'{ramp}3'))
        s.ix[M] = t[M]
    else:
        sh = PR.voronoi_facets(M, seed, ramp, spacing=max(2.6, r * .7), tones=(6, 5, 4, 3, 2))
        s.ix[M] = sh[M]
    bot = M & ~nb(M, 0, 1)
    s.ix[bot] = ix(f'{ramp}2')
    pxs.cpx.selout(s)
    return s.trimmed()


def crate(w=12, h=7, top=4, seed=0):
    """A cargo crate in 3/4 view: a lit lid of boards, a front of planks with a diagonal brace, outlined w0."""
    s = new(w + 2, h + top + 2, (w + 2) // 2, h + top)
    for i in range(w):
        for j in range(top):
            k = 'w5' if j < top - 1 else 'w4'
            if i % 4 == 3:
                k = 'w4' if j < top - 1 else 'w3'
            if j == 0:
                k = 'w6' if i % 4 != 3 else 'w5'
            put(s, 1 + i, 1 + j, k)
    for i in range(w):
        for j in range(h):
            k = 'w4' if j % 3 != 2 else 'w3'
            if i in (0, w - 1):
                k = 'w3'
            put(s, 1 + i, 1 + top + j, k)
    for i in range(1, w - 1):                         # the brace, corner to corner
        j = int(round((h - 1) * (1 - i / (w - 1))))
        put(s, 1 + i, 1 + top + j, 'w2')
        if j + 1 < h:
            put(s, 1 + i, 1 + top + j + 1, 'w5')
    for i in range(w):
        put(s, 1 + i, top + h, 'w2')
    cpx.selout(s)
    return s.trimmed()


def barrel(h=11, w=9):
    """A cask standing: its lid an ellipse lit at the back, staves lit on the west, two iron hoops."""
    s = new(w + 2, h + 2, (w + 2) // 2, h)
    lid = 3
    for i in range(w):
        f = i / (w - 1)
        for j in range(h):
            if j < lid:
                if (j == 0 and i in (0, w - 1)):
                    continue
                k = 'd5' if j == 1 else 'd4'
                if j == 0:
                    k = 'w5'
                put(s, 1 + i, 1 + j, k)
                continue
            k = 'w5' if f < .3 else ('w4' if f < .7 else 'w3')
            if i % 2 == 1 and f > .2:
                k = pal.KEYS[pal.shift_index(ix(k), -1)]
            if j in (lid + 1, h - 3):
                k = 'v5' if f < .35 else ('v4' if f < .7 else 'v3')
            if j == h - 1:
                k = 'w2'
            put(s, 1 + i, 1 + j, k)
    put(s, 1, 1 + h - 1, CLEAR)
    put(s, w, 1 + h - 1, CLEAR)
    cpx.selout(s)
    return s.trimmed()


def chest(w=14):
    """A strongbox: a rounded lid lit along its crown, brass straps, a lock plate."""
    rows = [
        ".66666666666.",
        "6555555555554",
        "5555555555554",
        "4444444444443",
        "2222222222222",
        "4444444444443",
        "4444444444443",
        "3333333333332",
    ]
    km = {'6': 'w6', '5': 'w5', '4': 'w4', '3': 'w3', '2': 'w2'}
    s = new(len(rows[0]) + 2, len(rows) + 2, (len(rows[0]) + 2) // 2, len(rows))
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.':
                put(s, 1 + i, 1 + j, km[ch])
    for x in (3, 10):
        for j in range(len(rows)):
            put(s, 1 + x, 1 + j, 'o4' if j < 3 else 'o3')
        put(s, 1 + x, 1, 'o5')
    put(s, 7, 5, 'o5'); put(s, 7, 6, 'o3'); put(s, 7, 7, 'k0')
    cpx.selout(s)
    return s.trimmed()


def bedroll():
    """A rolled bedroll and a ring of cold stones round grey ash: a rest room."""
    rows = [
        "..ccccccccccc.......",
        ".c55545554555c..s.s.",
        "c4434443444344c.s.ss",
        "c3323332333233csaaas",
        ".c22c2222c2222c.saas",
        "..cc.cccc.cccc...ss.",
    ]
    km = {'c': 'm1', '5': 'm4', '4': 'm3', '3': 'm3', '2': 'm2', 's': 't4', 'a': 't3'}
    s = new(len(rows[0]) + 2, len(rows) + 2, 8, len(rows))
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.':
                put(s, 1 + i, 1 + j, km[ch])
    for i in (3, 9):            # the straps
        for j in range(1, 5):
            put(s, 1 + i, 1 + j, 'w2' if j > 1 else 'w4')
    return s.trimmed()


def fire_ring(cold=True):
    """Stones round a bed of ash, no flame (the rest rooms' fires are long out)."""
    rows = [
        "..5544..",
        ".4.bb.3.",
        "5bbaabb3",
        "4baaaab3",
        ".3bbbb2.",
        "..3322..",
    ]
    km = {'5': 't5', '4': 't4', '3': 't3', '2': 't2', 'b': 'b1', 'a': 'b2'}
    s = new(len(rows[0]) + 2, len(rows) + 2, 5, len(rows))
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.':
                put(s, 1 + i, 1 + j, km[ch])
    cpx.selout(s)
    return s.trimmed()


def torch():
    """A pitch torch in an iron bracket on the wall: a three-tone flame, no glow (paint, not light)."""
    rows = [
        "..y..",
        ".yo..",
        ".ooy.",
        "yoOoy",
        ".oOx.",
        "..x..",
        "..w..",
        ".iwi.",
        "..w..",
        "..w..",
    ]
    km = {'y': 'o6', 'o': 'o5', 'O': 'o6', 'x': 'x4', 'w': 'w3', 'i': 'v2'}
    s = new(7, len(rows) + 2, 3, len(rows))
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.':
                put(s, 1 + i, 1 + j, km[ch])
    # outline the stick and bracket only; the flame keeps its own edge
    m = s.ix != CLEAR
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    low = np.zeros_like(rg)
    low[7:, :] = True
    s.ix[rg & low] = ix('w0')
    return s


def rag_flag(h=34):
    """The Cargo Crew's black rag on a pole: a ragged fly, a bone saltire; foot = the pole's base."""
    W_, H_ = 22, h + 3
    s = new(W_, H_, 2, H_ - 1)
    for y in range(1, H_):
        put(s, 1, y, 'v1'); put(s, 2, y, 'w4' if y % 6 else 'w3'); put(s, 3, y, 'v1')
    put(s, 2, 0, 'v5')
    fly = [
        "kkkkkkkkkkkkkkkkk",
        "k222223322222222k",
        "k2b2222222222b22k",
        "k22b22222222b222.",
        "k222b222222b222k.",
        "k2222b2222b2222kk",
        "k22222b22b222222k",
        "k222222bb222222k.",
        "k22222b22b22222k.",
        "k2222b2222b2222kk",
        "k222b222222b2222k",
        "k22b2222222kb22k.",
        "k2222222222k.kk..",
        "k22kk222kkk......",
        "kkk..kkk.........",
    ]
    km = {'k': 'v0', '2': 'v2', '3': 'v3', 'b': 'b4'}
    for j, row in enumerate(fly):
        for i, ch in enumerate(row):
            if ch != '.':
                put(s, 4 + i, 3 + j, km[ch])
    return s


def bootprints(a, floor, path_pts, rng):
    """A worn line of boot-prints down the walked passages: a left and a right print by turns, one step darker."""
    for i in range(3, len(path_pts) - 3, 4):
        (x0, y0), (x1, y1) = path_pts[i], path_pts[i + 1]
        ang = math.atan2(y1 - y0, x1 - x0)
        side = 2.6 if (i // 4) % 2 else -2.6
        px_, py_ = x0 - math.sin(ang) * side, y0 + math.cos(ang) * side
        X, Y = int(round(px_)), int(round(py_))
        horiz = abs(math.cos(ang)) > .7
        cells = [(0, 0), (1, 0), (2, 0)] if horiz else [(0, 0), (0, 1), (1, 1) if math.cos(ang) > 0 else (-1, 1)]
        for (dx, dy) in cells:
            if 0 <= Y + dy < H and 0 <= X + dx < W and floor[Y + dy, X + dx]:
                a[Y + dy, X + dx] = pal.shift_index(int(a[Y + dy, X + dx]), -1)


# ------------------------------------------------------------------ the whole cave
PROPS = {   # (kind, dx, dy) from the room centre; dy is the prop's foot on the floor
    'r0c0': [('crate', -34, 20), ('barrel', 32, 6)],
    'r0c1': [('barrel', -30, 18), ('barrel', -21, 21)],
    'r0c3': [('crate', 26, 22), ('crate', 30, 9)],
    'r1c1': [('bedroll', -38, 18)],
    'r2c1': [('crate', -34, 20)],
    'r3c1': [('chest', 26, 22)],
    'r3c2': [('crate', -34, 22), ('barrel', 32, 4)],
    'r3c3': [('bedroll', -40, 18)],
    'r4c0': [('crate', -34, 20), ('crate', 26, 22)],
    'r4c1': [('chest', 26, 22)],
    'r4c2': [('barrel', 32, 14)],
    'r4c3': [('crate', -34, 18)],
    'r5c1': [('bedroll', -40, 16)],
    'r5c2': [('bedroll', 10, 22)],
    'r5c3': [('bedroll', -40, 18)],
    'r6c0': [('rag', 24, 2), ('crate', -62, 26), ('crate', -58, 12), ('barrel', 56, 22), ('barrel', 65, 10),
             ('crate', 40, 30), ('crate', -30, 32)],
}
TORCHES = ['mouth', 'r0c1', 'r1c1', 'r2c2', 'r3c2', 'r4c1', 'r4c3', 'r5c2', 'r6c0']


def render(seed=36):
    rng = random.Random(seed)
    F, Cm, Pm, S, P = plan()
    Rs = np.ones((H, W), bool)
    Rs[:H - HC] = ~F[HC:]
    floor = F & ~Rs
    face = ~Rs & ~F
    a = np.zeros((H, W), np.uint8)
    rock_top(a, Rs)
    # ---- the surface where the stair comes out: turf over the rock, sunlit
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    lens = (yy < 16 + 7 * np.cos((xx - 640) / 132 * 1.2) - ((xx - 640) / 122) ** 2 * 16 + 1.5 * cpx.smooth_noise(W, H, 12, 3)) & Rs
    lens = cpx.clean(lens, 3)
    import ground as GR
    a[lens] = ix('g5')
    a[lens & (cpx.smooth_noise(W, H, 30, 5) > .3)] = ix('g6')
    GR.tufts(a, rng, [p for p in cpx.poisson(rng, 500, 0, 780, 30, 6, 900) if lens[int(p[1]), int(p[0])]], .8)
    # the turf's cut edge: two rows of soil under the grass, blades hanging over it, the rock in its shadow
    soil1 = Rs & ~lens & nb(lens, 0, -1, False)
    soil2 = Rs & ~lens & nb(lens, 0, -2, False) & ~soil1
    a[soil1] = ix('d3')
    a[soil2] = ix('d2')
    shade_ = Rs & ~lens & nb(lens, 0, -3, False) & ~soil1 & ~soil2
    shift_where(a, shade_, -1, ('v',))
    ys_, xs_ = np.nonzero(lens & ~nb(lens, 0, 1, True))
    for y, x in zip(ys_, xs_):
        h_ = GR.SPIKES[(x * 7 + 3) % len(GR.SPIKES)] // 2
        for k in range(1, h_ + 1):
            if y + k < H and soil1[y + k - 1 if k > 1 else y + 1, x] or (y + k < H and (soil1[y + k, x] or soil2[y + k, x])):
                a[y + k, x] = ix('g4' if k < h_ else 'g3')
    # moss on the rock, thick under the turf's lip and along the wall rims nearest the light, thinning out
    from scipy import ndimage as _nd
    dist_turf = _nd.distance_transform_edt(~lens)
    for (x, y) in cpx.poisson(rng, 300, 0, 980, 260, 7, 9000):
        x, y = int(x), int(y)
        d = dist_turf[y, x]
        if rng.random() > 1.1 - d / 70:
            continue
        t_ = rng.choice(pxs_moss())
        if y + len(t_) >= H or x + len(t_[0]) >= W:
            continue
        ok = all(Rs[y + j, x + i] and not lens[y + j, x + i] and not soil1[y + j, x + i] and not soil2[y + j, x + i]
                 for j in range(len(t_)) for i in range(len(t_[0])))
        if not ok:
            continue
        for j, row in enumerate(t_):
            for i, ch in enumerate(row):
                if ch != '.':
                    a[y + j, x + i] = ix(f'm{ch}')
    # ---- floors
    flags(a, floor & cpx.clean(ndimage.binary_dilation(Cm, iterations=2), 3) & ~S & ~P, seed=11)
    track = np.zeros((H, W), bool)
    for (p_, q_) in G.ALL_EDGES:
        pts = [(x, y + HC - 1) for x, y in G.edge_pts(p_, q_, 40)]
        bx0 = int(max(0, min(p[0] for p in pts) - 8)); bx1 = int(min(W, max(p[0] for p in pts) + 8))
        by0 = int(max(0, min(p[1] for p in pts) - 8)); by1 = int(min(H, max(p[1] for p in pts) + 8))
        d, _ = cpx.seg_dist(xx[by0:by1, bx0:bx1], yy[by0:by1, bx0:bx1], pts)
        track[by0:by1, bx0:bx1] |= d < 3.2
    pf = floor & ~ndimage.binary_dilation(Cm, iterations=2) & ~S & ~P
    earth(a, pf, rng, worn=track)
    # ---- the stair: treads lit, risers in shade, a step every 6 rows from the turf down to the hall
    mx, my = G.MOUTH
    st = floor & S
    ys, xs = np.nonzero(st)
    for y, x in zip(ys, xs):
        r = (y - 0) % 6
        k = 't5' if r < 3 else ('t6' if r == 3 else ('t3' if r == 4 else 't2'))
        if abs(x - mx) > 13:
            k = 't3' if x < mx else 't4'
        a[y, x] = ix(k)
    # ---- the seep pool: dark water in its basin, the far edge in the wall's shadow, wavelets, a glint
    pool = floor & P
    a[pool] = ix('a2')
    top_rows = pool & ~nb(pool, 0, -2, True)
    a[top_rows] = ix('a1')
    for (rx_, ry_, L) in ((826, 298, 12), (856, 308, 9), (878, 297, 7), (842, 315, 8), (868, 318, 5)):
        y_ = ry_ + HC - 2
        for i in range(L):
            if pool[y_, rx_ + i] and pool[y_ + 1, rx_ + i]:
                a[y_, rx_ + i] = ix('a4' if L // 3 <= i < L - L // 3 else 'a3')
                a[y_ + 1, rx_ + i + 1] = ix('a1')
    for (gx, gy) in ((836, 293), (837, 293), (838, 292)):
        if pool[gy + HC - 2, gx]:
            a[gy + HC - 2, gx] = ix('a6')
    shore = pool & ~nb(pool, 0, 1, True)
    a[shore] = ix('a4')
    # ---- the faces, then the edges where rock meets floor
    faces(a, face, Rs, floor)
    rim_n = Rs & nb(floor, 0, -1, False)                 # the rock's far edge, floor beyond it to the north
    a[rim_n] = ix('v1')
    below = Rs & nb(rim_n, 0, -1, False) & ~rim_n        # and just inside it, the edge catching the light
    shift_where(a, below, 1, ('v',))
    rim_w = Rs & nb(floor, -1, 0, False) & ~rim_n        # floor to the west: the edge faces west, lit
    a[rim_w] = ix('v5')
    rim_e = Rs & nb(floor, 1, 0, False) & ~rim_n         # floor to the east: the edge faces east, shade
    a[rim_e] = ix('v1')
    lipf = Rs & nb(face, 0, 1, False)                    # the rim over a face
    a[lipf] = ix('v5')
    # ---- the rock's hard shadow on the floor, to the south-east
    rock_g = ~F
    sh = np.zeros((H, W), bool)
    for k in range(1, 7):
        sh |= nb(rock_g, -int(round(SHX * k / 6)), -int(round(SHY * k / 6)), True)
    sh &= floor
    shift_where(a, sh & ~pool, -1, ('t', 'd'))
    shift_where(a, sh & pool, -1, ('a',))
    # ---- the walked way: boot-prints
    for p_, q_ in zip(G.WALKED, G.WALKED[1:]):
        pts = [(x, y + HC - 1) for x, y in G.edge_pts(p_, q_, 60)]
        bootprints(a, floor & ~S, pts, rng)
    # ---- glyph contact shadows: the floor a step darker under each room's mark
    for rid in G.ROOMS:
        if rid == G.HERE:
            continue
        x, y = pos(rid)
        m = cpx.ell_mask(W, H, x + 2, y + 11, 11, 3.4)
        shift_where(a, m & floor, -1, ('t', 'd'))
    st_ = pxs.Stage(a, ground_ramps=('t', 'd', 'v'))
    # ---- rubble at the foot of the walls, loose blocks on the rock
    face_foot = face & ~nb(face, 0, 1, True)
    fy_, fx_ = np.nonzero(face_foot)
    order = list(range(len(fx_)))
    rng.shuffle(order)
    placed = []
    for i in order[:900]:
        x, y = int(fx_[i]), int(fy_[i]) + 2
        if any(abs(x - px_) < 22 and abs(y - py_) < 12 for px_, py_ in placed):
            continue
        if not floor[min(H - 1, y), x] or S[y, x]:
            continue
        near_glyph = any(abs(x - pos(r)[0]) < 18 and abs(y - pos(r)[1]) < 16 for r in G.ROOMS)
        if near_glyph or rng.random() < .6:
            continue
        placed.append((x, y))
        for k in range(rng.choice((1, 2, 3))):
            r_ = rng.choice((2.2, 2.8, 3.4, 4.2))
            b = boulder(r_, seed=rng.randint(0, 999))
            bx, by = x + rng.randint(-5, 5), y + rng.randint(0, 3)
            if floor[min(H - 1, by), min(W - 1, bx)]:
                st_.add(b, bx, by)
                st_.throw_sprite(b, bx, by)
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 90, 900):       # loose blocks on the rock, fallen in little heaps
        x, y = int(x), int(y)
        if rng.random() < .5:
            continue
        for k in range(rng.choice((1, 2, 3, 3))):
            bx, by = x + rng.randint(-9, 9), y + rng.randint(-3, 4)
            if not (0 <= by < H - 8 and 0 <= bx < W) or not Rs[by, bx] or lens[by, bx] or not Rs[by + 6, bx]:
                continue
            r_ = rng.choice((2.4, 3.0, 3.6, 4.6, 5.8)) if k == 0 else rng.choice((2.0, 2.4, 3.0))
            b = boulder(r_, seed=rng.randint(0, 999))
            st_.add(b, bx, by)
            st_.throw_sprite(b, bx, by)
    # ---- outcrops: bigger knuckles of the rock standing proud of the beds, away from the chambers, so the rock is not
    #      one repeating texture; each faceted, lit north-west, with its hard shadow on the beds
    dist_floor = ndimage.distance_transform_edt(~(floor | face))
    placed_o = []
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 70, 2000):
        x, y = int(x), int(y)
        if not (20 <= y < H - 20) or not Rs[y, x] or lens[y, x] or dist_floor[y, x] < 30:
            continue
        if rng.random() < .55 or any(abs(x - a_) < 80 and abs(y - b_) < 60 for a_, b_ in placed_o):
            continue
        placed_o.append((x, y))
        r_ = rng.choice((8, 9, 10, 12, 14))
        b = boulder(r_, seed=rng.randint(0, 999), squash=.62)
        st_.add(b, x, y)
        st_.throw_sprite(b, x, y)
        for k in range(rng.choice((1, 2, 2, 3))):            # a few fallen pieces round its foot
            bx, by = x + rng.choice((-1, 1)) * rng.randint(int(r_ * .8), int(r_ * 1.4)), y + rng.randint(-2, 4)
            if 0 <= by < H and 0 <= bx < W and Rs[by, bx]:
                b2 = boulder(rng.choice((2.2, 2.8, 3.4)), seed=rng.randint(0, 999))
                st_.add(b2, bx, by)
                st_.throw_sprite(b2, bx, by)
    # ---- cargo and kit on the chamber floors
    MK = {'crate': lambda: crate(seed=rng.randint(0, 9)), 'barrel': barrel, 'chest': chest, 'bedroll': bedroll,
          'rag': rag_flag}
    for rid, items in PROPS.items():
        x, y = pos(rid)
        for (kind, dx, dy) in items:
            sp = MK[kind]()
            st_.add(sp, x + dx, y + dy)
            st_.throw_sprite(sp, x + dx, y + dy, zcap=10 if kind == 'rag' else None)
            if kind == 'bedroll':
                fr = fire_ring()
                st_.add(fr, x + dx + 32, y + dy - 1)
    # ---- torches on the north walls
    for rid in TORCHES:
        x, y = pos(rid)
        xt = x + (-18 if rid in ('r2c2', 'r6c0') else 14)
        col = np.nonzero(face[:, xt])[0]
        col = col[(col > y - 60) & (col < y)]
        if not len(col):
            continue
        y_face_mid = int(col[len(col) // 2]) + 2
        st_.add(torch(), xt, y_face_mid, z=y_face_mid - 40)
    return st_, dict(F=F, floor=floor, face=face, rock=Rs, lens=lens)


def pxs_moss():
    return [["...44...", "..43332.", ".4333322"], ["..44..", ".43332", "433221"], ["..4...", ".4332.", "43332."],
            [".44.", "4332"], ["44", "32"]]


def company(st_, x, y):
    """The map's three minis under the standard, at the map's scale, standing in the elite room."""
    from pxworld import folk as FK
    st_.throw_ell(x + 2, y + 1, 25, 4)                        # the group's contact shadow, as the map gives it
    for spr, dx, dy in FK.company_items(1):
        st_.add(spr, x + dx, y + dy)
        st_.throw_sprite(spr, x + dx, y + dy)


if __name__ == '__main__':
    import os
    st_, info = render()
    hx, hy = pos(G.HERE)
    company(st_, hx - 2, hy + 10)
    im = st_.render().convert('RGB')
    os.makedirs(os.path.join(pxs.HERE, 't'), exist_ok=True)
    im.save(os.path.join(pxs.HERE, 't', 'cave.png'))
    pxs.zoom(im, (560, 160, 320, 200), 4, os.path.join(pxs.HERE, 't', 'cave_z1.png'))
    print('ok')
