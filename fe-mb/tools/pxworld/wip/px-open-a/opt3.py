"""Joint search: the Borderlands' places AND the river's control points, for variant A (graph unchanged).

The river enters at the top edge between the windows, passes through Old Mill Crossing flowing north-south (the
kit's mill bridge is an east-west deck), and leaves by the left edge in the band between the windows, where
Broken Bridge stands just off-screen. INSIDE places keep to the camp's bank; only the fords and the bridges cross.
Composition terms: smooth river, every on-screen place clear of the river and the windows, the camp's three roads
well apart, every quadrant round the camp populated, hops near 190 px and never far past 290.
python opt3.py <layout_module> [seed] [iters]
"""
import importlib
import math
import random
import sys

sys.path.insert(0, '.')
import opt                                                    # noqa: E402
from opt2 import pip, dist_pl                                 # noqa: E402
from plan import sample_catmull                               # noqa: E402

VIS = ['frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'old_mill_crossing', 'bandit_hideout',
       'south_junction', 'watchtower_ridge', 'pine_crossing', 'smugglers_cave', 'border_fortress', 'rodericks_camp']


def river_terms(R, P, L, detail=False):
    E = 0.0
    bad = []
    pts = sample_catmull(R, 8)
    # ends
    x0, y0 = R[0]
    E += (max(0, y0 + 30) / 5) ** 2 + (max(0, 540 - x0, x0 - 950) / 5) ** 2
    xe, ye = R[-1]
    E += (max(0, xe + 40) / 5) ** 2 + (max(0, 240 - ye, ye - 450) / 5) ** 2
    bb = P['broken_bridge']
    E += (math.dist(bb, (min(xe, -45), ye)) / 6) ** 2
    # smooth: turning angle between successive control segments
    for i in range(1, len(R) - 1):
        a = math.atan2(R[i][1] - R[i - 1][1], R[i][0] - R[i - 1][0])
        b = math.atan2(R[i + 1][1] - R[i][1], R[i + 1][0] - R[i][0])
        t = abs((b - a + math.pi) % (2 * math.pi) - math.pi)
        E += (max(0, math.degrees(t) - 32) / 6) ** 2
        seg = math.dist(R[i], R[i + 1])
        E += (max(0, 60 - seg) / 10) ** 2 + (max(0, seg - 170) / 10) ** 2
    # the mill: on the river, flowing within 15 deg of north-south
    om = P['old_mill_crossing']
    best = min(range(len(pts) - 1), key=lambda i: dist_pl(om, pts[i:i + 2]))
    E += (dist_pl(om, pts) / 2) ** 2
    a, b = pts[best], pts[best + 1]
    ang = abs(math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])))
    ang = min(ang, 180 - ang)
    E += (max(0, ang - 12) / 3) ** 2
    # clear of places, sides, crossings
    region = pts + [(-300, pts[-1][1]), (-300, -300), (pts[0][0], -300)]
    cross = set(L.CROSS) | {(q, p) for p, q in L.CROSS}
    on = {'old_mill_crossing', 'broken_bridge'}
    for k, p in P.items():
        if k in on:
            continue
        if pip(p, region) != (k in L.INSIDE):
            E += 500
            bad.append(('side', k))
        if 0 <= p[0] <= 1280 and 0 <= p[1] <= 720:
            d = dist_pl(p, pts)
            if d < 58:
                E += ((58 - d) / 5) ** 2
    for p_, q_ in opt.ROADS:
        if (p_, q_) in cross or p_ in on or q_ in on:
            continue
        for i in range(len(pts) - 1):
            if opt.seg_x(P[p_], P[q_], pts[i], pts[i + 1]):
                E += 400
                bad.append(('wet', p_, q_))
                break
    # fords: the crossing point must be clear of the bridges and of each other
    fx = []
    for p_, q_ in L.CROSS:
        for i in range(len(pts) - 1):
            if opt.seg_x(P[p_], P[q_], pts[i], pts[i + 1]):
                fx.append(pts[i])
    for i in range(len(fx)):
        if math.dist(fx[i], om) < 110:
            E += ((110 - math.dist(fx[i], om)) / 8) ** 2
        for j in range(i + 1, len(fx)):
            if math.dist(fx[i], fx[j]) < 140:
                E += ((140 - math.dist(fx[i], fx[j])) / 8) ** 2
    # the river under the windows: a little is fine, a lot hides it
    for (wx0, wy0, wx1, wy1) in opt.WIN:
        n = sum(1 for (x, y) in pts if wx0 < x < wx1 and wy0 < y < wy1)
        E += 2 * n
    if detail:
        return E, bad
    return E


