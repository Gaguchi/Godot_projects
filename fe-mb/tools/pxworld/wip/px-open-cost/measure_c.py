"""Measure variant C's travel rule over variant B's country (read-only; imports px-open-b/world_b).
Grid 20 px, 8-connected, integer costs. Speeds (stage px per day) are the cost brief's proposal."""
import sys, os, math, heapq, json, time
from collections import defaultdict, Counter
B = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'px-open-b')
sys.path.insert(0, B)
import world_b as W

SPEED = {'road': 260, 'open': 130, 'field': 130, 'dry': 130, 'ash': 110, 'wood': 87, 'forest': 87}
DAY = 1000                         # cost units per day
CELL = 20
X0, Y0, X1, Y1 = -720, -400, 1760, 1260
COLS, ROWS = (X1 - X0) // CELL, (Y1 - Y0) // CELL
t0 = time.time()
cv, info = W.render(company=False)
nodes = {k: v for k, v in W.NODE.items()}
vis = [k for k in W.P if not nodes[k].get('hidden')]

def region_near(x, y):
    k = min(vis, key=lambda k: (W.P[k][0] - x) ** 2 + (W.P[k][1] - y) ** 2)
    return nodes[k]['region']

ground = [[None] * COLS for _ in range(ROWS)]
for r in range(ROWS):
    for c in range(COLS):
        x, y = X0 + c * CELL + CELL / 2, Y0 + r * CELL + CELL / 2
        if 0 <= x < 1280 and 0 <= y < 720:
            # majority of a 5x5 sample inside the cell
            cnt = Counter(W.terrain_at(x + dx, y + dy, info) for dx in (-8, -4, 0, 4, 8) for dy in (-8, -4, 0, 4, 8))
            g = cnt.most_common(1)[0][0]
            if cnt['water'] >= 3: g = 'water'
            if g == 'road': g = 'open'
        else:
            reg = region_near(x, y)
            g = {'thornwood': 'forest', 'ashfall': 'dry', 'borderlands': 'open'}[reg]
        ground[r][c] = g
# roads: rasterise every road polyline (on-screen fine polylines; off-screen straight)
paths = W.road_paths()
road = set()
def cell_of(x, y):
    return (int((y - Y0) // CELL), int((x - X0) // CELL))
roads = [r for r in W.b_roads()]
for a, b, *_ in roads:
    pts = paths.get((a, b)) or paths.get((b, a)) or [W.P[a], W.P[b]]
    pts = [W.P[a]] + list(pts) + [W.P[b]]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(math.dist((x0, y0), (x1, y1)) / 4))
        for i in range(n + 1):
            road.add(cell_of(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n))

def cost(r, c):
    if (r, c) in road: return DAY * CELL / SPEED['road']
    g = ground[r][c]
    if g == 'water': return None
    return DAY * CELL / SPEED[g]

def dijkstra(src_cell):
    INF = float('inf')
    dist = {src_cell: 0.0}
    pq = [(0.0, src_cell)]
    while pq:
        d, (r, c) = heapq.heappop(pq)
        if d > dist.get((r, c), INF): continue
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            rr, cc = r + dr, c + dc
            if not (0 <= rr < ROWS and 0 <= cc < COLS): continue
            k = cost(rr, cc); k0 = cost(r, c)
            if k is None: continue
            step = (k + k0) / 2 * (1.41421356 if dr and dc else 1)
            nd = d + step
            if nd < dist.get((rr, cc), INF):
                dist[(rr, cc)] = nd
                heapq.heappush(pq, (nd, (rr, cc)))
    return dist

camp = cell_of(*W.P['frontier_camp'])
t1 = time.time()
D = dijkstra(camp)
t2 = time.time()
hops = W.hops()
# road-only days: each road's polyline length / road speed
adj = defaultdict(list)
for a, b, *_ in roads:
    if nodes[a].get('hidden') or nodes[b].get('hidden'): continue
    pts = [W.P[a]] + list(paths.get((a, b)) or paths.get((b, a)) or []) + [W.P[b]]
    L = sum(math.dist(p, q) for p, q in zip(pts, pts[1:]))
    adj[a].append((b, L)); adj[b].append((a, L))
rd = {'frontier_camp': 0.0}; pq = [(0.0, 'frontier_camp')]
while pq:
    d, u = heapq.heappop(pq)
    if d > rd[u]: continue
    for v, L in adj[u]:
        nd = d + L / SPEED['road']
        if nd < rd.get(v, 1e9): rd[v] = nd; heapq.heappush(pq, (nd, v))
rows = []
for k in sorted(hops, key=lambda k: hops[k]):
    cd = D.get(cell_of(*W.P[k]), float('inf')) / DAY
    rows.append((k, hops[k], round(rd[k], 2), round(cd, 2)))
def tier_days(d):
    return 1 if d <= 2 else (2 if d <= 5 else 3)
def tier_h(h):
    return 1 if h <= 2 else (2 if h <= 5 else 3)
print(f'grid {COLS}x{ROWS} = {COLS*ROWS} cells, render {t1-t0:.1f}s, one dijkstra {t2-t1:.2f}s (python)')
print(f'{"place":22} hops  road-days  open-days  tier(h) tier(road) tier(open)')
for k, h, r_, c_ in rows:
    print(f'{k:22} {h:>4} {r_:>9} {c_:>9}   {tier_h(h)}        {tier_days(r_)}         {tier_days(math.ceil(c_))}')
gc = Counter(ground[r][c] for r in range(ROWS) for c in range(COLS))
print('ground cells', dict(gc), 'road cells', len(road))
# road edge day lengths
Ls = []
for a, b, *_ in roads:
    pts = [W.P[a]] + list(paths.get((a, b)) or paths.get((b, a)) or []) + [W.P[b]]
    Ls.append(sum(math.dist(p, q) for p, q in zip(pts, pts[1:])))
print('road length days (len/260):', sorted(Counter(math.ceil(L / 260) for L in Ls).items()))
json.dump({'rows': rows}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 't', 'measure_c.json'), 'w'))
