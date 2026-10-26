"""Frontier Camp at camp scale, for the prologue: one 1280 x 720 pixel PNG, PxCamp's technique and scale.

We stand inside the stockade in the morning sun. Its back wall of sharpened stakes runs across the top of the stage
on the curve of the ring, rails and lashings on its inner face, props raking against it; the gate stands open at the
back right and the road runs in through it; beyond the gate the fingerpost at the fork points the three roads east.
Trees stand outside the wall. Inside: two ridge tents (the second with a madder stripe), the standard, the covered
wagon, the fire, and the company, people at 1:1 (the 104 x 152 board sprites), every prop in true scale to them.
The talk box covers the bottom of the stage (190..1090 x 524..706), so the company's feet sit just above it.

    python prologue_scene.py        -> t/prologue_world.png
"""
import math
import os
import random
import sys

import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cpx                                    # noqa: E402
import ground as GR                           # noqa: E402
from cpx import pal, ix, CLEAR, K, grid, ell_mask, seg_dist, wobble, poisson, nb, smooth_noise   # noqa: E402
from stage import Stage                       # noqa: E402

W, H = 1280, 720
RING = (640, 610, 1060, 386)                  # the stockade's ring: centre and radii on the stage
GATE = (968, 1196)                            # the gate's opening, x
FIRE = (586, 470)
COMPANY = [('board_roy', 452, 506, False), ('board_lilina', 712, 500, False), ('board_marcus', 866, 510, True)]
TENT_A = (318, 384)
TENT_B = (770, 352)
STANDARD_AT = (926, 334)
WAGON_AT = (196, 498)
POST_AT = (1054, 214)                         # the fingerpost outside the gate


def wall_y(x):
    cx, cy, rx, ry = RING
    u = np.clip((np.asarray(x, float) - cx) / rx, -1, 1)
    return cy - ry * np.sqrt(1 - u * u)


ROAD = cpx.catmull([(760, 470), (850, 402), (960, 330), (1062, 268), (1110, 230), (1160, 170), (1230, 92), (1310, 20)], 10)
ROAD_HW = 34


