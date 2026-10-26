"""The Borderlands overworld as pixel art: C's composition (dirs/hyb-64/world_map.py), redrawn.

render(g) -> (Canvas, info). g = 1: a 1280 x 720 art canvas (1 screen px per art px).
                              g = 2: a 640 x 360 art canvas, shown at 2x.
All place positions, roads, the river, fields, forests and hills come from the painted world's own data,
so labels and markers keep working. Stage coordinates are divided by g on the way in.

At grain 1 every road that meets the river is carried over it: the three mill roads run onto the timber
bridge at Old Mill Crossing, the roads to Broken Bridge end on its two abutments, and the roads from the
Bandit Hideout to Pine Crossing and from South Junction to the cave wade the river at fords.
render(g, skip={...}) leaves out the named places (for planning a layout on bare ground).
render(g, company=False) leaves out the company and its standard; company=(x, y) stands them with the
middle figure's foot on that stage point instead of by the camp's east gate (y-sorted with everything else).
The trampled patches under the places draw with PATCH_SEEDS, the seeds of the accepted PxMap1x render, so every
process draws the same world (an unlisted place falls back to a crc32 of its name, never str hash(), which is salted per process).
"""
import math
import os
import random
import sys
import zlib

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
HYB = os.path.join(os.path.dirname(HERE), 'hyb-64')
if HYB not in sys.path:
    sys.path.insert(0, HYB)
import world_map as WM          # noqa: E402  (the painted world's data: places, roads, river, fields...)

from . import pal, terrain as TR, trees as TS, places as PL, folk as FK, build as BD      # noqa: E402
from .canvas import Canvas, ellipse, poly, nb, lut  # noqa: E402
from .pal import ix                                  # noqa: E402

P, NAMES, ROADS = WM.P, WM.NAMES, WM.ROADS
BEND = {(a, b): bend for a, b, bend in ROADS}

# furrow direction per field kind and grain: (a, b) with b a whole number of stripe steps, so every furrow
# is a clean pixel slope (1:3 and 3:1 at grain 1, 1:2 and 2:1 at grain 2)
FIELD_KIND = {
    1: {'h64-wheat': ('wheat', (1, 3)), 'h64-wheat2': ('wheat2', (3, -1)), 'h64-crop': ('crop', (0, 1)),
        'h64-crop2': ('crop2', (1, 0)), 'plough': ('plough', (-1, 3))},
    2: {'h64-wheat': ('wheat', (1, 2)), 'h64-wheat2': ('wheat2', (2, -1)), 'h64-crop': ('crop', (0, 1)),
        'h64-crop2': ('crop2', (1, 0)), 'plough': ('plough', (-1, 2))},
}

# the crossings at grain 1 (stage px): the mill bridge's deck ends, the broken bridge's abutment ends
MILL_W, MILL_E = (800, 304), (841, 304)
BB_W, BB_E = (927, 578.5), (978, 561.5)
FORDS = {('bandit_hideout', 'pine_crossing'): (.71, .70), ('south_junction', 'smugglers_cave'): (.37, .93)}
# places that bring their own ground (streets, yards, squares) instead of a trampled blob
OWN_GROUND = {'riverside_market', 'south_junction', 'pine_crossing', 'old_mill_crossing', 'broken_bridge'}
# the trampled-patch seeds of the accepted PxMap1x world (recovered from pxworld/t/world1x.png, 2026-10-24: an exact match)
PATCH_SEEDS = {'frontier_camp': 585, 'traders_rest': 265, 'south_road_ambush': 432, 'bandit_hideout': 313, 'north_ridge_path': 527,
               'watchtower_ridge': 288, 'smugglers_cave': 29, 'border_fortress': 615, 'rodericks_camp': 37}


def stage_reject(p, rd=13, pd=44, wd=24):
    return WM.reject(p, rd, pd, wd)


