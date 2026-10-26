"""Trader's Rest at camp scale: the whole 1280 x 720 world as one PNG (pal ramps for the world, the three board
sprites composited at 1:1). Layout in screen px; the panels cover x >= 846 and the top-left 14..486 x 14..150,
so the stage people read is about 0..840 x 150..700."""
import math
import random
import sys

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, K, grid, ell_mask, seg_dist, wobble, poisson, nb, shift_arr, smooth_noise
import ground as GR
import random

W, H = 1280, 720

# the road: a cart track along the north of the camp, west to east, rising a little to the east
ROAD = cpx.catmull([(-40, 268), (180, 252), (400, 222), (620, 184), (860, 146), (1100, 118), (1330, 100)], 10)
ROAD_HW = 35
FIRE = (410, 556)               # centre of the fire ring on the ground
CLEARING = [(212, 556), (240, 512), (296, 488), (342, 474), (388, 466), (436, 470), (484, 456), (540, 444), (600, 434),
            (668, 438), (734, 448), (780, 470), (778, 502), (742, 528), (676, 548), (628, 578), (576, 612), (496, 634),
            (400, 642), (312, 634), (248, 614), (212, 586), (212, 556)]


def build_ground(seed=5):
    from scipy import ndimage
    a = GR.meadow(W, H, seed)
    xx, yy = grid(W, H)
    rng = random.Random(seed)
    GR.serrate(a, [ix('g4'), ix('g5'), ix('g6')], seed)
    # ---- the road: a ragged-edged cart track
    d, along = seg_dist(xx, yy, ROAD)
    side = _side(xx, yy, ROAD)
    sd = d * side                                   # signed: + south of the line (right of travel, eastward)
    hw = ROAD_HW + wobble(seed + 1, 170)(along) * 4.5
    f_road = GR.ragged((hw - d) / hw, seed + 3, W, H, amp=(.06, .045, .035), cells=(44, 15, 6))
    road = GR.drop_small(cpx.clean(f_road > 0, 3), 40)
    # ---- the clearing: trodden round the fire, out to the tent's door, a path up to the road
    sdc = GR.poly_sdist(W, H, cpx.catmull(CLEARING, 8))
    pd, palong = seg_dist(xx, yy, cpx.catmull([(376, 492), (352, 420), (326, 340), (308, 250)], 8))
    phw = 19 + wobble(seed + 4, 70)(palong) * 3
    f = np.maximum(sdc / 40, (phw - pd) / 40)
    fr = GR.ragged(f, seed + 9, W, H, amp=(.22, .12, .07), cells=(52, 19, 7))
    clear = fr > 0
    # grass islands just inside the edge, bald spots just outside it
    isl = smooth_noise(W, H, 16, seed + 50)
    clear &= ~((fr < .16) & (isl > .42))
    clear |= (fr > -.12) & (isl < -.55)
    clear = GR.drop_small(cpx.clean(clear, 3), 30)
    clear = ~GR.drop_small(~clear, 25)
    dirt = road | clear
    GR.paint_dirt(a, dirt, 'd4', seed)
    # ---- ruts: two continuous grooves, each shadowed on its north lip and lit on its south lip
    for k, off in enumerate((-14, 13)):
        c = off + wobble(seed + 20 + k, 90)(along) * 2.2
        wdt = 2.7 + wobble(seed + 30 + k, 55)(along) * 1.1
        rut = road & (np.abs(sd - c) < wdt) & (f_road > .12)
        rut = GR.drop_small(cpx.clean(rut, 3), 20)
        a[rut] = ix('d3')
        a[rut & ~nb(rut, 0, -1, False)] = ix('d2')
        lip = ~rut & nb(rut, 0, -1, False) & road
        a[lip] = ix('d5')
    rutm = np.isin(a, [ix('d2'), ix('d3')]) & road
    # ---- drawn texture on all dirt
    GR.dirt_texture(a, road & ~rutm, rng, 1.0)
    GR.dirt_texture(a, clear & ~road, rng, 1.25)
    GR.grass_over_dirt(a, dirt, seed)
    # ---- grass on the crown of the road, between the ruts
    crown = road & (np.abs(sd) < 6)
    pts = [p for p in poisson(rng, 0, 40, W, 340, 7, 4000) if crown[int(p[1]), int(p[0])] and rng.random() < .7]
    GR.tufts(a, rng, pts, .6, dirt=True)
    # ---- tufts on the dirt near its edge (the grass creeping back in)
    dist_in = ndimage.distance_transform_edt(dirt)
    near = (dist_in > 2) & (dist_in < 22)
    pts = [p for p in poisson(rng, 0, 0, W, H, 9, 12000) if near[int(p[1]), int(p[0])]
           and rng.random() < .62 - dist_in[int(p[1]), int(p[0])] / 40]
    GR.tufts(a, rng, pts, .75, dirt=True)
    # ---- pebbles and twigs on the dirt
    on = dist_in > 4
    pts = [p for p in poisson(rng, 0, 0, W, H, 26, 5000) if on[int(p[1]), int(p[0])]]
    for (x, y) in pts:
        r_ = rng.random()
        if r_ < .55:
            GR.pebble(a, int(x), int(y), rng, big=r_ < .14, ramp='t' if r_ < .4 else 'd', base=0 if r_ < .4 else 1)
        elif r_ < .66:
            GR.twig(a, x, y, rng)
    # ---- grass: clustered tufts on the meadow, denser along the dirt's edge
    dist_out = ndimage.distance_transform_edt(~dirt)
    meadow = ~dirt
    dens = smooth_noise(W, H, 70, seed + 77)
    pts = [p for p in poisson(rng, 0, 0, W, H, 9, 30000) if meadow[int(p[1]), int(p[0])]
           and rng.random() < .18 + .7 * max(0, dens[int(p[1]), int(p[0])])]
    GR.tufts(a, rng, pts, 1.0)
    pts = [p for p in poisson(rng, 0, 0, W, H, 6, 60000) if meadow[int(p[1]), int(p[0])]
           and rng.random() < .3 + .5 * max(0, dens[int(p[1]), int(p[0])])]
    GR.blade_marks(a, rng, pts)
    edge = meadow & (dist_out < 10) & (dist_out > 1)
    pts = [p for p in poisson(rng, 0, 0, W, H, 7, 14000) if edge[int(p[1]), int(p[0])]]
    GR.tufts(a, rng, pts, 1.15)
    pts = [p for p in poisson(rng, 0, 0, W, H, 40, 3000) if meadow[int(p[1]), int(p[0])] and dist_out[int(p[1]), int(p[0])] > 3]
    for (x, y) in pts:
        if dist_out[int(y), int(x)] < 16 or dens[int(y), int(x)] > .35:
            GR.clump(a, rng, int(x), int(y), rng.choice((12, 14, 16, 20)), rng.choice((9, 11, 13)))
    cen = [p for p in poisson(rng, 0, 0, W, H, 64, 900) if meadow[int(p[1]), int(p[0])] and dist_out[int(p[1]), int(p[0])] > 12]
    GR.flowers(a, rng, cen[:70])
    return a, dict(road=road, clear=clear, dirt=dirt, sd=sd, along=along)