def build_ground(seed=7):
    a = GR.meadow(W, H, seed)
    xx, yy = grid(W, H)
    rng = random.Random(seed)
    GR.serrate(a, [ix('g4'), ix('g5'), ix('g6')], seed)
    foot = wall_y(xx)
    inside = yy > foot + 2
    # ---- the trodden ground inside the ring: most of the camp, grass left along the wall's bank and in the corners
    cl = ((xx - 600) / 640) ** 2 + ((yy - 470) / 200) ** 2
    f = (1 - cl) * 1.4
    fr = GR.ragged(f, seed + 9, W, H, amp=(.22, .12, .07), cells=(52, 19, 7))
    clear = (fr > 0) & inside & (yy > foot + 26)
    # ---- the road in through the gate and out to the fork, ruts and all
    d, along = seg_dist(xx, yy, ROAD)
    hw = ROAD_HW + wobble(seed + 1, 150)(along) * 4
    road = GR.ragged((hw - d) / hw, seed + 3, W, H, amp=(.06, .045, .035), cells=(44, 15, 6)) > 0
    road = GR.drop_small(cpx.clean(road, 3), 40)
    isl = smooth_noise(W, H, 16, seed + 50)
    clear &= ~((fr < .16) & (isl > .42))
    clear = GR.drop_small(cpx.clean(clear, 3), 30)
    dirt = clear | road
    dirt = ~GR.drop_small(~dirt, 25)
    GR.paint_dirt(a, dirt, 'd4', seed)
    # ruts along the road: grooves shadowed on their upper lip
    side = np.sign((xx - 0) * 0 + 1)
    for k, off in enumerate((-13, 12)):
        # offset perpendicular to the road: approximate with the distance field and which side of the line
        pass
    for k, off in enumerate((-.42, .38)):
        rut = road & (np.abs(d - abs(off) * ROAD_HW) < 2.4 + wobble(seed + 30 + k, 55)(along)) & (_side(xx, yy, ROAD) * np.sign(off) > 0)
        rut &= along > 90                         # the ruts fade out where the track spreads into the trodden ground
        rut = GR.drop_small(cpx.clean(rut, 3), 20)
        a[rut] = ix('d3')
        a[rut & ~nb(rut, 0, -1, False)] = ix('d2')
        lip = ~rut & nb(rut, 0, -1, False) & road
        a[lip] = ix('d5')
    rutm = np.isin(a, [ix('d2'), ix('d3')]) & road
    GR.dirt_texture(a, road & ~rutm, rng, 1.0)
    GR.dirt_texture(a, clear & ~road, rng, 1.3)
    # scuffs where boots wear the ground round the fire
    pts = [p for p in poisson(rng, 300, 400, 980, 520, 18, 3000) if clear[int(p[1]), int(p[0])]]
    GR.scuffs(a, rng, pts)
    GR.grass_over_dirt(a, dirt, seed)
    # ---- the earth bank heaped along the stakes' foot, inside: a lit crest, its face toward us in shade
    bank = inside & (yy < foot + 15 + 3 * smooth_noise(W, H, 30, seed + 5)) & ~((xx > GATE[0] - 4) & (xx < GATE[1] + 4))
    a[bank] = ix('d4')
    a[bank & (yy < foot + 6)] = ix('d5')
    a[bank & (yy > foot + 11)] = ix('d3')
    # ---- tufts on the dirt near its edge, grass along the bank, pebbles and twigs
    dist_in = ndimage.distance_transform_edt(dirt)
    near = (dist_in > 2) & (dist_in < 22)
    pts = [p for p in poisson(rng, 0, 0, W, H, 9, 12000) if near[int(p[1]), int(p[0])] and rng.random() < .6 - dist_in[int(p[1]), int(p[0])] / 40]
    GR.tufts(a, rng, pts, .75, dirt=True)
    on = dist_in > 4
    for (x, y) in poisson(rng, 0, 0, W, H, 26, 5000):
        if not on[int(y), int(x)]:
            continue
        r_ = rng.random()
        if r_ < .55:
            GR.pebble(a, int(x), int(y), rng, big=r_ < .14, ramp='t' if r_ < .4 else 'd', base=0 if r_ < .4 else 1)
        elif r_ < .66:
            GR.twig(a, x, y, rng)
    dist_out = ndimage.distance_transform_edt(~dirt)
    meadow = ~dirt & ~bank
    dens = smooth_noise(W, H, 70, seed + 77)
    pts = [p for p in poisson(rng, 0, 0, W, H, 9, 30000) if meadow[int(p[1]), int(p[0])] and rng.random() < .2 + .7 * max(0, dens[int(p[1]), int(p[0])])]
    GR.tufts(a, rng, pts, 1.0)
    pts = [p for p in poisson(rng, 0, 0, W, H, 6, 60000) if meadow[int(p[1]), int(p[0])] and rng.random() < .3 + .5 * max(0, dens[int(p[1]), int(p[0])])]
    GR.blade_marks(a, rng, pts)
    edge = meadow & (dist_out < 10) & (dist_out > 1)
    pts = [p for p in poisson(rng, 0, 0, W, H, 7, 14000) if edge[int(p[1]), int(p[0])]]
    GR.tufts(a, rng, pts, 1.15)
    bank_edge = inside & (np.abs(yy - (foot + 15)) < 3)
    pts = [p for p in poisson(rng, 0, 0, W, H, 8, 8000) if bank_edge[int(p[1]), int(p[0])]]
    GR.tufts(a, rng, pts, 1.1)
    for (x, y) in poisson(rng, 0, 0, W, H, 40, 3000):
        if meadow[int(y), int(x)] and dist_out[int(y), int(x)] > 3 and (dist_out[int(y), int(x)] < 16 or dens[int(y), int(x)] > .35):
            GR.clump(a, rng, int(x), int(y), rng.choice((12, 14, 16, 20)), rng.choice((9, 11, 13)))
    cen = [p for p in poisson(rng, 0, 0, W, H, 64, 900) if meadow[int(p[1]), int(p[0])] and dist_out[int(p[1]), int(p[0])] > 12]
    GR.flowers(a, rng, cen[:60])
    return a, dict(dirt=dirt, road=road, clear=clear)


def _side(xx, yy, pts):
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


def striped(sp, band, ramp='x'):
    """Dye a band of a canvas tent: every Bone pixel in the rows y0..y1 (sprite rows) moves to the same level of
    another ramp (madder), so the stripe keeps the canvas's own light and folds."""
    y0, y1 = band
    lv_map = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 4}
    for y in range(max(0, y0), min(sp.h, y1)):
        for x in range(sp.w):
            v = int(sp.ix[y, x])
            if v != CLEAR and pal.RAMP_OF[v] == 'b':
                sp.ix[y, x] = pal.RAMP[ramp][min(len(pal.RAMP[ramp]) - 1, lv_map[pal.LEVEL[v]])]
    return sp


