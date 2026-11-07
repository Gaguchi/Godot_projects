"""QA on the layout: road crossings without a junction, roads that meet water away from a bridge or a ford,
places too close together, places inside the wrong ground. python qa_graph.py"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import world_big as WB   # noqa: E402
import land as LD        # noqa: E402
import geo               # noqa: E402

paths = WB.road_paths()
keys = list(paths)
bad = []
for i in range(len(keys)):
    for j in range(i + 1, len(keys)):
        a, b = keys[i], keys[j]
        if set(a) & set(b):
            continue
        pa, pb = paths[a][::2], paths[b][::2]
        if any(geo.seg_x(pa[u], pa[u + 1], pb[v], pb[v + 1]) for u in range(len(pa) - 1) for v in range(len(pb) - 1)):
            bad.append((a, b))
print(len(paths), 'roads;', len(bad), 'crossings', bad)
cross_ok = [b['west'] for b in WB.BRIDGES.values()] + [b['east'] for b in WB.BRIDGES.values()] + \
           [f['at'] for f in WB.FORDS.values()] + [WB.MILL_FORD]
for name, course in (('river', WB.river_pts), ('brook', WB.brook_pts)):
    for key, pts in paths.items():
        for u in range(len(pts) - 1):
            for v in range(len(course) - 1):
                if geo.seg_x(pts[u], pts[u + 1], course[v], course[v + 1]):
                    p = pts[u]
                    d = min(math.dist(p, c) for c in cross_ok)
                    if d > 40:
                        print('WET', name, key, [int(c) for c in p], 'nearest crossing', int(d))
near = []
hk = WB.HEART_KEYS
for i, a in enumerate(hk):
    for b in hk[i + 1:]:
        d = math.dist(LD.P[a], LD.P[b])
        if d < 150:
            near.append((int(d), a, b))
print('close pairs', sorted(near))
deg = {}
for a, b, _ in LD.roads():
    deg[a] = deg.get(a, 0) + 1
    deg[b] = deg.get(b, 0) + 1
print('dead ends in heartland', [k for k in hk if deg.get(k, 0) == 1])
print('max degree', sorted(((v, k) for k, v in deg.items()), reverse=True)[:6])
