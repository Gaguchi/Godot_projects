"""Lay out the wild country round the Borderlands (planning tool; its output is pasted into world_b.P).

Thornwood keeps to the bearings north and east of the camp, Ashfall to the south and west; every wild place
stays outside the view (it lies beyond the screen's edges). Roads should be short and must not cross.
Seeded annealing, so the same run gives the same layout. python country.py [iterations]"""
import math
import random
import sys

import world_b as W
import geo

CAMP = W.P['frontier_camp']
SECTOR = {'thornwood': (-55, 140), 'ashfall': (140, 305)}   # compass bearings (deg, clockwise from north)
MARGIN = 150                                                 # how far beyond the view's edge a wild place sits


def bearing(p):
    dx, dy = p[0] - CAMP[0], p[1] - CAMP[1]
    return math.degrees(math.atan2(dx, -dy))


def ok_place(k, p):
    reg = W.NODE[k]['region']
    lo, hi = SECTOR[reg]
    b = bearing(p)
    if reg == 'thornwood':
        b = b if b <= 180 else b - 360
        if not (lo <= b <= hi):
            return False
    else:
        b = b % 360
        if not (lo <= b <= hi):
            return False
    x, y = p
    return not (-MARGIN < x < 1280 + MARGIN and -MARGIN < y < 720 + MARGIN)


def energy(P, roads, wild):
    e = 0.0
    for a, b, *_ in roads:
        d = math.dist(P[a], P[b])
        e += (max(0, d - 300)) ** 2 * 1.0 + (max(0, 170 - d)) ** 2 * 4.0
    ks = list(wild)
    allk = list(P)
    for i, a in enumerate(ks):
        for b in allk:
            if b == a:
                continue
            d = math.dist(P[a], P[b])
            if d < 200:
                e += (200 - d) ** 2 * 3.0
    segs = [(a, b) for a, b, *_ in roads]
    wset = set(wild)
    for i in range(len(segs)):
        a, b = segs[i]
        if a not in wset and b not in wset:
            continue
        for j in range(len(segs)):
            if j == i:
                continue
            c, d = segs[j]
            if {a, b} & {c, d}:
                continue
            if geo.seg_x(P[a], P[b], P[c], P[d]):
                e += 4e5
    return e


# the four places the edge roads lead to, pinned on their compass lines so each road leaves its own edge
PIN = {'thornwood_gate': (880, -210), 'southern_trail': (1480, 540), 'ashfall_trail': (1010, 930), 'mountain_pass': (-250, 290)}


def main(iters=60000, seed=5):
    rng = random.Random(seed)
    P = dict(W.P)
    P.update(PIN)
    wild = [k for k in P if W.NODE[k]['region'] != 'borderlands' and k not in PIN]
    roads = [r for r in W.b_roads() if not W.NODE[r[0]].get('hidden') and not W.NODE[r[1]].get('hidden')]
    E = energy(P, roads, wild)
    T = 4e4
    for it in range(iters):
        k = rng.choice(wild)
        old = P[k]
        step = 160 * (1 - it / iters) + 10
        new = (old[0] + rng.uniform(-step, step), old[1] + rng.uniform(-step, step))
        if not ok_place(k, new):
            continue
        P[k] = new
        E2 = energy(P, roads, wild)
        if E2 < E or rng.random() < math.exp((E - E2) / max(T, 1e-9)):
            E = E2
        else:
            P[k] = old
        T *= .99985
    crosses = 0
    segs = [(a, b) for a, b, *_ in roads]
    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            a, b = segs[i]; c, d = segs[j]
            if {a, b} & {c, d}:
                continue
            if geo.seg_x(P[a], P[b], P[c], P[d]):
                crosses += 1
                print('cross', segs[i], segs[j])
    print('energy', round(E), 'crossings', crosses)
    for k in list(PIN) + wild:
        print(f"    '{k}': ({int(round(P[k][0] / 10) * 10)}, {int(round(P[k][1] / 10) * 10)}),")
    return P


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 60000, int(sys.argv[2]) if len(sys.argv) > 2 else 5)
