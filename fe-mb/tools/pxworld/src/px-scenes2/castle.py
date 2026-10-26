"""The Iron Throne, taken: the inner bailey at the board sprites' own scale (1 art px = 1 screen px, a person about
140 px tall, so a metre is about 80 px and a dressed block about 48 x 24).

The camera stands in the courtyard looking north, in the 3/4 view PxCamp uses: verticals drawn at full height, the
ground receding up the screen. From west to east: a drum tower (its courses drawn as arcs that sag toward the viewer),
a stretch of curtain wall with its wall-walk and crenellated parapet, and the gatehouse, which stands forward of the
curtain, with the great arch, the portcullis raised into its slot (its iron teeth showing under the arch) and the
gate passage running through to the ash plain outside. The plain shows through the crenels and above the parapet.

Light from the north-west: the south faces of the masonry are the middle step, the drum is lit on its west and in
shade on its east, and every wall throws a hard shadow one step down onto the flags to the south-east.
Materials: iron-grey ashlar in Vault, the courtyard flags in Stone, the plain in Bone (ash) with Moss scrub, iron in
Vault's darks, wood in Walnut. Everything is outlined in its own ramp's darkest step."""
import math
import random

import numpy as np
from scipy import ndimage

import pxs
from pxs import pal, ix, CLEAR, nb, new, put, get, kk, W, H, shift_where
import cpx
from pxworld.canvas import Sprite

# ------------------------------------------------------------------ the plan (stage px)
WALL_FOOT = 420             # the curtain wall's foot line on the flags
GATE_FOOT = 452             # the gatehouse stands forward of the curtain
DRUM = dict(cx=666, r=106, foot=454, sag=24)
CURTAIN = (772, 968)        # x span of the curtain between the drum and the gatehouse
WALK = 214                  # the wall-walk's front edge (the top of the curtain's face)
WALK_D = 20                 # the wall-walk floor, seen from above
MERLON_TOP = 74
SILL = 136
ARCH = dict(cx=1112, hw=96, spring=282, foot=GATE_FOOT)
OUT_FLOOR = 296             # inside the arch: the passage floor runs from the foot up to here, then the plain


def v(level):
    return ix(kk('v', level))


# ------------------------------------------------------------------ ground: the ash plain outside, the flags inside
def ash_plain(a, rng):
    """Outside the walls: ash-grey ground (Bone's low steps) with darker drifts, a rutted road north from the gate,
    scrub tufts in Moss and a scatter of basalt stones. Drawn over the whole stage first; the castle covers most of it."""
    import ground as GR
    a[:] = ix('b1')
    n = cpx.smooth_noise(W, H, 90, 41) + .4 * cpx.smooth_noise(W, H, 30, 42)
    a[cpx.clean(n < -.62, 5)] = ix('b0')
    a[cpx.clean(n > .66, 5)] = ix('b2')
    # the road out of the gate, north
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    up = np.clip(OUT_FLOOR - yy, 0, None)
    road_x = ARCH['cx'] - 8 + up * .62 + up ** 2 * .0016    # the track turns away to the north-east beyond the gate
    road = (np.abs(xx - road_x) < 38 - up * .08) & (yy < OUT_FLOOR + 4)
    a[road] = ix('b2')                                     # an ash track: the plain's own dust, beaten paler
    for off in (-14, 13):
        rut = road & (np.abs(xx - road_x - off * (1 - up / 500)) < 1.6)
        a[rut] = ix('b1')
        a[road & nb(rut, 0, -1, False) & ~rut] = ix('b3')
    for (x, y) in cpx.poisson(rng, 0, 0, W, OUT_FLOOR, 13, 4000):
        x, y = int(x), int(y)
        if road[y, x]:
            continue
        r_ = rng.random()
        if r_ < .5:
            # scrub: a dull tuft of moss-green blades, a root shadow on the ash
            for (dx, dy), code in GR.tuft_shape(rng, rng.uniform(.6, 1.0)).items():
                X, Y = x + dx, y + dy
                if 0 <= X < W and 0 <= Y < H:
                    a[Y, X] = ix({'L': 'm3', 'T': 'm4', 'S': 'm2', 'B': 'm1', 'R': 'b0'}[code])
        elif r_ < .65:
            GR.pebble(a, x, y, rng, big=r_ < .56, ramp='v', base=0)


def court_flags(a, m, rng, seed=3):
    """The bailey's flags: big slabs (40..74 x 18..23 px, about 0.5..0.9 m) in courses that wander, each lit on its
    north and west lips and a step darker on its south and east, set in two-pixel joints; worn hollows, cracks,
    a chipped corner or two, moss in the joints along the wall foot."""
    R = random.Random(seed)
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    sub = np.full((y1 - y0, x1 - x0), ix('t2'), np.uint8)
    y = y0 - R.randint(0, 6)
    row = 0
    while y < y1:
        ch = R.choice((19, 21, 22, 23))
        x = x0 - R.randint(0, 40)
        while x < x1:
            w = R.randint(40, 74)
            base = R.choice((4, 4, 4, 5, 5, 3))
            sk = R.uniform(-.03, .03)
            for j in range(ch - 2):
                for i in range(w - 2):
                    X, Y = x + i, y + j + int(round(i * sk))
                    if not (x0 <= X < x1 and y0 <= Y < y1):
                        continue
                    lv = base
                    if j == 0 or i == 0:
                        lv = base + 1
                    elif j >= ch - 4 or i == w - 3:
                        lv = base - 1
                    sub[Y - y0, X - x0] = ix(kk('t', lv))
            # the slab's own marks: a worn hollow (a lit lip under a shaded one), a crack, a chipped corner
            if R.random() < .35:
                hx, hy = x + R.randint(8, w - 18), y + R.randint(4, ch - 9)
                for i in range(R.randint(6, 12)):
                    for (jj, dl) in ((0, -1), (1, -1), (2, 1)):
                        X, Y = hx + i, hy + jj
                        if x0 <= X < x1 and y0 <= Y < y1 and pal.RAMP_OF[sub[Y - y0, X - x0]] == 't':
                            if 0 < i < 11 or jj == 1:
                                sub[Y - y0, X - x0] = pal.shift_index(int(sub[Y - y0, X - x0]), dl)
            if R.random() < .3:
                cx = x + R.randint(6, w - 8)
                cyy = y + 1
                for j in range(ch - 4):
                    cx += R.choice((0, 0, 1, -1))
                    X, Y = cx, cyy + j
                    if x0 <= X < x1 - 1 and y0 <= Y < y1:
                        sub[Y - y0, X - x0] = ix('t2')
                        sub[Y - y0, X + 1 - x0] = pal.shift_index(int(sub[Y - y0, X + 1 - x0]), 1)
            if R.random() < .2:
                for (dx, dy) in ((w - 3, 0), (w - 4, 0), (w - 3, 1)):
                    X, Y = x + dx, y + dy
                    if x0 <= X < x1 and y0 <= Y < y1:
                        sub[Y - y0, X - x0] = ix('t2')
            x += w
        y += ch
        row += 1
    mm = m[y0:y1, x0:x1]
    a[y0:y1, x0:x1][mm] = sub[mm]


