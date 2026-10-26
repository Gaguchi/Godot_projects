"""The title's world: a deep daylight view east over the Borderlands, as one 1280 x 720 pixel PNG.

The company stands on the road in the foreground at 1:1 (the 104 x 152 board sprites) beside its standard. The
road runs away from them to a stone bridge square across the river; the village's roofs show over the bridge on
the far bank; fields and hedgerows to the west; woods and two ranges of hills on the horizon; a daylight sky.
Every far thing is smaller by perspective (persp.py), never by a second scale on the same ground.

    python title_scene.py            -> t/title_world.png (+ a 3x crop sheet)
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cpx                                   # noqa: E402
import deep as D                             # noqa: E402
import ground as GR                          # noqa: E402
import persp as P                            # noqa: E402
import sky as SK                             # noqa: E402
import title_plan as TP                      # noqa: E402
from cpx import pal, ix, CLEAR, nb           # noqa: E402
from stage import Stage                      # noqa: E402

W, H = P.W, P.H
COMPANY = [('board_marcus', 452, 664, False), ('board_roy', 548, 670, False), ('board_lilina', 642, 662, False)]
STANDARD_AT = (712, 650)


def ground_layer(seed=5):
    rng = random.Random(seed)
    X, Z = P.ground_grid()
    gnd = np.isfinite(Z)
    a = np.full((H, W), CLEAR, np.uint8)
    SK.sky(a, seed)
    a[gnd] = D.meadow(X, Z, gnd, seed)[gnd]
    info = {}
    # ---- fields and their grass margins
    fmask = np.zeros((H, W), bool)
    for i, (x0, x1, z0, z1, kind, rows, skew) in enumerate(TP.FIELDS):
        poly = D.proj_quad(x0, x1, z0, z1, skew)
        m = D.field(a, poly, kind, X, Z, rng, gnd, rows=rows, spacing=.75 if kind != 'plough' else .55, seed=i)
        fmask |= m
    info['fields'] = fmask
    # ---- the road
    rpts = TP.road_pts()
    road, sd, rd = D.road(a, X, Z, rpts, TP.ROAD_W / 2, seed=2, ground=gnd)
    info['road'] = road
    # ---- the river and its banks
    wet, u, hw = D.water(a, X, Z, TP.river_x, TP.river_w, gnd, seed=4)
    info['water'] = wet
    # ---- texture: grass blades up into lighter patches, then tufts, flowers, distant strokes
    D.serrate(a, seed)
    meadow = np.isin(a, D.G_IDS) & gnd & ~fmask
    GR.grass_over_dirt(a, road, seed)
    D.dirt_detail(a, road, rng)
    ok = lambda x, y: meadow[int(y), int(x)]          # noqa: E731
    near_y = int(P.y_of_Z(60))
    pts = D.vpoisson(rng, 0, near_y, W, H, 9.0, ok=ok)
    D.tufts(a, rng, [p for p in pts if rng.random() < .55])
    pts = D.vpoisson(rng, 0, int(P.y_of_Z(200)), W, near_y, 7.0, ok=ok)
    D.strokes(a, rng, [p for p in pts if rng.random() < .5], D.G_IDS)
    dist_out = ndimage.distance_transform_edt(~(road | wet | fmask))
    edge = meadow & (dist_out < 3 + 0 * dist_out) & (dist_out > 1)
    pts = D.vpoisson(rng, 0, near_y, W, H, 7.0, ok=lambda x, y: edge[int(y), int(x)])
    D.tufts(a, rng, pts, 1.1)
    cen = D.vpoisson(rng, 0, int(P.y_of_Z(80)), W, H, 70, ok=ok)
    D.flowers(a, rng, cen)
    # grass back onto the road's crown near the company
    crown = road & (np.abs(sd) < .35) & (Z < 24)
    pts = [p for p in D.vpoisson(rng, 0, int(P.y_of_Z(24)), W, H, 8, ok=lambda x, y: crown[int(y), int(x)]) if rng.random() < .7]
    D.tufts(a, rng, pts, .7, dirt=True)
    D.ripples(a, wet, rng)
    return a, X, Z, info


def compose(seed=5):
    a, X, Z, info = ground_layer(seed)
    rng = random.Random(seed + 1)
    gnd = np.isfinite(Z)
    # ---- the hills under the sky: a far range in Slate, a nearer one in Pine (drawn into the ground layer)
    r3 = random.Random(41)
    far = []
    x = -60
    while x < W + 80:
        # a rumpled range: summits higher behind the village (east), low behind the wordmark (west)
        lift = 1.0 if x > 760 else (.55 if x > 480 else .35)
        far.append((x, r3.uniform(70, 150), r3.uniform(16, 34) * lift + r3.uniform(4, 22) * lift))
        x += r3.uniform(45, 95)
    r3.shuffle(far)
    far.sort(key=lambda m: -m[2])        # taller summits first, so lower shoulders lie in front of them
    near = [(120, 220, 16), (420, 260, 20), (700, 210, 24), (930, 240, 30), (1150, 230, 26), (1300, 160, 18)]
    SK.domes(a, far, ('s3', 's3', 's4'), lit_cut=.8, shade_cut=-9)
    SK.domes(a, near, ('p2', 'p3', 'p4'))
    # ---- the bridge, its reflection on the water in front of it
    import bridge_deep as BRD
    br, binfo = BRD.build()
    BRD.reflect(a, br, binfo, info['water'])
    info['bridge'] = binfo
    st = Stage(a)
    st.add(br, binfo['x0'], binfo['foot'])
    # ---- clouds
    for (cx, cy, w, h, sd) in ((1040, 92, 230, 64, 3), (760, 60, 120, 34, 5), (590, 140, 90, 24, 7), (1210, 168, 110, 30, 9)):
        c = SK.cloud(w, h, sd)
        st.add(c, cx, cy, z=-1000 + cy)
    # ---- the far woods: a band of small crowns along the horizon, thicker in places, with gaps
    import flora as FL
    from pxworld import trees as TS
    dens = D.wnoise(np.arange(W, dtype=float), np.zeros(W), 90.0, 31, fade=False)
    for (x, y) in cpx.poisson(rng, -10, P.YH + 3, W + 10, P.YH + 12, 4.2, 6000):
        k = int(min(W - 1, max(0, x)))
        if dens[k] < -.55 and rng.random() < .8:
            continue
        Zt = float(P.Z_of_y(y + .5))
        r = max(2, min(7, int(round(rng.uniform(2.6, 3.6) * P.F / Zt * (1.2 if dens[k] > .4 else 1)))))
        sp = TS.pine_small(int(r * 2.6), seed=rng.randint(0, 9999)) if rng.random() < .25 else TS.clumps(r, seed=rng.randint(0, 9999), ramp='l')
        st.add(sp, x, y)
    # ---- copses on the far fields, west of the river
    for (cx_, cz, n, spread, sd) in ((-20, 340, 5, 12, 2), (70, 260, 5, 10, 6), (130, 300, 6, 14, 7)):
        r2 = random.Random(sd)
        for k in range(n):
            Xt, Zt = cx_ + r2.uniform(-spread, spread), cz + r2.uniform(-spread * .8, spread * .8)
            x, y = P.proj(Xt, Zt)
            if not gnd[min(P.H - 1, int(y)), min(W - 1, max(0, int(x)))]:
                continue
            sp = FL.tree_at(Zt, r2.uniform(9, 13), r2.uniform(3.2, 4.6), seed=sd * 50 + k, lift=r2.choice((0, 0, 1)))
            st.add(sp, x, y)
            st.throw_sprite(sp, x, y, squash=.5, contact=False)
    # ---- hedgerows along the fields' far and east edges (none round the nearest field: it is open to the road)
    for i, (x0, x1, z0, z1, kind, rows, skew) in enumerate(TP.FIELDS):
        if z1 < 70 or z0 > 200:
            continue
        r2 = random.Random(100 + i)
        sk = lambda z: skew * (z - 30)          # noqa: E731
        hb, (hx, hy) = FL.hedge_band((P.H, W), ((x0 + sk(z1), z1 + .8), (x1 + sk(z1) + 1, z1 + .8)), r2, h_m=1.05)
        if hb is not None:
            st.add(hb, hx, hy)
            sh_ = np.zeros((P.H, W), bool)
            m_ = hb.ix != CLEAR
            ys_, xs_ = np.nonzero(m_)
            dy_ = max(1, int(round(P.F / z1 * .35)))
            Y_ = np.clip(ys_ + hy - hb.ay + dy_, 0, P.H - 1)
            X_ = np.clip(xs_ + hx + dy_, 0, W - 1)
            sh_[Y_, X_] = True
            st.shadow |= sh_
    # ---- the lone oak at the field corner, west of the road
    oz = 76.0
    ox, oy = P.proj(3.0, oz)
    oak = FL.tree_at(oz, 12.0, 5.4, seed=41, lift=0, squash=.74, trunk_m=1.05)
    st.add(oak, ox, oy)
    st.throw_sprite(oak, ox, oy, squash=.45, contact=True, dapple=77)
    # ---- the village on the far bank, round the road's far end
    import house_deep as HD
    smoke = []
    for (Xh, Zh, roof, wall, ridge, w, sd) in TP.VILLAGE:
        d = 5.5 if ridge == 'ew' else w * 1.35
        ww = w if ridge == 'ew' else 6.0
        hs, hinf = HD.house(Xh, Zh, ww, d, 3.0, ridge, roof, wall, 1.0, sd)
        fx, fy = P.proj(Xh, Zh)
        st.add(hs, round(fx), round(fy))
        sw = P.F / Zh
        sh = np.zeros((P.H, W), bool)
        m = hs.ix != CLEAR
        ys_, xs_ = np.nonzero(m)
        bx0, by0 = int(round(fx)) - hs.ax, int(round(fy)) - hs.ay
        for kk in range(0, int(1.4 * sw) + 1):
            yy_ = np.clip(ys_ + by0 + int(kk * .35), 0, P.H - 1)
            xx_ = np.clip(xs_ + bx0 + kk, 0, W - 1)
            sh[yy_, xx_] = True
        st.shadow |= sh & (np.arange(P.H)[:, None] > fy - 2 * sw)
        if hinf['chimney'] and sd % 3 != 1:
            smoke.append(hinf['chimney'])
    # trees and an orchard about the village
    for (Xt, Zt, hm, cm, sd) in ((36, 118, 10, 3.8, 61), (47, 112, 9, 3.4, 62), (64, 122, 11, 4.0, 63), (58, 92, 7, 2.6, 67)):
        x, y = P.proj(Xt, Zt)
        sp = FL.tree_at(Zt, hm, cm, seed=sd, lift=1 if sd % 2 else 0)
        st.add(sp, x, y)
        st.throw_sprite(sp, x, y, squash=.5, contact=False)
    # ---- bushes on the near bank and the meadow between the road and the river; reeds along both banks
    for (Xb, Zb, wm, hm, sd) in ((9.2, 19.0, 2.4, 1.5, 73), (19.5, 33.5, 2.2, 1.4, 75)):
        x, y = P.proj(Xb, Zb)
        sp = FL.bush_at(Zb, wm, hm, seed=sd)
        st.add(sp, x, y)
        st.throw_sprite(sp, x, y, squash=.5, dapple=sd)
    wet = info['water']
    rr = random.Random(9)
    for Zr in np.arange(14.0, 34.0, .55):
        xc = float(TP.river_x(Zr)); hwr = float(TP.river_w(Zr)) / 2
        for (Xr, side) in ((xc - hwr - .15, -1), (xc + hwr + .25, 1)):
            if rr.random() < .5:
                continue
            x, y = P.proj(Xr + rr.uniform(-.2, .2), Zr)
            if not (0 <= x < W):
                continue
            s_ = P.F / Zr
            if s_ > 30:
                sp = FL.reed_clump(s_ * rr.uniform(.8, 1.05), seed=rr.randint(0, 999))
                st.add(sp, x, y)
    # ---- by the road: a milestone on the east verge; field boulders on both sides
    import props_deep as PD
    mz = 19.5
    mx_, my_ = P.proj(3.05, mz)
    ms = PD.milestone(P.F / mz)
    st.add(ms, mx_, my_)
    st.throw_sprite(ms, mx_, my_)
    for (Xb, Zb, wm, hm, sd) in ((7.4, 14.6, .9, .55, 81), (8.2, 15.2, .55, .36, 82), (-5.4, 13.6, .8, .5, 83),
                                 (-4.6, 14.4, .45, .3, 84)):
        s_ = P.F / Zb
        bo = PD.boulder(int(wm * s_), int(hm * s_), sd)
        x, y = P.proj(Xb, Zb)
        st.add(bo, x, y)
        st.throw_sprite(bo, x, y)
    # ---- the company and the standard
    import standard as SDm
    sdd = SDm.standard()
    st.add(sdd, *STANDARD_AT)
    st.throw_sprite(sdd, *STANDARD_AT)
    for (key, fx, fy, flip) in COMPANY:
        st.person(key, fx, fy, flip)
    info['smoke'] = smoke
    return st, info


if __name__ == '__main__':
    st, info = compose()
    im = st.render()
    os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
    im.save(os.path.join(HERE, 't', 'title_world.png'))
    print('ok')