def composition(P):
    E = 0.0
    c = P['frontier_camp']
    ang = {}
    for k in ('traders_rest', 'riverside_market', 'south_road_ambush'):
        x, y = P[k]
        ang[k] = math.degrees(math.atan2(x - c[0], -(y - c[1]))) % 360
    vals = sorted(ang.values())
    gaps = [(vals[(i + 1) % 3] - vals[i]) % 360 for i in range(3)]
    for g in gaps:
        E += (max(0, 85 - g) / 6) ** 2
    # quadrants round the camp, on-screen places only
    q = [0, 0, 0, 0]
    for k in VIS:
        if k == 'frontier_camp':
            continue
        x, y = P[k]
        if not (0 <= x <= 1280 and 0 <= y <= 720):
            continue
        q[(0 if x >= c[0] else 1) + (0 if y < c[1] else 2)] += 1
    for n in q:
        E += 25 * max(0, 2 - n) ** 2
    # label room: on-screen places away from the screen edges
    for k in VIS:
        x, y = P[k]
        E += (max(0, 80 - x, x - 1200) / 6) ** 2 + (max(0, 70 - y, y - 640) / 6) ** 2
    return E


ANCHOR = {}


def anchor(P, R):
    """Anchored polish: each place and river point pays for drifting from the hand layout."""
    E = 0.0
    if not ANCHOR:
        return E
    for k, p in P.items():
        q = ANCHOR['P'].get(k)
        if q:
            E += (math.dist(p, q) / 45) ** 2
    for p, q in zip(R, ANCHOR['R']):
        E += (math.dist(p, q) / 55) ** 2
    return E


def road_hug(P, R):
    """Roads that do not cross the water keep clear of it (no road running along the river's edge)."""
    pts = sample_catmull(R, 8)
    E = 0.0
    for a, b in opt.ROADS:
        if a in ('old_mill_crossing', 'broken_bridge') or b in ('old_mill_crossing', 'broken_bridge'):
            continue
        A, B = P[a], P[b]
        for i in range(1, 10):
            t = i / 10
            q = (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t)
            if not (0 <= q[0] <= 1280 and 0 <= q[1] <= 720):
                continue
            d = dist_pl(q, pts)
            if 6 < d < 26:
                E += ((26 - d) / 6) ** 2
    return E


def total(P, R, L):
    return opt.energy(P) + river_terms(R, P, L) + composition(P) + anchor(P, R) + road_hug(P, R)


def anneal(P, R, L, seed=1, iters=30000, T0=20.0):
    rng = random.Random(seed)
    P, R = dict(P), list(R)
    E = total(P, R, L)
    best, bestR, bestE = dict(P), list(R), E
    keys = list(P)
    for it in range(iters):
        T = T0 * (1 - it / iters) + 0.05
        s = 28 * (1 - it / iters) + 3
        if rng.random() < .3:
            i = rng.randrange(len(R))
            old = R[i]
            R[i] = (old[0] + rng.gauss(0, s), old[1] + rng.gauss(0, s))
            E2 = total(P, R, L)
            if E2 < E or rng.random() < math.exp(-(E2 - E) / T):
                E = E2
            else:
                R[i] = old
        else:
            k = rng.choice(keys)
            old = P[k]
            P[k] = (old[0] + rng.gauss(0, s), old[1] + rng.gauss(0, s))
            E2 = total(P, R, L)
            if E2 < E or rng.random() < math.exp(-(E2 - E) / T):
                E = E2
            else:
                P[k] = old
        if E < bestE:
            best, bestR, bestE = dict(P), list(R), E
    return best, bestR, bestE


if __name__ == '__main__':
    L = importlib.import_module(sys.argv[1])
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    iters = int(sys.argv[3]) if len(sys.argv) > 3 else 30000
    P0 = {k: v for k, v in L.P.items() if k != 'darens_camp'}
    if '--anchor' in sys.argv:
        ANCHOR.update(P=dict(P0), R=list(L.RIVER))
    best, R, E = anneal(P0, L.RIVER, L, seed, iters, T0=4.0 if ANCHOR else 20.0)
    Eg, lens = opt.energy(best, True)
    Er, bad = river_terms(R, best, L, True)
    print('energy', round(E, 1), 'graph', round(Eg, 1), 'river', round(Er, 1), 'comp', round(composition(best), 1), 'bad', bad)
    for row in lens[:8]:
        print('  ', row)
    print('P = {')
    for k, (x, y) in best.items():
        print(f"    '{k}': ({x:.0f}, {y:.0f}),")
    print('}')
    print('RIVER = ' + repr([(round(x), round(y)) for x, y in R]))