# the gate road: from the passage, out through the arch's foot and down to the south-west, where the keep would be
ROAD = [(1112, 300), (1112, 452), (1040, 500), (930, 548), (800, 604), (680, 668), (590, 730)]
ROAD_HW = 92


def road_mask():
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    pts = cpx.catmull(ROAD, 10)
    d, along = cpx.seg_dist(xx, yy, pts)
    hw = ROAD_HW + 7 * cpx.wobble(5, 160)(along)
    return d < hw


def path_flags(a, m, seed=4, spacing=24, aniso=1.7):
    """Big irregular flags laid along the gate road (about 0.4..0.7 m): Voronoi slabs wider than they are deep, as
    seen at this angle, each one tone, lit on its north-west lip, a step darker on its south-east, in one-pixel joints
    with a shaded pixel under each; some slabs cracked, a few sunk a step and holding a skin of dust."""
    from scipy.spatial import cKDTree
    rng = random.Random(seed)
    pts = cpx.poisson(rng, -30, -30, W + 30, H + 30, spacing, int((W + 60) * (H + 60) / spacing ** 2 * 4))
    P = np.array(pts, float)
    yy, xx = np.mgrid[0:H, 0:W]
    _, lab = cKDTree(P * [1, aniso]).query(np.stack([xx.ravel() + .5, (yy.ravel() + .5) * aniso], 1))
    lab = lab.reshape(H, W)
    e = (lab != nb(lab, 1, 0, -1)) | (lab != nb(lab, 0, 1, -1))
    after = (nb(e, -1, 0, False) | nb(e, 0, -1, False)) & ~e
    before = (nb(e, 1, 0, False) | nb(e, 0, 1, False)) & ~e & ~after
    hsh = lab * 2654435761 % 101
    t = np.where(hsh < 22, 5, np.where(hsh > 88, 3, 4))
    t = np.where(after, t + 1, t)
    t = np.where(before, t - 1, t)
    key = np.array([ix(kk('t', k)) for k in range(7)], np.uint8)
    out = key[np.clip(t, 1, 6)]
    out[e] = ix('t2')
    out[nb(e, 0, -1, False) & ~e] = ix('t3')
    a[m] = out[m]
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 30, 4000):
        x, y = int(x), int(y)
        if not m[y, x] or rng.random() < .45:
            continue
        ang = rng.uniform(-.6, .6) + (math.pi / 2 if rng.random() < .5 else 0)
        for k in range(rng.randint(5, 11)):
            X, Y = int(x + math.cos(ang) * k), int(y + math.sin(ang) * k * .6)
            if 0 <= X < W - 1 and 0 <= Y < H and m[Y, X] and not e[Y, X]:
                a[Y, X] = ix('t2')
                if m[Y, X + 1] and not e[Y, X + 1]:
                    a[Y, X + 1] = pal.shift_index(int(a[Y, X + 1]), 1)
    return lab, e


def bailey(a, court, rng):
    """The bailey floor: trodden earth (Dirt) with its drawn crust, clods and dents, pebbles and straw; the gate road
    in flags through it; tufts of grass and moss where the earth meets the walls' feet."""
    import ground as GR
    road = road_mask() & court
    earth = court & ~road
    a[earth] = ix('d4')
    GR.dirt_texture(a, earth, rng, 1.1, lit=False)          # trodden, not baked: no pale crust
    # straw blown into the lee of the walls and the road's edge: short strokes in Wheat
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 9, 16000):
        x, y = int(x), int(y)
        if not earth[y, x] or rng.random() < .55:
            continue
        L = rng.choice((3, 4, 5, 6))
        sl = rng.choice((-1, 0, 1))
        for i in range(L):
            X, Y = x + i, y + (i * sl) // 3
            if 0 <= X < W and 0 <= Y < H - 1 and earth[Y, X]:
                a[Y, X] = ix('h4' if i < L - 1 else 'h3')
                if earth[Y + 1, X]:
                    a[Y + 1, X] = pal.shift_index(int(a[Y + 1, X]), -1)
    for (x, y) in cpx.poisson(rng, 0, 0, W, H, 24, 6000):
        x, y = int(x), int(y)
        if earth[y, x] and earth[min(H - 1, y + 4), min(W - 1, x + 5)]:
            r_ = rng.random()
            GR.pebble(a, x, y, rng, big=r_ < .25, ramp='t', base=0)
    path_flags(a, road)
    # the road's edge: earth trodden over the outer flags, a dark lip where the earth meets the stone
    lip = road & ~nb(road, 0, -1, True) | road & ~nb(road, -1, 0, True) | road & ~nb(road, 1, 0, True)
    a[lip & court] = ix('d3')
    # where the walls meet the earth: grass and weeds against their feet
    from scipy import ndimage as _nd
    wall_side = ~court
    dist = _nd.distance_transform_edt(~wall_side)
    pts = [p for p in cpx.poisson(rng, 0, 0, W, H, 8, 12000) if earth[int(p[1]), int(p[0])] and dist[int(p[1]), int(p[0])] < 18]
    GR.tufts(a, rng, pts, .9, dirt=True)
    return road, earth


