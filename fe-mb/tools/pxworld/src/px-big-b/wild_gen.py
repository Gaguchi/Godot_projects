"""Lay out the wild country round the big heartland (planning tool). Writes wild_data.py, which land.py imports.

1. B's 31 wild places and the Iron Throne, scaled x2 about the camp, keep their roads (B's wild graph).
2. Every long road gets new places along it (one per ~300 px), so distances double and the hops roughly double.
3. The rest of the ring is filled to about four times B's wild count, each new place joined to its nearest
   neighbours without crossing another road.
4. The heartland's rim roads (EXITS) are joined to the nearest wild place that way.
5. Roads are pruned in Ashfall until the Iron Throne is TARGET hops out (the only way in is by Ashen Gate).
6. Names come from each region's pool, a ford or bridge only beside water.
Seeded, so the same run writes the same file: python wild_gen.py
"""
import math
import os
import random
import sys
from collections import defaultdict, deque

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import land as L  # noqa: E402

SEED = 7
TARGET = 18
# 2026-10-26: forcing the throne road through Thornwood by cutting Ashfall roads gave 28-31 hops, because Thornwood
# lies north and east and the throne south-west. Off until the throne's approach moves next to Thornwood.
THORNWOOD_GATE = True
ASH_LEG = 7                # hops from the last Thornwood place to the throne
# owner 2026-10-26: the throne road climbs the Borderlands, then Thornwood, then Ashfall. The throne's approach moves
# to the south-east corner, past Thornwood's southern end, and is entered from Morgana's Grove and Thornwood Depths
# (today's game already enters Ashfall by Morgana's Grove).
MOVE = {'final_approach': (3000, 1880), 'warlords_camp': (2620, 2200), 'ashen_gate': (3260, 2120), 'the_iron_throne': (3440, 2320)}
GATE_ROADS = [('morganas_grove', 'final_approach')]
OUTER = (-1290, -860, 3540, 2380)
HEARTBOX = (-110, -110, 2670, 1550)
WILD_TARGET = 130          # wild places in all, B's 32 included

WILD0 = [k for k in L.GAME if L.GAME[k]['region'] != 'borderlands']
# the heartland's roads out into the wild: (heartland place, bearing in degrees clockwise from north, or a wild id)
EXITS = [
    ('charcoal_burners_camp', 330), ('hunters_lodge', 0), ('old_sawpit', 0), ('border_fortress', 'thornwood_gate'),
    ('foresters_hut', 20), ('forest_shrine', 60), ('ruined_keep', 90), ('rodericks_camp', 'southern_trail'),
    ('reed_marsh', 130), ('broken_bridge', 'ashfall_trail'), ('smoke_hill', 180), ('lowfield', 190),
    ('ash_ford', 225), ('old_barrow', 270), ('burnt_farm', 'mountain_pass'),
]


