"""Variant C's travel rule, as code: the company marches to any point of B's country. Every coordinate is read from
world_b at run time (dirs/px-open-b/world_b.py), so a fix to B's country moves C's routes and numbers with it.

    import march as M
    M.ROAD_PX, M.OPEN_PX, M.FOREST_PX      how far one day carries, in stage px of road / open country / forest
    g = M.grid(info)                       the country as 4 px cells (open / forest / water) plus B's roads as exact
                                           polylines (info = world_b.render()'s masks; rendered if None)
    sol = M.solve(g)                       Dijkstra from Frontier Camp over cells and roads (cached per run)
    M.place_days(g, sol)                   {place: days from the camp by the quickest march}
    M.place_days(g, M.solve(g, roads_only=True))    the same by road alone
    legs = M.route(g, sol, 'scorched_village')      the quickest march as legs [{'kind': 'road'|'open', 'pts': [...]}]
    M.cost_of(legs, g)                     days the legs take; M.px_by_kind(legs, g) the px on each ground
    M.whole(d)                             the days spent (a day begun is a day eaten: ceil)
    M.tier(days)                           the tier a place's whole days from the camp give it

The ground: inside the view, the ground world_b draws (water; Thornwood's pines and the copses are forest; meadow,
fields, dry grass and ash are open). Beyond the view, the region of the nearest wild place: Thornwood is forest,
Ashfall open. The roads are every one of B's roads plus the mill bridge's deck, costed along their own polylines. The
river, carried on north and south past the view as B's overview carries it, is crossed only on a road: the mill
bridge and the fords (and, beyond the view, wherever B's roads cross it). Broken Bridge's middle span is gone, so its
two roads end at the stumps, one on each bank.
"""
import heapq
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
B_DIR = os.path.join(DIRS, 'px-open-b')
for _p in (B_DIR, DIRS, HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import world_b as WB                                                          # noqa: E402
import geo                                                                    # noqa: E402

# ================================================================ the rule: how far a day carries (stage px)
# Today one day is one road hop. B's four roads out of camp are 135, 143, 187 and 206 px long, so a day's march of
# 210 px of road keeps each of them one day; open country carries two thirds of that, forest one third.
ROAD_PX = 210
OPEN_PX = 140
FOREST_PX = 70
FOOD_PER_DAY = 1
TIER_DAYS = ((2, 1), (5, 2), (math.inf, 3))      # rules.ts tierByDistance (2 / 5 / beyond), read in days
BOSS_MIN_DAYS = 7                                 # rules.ts bossNodeMinHops, read in days

G = 4                                             # grid cell, stage px
RS = 4.0                                          # road sample spacing, stage px
RIVER_FULL = [(925, -420), (930, -200)] + list(WB.RIVER) + [(1070, 900), (1110, 1300)]   # as overview.py carries it


def tier(days):
    for top, t in TIER_DAYS:
        if days <= top:
            return t
    return 3


def whole(d):
    """Days spent: a day begun is a day eaten."""
    return int(math.ceil(d - 1e-6))


def arrivals(k):
    """Where the company stands when it has reached place k (the two river places: a bank head)."""
    if k == 'old_mill_crossing':
        b = WB.BRIDGES['old_mill_crossing']
        return [b['west'], b['east']]
    if k == 'broken_bridge':
        b = WB.BRIDGES['broken_bridge']
        return [b['west'], b['east']]
    return [getattr(WB, 'DOOR', {}).get(k, WB.P[k])]


# ================================================================ the grid and the road graph
_CACHE = {}


def _frame():
    xs = [p[0] for p in WB.P.values()]
    ys = [p[1] for p in WB.P.values()]
    x0 = int(math.floor((min(xs) - 200) / G) * G)
    y0 = int(math.floor((min(ys) - 200) / G) * G)
    x1 = int(math.ceil((max(xs) + 200) / G) * G)
    y1 = int(math.ceil((max(ys) + 200) / G) * G)
    return x0, y0, x1, y1


def grid(info=None):
    """kind: 0 open, 1 forest, 2 water per cell; roads: B's polylines (and the mill deck), resampled every RS px."""
    if 'g' in _CACHE:
        return _CACHE['g']
    if info is None:
        info = WB.render(company=False)[1]
    x0, y0, x1, y1 = _frame()
    W, H = (x1 - x0) // G, (y1 - y0) // G
    cx = x0 + (np.arange(W) + .5) * G
    cy = y0 + (np.arange(H) + .5) * G
    XX, YY = np.meshgrid(cx, cy)
    kind = np.zeros((H, W), np.uint8)
    wild = [k for k in WB.P if not WB.in_view(k) and not WB.NODE[k].get('hidden')]
    best = np.full((H, W), 1e18)
    forest_reg = np.zeros((H, W), bool)
    for k in wild:
        px, py = WB.P[k]
        d = (XX - px) ** 2 + (YY - py) ** 2
        m = d < best
        best[m] = d[m]
        forest_reg[m] = WB.NODE[k]['region'] == 'thornwood'
    kind[forest_reg] = 1
    water = np.zeros((H, W), bool)
    rr = WB.RIVER_HW + 1
    for (rx, ry) in geo.resample(geo.sample_catmull(RIVER_FULL, 40), 2.0):
        i0, i1 = max(0, int((rx - rr - x0) // G)), min(W, int((rx + rr - x0) // G) + 2)
        j0, j1 = max(0, int((ry - rr - y0) // G)), min(H, int((ry + rr - y0) // G) + 2)
        if i0 < i1 and j0 < j1:
            water[j0:j1, i0:i1] |= (XX[j0:j1, i0:i1] - rx) ** 2 + (YY[j0:j1, i0:i1] - ry) ** 2 <= rr * rr
    kind[water] = 2
    # inside the view: world_b's own ground, by majority over each cell
    jv = np.nonzero((cy >= 0) & (cy < 720))[0]
    iv = np.nonzero((cx >= 0) & (cx < 1280))[0]
    wat = info['water'].astype(np.float32)
    fo = (info['forest'] | info['wood']).astype(np.float32)
    for j in jv:
        Y = int(cy[j])
        ys = slice(max(0, Y - G // 2), Y + G // 2)
        for i in iv:
            X = int(cx[i])
            xs = slice(max(0, X - G // 2), X + G // 2)
            if wat[ys, xs].mean() > .5:
                kind[j, i] = 2
            elif fo[ys, xs].mean() > .5:
                kind[j, i] = 1
            else:
                kind[j, i] = 0
    paths = WB.road_paths()
    lines = {k: v for k, v in paths.items() if not (set(k) & {n for n, d in WB.NODE.items() if d.get('hidden')})}
    mb = WB.BRIDGES['old_mill_crossing']
    lines[('mill deck',)] = [mb['west'], mb['east']]
    roads = {k: geo.resample(v, RS) for k, v in lines.items()}
    g = dict(kind=kind, x0=x0, y0=y0, W=W, H=H, info=info, roads=roads, paths=lines)
    _CACHE['g'] = g
    return g


def cell_of(g, p):
    return int((p[1] - g['y0']) // G), int((p[0] - g['x0']) // G)


def centre(g, j, i):
    return (g['x0'] + (i + .5) * G, g['y0'] + (j + .5) * G)


def kind_at(g, p, kind=None):
    j, i = cell_of(g, p)
    if not (0 <= j < g['H'] and 0 <= i < g['W']):
        return 'water'
    return ('open', 'forest', 'water')[int(g['kind'][j, i] if kind is None else kind[j][i])]


def _rate(k):
    return {0: 1 / OPEN_PX, 1: 1 / FOREST_PX}.get(int(k), math.inf)


NB = [(dj, di) for dj in range(-2, 3) for di in range(-2, 3)
      if (dj, di) != (0, 0) and math.gcd(abs(dj), abs(di)) == 1]          # 16 neighbours


GROUNDS = (26, 18)                               # a place's grounds (rx, ry): a march walks round the ones it passes


def in_grounds(p, k):
    x, y = WB.P[k]
    return ((p[0] - x) / GROUNDS[0]) ** 2 + ((p[1] - y + 4) / GROUNDS[1]) ** 2 < 1


def solve(g, roads_only=False, start='frontier_camp', avoid=()):
    """Dijkstra over the cells (open / forest, never water) and the road samples (exact polyline lengths), linked
    where a road sample stands in a dry cell and where two roads meet. `avoid`: places whose grounds the march
    walks round (places are where you stop: a march does not cross one it is not stopping at)."""
    key = ('solve', roads_only, start, tuple(sorted(avoid)))
    if key in _CACHE:
        return _CACHE[key]
    H, W = g['H'], g['W']
    kind = g['kind'].tolist()
    for k in avoid:                              # the grounds of the places passed by are walked round
        x, y = WB.P[k]
        for j in range(max(0, int((y - 30 - g['y0']) // G)), min(H, int((y + 30 - g['y0']) // G) + 1)):
            for i in range(max(0, int((x - 40 - g['x0']) // G)), min(W, int((x + 40 - g['x0']) // G) + 1)):
                if in_grounds(centre(g, j, i), k):
                    kind[j][i] = 2
    N0 = H * W
    rnode = []                                   # road node -> (road key, index, point)
    radj = []                                    # road node -> [(node, cost)]
    cell_links = {}                              # grid id -> [(road node, cost)]
    for rk, pts in g['roads'].items():
        base = len(rnode)
        for t, p in enumerate(pts):
            rnode.append((rk, t, p))
            radj.append([])
        for t in range(len(pts) - 1):
            if any(in_grounds(pts[t], k) or in_grounds(pts[t + 1], k) for k in avoid):
                continue
            c = math.dist(pts[t], pts[t + 1]) / ROAD_PX
            radj[base + t].append((N0 + base + t + 1, c))
            radj[base + t + 1].append((N0 + base + t, c))
    # junctions: samples of different roads within 6 px of each other
    bucket = {}
    for n, (rk, t, p) in enumerate(rnode):
        bucket.setdefault((int(p[0] // 8), int(p[1] // 8)), []).append(n)
    for n, (rk, t, p) in enumerate(rnode):
        bx, by = int(p[0] // 8), int(p[1] // 8)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for m in bucket.get((bx + dx, by + dy), ()):
                    if m <= n or rnode[m][0] == rk:
                        continue
                    if any(in_grounds(p, k) for k in avoid):
                        continue
                    d = math.dist(p, rnode[m][2])
                    if d <= 6:
                        radj[n].append((N0 + m, d / ROAD_PX))
                        radj[m].append((N0 + n, d / ROAD_PX))
    if not roads_only:                           # step on and off a road wherever it runs over dry ground
        for n, (rk, t, p) in enumerate(rnode):
            j, i = cell_of(g, p)
            if 0 <= j < H and 0 <= i < W and kind[j][i] != 2:
                c = math.dist(p, centre(g, j, i)) * _rate(kind[j][i])
                radj[n].append((j * W + i, c))
                cell_links.setdefault(j * W + i, []).append((N0 + n, c))
    dist = {}
    par = {}
    s = WB.P[start]
    pq = []
    for n, (rk, t, p) in enumerate(rnode):
        if math.dist(p, s) <= 3:
            dist[N0 + n] = 0.0
            pq.append((0.0, N0 + n))
    if not roads_only:
        j, i = cell_of(g, s)
        dist[j * W + i] = 0.0
        pq.append((0.0, j * W + i))
    heapq.heapify(pq)
    rates = [[_rate(k) for k in row] for row in kind]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, math.inf):
            continue
        if u >= N0:
            nbrs = radj[u - N0]
        else:
            j, i = divmod(u, W)
            ru = rates[j][i]
            nbrs = list(cell_links.get(u, ()))
            if not roads_only:
                for dj, di in NB:
                    jj, ii = j + dj, i + di
                    if not (0 <= jj < H and 0 <= ii < W):
                        continue
                    rv = rates[jj][ii]
                    if rv == math.inf:
                        continue
                    if abs(dj) == 2 or abs(di) == 2:          # a knight's move may not jump the water
                        a = (j + (dj // 2 if abs(dj) == 2 else 0), i + (di // 2 if abs(di) == 2 else 0))
                        b = (j + (dj - dj // 2 if abs(dj) == 2 else dj), i + (di - di // 2 if abs(di) == 2 else di))
                        if rates[a[0]][a[1]] == math.inf or rates[b[0]][b[1]] == math.inf:
                            continue
                    nbrs.append((jj * W + ii, G * math.hypot(dj, di) * (ru + rv) / 2))
        for v, c in nbrs:
            nd = d + c
            if nd < dist.get(v, math.inf):
                dist[v] = nd
                par[v] = u
                heapq.heappush(pq, (nd, v))
    sol = dict(dist=dist, par=par, rnode=rnode, N0=N0, roads_only=roads_only, kind=kind)
    _CACHE[key] = sol
    return sol


def _arrive(g, sol, p):
    """(days, node) to stand at stage point p: from a road sample within 3 px, or from its dry cell."""
    best = (math.inf, None)
    N0 = sol['N0']
    for n, (rk, t, q) in enumerate(sol['rnode']):
        d = math.dist(p, q)
        if d <= 3:
            v = sol['dist'].get(N0 + n, math.inf) + d / ROAD_PX
            if v < best[0]:
                best = (v, N0 + n)
    if not sol['roads_only']:
        j, i = cell_of(g, p)
        if 0 <= j < g['H'] and 0 <= i < g['W'] and g['kind'][j, i] != 2:
            u = j * g['W'] + i
            v = sol['dist'].get(u, math.inf) + math.dist(p, centre(g, j, i)) * _rate(g['kind'][j, i])
            if v < best[0]:
                best = (v, u)
    return best


def place_days(g, sol):
    out = {}
    for k in WB.P:
        if WB.NODE[k].get('hidden'):
            continue
        out[k] = min(_arrive(g, sol, p)[0] for p in arrivals(k))
    return out


def node_pt(g, sol, u):
    if u >= sol['N0']:
        return sol['rnode'][u - sol['N0']][2]
    j, i = divmod(u, g['W'])
    return centre(g, j, i)


def route(g, sol, dest, target=None):
    """The quickest march to dest (or to the stage point target) as legs: road legs along B's polylines, open legs
    string-pulled straight wherever a straight line over the same ground costs no more."""
    pts = [target] if target else arrivals(dest)
    d, u = min((_arrive(g, sol, p) for p in pts), key=lambda r: r[0])
    end = target or min(arrivals(dest), key=lambda p: _arrive(g, sol, p)[0])
    chain = [u]
    while chain[-1] in sol['par']:
        chain.append(sol['par'][chain[-1]])
    chain = chain[::-1]
    N0 = sol['N0']
    legs = []
    for u in chain:
        kind = 'road' if u >= N0 else 'open'
        p = node_pt(g, sol, u)
        dd = sol['dist'][u]
        if legs and legs[-1]['kind'] == kind and (kind == 'open' or sol['rnode'][u - N0][0] == legs[-1]['road']):
            legs[-1]['pts'].append(p)
            legs[-1]['d'].append(dd)
        else:
            if legs and kind == 'road' and legs[-1]['kind'] == 'road':
                legs[-1]['pts'].append(p)                    # a junction: the road leg runs on along the next road
                legs[-1]['d'].append(dd)
                legs[-1]['road'] = sol['rnode'][u - N0][0]
                continue
            if legs:
                legs[-1]['pts'].append(p)                    # legs meet end to end
                legs[-1]['d'].append(dd)
            legs.append({'kind': kind, 'pts': [p], 'd': [dd], 'road': sol['rnode'][u - N0][0] if kind == 'road' else None})
    legs[-1]['pts'].append(end)
    legs[-1]['d'].append(d)
    for leg in legs:
        if leg['kind'] == 'open':
            leg['pts'] = pull(g, leg['pts'], leg['d'], sol['kind'])
        del leg['d']
    legs = [lg for lg in legs if geo.poly_len(lg['pts']) > 0.5]
    return legs


def seg_cost(g, a, b, kind=None):
    """Days for a straight open-country step a -> b by the ground under it (inf across water, or across the grounds
    of a place walked round when `kind` is a solve's own grid)."""
    L = math.dist(a, b)
    n = max(1, int(L))
    c = 0.0
    for t in range(n):
        f = (t + .5) / n
        k = kind_at(g, (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), kind)
        if k == 'water':
            return math.inf
        c += (L / n) / (FOREST_PX if k == 'forest' else OPEN_PX)
    return c


def pull(g, pts, d, kind=None):
    """String-pull a cell path: from each kept point, jump to the farthest later point whose straight line (over the
    solve's own ground, so it never cuts a place walked round) costs no more than the path it replaces (d: the
    Dijkstra days at each point)."""
    if len(pts) <= 2:
        return pts
    out = [pts[0]]
    i = 0
    while i < len(pts) - 1:
        best = i + 1
        for j in range(len(pts) - 1, i + 1, -1):
            if seg_cost(g, pts[i], pts[j], kind) <= d[j] - d[i] + 1e-6:
                best = j
                break
        out.append(pts[best])
        i = best
    return out


# ================================================================ costing a drawn route
def cost_of(legs, g):
    total = 0.0
    for leg in legs:
        p = leg['pts']
        for a, b in zip(p, p[1:]):
            total += math.dist(a, b) / ROAD_PX if leg['kind'] == 'road' else seg_cost(g, a, b)
    return total


def px_by_kind(legs, g):
    out = {'road': 0.0, 'open': 0.0, 'forest': 0.0}
    for leg in legs:
        p = geo.resample(leg['pts'], 1.0)
        for a, b in zip(p, p[1:]):
            L = math.dist(a, b)
            if leg['kind'] == 'road':
                out['road'] += L
            else:
                out['forest' if kind_at(g, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) == 'forest' else 'open'] += L
    return out


def along(legs, g, t):
    """The stage point reached after t days of the march (continuous)."""
    acc = 0.0
    for leg in legs:
        p = geo.resample(leg['pts'], 1.0)
        for a, b in zip(p, p[1:]):
            dt = math.dist(a, b) / ROAD_PX if leg['kind'] == 'road' else seg_cost(g, a, b)
            if acc + dt >= t:
                f = (t - acc) / dt if dt else 0
                return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
            acc += dt
    return legs[-1]['pts'][-1]


# ================================================================ encounters without hops
GAME = 'E:/Work/GameDev/Godot/fe-mb/game/src'
NO_ROLL_INTO = ('TOWN', 'BOSS')                   # rules.ts travel.noRollInto: the day you arrive there never rolls


def region_chance():
    """regions.json encounterChancePerHop, read as the chance per day of march."""
    import json
    with open(GAME + '/content/data/regions.json', encoding='utf-8') as fh:
        return {r['id']: r['encounterChancePerHop'] for r in json.load(fh)}


def region_at(p):
    """The region a stage point lies in. Inside the main view it is the ground B draws there: Ashfall's ash and dry
    grass are Ashfall, Thornwood's pines are Thornwood, the rest is the Borderlands. Beyond the view, by B's
    overview's rule, the country takes the region of its nearest place."""
    if 0 <= p[0] < 1280 and 0 <= p[1] < 720:
        kind = WB.terrain_at(p[0], p[1])
        if kind in ('ash', 'dry'):
            return 'ashfall'
        if kind == 'forest':
            return 'thornwood'
        return 'borderlands'
    vis = [k for k in WB.P if not WB.NODE[k].get('hidden')]
    k = min(vis, key=lambda k: math.dist(p, WB.P[k]))
    return WB.NODE[k]['region']


def day_rolls(legs, g, dest):
    """[(night point, region, chance)] for each day of the march: each day rolls once, at the chance of the region
    where that day ends; the last day ends at dest, and a day that ends in a town or at the throne never rolls."""
    ch = region_chance()
    n = whole(cost_of(legs, g))
    out = []
    for d in range(1, n + 1):
        p = legs[-1]['pts'][-1] if d == n else along(legs, g, d)
        r = WB.NODE[dest]['region'] if d == n else region_at(p)
        c = 0.0 if (d == n and WB.NODE[dest]['type'] in NO_ROLL_INTO) else ch[r]
        out.append((p, r, c))
    return out


def places_on(legs, tol=10.0):
    """The places a route runs through, in the order it reaches them (an arrival point within tol px of it)."""
    pts = [p for lg in legs for p in geo.resample(lg['pts'], 2.0)]
    hits = []
    for k in WB.P:
        if WB.NODE[k].get('hidden'):
            continue
        best = None
        for a in arrivals(k):
            for t, q in enumerate(pts):
                if math.dist(a, q) <= tol and (best is None or t < best):
                    best = t
        if best is not None:
            hits.append((best, k))
    return [k for _, k in sorted(hits)]


def table(g=None):
    """Every visible place: hops (B), B's tier, days by road alone, days by the quickest march, C's tier."""
    g = g or grid()
    fd = place_days(g, solve(g))
    rd = place_days(g, solve(g, roads_only=True))
    H = WB.hops()
    rows = []
    for k in sorted(fd, key=lambda k: (fd[k], k)):
        rows.append(dict(id=k, hops=H.get(k), tier_b=WB.tier(H.get(k, 99)), road=rd[k], march=fd[k],
                         days=whole(fd[k]), road_days=whole(rd[k]), tier_c=tier(whole(fd[k]))))
    return rows


if __name__ == '__main__':
    import time
    t0 = time.time()
    g = grid()
    print('grid', g['W'], 'x', g['H'], round(time.time() - t0, 1), 's')
    t0 = time.time()
    rows = table(g)
    print('solve', round(time.time() - t0, 1), 's')
    print('%-20s %4s %4s | %6s %4s | %6s %4s %4s' % ('place', 'hops', 'tB', 'road', 'd', 'march', 'd', 'tC'))
    for r in rows:
        print('%-20s %4s %4s | %6.2f %4d | %6.2f %4d %4d %s' % (r['id'], r['hops'], r['tier_b'], r['road'], r['road_days'],
                                                               r['march'], r['days'], r['tier_c'],
                                                               '' if r['tier_b'] == r['tier_c'] else '<- tier'))