# ------------------------------------------------------------------ masonry
def ashlar(a, mask, tone_at, course=(23, 26), bw=(36, 64), seed=0, y_of=None, x_from=None):
    """Dressed blocks over `mask`. tone_at(x) -> the base level of the face at column x (its facing to the light).
    Each block: a lit top row and west column, two shaded rows at its foot and a shaded east column, set in a
    two-pixel joint; a share weathered a step down; chips (a dark notch over a lit pixel) and the odd hairline crack.
    y_of(x, Y) maps a course line Y to the screen at column x (the drum's sagging courses); x_from(x) maps a column
    to the arc length along the face (the drum's narrowing blocks)."""
    R = random.Random(seed)
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return
    X0, X1, Y0, Y1 = xs.min(), xs.max() + 1, ys.min() - 40, ys.max() + 41
    y_of = y_of or (lambda x, Y: Y)
    x_from = x_from or (lambda x: x)
    # courses: break lines Y_k, each with its stagger
    Ys = [Y0]
    while Ys[-1] < Y1:
        Ys.append(Ys[-1] + R.randint(*course))
    blocks = {}
    for k in range(len(Ys) - 1):
        s = R.uniform(0, bw[1])
        joints = [X0 - 200 - s]
        while joints[-1] < X1 + 400:
            joints.append(joints[-1] + R.randint(*bw))
        blocks[k] = (joints, [R.random() for _ in joints], [R.random() for _ in joints])
    for x in range(X0, X1):
        col = np.nonzero(mask[:, x])[0]
        if not len(col):
            continue
        base = tone_at(x)
        u = x_from(x)
        lines = [y_of(x, Y) for Y in Ys]
        for y in col:
            k = int(np.searchsorted(lines, y + .5) - 1)
            if k < 0 or k >= len(lines) - 1:
                continue
            top, bot = lines[k], lines[k + 1]
            j = y - int(round(top))
            hgt = int(round(bot)) - int(round(top))
            joints, wthr, mark = blocks[k]
            bi = int(np.searchsorted(joints, u) - 1)
            left, right = joints[bi], joints[bi + 1]
            i = int(u - left)
            wid = int(right - left)
            lv = base - (1 if wthr[bi] < .16 else 0) + (1 if wthr[bi] > .93 else 0)
            if j < 2 or i < 2:
                key = v(0 if False else max(1, base - 2))      # the joint
            else:
                jj, ii = j - 2, i - 2
                hh, ww = hgt - 2, wid - 2
                if jj == 0 or ii == 0:
                    key = v(min(7, lv + 1))
                elif jj >= hh - 2 or ii >= ww - 1:
                    key = v(max(1, lv - 1))
                else:
                    key = v(lv)
            a[y, x] = key
    # chips and hairline cracks, drawn as shapes over the dressed faces
    CHIP = [["111", "1++", ".+."], ["11", "1+"], ["111.", ".1++"], [".11", "11+", ".+."]]
    for (x, y) in cpx.poisson(R, X0, max(0, Y0), X1, min(H, Y1), 20, int((X1 - X0) * (Y1 - Y0) / 80)):
        x, y = int(x), int(y)
        if not (0 <= y < H - 3 and x < W - 4) or not mask[y, x] or R.random() < .5:
            continue
        sh = R.choice(CHIP)
        for jj, row in enumerate(sh):
            for ii, ch in enumerate(row):
                X, Y = x + ii, y + jj
                if ch == '.' or not mask[Y, X] or pal.RAMP_OF[a[Y, X]] != 'v':
                    continue
                a[Y, X] = pal.shift_index(int(a[Y, X]), -1 if ch == '1' else 1)
    for _ in range(int((X1 - X0) * (Y1 - Y0) / 9000)):
        x, y = R.randint(X0, X1 - 1), R.randint(max(0, Y0), min(H, Y1) - 1)
        if not mask[y, x]:
            continue
        for k in range(R.randint(5, 14)):
            x += R.choice((0, 1, 1, -1)) if k % 2 else 0
            y += 1
            if 0 <= y < H and 0 <= x < W - 1 and mask[y, x] and pal.RAMP_OF[a[y, x]] == 'v':
                a[y, x] = pal.shift_index(int(a[y, x]), -1)
                if mask[y, x + 1]:
                    a[y, x + 1] = pal.shift_index(int(a[y, x + 1]), 1)


def moss_foot(a, mask, rng, foot_of, depth=14):
    """Moss in the joints and on the lowest blocks along a wall's foot: drawn mounds, thick at the foot, thinning up."""
    MOSS = [["...44...", "..43332.", ".4333322", "43332221"], ["..44..", ".43332", "433221"], ["..4...", ".4332.", "433322"],
            [".44.", "4332"], ["44", "32"]]
    ys, xs = np.nonzero(mask)
    for x in range(xs.min(), xs.max() + 1, 3):
        f = foot_of(x)
        if f is None:
            continue
        if rng.random() < .55:
            continue
        t = rng.choice(MOSS)
        lift = int(abs(rng.gauss(0, depth / 3)))
        y0 = int(f) - lift - len(t) + 1
        for j, row in enumerate(t):
            for i, ch in enumerate(row):
                X, Y = x + i, y0 + j
                if ch != '.' and 0 <= X < W and 0 <= Y < H and mask[Y, X]:
                    a[Y, X] = ix(f'm{ch}')