def compose(seed=7):
    import bigtree as BT
    import bedding as BD
    import camp_props as CP
    from camp_props import pot
    import fire as FI
    import palisade as PA
    import standard as SD
    import tent as TT
    import wood as WD
    a, info = build_ground(seed)
    st = Stage(a)
    rng = random.Random(seed)
    # ---- outside: trees standing beyond the wall (their crowns over the stakes), the fork and its fingerpost
    for (tx, ty, rx, ry, h, w, sd) in ((60, 150, 118, 98, 120, 32, 11), (300, 120, 112, 94, 128, 30, 12), (540, 104, 116, 96, 132, 32, 13),
                                       (790, 110, 108, 90, 126, 30, 14), (1262, 168, 112, 94, 120, 30, 15), (950, 64, 96, 80, 110, 28, 16),
                                       (180, 60, 100, 84, 110, 28, 17), (420, 40, 104, 86, 110, 28, 18), (680, 40, 100, 84, 110, 28, 19)):
        sp, off = BT.tree(rx, ry, h, w, sd, sd % 2)
        st.add(sp, tx, ty)
        st.throw_sprite(sp, tx, ty, dapple=sd + 100)
    for (bx, by, rx, ry, sd) in ((1140, 120, 40, 26, 31), (1250, 60, 44, 28, 32), (900, 190, 36, 22, 33)):
        bu = BT.bush(rx, ry, sd)
        st.add(bu, bx, by)
        st.throw_sprite(bu, bx, by, dapple=sd + 200)
    fp = CP.fingerpost()
    st.add(fp, *POST_AT)
    st.throw_sprite(fp, *POST_AT)
    # ---- the stockade's back wall: stakes on the ring's curve, centre outward (nearer stakes overlap farther)
    xs = []
    x = -16
    while x < W + 20:
        if not (GATE[0] - 6 < x < GATE[1] + 6):
            xs.append(x)
        x += 21
    for i, x in enumerate(sorted(xs, key=lambda v: wall_y(v))):
        r2 = random.Random(1000 + int(x))
        h = int(r2.uniform(166, 188))
        sp = PA.stake(h, r2.choice((22, 23, 24, 25, 26)), seed=int(x) + 3)
        fy = float(wall_y(x)) + r2.uniform(-1, 1)
        st.add(sp, x, fy, z=fy)
        st.throw_sprite(sp, x, fy, contact=False)
    # the gate: two heavy posts, the lintel across their heads, one leaf swung open against the wall
    gl, gr = GATE
    for gx_, sd in ((gl - 2, 1), (gr + 2, 2)):
        gp = PA.gate_post(226, 30, seed=sd)
        fy = float(wall_y(gx_)) + 4
        st.add(gp, gx_, fy, z=fy + .1)
        st.throw_sprite(gp, gx_, fy)
    ly = float(wall_y(gl)) + 4 - 226 + 8
    ly2 = float(wall_y(gr)) + 4 - 226 + 8
    li = PA.lintel(gr - gl + 44, 16)
    st.add(li, (gl + gr) / 2, (ly + ly2) / 2 + 8, z=320)
    # the rails along the inner face and their lashings
    def rail_y(frac):
        return lambda x: float(wall_y(x)) - 176 * frac
    for frac in (.3, .72):
        for (r0, r1) in ((-20, gl - 4), (gr + 4, W + 20)):
            rs, (rx0, ry0) = PA.rail_run(r0, r1, rail_y(frac), th=10, seed=int(frac * 100) + r0)
            st.add(rs, rx0, ry0, z=318 + frac)
    # lashings: a hemp wrap where each rail crosses a stake
    lash = cpx.new(W, H, 0, 0)
    for frac in (.3, .72):
        for x in xs:
            y = rail_y(frac)(x)
            for j in range(-6, 7):
                if (j + 6) % 3 != 2:
                    cpx.put(lash, x - 2, y + j, 'h3' if j < 0 else 'h2')
                    cpx.put(lash, x - 1, y + j, 'h2' if j < 0 else 'h1')
    st.add(lash, 0, 0, z=319)
    # raking props against the wall, now and then
    for x in (130, 470, 800):
        pp = PA.prop_pole(150, 64, th=11, seed=x)
        fy = float(wall_y(x)) + 58
        st.add(pp, x - 40, fy, z=max(fy, 321))
        st.throw_sprite(pp, x - 40, fy, zcap=60)
    gleaf = PA.gate_leaf(170, 196, seed=4)
    fy = float(wall_y(gl - 110)) + 12
    st.add(gleaf, gl - 98, fy, z=322)
    st.throw_sprite(gleaf, gl - 98, fy)
    # ---- the tents
    ta, tai = TT.tent()
    st.add(ta, *TENT_A)
    st.throw_sprite(ta, *TENT_A, zcap=200)
    st.tufts_at = None
    tb, tbi = TT.tent(Wg=212, Hg=160, D=(12, -52), seed=6)
    striped(tb, (tb.ay - 40, tb.ay - 28))
    st.add(tb, *TENT_B)
    st.throw_sprite(tb, *TENT_B, zcap=180)
    # ---- the standard by the gate
    sdd = SD.standard()
    st.add(sdd, *STANDARD_AT)
    st.throw_sprite(sdd, *STANDARD_AT)
    # ---- the wagon, its tongue resting toward the west
    wg, wgi = CP.wagon()
    st.add(wg, WAGON_AT[0], WAGON_AT[1], flip=True)
    st.throw_sprite(wg, WAGON_AT[0], WAGON_AT[1], flip=True, zcap=150)
    # ---- the fire, a log to sit on behind it, packs by the tents
    parts, shadows = FI.fire_ring()
    for (x, y, rx, ry) in shadows:
        st.throw_ell(FIRE[0] + x, FIRE[1] + y, rx, ry)
    for (sp, dx, dy, layer) in parts:
        st.add(sp, FIRE[0] + dx, FIRE[1] + dy, z=FIRE[1] - 30 + layer * 12)
    sm = FI.smoke()
    st.add(sm, FIRE[0] - 26, FIRE[1] - 118, z=FIRE[1] + 31)
    # the tripod over the fire and the pot hung from it on a chain, just above the flames' tips
    tb_, tf_, (hdx, hdy) = CP.tripod_legs(158, 124)
    st.add(tb_, FIRE[0], FIRE[1] + 4, z=FIRE[1] - 31)
    st.add(tf_, FIRE[0], FIRE[1] + 4, z=FIRE[1] + 30.5)
    st.throw_sprite(tf_, FIRE[0], FIRE[1] + 4, zcap=90)
    hx_, hy_ = FIRE[0] + hdx, FIRE[1] + 4 + hdy
    chain = cpx.new(6, 40, 3, 0)
    for j in range(0, 38):
        cpx.put(chain, 2 + (j // 3) % 2, j, 't3' if j % 3 else 't1')
    pt = pot(42, 30)
    py_ = hy_ + 30
    st.add(chain, hx_, hy_, z=FIRE[1] + 30.6)
    st.add(pt, hx_, py_, z=FIRE[1] + 30.7)
    lg = WD.log_seat(140, 32, seed=9)
    st.add(lg, FIRE[0] + 30, FIRE[1] - 44)
    st.throw_sprite(lg, FIRE[0] + 30, FIRE[1] - 44)
    for (sx, sy, sd) in ((468, 392, 1), (490, 398, 2), (884, 362, 3)):
        sk = BD.sack(seed=sd)
        st.add(sk, sx, sy)
        st.throw_sprite(sk, sx, sy)
    bd = BD.rolled()
    st.add(bd, 640, 386)
    st.throw_sprite(bd, 640, 386)
    # ---- by the wall: firewood stacked against it, a water barrel by the gate
    fw = WD.firewood()
    st.add(fw, 620, float(wall_y(620)) + 34, z=323)          # inside the wall: after its rails and lashings
    st.throw_sprite(fw, 620, float(wall_y(620)) + 34)
    for (bx, by, sd) in ((1214, 300, 1), (1250, 318, 2)):
        b = CP.barrel(seed=sd)
        st.add(b, bx, by, z=323 + by / 1000)
        st.throw_sprite(b, bx, by)
    # ---- the corners the talk box leaves: the wagon's load stacked at the left, the chopping stump at the right
    for (cx_, cy_, w_, h_, sd) in ((64, 640, 58, 48, 1), (126, 652, 52, 44, 2), (92, 596, 50, 42, 3)):
        c = CP.crate(w_, h_, seed=sd)
        st.add(c, cx_, cy_)
        st.throw_sprite(c, cx_, cy_)
    b = CP.barrel(seed=5)
    st.add(b, 160, 702)
    st.throw_sprite(b, 160, 702)
    stp = WD.stump()
    st.add(stp, 1170, 616)
    st.throw_sprite(stp, 1170, 616)
    sk = BD.sack(seed=7)
    st.add(sk, 1236, 664)
    st.throw_sprite(sk, 1236, 664)
    # ---- the company: Roy and Lilina either side of the fire, Oak by the tent, turned to them
    for (key, fx, fy, flip) in COMPANY:
        st.person(key, fx, fy, flip)
    return st, info


if __name__ == '__main__':
    st, info = compose()
    im = st.render()
    os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
    im.save(os.path.join(HERE, 't', 'prologue_world.png'))
    print('ok')
