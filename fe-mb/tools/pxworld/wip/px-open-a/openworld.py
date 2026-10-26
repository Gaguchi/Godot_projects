"""Variant A's overworld as pixel art: dirs/pxworld/borderlands.py, copied and driven by layout_a.py.

render(company=True) -> (Canvas, info): the 1280 x 720 world at grain 1 (one art px per screen px).
Same kit, same painters, same places as the accepted PxMap1x; only the layout changes, plus what that layout needs:
  - camp_gates: the camp's stake ring with three gates (north, west, south), one for each road out;
  - the market, South Junction and Pine Crossing re-laid on their new streets (plans in plans_a.py);
  - fingerposts where roads leave the view (the board writes the names);
  - fords placed where this layout's roads wade.
Deterministic: fixed seeds throughout, crc32 for any seed taken from a name.
"""
import math
import os
import random
import sys
import zlib

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
for p in (os.path.join(DIRS, 'hyb-64'), DIRS, HERE):
    if p not in sys.path:
        sys.path.insert(0, p)
import world_map as WM                      # noqa: E402  (places.farm reads its farm anchors from here)
from paint import sample_catmull           # noqa: E402
from pxworld import pal, terrain as TR, trees as TS, places as PL, folk as FK, build as BD, props as PR   # noqa: E402
from pxworld.canvas import Canvas, Sprite, ellipse   # noqa: E402
import layout_a as LA                       # noqa: E402
import plans_a as PA                        # noqa: E402

P, NAMES = LA.P, LA.NAMES
W, H = 1280, 720
OWN_GROUND = {'riverside_market', 'south_junction', 'pine_crossing', 'old_mill_crossing'}
PATCH_SEEDS = {'frontier_camp': 585, 'traders_rest': 265, 'south_road_ambush': 432, 'bandit_hideout': 313, 'north_ridge_path': 527,
               'watchtower_ridge': 288, 'smugglers_cave': 29, 'border_fortress': 615, 'rodericks_camp': 37}
FIELD_KIND = {'h64-wheat': ('wheat', (1, 3)), 'h64-wheat2': ('wheat2', (3, -1)), 'h64-crop': ('crop', (0, 1)),
              'h64-crop2': ('crop2', (1, 0)), 'plough': ('plough', (-1, 3))}


def drawn(k):
    return k not in LA.OFF and k not in LA.HIDDEN


def road_geo():
    """Every road as a fine polyline from its waypoints (catmull through them); keys as in LA.ROADS."""
    geo = {}
    for a, b, pts in LA.ROADS:
        fine = sample_catmull(pts, 14)
        geo[(a, b)] = fine
    return geo


# ---- the rejection helpers for scattering trees and bushes
_river_pts = sample_catmull(LA.RIVER, 14)
_road_pts = [p for pts in road_geo().values() for p in pts]