# ------------------------------------------------------------------ the castle
def drum_geom():
    c, r, foot, sag = DRUM['cx'], DRUM['r'], DRUM['foot'], DRUM['sag']

    def u(x):
        return max(-1.0, min(1.0, (x + .5 - c) / r))

    def dip(x):
        return sag * (1 - math.sqrt(max(0.0, 1 - u(x) ** 2)))

    return c, r, foot, sag, u, dip


def build(seed=22):
    rng = random.Random(seed)
    a = np.zeros((H, W), np.uint8)
    ash_plain(a, rng)
    yy, xx = np.mgrid[0:H, 0:W]
    c, r, dfoot, sag, u, dip = drum_geom()
    # ---- the courtyard flags, everything south of the walls' feet
    court = np.zeros((H, W), bool)
    for x in range(W):
        if x < c + r:
            f = dfoot - dip(x) if abs(x + .5 - c) <= r else WALL_FOOT
        elif x < CURTAIN[1]:
            f = WALL_FOOT
        else:
            f = GATE_FOOT
        court[int(f):, x] = True
    road, earth = bailey(a, court, rng)
    # ---- the curtain wall: face, wall-walk, parapet
    cx0, cx1 = CURTAIN
    face = np.zeros((H, W), bool)
    face[WALK:WALL_FOOT, cx0 - 20:cx1] = True
    ashlar(a, face, lambda x: 4, seed=seed + 1)
    walk = np.zeros((H, W), bool)
    walk[WALK - WALK_D:WALK, cx0 - 20:cx1] = True
    a[walk] = v(5)
    for x in range(cx0 - 20, cx1):                          # the walk's flags, seen from above
        if (x - cx0) % 31 == 0:
            a[WALK - WALK_D:WALK, x] = v(3)
    a[WALK - WALK_D + 8, cx0 - 20:cx1] = v(4)
    a[WALK - 1, cx0 - 20:cx1] = v(6)                        # the walk's front edge catches the light
    a[WALK, cx0 - 20:cx1] = v(3)                            # and throws its shadow on the face below
    # parapet: merlons and crenels; the parapet's inner face in ashlar, the tops lit, the crenels open to the plain
    par = np.zeros((H, W), bool)
    par[SILL:WALK - WALK_D, cx0 - 20:cx1] = True
    MW, GW = 46, 30
    merl = []
    x = cx0 - 6
    while x < cx1 + 60:
        merl.append((x, x + MW))
        x += MW + GW
    for (m0, m1) in merl:
        par[MERLON_TOP:SILL, max(cx0 - 20, m0):min(cx1, m1)] = True
    ashlar(a, par, lambda x: 4, course=(20, 22), bw=(30, 46), seed=seed + 2)
    for (m0, m1) in merl:                                   # merlon caps, seen from above: lit coping
        for x in range(max(cx0 - 20, m0), min(cx1, m1)):
            for j in range(8):
                a[MERLON_TOP - 8 + j, x] = v(6 if j < 6 else 5) if j else v(5)
            a[MERLON_TOP, x] = v(3)
            if x == m0 or x == m1 - 1:
                a[MERLON_TOP - 8:MERLON_TOP, x] = v(4)
    for (g0, g1) in zip([m1 for _, m1 in merl], [m0 for m0, _ in merl[1:]]):   # crenel sills, seen from above
        for x in range(max(cx0 - 20, g0), min(cx1, g1)):
            for j in range(6):
                a[SILL - 6 + j, x] = v(6 if j < 4 else 5)
            a[SILL, x] = v(3)
        # the merlons' shaded east cheeks inside each crenel: one column, and their shadow on the sill
        if cx0 - 20 <= g0 < cx1:
            a[MERLON_TOP:SILL, g0 - 1] = v(2)
    # outline the parapet against the plain: its own darkest step
    wallmask = face | walk | par
    for (m0, m1) in merl:
        wallmask[MERLON_TOP - 8:MERLON_TOP, max(cx0 - 20, m0):min(cx1, m1)] = True
    for (g0, g1) in zip([m1 for _, m1 in merl], [m0 for m0, _ in merl[1:]]):
        wallmask[SILL - 6:SILL, max(cx0 - 20, g0):min(cx1, g1)] = True
    edge = cpx.ring(np.pad(wallmask, 1), 4)[1:-1, 1:-1] & ~wallmask & (yy < WALL_FOOT)
    a[edge] = v(1)
    # ---- the gatehouse: a tall front with the great arch, a string course, slits, a corbelled parapet at the top
    g0 = CURTAIN[1]
    gface = np.zeros((H, W), bool)
    gface[0:GATE_FOOT, g0:W] = True
    ac, ahw, asp = ARCH['cx'], ARCH['hw'], ARCH['spring']
    hole = ((xx - ac) ** 2 + ((yy - asp) * 1.0) ** 2 <= ahw ** 2) | ((np.abs(xx + .5 - ac) <= ahw) & (yy >= asp))
    hole &= yy < GATE_FOOT
    ring_ = ((xx - ac) ** 2 + (yy - asp) ** 2 <= (ahw + 24) ** 2) | ((np.abs(xx + .5 - ac) <= ahw + 24) & (yy >= asp))
    ring_ &= ~hole & (yy < GATE_FOOT)
    body = gface & ~hole & ~ring_
    ashlar(a, body, lambda x: 4 if x > g0 + 3 else 5, seed=seed + 3)
    # the voussoirs: wedge stones radiating round the arch, a keystone at the crown; jambs below the spring
    vous(a, ring_, ac, asp, ahw)
    # the west edge of the gatehouse catches the light; its outline against the curtain
    a[0:GATE_FOOT, g0] = v(6)
    a[0:GATE_FOOT, g0 - 1] = v(1)
    # string course (a moulded band at the gatehouse's first floor) and corbels under its parapet, at the top
    for (yb, lit) in ((150, True),):
        for x in range(g0, W):
            if hole[yb, x] or ring_[yb, x]:
                continue
            a[yb - 1, x] = v(6)
            a[yb, x] = v(5)
            a[yb + 1, x] = v(5)
            a[yb + 2, x] = v(3)
            a[yb + 3, x] = v(2)
    corbels(a, g0, W, 22)
    # arrow slits: one in the gatehouse beside the arch
    slit(a, 1246, 168, 78)
    slit(a, 990, 168, 78)
    # ---- inside the arch: the passage floor in the gatehouse's shade, then the plain beyond the far gate
    pas = hole & (yy >= OUT_FLOOR)
    path_flags(a, pas)
    shift_where(a, pas, -1, ('t',))                       # under the gatehouse's vault, a step down
    shift_where(a, pas & (yy >= GATE_FOOT - 10), -1, ('t',))   # and the arch's own shadow just inside it
    # the far gate's threshold: a lit sill where the passage meets the daylight
    a[(yy == OUT_FLOOR) & hole] = ix('t4')
    a[(yy == OUT_FLOOR - 1) & hole] = ix('t5')
    # the passage walls, edge-on: a sliver each side, west lit, east in shade
    for x in range(ac - ahw, ac - ahw + 4):
        m_ = hole[:, x]
        a[m_, x] = ix('v3') if x > ac - ahw + 1 else ix('v4')
    for x in range(ac + ahw - 5, ac + ahw + 1):
        m_ = hole[:, x]
        a[m_, x] = ix('v1') if x > ac + ahw - 3 else ix('v2')
    # the portcullis, raised: its lower grid and iron teeth hang under the crown of the arch
    portcullis(a, hole, ac, ahw, asp)
    # ---- the drum tower: sagging courses, narrowing blocks, lit west, shaded east
    drum_m = np.zeros((H, W), bool)
    for x in range(max(0, c - r), min(W, c + r)):
        drum_m[0:int(dfoot - dip(x)), x] = True

    def tone_drum(x):
        q = u(x)
        if q < -.55:
            return 5
        if q < -.05:
            return 5 if q < -.3 else 4
        if q < .45:
            return 4
        if q < .8:
            return 3
        return 2

    def y_of(x, Y):
        return Y - dip(x)

    def x_from(x):
        return c + r * math.asin(u(x)) * .95

    ashlar(a, drum_m, tone_drum, seed=seed + 4, y_of=y_of, x_from=x_from)
    # the drum's door at its foot (an iron-banded oak door in a round-headed opening) and two slits
    drum_door(a, c - 4, int(dfoot - dip(c - 4)))
    slit(a, c - 36, 92, 80, drum=True)
    slit(a, c + 42, 196, 72, drum=True)
    # the drum's east rim against the curtain wall, in shade, outlined
    for y in range(0, int(dfoot - dip(c + r - 1))):
        a[y, c + r - 1] = v(1)
        a[y, c + r] = v(1)
    # ---- moss at the walls' feet
    moss_foot(a, face, rng, lambda x: WALL_FOOT - 1 if cx0 <= x < cx1 else None)
    moss_foot(a, body, rng, lambda x: GATE_FOOT - 1 if x >= g0 else None)
    moss_foot(a, drum_m, rng, lambda x: dfoot - dip(x) - 1 if abs(x + .5 - c) < r - 2 else None)
    # ---- the walls' feet: a dark contact row on the flags, then the hard shadows of the walls to the south-east
    info = dict(court=court, hole=hole, drum=drum_m, face=face, gate=body | ring_)
    return a, info


