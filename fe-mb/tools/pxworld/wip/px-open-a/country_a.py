"""Variant A's whole country: every one of world.json's 47 places, in the board's stage frame, and the overview.

The Borderlands are layout_a's (the board's view plus the places just past its edges). The graph is unchanged, so
Thornwood can only be entered at Thornwood Gate (past Border Fortress, east of the view) and Southern Trail (past
Roderick's Camp, south of it). Its own roads form a ring between those two doors, so it is laid as a horseshoe
round the Borderlands: the gate side (the chapel, the druids' circle, the hermit's tower, the glade, the ruins)
north-east, east and south-east; the trail side (the spiders' nest, the witch's hut, the depths, Morgana's grove)
south and south-west. Ashfall is entered only from Thornwood's far rim (Mountain Pass from Ancient Ruins, Ashfall
Trail from Morgana's Grove), and those two lie south-east and south, so Ashfall lies south of Thornwood and the
Iron Throne at its far end, due south of the camp. North (North Ridge Path) and west (Broken Bridge) are
the Borderlands' own corners: the graph puts nothing beyond them.

world_json(): positions shifted to world.json's frame (non-negative ints), with the sheet size that lets the game's
camera (OverworldScreen.cameraFor: node - (VIEW_W/2, VIEW_H*.48), clamped to the sheet) centre the camp.
"""
import json
import math
import os
import sys
from collections import deque, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import layout_a as LA   # noqa: E402

WORLD_JSON = 'E:/Work/GameDev/Godot/fe-mb/game/src/content/data/overworld/world.json'

THORNWOOD = {   # a horseshoe round the Borderlands from Thornwood Gate (east) to Southern Trail (south)
    'thornwood_gate': (1320, 510), 'southern_trail': (500, 780),
    # the gate side: north-east, east and south-east
    'thornwood_chapel': (1540, 300), 'druids_circle': (1400, -140), 'hermits_tower': (1740, 520),
    'moonlit_glade': (1840, 780), 'foggy_marsh': (1420, 700), 'dark_hollow': (1160, 830),
    'wolf_den': (1320, 1000), 'ancient_ruins': (1540, 1010),
    # the trail side: south and south-west
    'cursed_clearing': (820, 960), 'spiders_nest': (170, 820), 'witchs_hut': (460, 1050),
    'thornwood_depths': (110, 1110), 'morganas_grove': (860, 1170),
}
# Ashfall: world.json's own Ashfall laid out again south of Thornwood, its depth running south (a little west)
_ASH_TODAY = {'mountain_pass': (2060, 670), 'ashfall_trail': (2060, 748), 'ember_creek': (2163, 688), 'ruined_chapel': (2163, 783),
              'ashfall_outpost': (2266, 649), 'lava_fields': (2266, 706), 'scorched_village': (2266, 762), 'dragons_lookout': (2472, 656),
              'iron_mine': (2472, 713), 'sulfur_springs': (2472, 769), 'obsidian_cavern': (2589, 635), 'warlords_camp': (2589, 790),
              'cragmaw_fortress': (2707, 685), 'final_approach': (2707, 741), 'ashen_gate': (2839, 713), 'the_iron_throne': (3000, 713)}
ASH_O, ASH_DEPTH, ASH_SD, ASH_SA = (1130, 1290), (-0.30, 0.954), .5, 3.9


def _ash(p):
    """Today's Ashfall strip (west to east, Mountain Pass north of Ashfall Trail) -> south of Thornwood: today's
    depth (x) runs along ASH_DEPTH (south, a little west), today's north-south (y) runs east-west, so Mountain
    Pass lands east under Ancient Ruins and Ashfall Trail west under Morgana's Grove."""
    x, y = p
    d, a = (x - 2060) * ASH_SD, (y - 690) * ASH_SA
    ax, ay = -ASH_DEPTH[1], ASH_DEPTH[0]            # across: today's +y (south) -> stage west
    return (round(ASH_O[0] + d * ASH_DEPTH[0] + a * ax), round(ASH_O[1] + d * ASH_DEPTH[1] + a * ay))


ASHFALL = {k: _ash(p) for k, p in _ASH_TODAY.items()}


def positions():
    pos = {k: v for k, v in LA.P.items()}
    pos.update(THORNWOOD)
    pos.update(ASHFALL)
    return pos


def load_world():
    return json.load(open(WORLD_JSON, encoding='utf-8'))


def check():
    """The graph is world.json's, unchanged: same ids, same edges, every place placed, no two roads crossing."""
    w = load_world()
    pos = positions()
    ids = {n['id'] for n in w['nodes']}
    assert ids == set(pos), (ids ^ set(pos))
    edges = [(e['from'], e['to']) for e in w['edges']]

    def sx(p1, p2, p3, p4):
        d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
        if abs(d) < 1e-9:
            return False
        t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
        u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
        return 0 < t < 1 and 0 < u < 1
    bad = []
    for i in range(len(edges)):
        for j in range(i + 1, len(edges)):
            a, b = edges[i]
            c, d = edges[j]
            if {a, b} & {c, d}:
                continue
            if sx(pos[a], pos[b], pos[c], pos[d]):
                bad.append((edges[i], edges[j]))
    return bad


def hops():
    w = load_world()
    adj = defaultdict(list)
    vis = {n['id'] for n in w['nodes'] if not n.get('hidden')}
    for e in w['edges']:
        if e['from'] in vis and e['to'] in vis:
            adj[e['from']].append(e['to'])
            adj[e['to']].append(e['from'])
    d = {w['startNodeId']: 0}
    q = deque([w['startNodeId']])
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in d:
                d[v] = d[u] + 1
                q.append(v)
    return d


def world_json(view_w=1280, view_h=720):
    """Positions in world.json's frame: shifted so every x, y >= 32, the sheet big enough that the camera can centre
    the camp (half a view of sheet west and east of it, .48 / .52 of a view north and south)."""
    pos = positions()
    xs = [p[0] for p in pos.values()]
    ys = [p[1] for p in pos.values()]
    camp = pos['frontier_camp']
    ox = 32 - min(min(xs), camp[0] - view_w // 2)
    oy = 32 - min(min(ys), camp[1] - int(view_h * .48))
    out = {k: (x + ox, y + oy) for k, (x, y) in pos.items()}
    W = max(max(p[0] for p in out.values()) + 64, out['frontier_camp'][0] + view_w // 2)
    H = max(max(p[1] for p in out.values()) + 64, out['frontier_camp'][1] + int(view_h * .52))
    return out, (ox, oy), (W, H)


if __name__ == '__main__':
    print('crossings', check())
    out, off, size = world_json()
    print('offset', off, 'sheet', size)
    d = hops()
    for k in sorted(out, key=lambda k: (d.get(k, 99), k)):
        print(f'  {d.get(k, "-")!s:>2}  {k:<20} {out[k]}')