def near(p, pts, d):
    d2 = d * d
    return any((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < d2 for q in pts)


def reject(p, rd=13, pd=44, wd=24):
    places = [q for k, q in P.items() if drawn(k)]
    return near(p, _road_pts, rd) or near(p, places, pd) or near(p, _river_pts, wd)


def pip(pt, poly):
    return WM.pip(pt, poly)


# ---------------------------------------------------------------- the camp: a stake ring with three gates
def stake_arc_gates(rx, ry, h, front, gaps):
    """build.stake_arc with several gates: gaps = [(angle, half-width)] in radians (screen y down)."""
    Wd, Hd = int(2 * rx) + 8, int(2 * ry) + h + 8
    S = Sprite(Wd, Hd, Wd // 2, int(ry) + h + 3)
    cx, cy = Wd // 2, int(ry) + h + 3
    cols = {}
    n = int(8 * (rx + ry))
    for i in range(n):
        a = 2 * math.pi * i / n
        if any(abs(((a - g0 + math.pi) % (2 * math.pi)) - math.pi) < g1 for g0, g1 in gaps):
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
                k = 'd2'
            elif y == top:
                k = 'd6' if c == 1 and not shade else ('d5' if c == 1 else body)
            BD._put(S, x, y, k)
    BD.selout(S)
    return S


def camp_gates(sc, x, y):
    """Frontier Camp: the stake ring gated north (Trader's Rest), west (South Road Ambush) and south (Riverside
    Market), tents in the quarters between the gate paths, the cookfire in the middle."""
    rx, ry = 40, 25
    cy = y + 3
    gaps = []
    for gx, gy in PA.CAMP_GATES:
        gaps.append((math.atan2(gy - cy, gx - x), PA.CAMP_GATE_HW))
    back = stake_arc_gates(rx, ry, 8, False, gaps)
    front = stake_arc_gates(rx, ry, 8, True, gaps)
    sc.add(back, x, cy, z=-ry - 1)
    sc.add(front, x, cy, z=ry + 1)
    sc.cv.shift(ellipse(x + 2, cy + 2, rx + 2, ry + 1.5), -1, PL.GROUND, where=lambda a: ~np.isin(a, pal.RAMP['d']))
    for (dx, dy, w, h, cloth) in PA.CAMP_TENTS:
        sc.add(BD.R(sc, PR.ridge_tent(w, h, cloth)), x + dx, y + dy, shadow='house')
    f = BD.R(sc, PR.fire(1))
    fx, fy = x + PA.CAMP_FIRE[0], y + PA.CAMP_FIRE[1]
    sc.add(f, fx, fy)
    sc.later(lambda cv: PR.smoke(cv, int(fx), int(fy - f.h), 1))


def watchtower_gates(sc, x, y, gaps):
    """places.watchtower with its stake ring gated where this layout's roads arrive (gaps = [(angle, half-width)])."""
    rx, ry = 26, 15
    cy = y + 5
    sc.add(stake_arc_gates(rx, ry, 8, False, gaps), x, cy, z=-ry - 1)
    sc.add(stake_arc_gates(rx, ry, 8, True, gaps), x, cy, z=ry + 1)
    sc.cv.shift(ellipse(x + 2, cy + 2, rx + 2, ry + 1.5), -1, PL.GROUND, where=lambda a: ~np.isin(a, pal.RAMP['d']))
    t = BD.stone_tower(14, 28, seed=2)
    tx, ty = x - 3, y + 3
    sc.add(t, tx, ty, shadow='house')
    fl = BD.R(sc, PR.flag(1, ('m3', 'b4'), h=12))
    sc.add(fl, tx - 1, ty - t.h + 3, z=t.h + 1)
    sc.add(BD.cottage(9, 'ns', 'shingle', 'boards', d=6, h=5, seed=3), x + 15, y + 10, shadow='house')
    sc.add(BD.woodpile(), x + 6, y + 13, shadow='house')


def exit_post(way):
    """The sign where a road leaves the view, in true scale to the folk (about 15 x 24, a mini is 16 x 24): a squared
    post and, for an east or west exit, an arm cut to a point down the road; for a north or south exit, where the
    road runs away from the viewer, a plank plaque facing us. Lit from the upper left, selout in the wood's ramp."""
    PH = 19                                       # the post, foot to the board's top
    S = Sprite(22, PH + 6)
    if way in 'ew':
        bw, bh, px = 14, 6, (3 if way == 'e' else 16)
        x0 = px if way == 'e' else px + 2 - bw
    else:
        bw, bh, px = 13, 7, 8
        x0 = px - 5
    y0 = 2
    for j in range(y0, y0 + PH):                  # the post: lit west face, shaded east face, its foot darker
        BD._put(S, px, j, 'w5' if j < y0 + PH - 2 else 'w4')
        BD._put(S, px + 1, j, 'w3' if j < y0 + PH - 2 else 'w2')
    mid = (bh - 1) / 2
    for j in range(bh):
        for i in range(bw):
            t = i if way == 'w' else bw - 1 - i   # columns from the pointed end
            if way in 'ew' and t < 4 and abs(j - mid) > t * .9 + .2:
                continue                            # the point
            k = 'w4'
            if j == 0:
                k = 'w6'
            elif j == 1:
                k = 'w5'
            elif j == bh - 1:
                k = 'w3'
            elif way in 'ns' and j == bh // 2:
                k = 'w3'                            # the seam between the plaque's two planks
            elif (i * 5 + j * 3) % 11 == 0:
                k = 'w3'                            # a run of grain
            BD._put(S, x0 + i, y0 + j, k)
    if way in 'ns':
        BD._put(S, x0 + 1, y0 + 1, 't5'); BD._put(S, x0 + bw - 2, y0 + 1, 't5')   # the nail heads
    BD.selout(S)
    S.ax, S.ay = px, y0 + PH - 1
    return S.trimmed()


def render(company=True, seed=11):
    rng = random.Random(seed)
    cv = Canvas(W, H)
    info = {}

    # ---- ground and hills
    TR.grass(cv, seed=4, g=1)
    hl = [(x, y, rx * 1.05, ry * 1.1, rot, 'ridge' if (x, y) in LA.RIDGES else 'mound') for (x, y, rx, ry, rot) in LA.HILLS]
    TR.hills(cv, hl, 1)

    # ---- fields
    fields_any = np.zeros((H, W), bool)
    for poly_pts, kind in LA.FIELDS:
        k, vec = FIELD_KIND[kind]
        fm = TR.field(cv, poly_pts, k, vec, width=4, g=1)
        if fm is not None:
            fields_any |= fm

    # ---- trampled ground under the places that do not bring their own
    for k, (x, y) in P.items():
        if not drawn(k) or k in OWN_GROUND:
            continue
        big = k in ('frontier_camp', 'border_fortress')
        rx, ry = (40, 26) if big else (28, 19)
        TR.patch(cv, x, y - 4, rx, ry, seed=PATCH_SEEDS.get(k, zlib.crc32(k.encode()) % 1000), g=1)
    for (px_, py_, w_, h_) in PA.GROUND_YARDS:
        BD.yard(cv, px_, py_, w_, h_, seed=px_ * 7 + py_)

    # ---- the river
    rpts = sample_catmull(LA.RIVER, 14)
    rd = TR.river(cv, rpts, 10.0, 1)
    water = rd['water']

    # ---- roads (never over open water; the fords and the mill bridge carry them across)
    geo = road_geo()
    road_any = np.zeros((H, W), bool)
    for key, fine in geo.items():
        m = TR.road(cv, fine, 3.1, 1, pebbles=.02, seed=len(fine), not_on=water)
        if m is not None:
            road_any |= m
    TR.ripples(cv, rd, rpts, 1)
    for (sx, sy, off) in LA.RIVER_ROCKS:
        q = min(rpts, key=lambda p: math.dist(p, (sx, sy)))
        TR.river_rock(cv, q[0] + off - 2, q[1], 1)
    for key, flow in LA.FORDS.items():
        BD.ford(cv, water, geo[key], width=7, flow=flow, seed=len(key[0]))
    info.update(water=water, roads=road_any, fields=fields_any, road_px=geo, river=rpts)

    # ---- ground detail: tufts, flowers, field stones (never on roads, water or fields)
    blocked = water | road_any | fields_any | rd['bank']

    def free(p, pad=2):
        x, y = int(p[0]), int(p[1])
        return 0 <= x < W and 0 <= y < H and not blocked[max(0, y - pad):y + pad + 1, max(0, x - pad):x + pad + 1].any()
    centres = TR.poisson(rng, 0, 0, W, H, 46, 3000, free)
    tpts = TR.clustered(rng, centres, (3, 8), 8, free) + TR.poisson(rng, 0, 0, W, H, 34, 2000, free)
    TR.tufts(cv, rng, tpts, 1)
    TR.flowers(cv, rng, TR.poisson(rng, 0, 0, W, H, 70, 900, free), g=1)
    TR.stones(cv, rng, TR.poisson(rng, 0, 0, W, H, 90, 500, free), g=1)
    # reeds along both banks, in beds, clear of the crossings
    reed_pts = []
    L = TR.poly_len(rpts)
    s_ = 0.0
    while s_ < L:
        if rng.random() < .45:
            p, tan = TR.point_at(rpts, s_)
            side = rng.choice((-1, 1))
            nx, ny = tan[1] * side, -tan[0] * side
            for k in range(rng.randint(2, 4)):
                off = 10 + rng.uniform(-1.2, 1.5)
                q = (p[0] + nx * off + tan[0] * k * 4, p[1] + ny * off + tan[1] * k * 4 + 1)
                if min(math.dist(q, c) for c in LA.CROSSINGS) > 30:
                    reed_pts.append(q)
        s_ += rng.uniform(18, 34)
    TR.reeds(cv, rng, reed_pts, 1)

    # ---- hedgerows on two of every three field edges
    hedge_pts = []
    for poly_pts, kind in LA.FIELDS:
        n = len(poly_pts)
        for i in range(n):
            if (i + n) % 3 == 1:
                continue
            hedge_pts += TS.hedge(cv, poly_pts[i], poly_pts[(i + 1) % n], rng, 1)
    TS.stamp_bushes(cv, hedge_pts)

    # ---- everything that stands up, sorted north to south
    sc = PL.Scene(cv, 1, seed=seed)
    sc.roads, sc.water, sc.road_px, sc.fields = road_any, water, geo, fields_any
    sc.ground = ('g', 'd', 'h', 't')
    sc.reink = True
    for poly_pts, kind in LA.FORESTS:
        def rj(p, kind=kind):
            return reject(p, 13, 46 if kind == 'leaf' else 40, 24)
        pts = WM.scatter(poly_pts, (9 if kind == 'leaf' else 8.5), rng, 6000, rj)
        if kind == 'leaf':
            TS.forest(cv, pts, rng, 8, 13, 'leaf', g=1, scene=sc)
        else:
            TS.forest(cv, pts, rng, 8, 11, 'pine', g=1, scene=sc)
    lone = []
    for _ in range(90):
        p = (rng.uniform(120, 1220), rng.uniform(60, 700))
        if not reject(p, 14, 50, 26) and not any(pip(p, poly_pts) for poly_pts, _ in LA.FIELDS) \
                and not any(pip(p, poly_pts) for poly_pts, _ in LA.FORESTS):
            lone.append(p)
    for (x, y) in lone[:30]:
        sc.tree(x, y, rng.uniform(7, 10))

    def meadow(p):
        return free(p, 3) and not reject(p, 14, 46, 26) and not any(pip(p, poly_pts) for poly_pts, _ in LA.FORESTS)
    for (x, y) in TR.poisson(rng, 0, 0, W, H, 70, 2500, meadow)[:50]:
        r = rng.uniform(2.8, 4.4)
        sp = TS.bush(r, rng.randint(0, 9), lift=rng.choice((0, 1)))
        sc.add(sp, x, y + (sp.h - 1) // 2, shadow=('ell', r * .7, 1, r * 1.1, r * .6))

    for k, (x, y) in P.items():
        if not drawn(k):
            continue
        if k == 'frontier_camp':
            camp_gates(sc, x, y)
        elif k == 'traders_rest':
            PL.camp(sc, x, y, 'traders')
        elif k == 'rodericks_camp':
            PL.camp(sc, x, y, 'roderick')
        elif k == 'riverside_market':
            PL.lay(sc, PA.MARKET, x - PA.MARKET_AT[0], y - PA.MARKET_AT[1])
        elif k == 'south_junction':
            PL.lay(sc, PA.JUNCTION, x - PA.JUNCTION_AT[0], y - PA.JUNCTION_AT[1])
        elif k == 'pine_crossing':
            PL.lay(sc, PA.PINE, x - PA.PINE_AT[0], y - PA.PINE_AT[1])
        elif k == 'watchtower_ridge':
            watchtower_gates(sc, x, y, PA.WATCH_GATES)
        elif k == 'border_fortress':
            PL.fortress(sc, x, y)
        elif k == 'smugglers_cave':
            PL.cave(sc, x, y)
            sc.items.pop()                        # the loose rock at the mouth's east foot: the ford road comes in there
        elif k == 'bandit_hideout':
            PL.hideout(sc, x, y)
        elif k == 'south_road_ambush':
            PL.wreck(sc, x, y)
        elif k == 'old_mill_crossing':
            PL.mill(sc, x, y, x + 8)
    for (x, y, i) in LA.FARMS:
        PL.farm(sc, x, y, i)
    # finger-posts where the roads leave the view (the board writes what lies that way)
    for (sx, sy, way) in PA.EDGE_POSTS:
        sc.add(exit_post(way), sx, sy, shadow='house')
    for (x, y, r) in LA.CREST:
        sc.rock(x, y, r * .75)
    if company:
        fx, fy = PA.COMPANY_AT if company is True else company
        for spr, dx, dy in FK.company_items(1):
            sc.add(spr, fx + dx, fy + dy, shadow=('ell', 1, 1, 5, 2))
        info['company'] = (fx, fy)
    sc.draw()
    return cv, info


if __name__ == '__main__':
    cv, info = render()
    out = os.path.join(HERE, 't', 'world_a.png')
    cv.save(out, zoom=1)
    print('wrote', out)
