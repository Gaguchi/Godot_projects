"""The numbers for NOTES.md: hop bands, tiers under today's rule and the proposals, the throne's route, food,
days and expected encounter rolls. python stats.py"""
import os
import sys
from collections import Counter, defaultdict, deque

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import land as LD   # noqa: E402

RATE = {'borderlands': .40, 'thornwood': .55, 'ashfall': .70}
h = LD.hops()
vis = [k for k in LD.P if not LD.NODE[k].get('hidden')]
print('places', len(LD.P), 'visible', len(vis), 'roads', len(LD.roads()))
print('heartland', len([k for k in LD.P if LD.NODE[k]['region'] == 'borderlands']), 'drawn', len(LD.heart_places()))
print('throne', h['the_iron_throne'])
band = Counter(h[k] for k in vis)
print('by hop:', dict(sorted(band.items())))
for reg in ('borderlands', 'thornwood', 'ashfall'):
    ks = [k for k in vis if LD.NODE[k]['region'] == reg]
    print(reg, 'hops', min(h[k] for k in ks), '-', max(h[k] for k in ks), Counter(h[k] for k in ks))
for name, bands in (('today 2/5', (2, 5)), ('doubled 4/10', (4, 10)), ('4/9', (4, 9)), ('3/8', (3, 8))):
    t = Counter(LD.tier(h[k], bands) for k in vis)
    by_reg = {reg: Counter(LD.tier(h[k], bands) for k in vis if LD.NODE[k]['region'] == reg) for reg in RATE}
    print(name, dict(sorted(t.items())), {r: dict(sorted(c.items())) for r, c in by_reg.items()})
# the shortest route to the throne, and its rolls
adj = defaultdict(list)
for a, b, _ in LD.roads():
    if LD.NODE[a].get('hidden') or LD.NODE[b].get('hidden'):
        continue
    adj[a].append(b)
    adj[b].append(a)
prev = {'frontier_camp': None}
q = deque(['frontier_camp'])
while q:
    u = q.popleft()
    for v in sorted(adj[u]):
        if v not in prev:
            prev[v] = u
            q.append(v)
path = []
k = 'the_iron_throne'
while k:
    path.append(k)
    k = prev[k]
path = path[::-1]
print('route', ' > '.join(LD.NAMES[k] for k in path))
rolls = sum(RATE[LD.NODE[k]['region']] for k in path[1:] if LD.NODE[k]['type'] not in ('TOWN', 'BOSS'))
print('route hops', len(path) - 1, 'expected rolls', round(rolls, 1),
      'regions', Counter(LD.NODE[k]['region'] for k in path[1:]))
first = {reg: min(h[k] for k in vis if LD.NODE[k]['region'] == reg) for reg in RATE}
print('first reached (hops)', first)
towns = [k for k in vis if LD.NODE[k]['type'] == 'TOWN']
print('towns', len(towns), sorted((h[k], LD.NAMES[k]) for k in towns))
print('towns on the route', [LD.NAMES[k] for k in path if LD.NODE[k]['type'] == 'TOWN'])
print('new by type', Counter(LD.NODE[k]['type'] for k in LD.NEW))