def vous(a, ring_, ac, asp, ahw):
    """Wedge stones round the arch: joints radiating from the spring centre every ~11 degrees, each stone lit on its
    upper-left lip; a keystone at the crown a step lighter; straight jamb stones below the spring."""
    ys, xs = np.nonzero(ring_)
    for y, x in zip(ys, xs):
        dx, dy = x + .5 - ac, y + .5 - asp
        if dy < 0:
            ang = math.degrees(math.atan2(-dy, dx))          # 0 at east, 90 at the crown, 180 at west
            k = int(ang // 11.25)
            frac = (ang % 11.25) / 11.25
            rad = math.hypot(dx, dy) - ahw
            key_stone = 84 <= ang <= 96
            lv = 5 if key_stone else 4
            if frac < .1 or rad < 1.5:
                key = v(2)
            elif rad > 22.5:
                key = v(2)
            elif frac < .22 or rad < 3:
                key = v(lv + 1)
            elif frac > .88 or rad > 20.5:
                key = v(lv - 1)
            else:
                key = v(lv)
            if key_stone and 1.5 <= rad <= 22.5 and (frac > .1):
                key = v(6) if rad < 4 else v(5)
        else:
            # jambs: blocks 28 px tall, alternately long and short (quoins)
            side = -1 if dx < 0 else 1
            rad = abs(dx) - ahw
            jk = int(dy // 28)
            jj = dy % 28
            deep = 24 if jk % 2 == 0 else 16
            if jj < 2 or rad > deep or rad < 1:
                key = v(2) if rad <= deep + 0 else None
            elif jj < 4 or rad < 3:
                key = v(6 if side < 0 else 4)
            elif jj > 24 or rad > deep - 2:
                key = v(3 if side < 0 else 2)
            else:
                key = v(5 if side < 0 else 3)
            if key is None:
                continue
        a[y, x] = key


def portcullis(a, hole, ac, ahw, asp):
    """The raised portcullis: oak-and-iron grid bars hanging under the crown of the arch, iron teeth at the foot;
    iron in Vault's darks, each bar lit on its west edge."""
    bottom = asp - 50
    top = 0
    for x in range(ac - ahw, ac + ahw + 1):
        for y in range(top, bottom + 8):
            if not hole[y, x]:
                continue
            i = (x - (ac - ahw)) % 20
            rowv = (y - bottom) % 22
            key = None
            if i in (0, 1, 2, 3):
                key = 'v3' if i == 0 else ('v2' if i < 3 else 'v1')
            if rowv in (8, 9, 10) and y < bottom:
                key = 'v3' if rowv == 8 else 'v2'
                if rowv == 10:
                    key = 'v1'
            if y >= bottom - 2 and i in (0, 1, 2, 3):
                # the tooth: tapering to a point
                d = y - (bottom - 2)
                if d > 6 - abs(i - 1.5) * 2 or d >= 9:
                    key = None
                else:
                    key = 'v4' if i < 2 else 'v2'
            if key:
                a[y, x] = ix(key)


def corbels(a, x0, x1, y):
    """The machicolation: a row of stepped corbels under the gatehouse's parapet, a dark gap between each."""
    for x in range(x0, x1):
        p = (x - x0) % 34
        for j in range(18):
            yy = y + j
            step = j // 6
            if p < 6 + step * 3 or p > 31 - step * 3:
                key = 'v2' if j > 1 else 'v3'                 # the recess between corbels, in shade
                if j < 4 and (p < 5 or p > 32):
                    key = 'v1'                                # the murder-slot under the parapet
            else:
                key = 'v5' if j % 6 == 0 else ('v4' if j % 6 < 4 else 'v3')
                if p == 6 + step * 3:
                    key = 'v5' if j % 6 < 4 else 'v4'         # each step lit on its west cheek
            a[yy, x] = ix(key)
    for x in range(x0, x1):                                   # the parapet over them: a lit coping, its face
        a[y - 1, x] = ix('v6')
        for j in range(2, 22):
            if y - j >= 0:
                a[y - j, x] = ix('v4' if j % 11 else 'v2')
        a[y - 2, x] = ix('v3')


def slit(a, x, y, h, drum=False):
    """An arrow loop: a narrow dark slot with splayed jambs, lit on the west splay; a round oillet at its foot."""
    for j in range(h):
        for i in range(-3, 4):
            X, Y = x + i, y + j
            if not (0 <= X < W and 0 <= Y < H):
                continue
            if abs(i) <= 1:
                key = 'v0' if j > 1 else 'v1'
            elif i < 0:
                key = 'v5'
            else:
                key = 'v2'
            a[Y, X] = ix(key)
    for (i, j) in ((-2, h), (-1, h), (0, h), (1, h), (2, h), (-1, h + 1), (0, h + 1), (1, h + 1)):
        a[y + j, x + i] = ix('v0')


def drum_door(a, x, foot):
    """The tower's postern: a round-headed opening with plain stone jambs, an oak door of vertical boards with two
    iron straps and studs, a stone step."""
    w, h = 74, 148
    m = arch_mask(w, h)
    rim = arch_mask(w + 8, h + 4)
    x0, y0 = x - w // 2, foot - h
    for j in range(h + 4):
        for i in range(w + 8):
            if rim[j, i]:
                X, Y = x0 - 4 + i, y0 - 4 + j
                a[Y, X] = ix('v5' if (i < 4 or j < 4) and i < (w + 8) * .6 else 'v3')
    for j in range(h):
        for i in range(w):
            if not m[j, i]:
                continue
            X, Y = x0 + i, y0 + j
            board = i // 9
            ii = i % 9
            key = 'w4' if ii < 7 else 'w3'
            if ii == 0:
                key = 'w5'
            if ii == 8:
                key = 'w2'
            if (j * 3 + board * 7) % 29 < 2 and 1 < ii < 6:
                key = 'w3'                                     # grain
            if j in range(40, 45) or j in range(108, 113):
                key = 'v3' if j in (40, 108) else ('v2' if j in (41, 42, 43, 109, 110, 111) else 'v1')   # the iron straps
                if ii == 3 and j in (41, 109):
                    key = 'v5'                                 # a stud catching the light
            if j < 2:
                key = 'w1'
            a[Y, X] = ix(key)
    # outline the opening, the step under it
    for i in range(-6, w + 6):
        a[foot, x0 + i] = ix('t5') if i < w * .6 else ix('t4')
        a[foot + 1, x0 + i] = ix('t3')


def arch_mask(w, h):
    """A round-headed opening: straight jambs under a semicircle sampled at pixel centres (symmetric steps)."""
    m = np.zeros((h, w), bool)
    r = w / 2
    for j in range(h):
        for i in range(w):
            dx, dy = i + .5 - r, j + .5 - r
            if j + .5 >= r or dx * dx + dy * dy <= r * r + .25:
                m[j, i] = True
    return m


# ------------------------------------------------------------------ props at the people's scale
def barrel_big(h=68, w=50, seed=0):
    """A cask, standing: oak staves lit on the west, three iron hoops, the lid seen from above (an ellipse with its
    boards), outlined in its own darks. Foot = the base's middle."""
    R = random.Random(seed)
    lid = 12
    s = new(w + 2, h + lid // 2 + 2, (w + 2) // 2, h + lid // 2)
    cx = (w + 2) / 2
    for y in range(s.h):
        for x in range(s.w):
            dx = (x + .5 - cx) / (w / 2)
            if abs(dx) > 1:
                continue
            bulge = 1 - .06 * (1 - ((y - lid / 2 - h / 2) / (h / 2)) ** 2)
            if abs(dx) > bulge + .02 and y > lid // 2:
                continue
            ytop = lid / 2 - lid / 2 * math.sqrt(max(0, 1 - dx * dx))
            ybot = lid / 2 + h - 1 + (lid / 2) * math.sqrt(max(0, 1 - dx * dx)) * .55
            if y < ytop or y > ybot:
                continue
            ylid_b = lid / 2 + lid / 2 * math.sqrt(max(0, 1 - dx * dx))
            if y <= ylid_b:
                # the lid: boards running east-west, lit
                key = 'w5' if int(y) % 4 else 'w4'
                if y < ytop + 1.2:
                    key = 'w6'
                if y > ylid_b - 1.5:
                    key = 'w3'                                   # the chime's inner shadow
                s.ix[y, x] = ix(key)
                continue
            q = (dx + 1) / 2
            stave = int((math.asin(max(-1, min(1, dx))) / math.pi + .5) * 9)
            lv = 5 if q < .28 else (4 if q < .62 else (3 if q < .86 else 2))
            key = f'w{lv}'
            edge_st = abs(((math.asin(max(-1, min(1, dx))) / math.pi + .5) * 9) % 1 - .5) > .42
            if edge_st and .08 < q < .95:
                key = f'w{max(1, lv - 1)}'
            hy = y - ylid_b
            for hp in (6, h * .45, h - 10):
                if hp <= hy < hp + 4:
                    key = f'v{min(6, lv + (1 if hy - hp == 0 else 0))}' if hy - hp < 3 else 'v1'
            s.ix[y, x] = ix(key)
    cpx.selout(s)
    return s.trimmed()


def crate_big(w=58, h=48, top=20, seed=0):
    """A stout crate: the lid seen from above in lit boards, the front of three planks with a Z-brace, nail heads,
    an east cheek in shade. Foot = the front's base middle."""
    R = random.Random(seed)
    side = 10
    s = new(w + side + 2, h + top + 2, (w + 2) // 2, h + top)
    for j in range(top):
        off = int(round(side * (1 - j / top)))
        for i in range(w + side):
            X = 1 + i
            if i < off or i >= w + off:
                continue
            ii = i - off
            key = 'w5' if (ii // 12) % 1 == 0 else 'w5'
            if ii % 12 == 11:
                key = 'w3'
            if j == 0:
                key = 'w6'
            s.ix[1 + j, X] = ix(key)
    for j in range(h):
        for i in range(w):
            key = 'w4'
            pl = j // (h // 3)
            jj = j % (h // 3)
            if jj == 0:
                key = 'w5'
            elif jj == h // 3 - 1:
                key = 'w2'
            if i < 4 or i >= w - 4:
                key = 'w5' if i < 2 else ('w3' if i >= w - 2 else 'w4')
            if (i * 5 + j * 13 + pl * 7) % 31 == 0 and 3 < jj < h // 3 - 2:
                key = 'w3'
            s.ix[1 + top + j, 1 + i] = ix(key)
        for k in range(side):                                    # the east cheek, receding
            if j < h - k * 0 and top - int(top * (k / side)) - 1 + j < top + h:
                Y = 1 + top + j - int(round(top * (k + 1) / side))
                if 1 <= Y < s.h:
                    s.ix[Y, 1 + w + k] = ix('w3' if (j // (h // 3)) % 2 == 0 else 'w2')
    for i in range(6, w - 6):                                    # the Z brace
        j = int(round((h - 10) * (1 - (i - 6) / (w - 12)))) + 5
        for d in range(3):
            if 0 <= j + d < h:
                s.ix[1 + top + j + d, 1 + i] = ix('w5' if d == 0 else ('w3' if d == 1 else 'w2'))
    for (nx, ny) in ((2, 3), (w - 3, 3), (2, h - 4), (w - 3, h - 4)):
        s.ix[1 + top + ny, 1 + nx] = ix('v5')
    cpx.selout(s)
    return s.trimmed()


def kaine_banner():
    """Mercer Kaine's banner, thrown down: black wool lying crumpled on the flags in three broad folds (each a lit
    crest, its slope, a dark trough), the swallowtail turned over at the east end, an oxblood iron crown on the field,
    the pole snapped under it, its broken end splintered. Foot = the cloth's middle."""
    W_, H_ = 232, 74
    s = new(W_, H_, 110, 58)
    yy, xx = np.mgrid[0:H_, 0:W_].astype(float) + .5
    top = 24 + 5 * np.sin(xx / 21 + .6) - (xx - 40) * .065
    bot = 58 + 3 * np.sin(xx / 15 + 1.4) - (xx - 40) * .05
    m = (xx > 26) & (xx < 198) & (yy > top) & (yy < bot)
    mid = (top + bot) / 2
    m &= ~((xx > 172) & (np.abs(yy - mid) < (xx - 172) * .62))          # the swallowtail notch
    tone = np.full((H_, W_), ix('v2'), np.uint8)
    # three folds across the cloth: crest lit, the west slope a step up, the trough under the crest dark
    for (fx, wdt, lean) in ((62, 13, .25), (118, 16, -.2), (160, 11, .35)):
        d = xx - (fx + (yy - mid) * lean)
        tone[(d > -wdt) & (d < -wdt * .45)] = ix('v3')
        tone[(d >= -wdt * .45) & (d < -wdt * .2)] = ix('v4')
        tone[(d >= 0) & (d < wdt * .35)] = ix('v1')
    tone[(yy - top < 2.2)] = ix('v3')                                      # the far edge, turned up to the light
    tone[(bot - yy < 2)] = ix('v1')
    # the crown device on the field, oxblood, a fold running through its east half
    cxc, cyc = 98, 40
    band = (np.abs(xx - cxc) < 15) & (yy > cyc) & (yy < cyc + 6)
    dev = band.copy()
    for px_ in (-13, 0, 13):
        dev |= (np.abs(xx - cxc - px_) < (yy - (cyc - 9)) * .45) & (yy > cyc - 9) & (yy <= cyc)
    dev &= m
    tone[dev] = ix('x3')
    tone[dev & (yy < cyc + 2)] = ix('x4')
    tone[dev & (yy >= cyc + 4)] = ix('x2')
    tone[dev & (xx > 112)] = ix('x2')
    s.ix[m] = tone[m]
    # the snapped pole under its west end, splintered
    for i in range(4, 62):
        y = int(round(50 - i * .12))
        for d, key in ((0, 'w5'), (1, 'w4'), (2, 'w3')):
            if s.ix[y + d, i] == CLEAR:
                s.ix[y + d, i] = ix(key)
    for (i, j) in ((2, 49), (3, 48), (1, 50), (3, 51), (2, 52), (0, 51)):
        s.ix[j, i] = ix('w5')
    for i in range(198, 214):
        y = int(round(38 + (i - 198) * .1))
        s.ix[y, i] = ix('w4'); s.ix[y + 1, i] = ix('w3')
    for (i, j, k) in ((214, 39, 'v4'), (215, 39, 'v4'), (216, 39, 'v5'), (217, 39, 'v3'), (214, 40, 'v2'), (215, 40, 'v2')):
        s.ix[j, i] = ix(k)
    cpx.selout(s)
    return s.trimmed()


def torch_bracket(lit=True):
    """A wall torch at the people's scale (about 0.6 m): an iron ring bracket on a wall plate, an ash shaft, a pitch-
    wrapped head and a flame in four tones, each tongue lit on its west side. Paint only: no glow round it."""
    flame = [
        "........y.........",
        ".......yy.........",
        "......yoy...y.....",
        "......yoo..yy.....",
        ".....yooo..yo.....",
        ".....yoOo.yoo.....",
        "....yooOooyoo.....",
        "....yoOOoooOo.y...",
        "...yooOOOoOOo.yo..",
        "...yoOOYOOOOooyo..",
        "...yoOYYYOOOOooo..",
        "..yooOYYYYOOOOoo..",
        "..yoOOYYYYYOOOoox.",
        "..xoOOYYYYYOOOoox.",
        "..xooOOYYYOOOOox..",
        "...xooOOOOOOOoxx..",
        "....xxoooooooxx...",
        ".....xxxxxxxxx....",
    ]
    head = [
        ".....kkkkkkkk.....",
        "....k32323232k....",
        "....k23232323k....",
        "....k32323232k....",
        "....k23232323k....",
        ".....kkkkkkkk.....",
    ]
    km = {'y': 'o6', 'o': 'o5', 'O': 'o6', 'Y': 'b5', 'x': 'x4', 'k': 'w0', '2': 'w1', '3': 'w2'}
    s = new(20, 64, 9, 62)
    for j, row in enumerate(flame):
        for i, ch in enumerate(row):
            if ch != '.':
                put(s, 1 + i, 1 + j, km[ch])
    for j, row in enumerate(head):
        for i, ch in enumerate(row):
            if ch != '.':
                put(s, 1 + i, 19 + j, km[ch])
    for y in range(25, 62):                                  # the shaft
        put(s, 8, y, 'w5'); put(s, 9, y, 'w4'); put(s, 10, y, 'w3')
        put(s, 7, y, 'w1'); put(s, 11, y, 'w1')
    for y in (34, 35, 36, 37):                               # the iron ring that holds it, and its arm to the wall
        for x in range(5, 14):
            put(s, x, y, 'v4' if y == 34 else ('v3' if y < 37 else 'v1'))
    for y in range(36, 50):
        put(s, 13, y, 'v2'); put(s, 14, y, 'v1')
    for y in range(46, 56):                                  # the wall plate
        for x in range(12, 17):
            put(s, x, y, 'v3' if x < 14 else 'v2')
        put(s, 12, y, 'v4')
    put(s, 14, 48, 'v5'); put(s, 14, 53, 'v5')
    return s


# ------------------------------------------------------------------ the scene
SUN = (.26, .10)            # a high sun: a pixel z above the ground lands z*SX east and z*SY south


def wall_shadow(st_, info):
    """The walls' hard shadows on the flags: each column of masonry of height h throws a band from its foot to
    (x + h*SX, foot + h*SY). The towers run out of the frame; they are taken as 700 px tall."""
    sx, sy = SUN
    c, r, dfoot, sag, u, dip = drum_geom()
    m = np.zeros((H, W), bool)

    def band(x, foot, h):
        n = int(h * sy) + 1
        for k in range(n):
            y = int(foot + k)
            x1 = int(x + k * sx / sy)
            if 0 <= y < H:
                m[y, max(0, x):min(W, x1 + 2)] = True

    for x in range(max(0, c - r), c + r):
        band(x, dfoot - dip(x), 700)
    for x in range(CURTAIN[0], CURTAIN[1]):
        band(x, WALL_FOOT, WALL_FOOT - MERLON_TOP + 8)
    for x in range(CURTAIN[1], W):
        band(x, GATE_FOOT, 700)
    st_.shadow |= m & info['court']


def compose(seed=22):
    import people as PP
    import standard as SD
    cpx.SX, cpx.SY = SUN                        # people and props share the walls' sun
    a, info = build(seed)
    st_ = pxs.Stage(a, ground_ramps=('t', 'd', 'h', 'g'), sx=SUN[0], sy=SUN[1])
    wall_shadow(st_, info)
    # the company, at 1:1, in the sun before the wall
    pxs.person(st_, 'board_marcus', 792, 536)
    pxs.person(st_, 'board_roy', 872, 544)
    pxs.person(st_, 'board_lilina', 952, 534)
    sd = SD.standard()
    st_.add(sd, 724, 530)
    st_.throw_sprite(sd, 724, 530)
    kb = kaine_banner()
    st_.add(kb, 706, 664, z=600)
    st_.throw_sprite(kb, 706, 664, zcap=2)
    # cargo stacked against the gatehouse, east of the arch
    for (bx, by, sd_) in ((1228, 474, 1), (1266, 480, 2)):
        b = barrel_big(seed=sd_)
        st_.add(b, bx, by)
        st_.throw_sprite(b, bx, by)
    cr = crate_big()
    st_.add(cr, 1246, 500)
    st_.throw_sprite(cr, 1246, 500)
    # torches either side of the arch
    for tx, flip in ((996, True), (1228, False)):
        t_ = torch_bracket()
        st_.add(t_, tx, 372, z=300, flip=flip)
    return st_, info


if __name__ == '__main__':
    import os
    st_, info = compose()
    im = st_.render().convert('RGB')
    os.makedirs(os.path.join(pxs.HERE, 't'), exist_ok=True)
    im.save(os.path.join(pxs.HERE, 't', 'castle.png'))
    print('ok')