def road_paths(g):
    """Every road as a fine stage-px polyline. At grain 1 the roads that cross at bridges are re-ended on
    the bridge heads, each with a short straight approach so the road meets the deck along its axis."""
    geo = {}
    for key, (A, B, c, pts) in WM.road_geo.items():
        geo[key] = WM.quad_pts(A, B, c, 60)
    if g != 1:
        return geo
    from paint import quad, quad_pts
    A = P['riverside_market']
    geo[('riverside_market', 'old_mill_crossing')] = quad_pts(A, (MILL_W[0] - 6, MILL_W[1] + 1),
                                                              quad(A, MILL_W, -10), 60) + [(MILL_W[0] + 4, MILL_W[1])]
    for key in (('old_mill_crossing', 'watchtower_ridge'), ('old_mill_crossing', 'pine_crossing'),
                ('old_mill_crossing', 'north_ridge_path')):
        B = P[key[1]]
        A2 = (MILL_E[0] + 5, MILL_E[1])
        geo[key] = [(MILL_E[0] - 4, MILL_E[1])] + quad_pts(A2, B, quad(A2, B, BEND[key]), 60)
    A = P['south_junction']
    W_ = (BB_W[0] - 7, BB_W[1] + 1.5)
    geo[('south_junction', 'broken_bridge')] = quad_pts(A, W_, quad(A, W_, 6), 60) + [(BB_W[0] + 3, BB_W[1] - .5)]
    A = P['smugglers_cave']
    E_ = (BB_E[0] + 7, BB_E[1] - 2)
    geo[('smugglers_cave', 'broken_bridge')] = quad_pts(A, E_, quad(A, E_, BEND[('smugglers_cave', 'broken_bridge')]),
                                                        60) + [(BB_E[0] - 3, BB_E[1] + .5)]
    return geo


