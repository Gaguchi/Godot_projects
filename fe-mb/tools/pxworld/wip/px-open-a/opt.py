"""Search the unchanged Borderlands graph for a layout round Frontier Camp (variant A), straight-line roads.

Energy: road-length stretch (target ~190 px, over 300 punished hard), crossings, places under the UI windows,
places too close, the camp out of the middle third, and the four edge exits (Broken Bridge off the left in the
band, North Ridge Path off the top between the windows, Thornwood Gate off the right, Southern Trail off the
bottom right of the company window). Deterministic: fixed seeds.
python opt.py <start_layout_module> [seed]
"""
import importlib
import math
import random
import sys

sys.path.insert(0, '.')
WIN = [(14, 14, 486, 190), (982, 14, 1266, 136), (14, 496, 406, 710)]
ROADS = [('frontier_camp', 'riverside_market'), ('frontier_camp', 'south_road_ambush'), ('frontier_camp', 'traders_rest'),
         ('riverside_market', 'old_mill_crossing'), ('riverside_market', 'bandit_hideout'), ('south_road_ambush', 'south_junction'),
         ('old_mill_crossing', 'watchtower_ridge'), ('old_mill_crossing', 'pine_crossing'), ('old_mill_crossing', 'north_ridge_path'),
         ('bandit_hideout', 'south_junction'), ('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave'),
         ('south_junction', 'broken_bridge'), ('watchtower_ridge', 'border_fortress'), ('watchtower_ridge', 'north_ridge_path'),
         ('pine_crossing', 'border_fortress'), ('pine_crossing', 'rodericks_camp'), ('smugglers_cave', 'rodericks_camp'),
         ('smugglers_cave', 'broken_bridge'), ('border_fortress', 'borderland_shrine'), ('border_fortress', 'thornwood_gate'),
         ('rodericks_camp', 'southern_trail')]
OFF = {'broken_bridge': 'L', 'north_ridge_path': 'T', 'thornwood_gate': 'R', 'borderland_shrine': 'R', 'southern_trail': 'B'}


def seg_x(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9:
        return False
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    return 0 < t < 1 and 0 < u < 1


def seg_rect(a, b, r, pad=10):
    x0, y0, x1, y1 = r[0] - pad, r[1] - pad, r[2] + pad, r[3] + pad
    n = 24
    hit = 0
    for i in range(n + 1):
        t = i / n
        x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        if x0 < x < x1 and y0 < y < y1 and 0 <= x <= 1280 and 0 <= y <= 720:
            hit += 1
    return hit


def edge_exit(a, b):
    """Where the segment a->b leaves the 1280x720 view, or None."""
    for i in range(1, 201):
        t = i / 200
        x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        if not (0 <= x <= 1280 and 0 <= y <= 720):
            return (x, y)
    return None


def energy(P, detail=False):
    E = 0.0
    out = []
    for a, b in ROADS:
        L = math.dist(P[a], P[b])      # the whole hop, off-screen part included (world.json draws it)
        e = ((L - 190) / 60) ** 2 + (max(0, L - 290) / 20) ** 2 + (max(0, 120 - L) / 15) ** 2
        E += e
        if detail:
            out.append((round(L), a, b))
        for r in WIN:
            E += 3 * seg_rect(P[a], P[b], r)
    for i in range(len(ROADS)):
        for j in range(i + 1, len(ROADS)):
            a, b = ROADS[i]
            c, d = ROADS[j]
            if {a, b} & {c, d}:
                continue
            if seg_x(P[a], P[b], P[c], P[d]):
                E += 400
    ks = [k for k in P if k not in OFF]
    for k in ks:
        x, y = P[k]
        if not (40 <= x <= 1240 and 40 <= y <= 680):
            E += 200
        for r in WIN:
            if r[0] - 50 < x < r[2] + 50 and r[1] - 35 < y < r[3] + 45:
                E += 200
    for i in range(len(ks)):
        for j in range(i + 1, len(ks)):
            d = math.dist(P[ks[i]], P[ks[j]])
            if d < 110:
                E += ((110 - d) / 10) ** 2
    cx, cy = P['frontier_camp']
    E += (max(0, abs(cx - 640) - 160) / 10) ** 2 + (max(0, abs(cy - 370) - 90) / 10) ** 2
    # edge exits: each off-screen place sits just past its edge and its roads leave through the edge's free span
    BAND = {'L': ((-150, -30), (215, 470)), 'T': ((510, 960), (-150, -30)), 'R': ((1310, 1430), (160, 700)),
            'B': ((440, 1260), (750, 870))}
    for k, side in OFF.items():
        x, y = P[k]
        (bx0, bx1), (by0, by1) = BAND[side]
        E += (max(0, bx0 - x, x - bx1) / 8) ** 2 + (max(0, by0 - y, y - by1) / 8) ** 2
        roads = [(a, b) for a, b in ROADS if k in (a, b)]
        for a, b in roads:
            o = b if a == k else a
            ex = edge_exit(P[o], P[k])
            if ex is None:
                E += 300
                continue
            X, Y = ex
            ok = {'L': X <= 0 and 215 <= Y <= 470, 'T': Y <= 0 and 510 <= X <= 960,
                  'R': X >= 1280 and 160 <= Y <= 700, 'B': Y >= 720 and 440 <= X <= 1260}[side]
            if not ok:
                E += 300
    if detail:
        return E, sorted(out, reverse=True)
    return E


def anneal(P, seed=1, iters=60000, T0=30.0):
    rng = random.Random(seed)
    P = dict(P)
    E = energy(P)
    best, bestE = dict(P), E
    keys = list(P)
    for it in range(iters):
        T = T0 * (1 - it / iters) + 0.05
        k = rng.choice(keys)
        old = P[k]
        s = 40 * (1 - it / iters) + 4
        P[k] = (old[0] + rng.gauss(0, s), old[1] + rng.gauss(0, s))
        E2 = energy(P)
        if E2 < E or rng.random() < math.exp(-(E2 - E) / T):
            E = E2
            if E < bestE:
                best, bestE = dict(P), E
        else:
            P[k] = old
    return best, bestE


if __name__ == '__main__':
    L = importlib.import_module(sys.argv[1])
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    P0 = {k: v for k, v in L.P.items() if k not in ('darens_camp',)}
    best, E = anneal(P0, seed)
    E2, lens = energy(best, True)
    print('energy', round(E2, 1))
    for row in lens[:8]:
        print('  ', row)
    print('P = {')
    for k, (x, y) in best.items():
        print(f"    '{k}': ({x:.0f}, {y:.0f}),")
    print('}')