def _side(xx, yy, pts):
    """+1 right of travel, -1 left, for the nearest segment of pts."""
    best = np.full(xx.shape, 1e9)
    side = np.zeros(xx.shape)
    for i in range(len(pts) - 1):
        ax, ay = pts[i]; bx, by = pts[i + 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9
        t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / L2, 0, 1)
        dd = np.hypot(xx - (ax + t * dx), yy - (ay + t * dy))
        m = dd < best
        best[m] = dd[m]
        side[m] = np.sign(dx * (yy - ay) - dy * (xx - ax))[m]
    return side


# ---------------------------------------------------------------- composition
from PIL import Image
from scipy import ndimage
import tent as TT
import fire as FI
import wood as WD
import people as PP
import resting as RS
import bigtree as BT
import bedding as BD
import standard as SD

TENT_AT = (668, 428)            # middle of the gable's base
LILINA_LOG = (515, 505)         # middle of the log's underside on the ground
OAK_AT = (628, 526)
ROY_AT = (292, 594)
BEDROLL_AT = (668, 642)
LOG2_AT = (560, 636)
STANDARD_AT = (224, 470)


class Stage:
    """y-sorted drawing: indexed sprites and RGBA people, shadows thrown onto the ground first."""

    def __init__(self, ground):
        self.g = ground
        self.shadow = np.zeros(ground.shape, bool)
        self.items = []

    def throw(self, m, x0=0, y0=0):
        """Add a bool mask (local, top-left at x0, y0) to the ground shadow."""
        h, w = m.shape
        X0, Y0 = max(0, x0), max(0, y0)
        X1, Y1 = min(W, x0 + w), min(H, y0 + h)
        if X1 <= X0 or Y1 <= Y0:
            return
        self.shadow[Y0:Y1, X0:X1] |= m[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]

    def throw_sprite(self, spr, fx, fy, flip=False, zcap=None, squash=1.0, dapple=0):
        """Throw a standing sprite's silhouette along the ground: a pixel at height z above the foot line lands
        at (x + z*SX, foot + z*SY). zcap clamps the height (for things that lean back, like a tent's slopes)."""
        a = (spr.ix[:, ::-1] if flip else spr.ix) != CLEAR
        ax = (spr.w - 1 - spr.ax) if flip else spr.ax
        ys, xs = np.nonzero(a)
        if not len(xs):
            return
        z = np.maximum(0, spr.ay - ys).astype(float)
        if zcap is not None:
            z = np.minimum(z, zcap)
        z *= squash
        px = np.round(fx - ax + xs + z * cpx.SX).astype(int)
        py = np.round(fy + z * cpx.SY).astype(int)
        ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
        m = np.zeros((H, W), bool)
        m[py[ok], px[ok]] = True
        m = ndimage.binary_closing(m, np.ones((3, 3), bool))
        if dapple:
            # a tree's shade is never one flat pool: its edge is lobed by the clumps, and sun comes through in flecks
            rng = random.Random(dapple)
            ys2, xs2 = np.nonzero(m)
            if len(xs2):
                x0_, x1_, y0_, y1_ = xs2.min(), xs2.max(), ys2.min(), ys2.max()
                inner = ndimage.binary_erosion(m, np.ones((7, 7), bool))
                edge_ = m & ~ndimage.binary_erosion(m, np.ones((3, 3), bool))
                eys, exs = np.nonzero(edge_)
                for k in range(0, len(exs), 9):
                    cxk, cyk = exs[k], eys[k]
                    r1 = rng.uniform(3, 6)
                    e = ell_mask(W, H, cxk + rng.uniform(-1, 1), cyk, r1, r1 * .45)
                    if rng.random() < .5:
                        m |= e
                    else:
                        m &= ~(e & ~inner)
                for (fx_, fy_) in poisson(rng, x0_, y0_, x1_, y1_, 16, 400):
                    if inner[int(fy_), int(fx_)]:
                        r1 = rng.uniform(1.8, 3.6)
                        m &= ~ell_mask(W, H, fx_, fy_, r1, r1 * .5)
        self.shadow |= m
        # the contact: the ground right under the sprite's foot, and a pixel or two east of it
        foot = np.zeros((H, W), bool)
        low = ys >= spr.ay - 3
        fxs = np.round(fx - ax + xs[low]).astype(int)
        for dy in (1, 2):
            for dx in (0, 1, 2):
                yy_ = fy + dy
                ok2 = (fxs + dx >= 0) & (fxs + dx < W) & (0 <= yy_ < H)
                foot[yy_, (fxs + dx)[ok2]] = True
        self.shadow |= foot

    def tufts_at(self, x0, x1, y, seed=0, every=7):
        """Grass growing against an object's foot: little tufts drawn in front of it, on its base line."""
        rng = random.Random(seed)
        x = x0
        while x < x1:
            cells = GR.tuft_shape(rng, rng.uniform(.6, 1.0))
            xs_ = [p[0] for p in cells]; ys_ = [p[1] for p in cells]
            sp = cpx.new(max(xs_) - min(xs_) + 3, max(ys_) - min(ys_) + 3, -min(xs_) + 1, -min(ys_) + 1)
            for (dx, dy), code in cells.items():
                if code == 'R':
                    continue
                cpx.put(sp, sp.ax + dx, sp.ay + dy, {'L': 'g6', 'T': 'g8', 'S': 'g3', 'B': 'g2'}[code])
            self.add(sp, x, y + 1, z=y + 1.2)
            x += every + rng.randint(-2, 4)

    def throw_poly(self, pts):
        self.shadow |= cpx.poly_mask(W, H, pts)

    def throw_ell(self, cx, cy, rx, ry):
        self.shadow |= ell_mask(W, H, cx, cy, rx, ry)

    def add(self, spr, fx, fy, z=None, flip=False):
        self.items.append((fy if z is None else z, 'ix', spr, int(round(fx)), int(round(fy)), flip))

    def add_rgba(self, a, x, y, z):
        self.items.append((z, 'rgba', a, int(x), int(y), False))

    def render(self):
        g = self.g.copy()
        sh = self.shadow & np.isin(g, cpx.ids(('g', 'd')))
        g[sh] = cpx.lut(-1)[g[sh]]
        out = Image.fromarray(cpx.to_rgba(g), 'RGBA')
        for (z, kind, spr, x, y, flip) in sorted(self.items, key=lambda t: t[0]):
            if kind == 'ix':
                a = spr.ix[:, ::-1] if flip else spr.ix
                ax = (spr.w - 1 - spr.ax) if flip else spr.ax
                im = Image.fromarray(cpx.to_rgba(a), 'RGBA')
                im.putalpha(Image.fromarray(((a != CLEAR) * 255).astype(np.uint8)))
                out.alpha_composite(im, (x - ax, y - spr.ay)) if x - ax >= 0 and y - spr.ay >= 0 else _paste(out, im, x - ax, y - spr.ay)
            else:
                _paste(out, Image.fromarray(spr, 'RGBA'), x, y)
        return out