def seg_cross(p1, p2, p3, p4):
    def o(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    d1, d2, d3, d4 = o(p3, p4, p1), o(p3, p4, p2), o(p1, p2, p3), o(p1, p2, p4)
    return (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0)


def pt_seg(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dy * dy or 1e-9
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def in_box(p, box):
    return box[0] <= p[0] <= box[2] and box[1] <= p[1] <= box[3]


def seg_hits_box(a, b, box, n=24):
    return any(in_box((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n), box) for i in range(1, n))


def main():
    rng = random.Random(SEED)
    P = {k: L.P[k] for k in WILD0}
    REG = {k: L.GAME[k]['region'] for k in WILD0}
    HP = {k: L.P[k] for k in L.P if L.NODE[k]['region'] == 'borderlands'}

    roads = []
    n_new = [0]

    def new_id(region):
        n_new[0] += 1
        return f'w{n_new[0]:03d}'
    # 1-2: B's wild roads, split
    P.update(MOVE)
    b_wild = [r for r in L.B_ROADS if r[0] in P and r[1] in P and ((r[0] in MOVE) == (r[1] in MOVE))] + GATE_ROADS
    for a, b in b_wild:
        A, B = P[a], P[b]
        d = math.dist(A, B)
        k = max(0, round(d / 300) - 1)
        chain = [a]
        nx, ny = -(B[1] - A[1]) / d, (B[0] - A[0]) / d
        for i in range(1, k + 1):
            t = i / (k + 1)
            j = max(-45, min(45, rng.gauss(0, .08 * d)))
            p = (A[0] + (B[0] - A[0]) * t + nx * j, A[1] + (B[1] - A[1]) * t + ny * j)
            q = new_id(None)
            P[q] = p
            REG[q] = REG[a] if REG[a] == REG[b] else (REG[a] if t < .5 else REG[b])
            chain.append(q)
        chain.append(b)
        for u, v in zip(chain, chain[1:]):
            roads.append((u, v))
    # 3: fill the ring
    allp = lambda: list(P.values()) + list(HP.values())

    def ok_fill(p):
        if not in_box(p, OUTER) or in_box(p, HEARTBOX):
            return False
        if min(math.dist(p, q) for q in allp()) < 250:
            return False
        if any(pt_seg(p, P[a], P[b]) < 120 for a, b in roads):
            return False
        return True
    tries = 0
    while len(P) < WILD_TARGET and tries < 60000:
        tries += 1
        p = (rng.uniform(OUTER[0], OUTER[2]), rng.uniform(OUTER[1], OUTER[3]))
        if ok_fill(p):
            q = new_id(None)
            P[q] = p
            near = min(WILD0, key=lambda k: math.dist(L.P[k], p))
            REG[q] = REG[near]
    fills = [k for k in P if k not in WILD0 and not any(k in r for r in roads)]

    def crosses(a, b, extra=()):
        A, B = (P.get(a) or HP[a]), (P.get(b) or HP[b])
        for u, v in list(roads) + list(extra):
            if {u, v} & {a, b}:
                continue
            U, V = (P.get(u) or HP[u]), (P.get(v) or HP[v])
            if seg_cross(A, B, U, V):
                return True
        for k2, q in list(P.items()):
            if k2 in (a, b):
                continue
            if pt_seg(q, A, B) < 70:
                return True
        return False
    # join each fill place to up to two nearest neighbours, shortest candidates first
    cands = []
    for f in fills:
        for k2 in P:
            if k2 == f or k2 == 'the_iron_throne':
                continue
            d = math.dist(P[f], P[k2])
            if d < 470:
                cands.append((d, f, k2))
    cands.sort()
    deg = defaultdict(int)
    for a, b in roads:
        deg[a] += 1; deg[b] += 1
    have = {frozenset(r) for r in roads}
    for d, f, k2 in cands:
        if deg[f] >= 2 or frozenset((f, k2)) in have:
            continue
        if deg[k2] >= 4:
            continue
        if seg_hits_box(P[f], P[k2], HEARTBOX):
            continue
        if crosses(f, k2):
            continue
        roads.append((f, k2)); have.add(frozenset((f, k2))); deg[f] += 1; deg[k2] += 1
    # any place still alone: its nearest legal neighbour
    for f in fills:
        if deg[f] == 0:
            for k2 in sorted(P, key=lambda q: math.dist(P[f], P[q])):
                if k2 in (f, 'the_iron_throne') or seg_hits_box(P[f], P[k2], HEARTBOX):
                    continue
                if not crosses(f, k2):
                    roads.append((f, k2)); deg[f] += 1; deg[k2] += 1
                    break
    # 4: the heartland's rim roads
    exit_roads = []
    for h, how in EXITS:
        H = HP[h]
        if isinstance(how, str):
            exit_roads.append((h, how))
            continue
        best = None
        for k2, q in P.items():
            if k2 == 'the_iron_throne':
                continue
            dx, dy = q[0] - H[0], q[1] - H[1]
            brg = math.degrees(math.atan2(dx, -dy)) % 360
            off = abs(((brg - how) + 180) % 360 - 180)
            d = math.hypot(dx, dy)
            if off > 50 or d > 700:
                continue
            score = d + off * 6
            A, B = H, q
            bad = False
            for u, v in roads + exit_roads:
                U, V = (P.get(u) or HP[u]), (P.get(v) or HP[v])
                if {u, v} & {h, k2}:
                    continue
                if seg_cross(A, B, U, V):
                    bad = True
                    break
            if not bad and (best is None or score < best[0]):
                best = (score, k2)
        if best:
            exit_roads.append((h, best[1]))
        else:
            print('no exit for', h)
    # 5: prune Ashfall until the throne is far enough
    heart_roads = [r for r in L.HEART_ROADS]

    def graph(rs):
        adj = defaultdict(set)
        for a, b in rs:
            if L.GAME.get(a, {}).get('hidden') or L.GAME.get(b, {}).get('hidden'):
                continue
            adj[a].add(b); adj[b].add(a)
        return adj

    def bfs(adj, s='frontier_camp'):
        d = {s: 0}
        q = deque([s])
        while q:
            u = q.popleft()
            for v in adj[u]:
                if v not in d:
                    d[v] = d[u] + 1
                    q.append(v)
        return d
    every = set(P) | set(HP) - {'darens_camp'}
    allroads = heart_roads + roads + exit_roads
    fixed_exits = {e for e in exit_roads if isinstance(dict(EXITS).get(e[0]), str)}

    def removable(adj, r):
        a, b = r
        if r in fixed_exits:
            return False
        if REG.get(a, 'borderlands') != 'ashfall' and REG.get(b, 'borderlands') != 'ashfall':
            return False
        if 'the_iron_throne' in r:
            return False
        return len(adj[a]) > 1 and len(adj[b]) > 1

    def on_short(adj, d, r):
        """Is road r on some shortest path from the camp to the throne?"""
        dt = bfs(adj, 'the_iron_throne')
        a, b = r
        n = d['the_iron_throne']
        return (d.get(a, 99) + 1 + dt.get(b, 99) == n) or (d.get(b, 99) + 1 + dt.get(a, 99) == n)

    # 5b: owner 2026-10-26, the throne road climbs the Borderlands, then Thornwood, then Ashfall: cut Ashfall roads
    # until no way from the camp to the throne avoids Thornwood (every place still reachable)
    def path_without_thornwood(rs):
        adj = graph([r for r in rs if 'thornwood' not in (REG.get(r[0], 'borderlands'), REG.get(r[1], 'borderlands'))])
        par, q = {'frontier_camp': None}, deque(['frontier_camp'])
        while q:
            u = q.popleft()
            for v in adj[u]:
                if v not in par:
                    par[v] = u
                    q.append(v)
        if 'the_iron_throne' not in par:
            return None
        p, k = [], 'the_iron_throne'
        while par[k] is not None:
            p.append((par[k], k)); k = par[k]
        return p                                         # edges from the throne end outwards
    def shortest(rs):
        adj = graph(rs)
        par, q = {'frontier_camp': None}, deque(['frontier_camp'])
        while q:
            u = q.popleft()
            for v in sorted(adj[u]):
                if v not in par:
                    par[v] = u
                    q.append(v)
        p, k = [], 'the_iron_throne'
        while par.get(k) is not None:
            p.append(k); k = par[k]
        return ['frontier_camp'] + p[::-1]

    def bad_way(rs):
        """Edges to try cutting, throne end first, or None when every way in runs Borderlands, Thornwood, Ashfall."""
        p = path_without_thornwood(rs)
        if p is not None:
            return p
        way = shortest(rs)
        reg = [REG.get(k, 'borderlands') for k in way]
        first_t = reg.index('thornwood')
        if 'ashfall' not in reg[:first_t]:
            return None
        pre = list(zip(way[:first_t], way[1:first_t + 1]))   # the shortest way, camp to its first Thornwood place
        return [e for e in reversed(pre) if 'ashfall' in (REG.get(e[0], 'borderlands'), REG.get(e[1], 'borderlands'))]

    def gate():
      for it in range(80 if THORNWOOD_GATE else 0):
        p = bad_way(allroads)
        if p is None:
            break
        n_all = len(bfs(graph(allroads)))
        cut = None
        for a, b in p:
            r = (a, b) if (a, b) in allroads else (b, a)
            if r not in allroads or not removable(graph(allroads), r):
                continue
            if len(bfs(graph([x for x in allroads if x != r]))) == n_all:
                cut = r
                break
        if cut is None:
            print('cannot close the Thornwood-free way at', p[:3])
            break
        allroads.remove(cut)
        (roads if cut in roads else exit_roads).remove(cut)
    gate()
    for it in range(60):
        adj = graph(allroads)
        d = bfs(adj)
        if d.get('the_iron_throne', 0) >= TARGET:
            break
        cand = [r for r in roads + exit_roads if removable(adj, r) and on_short(adj, d, r)]
        best = None
        for r in cand:
            trial = [x for x in allroads if x != r]
            d2 = bfs(graph(trial))
            if len(d2) < len(d):
                continue
            gain = d2['the_iron_throne'] - d['the_iron_throne']
            if gain > 0 and (best is None or gain > best[0]):
                best = (gain, (r,))
        if not best:                                         # no single road: try two together
            for i in range(len(cand)):
                for j in range(i + 1, len(cand)):
                    trial = [x for x in allroads if x not in (cand[i], cand[j])]
                    g2 = graph(trial)
                    if any(len(g2[k]) == 0 for k in (*cand[i], *cand[j])):
                        continue
                    d2 = bfs(g2)
                    if len(d2) < len(d):
                        continue
                    gain = d2['the_iron_throne'] - d['the_iron_throne']
                    miss = abs(d['the_iron_throne'] + gain - TARGET)
                    if gain > 0 and (best is None or miss < best[2]):
                        best = (gain, (cand[i], cand[j]), miss)
        if not best:
            break
        for r in best[1]:
            allroads.remove(r)
            (roads if r in roads else exit_roads).remove(r)
        print('pruned', best[1], '->', bfs(graph(allroads))['the_iron_throne'])
    gate()
    # 5c: the gated approach is short (Thornwood straight to Ashen Gate), so lengthen its Ashfall leg to ASH_LEG hops
    # by splitting its longest roads with new Ashfall places, the deep end of the climb
    for it in range(12 if THORNWOOD_GATE else 0):
        way = shortest(allroads)
        regs = [REG.get(k, 'borderlands') for k in way]
        i = max(j for j, r in enumerate(regs) if r == 'thornwood')
        leg = list(zip(way[i:], way[i + 1:]))
        if len(leg) >= ASH_LEG:
            break
        u, v = max((e for e in leg if 'the_iron_throne' not in e), key=lambda e: math.dist(P[e[0]], P[e[1]]))
        r = (u, v) if (u, v) in allroads else (v, u)
        q = new_id('ashfall')
        A, B = P[u], P[v]
        d = math.dist(A, B)
        j = rng.choice((-1, 1)) * min(60, .15 * d)
        P[q] = ((A[0] + B[0]) / 2 - (B[1] - A[1]) / d * j, (A[1] + B[1]) / 2 + (B[0] - A[0]) / d * j)
        REG[q] = 'ashfall'
        lst = roads if r in roads else exit_roads
        lst.remove(r); allroads.remove(r)
        roads.extend([(u, q), (q, v)]); allroads.extend([(u, q), (q, v)])
    d = bfs(graph(allroads))
    print('throne road Borderlands, Thornwood, Ashfall:', bad_way(allroads) is None)
    print('wild places', len(P), 'new', len(P) - len(WILD0), 'roads wild', len(roads), 'exits', len(exit_roads),
          'throne', d.get('the_iron_throne'), 'unreached', sorted(every - set(d)))
    names = name_places(P, REG, rng)
    with open(os.path.join(HERE, 'wild_data.py'), 'w', encoding='utf-8') as fh:
        fh.write('"""The wild country\'s new places and roads, written by wild_gen.py (seed %d). Do not edit by hand:\n'
                 'change wild_gen.py and run it again."""\n' % SEED)
        fh.write('WILD = {\n')
        for k in sorted(P):
            if k in WILD0:
                continue
            nm, typ, sig, job = names[k]
            fh.write(f"    {k!r}: ({nm!r}, {typ!r}, {sig!r}, ({int(round(P[k][0]))}, {int(round(P[k][1]))}), "
                     f"{REG[k]!r}, {job!r}),\n")
        fh.write('}\n')
        fh.write('MOVED = %r\n' % (MOVE,))
        fh.write('WILD_ROADS = [\n')
        for a, b in roads:
            fh.write(f'    ({a!r}, {b!r}),\n')
        fh.write(']\n')
        fh.write('EXIT_ROADS = [\n')
        for a, b in exit_roads:
            fh.write(f'    ({a!r}, {b!r}),\n')
        fh.write(']\n')
    print('wrote wild_data.py')


# ---------------------------------------------------------------- the names
# (name, type, sigil, job); job 'water' only beside the river or the brook
POOL = {
    'thornwood': [
        ("Huntsmen's Camp", 'CAMP', None, 'camp'), ("Sawyers' Camp", 'CAMP', None, 'camp'),
        ("Bark Peelers' Camp", 'CAMP', None, 'camp'), ("Resin Tappers' Camp", 'CAMP', None, 'camp'),
        ('Deer Run Camp', 'CAMP', None, 'camp'), ('Owl Roost', 'CAMP', None, 'camp'), ('Badger Sett', 'CAMP', None, 'camp'),
        ('Boar Wallow', 'CAMP', None, 'camp'), ('Stag Clearing', 'CAMP', None, 'camp'), ('Mossy Bank', 'CAMP', None, 'camp'),
        ('Black Pine Camp', 'CAMP', None, 'camp'), ('Hollow Stump', 'CAMP', None, 'camp'), ('Twisted Oak', 'CAMP', None, 'camp'),
        ('Fern Hollow', 'CAMP', None, 'camp'), ('Briar Patch', 'CAMP', None, 'camp'), ('Raven Rock', 'CAMP', None, 'camp'),
        ('Elk Meadow', 'CAMP', None, 'camp'), ('Fox Earth', 'CAMP', None, 'camp'), ('Honey Tree', 'CAMP', None, 'camp'),
        ('Old Oak Camp', 'CAMP', None, 'camp'), ('Yew Hollow', 'CAMP', None, 'camp'), ('Hazel Thicket', 'CAMP', None, 'camp'),
        ('Woodsmoke Camp', 'CAMP', None, 'camp'), ('Lantern Clearing', 'CAMP', None, 'camp'),
        ('Forest Watch', 'CAMP', 'fortress', 'tower'), ('Timber Fort', 'CAMP', 'fortress', 'tower'),
        ('Old Lookout', 'CAMP', 'fortress', 'tower'),
        ('Deer Path', 'TRAIL', 'waypoint', 'trail'), ('Bog Path', 'TRAIL', 'waypoint', 'trail'),
        ('Wolf Track', 'TRAIL', 'waypoint', 'trail'), ('Long Glade', 'TRAIL', 'waypoint', 'trail'),
        ('Pine Steps', 'TRAIL', 'waypoint', 'trail'), ('Old Forest Road', 'TRAIL', 'waypoint', 'trail'),
        ('Bramble Gap', 'TRAIL', 'waypoint', 'trail'), ('Sunken Lane', 'TRAIL', 'waypoint', 'trail'),
        ('Moss Steps', 'TRAIL', 'waypoint', 'trail'),
        ('Root Bridge', 'TRAIL', 'bridge', 'water'), ('Log Crossing', 'TRAIL', 'bridge', 'water'),
        ('Fern Ford', 'TRAIL', 'waypoint', 'water'), ('Mud Ford', 'TRAIL', 'waypoint', 'water'),
        ('Lost Wagon', 'DISCOVERY', 'battle', 'landmark'), ('Hanging Tree', 'DISCOVERY', 'battle', 'landmark'),
        ('Burnt Lodge', 'DISCOVERY', 'battle', 'landmark'), ('Abandoned Camp', 'DISCOVERY', 'battle', 'landmark'),
        ("Poachers' Snare", 'DISCOVERY', 'battle', 'landmark'), ('Antler Shrine', 'DISCOVERY', 'shrine', 'landmark'),
        ('Mossy Shrine', 'DISCOVERY', 'shrine', 'landmark'), ('Old Altar', 'DISCOVERY', 'shrine', 'landmark'),
        ('Ring of Oaks', 'DISCOVERY', 'shrine', 'landmark'), ("Woodsmen's Graves", 'DISCOVERY', 'shrine', 'landmark'),
        ('Bear Cave', 'DUNGEON', 'dungeon', 'cave'), ('Deep Burrow', 'DUNGEON', 'dungeon', 'cave'),
        ('Woodmarket', 'TOWN', None, 'town'), ('Timber Hamlet', 'TOWN', None, 'town'),
    ],
    'ashfall': [
        ('Cinder Camp', 'CAMP', None, 'camp'), ('Slag Heaps', 'CAMP', None, 'camp'), ('Hawk Ridge', 'CAMP', None, 'camp'),
        ('Black Rock Camp', 'CAMP', None, 'camp'), ('Ash Hollow', 'CAMP', None, 'camp'), ('Dry Wells', 'CAMP', None, 'camp'),
        ("Smelters' Camp", 'CAMP', None, 'camp'), ('Burnt Orchard', 'CAMP', None, 'camp'), ('Red Rock Camp', 'CAMP', None, 'camp'),
        ('Dust Basin', 'CAMP', None, 'camp'), ('Vulture Rock', 'CAMP', None, 'camp'), ('Cracked Well', 'CAMP', None, 'camp'),
        ('Tar Pits', 'CAMP', None, 'camp'), ('Brimstone Camp', 'CAMP', None, 'camp'), ('Flint Camp', 'CAMP', None, 'camp'),
        ('Dry Gully Camp', 'CAMP', None, 'camp'), ('Bone Hollow', 'CAMP', None, 'camp'), ("Crow's Perch", 'CAMP', None, 'camp'),
        ('Pumice Hollow', 'CAMP', None, 'camp'), ('Salt Pans', 'CAMP', None, 'camp'), ('Grey Dunes', 'CAMP', None, 'camp'),
        ('Ashpit Camp', 'CAMP', None, 'camp'), ('Hot Rocks', 'CAMP', None, 'camp'), ('Shale Camp', 'CAMP', None, 'camp'),
        ('Black Tower', 'CAMP', 'fortress', 'tower'), ('Smoke Watch', 'CAMP', 'fortress', 'tower'),
        ('Grey Fort', 'CAMP', 'fortress', 'tower'), ('Basalt Keep', 'CAMP', 'fortress', 'tower'),
        ('Ash Road', 'TRAIL', 'waypoint', 'trail'), ('Cinder Path', 'TRAIL', 'waypoint', 'trail'),
        ('Basalt Steps', 'TRAIL', 'waypoint', 'trail'), ('Dust Track', 'TRAIL', 'waypoint', 'trail'),
        ('Scree Path', 'TRAIL', 'waypoint', 'trail'), ('Narrow Pass', 'TRAIL', 'waypoint', 'trail'),
        ('Red Gully', 'TRAIL', 'waypoint', 'trail'), ('Steam Vents', 'TRAIL', 'waypoint', 'trail'),
        ('Glass Flats', 'TRAIL', 'waypoint', 'trail'), ('Crater Rim', 'TRAIL', 'waypoint', 'trail'),
        ('Silt Ford', 'TRAIL', 'waypoint', 'water'), ('Slag Bridge', 'TRAIL', 'bridge', 'water'),
        ('Grey Ford', 'TRAIL', 'waypoint', 'water'), ('Ash Bridge', 'TRAIL', 'bridge', 'water'),
        ('Fallen Watchpost', 'DISCOVERY', 'battle', 'landmark'), ('Burnt Caravan', 'DISCOVERY', 'battle', 'landmark'),
        ('Bone Field', 'DISCOVERY', 'battle', 'landmark'), ("Deserters' Camp", 'DISCOVERY', 'battle', 'landmark'),
        ("Raiders' Cairn", 'DISCOVERY', 'battle', 'landmark'), ('Fallen Bell Tower', 'DISCOVERY', 'shrine', 'landmark'),
        ('Ash Shrine', 'DISCOVERY', 'shrine', 'landmark'), ('Melted Statue', 'DISCOVERY', 'shrine', 'landmark'),
        ('Sulfur Caves', 'DUNGEON', 'dungeon', 'cave'), ('Old Smelting Works', 'DUNGEON', 'dungeon', 'cave'),
        ('Collapsed Mine', 'DUNGEON', 'dungeon', 'cave'),
        ("Smelters' Row", 'TOWN', None, 'town'), ('Cinder Market', 'TOWN', None, 'town'),
        # 2026-10-26: more names for the south-east pocket
        ('Soot Camp', 'CAMP', None, 'camp'), ('Clinker Camp', 'CAMP', None, 'camp'), ('Charred Rise', 'CAMP', None, 'camp'),
        ('Ember Flats', 'CAMP', None, 'camp'), ('Scald Camp', 'CAMP', None, 'camp'), ('Lava Steps', 'TRAIL', 'waypoint', 'trail'),
        ('Cinder Rise', 'TRAIL', 'waypoint', 'trail'), ('Ember Ford', 'TRAIL', 'waypoint', 'water'),
        ('Burnt Gibbet', 'DISCOVERY', 'battle', 'landmark'), ('Gate Market', 'TOWN', None, 'town'),
    ],
}


def name_places(P, REG, rng):
    water = [p for p in L.spline(L.RIVER_FAR, 12) + L.spline(L.BROOK_FAR, 12)]
    out = {}
    for region in ('thornwood', 'ashfall'):
        ks = sorted([k for k in P if k not in WILD0 and REG[k] == region],
                    key=lambda k: (P[k][1], P[k][0]))
        pool = list(POOL[region])
        rng.shuffle(pool)
        wet = [k for k in ks if min(math.dist(P[k], w) for w in water) < 110]
        dry = [k for k in ks if k not in wet]
        wpool = [n for n in pool if n[3] == 'water']
        dpool = [n for n in pool if n[3] != 'water']
        for k in wet:
            out[k] = wpool.pop() if wpool else dpool.pop()
        for k in dry:
            if not dpool:
                raise SystemExit(f'{region}: the name pool ran out ({len(dry)} dry and {len(wet)} wet places, {len(pool)} names)')
            out[k] = dpool.pop()
        print(region, len(ks), 'named;', len(dpool) + len(wpool), 'names left')
    return out


if __name__ == '__main__':
    main()
