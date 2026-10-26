"""opt.py plus a fixed river: places keep to their bank, only the allowed roads cross the water.

python opt2.py <layout_module> [seed] [iters]
The layout module gives P (a start), RIVER (control points, north end first), INSIDE (the places on the camp's
bank), CROSS (road keys allowed over the water: the mill roads, the fords, the broken bridge's two roads),
ON_RIVER (places that sit on the water: Old Mill Crossing, Broken Bridge).
"""
import importlib
import math
import random
import sys

sys.path.insert(0, '.')
import opt                                                    # noqa: E402
from plan import sample_catmull                               # noqa: E402


def pip(pt, poly):
    x, y = pt
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def dist_pl(p, pts):
    best = 1e9
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L2 = dx * dx + dy * dy or 1
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
        q = (a[0] + t * dx, a[1] + t * dy)
        best = min(best, math.dist(p, q))
    return best


def make(L):
    river = sample_catmull(L.RIVER, 10)
    # the camp's bank: the river closed round the top-left of the view (the river runs from the top edge to the left edge)
    region = river + [(-200, river[-1][1]), (-200, -200), (river[0][0], -200)]
    cross = set(L.CROSS) | {(b, a) for a, b in L.CROSS}
    on = set(getattr(L, 'ON_RIVER', ()))

    def energy(P, detail=False):
        E = opt.energy(P)
        bad = []
        for k, p in P.items():
            if k in on:
                d = dist_pl(p, river)
                E += (d / 4) ** 2
                continue
            want = k in L.INSIDE
            if pip(p, region) != want:
                E += 400
                bad.append(('side', k))
            if 0 <= p[0] <= 1280 and 0 <= p[1] <= 720:
                d = dist_pl(p, river)
                if d < 48:
                    E += ((48 - d) / 6) ** 2
        for a, b in opt.ROADS:
            if (a, b) in cross or a in on or b in on:
                continue
            n = len(river)
            for i in range(n - 1):
                if opt.seg_x(P[a], P[b], river[i], river[i + 1]):
                    E += 300
                    bad.append(('wet', a, b))
                    break
        if detail:
            return E, bad
        return E
    return energy


def anneal(P, energy, seed=1, iters=40000, T0=20.0, fixed=()):
    rng = random.Random(seed)
    P = dict(P)
    E = energy(P)
    best, bestE = dict(P), E
    keys = [k for k in P if k not in fixed]
    for it in range(iters):
        T = T0 * (1 - it / iters) + 0.05
        k = rng.choice(keys)
        old = P[k]
        s = 30 * (1 - it / iters) + 3
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
    iters = int(sys.argv[3]) if len(sys.argv) > 3 else 40000
    energy = make(L)
    P0 = {k: v for k, v in L.P.items() if k != 'darens_camp'}
    best, E = anneal(P0, energy, seed, iters, fixed=getattr(L, 'FIXED', ()))
    E2, bad = energy(best, True)
    _, lens = opt.energy(best, True)
    print('energy', round(E2, 1), 'bad', bad)
    for row in lens[:8]:
        print('  ', row)
    print('P = {')
    for k, (x, y) in best.items():
        print(f"    '{k}': ({x:.0f}, {y:.0f}),")
    print('}')