def _paste(out, im, x, y):
    """alpha_composite with negative offsets allowed."""
    cx0, cy0 = max(0, -x), max(0, -y)
    if cx0 >= im.width or cy0 >= im.height:
        return
    im = im.crop((cx0, cy0, im.width, im.height))
    out.alpha_composite(im, (max(0, x), max(0, y)))


def person(st, key, fx, fy, flip=False, z=None):
    a = PP.load(key)
    if flip:
        a = a[:, ::-1].copy()
    fxl, fyl = PP.FEET[key]
    if flip:
        fxl = a.shape[1] - 1 - fxl
    sil = PP.silhouette(a)
    m, x0, y0 = PP.cast_shadow(sil, fxl, fyl)
    st.throw(m, fx + x0, fy + y0)
    st.throw_ell(fx + 3, fy + 1, 22, 6)
    st.add_rgba(PP.inked(a), fx - fxl, fy - fyl, fy if z is None else z)


def compose(seed=5):
    a, info = build_ground(seed)
    st = Stage(a)
    # ---- the tent
    tsp, tinfo = TT.tent()
    st.add(tsp, *TENT_AT)
    st.throw_sprite(tsp, *TENT_AT, zcap=200)
    st.tufts_at(TENT_AT[0] - 122, TENT_AT[0] - 60, TENT_AT[1], 3, 9)
    st.tufts_at(TENT_AT[0] + 60, TENT_AT[0] + 124, TENT_AT[1], 4, 8)
    # ---- the fire
    parts, shadows = FI.fire_ring()
    for (x, y, rx, ry) in shadows:
        st.throw_ell(FIRE[0] + x, FIRE[1] + y, rx, ry)
    for (sp, dx, dy, layer) in parts:
        st.add(sp, FIRE[0] + dx, FIRE[1] + dy, z=FIRE[1] - 30 + layer * 12)
    sm = FI.smoke()
    st.add(sm, FIRE[0] + 3, FIRE[1] - 90, z=FIRE[1] + 31)
    # ---- Lilina's log, Lilina seated on it under the blanket
    lg = WD.log_seat(150, 34, seed=7)
    st.add(lg, *LILINA_LOG)
    st.throw_sprite(lg, *LILINA_LOG)
    rgba, foot = RS.robe_seated()
    lx = LILINA_LOG[0] - 10
    sil = PP.silhouette(rgba)
    m, x0, y0 = PP.cast_shadow(sil, foot[0], foot[1])
    st.throw(m, lx + x0, LILINA_LOG[1] + y0)
    st.throw_ell(lx + 4, LILINA_LOG[1] + 1, 22, 5)
    st.add_rgba(PP.inked(rgba), lx - foot[0], LILINA_LOG[1] - foot[1], LILINA_LOG[1] + .5)
    # ---- the other two, standing
    person(st, 'board_marcus', *OAK_AT, flip=True)
    person(st, 'board_roy', *ROY_AT)
    # ---- the chopping stump and the firewood by the path
    stp = WD.stump()
    st.add(stp, 168, 520)
    st.throw_sprite(stp, 168, 520)
    st.tufts_at(150, 192, 520, 5, 9)
    sd_ = SD.standard()
    st.add(sd_, *STANDARD_AT)
    st.throw_sprite(sd_, *STANDARD_AT)
    fw = WD.firewood()
    st.add(fw, 120, 478)
    st.throw_sprite(fw, 120, 478)
    st.tufts_at(80, 162, 478, 6, 10)
    # ---- her bedroll, rolled and strapped, on the ground at the log's east end; a second log on the near side
    bd = BD.rolled()
    st.add(bd, *BEDROLL_AT)
    st.throw_sprite(bd, *BEDROLL_AT)
    lg2 = WD.log_seat(118, 30, seed=11, knots=1)
    st.add(lg2, *LOG2_AT)
    st.throw_sprite(lg2, *LOG2_AT)
    st.tufts_at(LOG2_AT[0] - 40, LOG2_AT[0] + 58, LOG2_AT[1], 7, 11)
    # ---- packs by the tent's west foot
    for (sx, sy, sd) in ((560, 440, 1), (582, 446, 2)):
        sk = BD.sack(seed=sd)
        st.add(sk, sx, sy)
        st.throw_sprite(sk, sx, sy)
    # ---- the woods: a row of trees beyond the road, more to the east, one big tree on the west
    trees = [(530, 150, 112, 92, 120, 30, 11, 0), (660, 128, 104, 90, 118, 28, 12, 1), (790, 116, 116, 96, 126, 32, 13, 0),
             (920, 104, 110, 92, 120, 30, 14, 1), (1060, 92, 118, 96, 124, 32, 15, 0), (1200, 84, 110, 92, 120, 30, 16, 1),
             (400, 160, 108, 90, 120, 30, 17, 1), (270, 172, 110, 92, 122, 30, 18, 0),
             (858, 372, 108, 94, 140, 32, 21, 0), (1010, 460, 116, 98, 140, 34, 22, 1), (1180, 420, 112, 96, 140, 32, 23, 0),
             (1250, 640, 112, 96, 140, 32, 24, 1), (980, 700, 110, 94, 140, 32, 25, 0),
             (62, 398, 112, 96, 150, 34, 26, 0)]
    for (tx, ty, rx, ry, h, w, sd, lift) in trees:
        sp, off = BT.tree(rx, ry, h, w, sd, lift)
        st.add(sp, tx, ty)
        st.throw_sprite(sp, tx, ty, dapple=sd + 100)
    # bushes at the woods' edge and framing the corners
    for (bx, by, rx, ry, sd) in ((470, 186, 40, 26, 31), (610, 170, 36, 24, 32), (740, 160, 44, 28, 33), (838, 474, 40, 28, 34),
                                 (790, 640, 44, 30, 35), (150, 352, 36, 24, 36), (20, 560, 40, 28, 37)):
        bu = BT.bush(rx, ry, sd)
        st.add(bu, bx, by)
        st.throw_sprite(bu, bx, by, dapple=sd + 200)
    return st


if __name__ == '__main__':
    from PIL import Image
    st = compose()
    im = st.render()
    im.save('t/world.png')
    print('ok')
