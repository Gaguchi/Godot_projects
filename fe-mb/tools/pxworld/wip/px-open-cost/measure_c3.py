"""Legs-graph C: every road hop stays 1 day (as today); overland legs between places cost ceil(grid days), <= 3 days,
kept only when strictly quicker than the roads. Grid has NO road cells here (a leg is open-country going)."""
import math, heapq, json
from collections import defaultdict, Counter
import measure_c as M
W = M.W
CROSS = {rc for rc in M.road if M.ground[rc[0]][rc[1]] == 'water'}    # bridges and fords: road over water
PLACES = {M.cell_of(*W.P[k]) for k in W.P}
def _cost(r, c):
    g = M.ground[r][c]
    if g == 'water':
        return M.DAY * M.CELL / M.SPEED['open'] if ((r, c) in CROSS or (r, c) in PLACES) else None
    return M.DAY * M.CELL / M.SPEED[g]
M.cost = _cost
print('crossing cells', len(CROSS))
vis = [k for k in W.P if not W.NODE[k].get('hidden')]
cells = {k: M.cell_of(*W.P[k]) for k in vis}
roads = [(a, b) for a, b, *_ in W.b_roads() if a in cells and b in cells]
def sp(g, src='frontier_camp'):
    d = {src: 0}; pq = [(0, src)]
    while pq:
        x, u = heapq.heappop(pq)
        if x > d[u]: continue
        for v, w in g[u]:
            if x + w < d.get(v, 1e9): d[v] = x + w; heapq.heappush(pq, (x + w, v))
    return d
gr = defaultdict(list)
for a, b in roads: gr[a].append((b, 1)); gr[b].append((a, 1))
road_from = {k: sp(gr, k) for k in vis}
tier = lambda d: 1 if d <= 2 else (2 if d <= 5 else 3)
for OPEN, FOREST in ((130, 87), (160, 100), (200, 130)):
    M.SPEED.update(open=OPEN, field=OPEN, dry=OPEN, ash=int(OPEN * .85), wood=FOREST, forest=FOREST)
    fields = {k: M.dijkstra(cells[k]) for k in vis}
    g = defaultdict(list, {k: list(v) for k, v in gr.items()})
    legs = []
    for i, a in enumerate(vis):
        for b in vis[i + 1:]:
            c = fields[a].get(cells[b])
            if c is None: continue
            days = max(1, math.ceil(c / M.DAY - 1e-9))
            if days > 3 or days >= road_from[a].get(b, 99): continue
            g[a].append((b, days)); g[b].append((a, days)); legs.append((a, b, days))
    d = sp(g); h = road_from['frontier_camp']
    ch = sorted([(k, h[k], d[k]) for k in vis if tier(h[k]) != tier(d[k])], key=lambda t: t[2])
    used = Counter(x[2] for x in legs)
    print(f'\n== open {OPEN} px/day, forest {FOREST} px/day (road: 1 hop = 1 day)')
    print(f'   overland legs kept: {len(legs)} {sorted(used.items())}; throne {h["the_iron_throne"]} hops by road -> {d["the_iron_throne"]} days marching anywhere')
    print(f'   day rings: {sorted(Counter(d.values()).items())}')
    print(f'   places whose tier changes ({len(ch)}): {ch}')
    if OPEN == 130:
        json.dump({'legs': legs, 'days': d}, open('t/measure_c3_130.json', 'w'))
        # camp's own legs
        print('   legs out of the camp:', [x for x in legs if 'frontier_camp' in x[:2]])