def render(g=1, seed=11, layers=None, skip=(), company=True, patch_seeds=None):
    W, H = 1280 // g, 720 // g
    S = lambda v: v / g
    rng = random.Random(seed)
    cv = Canvas(W, H)
    info = {}

    # ---- ground
    TR.grass(cv, seed=4, g=g)

    # ---- hills: the painted mounds, lit NW
    RIDGES = {(940, 262), (1010, 296), (1092, 318), (1172, 300), (1104, 516), (1166, 568), (980, 150)}
    hl = [(S(x), S(y), S(rx) * 1.05, S(ry) * 1.1, rot, 'ridge' if (x, y) in RIDGES else 'mound')
          for (x, y, rx, ry, rot) in WM.HILLS]
    crest = TR.hills(cv, hl, g)

    # ---- fields
    field_masks = []
    for poly_pts, kind in WM.FIELDS:
        k, vec = FIELD_KIND[g][kind]
        fm = TR.field(cv, [(S(x), S(y)) for x, y in poly_pts], k, vec, width=4 if g == 1 else 2, g=g)
        field_masks.append(fm)
    fields_any = np.zeros((H, W), bool)
    for fm in field_masks:
        if fm is not None:
            fields_any |= fm

    # ---- trampled ground under places (the towns and crossings bring their own ground at grain 1)
    for k, (x, y) in P.items():
        if g == 1 and k in OWN_GROUND:
            continue
        big = k in ('frontier_camp', 'riverside_market', 'south_junction', 'pine_crossing', 'border_fortress')
        rx, ry = (40, 26) if big else (28, 19)
        seeds = PATCH_SEEDS if patch_seeds is None else patch_seeds
        TR.patch(cv, S(x), S(y - 4), S(rx), S(ry), seed=seeds[k] if k in seeds else zlib.crc32(k.encode()) % 1000, g=g)

    # ---- the river
    rpts = [(S(x), S(y)) for x, y in WM.river_pts]
    rhw = 10.0 / g
    rd = TR.river(cv, rpts, rhw, g)
    water = rd['water']

    # ---- roads (never over open water; fords and bridges carry them across)
    geo = road_paths(g)
    road_any = np.zeros((H, W), bool)
    road_px = {}
    for key, fine in geo.items():
        rp = [(S(x), S(y)) for x, y in fine]
        road_px[key] = rp
        m = TR.road(cv, rp, 3.1 / g if key[0] != 'east' else 2.6 / g, g, pebbles=.02 if g == 1 else 0, seed=len(rp),
                    not_on=water)
        if m is not None:
            road_any |= m
    TR.ripples(cv, rd, rpts, g)
    # a few boulders standing in the current, away from crossings
    for (sx, sy, off) in ((836, 150, -3), (930, 470, 4), (978, 660, -2)):
        q = min(WM.river_pts, key=lambda p: abs(p[1] - sy))
        TR.river_rock(cv, S(q[0] + off) - 2 / g, S(sy), g)
    # fords: shallows, a gravel bed and stepping stones where a road wades across
    if g == 1:
        for key, flow in FORDS.items():
            BD.ford(cv, water, road_px[key], width=7, flow=flow, seed=len(key[0]))
    info.update(water=water, roads=road_any, fields=fields_any, road_px=road_px)

    # ---- ground detail: tufts, flowers, field stones (never on roads, water or fields)
    blocked = water | road_any | fields_any | rd['bank']
    def free(p, pad=2):
        x, y = int(p[0]), int(p[1])
        return 0 <= x < W and 0 <= y < H and not blocked[max(0, y - pad):y + pad + 1, max(0, x - pad):x + pad + 1].any()
    centres = TR.poisson(rng, 0, 0, W, H, 46 / g, 3000, free)
    tpts = TR.clustered(rng, centres, (3, 8), 8 / g, free) + TR.poisson(rng, 0, 0, W, H, 34 / g, 2000, free)
    TR.tufts(cv, rng, tpts, g)
    TR.flowers(cv, rng, TR.poisson(rng, 0, 0, W, H, 70 / g, 900, free), g=g)
    TR.stones(cv, rng, TR.poisson(rng, 0, 0, W, H, 90 / g, 500, free), g=g)
    # reeds along both banks, in beds (kept clear of the crossings)
    crossings = [(S(x), S(y)) for (x, y) in ((820, 300), (953, 571), (882, 421), (932, 518))]
    reed_pts = []
    L = TR.poly_len(rpts)
    s_ = 0.0
    while s_ < L:
        if rng.random() < .45:
            p, tan = TR.point_at(rpts, s_)
            side = rng.choice((-1, 1))
            nx, ny = tan[1] * side, -tan[0] * side
            for k in range(rng.randint(2, 4)):
                off = rhw + rng.uniform(-1.2, 1.5) / g
                q = (p[0] + nx * off + tan[0] * k * 4 / g, p[1] + ny * off + tan[1] * k * 4 / g + 1)
                if g != 1 or min(math.dist(q, c) for c in crossings) > 26:
                    reed_pts.append(q)
        s_ += rng.uniform(18, 34) / g
    TR.reeds(cv, rng, reed_pts, g)

    # ---- hedgerows on two of every three field edges
    hedge_pts = []
    for poly_pts, kind in WM.FIELDS:
        n = len(poly_pts)
        for i in range(n):
            if (i + n) % 3 == 1:
                continue
            a_, b_ = poly_pts[i], poly_pts[(i + 1) % n]
            hedge_pts += TS.hedge(cv, (S(a_[0]), S(a_[1])), (S(b_[0]), S(b_[1])), rng, g)
    TS.stamp_bushes(cv, hedge_pts)

    # ---- everything that stands up: forests, lone trees, places, farms, the company, sorted north to south
    sc = PL.Scene(cv, g, seed=seed)
    sc.roads, sc.water, sc.road_px, sc.fields = road_any, water, road_px, fields_any
    if g == 1:
        sc.ground = ('g', 'd', 'h', 't')          # buildings throw their shadows on paving and stones too
        sc.reink = True                           # rocks outlined in their own darks, not in Ink
    for poly_pts, kind in WM.FORESTS:
        def rj(p, kind=kind):
            return stage_reject(p, 13, 46 if kind == 'leaf' else 40, 24)
        pts = WM.scatter(poly_pts, (9 if kind == 'leaf' else 8.5), rng, 6000, rj)
        art = [(S(x), S(y)) for x, y in pts]
        if kind == 'leaf':
            TS.forest(cv, art, rng, 8 / g, 13 / g, 'leaf', g=g, scene=sc)
        else:
            TS.forest(cv, art, rng, 8 / g, 11 / g, 'pine', g=g, scene=sc)
    lone = []
    for _ in range(80):
        p = (rng.uniform(200, 1120), rng.uniform(120, 700))
        if not stage_reject(p, 14, 50, 26) and not any(WM.pip(p, poly_pts) for poly_pts, _ in WM.FIELDS):
            lone.append(p)
    for (x, y) in lone[:30]:
        sc.tree(S(x), S(y), rng.uniform(7, 10) / g)
    # lone bushes in the open meadow
    def meadow(p):
        st = (p[0] * g, p[1] * g)
        return (free(p, 3) and not stage_reject(st, 14, 46, 26)
                and not any(WM.pip(st, poly_pts) for poly_pts, _ in WM.FORESTS))
    for (x, y) in TR.poisson(rng, 0, 0, W, H, 70 / g, 2500, meadow)[:46]:
        r = rng.uniform(2.8, 4.4) / g
        sp = TS.bush(r, rng.randint(0, 9), lift=rng.choice((0, 1)))
        sc.add(sp, x, y + (sp.h - 1) // 2, shadow=('ell', r * .7, 1, r * 1.1, r * .6))

    for k, (x, y) in P.items():
        if k in skip:
            continue
        X, Y = S(x), S(y)
        if k == 'frontier_camp':
            PL.camp_palisade(sc, X, Y)
        elif k == 'traders_rest':
            PL.camp(sc, X, Y, 'traders')
        elif k == 'rodericks_camp':
            PL.camp(sc, X, Y, 'roderick')
        elif k == 'riverside_market':
            PL.market(sc, X, Y)
        elif k == 'south_junction':
            if g == 1:
                PL.south_junction(sc, X, Y)
            else:
                PL.town(sc, X, Y, [(-26, -6, 16), (-4, -16, 18), (20, -8, 16), (-18, 14, 16), (14, 16, 18)], ('tile', 'tile2'), sign=True)
        elif k == 'pine_crossing':
            if g == 1:
                PL.pine_crossing(sc, X, Y)
            else:
                PL.town(sc, X, Y, [(-22, -8, 16), (2, -16, 16), (22, -2, 14), (-10, 12, 18), (16, 18, 14)], ('shingle', 'tile2'))
        elif k == 'watchtower_ridge':
            PL.watchtower(sc, X, Y)
        elif k == 'border_fortress':
            PL.fortress(sc, X, Y)
        elif k == 'smugglers_cave':
            PL.cave(sc, X, Y)
        elif k == 'bandit_hideout':
            PL.hideout(sc, X, Y)
        elif k == 'south_road_ambush':
            PL.wreck(sc, X, Y)
        elif k == 'old_mill_crossing':
            ry = y - 5
            rx = min(WM.river_pts, key=lambda q: abs(q[1] - ry))[0]
            PL.mill(sc, X, Y, S(rx))
        elif k == 'broken_bridge':
            ry = y
            rx = min(WM.river_pts, key=lambda q: abs(q[1] - ry))[0]
            PL.broken_bridge(sc, S(rx), Y)
        elif k == 'north_ridge_path':
            PL.cairn(sc, X, Y)
    if 'farms' not in skip:
        for i, (x, y) in enumerate(WM.FARMS):
            PL.farm(sc, S(x), S(y), i)
    PL.thornwood_sign(sc, S(1179), S(642))
    # rocks along the ridge crests (the painted world's own crest stones)
    for (x, y, r) in [(948, 236, 7), (962, 230, 5), (1030, 262, 6), (1046, 258, 8), (1126, 292, 6), (1150, 298, 5),
                      (1112, 488, 9), (1130, 498, 7), (1094, 482, 6), (1140, 530, 5)]:
        sc.rock(S(x), S(y), r * .75 / g)
    # the company, by the camp's east gate under the standard (or wherever company=(x, y) puts it; none if False)
    if company:
        cx, cy = P['frontier_camp']
        fx, fy = (S(cx + 11), S(cy + 10)) if company is True else (S(company[0]), S(company[1]))
        for spr, dx, dy in FK.company_items(g):
            sc.add(spr, fx + dx, fy + dy, shadow=('ell', 1, 1, 5 / g, 2 / g))
        info['company'] = (fx, fy)
    sc.draw()
    return cv, info


if __name__ == '__main__':
    g = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    cv, info = render(g)
    cv.save(os.path.join(HERE, 't', f'world{g}x.png'), zoom=g)
    print('ok')
