"""Dense-graph C over B's country, at several road speeds: each road hop and each overland leg costs ceil(days)."""
import math, heapq, sys, json
from collections import defaultdict, Counter
import measure_c as M   # builds ground/road grid once (prints its table too)
W = M.W
vis = [k for k in W.P if not W.NODE[k].get('hidden')]
cells = {k: M.cell_of(*W.P[k]) for k in vis}
# grid cost at the base speeds (road 260): scale linearly for other road speeds (all speeds scale together)
fields = {k: M.dijkstra(cells[k]) for k in vis}
base = M.SPEED['road']
roadlen = {}
for a, b, *_ in W.b_roads():
    if a not in cells or b not in cells: continue
    pts = [W.P[a]] + list(M.paths.get((a, b)) or M.paths.get((b, a)) or []) + [W.P[b]]
    roadlen[(a, b)] = sum(math.dist(p, q) for p, q in zip(pts, pts[1:]))
def sp(graph, src='frontier_camp'):
    d = {src: 0}; pq = [(0, src)]
    while pq:
        x, u = heapq.heappop(pq)
        if x > d[u]: continue
        for v, w in graph[u]:
            if x + w < d.get(v, 1e9): d[v] = x + w; heapq.heappush(pq, (x + w, v))
    return d
tier = lambda d: 1 if d <= 2 else (2 if d <= 5 else 3)
out = {}
for R in (260, 330, 400):
    f = base / R
    g_road = defaultdict(list)
    rd = Counter()
    for (a, b), L in roadlen.items():
        days = max(1, math.ceil(L / R - 1e-9))
        rd[days] += 1
        g_road[a].append((b, days)); g_road[b].append((a, days))
    droad = sp(g_road)
    g = defaultdict(list, {k: list(v) for k, v in g_road.items()})
    legs = 0
    leglist = []
    for i, a in enumerate(vis):
        for b in vis[i + 1:]:
            c = fields[a].get(cells[b])
            if c is None: continue
            days = max(1, math.ceil(c * f / M.DAY - 1e-9))
            if days > 3: continue
            # keep only legs strictly faster than the road network between the pair
            if days >= sp(g_road, a).get(b, 1e9): continue
            g[a].append((b, days)); g[b].append((a, days)); legs += 1; leglist.append((a, b, days))
    dd = sp(g)
    changed = [(k, droad[k], dd[k]) for k in vis if tier(droad[k]) != tier(dd[k])]
    print(f'\n== road {R} px/day, open {R//2}, forest {R//3}: road hop days {sorted(rd.items())}')
    print(f'   throne: hops 9, road-only {droad["the_iron_throne"]} days, march-anywhere {dd["the_iron_throne"]} days; overland legs kept {legs}')
    print(f'   days rings (march anywhere): {sorted(Counter(dd.values()).items())}')
    print(f'   tier changes road-only -> anywhere: {changed}')
    out[R] = {'droad': droad, 'dd': dd, 'legs': leglist, 'roaddays': dict(rd)}
json.dump({str(k): v for k, v in out.items()}, open('t/measure_c2.json', 'w'), indent=0)
