"""Scratch: compare candidate B graphs by BFS (hidden nodes skipped, as engine/content.ts#nodeDistances)."""
import json
from collections import deque, defaultdict
W = json.load(open('E:/Work/GameDev/Godot/fe-mb/game/src/content/data/overworld/world.json', encoding='utf-8'))
NODES = {n['id']: n for n in W['nodes']}
BASE = [(e['from'], e['to']) for e in W['edges']]

def tier(h):
    return 1 if h <= 2 else (2 if h <= 5 else 3)

def bfs(edges):
    hidden = {k for k, n in NODES.items() if n.get('hidden')}
    adj = defaultdict(list)
    for a, b in edges:
        if a in hidden or b in hidden:
            continue
        adj[a].append(b); adj[b].append(a)
    d = {'frontier_camp': 0}; q = deque(['frontier_camp'])
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in d:
                d[v] = d[u] + 1; q.append(v)
    return d

def variant(add=(), remove=()):
    rem = {frozenset(r) for r in remove}
    e = [x for x in BASE if frozenset(x) not in rem] + list(add)
    assert len(rem) == len(BASE) - len([x for x in BASE if frozenset(x) not in rem]), 'remove names a road that is not there'
    return e

def report(name, edges):
    d0, d1 = bfs(BASE), bfs(edges)
    print(f'== {name}: {len(edges)} roads, throne {d1.get("the_iron_throne")}')
    ch = []
    for k in NODES:
        a, b = d0.get(k), d1.get(k)
        if a != b:
            ch.append((k, a, b, tier(a) if a is not None else None, tier(b) if b is not None else None))
    for k, a, b, ta, tb in sorted(ch, key=lambda t: (t[2], t[0])):
        print(f'   {k:20} {a:>2} -> {b:>2}   tier {ta} -> {tb}{"  *" if ta != tb else ""}')
    by = defaultdict(list)
    for k, h in d1.items():
        by[h].append(k)
    print('   rings:', {h: len(v) for h, v in sorted(by.items())})

report('today', BASE)
S_EXIT = ('smugglers_cave', 'ashfall_trail')
report('W0: TR-BS-MP, BS off BF, +S exit', variant(add=[('traders_rest', 'borderland_shrine'), ('borderland_shrine', 'mountain_pass'), S_EXIT],
                                                     remove=[('border_fortress', 'borderland_shrine')]))
report('W0+N: + camp-NRP', variant(add=[('frontier_camp', 'north_ridge_path'), ('traders_rest', 'borderland_shrine'), ('borderland_shrine', 'mountain_pass'), S_EXIT],
                                   remove=[('border_fortress', 'borderland_shrine')]))
W2_ADD = [('traders_rest', 'bandit_hideout'), ('bandit_hideout', 'borderland_shrine'), ('borderland_shrine', 'mountain_pass'), S_EXIT, ('riverside_market', 'south_junction')]
W2_REM = [('riverside_market', 'bandit_hideout'), ('bandit_hideout', 'pine_crossing'), ('border_fortress', 'borderland_shrine')]
report("W2': BH+BS west", variant(add=W2_ADD, remove=W2_REM))
report("W2'': BH+BS west + camp-NRP", variant(add=W2_ADD + [('frontier_camp', 'north_ridge_path')], remove=W2_REM))
